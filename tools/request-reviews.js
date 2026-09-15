#!/usr/bin/env node

/**
 * Request reviews for Becky orders
 *
 * Sends Amazon's standard "Request a Review" (product review + seller
 * feedback) for every order that is currently eligible. Amazon only offers
 * the request 5–30 days after delivery and once per order, so running this
 * daily is safe: orders already requested or outside the window are skipped.
 *
 * Usage: node tools/request-reviews.js [--days 60] [--dry-run]
 *
 * Each run appends a one-line JSON summary to ~/.becky-review-requests.jsonl.
 */

const fs = require('fs');
const path = require('path');
const api = require('./lib/sp-api');

const US_MARKETPLACE = 'ATVPDKIKX0DER';
const REVIEW_ACTION = 'productReviewAndSellerFeedback';
const LOG_FILE = path.join(process.env.HOME, '.becky-review-requests.jsonl');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const opts = { days: 60, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--days') opts.days = Number(argv[++i]);
  }
  return opts;
}

// Pre-sale orders can deliver weeks after they're placed, so look back further
// than the 30-day request window.
async function shippedOrders(config, days) {
  const orders = [];
  let nextToken;
  do {
    const query = nextToken
      ? { MarketplaceIds: US_MARKETPLACE, NextToken: nextToken }
      : {
          MarketplaceIds: US_MARKETPLACE,
          CreatedAfter: api.daysAgoIso(days),
          OrderStatuses: 'Shipped,PartiallyShipped',
        };
    const res = await api.get(config, '/orders/v0/orders', query);
    const payload = res.payload || res;
    orders.push(...(payload.Orders || []));
    nextToken = payload.NextToken;
    if (nextToken) await sleep(2000);
  } while (nextToken);
  return orders;
}

async function canRequestReview(config, orderId) {
  const res = await api.get(config, `/solicitations/v1/orders/${orderId}`, {
    marketplaceIds: US_MARKETPLACE,
  });
  const actions = [...((res._links && res._links.actions) || []), ...((res._embedded && res._embedded.actions) || [])];
  return actions.some((a) =>
    [a.name, a.href, a._links && a._links.self && a._links.self.href].some((v) =>
      String(v || '').includes(REVIEW_ACTION)
    )
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = api.getConfig();
  api.assertCredentials(config);

  const orders = await shippedOrders(config, opts.days);
  const requested = [];
  const failures = [];
  let notEligible = 0;

  for (const order of orders) {
    const orderId = order.AmazonOrderId;
    try {
      // Solicitations are limited to one request per second.
      await sleep(1100);
      if (!(await canRequestReview(config, orderId))) {
        notEligible += 1;
        continue;
      }
      if (!opts.dryRun) {
        await sleep(1100);
        await api.post(
          config,
          `/solicitations/v1/orders/${orderId}/solicitations/${REVIEW_ACTION}`,
          undefined,
          { marketplaceIds: US_MARKETPLACE }
        );
      }
      requested.push(orderId);
    } catch (err) {
      failures.push({ orderId, error: err.message });
    }
  }

  const summary = {
    ranAt: new Date().toISOString(),
    dryRun: opts.dryRun,
    ordersChecked: orders.length,
    requested: requested.length,
    notEligible,
    failed: failures.length,
    requestedOrderIds: requested,
    failures,
  };
  if (!opts.dryRun) fs.appendFileSync(LOG_FILE, JSON.stringify(summary) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
