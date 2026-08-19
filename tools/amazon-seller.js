#!/usr/bin/env node

/**
 * Amazon Seller CLI for Becky
 *
 * Read and manage the Becky Amazon Seller account from the command line —
 * orders, FBA inventory, listings, pricing, fees, finances and reports —
 * via the Amazon Selling Partner API.
 *
 * Setup: node tools/amazon-seller.js setup   (see tools/AMAZON-SELLER.md)
 */

const api = require('./lib/sp-api');
const ops = require('./lib/operations');

// ============================================================
// COMMANDS
// ============================================================

const COMMANDS = {
  marketplaces: {
    description: 'List the marketplaces this account sells in (also a connection test)',
    run: (config) => ops.marketplaces(config),
  },

  orders: {
    description: 'Recent orders',
    usage: 'orders [--days 7] [--status Unshipped] [--limit 50] [--next-token T]',
    run: (config, args) =>
      ops.orders(config, {
        days: args.days,
        status: args.status,
        limit: args.limit,
        nextToken: args['next-token'],
      }),
  },

  order: {
    description: 'Full detail for one order',
    usage: 'order <amazon-order-id>',
    run: (config, args) => ops.order(config, { orderId: args._[0] }),
  },

  'order-items': {
    description: 'Line items for one order',
    usage: 'order-items <amazon-order-id>',
    run: (config, args) => ops.orderItems(config, { orderId: args._[0] }),
  },

  inventory: {
    description: 'FBA inventory levels',
    usage: 'inventory [--skus SKU1,SKU2]',
    run: (config, args) => ops.inventory(config, { skus: args.skus }),
  },

  listing: {
    description: 'Everything Amazon holds for one of your SKUs',
    usage: 'listing <sku>',
    run: (config, args) => ops.listing(config, { sku: args._[0] }),
  },

  'set-price': {
    description: 'Change a listing price (dry run unless --confirm)',
    usage: 'set-price <sku> <price> [--confirm]',
    write: true,
    run: (config, args) =>
      ops.setPrice(config, {
        sku: args._[0],
        price: args._[1],
        confirm: args.confirm,
      }),
  },

  'set-quantity': {
    description: 'Change merchant-fulfilled stock quantity (dry run unless --confirm)',
    usage: 'set-quantity <sku> <quantity> [--confirm]',
    write: true,
    run: (config, args) =>
      ops.setQuantity(config, {
        sku: args._[0],
        quantity: args._[1],
        confirm: args.confirm,
      }),
  },

  'patch-listing': {
    description: 'Apply raw JSON Patch operations to a listing (dry run unless --confirm)',
    usage: `patch-listing <sku> --patches '[{"op":"replace","path":"/attributes/...","value":[...]}]' [--confirm]`,
    write: true,
    run: (config, args) =>
      ops.patchListing(config, {
        sku: args._[0],
        patches: parseJsonArg(args.patches, '--patches'),
        confirm: args.confirm,
      }),
  },

  catalog: {
    description: "Search Amazon's catalog (competitor and keyword research)",
    usage: 'catalog [--keywords "vitamin c serum"] [--asins A,B] [--brand Becky] [--limit 10]',
    run: (config, args) =>
      ops.catalogSearch(config, {
        keywords: args.keywords,
        asins: args.asins,
        brand: args.brand,
        limit: args.limit,
      }),
  },

  pricing: {
    description: 'Your current prices for given SKUs',
    usage: 'pricing --skus SKU1,SKU2',
    run: (config, args) => ops.myPricing(config, { skus: args.skus || args._[0] }),
  },

  'competitive-pricing': {
    description: 'Competing offers and buy-box prices for given ASINs',
    usage: 'competitive-pricing --asins ASIN1,ASIN2',
    run: (config, args) => ops.competitivePricing(config, { asins: args.asins || args._[0] }),
  },

  fees: {
    description: 'Estimate Amazon fees and net proceeds at a given price',
    usage: 'fees <sku> <price> [--no-fba]',
    run: (config, args) =>
      ops.feesEstimate(config, {
        sku: args._[0],
        price: args._[1],
        fba: !args['no-fba'],
      }),
  },

  finances: {
    description: 'Settlement events with revenue/fee/net totals',
    usage: 'finances [--days 30]',
    run: (config, args) => ops.finances(config, { days: args.days }),
  },

  reports: {
    description: 'List recent reports',
    usage: 'reports [--report-types GET_MERCHANT_LISTINGS_ALL_DATA]',
    run: (config, args) =>
      ops.reportsList(config, { reportTypes: args['report-types'], limit: args.limit }),
  },

  'report-create': {
    description: 'Request a new report',
    usage: 'report-create <REPORT_TYPE> [--days 30]',
    run: (config, args) =>
      ops.reportCreate(config, { reportType: args._[0], days: args.days }),
  },

  'report-get': {
    description: 'Check a report’s processing status',
    usage: 'report-get <report-id>',
    run: (config, args) => ops.reportGet(config, { reportId: args._[0] }),
  },

  'report-download': {
    description: 'Download a finished report’s contents',
    usage: 'report-download <report-id> [--encoding latin1]',
    run: (config, args) =>
      ops.reportDownload(config, {
        reportId: args._[0],
        documentId: args['document-id'],
        encoding: args.encoding,
      }),
    raw: true,
  },

  get: {
    description: 'Raw GET against any SP-API path',
    usage: `get /orders/v0/orders --query '{"MarketplaceIds":"ATVPDKIKX0DER"}'`,
    run: (config, args) => api.get(config, args._[0], parseJsonArg(args.query, '--query')),
  },

  post: {
    description: 'Raw POST against any SP-API path',
    usage: `post /reports/2021-06-30/reports --body '{"reportType":"..."}'`,
    write: true,
    run: (config, args) =>
      api.post(config, args._[0], parseJsonArg(args.body, '--body'), parseJsonArg(args.query, '--query')),
  },
};

