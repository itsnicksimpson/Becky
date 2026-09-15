'use strict';

/**
 * Amazon Selling Partner API (SP-API) client core.
 *
 * Shared by amazon-seller.js (CLI) and amazon-seller-mcp.js (MCP server).
 *
 * No dependencies — Node's built-in https/zlib only.
 *
 * Auth is Login with Amazon (LWA) only. SP-API dropped the AWS IAM /
 * Signature V4 requirement in October 2023, so a refresh token plus the
 * app's client id/secret is everything we need.
 */

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const CONFIG_FILE = path.join(os.homedir(), '.amazon-seller.json');
const TOKEN_CACHE_FILE = path.join(os.homedir(), '.amazon-seller-token.json');
const LWA_HOST = 'api.amazon.com';
const LWA_PATH = '/auth/o2/token';
const USER_AGENT = 'becky-amazon-seller-cli/1.0 (Language=Node.js)';

const REGION_HOSTS = {
  na: 'sellingpartnerapi-na.amazon.com',
  eu: 'sellingpartnerapi-eu.amazon.com',
  fe: 'sellingpartnerapi-fe.amazon.com',
};

const SANDBOX_HOSTS = {
  na: 'sandbox.sellingpartnerapi-na.amazon.com',
  eu: 'sandbox.sellingpartnerapi-eu.amazon.com',
  fe: 'sandbox.sellingpartnerapi-fe.amazon.com',
};

/** Marketplace code -> { id, region, currency }. */
const MARKETPLACES = {
  US: { id: 'ATVPDKIKX0DER', region: 'na', currency: 'USD' },
  CA: { id: 'A2EUQ1WTGCTBG2', region: 'na', currency: 'CAD' },
  MX: { id: 'A1AM78C64UM0Y8', region: 'na', currency: 'MXN' },
  BR: { id: 'A2Q3Y263D00KWC', region: 'na', currency: 'BRL' },
  UK: { id: 'A1F83G8C2ARO7P', region: 'eu', currency: 'GBP' },
  IE: { id: 'A28R8C7NBKEWEA', region: 'eu', currency: 'EUR' },
  DE: { id: 'A1PA6795UKMFR9', region: 'eu', currency: 'EUR' },
  FR: { id: 'A13V1IB3VIYZZH', region: 'eu', currency: 'EUR' },
  ES: { id: 'A1RKKUPIHCS9HS', region: 'eu', currency: 'EUR' },
  IT: { id: 'APJ6JRA9NG5V4', region: 'eu', currency: 'EUR' },
  NL: { id: 'A1805IZSGTT6HS', region: 'eu', currency: 'EUR' },
  BE: { id: 'AMEN7PMS3EDWL', region: 'eu', currency: 'EUR' },
  SE: { id: 'A2NODRKZP88ZB9', region: 'eu', currency: 'SEK' },
  PL: { id: 'A1C3SOZRARQ6R3', region: 'eu', currency: 'PLN' },
  TR: { id: 'A33AVAJ2PDY3EV', region: 'eu', currency: 'TRY' },
  EG: { id: 'ARBP9OOSHTCHU', region: 'eu', currency: 'EGP' },
  SA: { id: 'A17E79C6D8DWNP', region: 'eu', currency: 'SAR' },
  AE: { id: 'A2VIGQ35RCS4UG', region: 'eu', currency: 'AED' },
  IN: { id: 'A21TJRUUN4KGV', region: 'eu', currency: 'INR' },
  ZA: { id: 'AE08WJ6YKNBMC', region: 'eu', currency: 'ZAR' },
  JP: { id: 'A1VC38T7YXB528', region: 'fe', currency: 'JPY' },
  AU: { id: 'A39IBJ37TRP1C6', region: 'fe', currency: 'AUD' },
  SG: { id: 'A19VAU5U5O7RUS', region: 'fe', currency: 'SGD' },
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
 * repo .env  ->  ~/.amazon-seller.json  ->  process env.
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
    env.AMAZON_MARKETPLACE ||
    file.marketplace ||
    'US'
  ).toUpperCase();

  if (!MARKETPLACES[marketplace]) {
    throw new Error(
      `Unknown marketplace "${marketplace}". Known: ${Object.keys(MARKETPLACES).join(', ')}`
    );
  }

  const sandbox = Boolean(
    overrides.sandbox !== undefined
      ? overrides.sandbox
      : env.AMAZON_SP_SANDBOX === 'true' || file.sandbox
  );

  const config = {
    clientId: env.AMAZON_SP_CLIENT_ID || file.clientId || '',
    clientSecret: env.AMAZON_SP_CLIENT_SECRET || file.clientSecret || '',
    refreshToken: env.AMAZON_SP_REFRESH_TOKEN || file.refreshToken || '',
    sellerId: env.AMAZON_SELLER_ID || file.sellerId || '',
    marketplace,
    marketplaceId: MARKETPLACES[marketplace].id,
    currency: MARKETPLACES[marketplace].currency,
    region: MARKETPLACES[marketplace].region,
    sandbox,
  };

  config.host = sandbox
    ? SANDBOX_HOSTS[config.region]
    : REGION_HOSTS[config.region];

  return config;
}

