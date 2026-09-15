#!/usr/bin/env node

/**
 * Scheduled blog articles can link to other articles that aren't published yet. When an article
 * is created, links to not-yet-live articles are turned into plain text and the full HTML is kept
 * in the article's becky.full_body metafield. This restores each link once its target is live,
 * and clears the metafield when every link is back.
 *
 * Usage: node tools/shopify-restore-links.js [--dry-run]
 * Prints JSON: {checked, restored: [{handle, linksRestored, pending}], errors}
 */

const { getConfig, resolveAccessToken, executeQuery } = require('./shopify-admin');

const https = require('https');

const BLOG_PATH = '/blogs/booty-atlas/';
const DRY_RUN = process.argv.includes('--dry-run');

// Storefront status without following redirects (a merged article answers 301, a scheduled one 404).
function pageStatus(url) {
  return new Promise((resolve) => {
    const req = https.get(`${url}?restore-check=${Date.now()}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Becky link restore)' }, timeout: 20000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); resolve('timeout'); });
    req.on('error', () => resolve('error'));
  });
}

// Replace <a href="/blogs/booty-atlas/HANDLE">text</a> with its text when HANDLE isn't live.
function stripUnpublishedLinks(html, liveHandles) {
  let pending = 0;
  const body = html.replace(/<a\s[^>]*href="(?:https:\/\/hibecky\.com)?\/blogs\/booty-atlas\/([a-z0-9-]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (match, handle, text) => {
    if (liveHandles.has(handle)) return match;
    pending += 1;
    return text;
  });
  return { body, pending };
}

async function main() {
  const config = getConfig();
  const token = await resolveAccessToken(config);
  const gql = async (query, variables) => {
    const result = await executeQuery(config.store, token, query, variables);
    if (result.status !== 200 || result.data.errors) {
      throw new Error(`Shopify HTTP ${result.status}: ${JSON.stringify(result.data.errors || result.data).slice(0, 300)}`);
    }
    return result.data.data;
  };

  const articles = [];
  let cursor = null;
  do {
    const data = await gql(`query($cursor: String) { articles(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { id handle isPublished publishedAt body full: metafield(namespace: "becky", key: "full_body") { id value } } } }`, { cursor });
    articles.push(...data.articles.nodes);
    cursor = data.articles.pageInfo.hasNextPage ? data.articles.pageInfo.endCursor : null;
  } while (cursor);

  // An article counts as live once its publish time has passed and its page actually loads on the storefront
  // (merged articles redirect, and scheduled ones 404 until they go up).
  const now = Date.now();
  const due = articles.filter((a) => a.publishedAt && Date.parse(a.publishedAt) <= now).map((a) => a.handle);
  const referenced = new Set();
  for (const a of articles) {
    if (!a.full || !a.full.value) continue;
    for (const m of a.full.value.matchAll(/href="(?:https:\/\/hibecky\.com)?\/blogs\/booty-atlas\/([a-z0-9-]+)/g)) referenced.add(m[1]);
  }
  const live = new Set();
  for (const handle of due) {
    if (!referenced.has(handle)) { live.add(handle); continue; }
    if ((await pageStatus(`https://hibecky.com${BLOG_PATH}${handle}`)) === 200) live.add(handle);
  }
  const summary = { checked: 0, restored: [], errors: [] };

  for (const article of articles) {
    if (!article.full || !article.full.value) continue;
    summary.checked += 1;
    const { body, pending } = stripUnpublishedLinks(article.full.value, live);
    if (body === article.body && pending > 0) continue;
    const linksRestored = (body.match(/<a\s/g) || []).length - (article.body.match(/<a\s/g) || []).length;
    summary.restored.push({ handle: article.handle, linksRestored, pending });
    if (DRY_RUN) continue;
    try {
      if (body !== article.body) {
        const update = await gql(`mutation($id: ID!, $b: HTML!) { articleUpdate(id: $id, article: { body: $b }) { userErrors { message } } }`, { id: article.id, b: body });
        if (update.articleUpdate.userErrors.length) throw new Error(JSON.stringify(update.articleUpdate.userErrors));
      }
      if (pending === 0) {
        const del = await gql(`mutation($m: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $m) { userErrors { message } } }`,
          { m: [{ ownerId: article.id, namespace: 'becky', key: 'full_body' }] });
        if (del.metafieldsDelete.userErrors.length) throw new Error(JSON.stringify(del.metafieldsDelete.userErrors));
      }
    } catch (e) {
      summary.errors.push({ handle: article.handle, error: e.message });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exit(1);
}

module.exports = { stripUnpublishedLinks };

if (require.main === module) {
  main().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}
