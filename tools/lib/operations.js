'use strict';

/**
 * Becky's Amazon Seller operations.
 *
 * One implementation of every operation, shared by the CLI and the MCP
 * server so both surfaces behave identically. Every function takes a
 * resolved config plus a plain args object and returns JSON-serializable
 * data.
 *
 * Write operations never touch the live catalog unless `confirm: true` is
 * passed. Without it they return the exact request that would be sent,
 * along with Amazon's own VALIDATION_PREVIEW verdict on it.
 */

const api = require('./sp-api');

const LISTINGS_INCLUDED_DATA =
  'summaries,attributes,offers,fulfillmentAvailability,issues,productTypes';

// ============================================================
// Account
// ============================================================

async function marketplaces(config) {
  const data = await api.get(config, '/sellers/v1/marketplaceParticipations');
  const list = (data && data.payload) || [];
  return {
    marketplaces: list.map((entry) => ({
      name: entry.marketplace.name,
      countryCode: entry.marketplace.countryCode,
      marketplaceId: entry.marketplace.id,
      currency: entry.marketplace.defaultCurrencyCode,
      isParticipating: entry.participation.isParticipating,
      hasSuspendedListings: entry.participation.hasSuspendedListings,
      // "Non-Amazon <CC>" entries are internal fulfillment channels (MCF),
      // not storefronts you can list on.
      storefront: !/^Non-Amazon/i.test(entry.marketplace.name || ''),
    })),
  };
}

// ============================================================
// Orders
// ============================================================

async function orders(config, args = {}) {
  const query = {
    MarketplaceIds: config.marketplaceId,
    CreatedAfter: args.createdAfter || api.daysAgoIso(args.days || 7),
    MaxResultsPerPage: args.limit || 50,
  };
  if (args.status) query.OrderStatuses = args.status;
  if (args.nextToken) {
    // CreatedAfter and NextToken are mutually exclusive on this operation.
    delete query.CreatedAfter;
    query.NextToken = args.nextToken;
  }

  const data = await api.get(config, '/orders/v0/orders', query);
  const payload = (data && data.payload) || {};
  const list = payload.Orders || [];

  return {
    count: list.length,
    nextToken: payload.NextToken || null,
    orders: list.map((order) => ({
      orderId: order.AmazonOrderId,
      purchaseDate: order.PurchaseDate,
      status: order.OrderStatus,
      channel: order.FulfillmentChannel === 'AFN' ? 'FBA' : 'Merchant',
      itemCount: order.NumberOfItemsShipped + order.NumberOfItemsUnshipped,
      total: order.OrderTotal
        ? `${order.OrderTotal.Amount} ${order.OrderTotal.CurrencyCode}`
        : null,
      shipTo: order.ShippingAddress
        ? [
            order.ShippingAddress.City,
            order.ShippingAddress.StateOrRegion,
            order.ShippingAddress.CountryCode,
          ]
            .filter(Boolean)
            .join(', ')
        : null,
      isPrime: order.IsPrime,
      isBusinessOrder: order.IsBusinessOrder,
    })),
  };
}

async function order(config, args) {
  requireArg(args, 'orderId');
  const data = await api.get(config, `/orders/v0/orders/${encodeURIComponent(args.orderId)}`);
  return (data && data.payload) || data;
}

async function orderItems(config, args) {
  requireArg(args, 'orderId');
  const data = await api.get(
    config,
    `/orders/v0/orders/${encodeURIComponent(args.orderId)}/orderItems`
  );
  const payload = (data && data.payload) || {};
  return {
    orderId: payload.AmazonOrderId,
    items: (payload.OrderItems || []).map((item) => ({
      sku: item.SellerSKU,
      asin: item.ASIN,
      title: item.Title,
      quantityOrdered: item.QuantityOrdered,
      quantityShipped: item.QuantityShipped,
      itemPrice: item.ItemPrice
        ? `${item.ItemPrice.Amount} ${item.ItemPrice.CurrencyCode}`
        : null,
      itemPromoDiscount: item.PromotionDiscount
        ? `${item.PromotionDiscount.Amount} ${item.PromotionDiscount.CurrencyCode}`
        : null,
    })),
  };
}

