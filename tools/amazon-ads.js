#!/usr/bin/env node

/**
 * Becky · Amazon Ads CLI.
 *
 * Credential and connection management for Amazon's managed Ads MCP Server.
 * There are no campaign commands here on purpose: Amazon exposes 50+ tools
 * through the MCP Server itself, so Claude talks to those directly via
 * tools/amazon-ads-mcp.js. This CLI's whole job is getting you connected.
 *
 * Setup: node tools/amazon-ads.js setup   (see tools/AMAZON-ADS.md)
 */

const api = require('./lib/ads-api');
const { AdsMcpClient } = require('./lib/ads-mcp-client');

// ============================================================
// Setup
// ============================================================

function prompter() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (prompt) => new Promise((resolve) => rl.question(prompt, resolve)),
    close: () => rl.close(),
  };
}

async function setup() {
  const { ask, close } = prompter();

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║             Becky · Amazon Ads — Credential Setup              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Amazon Ads is a SEPARATE registration from SP-API. Even       ║
║  with Seller credentials you must create a NEW Login with      ║
║  Amazon security profile for Ads.                              ║
║                                                                ║
║  Three steps, in order:                                        ║
║    1. Create an LwA security profile                           ║
║       developer.amazon.com → Developer Console →               ║
║       Login with Amazon → Create a New Security Profile        ║
║    2. Apply for API access as a Direct Advertiser              ║
║       (approval is quoted at up to 1 business day)             ║
║    3. Assign that access to the LwA profile from step 1        ║
║       — via the link in the approval email                     ║
║                                                                ║
║  Sign in with the SAME email throughout. The pairing of        ║
║  email to API permissions cannot be changed later.             ║
║                                                                ║
║  Then add an Allowed Return URL to the profile (gear icon →    ║
║  Web Settings). https://amazon.com is fine — you just copy     ║
║  the code out of the address bar.                              ║
║                                                                ║
║  Full walkthrough: tools/AMAZON-ADS.md                         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  const clientId = (await ask('LwA Client ID (amzn1.application-oa2-client...): ')).trim();
  const clientSecret = (await ask('LwA Client Secret: ')).trim();
  const redirectUri = (await ask('Allowed Return URL [https://amazon.com]: ')).trim();
  const marketplaceInput = (await ask('Primary marketplace [US]: ')).trim().toUpperCase();
  close();

  const marketplace = marketplaceInput || 'US';

  if (!clientId || !clientSecret) {
    console.error('\n✗ Client ID and client secret are both required.');
    process.exit(1);
  }
  if (!api.MARKETPLACE_REGIONS[marketplace]) {
    console.error(
      `\n✗ Unknown marketplace "${marketplace}". Known: ${Object.keys(api.MARKETPLACE_REGIONS).join(', ')}`
    );
    process.exit(1);
  }

  const file = api.saveConfig({
    clientId,
    clientSecret,
    redirectUri: redirectUri || 'https://amazon.com',
    marketplace,
  });

  console.log(`\n✓ Saved to ${file} (permissions 600)`);
  console.log('\nNext: authorize the app to reach your advertising account.\n');
  console.log('  node tools/amazon-ads.js authorize\n');
}

// ============================================================
// Authorization
// ============================================================

async function authorize() {
  const config = api.getConfig();
  const url = api.authorizationUrl(config);

  console.log('\n1. Open this URL in a browser and sign in with the Amazon account');
  console.log('   that has access to the advertising account you want to manage.');
  console.log('   (That may not be the same account as your developer login.)\n');
  console.log(`   ${url}\n`);
  console.log('2. Click Allow. You land on a plain amazon.com page — that is expected.');
  console.log('   Copy the WHOLE address from the address bar and paste it below.');
  console.log('   (Just the code on its own works too.)\n');
  console.log('   You have 5 minutes before the code expires.\n');

  const { ask, close } = prompter();
  const code = extractCode(await ask('Paste the address-bar URL here: '));
  close();

  if (!code) {
    console.error('\n✗ No code found. Paste the full address after clicking Allow.');
    process.exit(1);
  }

  await exchange(code);
}

/**
 * Accept either the full redirect URL or the bare authorization code, so
 * nobody has to slice a string out of an address bar by hand.
 */
