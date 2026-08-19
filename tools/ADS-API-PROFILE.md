# Amazon Ads API — access application

The Amazon Ads API is **separate from SP-API**: different portals, different
approval, different credentials. This records what was submitted and what the
onboarding sequence is, since it has to be repeated at renewal or if access
is ever re-requested.

Nothing in `tools/` uses the Ads API yet — this is the paperwork trail ahead
of building `tools/amazon-ads.js`.

---

## How it differs from SP-API

| | SP-API | Ads API |
| --- | --- | --- |
| Portal | Solution Provider Portal | developer.amazon.com + Amazon Ads console |
| Endpoint | `sellingpartnerapi-na.amazon.com` | `advertising-api.amazon.com` |
| Approval | Weeks (identity + role review) | Quoted at up to 72 hours |
| Extra credential | — | **Profile ID**, one per ad account per marketplace |

Auth is Login with Amazon on both sides, but the security profiles are
separate — the SP-API client ID does not work here.

## Onboarding sequence

1. **Amazon Ads account must exist.** The "Request API access" link bounces to
   registration until you are signed in with one attached. Sellers who have
   ever run a Sponsored Products campaign already have one — check Seller
   Central → Advertising → Campaign Manager before registering, or you end up
   with two ad accounts.
2. **LWA security profile** at developer.amazon.com → Login with Amazon →
   Create a New Security Profile. Yields a client ID and secret.
3. **Apply for API access** — the form recorded below.
4. **Link the security profile** to the approved application. This is what
   joins the two portals and produces working credentials.

### Two things that sink applications

- **Stay signed in as the same Amazon user for every step.** The most commonly
  reported failure is completing the link/assign step under a different
  Amazon account than the one that submitted the form.
- **The company name must match an active advertiser account tied to that
  email.** Rejections are frequently just Amazon failing to find a matching
  advertiser account — use the exact name on the Amazon Ads account.

## What was submitted

**Relationship:** Amazon seller and plan to use Amazon Ads API for my own
business.

Not *vendor* (1P Vendor Central), not *agency*, not *developer/solution
provider* — those imply acting for others and trigger a longer review.

**Scopes:** Advertising only. **Data provider was deliberately left
unchecked** — it is for publishing audience segments to other advertisers,
Amazon flags it as advanced-users-only with a longer review, and nothing here
needs it. Same reasoning as skipping the restricted SP-API roles.

### What specific solution(s) do you plan to build

```text
An internal operations tool for our own Amazon seller account. Becky is a
direct-to-consumer beauty brand; we sell our own skincare and cosmetics
products and advertise only our own ASINs. The tool is not distributed,
licensed, or offered to any third party.

It extends an existing internal integration we already run against the Selling
Partner API for orders, FBA inventory, listings and settlement data. Adding
the Ads API lets us see advertising cost alongside unit economics in one
place — specifically whether a SKU's ad spend is profitable after Amazon
referral and fulfillment fees, which today means manually reconciling two
separate reports.

Query results are surfaced to our internal staff through an AI assistant
interface (Anthropic's Claude) used as the operator front end. All data is
used solely to operate our own advertising.
```

### Which advertising processes are you aiming to automate

```text
- Performance reporting: pull campaign, ad group, keyword and search-term
  metrics on a schedule instead of exporting reports by hand.
- Profitability analysis: join ad spend and ACoS against our own fee and
  settlement data from SP-API to compute true net margin per SKU.
- Budget and bid monitoring: flag campaigns pacing over or under budget, and
  keywords whose ACoS has drifted past our target.
- Stockout protection: cross-check advertised ASINs against FBA inventory so
  we can pause spend on SKUs that are out of stock — a problem we have hit.
- Campaign adjustments: budget and bid changes on our own campaigns, applied
  by a human operator after reviewing a previewed change.
```

## Once approved

Collect the client ID, client secret, refresh token, and **Profile ID** for
each advertising account. The Profile ID is the piece SP-API has no equivalent
of and identifies which ad account a call targets — one per marketplace, so a
US and CA advertiser has two.

Consistent with the seller tooling, anything that changes spend (budgets,
bids, campaign state) should stay dry-run by default and require explicit
confirmation.
