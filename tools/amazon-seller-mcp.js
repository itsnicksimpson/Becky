#!/usr/bin/env node

/**
 * Amazon Seller MCP server for Becky.
 *
 * Exposes the Becky Amazon Seller account to Claude as native tools, backed
 * by the same operations the CLI uses (tools/lib/operations.js).
 *
 * Speaks MCP over stdio as newline-delimited JSON-RPC 2.0. Registered for
 * Claude Code in .mcp.json; see tools/AMAZON-SELLER.md for Claude Desktop.
 *
 * Credentials come from ~/.amazon-seller.json or the environment — never
 * from the client.
 */

const readline = require('readline');
const api = require('./lib/sp-api');
const ops = require('./lib/operations');

const SERVER_INFO = { name: 'amazon-seller', version: '1.0.0' };
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const bool = (description) => ({ type: 'boolean', description });

const MARKETPLACE_FLAG = str(
  'Marketplace country code (US, UK, CA, DE...). Defaults to the configured marketplace.'
);

const CONFIRM_FLAG = bool(
  'Set true to actually apply the change to the live Amazon listing. ' +
    'When false or omitted, nothing changes: the exact request and Amazon’s ' +
    'validation verdict are returned for review.'
);

// ============================================================
// Tools
// ============================================================

const TOOLS = [
  {
    name: 'amazon_account',
    description:
      'Show which Amazon marketplaces the Becky seller account sells in, and whether ' +
      'any listings are suspended. Also the quickest way to check the connection works.',
    schema: { marketplace: MARKETPLACE_FLAG },
    handler: (config) => ops.marketplaces(config),
  },
  {
    name: 'amazon_orders',
    description:
      'List recent Amazon orders with status, channel (FBA/Merchant), totals and ship-to region. ' +
      'Buyer names and addresses are redacted unless the app holds PII roles.',
    schema: {
      days: num('How many days back to look (default 7).'),
      status: str('Filter by order status: Pending, Unshipped, Shipped, Canceled.'),
      limit: num('Max orders per page (default 50).'),
      nextToken: str('Pagination token from a previous call.'),
      marketplace: MARKETPLACE_FLAG,
    },
    handler: (config, args) => ops.orders(config, args),
  },
  {
    name: 'amazon_order_detail',
    description: 'Full detail plus line items for a single Amazon order.',
    schema: {
      orderId: str('Amazon order ID, e.g. 111-2223333-4445555.'),
      marketplace: MARKETPLACE_FLAG,
    },
    required: ['orderId'],
    handler: async (config, args) => ({
      order: await ops.order(config, args),
      items: await ops.orderItems(config, args),
    }),
  },
  {
    name: 'amazon_inventory',
    description:
      'FBA inventory levels per SKU: fulfillable, inbound, reserved and unfulfillable units. ' +
      'Use this to spot stockouts before they cost the buy box.',
    schema: {
      skus: str('Comma-separated SKUs to filter to. Omit for all.'),
      marketplace: MARKETPLACE_FLAG,
    },
    handler: (config, args) => ops.inventory(config, args),
  },
  {
    name: 'amazon_listing',
    description:
      'Everything Amazon holds for one of your SKUs: attributes, offer, fulfillment ' +
      'availability, and any listing issues blocking the offer.',
    schema: { sku: str('Your seller SKU.'), marketplace: MARKETPLACE_FLAG },
    required: ['sku'],
    handler: (config, args) => ops.listing(config, args),
  },
  {
    name: 'amazon_set_price',
    description:
      'Change the selling price of one of your listings. WRITE OPERATION: without ' +
      'confirm=true nothing changes and you get back the exact request plus Amazon’s ' +
      'validation verdict. Always show the user the dry run and get their approval ' +
      'before calling again with confirm=true.',
    schema: {
      sku: str('Your seller SKU.'),
      price: num('New price, in the marketplace currency.'),
      confirm: CONFIRM_FLAG,
      marketplace: MARKETPLACE_FLAG,
    },
    required: ['sku', 'price'],
    handler: (config, args) => ops.setPrice(config, args),
  },
  {
    name: 'amazon_set_quantity',
    description:
      'Change available stock for a merchant-fulfilled (not FBA) listing. FBA quantities ' +
      'are controlled by Amazon and change only through inbound shipments. WRITE ' +
      'OPERATION: dry run unless confirm=true — show the user the dry run first.',
    schema: {
      sku: str('Your seller SKU.'),
      quantity: num('New available quantity.'),
      confirm: CONFIRM_FLAG,
      marketplace: MARKETPLACE_FLAG,
    },
    required: ['sku', 'quantity'],
    handler: (config, args) => ops.setQuantity(config, args),
  },
  {
    name: 'amazon_patch_listing',
    description:
      'Apply arbitrary JSON Patch operations to a listing — for attribute changes with no ' +
      'dedicated tool (bullet points, title, description, product features). WRITE ' +
      'OPERATION: dry run unless confirm=true — show the user the dry run first.',
    schema: {
      sku: str('Your seller SKU.'),
      patches: {
        type: 'array',
        description:
          'JSON Patch operations, e.g. ' +
          '[{"op":"replace","path":"/attributes/bullet_point","value":[{"value":"...","marketplace_id":"ATVPDKIKX0DER"}]}]',
        items: { type: 'object' },
      },
      confirm: CONFIRM_FLAG,
      marketplace: MARKETPLACE_FLAG,
    },
    required: ['sku', 'patches'],
    handler: (config, args) => ops.patchListing(config, args),
  },
  {
    name: 'amazon_catalog_search',
    description:
      'Search the Amazon catalog by keyword, ASIN or brand, with titles and sales ranks. ' +
      'Useful for competitor research and finding what beauty terms rank.',
    schema: {
      keywords: str('Search keywords, e.g. "vitamin c serum".'),
      asins: str('Comma-separated ASINs to look up directly.'),
      brand: str('Filter by brand name.'),
      limit: num('Max results (default 10).'),
      marketplace: MARKETPLACE_FLAG,
    },
    handler: (config, args) => ops.catalogSearch(config, args),
  },
  {
    name: 'amazon_pricing',
    description:
      'Your current listed prices for given SKUs, or competing offers and buy-box prices ' +
      'for given ASINs.',
    schema: {
      skus: str('Comma-separated seller SKUs — returns your own prices.'),
      asins: str('Comma-separated ASINs — returns competitive/buy-box prices.'),
      marketplace: MARKETPLACE_FLAG,
    },
    handler: (config, args) => {
      if (args.asins) return ops.competitivePricing(config, args);
      if (args.skus) return ops.myPricing(config, args);
      throw new Error('Provide either skus (your prices) or asins (competitive prices).');
    },
  },
  {
    name: 'amazon_fees_estimate',
    description:
      'Estimate Amazon referral and fulfillment fees at a given price, with the net ' +
      'proceeds per unit. Use before any price change to check the margin still works.',
    schema: {
      sku: str('Your seller SKU.'),
      price: num('Price to estimate fees at.'),
      fba: bool('Estimate as Amazon-fulfilled (default true).'),
      marketplace: MARKETPLACE_FLAG,
    },
    required: ['sku', 'price'],
    handler: (config, args) => ops.feesEstimate(config, args),
  },
  {
    name: 'amazon_finances',
    description:
      'Settlement activity over a period, with gross item charges, total fees and net.',
    schema: {
      days: num('How many days back (default 30).'),
      nextToken: str('Pagination token from a previous call.'),
      marketplace: MARKETPLACE_FLAG,
    },
    handler: (config, args) => ops.finances(config, args),
  },
  {
    name: 'amazon_reports',
    description:
      'Work with Amazon bulk reports. action=list shows recent reports; action=create ' +
      'queues one (reportType required, e.g. GET_MERCHANT_LISTINGS_ALL_DATA); action=get ' +
      'checks status; action=download returns a finished report’s contents.',
    schema: {
      action: {
        type: 'string',
        enum: ['list', 'create', 'get', 'download'],
        description: 'Which report operation to perform.',
      },
      reportType: str('Report type, for action=create.'),
      reportId: str('Report ID, for action=get and action=download.'),
      days: num('Data window in days, for action=create.'),
      marketplace: MARKETPLACE_FLAG,
    },
    required: ['action'],
    handler: (config, args) => {
      switch (args.action) {
        case 'list':
          return ops.reportsList(config, { reportTypes: args.reportType });
        case 'create':
          return ops.reportCreate(config, args);
        case 'get':
          return ops.reportGet(config, args);
        case 'download':
          return ops.reportDownload(config, args);
        default:
          throw new Error(`Unknown action "${args.action}". Use list, create, get or download.`);
      }
    },
  },
];

