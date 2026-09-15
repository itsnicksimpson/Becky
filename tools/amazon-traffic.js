#!/usr/bin/env node

/**
 * Amazon sales & traffic for Becky
 *
 * Requests Amazon's Sales and Traffic business report by day and prints one
 * row per day: sessions, page views, Buy Box %, conversion (unit session %),
 * units and ordered sales. Amazon revises recent days, so re-pull a week back.
 *
 * Usage: node tools/amazon-traffic.js [--days 14]
 */

const api = require('./lib/sp-api');

const US_MARKETPLACE = 'ATVPDKIKX0DER';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ymd = (d) => d.toISOString().slice(0, 10);

function parseArgs(argv) {
  const opts = { days: 14 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opts.days = Math.max(1, Number(argv[++i]));
  }
  return opts;
}

async function waitForReport(config, reportId) {
  for (let i = 0; i < 60; i++) {
    const report = await api.get(config, `/reports/2021-06-30/reports/${reportId}`);
    if (['DONE', 'CANCELLED', 'FATAL'].includes(report.processingStatus)) return report;
    await sleep(15000);
  }
  throw new Error(`Report ${reportId} did not finish in 15 minutes`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = api.getConfig();
  api.assertCredentials(config);

  const end = new Date(Date.now() - 86400000);
  const start = new Date(end.getTime() - (opts.days - 1) * 86400000);
  const created = await api.post(config, '/reports/2021-06-30/reports', {
    reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
    marketplaceIds: [US_MARKETPLACE],
    dataStartTime: `${ymd(start)}T00:00:00Z`,
    dataEndTime: `${ymd(end)}T23:59:59Z`,
    reportOptions: { dateGranularity: 'DAY', asinGranularity: 'CHILD' },
  });

  const report = await waitForReport(config, created.reportId);
  if (report.processingStatus !== 'DONE') {
    // Amazon cancels the report when the period has no data at all.
    console.log(JSON.stringify({ start: ymd(start), end: ymd(end), status: report.processingStatus, days: [] }, null, 2));
    return;
  }

  const doc = await api.get(config, `/reports/2021-06-30/documents/${report.reportDocumentId}`);
  const data = JSON.parse(await api.downloadDocument(doc.url, doc.compressionAlgorithm));
  const days = (data.salesAndTrafficByDate || []).map((d) => {
    const t = d.trafficByDate || {};
    const s = d.salesByDate || {};
    return {
      date: d.date,
      sessions: t.sessions ?? null,
      pageViews: t.pageViews ?? null,
      buyBoxPct: t.buyBoxPercentage ?? null,
      conversionPct: t.unitSessionPercentage ?? null,
      units: s.unitsOrdered ?? null,
      orderItems: s.totalOrderItems ?? null,
      orderedSales: s.orderedProductSales ? s.orderedProductSales.amount : null,
    };
  });

  console.log(JSON.stringify({ start: ymd(start), end: ymd(end), status: 'DONE', days }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
