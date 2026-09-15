'use strict';

/**
 * Minimal MCP Streamable HTTP client for Amazon's managed Ads MCP Server.
 *
 * Amazon hosts the server; we only need to speak to it. One POST per
 * JSON-RPC message, with three things Amazon requires on every request:
 *
 *   Authorization: Bearer <LwA access token>
 *   Amazon-Ads-ClientId: <LwA client id>
 *   Mcp-Session-Id: <returned by initialize>
 *
 * Responses come back either as a single JSON body or as an SSE stream
 * carrying one or more JSON-RPC messages. We buffer the stream and return
 * its messages together: tool results arrive whole either way, and the only
 * thing lost is the timing of interim progress notifications.
 */

const https = require('https');

const USER_AGENT = 'becky-amazon-ads/1.0 (Language=Node.js)';

class AdsMcpClient {
  constructor({ endpoint, clientId, getAccessToken }) {
    this.url = new URL(endpoint);
    this.clientId = clientId;
    this.getAccessToken = getAccessToken;
    this.sessionId = null;
    this.protocolVersion = null;
  }

  /**
   * Send one JSON-RPC message. Returns an array of JSON-RPC messages that
   * came back — empty for notifications, which Amazon answers with 202.
   */
  async send(message) {
    const accessToken = await this.getAccessToken();
    const body = JSON.stringify(message);

    const headers = {
      'Content-Type': 'application/json',
      // Either shape is acceptable to us; the server picks.
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${accessToken}`,
      'Amazon-Ads-ClientId': this.clientId,
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': USER_AGENT,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    if (this.protocolVersion) headers['MCP-Protocol-Version'] = this.protocolVersion;

    const res = await this.request(headers, body);

    // The session id is issued on initialize and required from then on.
    const returnedSession = res.headers['mcp-session-id'];
    if (returnedSession) this.sessionId = returnedSession;

    if (res.status === 202 || !res.buffer.length) return [];

    if (res.status >= 400) {
      const detail = res.buffer.toString('utf8').slice(0, 500);
      throw new Error(
        `Amazon Ads MCP Server returned HTTP ${res.status}: ${detail || 'no body'}` +
          (res.status === 401 || res.status === 403
            ? '\nThat usually means the access token or client id was rejected — ' +
              'check that API access is assigned to this LwA application.'
            : '')
      );
    }

    const contentType = String(res.headers['content-type'] || '');
    const text = res.buffer.toString('utf8');
    const messages = contentType.includes('text/event-stream')
      ? parseSse(text)
      : [JSON.parse(text)];

    // Remember the negotiated version so later requests can echo it back.
    for (const msg of messages) {
      if (msg && msg.result && msg.result.protocolVersion) {
        this.protocolVersion = msg.result.protocolVersion;
      }
    }

    return messages;
  }

  request(headers, body) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.url.hostname,
          port: 443,
          path: this.url.pathname + this.url.search,
          method: 'POST',
          headers,
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              buffer: Buffer.concat(chunks),
            })
          );
        }
      );
      req.on('error', reject);
      req.setTimeout(120000, () =>
        req.destroy(new Error('Amazon Ads MCP Server timed out after 120s'))
      );
      req.write(body);
      req.end();
    });
  }
}

/** Pull JSON-RPC messages out of an SSE body: every `data:` payload. */
function parseSse(text) {
  const messages = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data) continue;
    try {
      messages.push(JSON.parse(data));
    } catch (e) {
      // A non-JSON data frame is not ours to interpret; skip it.
    }
  }
  return messages;
}

module.exports = { AdsMcpClient, parseSse };
