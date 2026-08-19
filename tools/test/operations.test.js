'use strict';

/**
 * Tests for the Amazon SP-API operations layer.
 *
 * Run with:  node --test tools/test/
 *
 * The SP-API transport is stubbed, so these run offline and need no
 * credentials. What they cover is the part that actually breaks: how we
 * shape Amazon's payloads, and whether write operations stay dry until
 * they're confirmed.
 */

const test = require('node:test');
const assert = require('node:assert');

const api = require('../lib/sp-api');
const ops = require('../lib/operations');

const CONFIG = {
  marketplace: 'US',
  marketplaceId: 'ATVPDKIKX0DER',
  currency: 'USD',
  region: 'na',
  host: 'sellingpartnerapi-na.amazon.com',
  sellerId: 'A1SELLERID',
  clientId: 'x',
  clientSecret: 'y',
  refreshToken: 'z',
};

/** Replace the transport for one test and record what it was asked to do. */
function stub(responses) {
  const calls = [];
  const original = { get: api.get, post: api.post, patch: api.patch };

  for (const method of ['get', 'post', 'patch']) {
    api[method] = async (config, path, a, b) => {
      const query = method === 'get' ? a : b;
      calls.push({ method, path, query, body: method === 'get' ? undefined : a });
      const handler = responses[`${method} ${path}`] || responses[method];
      if (handler === undefined) {
        throw new Error(`Unstubbed call: ${method} ${path}`);
      }
      return typeof handler === 'function' ? handler({ path, query, body: a }) : handler;
    };
  }

  return {
    calls,
    restore: () => Object.assign(api, original),
  };
}

// ============================================================

test('orders: maps fulfillment channel, totals and pagination', async (t) => {
  const s = stub({
    'get /orders/v0/orders': {
      payload: {
        NextToken: 'TOKEN123',
        Orders: [
          {
            AmazonOrderId: '111-2223333-4445555',
            PurchaseDate: '2026-08-01T10:00:00Z',
            OrderStatus: 'Shipped',
            FulfillmentChannel: 'AFN',
            NumberOfItemsShipped: 2,
            NumberOfItemsUnshipped: 1,
            OrderTotal: { Amount: '54.98', CurrencyCode: 'USD' },
            ShippingAddress: { City: 'Austin', StateOrRegion: 'TX', CountryCode: 'US' },
            IsPrime: true,
          },
          {
            AmazonOrderId: '111-9998888-7776666',
            OrderStatus: 'Unshipped',
            FulfillmentChannel: 'MFN',
            NumberOfItemsShipped: 0,
            NumberOfItemsUnshipped: 1,
          },
        ],
      },
    },
  });
  t.after(s.restore);

  const result = await ops.orders(CONFIG, { days: 14, status: 'Shipped' });

  assert.strictEqual(result.count, 2);
  assert.strictEqual(result.nextToken, 'TOKEN123');
  assert.strictEqual(result.orders[0].channel, 'FBA');
  assert.strictEqual(result.orders[1].channel, 'Merchant');
  assert.strictEqual(result.orders[0].itemCount, 3);
  assert.strictEqual(result.orders[0].total, '54.98 USD');
  assert.strictEqual(result.orders[0].shipTo, 'Austin, TX, US');
  // An order with no total or address must not blow up the mapping.
  assert.strictEqual(result.orders[1].total, null);
  assert.strictEqual(result.orders[1].shipTo, null);

  const { query } = s.calls[0];
  assert.strictEqual(query.MarketplaceIds, 'ATVPDKIKX0DER');
  assert.strictEqual(query.OrderStatuses, 'Shipped');
  assert.ok(query.CreatedAfter, 'sends a CreatedAfter window');
});

test('orders: NextToken replaces CreatedAfter (they are mutually exclusive)', async (t) => {
  const s = stub({ 'get /orders/v0/orders': { payload: { Orders: [] } } });
  t.after(s.restore);

  await ops.orders(CONFIG, { nextToken: 'ABC' });

  const { query } = s.calls[0];
  assert.strictEqual(query.NextToken, 'ABC');
  assert.strictEqual(query.CreatedAfter, undefined);
});

