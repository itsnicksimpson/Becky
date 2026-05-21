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
const API_VERSION = '2025-01';

// ============================================================
// CONFIGURATION - Set your store details here for easy setup
// ============================================================
const DEFAULT_STORE = 'hibecky.myshopify.com';
// After creating your app, paste your access token here:
const DEFAULT_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
// ============================================================

function getConfig() {
  let config = {
    store: DEFAULT_STORE,
    accessToken: DEFAULT_TOKEN,
  };

  // 1. Captured OAuth token from oauth-install.js (preferred for Dev Dashboard apps)
  const oauthTokenPath = path.join(process.env.HOME, '.becky-shopify-token');
  if (fs.existsSync(oauthTokenPath)) {
    try {
      const captured = JSON.parse(fs.readFileSync(oauthTokenPath, 'utf8'));
      config.store = captured.shop || config.store;
      config.accessToken = captured.access_token || config.accessToken;
    } catch (e) {}
  }

  // 2. Generic config file
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config.store = fileConfig.store || config.store;
      config.accessToken = fileConfig.accessToken || config.accessToken;
    } catch (e) {}
  }

  // 3. Env vars take highest precedence
  config.store = process.env.SHOPIFY_STORE || config.store;
  config.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || config.accessToken;

  return config;
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
    description: 'List products',
    query: `{
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            status
            onlineStoreUrl
          }
        }
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
    const result = await executeQuery(config.store, config.accessToken, query, variables);
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

function printHelp() {
  console.log(`
Shopify Admin CLI - Manage your store from the command line

USAGE:
  shopify-admin <command> [args]
  shopify-admin query '<graphql>'

SETUP:
  shopify-admin setup           # One-time setup (paste your token)

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

  // Check for token
  if (!config.accessToken) {
    console.error('No access token configured. Run: shopify-admin setup');
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
      const result = await executeQuery(config.store, config.accessToken, query, variables);
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

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
