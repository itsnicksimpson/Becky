#!/usr/bin/env node

/**
 * Submit an A+ Content document for Amazon approval and, once it's submitted, suspend older
 * A+ documents it replaces. Safe to re-run: skips documents that are already submitted,
 * approved or suspended. Right after Brand Registry approval Amazon can reject the submission
 * with "Failed asin permissions check" for a day or two; the script reports that as retryable.
 *
 * Usage: node tools/amazon-aplus-submit.js --content REF --suspend REF1,REF2 [--asin B07JFBZSCT] [--dry-run]
 * Prints JSON {content: {ref, statusBefore, submitted, retryable, error}, suspended: [...], title}
 * Exit codes: 0 done (or already submitted), 2 retry later, 1 unexpected error.
 */

const api = require('./lib/sp-api');

const MARKETPLACE = 'ATVPDKIKX0DER';
const DRY_RUN = process.argv.includes('--dry-run');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}

async function status(config, ref) {
  const doc = await api.get(config, `/aplus/2020-11-01/contentDocuments/${ref}`, { marketplaceId: MARKETPLACE, includedDataSet: 'METADATA' });
  return doc.contentRecord.contentMetadata.status;
}

async function main() {
  const contentRef = arg('--content');
  const suspendRefs = (arg('--suspend') || '').split(',').filter(Boolean);
  const asin = arg('--asin') || 'B07JFBZSCT';
  if (!contentRef) throw new Error('Pass --content <contentReferenceKey>');
  const config = api.getConfig();
  api.assertCredentials(config);

  const result = { content: { ref: contentRef }, suspended: [], title: null };
  const before = await status(config, contentRef);
  result.content.statusBefore = before;

  if (['SUBMITTED', 'APPROVED'].includes(before)) {
    result.content.submitted = true;
  } else if (DRY_RUN) {
    result.content.submitted = false;
  } else {
    try {
      await api.post(config, `/aplus/2020-11-01/contentDocuments/${contentRef}/approvalSubmissions`, {}, { marketplaceId: MARKETPLACE });
      result.content.submitted = true;
    } catch (e) {
      result.content.submitted = false;
      result.content.error = e.message.slice(0, 300);
      result.content.retryable = /asin permissions|403|429|5\d\d/i.test(e.message);
    }
  }

  // Only take the old content down once the replacement is in Amazon's review queue.
  if (result.content.submitted) {
    for (const ref of suspendRefs) {
      const current = await status(config, ref);
      const entry = { ref, statusBefore: current };
      if (current !== 'SUSPENDED' && !DRY_RUN) {
        try {
          await api.post(config, `/aplus/2020-11-01/contentDocuments/${ref}/suspendSubmissions`, {}, { marketplaceId: MARKETPLACE });
          entry.suspended = true;
        } catch (e) {
          entry.suspended = false;
          entry.error = e.message.slice(0, 300);
        }
      }
      result.suspended.push(entry);
    }
  }

  const item = await api.get(config, `/catalog/2022-04-01/items/${asin}`, { marketplaceIds: MARKETPLACE, includedData: 'summaries' });
  const title = item.summaries && item.summaries[0] && item.summaries[0].itemName;
  result.title = { current: title, stillHasClaims: /cellulite|stretch mark|acne/i.test(title || '') };

  console.log(JSON.stringify(result, null, 2));
  if (!result.content.submitted) process.exit(result.content.retryable || DRY_RUN ? 2 : 1);
  if (result.suspended.some((s) => s.suspended === false)) process.exit(1);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