function assertCredentials(config) {
  const missing = ['clientId', 'clientSecret', 'refreshToken'].filter(
    (k) => !config[k]
  );
  if (missing.length) {
    throw new Error(
      `Missing credentials: ${missing.join(', ')}.\n` +
        `Run "node tools/amazon-seller.js setup", or see tools/AMAZON-SELLER.md.`
    );
  }
}

function assertSellerId(config) {
  if (!config.sellerId) {
    throw new Error(
      'This command needs your seller (merchant) ID.\n' +
        'Find it in Seller Central > Settings > Account Info > Merchant Token,\n' +
        'then set it with "node tools/amazon-seller.js setup" or AMAZON_SELLER_ID.'
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// LWA access tokens
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
  // Tokens are per-app + per-seller-authorization; never reuse across them.
  return `${config.clientId}:${config.refreshToken.slice(-12)}`;
}

async function getAccessToken(config) {
  assertCredentials(config);

  const key = cacheKeyFor(config);
  const cache = readTokenCache();
  // Refresh a minute early so a token can't expire mid-flight.
  if (cache && cache.key === key && cache.expiresAt - 60000 > Date.now()) {
    return cache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }).toString();

  const res = await httpRequest(
    {
      hostname: LWA_HOST,
      port: 443,
      path: LWA_PATH,
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
    throw new Error(`LWA returned non-JSON (HTTP ${res.status}): ${res.buffer.toString('utf8').slice(0, 400)}`);
  }

  if (res.status !== 200 || !payload.access_token) {
    const detail = payload.error_description || payload.error || JSON.stringify(payload);
    throw new Error(
      `LWA token exchange failed (HTTP ${res.status}): ${detail}\n` +
        'Check clientId / clientSecret / refreshToken. Refresh tokens are revoked ' +
        'if the app is reauthorized or the secret is rotated.'
    );
  }

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

// ============================================================
// SP-API requests
// ============================================================

class SpApiError extends Error {
  constructor(status, errors, requestId) {
    const first = (errors && errors[0]) || {};
    super(
      `SP-API ${status}${first.code ? ` ${first.code}` : ''}: ` +
        `${first.message || 'request failed'}${first.details ? ` (${first.details})` : ''}`
    );
    this.name = 'SpApiError';
    this.status = status;
    this.errors = errors || [];
    this.requestId = requestId;
  }
}

function buildQuery(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Call an SP-API operation.
 *
 * Retries 429/500/502/503 with exponential backoff — SP-API throttles hard
 * and per-operation, so a burst of listing patches will hit 429 routinely.
 */
async function request(config, method, apiPath, opts = {}) {
  const { query, body, maxRetries = 4 } = opts;
  const accessToken = await getAccessToken(config);
  const payload = body === undefined ? null : JSON.stringify(body);

  let attempt = 0;
  for (;;) {
    const headers = {
      'x-amz-access-token': accessToken,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const res = await httpRequest(
      {
        hostname: config.host,
        port: 443,
        path: apiPath + buildQuery(query),
        method,
        headers,
      },
      payload
    );

    const text = res.buffer.toString('utf8');
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < maxRetries) {
      // 1s, 2s, 4s, 8s — comfortably above the 1 req/s floor of the
      // slowest operations (report creation, validation previews).
      await sleep(1000 * Math.pow(2, attempt));
      attempt += 1;
      continue;
    }

    if (res.status >= 400) {
      throw new SpApiError(
        res.status,
        (data && data.errors) || [{ message: text.slice(0, 400) || 'no response body' }],
        res.headers['x-amzn-requestid']
      );
    }

    return data;
  }
}

const get = (config, apiPath, query) => request(config, 'GET', apiPath, { query });
const post = (config, apiPath, body, query) =>
  request(config, 'POST', apiPath, { body, query });
const patch = (config, apiPath, body, query) =>
  request(config, 'PATCH', apiPath, { body, query });
const put = (config, apiPath, body, query) =>
  request(config, 'PUT', apiPath, { body, query });
const del = (config, apiPath, query) => request(config, 'DELETE', apiPath, { query });

// ============================================================
// Helpers
// ============================================================

/** ISO-8601 timestamp N days back, which is how SP-API wants date filters. */
function daysAgoIso(days) {
  return new Date(Date.now() - Number(days) * 86400000).toISOString();
}

/**
 * Download a report/feed document. These are presigned URLs, so they take no
 * auth header, and Amazon usually serves them gzipped.
 */
async function downloadDocument(documentUrl, compressionAlgorithm, encoding = 'utf8') {
  const url = new URL(documentUrl);
  const res = await httpRequest({
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT },
  });

  if (res.status >= 400) {
    throw new Error(`Document download failed (HTTP ${res.status})`);
  }

  const buffer =
    compressionAlgorithm === 'GZIP' ? zlib.gunzipSync(res.buffer) : res.buffer;
  return buffer.toString(encoding);
}

module.exports = {
  CONFIG_FILE,
  TOKEN_CACHE_FILE,
  MARKETPLACES,
  REGION_HOSTS,
  SpApiError,
  getConfig,
  saveConfig,
  assertCredentials,
  assertSellerId,
  getAccessToken,
  request,
  get,
  post,
  patch,
  put,
  del,
  daysAgoIso,
  downloadDocument,
};
