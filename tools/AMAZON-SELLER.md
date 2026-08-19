# Amazon Seller integration for Becky

Control the Becky Amazon Seller account from Claude — orders, FBA inventory,
listings, pricing, fees, finances and bulk reports — through the Amazon
[Selling Partner API](https://developer-docs.amazon.com/sp-api/) (SP-API).

Two surfaces, one implementation:

| Surface | File | Use it when |
| --- | --- | --- |
| CLI | `tools/amazon-seller.js` | Terminal, scripts, cron |
| MCP server | `tools/amazon-seller-mcp.js` | Claude calls Amazon directly as native tools |

Both call the same operations in `tools/lib/operations.js`, so they behave
identically. No npm dependencies — Node's standard library only.

---

## 1. What you need before starting

- A **Professional** selling plan (Individual plans cannot use SP-API).
- To be the **Primary User** of the Seller Central account. Only the primary
  user can authorize an application.
- A **government-issued photo ID** (passport, national ID, or driver's
  licence).
- A **proof of address issued within the last 180 days** — a bank, credit
  card, or e-commerce payment service statement (Payoneer, Hyperwallet,
  World First, Alipay).

Budget for the wait, not the work. The forms take under an hour; Amazon's
reviews are the long pole. Identity verification is up to two business days,
and role approval after that is typically quoted at one to two weeks.

## 2. Get through the Solution Provider Portal

Developer registration now lives in the **Solution Provider Portal** (SPP),
which replaced the old Developer Central page:

<https://sellercentral.amazon.com/sellingpartner/developerconsole>

That host is for US / CA / MX. Elsewhere the path is identical, only the host
changes — `sellercentral-europe.amazon.com` (UK, DE, FR, IT, ES),
`sellercentral.amazon.com.br`, `.co.jp`, `.in`, `.sg`, `.com.tr`, `.nl`.
Amazon reshuffles these links periodically; the durable route is the menu:
**Apps and Services → Develop Apps**.

There are four gates, in order. Signing up only unlocks **sandbox** apps —
production access needs all four.

### Gate 1 — Sign up

Creates the SPP account. At this point the portal will offer you
`+ Add new app client`, but anything you build is sandbox-only.

### Gate 2 — Verify your Identity

Upload the ID and proof of address from above, then complete the
verification form. Amazon reviews within about two business days and emails
the result.

You cannot edit the form after submitting, so check the details before you
send it.

### Gate 3 — Account Profile and Permissions (the developer profile)

**This is where roles are chosen — not on the app client.** The form asks for
organisation details, developer type, roles, a use-case description, and
answers about your security practices.

- **Developer type: Private.** Becky's app only ever touches Becky's own
  account, which makes it a private seller application — self-authorized, no
  OAuth flow, no Amazon Appstore listing.
- **Roles:** request the six below. You can apply for more later.

Draft answers for every field on this form — including the free-text business
activity, use cases and third-party disclosure — are in
[`SPP-PROFILE.md`](SPP-PROFILE.md). The security-controls section refers to
[`INCIDENT-RESPONSE-PLAN.md`](INCIDENT-RESPONSE-PLAN.md).

| Role | Gives you |
| --- | --- |
| Inventory and Order Tracking | orders, FBA inventory |
| Amazon Fulfillment | FBA detail |
| Product Listing | reading and editing listings |
| Pricing | your prices, competitive/buy-box prices |
| Selling Partner Insights | account and marketplace info |
| Finance and Accounting | settlement and fee data |

You do **not** need Direct-to-Consumer Shipping or any PII role for anything
this integration does. Skip them. Restricted (personal data) roles go through
a three-stage business, security and technical review, and buyer addresses
coming back redacted costs you nothing here.

### Gate 4 — Add new app client

Once roles are approved, create the production app. The registration form
asks for four things:

- **App name** — internal only, never shown publicly.
- **API Type** — SP API.
- **App Type** — Production (Sandbox apps cannot reach real account data).
- **Business entities supported** — **Sellers** only. Vendors is for 1P
  wholesale through Vendor Central, a separate relationship; Certifier,
  Freight and Shipping are for certification bodies and carriers.

The app can only be scoped to roles your profile was approved for.

Then collect the three values the tool needs:

1. **Settings → Account Info → Merchant Token.** Copy the seller ID
   (looks like `A1B2C3D4E5F6G7`).
2. On the app row, **LWA credentials → View**. Copy the **Client ID** and
   **Client Secret**.
3. On the app row, **Authorize app**. Copy the **refresh token** (starts with
   `Atzr|`). Each time you click Authorize you get a *new* refresh token and
   the previous one stops working — so grab it once and paste it straight
   into `setup`.

There is no single "API key": the refresh token plus the client ID/secret are
what the tool exchanges for a one-hour access token on each run.

## 3. Store the credentials

```bash
node tools/amazon-seller.js setup
```

This writes `~/.amazon-seller.json` with permissions `600`. Nothing is written
into the repository, and `.gitignore` covers the credential and token-cache
files in case you move them here.

Environment variables override the file, which is what you want in CI:

```
AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, AMAZON_SP_REFRESH_TOKEN,
AMAZON_SELLER_ID, AMAZON_MARKETPLACE, AMAZON_SP_SANDBOX
```

A repo-root `.env` is read too (also gitignored), with the lowest precedence.

Verify:

```bash
node tools/amazon-seller.js whoami        # what's configured, no API call
node tools/amazon-seller.js marketplaces  # live connection test
```

## 4. Let Claude use it

**Claude Code** — already wired up by `.mcp.json` in the repo root. Start
Claude Code in this directory and approve the `amazon-seller` server when
prompted. Then just ask: *"how did Becky sell on Amazon this week?"*

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "amazon-seller": {
      "command": "node",
      "args": ["/absolute/path/to/Becky/tools/amazon-seller-mcp.js"]
    }
  }
}
```

Tools exposed: `amazon_account`, `amazon_orders`, `amazon_order_detail`,
`amazon_inventory`, `amazon_listing`, `amazon_set_price`,
`amazon_set_quantity`, `amazon_patch_listing`, `amazon_catalog_search`,
`amazon_pricing`, `amazon_fees_estimate`, `amazon_finances`, `amazon_reports`.

---

## Writes are dry-run by default

`set-price`, `set-quantity` and `patch-listing` change nothing unless you pass
`--confirm` (CLI) or `confirm: true` (MCP). Without it they send the same
request with Amazon's `mode=VALIDATION_PREVIEW`, which runs the real
validation without persisting anything, and return both the exact request and
Amazon's verdict.

```bash
# See what would happen, and whether Amazon would accept it
node tools/amazon-seller.js set-price BECKY-SERUM-30ML 29.99

