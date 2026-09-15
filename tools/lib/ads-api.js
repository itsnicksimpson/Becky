'use strict';

/**
 * Amazon Ads credentials and Login with Amazon (LwA) token handling.
 *
 * Deliberately small. Amazon runs the Ads MCP Server as a managed remote
 * endpoint, so we do not implement the Ads API itself — Amazon builds and
 * maintains those tools. All we own is the part Amazon does not do for you:
 * turning a client id / secret / refresh token into a live access token, and
 * knowing which regional endpoint to talk to.
 *
 * This is a *separate* integration from lib/sp-api.js, with its own LwA
 * security profile and its own credentials. Amazon requires a new security
 * profile for Ads even when you already have one for SP-API, so nothing is
 * shared between the two on purpose.
 */

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_FILE = path.join(os.homedir(), '.amazon-ads.json');
const TOKEN_CACHE_FILE = path.join(os.homedir(), '.amazon-ads-token.json');
const USER_AGENT = 'becky-amazon-ads/1.0 (Language=Node.js)';

/** The only scope needed for Sponsored Products / Brands / Display. */
const LWA_SCOPE = 'advertising::campaign_management';

/** Region -> Amazon's managed MCP Server endpoint. */
const MCP_ENDPOINTS = {
  na: 'https://advertising-ai.amazon.com/mcp',
  eu: 'https://advertising-ai-eu.amazon.com/mcp',
  fe: 'https://advertising-ai-fe.amazon.com/mcp',
};

/** Region -> LwA token endpoint. */
const TOKEN_HOSTS = {
  na: 'api.amazon.com',
  eu: 'api.amazon.co.uk',
  fe: 'api.amazon.co.jp',
};

/** Region -> the sign-in page a user visits to grant consent. */
const AUTH_HOSTS = {
  na: 'www.amazon.com',
  eu: 'eu.account.amazon.com',
  fe: 'apac.account.amazon.com',
};

/** Marketplace code -> region. */
const MARKETPLACE_REGIONS = {
  US: 'na', CA: 'na', MX: 'na', BR: 'na',
  UK: 'eu', IE: 'eu', DE: 'eu', FR: 'eu', ES: 'eu', IT: 'eu', NL: 'eu',
  BE: 'eu', SE: 'eu', PL: 'eu', TR: 'eu', EG: 'eu', SA: 'eu', AE: 'eu',
  IN: 'eu', ZA: 'eu',
  JP: 'fe', AU: 'fe', SG: 'fe',
};

// ============================================================
// Configuration
// ============================================================

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Resolve credentials. Precedence, lowest to highest:
 * repo .env  ->  ~/.amazon-ads.json  ->  process env.
 */
function getConfig(overrides = {}) {
  const dotenv = parseEnvFile(path.join(__dirname, '..', '..', '.env'));
  const env = Object.assign({}, dotenv, process.env);

  let file = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      file = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      throw new Error(`${CONFIG_FILE} is not valid JSON: ${e.message}`);
    }
  }

  const marketplace = (
    overrides.marketplace ||
    env.AMAZON_ADS_MARKETPLACE ||
    file.marketplace ||
    'US'
  ).toUpperCase();

  const region = MARKETPLACE_REGIONS[marketplace];
  if (!region) {
    throw new Error(
      `Unknown marketplace "${marketplace}". Known: ${Object.keys(MARKETPLACE_REGIONS).join(', ')}`
    );
  }

  return {
    clientId: env.AMAZON_ADS_CLIENT_ID || file.clientId || '',
    clientSecret: env.AMAZON_ADS_CLIENT_SECRET || file.clientSecret || '',
    refreshToken: env.AMAZON_ADS_REFRESH_TOKEN || file.refreshToken || '',
    // Must exactly match an Allowed Return URL on the LwA security profile.
    // Only used during the one-time authorization round trip.
    redirectUri: env.AMAZON_ADS_REDIRECT_URI || file.redirectUri || '',
    marketplace,
    region,
    mcpEndpoint: MCP_ENDPOINTS[region],
    tokenHost: TOKEN_HOSTS[region],
    authHost: AUTH_HOSTS[region],
  };
}

