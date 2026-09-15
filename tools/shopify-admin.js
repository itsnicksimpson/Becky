#!/usr/bin/env node

/**
 * Shopify Admin API CLI Tool
 * 
 * Execute GraphQL queries/mutations against the Shopify Admin API.
 * Includes convenience commands for common operations.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.env.HOME, '.shopify-admin.json');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';

// ============================================================
// CONFIGURATION - Set your store details here for easy setup
// ============================================================
const DEFAULT_STORE = 'hibecky.myshopify.com';
// Legacy admin-created apps: a shpat_ token. Dev Dashboard apps: run `setup-app`
// to save a Client ID + secret; 24-hour tokens are then fetched automatically.
const DEFAULT_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
// ============================================================

function readConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeConfigFile(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_FILE, 0o600);
}

function getConfig() {
  const fileConfig = readConfigFile();
  return {
    store: process.env.SHOPIFY_STORE || fileConfig.store || DEFAULT_STORE,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || fileConfig.accessToken || DEFAULT_TOKEN,
    clientId: process.env.SHOPIFY_CLIENT_ID || fileConfig.clientId || '',
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET || fileConfig.clientSecret || '',
    tokenExpiresAt: fileConfig.tokenExpiresAt || 0,
  };
}

// Client credentials grant (Dev Dashboard apps installed on a store in the same org).
function requestClientCredentialsToken(store, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const req = https.request({
      hostname: store,
      port: 443,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(form),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          const title = (body.match(/<title>([^<]*)<\/title>/i) || [])[1];
          return reject(new Error(`Token request failed (HTTP ${res.statusCode}): ${title || body.slice(0, 300)}`));
        }
        if (res.statusCode !== 200 || !parsed.access_token) {
          return reject(new Error(`Token request failed (HTTP ${res.statusCode}): ${JSON.stringify(parsed)}`));
        }
        resolve(parsed);
      });
    });

    req.on('error', reject);
    req.write(form);
    req.end();
  });
}

// Returns a usable access token, refreshing the cached client-credentials token when it is
// missing or within 10 minutes of expiring.
async function resolveAccessToken(config) {
  if (!config.clientId || !config.clientSecret) return config.accessToken;
  if (config.accessToken && Date.now() < config.tokenExpiresAt - 10 * 60 * 1000) {
    return config.accessToken;
  }

  const token = await requestClientCredentialsToken(config.store, config.clientId, config.clientSecret);
  config.accessToken = token.access_token;
  config.tokenExpiresAt = Date.now() + (token.expires_in || 86399) * 1000;
  config.scope = token.scope;

  if (!process.env.SHOPIFY_CLIENT_ID) {
    writeConfigFile({ ...readConfigFile(), accessToken: config.accessToken, tokenExpiresAt: config.tokenExpiresAt, scope: token.scope });
  }
  return config.accessToken;
}

async function executeQuery(store, accessToken, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: store,
      port: 443,
      path: `/admin/api/${API_VERSION}/graphql.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================
// CONVENIENCE COMMANDS
// ============================================================

const COMMANDS = {
  // Menu commands
  'menus': {
    description: 'List all navigation menus',
    query: `{
      menus(first: 20) {
        edges {
          node {
            id
            title
            handle
            itemsCount
            items {
              id
              title
              url
              type
            }
          }
        }
      }
    }`
  },

  'menu': {
    description: 'Get a specific menu by handle (e.g., main-menu, footer)',
    query: (handle) => `{
      menu(handle: "${handle || 'main-menu'}") {
        id
        title
        handle
        items {
          id
          title
          url
          type
          items {
            id
            title
            url
          }
        }
      }
    }`
  },

  'shop': {
    description: 'Get shop info',
    query: `{
      shop {
        name
        email
        myshopifyDomain
        primaryDomain { url }
        currencyCode
        billingAddress { country }
      }
    }`
  },

  'products': {
    description: 'List products with variant prices, SKUs and stock',
    query: `{
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            status
            onlineStoreUrl
            variants(first: 20) {
              nodes {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
              }
            }
          }
        }
      }
    }`
  },

  'scopes': {
    description: 'List the access scopes this app has been granted',
    query: `{
      currentAppInstallation {
        accessScopes { handle }
      }
    }`
  },

  'pages': {
    description: 'List pages',
    query: `{
      pages(first: 20) {
        edges {
          node {
            id
            title
            handle
            onlineStoreUrl
          }
        }
      }
    }`
  },

  'create-page': {
    description: 'Create a new page',
    mutation: true,
    query: (title, body = '') => `
      mutation {
        pageCreate(page: {
          title: "${title || 'New Page'}"
          body: "${body}"
        }) {
          page {
            id
            title
            handle
            onlineStoreUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `
  },

  'set-menu': {
    description: 'Set menu items (provide menu ID and items JSON)',
    mutation: true,
    needsVariables: true,
    query: `
      mutation menuUpdate($id: ID!, $items: [MenuItemInput!]!) {
        menuUpdate(id: $id, items: $items) {
          menu {
            id
            title
            items {
              id
              title
              url
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `
  }
};

async function runCommand(cmd, args, config) {
  const command = COMMANDS[cmd];
  if (!command) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Available commands:', Object.keys(COMMANDS).join(', '));
    process.exit(1);
  }

  let query = typeof command.query === 'function' ? command.query(args[0], args[1]) : command.query;
  let variables = {};

  // Parse variables if provided
  const varsIndex = args.indexOf('-v');
  if (varsIndex !== -1 && args[varsIndex + 1]) {
    try {
      variables = JSON.parse(args[varsIndex + 1]);
    } catch (e) {
      console.error('Error parsing variables JSON:', e.message);
      process.exit(1);
    }
  }

  try {
    const accessToken = await resolveAccessToken(config);
    const result = await executeQuery(config.store, accessToken, query, variables);
    console.log(JSON.stringify(result.data, null, 2));

    if (result.data.errors) {
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

async function setup() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              Shopify Admin CLI - Quick Setup                   ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  1. Open this URL in your browser:                             ║
║                                                                ║
║     https://${DEFAULT_STORE}/admin/settings/apps/development   ║
║                                                                ║
║  2. Click "Create an app" → Name it "CLI Tool"                 ║
║                                                                ║
║  3. Click "Configure Admin API scopes" and enable:             ║
║     • read_content, write_content                              ║
║     • read_products                                            ║
║     • read_online_store_navigation                             ║
║     • write_online_store_navigation                            ║
║                                                                ║
║  4. Click "Save" → "Install app"                               ║
║                                                                ║
║  5. Copy the "Admin API access token" (starts with shpat_)     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  const accessToken = await question('Paste your access token here: ');
  rl.close();

  if (!accessToken || !accessToken.startsWith('shpat_')) {
    console.error('\n✗ Invalid token. It should start with "shpat_"');
    process.exit(1);
  }

  const config = { store: DEFAULT_STORE, accessToken: accessToken.trim() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_FILE, 0o600);

  console.log(`\n✓ Token saved to ${CONFIG_FILE}`);
  console.log('\nTesting connection...\n');

  try {
    const result = await executeQuery(config.store, config.accessToken, '{ shop { name } }');
    if (result.data.data?.shop) {
      console.log(`✓ Connected to: ${result.data.data.shop.name}`);
      console.log('\n🎉 Setup complete! Try these commands:\n');
      console.log('  shopify-admin menus      # List all menus');
      console.log('  shopify-admin products   # List products');
      console.log('  shopify-admin pages      # List pages');
      console.log('  shopify-admin shop       # Shop info\n');
    } else {
      console.error('✗ Connection failed:', JSON.stringify(result.data, null, 2));
    }
  } catch (e) {
    console.error('✗ Connection error:', e.message);
  }
}

// Dev Dashboard app setup: saves the Client ID + secret locally (never printed) and tests them.
async function setupApp() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = (text) => {
    if (!muted) rl.output.write(text);
  };
  // readline redraws the line when asking, so the prompt must go through question() itself;
  // muting starts after it is drawn so only the typed characters are hidden.
  const question = (prompt, hidden = false) => new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      muted = false;
      if (hidden) rl.output.write('\n');
      resolve(answer.trim());
    });
    muted = hidden;
  });

  console.log('\nShopify Dev Dashboard app setup (the secret is hidden as you paste it)\n');
  const store = (await question(`Store domain [${DEFAULT_STORE}]: `)) || DEFAULT_STORE;
  const clientId = await question('Client ID: ');
  const clientSecret = await question('Client secret: ', true);
  rl.close();

  if (!clientId || !clientSecret) {
    console.error('\n✗ Client ID and secret are both required.');
    process.exit(1);
  }

  const config = { store, clientId, clientSecret, tokenExpiresAt: 0 };
  console.log('\nRequesting an access token...');
  try {
    await resolveAccessToken(config);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    console.error('\nCheck that the app version is released and the app is installed on this store.');
    process.exit(1);
  }

  writeConfigFile({
    store,
    clientId,
    clientSecret,
    accessToken: config.accessToken,
    tokenExpiresAt: config.tokenExpiresAt,
    scope: config.scope,
  });

  const result = await executeQuery(store, config.accessToken, '{ shop { name myshopifyDomain } }');
  const shop = result.data.data && result.data.data.shop;
  if (!shop) {
    console.error('✗ Token worked but the shop query failed:', JSON.stringify(result.data, null, 2));
    process.exit(1);
  }

  console.log(`✓ Connected to ${shop.name} (${shop.myshopifyDomain})`);
  console.log(`✓ Saved to ${CONFIG_FILE} (readable only by you)`);
  console.log(`\nGranted scopes:\n  ${(config.scope || '').split(',').join('\n  ')}\n`);
}

function printHelp() {
  console.log(`
Shopify Admin CLI - Manage your store from the command line

USAGE:
  shopify-admin <command> [args]
  shopify-admin query '<graphql>'

SETUP:
  shopify-admin setup-app       # Dev Dashboard app (Client ID + secret)
  shopify-admin setup           # Legacy admin-created app (paste shpat_ token)
  shopify-admin scopes          # Show the scopes the app was granted

QUICK COMMANDS:
  shopify-admin menus           # List all navigation menus
  shopify-admin menu main-menu  # Get specific menu details
  shopify-admin products        # List all products
  shopify-admin pages           # List all pages
  shopify-admin shop            # Get shop info
  shopify-admin create-page "About Us"  # Create a page

ADVANCED:
  shopify-admin query '<graphql>'              # Run any GraphQL query
  shopify-admin query '<graphql>' -v '{...}'   # With variables

EXAMPLES:
  # Update main menu to have Home, About, Shop
  shopify-admin set-menu -v '{
    "id": "gid://shopify/Menu/YOUR_MENU_ID",
    "items": [
      {"title": "Home", "url": "/"},
      {"title": "About", "url": "/pages/about"},
      {"title": "Shop", "url": "/products/your-product"}
    ]
  }'
`);
}

async function main() {
  const args = process.argv.slice(2);
  const config = getConfig();

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  const cmd = args[0];

  if (cmd === 'setup') {
    await setup();
    return;
  }

  if (cmd === 'setup-app') {
    await setupApp();
    return;
  }

  // Check for credentials
  if (!config.accessToken && !(config.clientId && config.clientSecret)) {
    console.error('No Shopify credentials configured. Run: shopify-admin setup-app');
    process.exit(1);
  }

  // Handle raw query
  if (cmd === 'query' || cmd === 'q') {
    const query = args[1];
    if (!query) {
      console.error('No query provided');
      process.exit(1);
    }

    let variables = {};
    const varsIndex = args.indexOf('-v');
    if (varsIndex !== -1 && args[varsIndex + 1]) {
      try {
        variables = JSON.parse(args[varsIndex + 1]);
      } catch (e) {
        console.error('Error parsing variables:', e.message);
        process.exit(1);
      }
    }

    try {
      const accessToken = await resolveAccessToken(config);
      const result = await executeQuery(config.store, accessToken, query, variables);
      console.log(JSON.stringify(result.data, null, 2));
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(1);
    }
    return;
  }

  // Handle convenience commands
  if (COMMANDS[cmd]) {
    await runCommand(cmd, args.slice(1), config);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error('Run "shopify-admin --help" for usage');
  process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

module.exports = { getConfig, resolveAccessToken, executeQuery };