// ============================================================
// Inventory
// ============================================================

async function inventory(config, args = {}) {
  const query = {
    granularityType: 'Marketplace',
    granularityId: config.marketplaceId,
    marketplaceIds: config.marketplaceId,
    details: args.details === false ? 'false' : 'true',
  };
  if (args.skus) query.sellerSkus = args.skus;
  if (args.nextToken) query.nextToken = args.nextToken;

  const data = await api.get(config, '/fba/inventory/v1/summaries', query);
  const payload = (data && data.payload) || {};
  const list = payload.inventorySummaries || [];

  return {
    count: list.length,
    nextToken: (data && data.pagination && data.pagination.nextToken) || null,
    inventory: list.map((item) => {
      const detail = item.inventoryDetails || {};
      return {
        sku: item.sellerSku,
        asin: item.asin,
        fnsku: item.fnSku,
        productName: item.productName,
        condition: item.condition,
        totalQuantity: item.totalQuantity,
        fulfillable: detail.fulfillableQuantity,
        inbound:
          (detail.inboundWorkingQuantity || 0) +
          (detail.inboundShippedQuantity || 0) +
          (detail.inboundReceivingQuantity || 0),
        unfulfillable:
          (detail.unfulfillableQuantity &&
            detail.unfulfillableQuantity.totalUnfulfillableQuantity) ||
          0,
        reserved:
          (detail.reservedQuantity && detail.reservedQuantity.totalReservedQuantity) || 0,
      };
    }),
  };
}

// ============================================================
// Listings
// ============================================================

async function listing(config, args) {
  requireArg(args, 'sku');
  api.assertSellerId(config);
  return api.get(
    config,
    `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}/${encodeURIComponent(args.sku)}`,
    { marketplaceIds: config.marketplaceId, includedData: LISTINGS_INCLUDED_DATA }
  );
}

/** A listing patch must declare the item's real product type, so look it up. */
async function resolveProductType(config, sku) {
  const item = await api.get(
    config,
    `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}/${encodeURIComponent(sku)}`,
    { marketplaceIds: config.marketplaceId, includedData: 'summaries' }
  );
  const summary = (item.summaries || [])[0];
  if (!summary || !summary.productType) {
    throw new Error(
      `Could not determine the product type for SKU "${sku}". ` +
        'Confirm the SKU exists in this marketplace.'
    );
  }
  return summary.productType;
}

/**
 * Submit (or preview) a JSON Patch against a listing.
 *
 * Dry run is the default: we send the same patch with mode=VALIDATION_PREVIEW,
 * which runs Amazon's real validation without persisting anything.
 */
async function patchListing(config, args) {
  requireArg(args, 'sku');

  const patches = args.patches;
  if (!Array.isArray(patches) || patches.length === 0) {
    throw new Error('patches must be a non-empty array of JSON Patch operations.');
  }

  api.assertSellerId(config);

  const productType = args.productType || (await resolveProductType(config, args.sku));
  const body = { productType, patches };
  const apiPath = `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}/${encodeURIComponent(args.sku)}`;
  const query = { marketplaceIds: config.marketplaceId };

  if (!args.confirm) {
    let validation;
    try {
      validation = await api.patch(config, apiPath, body, {
        ...query,
        mode: 'VALIDATION_PREVIEW',
      });
    } catch (e) {
      validation = { validationFailed: e.message, errors: e.errors || [] };
    }
    return {
      dryRun: true,
      message:
        'Nothing was changed. Amazon validated this request without persisting it. ' +
        'Re-run with confirm to apply it.',
      request: { method: 'PATCH', path: apiPath, query, body },
      validationPreview: validation,
    };
  }

  const result = await api.patch(config, apiPath, body, query);
  return { dryRun: false, applied: true, marketplace: config.marketplace, sku: args.sku, result };
}

async function setPrice(config, args) {
  requireArg(args, 'sku');
  const price = Number(args.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`price must be a positive number, got "${args.price}".`);
  }

  return patchListing(config, {
    sku: args.sku,
    confirm: args.confirm,
    productType: args.productType,
    patches: [
      {
        op: 'replace',
        path: '/attributes/purchasable_offer',
        value: [
          {
            marketplace_id: config.marketplaceId,
            currency: args.currency || config.currency,
            our_price: [{ schedule: [{ value_with_tax: price }] }],
          },
        ],
      },
    ],
  });
}