test('inventory: sums the three inbound buckets', async (t) => {
  const s = stub({
    'get /fba/inventory/v1/summaries': {
      payload: {
        inventorySummaries: [
          {
            sellerSku: 'BECKY-SERUM-30ML',
            asin: 'B0TEST0001',
            productName: 'Becky Vitamin C Serum',
            totalQuantity: 140,
            inventoryDetails: {
              fulfillableQuantity: 100,
              inboundWorkingQuantity: 10,
              inboundShippedQuantity: 20,
              inboundReceivingQuantity: 5,
              unfulfillableQuantity: { totalUnfulfillableQuantity: 3 },
              reservedQuantity: { totalReservedQuantity: 2 },
            },
          },
        ],
      },
    },
  });
  t.after(s.restore);

  const result = await ops.inventory(CONFIG, {});
  const item = result.inventory[0];

  assert.strictEqual(item.fulfillable, 100);
  assert.strictEqual(item.inbound, 35);
  assert.strictEqual(item.unfulfillable, 3);
  assert.strictEqual(item.reserved, 2);
});

test('inventory: tolerates a summary with no detail block', async (t) => {
  const s = stub({
    'get /fba/inventory/v1/summaries': {
      payload: { inventorySummaries: [{ sellerSku: 'NO-DETAIL', totalQuantity: 0 }] },
    },
  });
  t.after(s.restore);

  const result = await ops.inventory(CONFIG, { details: false });
  assert.strictEqual(result.inventory[0].inbound, 0);
  assert.strictEqual(result.inventory[0].unfulfillable, 0);
});

test('fees: computes net proceeds from the fee total', async (t) => {
  const s = stub({
    post: {
      payload: {
        FeesEstimateResult: {
          Status: 'Success',
          FeesEstimate: {
            TotalFeesEstimate: { Amount: 9.5, CurrencyCode: 'USD' },
            FeeDetailList: [
              { FeeType: 'ReferralFee', FeeAmount: { Amount: 4.5, CurrencyCode: 'USD' } },
              { FeeType: 'FBAFees', FeeAmount: { Amount: 5.0, CurrencyCode: 'USD' } },
            ],
          },
        },
      },
    },
  });
  t.after(s.restore);

  const result = await ops.feesEstimate(CONFIG, { sku: 'BECKY-SERUM-30ML', price: 29.99 });

  assert.strictEqual(result.totalFees, '9.5 USD');
  assert.strictEqual(result.netProceeds, 20.49);
  assert.strictEqual(result.breakdown.length, 2);
  assert.strictEqual(s.calls[0].body.FeesEstimateRequest.IsAmazonFulfilled, true);
});

test('fees: rejects a non-numeric price before calling Amazon', async (t) => {
  const s = stub({});
  t.after(s.restore);

  await assert.rejects(
    () => ops.feesEstimate(CONFIG, { sku: 'X', price: 'free' }),
    /price must be a positive number/
  );
  assert.strictEqual(s.calls.length, 0, 'no request should be made');
});

test('finances: nets gross charges against fees (fees arrive negative)', async (t) => {
  const s = stub({
    'get /finances/v0/financialEvents': {
      payload: {
        FinancialEvents: {
          ShipmentEventList: [
            {
              ShipmentItemList: [
                {
                  ItemChargeList: [
                    { ChargeAmount: { CurrencyAmount: 29.99 } },
                    { ChargeAmount: { CurrencyAmount: 2.5 } },
                  ],
                  ItemFeeList: [
                    { FeeAmount: { CurrencyAmount: -4.5 } },
                    { FeeAmount: { CurrencyAmount: -5.0 } },
                  ],
                },
              ],
            },
          ],
          RefundEventList: [{}],
          ServiceFeeEventList: [],
        },
      },
    },
  });
  t.after(s.restore);

  const result = await ops.finances(CONFIG, { days: 30 });

  assert.strictEqual(result.summary.grossItemCharges, 32.49);
  assert.strictEqual(result.summary.totalFees, -9.5);
  assert.strictEqual(result.summary.net, 22.99);
  assert.deepStrictEqual(result.eventGroupCounts, { ShipmentEventList: 1, RefundEventList: 1 });
});

