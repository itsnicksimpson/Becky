# Amazon Ads integration for Becky

Manage Becky's Sponsored Products, Brands and Display campaigns from Claude —
campaigns, budgets, bids, reporting and billing — through **Amazon's own Ads
MCP Server**.

Unlike the Seller integration, we do not implement the API here. Amazon runs
the [Ads MCP Server](https://advertising.amazon.com/API/docs/en-us/mcp/mcp-overview)
as a managed remote endpoint exposing 50+ tools, and builds and maintains them
itself. Everything in this repo is the connective tissue:

| File | Job |
| --- | --- |
| `tools/amazon-ads.js` | CLI: credential setup, OAuth, connection test |
| `tools/amazon-ads-mcp.js` | stdio bridge to Amazon's remote endpoint |
| `tools/lib/ads-api.js` | LwA credentials and access tokens |
| `tools/lib/ads-mcp-client.js` | Streamable HTTP MCP transport |

No npm dependencies — Node's standard library only.

---

## 1. Why there is a registration at all

The MCP Server does not remove the API onboarding. Amazon's own connect guide
is explicit: you need a **Client ID, Client Secret and Refresh Token** from the
Amazon Ads developer console, and the open beta is offered to partners *with
active API credentials*. The MCP Server is a better front door onto the Ads
API, not a way around it.

The good news is that it is far lighter than the SP-API gauntlet. No identity
verification, no proof of address, no roles review, no security questionnaire.
Amazon quotes **up to one business day** for approval.

> **Ads and SP-API do not share credentials.** Amazon requires a *new* Login
> with Amazon security profile for Ads even though Becky already has one for
> the Selling Partner API. Nothing here reuses `~/.amazon-seller.json`.

## 2. Register the application

Three steps, in order, all at
<https://advertising.amazon.com/API/docs/en-us/guides/onboarding/overview>.

### Step 1 — Create a Login with Amazon security profile

Free, instant, no approval needed.

1. Sign in at <https://developer.amazon.com> and open **Developer Console**.
2. **Login with Amazon** on the menu bar → **Create a New Security Profile**.
3. Fill in name, description, and a Consent Privacy Notice URL. As a direct
   advertiser reaching only your own data, any valid URL is accepted here.
4. Back on the Login with Amazon page, **Show Client ID and Client Secret**
   on your new profile. These can be retrieved again at any time.

**Choose the sign-in email carefully.** It gets permanently bound to your Ads
API permissions in step 3 and cannot be changed afterwards. Amazon recommends
an address several people in the business can reach. Only the original creator
of the developer account can complete onboarding, and Amazon allows **one
client ID per company**.

### Step 2 — Apply for API access

As a Direct Advertiser (you are automating your own account, not acting for
others), go to
<https://advertising.amazon.com/API/docs/en-us/guides/onboarding/apply-for-access>
and follow the Direct Advertiser link.

Sign in with **the same email as step 1**. If you are already signed in to any
Amazon account, check the profile shown top right before continuing — landing
on the form as the wrong user is the common failure here.

Complete the form and submit. Amazon emails a decision, usually within a
business day.

### Step 3 — Assign access to the LwA profile

Approval alone does not connect anything. The approval email carries a link
that binds your API access to the security profile from step 1.

> **Log out of every other Amazon account first**, including your personal
> shopping account. If the link is opened while signed in as the wrong user it
> is invalidated, and only Amazon's API support team can reset it.

Click the link, pick the security profile from step 1, and submit. The
confirmation page lists `advertising::campaign_management` — the scope this
integration uses.

### Step 4 — Add an Allowed Return URL

In the Developer Console: **Login with Amazon** → gear icon under *Manage* →
**Web Settings** → **Edit** → *Allowed Return URLs*.

`https://amazon.com` is fine. Nothing needs to be hosted there: after consent
you land on it with `?code=...` appended, and you copy the code out of the
address bar.

## 3. Connect

```bash
node tools/amazon-ads.js setup
```

Asks for the client ID, client secret, return URL and primary marketplace, and
writes `~/.amazon-ads.json` with permissions `600`. Nothing lands in the
repository, and `.gitignore` covers the credential and token-cache files in
case you move them here.

```bash
node tools/amazon-ads.js authorize
```

Prints the consent URL, waits while you approve it in a browser, then swaps
the authorization code for a refresh token and immediately tests the
connection. Sign in with the account that has access to the advertising
account — **that may not be your developer account**.

Authorization codes expire after **five minutes**, so paste promptly.

Environment variables override the file, which is what you want in CI:

```
AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, AMAZON_ADS_REFRESH_TOKEN,
AMAZON_ADS_REDIRECT_URI, AMAZON_ADS_MARKETPLACE
```

Verify any time:

```bash
node tools/amazon-ads.js whoami   # what's configured, no API call
node tools/amazon-ads.js test     # live connection, lists available tools
```

## 4. Let Claude use it

**Claude Code** — already wired up by `.mcp.json` in the repo root. Restart
Claude Code after authorizing, then just ask: *"how did Becky's sponsored
products do last month?"*

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "amazon-ads": {
      "command": "node",
      "args": ["/absolute/path/to/Becky/tools/amazon-ads-mcp.js"]
    }
  }
}
```

Before credentials exist the server still starts and simply reports no tools,
so an unfinished application never shows up as a broken server on launch.

## 5. What Amazon exposes

Tools are named `<tool_group>-<tool_name>`:

| Group | Covers |
| --- | --- |
| `account_management` | advertiser accounts, profiles — `account_management-list_profiles` |
| `campaign_management` | create, update, list campaigns and ad groups |
| `reporting` | campaign and ad group performance reports |
| `locale_expansion` | recommendations for expanding into new marketplaces |

Most tools are scoped to an account, so a typical exchange starts by listing
profiles and then passing a `profileId` or `advertiserAccountId` onwards.

Amazon's examples of what a single prompt can do:

- *"Show me campaign performance for October on [account_id]"*
- *"Increase my campaign budget to $500 on [campaign_id]"*
- *"Create a Sponsored Products campaign in the US and Canada for [ASIN] with a $20 budget"*
- *"Add UK to [campaign_id] with a £10 budget"*

## Regional endpoints

Picked automatically from the configured marketplace.

| Region | Endpoint | Marketplaces |
| --- | --- | --- |
| NA | `advertising-ai.amazon.com/mcp` | US, CA, MX, BR |
| EU | `advertising-ai-eu.amazon.com/mcp` | UK, DE, FR, IT, ES, NL, SE, PL, TR, AE, SA, EG, IN, ZA, BE, IE |
| FE | `advertising-ai-fe.amazon.com/mcp` | JP, AU, SG |

## Tests

```bash
cd tools && npm test
```

The transport is stubbed, so the suite runs offline and needs no credentials.
It covers regional routing, authorization-URL construction, SSE parsing, and
the headers and session handling Amazon's endpoint requires.

## Notes and gotchas

- **Writes are not dry-run here.** The Seller integration previews writes
  through Amazon's `VALIDATION_PREVIEW` mode; the Ads MCP Server has no
  equivalent, so a budget or campaign change asked for is a change made.
  Confirm the numbers before saying yes.
- **Access tokens last 60 minutes.** `tools/amazon-ads-mcp.js` mints a fresh
  one per session and caches it in `~/.amazon-ads-token.json`, which is why
  the bridge exists rather than a static header in `.mcp.json`.
- **Refresh tokens issued from 30 July 2026 expire 365 days after consent.**
  Re-run `authorize` when calls start failing with LwA errors about a year
  after setup. Tokens issued before that date have no fixed expiry.
- **A 403 usually means step 3 was never completed** — the LwA profile exists
  and the token is valid, but API access was never assigned to it.
- **Beware third-party "Amazon Ads MCP" servers.** Several exist on npm,
  Docker Hub and GitHub, and some ask you to hand your Ads credentials to
  someone else's host. The official endpoints are the `advertising-ai.amazon.com`
  ones above.

## Reference

- [Ads MCP Server overview](https://advertising.amazon.com/API/docs/en-us/mcp/mcp-overview)
- [Connect to the Ads MCP Server](https://advertising.amazon.com/API/docs/en-us/knowledge-hub/hands-on-workshops/amazon-ads-mcp-server/07-connect-ads-mcp-server)
- [Onboarding overview](https://advertising.amazon.com/API/docs/en-us/guides/onboarding/overview)
- [Create an authorization grant](https://advertising.amazon.com/API/docs/en-us/guides/get-started/create-authorization-grant)
- [Generate access and refresh tokens](https://advertising.amazon.com/API/docs/en-us/guides/get-started/retrieve-access-token)
