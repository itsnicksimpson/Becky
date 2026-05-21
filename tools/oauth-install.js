#!/usr/bin/env node

/**
 * Becky → Shopify OAuth installer (one-shot)
 * --------------------------------------------
 * Captures an OFFLINE Admin API access token (`shpat_...`) for a Shopify
 * custom app created in the Dev Dashboard.
 *
 * Why this script exists:
 *   As of January 2026, Shopify no longer reveals Admin API access tokens
 *   directly in the admin or Dev Dashboard. Tokens must be obtained via
 *   the OAuth authorization_code grant. This script automates that flow
 *   so you only have to click "Install" in a browser.
 *
 * Prerequisites (one-time):
 *   1. Create your custom app in the Shopify Dev Dashboard.
 *   2. Under your app's configuration, add this Allowed Redirection URL:
 *        http://localhost:3456/callback
 *   3. Set the Admin API scopes you need (see SCOPES below — must match).
 *   4. Note your app's Client ID and Client Secret.
 *
 * Usage:
 *   SHOPIFY_CLIENT_ID=xxxxxxxxxxxxxxxx \
 *   SHOPIFY_CLIENT_SECRET=shpss_xxxxxxxxxxxxxxxx \
 *   SHOPIFY_SHOP=hibecky.myshopify.com \
 *   node tools/oauth-install.js
 *
 * Result:
 *   ~/.becky-shopify-token  ← JSON file with the offline access token.
 *   That file is gitignored. Subsequent scripts read it.
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ─────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOP = process.env.SHOPIFY_SHOP || 'hibecky.myshopify.com';
const PORT = parseInt(process.env.PORT || '3456', 10);
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const TOKEN_PATH = path.join(process.env.HOME, '.becky-shopify-token');

// Scopes — keep in sync with what you configured in the Dev Dashboard app
const SCOPES = [
  'read_content', 'write_content',
  'read_products', 'write_products',
  'read_themes', 'write_themes', 'write_theme_code',
  'read_online_store_navigation', 'write_online_store_navigation',
  'read_online_store_pages', 'write_online_store_pages',
  'read_files', 'write_files',
  'read_metaobjects', 'write_metaobjects',
  'read_metaobject_definitions', 'write_metaobject_definitions',
  'read_translations', 'write_translations',
  'read_locales', 'write_locales',
  'read_publications', 'write_publications',
  'read_discounts', 'write_discounts',
  'read_price_rules', 'write_price_rules',
  'read_marketing_events', 'write_marketing_events',
  'read_legal_policies', 'write_legal_policies',
].join(',');

// ─────────────────────────────────────────────────────────────────
// Validate env
// ─────────────────────────────────────────────────────────────────
function die(msg) {
  console.error('\n❌  ' + msg + '\n');
  process.exit(1);
}

if (!CLIENT_ID) die('Set SHOPIFY_CLIENT_ID env var (your app Client ID).');
if (!CLIENT_SECRET) die('Set SHOPIFY_CLIENT_SECRET env var (your app Client Secret, starts with shpss_).');
if (!SHOP) die('Set SHOPIFY_SHOP env var (e.g., hibecky.myshopify.com).');

const nonce = crypto.randomBytes(16).toString('hex');

const installUrl =
  `https://${SHOP}/admin/oauth/authorize` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${nonce}` +
  `&grant_options[]=`; // empty = offline access (long-lived shpat_ token)

// ─────────────────────────────────────────────────────────────────
// HMAC verification (Shopify signs the callback query)
// ─────────────────────────────────────────────────────────────────
function verifyHmac(query, secret) {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&');
  const computed = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  // Use timingSafeEqual to avoid timing attacks
  const a = Buffer.from(hmac, 'utf8');
  const b = Buffer.from(computed, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────
// HTTP server — handles the OAuth callback
// ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname !== '/callback') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found.');
    return;
  }

  const { code, state, shop, hmac } = parsed.query;

  // Anti-CSRF
  if (state !== nonce) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('State mismatch. Aborting.');
    console.error('\n❌  State mismatch — possible CSRF. Aborting.\n');
    return;
  }

  // HMAC check (Shopify signs the callback)
  if (!verifyHmac(parsed.query, CLIENT_SECRET)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('HMAC verification failed.');
    console.error('\n❌  HMAC verification failed.\n');
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('No code in callback.');
    return;
  }

  // Exchange auth code for access token
  const postData = JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
  });

  const options = {
    hostname: SHOP,
    port: 443,
    path: '/admin/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let body = '';
    tokenRes.on('data', chunk => body += chunk);
    tokenRes.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.access_token) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Token exchange failed: ' + body);
          console.error('\n❌  Token exchange failed:\n', body, '\n');
          return;
        }

        const record = {
          shop: SHOP,
          access_token: data.access_token,
          scope: data.scope,
          captured_at: new Date().toISOString(),
        };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(record, null, 2), { mode: 0o600 });

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html><html><body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 80px auto; text-align: center;">
            <h1 style="color: #16a34a;">✅ Token captured</h1>
            <p>Saved to <code>~/.becky-shopify-token</code>.</p>
            <p>You can close this tab and return to your terminal.</p>
          </body></html>
        `);

        console.log('\n✅  Offline access token captured.');
        console.log(`   Saved to: ${TOKEN_PATH} (mode 0600)`);
        console.log(`   Scopes:   ${data.scope}\n`);

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 500);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Parse error: ' + e.message);
        console.error('\n❌  Parse error:', e.message, '\n');
      }
    });
  });

  tokenReq.on('error', (e) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Request error: ' + e.message);
    console.error('\n❌  Request error:', e.message, '\n');
  });

  tokenReq.write(postData);
  tokenReq.end();
});

server.listen(PORT, () => {
  console.log(`\n🚀  OAuth helper listening on http://localhost:${PORT}`);
  console.log(`    Shop:        ${SHOP}`);
  console.log(`    Client ID:   ${CLIENT_ID.slice(0, 8)}…`);
  console.log(`    Scopes:      ${SCOPES.split(',').length} requested`);
  console.log(`\n    Opening install URL in your browser…`);
  console.log(`    If it doesn't open automatically, paste this into your browser:`);
  console.log(`\n    ${installUrl}\n`);

  const opener = process.platform === 'darwin' ? 'open'
                 : process.platform === 'win32' ? 'start'
                 : 'xdg-open';
  spawn(opener, [installUrl], { stdio: 'ignore', detached: true }).unref();

  // Safety timeout
  setTimeout(() => {
    console.error('\n⏰  Timed out after 5 minutes. Re-run if needed.\n');
    process.exit(2);
  }, 5 * 60 * 1000);
});