// ============================================================
// Argument parsing
// ============================================================

/**
 * Minimal flag parser: `--flag value` pairs, `--flag` booleans, positionals
 * collected in `_`.
 */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

function parseJsonArg(value, flag) {
  if (value === undefined) return undefined;
  if (value === true) throw new Error(`${flag} needs a JSON value.`);
  try {
    return JSON.parse(value);
  } catch (e) {
    throw new Error(`${flag} is not valid JSON: ${e.message}`);
  }
}

// ============================================================
// Setup
// ============================================================

async function setup() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Becky · Amazon Seller CLI — Quick Setup              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  In Seller Central (as the account's Primary User):            ║
║                                                                ║
║  1. Settings → Account Info → Merchant Token                   ║
║     Copy your seller ID (looks like A1B2C3D4E5F6G7)            ║
║                                                                ║
║  2. Apps and Services → Develop Apps                           ║
║     Register as a developer if you haven't — needs a           ║
║     Professional selling plan. Approval can take days.         ║
║                                                                ║
║  3. Create a private app. Choose the roles you need:           ║
║     Inventory & Order Tracking, Pricing, Product Listing,      ║
║     Selling Partner Insights, Finance & Accounting.            ║
║                                                                ║
║  4. On the app row: LWA credentials → View                     ║
║     Copy the Client ID and Client Secret                       ║
║                                                                ║
║  5. On the app row: Authorize app                              ║
║     Copy the refresh token it shows (starts with Atzr|)        ║
║                                                                ║
║  Full walkthrough: tools/AMAZON-SELLER.md                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  const clientId = (await ask('LWA Client ID (amzn1.application-oa2-client...): ')).trim();
  const clientSecret = (await ask('LWA Client Secret: ')).trim();
  const refreshToken = (await ask('Refresh token (Atzr|...): ')).trim();
  const sellerId = (await ask('Seller / Merchant Token: ')).trim();
  const marketplaceInput = (await ask('Primary marketplace [US]: ')).trim().toUpperCase();
  rl.close();

  const marketplace = marketplaceInput || 'US';

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('\n✗ Client ID, client secret and refresh token are all required.');
    process.exit(1);
  }
  if (!api.MARKETPLACES[marketplace]) {
    console.error(
      `\n✗ Unknown marketplace "${marketplace}". Known: ${Object.keys(api.MARKETPLACES).join(', ')}`
    );
    process.exit(1);
  }

  const file = api.saveConfig({
    clientId,
    clientSecret,
    refreshToken,
    sellerId,
    marketplace,
  });
  console.log(`\n✓ Credentials saved to ${file} (permissions 600)`);
  console.log('\nTesting connection...\n');

  try {
    const config = api.getConfig();
    const result = await ops.marketplaces(config);
    const active = result.marketplaces.filter((m) => m.isParticipating);
    console.log(`✓ Connected. Selling in: ${active.map((m) => m.countryCode).join(', ') || 'none'}`);
    console.log('\n🎉 Setup complete. Try these:\n');
    console.log('  node tools/amazon-seller.js orders --days 7');
    console.log('  node tools/amazon-seller.js inventory');
    console.log('  node tools/amazon-seller.js finances --days 30\n');
  } catch (e) {
    console.error(`✗ Connection failed: ${e.message}`);
    console.error(
      '\nThe usual causes: the app has not finished being authorized, the ' +
        'refresh token was regenerated, or the app lacks the required roles.'
    );
    process.exit(1);
  }
}