async function setQuantity(config, args) {
  requireArg(args, 'sku');
  const quantity = Number(args.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`quantity must be a non-negative integer, got "${args.quantity}".`);
  }

  // Only meaningful for merchant-fulfilled listings — Amazon owns the
  // quantity on FBA offers, which are adjusted via inbound shipments.
  return patchListing(config, {
    sku: args.sku,
    confirm: args.confirm,
    productType: args.productType,
    patches: [
      {
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [
          {
            fulfillment_channel_code: args.fulfillmentChannelCode || 'DEFAULT',
            quantity,
          },
        ],
      },
    ],
  });
}

// ============================================================
// Catalog & pricing
// ============================================================

async function catalogSearch(config, args = {}) {
  if (!args.keywords && !args.asins && !args.brand) {
    throw new Error('Provide keywords, asins, or brand to search the catalog.');
  }
  const query = {
    marketplaceIds: config.marketplaceId,
    includedData: 'summaries,images,salesRanks',
    pageSize: args.limit || 10,
  };
  if (args.keywords) query.keywords = args.keywords;
  if (args.asins) query.identifiers = args.asins;
  if (args.asins) query.identifiersType = 'ASIN';
  if (args.brand) query.brandNames = args.brand;

  const data = await api.get(config, '/catalog/2022-04-01/items', query);
  return {
    total: data.numberOfResults,
    items: (data.items || []).map((item) => {
      const summary = (item.summaries || [])[0] || {};
      const rank = ((item.salesRanks || [])[0] || {}).classificationRanks || [];
      return {
        asin: item.asin,
        title: summary.itemName,
        brand: summary.brand,
        color: summary.color,
        size: summary.size,
        salesRank: rank.length ? `#${rank[0].rank} in ${rank[0].title}` : null,
      };
    }),
  };
}

async function myPricing(config, args) {
  requireArg(args, 'skus');
  const data = await api.get(config, '/products/pricing/v0/price', {
    MarketplaceId: config.marketplaceId,
    Skus: args.skus,
    ItemType: 'Sku',
  });
  return (data && data.payload) || data;
}

async function competitivePricing(config, args) {
  requireArg(args, 'asins');
  const data = await api.get(config, '/products/pricing/v0/competitivePrice', {
    MarketplaceId: config.marketplaceId,
    Asins: args.asins,
    ItemType: 'Asin',
  });
  return (data && data.payload) || data;
}

async function feesEstimate(config, args) {
  requireArg(args, 'sku');
  const price = Number(args.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`price must be a positive number, got "${args.price}".`);
  }

  const data = await api.post(
    config,
    `/products/fees/v0/listings/${encodeURIComponent(args.sku)}/feesEstimate`,
    {
      FeesEstimateRequest: {
        MarketplaceId: config.marketplaceId,
        IdType: 'SellerSKU',
        IdValue: args.sku,
        Identifier: `becky-fees-${args.sku}`,
        IsAmazonFulfilled: args.fba !== false,
        PriceToEstimateFees: {
          ListingPrice: { CurrencyCode: config.currency, Amount: price },
        },
      },
    }
  );

  const result = (data && data.payload && data.payload.FeesEstimateResult) || {};
  const estimate = result.FeesEstimate || {};
  const total = estimate.TotalFeesEstimate;

  return {
    sku: args.sku,
    listingPrice: `${price} ${config.currency}`,
    status: result.Status,
    totalFees: total ? `${total.Amount} ${total.CurrencyCode}` : null,
    netProceeds: total ? Number((price - total.Amount).toFixed(2)) : null,
    breakdown: (estimate.FeeDetailList || []).map((fee) => ({
      type: fee.FeeType,
      amount: `${fee.FeeAmount.Amount} ${fee.FeeAmount.CurrencyCode}`,
    })),
    error: result.Error || null,
  };
}

// ============================================================
// Finances
// ============================================================