function assertCredentials(config) {
  const missing = ['clientId', 'clientSecret', 'refreshToken'].filter(
    (k) => !config[k]
  );
  if (missing.length) {
    throw new Error(
      `Missing Amazon Ads credentials: ${missing.join(', ')}.\n` +
        'Run "node tools/amazon-ads.js setup", or see tools/AMAZON-ADS.md.'
    );
  }
}

function saveConfig(values) {
  let existing = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      existing = {};
    }
  }
  const merged = Object.assign(existing, values);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  fs.chmodSync(CONFIG_FILE, 0o600);
  return CONFIG_FILE;
}

// ============================================================
// HTTP
// ============================================================

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks),
        })
      );
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('Request timed out after 60s')));
    if (body) req.write(body);
    req.end();
  });
}

async function postToken(config, body) {
  const res = await httpRequest(
    {
      hostname: config.tokenHost,
      port: 443,
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': USER_AGENT,
      },
    },
    body
  );

  let payload;
  try {
    payload = JSON.parse(res.buffer.toString('utf8'));
  } catch (e) {
    throw new Error(
      `LwA returned non-JSON (HTTP ${res.status}): ${res.buffer.toString('utf8').slice(0, 400)}`
    );
  }

  if (res.status !== 200 || !(payload.access_token || payload.refresh_token)) {
    const detail = payload.error_description || payload.error || JSON.stringify(payload);
    throw new Error(`LwA token exchange failed (HTTP ${res.status}): ${detail}`);
  }

  return payload;
}

// ============================================================
// Authorization (one-time, interactive)
// ============================================================

/**
 * The consent URL to paste into a browser. Unlike an SP-API private app,
 * there is no self-authorize button — the OAuth round trip is required even
 * when you are authorizing your own account.
 */
function authorizationUrl(config) {
  if (!config.clientId) {
    throw new Error('clientId is required. Run "node tools/amazon-ads.js setup" first.');
  }
  if (!config.redirectUri) {
    throw new Error(
      'redirectUri is required, and must exactly match an Allowed Return URL\n' +
        'on the LwA security profile (Developer Console > Login with Amazon >\n' +
        'gear icon > Web Settings).'
    );
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: LWA_SCOPE,
    response_type: 'code',
    redirect_uri: config.redirectUri,
  });
  return `https://${config.authHost}/ap/oa?${params.toString()}`;
}

/**
 * Exchange the one-time ?code= from the redirect for a refresh token.
 * Authorization codes expire after five minutes.
 */
async function exchangeAuthorizationCode(config, code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }).toString();

  const payload = await postToken(config, body);
  return {
    refreshToken: payload.refresh_token,
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
  };
}

// ============================================================
// Access tokens
// ============================================================

function readTokenCache() {
  if (!fs.existsSync(TOKEN_CACHE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function cacheKeyFor(config) {
  return `${config.clientId}:${config.refreshToken.slice(-12)}`;
}

/** Access tokens last 60 minutes; we refresh a minute early. */
async function getAccessToken(config) {
  assertCredentials(config);

  const key = cacheKeyFor(config);
  const cache = readTokenCache();
  if (cache && cache.key === key && cache.expiresAt - 60000 > Date.now()) {
    return cache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }).toString();

  const payload = await postToken(config, body);

  try {
    fs.writeFileSync(
      TOKEN_CACHE_FILE,
      JSON.stringify({
        key,
        accessToken: payload.access_token,
        expiresAt: Date.now() + payload.expires_in * 1000,
      })
    );
    fs.chmodSync(TOKEN_CACHE_FILE, 0o600);
  } catch (e) {
    // A non-writable home directory shouldn't break the call, just the cache.
  }

  return payload.access_token;
}

module.exports = {
  CONFIG_FILE,
  TOKEN_CACHE_FILE,
  LWA_SCOPE,
  MCP_ENDPOINTS,
  MARKETPLACE_REGIONS,
  getConfig,
  saveConfig,
  assertCredentials,
  authorizationUrl,
  exchangeAuthorizationCode,
  getAccessToken,
};