function inputSchemaFor(tool) {
  return {
    type: 'object',
    properties: tool.schema || {},
    required: tool.required || [],
    additionalProperties: false,
  };
}

// ============================================================
// JSON-RPC plumbing
// ============================================================

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function callTool(name, args = {}) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const config = api.getConfig({ marketplace: args.marketplace });
  api.assertCredentials(config);

  const result = await tool.handler(config, args);
  return JSON.stringify(result, null, 2);
}

async function handle(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      respond(id, {
        // Mirror the client's protocol version when it names one we can speak.
        protocolVersion: (params && params.protocolVersion) || DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // Notifications take no response.

    case 'ping':
      respond(id, {});
      return;

    case 'tools/list':
      respond(id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: inputSchemaFor(tool),
        })),
      });
      return;

    case 'tools/call': {
      const toolName = params && params.name;
      try {
        const text = await callTool(toolName, (params && params.arguments) || {});
        respond(id, { content: [{ type: 'text', text }] });
      } catch (e) {
        // Tool failures are results, not protocol errors — the model should
        // see the message and be able to correct itself.
        respond(id, {
          content: [{ type: 'text', text: `Error: ${e.message}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      if (id !== undefined) respondError(id, -32601, `Method not found: ${method}`);
  }
}

function main() {
  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch (e) {
      respondError(null, -32700, `Parse error: ${e.message}`);
      return;
    }

    handle(message).catch((e) => {
      if (message.id !== undefined) respondError(message.id, -32603, e.message);
    });
  });

  rl.on('close', () => process.exit(0));
}

main();
