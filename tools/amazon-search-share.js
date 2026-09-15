#!/usr/bin/env node

/**
 * Weekly Amazon search share for Becky (Brand Analytics, needs Brand Registry + the Brand Analytics role).
 * Pulls the Search Query Performance report (per search term: impressions, clicks, cart adds and
 * purchases, with Becky's share of each) and the Search Catalog Performance report (Becky's totals
 * from search) for recent complete Sunday–Saturday weeks.
 *
 * Usage: node tools/amazon-search-share.js [--weeks 1] [--asin B07JFBZSCT]
 * Prints JSON: {asin, weeks: [{weekStart, weekEnd, totals, queries: [...]}]}
 */

const api = require('./lib/sp-api');

const MARKETPLACE = 'ATVPDKIKX0DER';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const ymd = (d) => d.toISOString().slice(0, 10);
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// Most recent complete Sunday–Saturday weeks. Amazon publishes a week a few days after it ends.
function recentWeeks(count) {
  const today = new Date();
  const lastSaturday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  lastSaturday.setUTCDate(lastSaturday.getUTCDate() - ((lastSaturday.getUTCDay() + 1) % 7 || 7));
  if ((today - lastSaturday) / 86400000 < 3) lastSaturday.setUTCDate(lastSaturday.getUTCDate() - 7);
  const weeks = [];
  for (let i = 0; i < count; i++) {
    const end = new Date(lastSaturday);
    end.setUTCDate(end.getUTCDate() - 7 * i);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    weeks.push({ weekStart: ymd(start), weekEnd: ymd(end) });
  }
  return weeks;
}

async function runReport(config, reportType, week, reportOptions) {
  const created = await api.post(config, '/reports/2021-06-30/reports', {
    reportType,
    marketplaceIds: [MARKETPLACE],
    dataStartTime: `${week.weekStart}T00:00:00Z`,
    dataEndTime: `${week.weekEnd}T23:59:59Z`,
    reportOptions,
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    const report = await api.get(config, `/reports/2021-06-30/reports/${created.reportId}`);
    if (report.processingStatus === 'DONE') {
      const doc = await api.get(config, `/reports/2021-06-30/documents/${report.reportDocumentId}`);
      const body = await api.downloadDocument(doc.url, doc.compressionAlgorithm);
      return JSON.parse(typeof body === 'string' ? body : body.toString());
    }
    if (report.processingStatus === 'CANCELLED') return null; // Amazon cancels when there's no data
    if (report.processingStatus === 'FATAL') throw new Error(`${reportType} failed for ${week.weekStart}`);
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  throw new Error(`${reportType} still processing after 15 minutes for ${week.weekStart}`);
}

function parseQueries(report) {
  return ((report && report.dataByAsin) || []).map((row) => {
    const q = row.searchQueryData || {};
    const imp = row.impressionData || {};
    const clk = row.clickData || {};
    const cart = row.cartAddData || {};
    const buy = row.purchaseData || {};
    return {
      query: q.searchQuery,
      queryVolume: num(q.searchQueryVolume),
      queryScore: num(q.searchQueryScore),
      impressions: num(imp.asinImpressionCount),
      impressionShare: num(imp.asinImpressionShare),
      totalImpressions: num(imp.totalQueryImpressionCount),
      clicks: num(clk.asinClickCount),
      clickShare: num(clk.asinClickShare),
      totalClicks: num(clk.totalClickCount),
      cartAdds: num(cart.asinCartAddCount),
      cartAddShare: num(cart.asinCartAddShare),
      purchases: num(buy.asinPurchaseCount),
      purchaseShare: num(buy.asinPurchaseShare),
      totalPurchases: num(buy.totalPurchaseCount),
    };
  }).filter((r) => r.query).sort((a, b) => (b.queryVolume || 0) - (a.queryVolume || 0));
}

function parseTotals(report) {
  const row = ((report && report.dataByAsin) || [])[0];
  if (!row) return null;
  const imp = row.impressionData || {};
  const clk = row.clickData || {};
  const cart = row.cartAddData || {};
  const buy = row.purchaseData || {};
  const sales = buy.searchTrafficSales || {};
  return {
    impressions: num(imp.impressionCount),
    clicks: num(clk.clickCount),
    clickRate: num(clk.clickRate),
    cartAdds: num(cart.cartAddCount),
    purchases: num(buy.purchaseCount),
    conversionRate: num(buy.conversionRate),
    searchSales: num(sales.amount),
  };
}

async function main() {
  const asin = arg('--asin', 'B07JFBZSCT');
  const weekCount = Math.max(1, Math.min(8, Number(arg('--weeks', 1)) || 1));
  const config = api.getConfig();
  api.assertCredentials(config);

  const weeks = [];
  for (const week of recentWeeks(weekCount)) {
    const sqp = await runReport(config, 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT', week, { reportPeriod: 'WEEK', asin });
    const catalog = await runReport(config, 'GET_BRAND_ANALYTICS_SEARCH_CATALOG_PERFORMANCE_REPORT', week, { reportPeriod: 'WEEK' });
    const queries = parseQueries(sqp);
    weeks.push({ ...week, totals: parseTotals(catalog), queryCount: queries.length, queries: queries.slice(0, 25) });
  }
  console.log(JSON.stringify({ asin, weeks }, null, 2));
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