test('catalog: flattens summaries and sales rank', async (t) => {
  const s = stub({
    'get /catalog/2022-04-01/items': {
      numberOfResults: 1,
      items: [
        {
          asin: 'B0TEST0001',
          summaries: [{ itemName: 'Vitamin C Serum', brand: 'Becky', color: 'Clear' }],
          salesRanks: [{ classificationRanks: [{ rank: 421, title: 'Facial Serums' }] }],
        },
      ],
    },
  });
  t.after(s.restore);

  const result = await ops.catalogSearch(CONFIG, { keywords: 'vitamin c serum' });

  assert.strictEqual(result.items[0].brand, 'Becky');
  assert.strictEqual(result.items[0].salesRank, '#421 in Facial Serums');
  assert.strictEqual(s.calls[0].query.keywords, 'vitamin c serum');
});

test('catalog: requires at least one search criterion', async () => {
  await assert.rejects(() => ops.catalogSearch(CONFIG, {}), /keywords, asins, or brand/);
});

// ============================================================
// Write safety — the part that must never regress
// ============================================================

test('set-price: without confirm, validates only and persists nothing', async (t) => {
  const s = stub({
    get: { summaries: [{ productType: 'BEAUTY' }] },
    patch: { status: 'VALID', issues: [] },
  });
  t.after(s.restore);

  const result = await ops.setPrice(CONFIG, { sku: 'BECKY-SERUM-30ML', price: 24.99 });

  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(result.applied, undefined);

  const patchCall = s.calls.find((c) => c.method === 'patch');
  assert.strictEqual(patchCall.query.mode, 'VALIDATION_PREVIEW');
  assert.strictEqual(patchCall.body.productType, 'BEAUTY');

  const offer = patchCall.body.patches[0].value[0];
  assert.strictEqual(patchCall.body.patches[0].path, '/attributes/purchasable_offer');
  assert.strictEqual(offer.currency, 'USD');
  assert.strictEqual(offer.marketplace_id, 'ATVPDKIKX0DER');
  assert.strictEqual(offer.our_price[0].schedule[0].value_with_tax, 24.99);
});

test('set-price: with confirm, submits for real without the preview mode', async (t) => {
  const s = stub({
    get: { summaries: [{ productType: 'BEAUTY' }] },
    patch: { sku: 'BECKY-SERUM-30ML', status: 'ACCEPTED', submissionId: 'sub-1' },
  });
  t.after(s.restore);

  const result = await ops.setPrice(CONFIG, {
    sku: 'BECKY-SERUM-30ML',
    price: 24.99,
    confirm: true,
  });

  assert.strictEqual(result.dryRun, false);
  assert.strictEqual(result.applied, true);

  const patchCall = s.calls.find((c) => c.method === 'patch');
  assert.strictEqual(patchCall.query.mode, undefined, 'must not preview when confirmed');
});

test('set-price: a failed validation preview is reported, not thrown', async (t) => {
  const s = stub({
    get: { summaries: [{ productType: 'BEAUTY' }] },
    patch: () => {
      throw new api.SpApiError(400, [{ code: 'INVALID_ATTRIBUTE', message: 'Price too low' }]);
    },
  });
  t.after(s.restore);

  const result = await ops.setPrice(CONFIG, { sku: 'BECKY-SERUM-30ML', price: 0.01 });

  assert.strictEqual(result.dryRun, true);
  assert.match(result.validationPreview.validationFailed, /Price too low/);
});