async function finances(config, args = {}) {
  const data = await api.get(config, '/finances/v0/financialEvents', {
    PostedAfter: args.postedAfter || api.daysAgoIso(args.days || 30),
    MaxResultsPerPage: args.limit || 100,
    NextToken: args.nextToken,
  });

  const payload = (data && data.payload) || {};
  const groups = payload.FinancialEvents || {};
  const shipments = groups.ShipmentEventList || [];

  let revenue = 0;
  let fees = 0;
  for (const event of shipments) {
    for (const item of event.ShipmentItemList || []) {
      for (const charge of item.ItemChargeList || []) {
        revenue += (charge.ChargeAmount && charge.ChargeAmount.CurrencyAmount) || 0;
      }
      for (const fee of item.ItemFeeList || []) {
        fees += (fee.FeeAmount && fee.FeeAmount.CurrencyAmount) || 0;
      }
    }
  }

  return {
    period: `since ${args.postedAfter || api.daysAgoIso(args.days || 30)}`,
    nextToken: payload.NextToken || null,
    summary: {
      shipmentEvents: shipments.length,
      grossItemCharges: Number(revenue.toFixed(2)),
      // Amazon reports fees as negative amounts.
      totalFees: Number(fees.toFixed(2)),
      net: Number((revenue + fees).toFixed(2)),
      currency: config.currency,
    },
    eventGroupCounts: Object.fromEntries(
      Object.entries(groups)
        .filter(([, value]) => Array.isArray(value) && value.length)
        .map(([key, value]) => [key, value.length])
    ),
  };
}

// ============================================================
// Reports
// ============================================================

async function reportsList(config, args = {}) {
  const data = await api.get(config, '/reports/2021-06-30/reports', {
    marketplaceIds: config.marketplaceId,
    reportTypes: args.reportTypes,
    pageSize: args.limit || 20,
    nextToken: args.nextToken,
  });
  return {
    reports: (data.reports || []).map((report) => ({
      reportId: report.reportId,
      reportType: report.reportType,
      status: report.processingStatus,
      createdTime: report.createdTime,
      reportDocumentId: report.reportDocumentId || null,
    })),
    nextToken: data.nextToken || null,
  };
}

async function reportCreate(config, args) {
  requireArg(args, 'reportType');
  const body = {
    reportType: args.reportType,
    marketplaceIds: [config.marketplaceId],
  };
  if (args.days) body.dataStartTime = api.daysAgoIso(args.days);
  if (args.dataStartTime) body.dataStartTime = args.dataStartTime;
  if (args.dataEndTime) body.dataEndTime = args.dataEndTime;

  const data = await api.post(config, '/reports/2021-06-30/reports', body);
  return {
    reportId: data.reportId,
    message: 'Report queued. Poll with report-get until status is DONE.',
  };
}

async function reportGet(config, args) {
  requireArg(args, 'reportId');
  return api.get(config, `/reports/2021-06-30/reports/${encodeURIComponent(args.reportId)}`);
}

/** Fetch a finished report's contents (resolves the document, then downloads). */
async function reportDownload(config, args) {
  let documentId = args.documentId;

  if (!documentId) {
    requireArg(args, 'reportId');
    const report = await reportGet(config, args);
    if (report.processingStatus !== 'DONE') {
      return {
        reportId: args.reportId,
        status: report.processingStatus,
        message: 'Report is not DONE yet — nothing to download.',
      };
    }
    documentId = report.reportDocumentId;
  }

  const doc = await api.get(
    config,
    `/reports/2021-06-30/documents/${encodeURIComponent(documentId)}`
  );
  const content = await api.downloadDocument(
    doc.url,
    doc.compressionAlgorithm,
    args.encoding || 'utf8'
  );
  return { documentId, content };
}

// ============================================================

function requireArg(args, name) {
  if (!args || args[name] === undefined || args[name] === null || args[name] === '') {
    throw new Error(`Missing required argument: ${name}`);
  }
}

module.exports = {
  marketplaces,
  orders,
  order,
  orderItems,
  inventory,
  listing,
  patchListing,
  setPrice,
  setQuantity,
  catalogSearch,
  myPricing,
  competitivePricing,
  feesEstimate,
  finances,
  reportsList,
  reportCreate,
  reportGet,
  reportDownload,
};