# Actually do it
node tools/amazon-seller.js set-price BECKY-SERUM-30ML 29.99 --confirm
```

Check the margin first — the fee estimate is the number that matters:

```bash
node tools/amazon-seller.js fees BECKY-SERUM-30ML 29.99
```

## Command reference

```bash
node tools/amazon-seller.js --help
```

Common ones:

```bash
node tools/amazon-seller.js orders --days 30 --status Unshipped
node tools/amazon-seller.js order-items 111-2223333-4445555
node tools/amazon-seller.js inventory
node tools/amazon-seller.js listing BECKY-SERUM-30ML
node tools/amazon-seller.js catalog --keywords "vitamin c serum" --limit 5
node tools/amazon-seller.js competitive-pricing --asins B0XXXXXXX1,B0XXXXXXX2
node tools/amazon-seller.js finances --days 30
node tools/amazon-seller.js report-create GET_MERCHANT_LISTINGS_ALL_DATA
node tools/amazon-seller.js report-get <report-id>
node tools/amazon-seller.js report-download <report-id>
```

Anything without a dedicated command is reachable raw:

```bash
node tools/amazon-seller.js get /fba/inbound/v0/shipments \
  --query '{"QueryType":"SHIPMENT","MarketplaceId":"ATVPDKIKX0DER"}'
```

Add `--marketplace UK` to any command to target another store, and
`--sandbox` to hit Amazon's sandbox endpoint instead of production.

## Tests

```bash
cd tools && npm test
```

The transport is stubbed, so the suite runs offline and needs no credentials.
It covers payload shaping and — most importantly — that write operations stay
dry until they're confirmed.

## Notes and gotchas

- **Auth is LWA only.** Amazon dropped the AWS IAM / Signature V4 requirement
  in October 2023, so there is no AWS account, IAM user or request signing
  involved. Access tokens last an hour and are cached in
  `~/.amazon-seller-token.json`.
- **Throttling is per-operation and aggressive.** Requests retry automatically
  on 429 with backoff (1s, 2s, 4s, 8s). Validation previews are capped at one
  request per second by Amazon, so bulk price checks will be slow by design.
- **FBA quantities are not yours to set.** `set-quantity` only affects
  merchant-fulfilled offers; FBA stock changes through inbound shipments.
- **Buyer PII is redacted** unless the app holds PII roles and you request a
  Restricted Data Token. Orders, totals and ship-to region all work without it.
- **Report contents are CSV/TSV**, sometimes in Windows-1252 rather than
  UTF-8. If accented characters look wrong, pass `--encoding latin1`.
- **You must rotate the LWA client secret every 180 days.** Amazon requires
  it. Rotation is low-friction and causes no downtime: the client ID does not
  change, existing refresh tokens keep working, sellers do not re-authorize,
  and the old secret stays valid for seven days so there is no cutover race.
  Rotate in SPP, then re-run `setup` (or update `AMAZON_SP_CLIENT_SECRET`)
  with the new secret.
- **Rotating the secret does not invalidate the refresh token** — refresh
  tokens are tied to the client *identifier*, not the secret. Only clicking
  **Authorize app** again invalidates the previous refresh token.
- **Authorizations expire after 365 days** and need renewing. Calls failing
  with an LWA error roughly a year after setup is the likely cause — re-run
  Authorize app in SPP, then `setup` with the new refresh token.