test('set-price: rejects zero and negative prices', async (t) => {
  const s = stub({});
  t.after(s.restore);

  await assert.rejects(() => ops.setPrice(CONFIG, { sku: 'X', price: 0 }), /positive number/);
  await assert.rejects(() => ops.setPrice(CONFIG, { sku: 'X', price: -5 }), /positive number/);
  assert.strictEqual(s.calls.length, 0);
});

test('set-quantity: rejects fractional and negative quantities', async (t) => {
  const s = stub({});
  t.after(s.restore);

  await assert.rejects(
    () => ops.setQuantity(CONFIG, { sku: 'X', quantity: 1.5 }),
    /non-negative integer/
  );
  await assert.rejects(
    () => ops.setQuantity(CONFIG, { sku: 'X', quantity: -1 }),
    /non-negative integer/
  );
  assert.strictEqual(s.calls.length, 0);
});

test('set-quantity: zero is allowed — that is how you pull a listing out of stock', async (t) => {
  const s = stub({
    get: { summaries: [{ productType: 'BEAUTY' }] },
    patch: { status: 'VALID' },
  });
  t.after(s.restore);

  const result = await ops.setQuantity(CONFIG, { sku: 'BECKY-SERUM-30ML', quantity: 0 });

  const patchCall = s.calls.find((c) => c.method === 'patch');
  assert.strictEqual(patchCall.body.patches[0].value[0].quantity, 0);
  assert.strictEqual(result.dryRun, true);
});

test('patch-listing: rejects an empty patch set', async (t) => {
  const s = stub({});
  t.after(s.restore);

  await assert.rejects(
    () => ops.patchListing(CONFIG, { sku: 'X', patches: [] }),
    /non-empty array/
  );
  await assert.rejects(
    () => ops.patchListing(CONFIG, { sku: 'X', patches: 'nope' }),
    /non-empty array/
  );
  assert.strictEqual(s.calls.length, 0);
});

test('patch-listing: surfaces a SKU whose product type cannot be resolved', async (t) => {
  const s = stub({ get: { summaries: [] } });
  t.after(s.restore);

  await assert.rejects(
    () => ops.patchListing(CONFIG, { sku: 'GHOST-SKU', patches: [{ op: 'replace' }] }),
    /Could not determine the product type/
  );
});

test('reports: download reports status instead of failing when not DONE', async (t) => {
  const s = stub({ get: { processingStatus: 'IN_PROGRESS' } });
  t.after(s.restore);

  const result = await ops.reportDownload(CONFIG, { reportId: 'REPORT1' });
  assert.strictEqual(result.status, 'IN_PROGRESS');
  assert.match(result.message, /not DONE/);
});

// ============================================================
// Config
// ============================================================

test('config: marketplace selects the right region, host and currency', () => {
  assert.strictEqual(api.getConfig({ marketplace: 'UK' }).host, 'sellingpartnerapi-eu.amazon.com');
  assert.strictEqual(api.getConfig({ marketplace: 'JP' }).host, 'sellingpartnerapi-fe.amazon.com');
  assert.strictEqual(api.getConfig({ marketplace: 'US' }).host, 'sellingpartnerapi-na.amazon.com');
  assert.strictEqual(api.getConfig({ marketplace: 'de' }).currency, 'EUR');
  assert.strictEqual(api.getConfig({ marketplace: 'CA' }).marketplaceId, 'A2EUQ1WTGCTBG2');
});

test('config: sandbox switches the endpoint', () => {
  assert.strictEqual(
    api.getConfig({ marketplace: 'US', sandbox: true }).host,
    'sandbox.sellingpartnerapi-na.amazon.com'
  );
});

test('config: an unknown marketplace fails loudly', () => {
  assert.throws(() => api.getConfig({ marketplace: 'ZZ' }), /Unknown marketplace/);
});

test('daysAgoIso: returns an ISO timestamp in the past', () => {
  const iso = api.daysAgoIso(7);
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Date.parse(iso) < Date.now());
});
