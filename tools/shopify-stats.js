#!/usr/bin/env node

/**
 * Shopify stats for the Becky dashboard: variant prices and stock, plus hibecky.com
 * orders per day (New York dates, cancelled and test orders excluded).
 *
 * Usage: node tools/shopify-stats.js [--days 35]
 * Prints JSON: {checkedAt, store, variants, days: [{date, orders, jars, sales, total}], last30}
 * sales = product sales after discounts and refunds (no shipping or tax); total = what buyers paid.
 */

const { getConfig, resolveAccessToken, executeQuery } = require('./shopify-admin');

const TZ = 'America/New_York';

const PRODUCTS_QUERY = `{
  products(first: 20) {
    nodes {
      title
      variants(first: 20) {
        nodes { title sku price compareAtPrice inventoryQuantity }
      }
    }
  }
}`;

const ORDERS_QUERY = `query($cursor: String, $q: String) {
  orders(first: 100, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      createdAt
      cancelledAt
      test
      currentSubtotalPriceSet { shopMoney { amount } }
      currentTotalPriceSet { shopMoney { amount } }
      lineItems(first: 20) {
        nodes { sku variantTitle currentQuantity }
      }
    }
  }
}`;

function ymd(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function jarsPer(sku, variantTitle) {
  return /-2$/.test(sku || '') || /duo/i.test(variantTitle || '') ? 2 : 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

async function gql(config, query, variables) {
  const token = await resolveAccessToken(config);
  const result = await executeQuery(config.store, token, query, variables);
  if (result.status !== 200 || result.data.errors) {
    throw new Error(`Shopify HTTP ${result.status}: ${JSON.stringify(result.data.errors || result.data).slice(0, 400)}`);
  }
  return result.data.data;
}

async function main() {
  const args = process.argv.slice(2);
  const daysIndex = args.indexOf('--days');
  const dayCount = Math.min(58, Math.max(1, Number(daysIndex !== -1 ? args[daysIndex + 1] : 35) || 35));

  const config = getConfig();
  if (!config.accessToken && !(config.clientId && config.clientSecret)) {
    throw new Error('No Shopify credentials configured. Run: node tools/shopify-admin.js setup-app');
  }

  // Completed New York days ending yesterday, oldest first.
  const dates = [];
  for (let i = dayCount; i >= 1; i--) dates.push(ymd(new Date(Date.now() - i * 86400000)));
  const byDate = Object.fromEntries(dates.map((date) => [date, { date, orders: 0, jars: 0, sales: 0, total: 0 }]));

  const products = await gql(config, PRODUCTS_QUERY);
  const variants = [];
  for (const product of products.products.nodes) {
    for (const v of product.variants.nodes) {
      variants.push({
        product: product.title,
        title: v.title,
        sku: v.sku,
        jars: jarsPer(v.sku, v.title),
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice),
        stock: v.inventoryQuantity,
      });
    }
  }

  // Fetch from two days before the window so time zone edges are covered, then bucket by NY date.
  const since = new Date(Date.now() - (dayCount + 2) * 86400000).toISOString();
  let cursor = null;
  do {
    const data = await gql(config, ORDERS_QUERY, { cursor, q: `created_at:>='${since}'` });
    for (const order of data.orders.nodes) {
      if (order.test || order.cancelledAt) continue;
      const day = byDate[ymd(new Date(order.createdAt))];
      if (!day) continue;
      day.orders += 1;
      day.jars += order.lineItems.nodes.reduce((sum, li) => sum + li.currentQuantity * jarsPer(li.sku, li.variantTitle), 0);
      day.sales += Number(order.currentSubtotalPriceSet.shopMoney.amount);
      day.total += Number(order.currentTotalPriceSet.shopMoney.amount);
    }
    cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (cursor);

  const days = dates.map((date) => ({ ...byDate[date], sales: round2(byDate[date].sales), total: round2(byDate[date].total) }));
  const recent = days.slice(-30);
  const last30 = {
    from: recent[0].date,
    to: recent[recent.length - 1].date,
    orders: recent.reduce((s, d) => s + d.orders, 0),
    jars: recent.reduce((s, d) => s + d.jars, 0),
    sales: round2(recent.reduce((s, d) => s + d.sales, 0)),
  };

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), store: config.store, variants, days, last30 }, null, 2));
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
