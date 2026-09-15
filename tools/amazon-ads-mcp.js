#!/usr/bin/env node

/**
 * Amazon Ads MCP proxy for Becky.
 *
 * Amazon runs the Ads MCP Server as a managed remote endpoint over
 * Streamable HTTP. This process is a thin stdio bridge in front of it: it
 * forwards JSON-RPC both ways and attaches the two headers Amazon requires,
 * minting a fresh LwA access token as needed.
 *
 * The bridge exists because access tokens live only 60 minutes. A static
 * Authorization header in .mcp.json would work for an hour and then start
 * failing with 401s; refreshing per request removes that whole class of bug.
 *
 * Credentials come from ~/.amazon-ads.json or the environment — never from
 * the client. Set up with: node tools/amazon-ads.js setup
 */

const readline = require('readline');
const api = require('./lib/ads-api');
const { AdsMcpClient } = require('./lib/ads-mcp-client');

const SERVER_INFO = { name: 'amazon-ads', version: '1.0.0' };
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

const SETUP_HINT =
  'Amazon Ads is not connected yet. Run "node tools/amazon-ads.js setup" and then ' +
  '"node tools/amazon-ads.js authorize". Registering the app with Amazon has to ' +
  'happen first — see tools/AMAZON-ADS.md.';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/**
 * Until credentials exist we still speak MCP correctly — initialize
 * succeeds, the tool list is simply empty. Failing to start instead would
 * surface as an opaque broken server on every launch while the Amazon
 * application is still pending.
 */
function serveUnconfigured(message) {
  const { id, method } = message;
  if (id === undefined) return;

  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion:
            (message.params && message.params.protocolVersion) || DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      });
      return;
    case 'ping':
      send({ jsonrpc: '2.0', id, result: {} });
      return;
    case 'tools/list':
      send({ jsonrpc: '2.0', id, result: { tools: [] } });
      return;
    default:
      send({ jsonrpc: '2.0', id, error: { code: -32002, message: SETUP_HINT } });
  }
}

function main() {
  let config;
  let configured = false;

  try {
    config = api.getConfig();
    api.assertCredentials(config);
    configured = true;
  } catch (e) {
    process.stderr.write(`amazon-ads: ${SETUP_HINT}\n`);
  }

  const client = configured
    ? new AdsMcpClient({
        endpoint: config.mcpEndpoint,
        clientId: config.clientId,
        getAccessToken: () => api.getAccessToken(config),
      })
    : null;

  // Amazon's server is stateful per session, so messages must reach it in
  // the order they arrived. This chain serialises them.
  let queue = Promise.resolve();

  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch (e) {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: `Parse error: ${e.message}` } });
      return;
    }

    if (!configured) {
      serveUnconfigured(message);
      return;
    }

    queue = queue.then(async () => {
      try {
        const responses = await client.send(message);
        for (const response of responses) send(response);
      } catch (e) {
        // Report failures against the originating request so the model can
        // read them; a notification has no id to answer and is dropped.
        if (message.id !== undefined) {
          send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: e.message } });
        } else {
          process.stderr.write(`amazon-ads: ${e.message}\n`);
        }
      }
    });
  });

  rl.on('close', () => process.exit(0));
}

main();