// ============================================================

function printHelp() {
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  const lines = Object.entries(COMMANDS).map(
    ([name, cmd]) =>
      `  ${name.padEnd(width)}  ${cmd.description}${cmd.write ? '  [write]' : ''}`
  );

  console.log(`
Becky · Amazon Seller CLI — manage the Amazon Seller account from the terminal

USAGE:
  node tools/amazon-seller.js <command> [args] [--flags]

SETUP:
  setup                    One-time credential setup
  whoami                   Show which account/marketplace is configured

COMMANDS:
${lines.join('\n')}

GLOBAL FLAGS:
  --marketplace US         Target a different marketplace for this call
  --sandbox                Use the SP-API sandbox endpoint
  --confirm                Actually apply a [write] command (default is a dry run)

EXAMPLES:
  node tools/amazon-seller.js orders --days 30 --status Unshipped
  node tools/amazon-seller.js inventory
  node tools/amazon-seller.js fees BECKY-SERUM-30ML 34.99
  node tools/amazon-seller.js set-price BECKY-SERUM-30ML 29.99
  node tools/amazon-seller.js set-price BECKY-SERUM-30ML 29.99 --confirm
  node tools/amazon-seller.js catalog --keywords "vitamin c serum" --limit 5
  node tools/amazon-seller.js report-create GET_MERCHANT_LISTINGS_ALL_DATA

Write commands print the exact request and Amazon's validation verdict, and
change nothing, until you pass --confirm.

Setup guide: tools/AMAZON-SELLER.md
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    printHelp();
    return;
  }

  const cmdName = argv[0];
  const args = parseArgs(argv.slice(1));

  if (cmdName === 'setup') {
    await setup();
    return;
  }

  const config = api.getConfig({
    marketplace: args.marketplace,
    sandbox: args.sandbox ? true : undefined,
  });

  if (cmdName === 'whoami') {
    console.log(
      JSON.stringify(
        {
          marketplace: config.marketplace,
          marketplaceId: config.marketplaceId,
          region: config.region,
          endpoint: config.host,
          sellerId: config.sellerId || '(not set)',
          credentialsConfigured: Boolean(
            config.clientId && config.clientSecret && config.refreshToken
          ),
          configFile: api.CONFIG_FILE,
        },
        null,
        2
      )
    );
    return;
  }

  const command = COMMANDS[cmdName];
  if (!command) {
    console.error(`Unknown command: ${cmdName}`);
    console.error(`Available: ${Object.keys(COMMANDS).join(', ')}`);
    console.error('Run "node tools/amazon-seller.js --help" for usage.');
    process.exit(1);
  }

  try {
    const result = await command.run(config, args);
    // Report contents are a CSV/TSV blob — printing it as JSON helps nobody.
    if (command.raw && result && typeof result.content === 'string') {
      console.log(result.content);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    if (command.usage && /Missing required argument|not valid JSON|needs a JSON/.test(e.message)) {
      console.error(`Error: ${e.message}`);
      console.error(`Usage: node tools/amazon-seller.js ${command.usage}`);
    } else {
      console.error(`Error: ${e.message}`);
      if (e.requestId) console.error(`Amazon request id: ${e.requestId}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
