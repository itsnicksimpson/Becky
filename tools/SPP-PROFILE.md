# Solution Provider Profile — draft answers

Working draft for the Amazon Solution Provider Profile (the developer profile
that gates production SP-API access). Amazon asks you to complete every field
"truthfully and accurately" — so **review every line below against how Becky
actually operates and edit it**. These are starting points, not answers to
paste blind.

Keep this file updated. Authorizations expire after 365 days and role changes
mean revisiting the same form.

---

## Data Access

**Select the option that best describes your organization**

Choose the option for a **seller building an application for its own use** —
not the one for developing applications on behalf of other selling partners.
This makes Becky a *private seller application*: self-authorized, no OAuth
flow for third parties, no Amazon Appstore listing, and a narrower review.

**Explain your primary business activity on Amazon and how your business will
utilize Selling Partner API in its operations.**

> Becky is a direct-to-consumer beauty brand. We manufacture and sell our own
> skincare and cosmetics products under our own brand on Amazon. We are not a
> service provider and we do not build software for other sellers.
>
> We are building a private, internal application for our own seller account
> only. It will not be distributed, listed on the Amazon Appstore, or
> authorized by any other selling partner.
>
> Its purpose is to consolidate day-to-day account operations we currently
> perform by hand in Seller Central: monitoring incoming orders, tracking FBA
> inventory to prevent stockouts, reviewing our own listing content and
> pricing, estimating fees to confirm unit margin before a price change, and
> reconciling settlement figures against our internal bookkeeping. Query
> results are surfaced to our staff through an AI assistant interface
> (Anthropic's Claude), disclosed under outside parties below. All data
> retrieved is used solely to operate our own Amazon business.

## Roles

Request these six. Every one maps to a feature that already exists in the
integration, which is what a reviewer wants to see.

| Role | Why |
| --- | --- |
| Inventory and Order Tracking | order flow and FBA inventory levels |
| Amazon Fulfillment | FBA shipment and inventory detail |
| Product Listing | read and update our own listing content |
| Pricing | our prices, competing/buy-box prices, price updates |
| Selling Partner Insights | marketplace participation and account status |
| Finance and Accounting | settlement and fee reconciliation |

**Do not request any Restricted role.** Direct-to-Consumer Shipping, Tax
Invoicing, Tax Remittance and Professional Services all carry buyer PII and
trigger a three-stage business, security and technical review. Nothing in
this integration needs them.

Also skip, unless you have a specific plan for them: Buyer Communication,
Buyer Solicitation, Sustainability Certification, Amazon Logistics, Amazon
Warehousing and Distribution, Brand Analytics, and both Open Banking roles
(AISP/PISP — licensed European payment providers only).

You can apply for more roles later. Requesting only what you will use keeps
the review narrow.

## Use Cases

Paste-ready. Plain text, no markdown — the form field is a plain textarea.

```text
Becky is a direct-to-consumer beauty brand selling our own skincare and
cosmetics products on Amazon. We are building a single private, internal
application for our own seller account only. It will not be distributed to or
authorized by any other selling partner, and will not be listed on the Amazon
Appstore.

The application is a command-line and assistant-driven operations tool used by
our own staff. It consolidates work we currently perform by hand in Seller
Central. Query results are surfaced to our team through an AI assistant
interface (Anthropic's Claude), disclosed under outside parties. All Amazon
Information retrieved is used solely to operate our own Amazon business.

Features by requested role:

Inventory and Order Tracking - Retrieve our own orders on a rolling window to
monitor daily sales volume, order status and fulfillment channel mix, and
retrieve order line items to see which of our SKUs are selling. Combined with
FBA inventory, this drives a stockout early-warning view that flags SKUs whose
fulfillable quantity is low relative to recent sales velocity.

Amazon Fulfillment - Retrieve FBA inventory summaries for our own SKUs:
fulfillable, inbound, reserved and unfulfillable quantities. Used to plan
replenishment and to identify units stranded as unfulfillable.

Product Listing - Retrieve our own listing attributes, offers, fulfillment
availability and listing issues, so we can find and fix listings that are
suppressed or incomplete. Update content on our own listings, such as titles,
bullet points and product attributes. Search the Amazon catalog by keyword,
brand or ASIN to research how comparable products in our categories are titled
and categorized, which informs our own listing content. Every write is first
submitted to the Listings Items API in VALIDATION_PREVIEW mode; the resulting
request and validation outcome are shown to a human operator, who must
explicitly confirm before any change is submitted for real.

Pricing - Retrieve our current listed prices for our own SKUs, and competing
and buy-box prices for ASINs in our categories, to review where our products
sit against comparable listings. Update prices on our own listings under the
same preview-and-confirm control described above. Retrieve fee estimates for a
proposed price so we can confirm unit margin before making a change.

Selling Partner Insights - Retrieve marketplace participation and account
status for our own seller account. Also serves as the connection health check
for the integration.

Finance and Accounting - Retrieve financial event data, including shipment
charges and fee events, for a given period. Used to reconcile Amazon
settlement totals against our internal bookkeeping and to track our effective
fee rate over time.

We also use the Reports API to request and download standard bulk reports
about our own catalog and inventory, such as merchant listings reports, for
the same operational purposes.

The application reads and writes only to our own catalog and our own account,
and never accesses another selling partner's data. We are not requesting any
Restricted role and retrieve no buyer personally identifiable information;
order data is limited to order-level fields and ship-to region. Credentials
are stored outside source control with filesystem permissions restricted to
the operating user, all traffic is TLS, and access tokens are short-lived.
```

## Security Controls

Answer these against reality, not aspiration. See
`tools/INCIDENT-RESPONSE-PLAN.md` for the plan that questions 4 and 5 refer
to — it only counts if you actually adopt and follow it.

| # | Question | Notes |
| --- | --- | --- |
| 1 | Network controls (firewall, IDS/IPS, AV, segmentation) | Answer honestly. OS firewall + endpoint anti-malware is common in a small business; IDS/IPS and network segmentation usually are not. A "No" invites follow-up questions, it is not an automatic rejection. |
| 2 | Access restricted by job duty | Yes if only staff who need the credentials hold them. |
| 3 | Encryption in transit | **Yes.** SP-API is TLS-only and the integration uses HTTPS exclusively. |
| 4 | Incident response plan (roles, 6-month reviews, 24-hour notification) | Yes only once the plan is adopted. |
| 5 | Plan covers reporting to security@amazon.com within 24 hours | Yes only once the plan is adopted — the clause is in it. |
| 6 | Password policy (12+ chars with specials, MFA, 365-day expiry, annual rotation) | Yes once this is written down and enforced. A password manager plus MFA on Seller Central gets you most of the way. |
| 7 | Credentials stored securely, never hard-coded or in public repos | **Yes.** Credentials live in `~/.amazon-seller.json` at mode 600 or in environment variables, never in source. `.gitignore` covers the credential and token-cache filenames. |

**List all outside parties with whom your organization shares Amazon
Information. Describe how your organization shares this information.**

```text
Anthropic PBC (anthropic.com).

Our internal operations tool runs on our own systems and retrieves Amazon
Information directly from the Selling Partner API. Our staff review and act on
that information through Anthropic's Claude assistant, which serves as the
operator interface to the tool. In the course of those sessions, the API
responses the tool retrieves are transmitted to Anthropic's API for processing
so that Claude can present and summarize them for our team.

The Amazon Information involved is limited to: order-level data excluding
buyer personally identifiable information (order ID, date, status,
fulfillment channel, item totals, ship-to region), FBA inventory quantities,
our own listing content and attributes, our own and publicly visible
competitor pricing, fee estimates, and aggregate settlement and fee totals. We
hold no Restricted roles and therefore retrieve no buyer personal information.

The information is shared only for the purpose of operating our own Amazon
business. It is not sold, published, licensed, or used for advertising,
resale, or any purpose unrelated to managing our own seller account. No other
outside party receives Amazon Information from us.
```

Before submitting, add anyone else who genuinely sees this data and how:

- Accountant or bookkeeper — if you send them settlement or fee figures.
- Third-party logistics or prep centre — if they see order or inventory data.
- Any agency, contractor, or freelancer with Seller Central access.
- Any connected app: Shopify/Amazon sync tools, repricers, analytics
  dashboards, inventory planners.

Each one needs the name and the mechanism (what data, how it reaches them).
Omissions here are the kind of thing that becomes a Data Protection Policy
problem later, and Amazon can ask for this list again at any time.

**List all external (non-Amazon) sources where your organization retrieves
Amazon Information.**

```text
None. All Amazon Information is retrieved directly from Amazon, through the
Selling Partner API and Seller Central. We do not obtain Amazon Information
from data aggregators, scrapers, browser extensions, or any other third-party
source.
```

Only submit that if it is true. List them here if you use Helium 10, Jungle
Scout, Keepa, DataHawk, SellerAmp, or similar — they are external sources of
Amazon Information and this question is asking about exactly that.
