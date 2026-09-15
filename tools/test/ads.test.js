'use strict';

/**
 * Tests for the Amazon Ads connection layer.
 *
 * Run with:  node --test tools/test/
 *
 * Amazon owns the Ads tools themselves, so there is no operations layer to
 * test here. What can break on our side is narrow and worth pinning: which
 * regional endpoint we pick, how the authorization URL is built, and whether
 * we correctly pull JSON-RPC messages out of an SSE response.
 */

const test = require('node:test');
const assert = require('node:assert');

const api = require('../lib/ads-api');
const { AdsMcpClient, parseSse } = require('../lib/ads-mcp-client');

const BASE = {
  clientId: 'amzn1.application-oa2-client.TEST',
  clientSecret: 'secret',
  refreshToken: 'Atzr|TEST',
  redirectUri: 'https://amazon.com',
};

// ============================================================
// Region routing
// ============================================================

test('marketplaces route to the right regional MCP endpoint', () => {
  const cases = [
    ['US', 'na', 'https://advertising-ai.amazon.com/mcp'],
    ['CA', 'na', 'https://advertising-ai.amazon.com/mcp'],
    ['UK', 'eu', 'https://advertising-ai-eu.amazon.com/mcp'],
    ['DE', 'eu', 'https://advertising-ai-eu.amazon.com/mcp'],
    ['JP', 'fe', 'https://advertising-ai-fe.amazon.com/mcp'],
  ];

  for (const [marketplace, region, endpoint] of cases) {
    const config = api.getConfig({ marketplace });
    assert.equal(config.region, region, `${marketplace} region`);
    assert.equal(config.mcpEndpoint, endpoint, `${marketplace} endpoint`);
  }
});

test('each region uses its own LwA token host', () => {
  assert.equal(api.getConfig({ marketplace: 'US' }).tokenHost, 'api.amazon.com');
  assert.equal(api.getConfig({ marketplace: 'UK' }).tokenHost, 'api.amazon.co.uk');
  assert.equal(api.getConfig({ marketplace: 'JP' }).tokenHost, 'api.amazon.co.jp');
});

test('an unknown marketplace fails loudly rather than defaulting', () => {
  assert.throws(() => api.getConfig({ marketplace: 'ZZ' }), /Unknown marketplace/);
});

// ============================================================
// Authorization URL
// ============================================================

test('the authorization URL carries the campaign management scope', () => {
  const config = Object.assign(api.getConfig({ marketplace: 'US' }), BASE);
  const url = new URL(api.authorizationUrl(config));

  assert.equal(url.host, 'www.amazon.com');
  assert.equal(url.pathname, '/ap/oa');
  assert.equal(url.searchParams.get('scope'), 'advertising::campaign_management');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), BASE.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), BASE.redirectUri);
});

test('EU and FE authorize on their own sign-in hosts', () => {
  const eu = new URL(api.authorizationUrl(Object.assign(api.getConfig({ marketplace: 'UK' }), BASE)));
  const fe = new URL(api.authorizationUrl(Object.assign(api.getConfig({ marketplace: 'JP' }), BASE)));

  assert.equal(eu.host, 'eu.account.amazon.com');
  assert.equal(fe.host, 'apac.account.amazon.com');
});

test('a missing return URL is caught before Amazon is called', () => {
  const config = Object.assign(api.getConfig({ marketplace: 'US' }), BASE, { redirectUri: '' });
  assert.throws(() => api.authorizationUrl(config), /redirectUri is required/);
});

// ============================================================
// SSE parsing
// ============================================================

test('SSE frames yield their JSON-RPC messages in order', () => {
  const body =
    'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"a":1}}\n\n' +
    'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"b":2}}\n\n';

  const messages = parseSse(body);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map((m) => m.id), [1, 2]);
});

test('a data payload split across lines is rejoined', () => {
  const messages = parseSse('data: {"jsonrpc":"2.0",\ndata: "id":7}\n\n');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 7);
});

test('non-JSON frames are skipped, not thrown', () => {
  const messages = parseSse('data: not json\n\ndata: {"jsonrpc":"2.0","id":9}\n\n');
  assert.deepEqual(messages.map((m) => m.id), [9]);
});

// ============================================================
// Client headers and session handling
// ============================================================

/** Swap the HTTPS layer for a recorder. */
function stubClient(responses) {
  const calls = [];
  const client = new AdsMcpClient({
    endpoint: 'https://advertising-ai.amazon.com/mcp',
    clientId: BASE.clientId,
    getAccessToken: async () => 'Atza|TESTTOKEN',
  });

  let index = 0;
  client.request = async (headers, body) => {
    calls.push({ headers, body: JSON.parse(body) });
    const next = responses[index++] || { status: 202, headers: {}, buffer: Buffer.alloc(0) };
    return {
      status: next.status,
      headers: next.headers || {},
      buffer: Buffer.from(next.body || ''),
    };
  };

  return { client, calls };
}

test('every request carries the bearer token and the Amazon client id', async () => {
  const { client, calls } = stubClient([
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"jsonrpc":"2.0","id":1,"result":{}}',
    },
  ]);

  await client.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

  assert.equal(calls[0].headers.Authorization, 'Bearer Atza|TESTTOKEN');
  assert.equal(calls[0].headers['Amazon-Ads-ClientId'], BASE.clientId);
  assert.match(calls[0].headers.Accept, /text\/event-stream/);
});

test('the session id from initialize is echoed on later requests', async () => {
  const { client, calls } = stubClient([
    {
      status: 200,
      headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-abc' },
      body: '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"}}',
    },
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"jsonrpc":"2.0","id":2,"result":{"tools":[]}}',
    },
  ]);

  await client.send({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  await client.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

  assert.equal(calls[0].headers['Mcp-Session-Id'], undefined, 'none to send on the first call');
  assert.equal(calls[1].headers['Mcp-Session-Id'], 'session-abc');
  assert.equal(calls[1].headers['MCP-Protocol-Version'], '2025-06-18');
});

test('notifications answered with 202 produce no messages', async () => {
  const { client } = stubClient([{ status: 202, headers: {} }]);
  const messages = await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.deepEqual(messages, []);
});

test('a 403 explains that access may not be assigned to the LwA app', async () => {
  const { client } = stubClient([
    { status: 403, headers: { 'content-type': 'application/json' }, body: '{"message":"Forbidden"}' },
  ]);

  await assert.rejects(
    () => client.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    /HTTP 403[\s\S]*API access is assigned/
  );
});
