#!/usr/bin/env node

/**
 * Amazon settlement summary for Becky
 *
 * Downloads the settlement reports Amazon generates every ~14 days and totals
 * them by month: sales, refunds, promotions, each fee type, reimbursements and
 * payouts. Prints JSON for the dashboard's real monthly P&L.
 *
 * Usage: node tools/amazon-settlements.js [--days 89]
 *   Amazon only lists reports created in the last 90 days.
 */

const api = require('./lib/sp-api');

const REPORT_TYPE = 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2';
const FIELDS = ['sales', 'refunds', 'promotions', 'commission', 'fulfillment', 'storage', 'inbound', 'subscription', 'couponFees', 'otherFees', 'reimbursements', 'tax', 'payouts', 'units'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const num = (v) => {
  const n = parseFloat(String(v || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function parseArgs(argv) {
  const opts = { days: 89 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opts.days = Math.min(89, Number(argv[++i]));
  }
  return opts;
}

function monthOf(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1]}`;
  return null;
}

async function listReports(config, days) {
  const reports = [];
  let nextToken;
  do {
    const query = nextToken
      ? { nextToken }
      : { reportTypes: REPORT_TYPE, processingStatuses: 'DONE', createdSince: api.daysAgoIso(days), pageSize: 100 };
    const res = await api.get(config, '/reports/2021-06-30/reports', query);
    reports.push(...(res.reports || []));
    nextToken = res.nextToken;
    if (nextToken) await sleep(2000);
  } while (nextToken);
  return reports;
}

function parseTsv(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean);
  const header = (lines.shift() || '').split('\t');
  return lines.map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] || '']));
  });
}

// Maps one settlement line to a P&L bucket. Amounts keep Amazon's sign:
// money in is positive, fees and refunds are negative.
function bucketFor(row) {
  const type = row['amount-type'] || '';
  const desc = row['amount-description'] || '';
  const txn = row['transaction-type'] || '';
  if (/tax/i.test(type) || /tax/i.test(desc)) return 'tax';
  if (type === 'ItemPrice') return txn === 'Refund' ? 'refunds' : 'sales';
  if (type === 'Promotion') return 'promotions';
  if (/commission/i.test(desc)) return 'commission';
  if (/fba|fulfil/i.test(desc) && !/inbound|transport|placement/i.test(desc)) return 'fulfillment';
  if (/storage/i.test(desc)) return 'storage';
  if (/inbound|transport|placement/i.test(desc)) return 'inbound';
  if (/subscription/i.test(desc)) return 'subscription';
  if (/coupon|deal|lightning|vine/i.test(desc)) return 'couponFees';
  if (/reimburse|reversal|warehouse_(damage|lost)|lost|damaged/i.test(desc + ' ' + txn)) return 'reimbursements';
  return 'otherFees';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = api.getConfig();
  api.assertCredentials(config);

  const reports = await listReports(config, opts.days);
  const months = {};
  const settlements = new Map();
  const unclassified = new Set();
  const monthRow = (key) => (months[key] = months[key] || { ...Object.fromEntries(FIELDS.map((f) => [f, 0])), settlementIds: new Set() });

  for (const report of reports) {
    const doc = await api.get(config, `/reports/2021-06-30/documents/${report.reportDocumentId}`);
    const rows = parseTsv(await api.downloadDocument(doc.url, doc.compressionAlgorithm));
    for (const row of rows) {
      const id = row['settlement-id'];
      if (!row['transaction-type'] && row['total-amount']) {
        if (!settlements.has(id)) {
          settlements.set(id, { id, start: row['settlement-start-date'], end: row['settlement-end-date'], deposit: row['deposit-date'], total: num(row['total-amount']) });
          const key = monthOf(row['deposit-date']);
          if (key) {
            const m = monthRow(key);
            m.payouts += num(row['total-amount']);
            m.settlementIds.add(id);
          }
        }
        continue;
      }
      const key = monthOf(row['posted-date'] || row['posted-date-time']);
      if (!key) continue;
      const bucket = bucketFor(row);
      const m = monthRow(key);
      m.settlementIds.add(id);
      m[bucket] += num(row.amount);
      if (bucket === 'otherFees') unclassified.add(`${row['transaction-type']} / ${row['amount-type']} / ${row['amount-description']}`);
      if (row['transaction-type'] === 'Order' && row['amount-type'] === 'ItemPrice' && row['amount-description'] === 'Principal') {
        m.units += num(row['quantity-purchased']);
      }
    }
    await sleep(1000);
  }

  for (const m of Object.values(months)) {
    for (const f of FIELDS) m[f] = Math.round(m[f] * 100) / 100;
    m.settlementIds = [...m.settlementIds];
    m.amazonNet = Math.round((m.sales + m.refunds + m.promotions + m.commission + m.fulfillment + m.storage + m.inbound + m.subscription + m.couponFees + m.otherFees + m.reimbursements) * 100) / 100;
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    reportsFound: reports.length,
    settlements: [...settlements.values()],
    months,
    unclassified: [...unclassified],
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
