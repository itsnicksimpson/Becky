# Shopify Email + Shopify Flow — automation pack

**Why this not Klaviyo:** Free with Shopify (10K emails/mo), no integration tax, lives where your data lives, segments from Shopify customer fields directly. Klaviyo is better for advanced segmentation but you don't need that yet — get Shopify Email running, then layer Klaviyo later if/when volume justifies it.

**Where to set up:**
- **Shopify Email** for actual emails: Shopify Admin → Marketing → Create campaign / Create automation
- **Shopify Flow** for the trigger logic (free app): Apps → Shopify Flow (install if you don't have it)

---

## Automation 1: Welcome series (5 emails, 14 days)

**Setup path:** Shopify Admin → Marketing → Automations → Create automation → Template: "Customer joined a list" → Choose Newsletter list

For multi-email series, you'll create FIVE separate automations (each triggered by a delay) OR use one Shopify Flow with "Wait" steps between sends. The Flow approach is cleaner.

### Flow build (do this once)

1. Apps → Shopify Flow → Create workflow
2. Trigger: "Customer added to email list"
3. Condition: List = Newsletter
4. Action: Send email → Email 1 (Welcome)
5. Wait → 2 days
6. Action: Send email → Email 2 (Routine)
7. Wait → 3 days
8. Action: Send email → Email 3 (Differential diagnosis)
9. Wait → 4 days
10. Action: Send email → Email 4 (Hyperpigmentation)
11. Wait → 5 days
12. Action: Send email → Email 5 (Final discount push)

### The 5 emails

Copy these subject lines and bodies into Shopify Email templates (Marketing → Email → Create template). Save each, then reference in the Flow steps above.

**Email 1 — "Hi, we're Becky. Welcome to your booty's new routine 💛"**
*Preview:* Real talk + 10% off your first order

```
Hi {{ customer.first_name | default: 'friend' }},

Welcome. You just signed up for emails from a brand whose entire reason for existing is the skin between your hip and your knee. So, expect:

→ Real talk (no influencer voice)
→ Real ingredients (walnut shell, rosehip, jojoba)
→ Real before-and-afters (yours and ours)

As a thank-you:
[ 10% off your first order with code BUTTNEWBIE ]

Tomorrow we'll send you The Routine — 3 steps, 4 weeks, smooth confident skin.

xo,
The Becky team

P.S. 1% of every order goes to Every Mother Counts.
```

**Email 2 — "The 3-step Becky Routine (4 minutes, 3x a week)"**
Body: [paste full Routine email from `content/klaviyo-flows/01-welcome-series.md` — Email 2]

**Email 3 — "Buttne vs Folliculitis vs KP: how to tell what's actually on your butt"**
Body: [Email 3 from welcome series file]

**Email 4 — "Why is my butt darker than the rest of my body?"**
Body: [Email 4 from welcome series file]

**Email 5 — "{{ customer.first_name }} — last chance on your 10% off"**
Body: [Email 5 from welcome series file]

All 5 email bodies are already written out in `content/klaviyo-flows/01-welcome-series.md` — just paste them into Shopify Email templates, swap `{{ first_name|default:'friend' }}` for Shopify's `{{ customer.first_name | default: 'friend' }}` syntax.

---

## Automation 2: Abandoned checkout (3 emails)

Shopify has native abandoned-checkout email support built in.

**Setup path:** Shopify Admin → Marketing → Automations → Templates → "Abandoned checkout"

Enable it, customize:
- Email 1 sends after 1 hour (subject: "Wait, you forgot something 🍑")
- For Email 2 (24h) and Email 3 (36h), use Shopify Flow:
  - Trigger: Checkout Started
  - Wait 24h
  - Condition: Order placed since checkout = false
  - Send email 2
  - Wait 12h
  - Condition: Order placed since checkout = false
  - Send email 3 (with code COMEBACK10 for 10% off)

Email bodies: `content/klaviyo-flows/02-abandoned-cart.md` — paste verbatim into Shopify Email templates.

---

## Automation 3: Post-purchase (3 emails)

**Setup path:** Apps → Shopify Flow → Create workflow

1. Trigger: Order created
2. Condition: Customer has more than 0 orders
3. Wait 1 hour
4. Action: Send email → Email 1 (Thanks + how to use)
5. Wait 14 days
6. Condition: Customer has not left review (check via Junip tag if available)
7. Send email → Email 2 (Review request)
8. Wait 14 days
9. Condition: Has not placed second order
10. Send email → Email 3 (Restock + subscribe & save)

Email bodies: `content/klaviyo-flows/03-post-purchase.md`.

---

## Automation 4: Review request via Junip

Junip handles this NATIVELY — no Shopify Email/Flow needed. Set up in Junip:

1. Junip admin → Flows → Post-purchase review request
2. Send at 14 days after delivery (not order — wait for actual arrival)
3. Offer photo review = $5 store credit (Junip integrates with Shopify Discount API)
4. Auto-tag photo reviewers as `vip-reviewer` for re-engagement

---

## Audience segments to create in Shopify

Marketing → Audiences → Create audience:

1. **First-time buyers** — Has 1 order
2. **Repeat buyers** — Has 2+ orders
3. **Subscribers** — Has subscribe-and-save plan (filter: Selling plan ID present)
4. **Lapsed** — Last order > 90 days ago, no subscription
5. **VIP** — Has 3+ orders OR LTV > $100
6. **Newsletter only** — In Newsletter list, no orders
7. **Cart abandoners** — Checkout started in last 7 days, no order
8. **Atlas readers** — Tag: `engaged-blog` (we'd need to add this via Klaviyo-style pixel events; skip for now)

---

## Monthly campaigns calendar

Send 2 campaigns per month from Shopify Email (free up to 10K emails/mo). Schedule:

| Week | Send | Audience |
|---|---|---|
| Week 1 | New article from Booty Atlas | All subscribers |
| Week 2 | Education email (myth-buster, ingredient deep-dive) | All subscribers |
| Week 3 | UGC roundup ("real reviews this month") | All subscribers |
| Week 4 | Promo / restock / seasonal | All subscribers |

**Seasonal pushes (do these on top):**
- March–April: Swimsuit Prep 4-Week Countdown campaign
- May: Summer routine + travel kit
- November: Black Friday (15% sitewide for 5 days)
- December: Holiday gifting (Becky as a $20 stocking stuffer)

---

## Compliance baseline

- Every email has unsubscribe link (Shopify Email auto-adds)
- Welcome email confirms double opt-in (Shopify list setting)
- Physical address in footer (legal req — Becky office address)
- Don't email people who unsubscribed (Shopify auto-suppresses)

---

## Cost comparison

| Solution | Free tier | After free | Setup time |
|---|---|---|---|
| Shopify Email + Flow | 10K emails/mo free | $1 per 1K | 2 hours |
| Klaviyo | 500 contacts / 500 sends free | $20+/mo at 1K contacts | 4-6 hours |

Recommendation: Shopify Email through your first 5K subscribers (~Year 1). Switch to Klaviyo at the point you need: predictive analytics, advanced segmentation, SMS at scale, or A/B test on flow steps.

---

## Implementation checklist for tomorrow

- [ ] Install Shopify Flow (free, Apps)
- [ ] Create Welcome list (Audiences → New list → name "Newsletter")
- [ ] Create discount codes: BUTTNEWBIE (10% off, single-use, 30-day expiry), COMEBACK10 (10% off, single-use, 7-day expiry)
- [ ] Build Welcome flow (steps above) using email bodies from `01-welcome-series.md`
- [ ] Enable native Abandoned Checkout email; build 24h + 36h additions via Flow
- [ ] Build Post-Purchase flow using `03-post-purchase.md`
- [ ] Wire homepage newsletter form to Newsletter list (Shopify form already does this if list is the default — verify)
- [ ] Send test emails to yourself; check rendering on mobile + Gmail/iOS Mail
- [ ] Activate all flows