function extractCode(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^node\s/.test(raw)) {
    throw new Error(
      'That looks like the command, not the code. Open the link above, click Allow,\n' +
        'then paste the address from the page you land on.'
    );
  }
  const match = raw.match(/[?&]code=([^&\s#]+)/);
  return match ? decodeURIComponent(match[1]) : raw;
}

async function exchange(code) {
  const config = api.getConfig();
  const result = await api.exchangeAuthorizationCode(config, code);

  if (!result.refreshToken) {
    console.error('\n✗ Amazon returned no refresh token.');
    process.exit(1);
  }

  const file = api.saveConfig({ refreshToken: result.refreshToken });
  console.log(`\n✓ Refresh token saved to ${file}`);
  console.log('\nTesting the connection to Amazon\'s Ads MCP Server...\n');

  await test();
}

// ============================================================
// Connection test
// ============================================================

async function test() {
  const config = api.getConfig();
  api.assertCredentials(config);

  const client = new AdsMcpClient({
    endpoint: config.mcpEndpoint,
    clientId: config.clientId,
    getAccessToken: () => api.getAccessToken(config),
  });

  console.log(`Endpoint: ${config.mcpEndpoint}  (region ${config.region})`);

  const initMessages = await client.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'becky-amazon-ads', version: '1.0.0' },
    },
  });

  const init = initMessages.find((m) => m.result);
  if (!init) {
    console.error('✗ No initialize response. Raw:', JSON.stringify(initMessages).slice(0, 400));
    process.exit(1);
  }

  const server = init.result.serverInfo || {};
  console.log(`✓ Connected to ${server.name || 'Amazon Ads MCP Server'} ${server.version || ''}`.trim());

  await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const listMessages = await client.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const list = listMessages.find((m) => m.result && m.result.tools);
  if (!list) {
    console.log('  (connected, but tools/list returned nothing to show)');
    return;
  }

  const tools = list.result.tools;
  const groups = {};
  for (const tool of tools) {
    // Amazon names tools <tool_group>-<tool_name>.
    const group = tool.name.split('-')[0];
    groups[group] = (groups[group] || 0) + 1;
  }

  console.log(`✓ ${tools.length} tools available:\n`);
  for (const [group, count] of Object.entries(groups).sort()) {
    console.log(`    ${group.padEnd(22)} ${count}`);
  }
  console.log('\n🎉 Connected. Restart Claude Code and ask about your campaigns.\n');
}

// ============================================================
// Inspection
// ============================================================

function whoami() {
  const config = api.getConfig();
  const mask = (v) => (v ? `${v.slice(0, 12)}…${v.slice(-4)}` : '(not set)');

  console.log(`
Config file    ${api.CONFIG_FILE}
Marketplace    ${config.marketplace}  (region ${config.region})
MCP endpoint   ${config.mcpEndpoint}
Client ID      ${config.clientId || '(not set)'}
Client secret  ${config.clientSecret ? '(set)' : '(not set)'}
Refresh token  ${mask(config.refreshToken)}
Return URL     ${config.redirectUri || '(not set)'}
`);

  const missing = ['clientId', 'clientSecret', 'refreshToken'].filter((k) => !config[k]);
  if (missing.length) {
    console.log(`Not ready: missing ${missing.join(', ')}.`);
    console.log(
      missing.includes('refreshToken') && config.clientId
        ? 'Run: node tools/amazon-ads.js authorize\n'
        : 'Run: node tools/amazon-ads.js setup\n'
    );
  } else {
    console.log('Ready. Verify with: node tools/amazon-ads.js test\n');
  }
}

/** Print a live access token — handy for curl and for debugging 401s. */
async function token() {
  const config = api.getConfig();
  console.log(await api.getAccessToken(config));
}

// ============================================================
// Entry point
// ============================================================

const USAGE = `
Becky · Amazon Ads CLI

  node tools/amazon-ads.js <command>

Commands
  setup              One-time credential setup (client id, secret, return URL)
  authorize          Run the OAuth flow and store a refresh token
  exchange <code>    Exchange an authorization code you already have
  test               Connect to Amazon's Ads MCP Server and list its tools
  whoami             Show what's configured, without calling Amazon
  token              Print a live access token

Campaign work happens through the MCP server, not this CLI — ask Claude.
Full walkthrough: tools/AMAZON-ADS.md
`;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'setup':
      return setup();
    case 'authorize':
      return authorize();
    case 'exchange':
      if (!args[0]) throw new Error('Usage: amazon-ads.js exchange <code-or-redirect-url>');
      return exchange(extractCode(args[0]));
    case 'test':
      return test();
    case 'whoami':
      return whoami();
    case 'token':
      return token();
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      console.log(USAGE);
      return;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
