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

> A private internal operations tool for our own seller account, used by our
> own staff. No functionality is offered to third parties.
>
> - **Inventory and Order Tracking** — read our order flow and FBA inventory
>   levels to monitor daily sales and flag SKUs at risk of stocking out.
> - **Amazon Fulfillment** — read FBA shipment and inventory detail to plan
>   replenishment.
> - **Product Listing** — read our own listing attributes and listing issues,
>   and update our own listing content. Every write is validated through the
>   Listings Items API in VALIDATION_PREVIEW mode and requires explicit
>   operator confirmation before submission.
> - **Pricing** — read our current prices and competing/buy-box prices, and
>   update prices on our own listings, under the same confirmation control.
> - **Selling Partner Insights** — read marketplace participation and account
>   status.
> - **Finance and Accounting** — read settlement and fee events to reconcile
>   Amazon payouts against our internal bookkeeping.
>
> The application reads and writes only to our own catalog and never accesses
> another selling partner's data.

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
Information.**

> Anthropic PBC (anthropic.com) — our internal tool surfaces SP-API query
> results through Anthropic's Claude assistant, which our staff use to review
> and act on the data. Amazon Information retrieved by the application (order
> summaries excluding buyer PII, inventory levels, our own listing and pricing
> data, and settlement totals) is transmitted to Anthropic's API for
> processing during those sessions. We hold no Restricted roles and therefore
> retrieve no buyer personal information.
>
> No Amazon Information is shared with any other outside party. None is sold,
> published, or used for any purpose other than operating our own Amazon
> business.

Add anyone else who genuinely sees this data — accountant or bookkeeper, 3PL,
any Shopify/Amazon sync app, any agency. Omissions here are the kind of thing
that turns into a policy problem later.

**List all external (non-Amazon) sources where your organization retrieves
Amazon Information.**

> None. All Amazon Information is retrieved directly from Amazon through the
> Selling Partner API and Seller Central. We do not obtain Amazon Information
> from data aggregators, scrapers, or other third-party sources.

Only true if you don't use Helium 10, Jungle Scout, Keepa, or similar. List
them if you do.
