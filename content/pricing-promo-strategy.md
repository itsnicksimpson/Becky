# Becky pricing + promo strategy — sales tomorrow without paid ads

**Goal:** Convert organic traffic at +25-40% lift via pricing architecture and triggered promos, without devaluing the brand.

---

## Core pricing thesis

**$20 base, never discount the base.** Discounting the price on a single-SKU brand teaches customers to wait for sales. Instead: layer VALUE via bundles, subscriptions, and threshold rewards.

The architecture:

| Offer | Price/customer | What customer gets | Why we do it |
|---|---|---|---|
| One-time | $20 | 1 jar, ships free over $35 | Acquire (AOV = $20) |
| Subscribe & save | $17 (15% off) | 1 jar every 6 weeks, free ship, cancel anytime | Convert one-time → recurring (LTV 3-5x) |
| Bundle (2 jars) | $36 ($18/jar) | 2 jars, free ship, gifting angle | Lift AOV +80% (most popular) |
| Bundle (3 jars) | $51 ($17/jar) | 3 jars, free ship, "stock up" framing | Lift AOV +155% |
| First-order discount | $18 (10% with BUTTNEWBIE) | 1 jar, used once per new email | New customer acquisition |
| Cart-abandon recovery | $18 (10% with COMEBACK10) | 1 jar, used once | Recover lost demand |

**Never discount past 15% off on subscriptions, 10% off on one-time.** Beyond that you train customers to wait.

---

## Promos to set up in Shopify TODAY

### Discount codes (Shopify Admin → Discounts → Create)

1. **BUTTNEWBIE** — 10% off, code, customer eligibility "First-time customer," usage limit 1 per customer, expires 30 days, applies to entire order. Use in welcome email + homepage popup.

2. **COMEBACK10** — 10% off, code, customer eligibility all, usage limit 1 per customer, expires 7 days from issuance, applies to entire order. Use in abandoned cart email 3.

3. **FREESHIP** — Free shipping, code, no minimum, usage limit none, expires never. Use as occasional "delight" surprise to existing customers.

4. **BUNDLE15** — 15% off, automatic discount, condition "Quantity in cart ≥ 2," applies to entire order. Pushes 2-pack purchase.

5. **BUNDLE20** — 20% off, automatic discount, condition "Quantity in cart ≥ 3," applies to entire order. Pushes 3-pack purchase.

6. **VIP25** — 25% off, code, customer eligibility "Customer tag = vip-reviewer." Use as photo-review reward.

### Free-gift threshold

Set up via free Shopify Functions or app (Bold Free Gifts, Gift Box):

- **Free Becky drawstring pouch with orders $40+** — costs ~$1.50 to fulfill, drives $20 AOV → $40 AOV (the doubling decision)
- **Free Becky shower hook gift with 3-pack** — costs ~$0.80, increases bundle perception

If you don't have stock for these, do digital gifts:
- **"The Becky Routine PDF" emailed free with first order** — costs $0, perceived value $$
- **Free 4-Week Buttne Plan emailed at order $35+**

### Cart-level urgency

In the slide-in cart (already implemented), the "Add $X for free shipping" message is the #1 AOV lever for Shopify stores. Already wired into your theme.

Add these next:
- "Subscribe & save 15% — same price as a 6-pack" toggle right above checkout button
- "💛 1% of this order goes to EMC" line above subtotal (purchase-meaning signal)

---

## Bundle products to create

Create as additional Shopify product variants (or separate products) so customers can buy them in 1 click rather than adding 2 jars manually.

**Setup:** Shopify Admin → Products → Add product

1. **The 2-pack — "The Routine Starter"** ($36, save $4)
   - Description: "Two jars of Becky Booty Scrub. Lasts 6-8 weeks at 3x/week use. Ships free."
   - One variant = 2 units bundled, ships as 2 jars

2. **The 3-pack — "The Restock"** ($51, save $9)
   - Description: "Three jars of Becky. The smart way to commit to your routine."

3. **The Subscription** ($17/6 weeks)
   - Use Shopify Subscriptions (free app) — wires into PDP as a radio option (already implemented in product.liquid)

4. **Bundle: Gift Set "The Apology Gift"** ($35)
   - Booty Scrub + a free Becky branded shower hook + free The Routine PDF
   - Framing: "For the friend who keeps asking you about her butt skin."

---

## Promo calendar (next 90 days)

| Date | Promo | Channel | Goal |
|---|---|---|---|
| Day 1 (today) | Launch BUTTNEWBIE | Newsletter + homepage popup | Convert traffic from refreshed site |
| Day 7 | "Mid-month restock" — 5% off subscription only | Email to non-subs | Push first one-time → sub conversion |
| Day 14 | "First 100 reviewers get $5 credit" (via Junip) | Post-purchase + IG story | Build reviews pipeline (critical for AEO) |
| Day 21 | The 2-pack "Buy with a friend, save together" | IG/TikTok push | Activate BUNDLE15 automatic discount |
| Day 30 | Black Friday teaser (if applicable to season) | Email | List-build for BF |
| Day 45 | Atlas-content-driven promo (e.g., "Swimsuit prep season is here") | Email + retargeting | Seasonal hook |
| Day 60 | Referral program launch — give $5, get $5 | Email + post-purchase | Build customer-acquisition flywheel |
| Day 90 | Customer-of-the-month feature (1 review + UGC, $50 credit) | Email + IG | Reward loyalty + harvest UGC |

**Don't do sitewide sales for at least 9 months.** $20 is already affordable. Sitewide % off devalues. Use bundles, gifts-with-purchase, and subscription savings instead.

---

## Referral program (set up Day 30)

Use Smile.io or Yotpo Referrals (both have free Shopify apps).

- Give $5 store credit, get $5 store credit on friend's first $20+ order
- Referrer's reward issued only after friend's order ships (anti-fraud)
- Limit 10 referrals per customer (rate-limit gaming)
- Display referral link in:
  - Order confirmation email
  - Post-purchase email 2 (review request) — "Love it? Share it: [link]"
  - Customer account page
  - Footer

Realistic numbers: 4-7% of customers will share, 25-35% of shared links convert at $20 AOV → $1-3 LTV add per customer. At 10,000 customers/year, this is a $10K-30K incremental revenue lever with $0 paid spend.

---

## "Surprise & delight" tactical wins

These cost almost nothing and turn happy customers into evangelists:

1. **Handwritten thank-you card with first order** (5 seconds + a Sharpie + 1 stamp = $0.50) — replies on IG/Twitter unbelievably high
2. **Birthday $5 credit** — Klaviyo or Shopify Flow can fire this; needs you collecting DOB at signup
3. **Random "we just thought you should know" emails** — surprise gift, no purchase required, 1-2x year, segment to top 10% LTV
4. **Refunds with no questions** for the first 30 days — the actual policy already states this. Lean into it in marketing.

---

## What NOT to do

- ❌ Sitewide 20% off sales (devalues, trains discount-shopping)
- ❌ Daily-deal sites / Groupon (race to bottom, attracts non-loyal customers)
- ❌ Free shipping with no minimum (kills margin)
- ❌ "BOGO" (buy one get one free) — implies your product is worth half-price
- ❌ Hidden subscription cancellation flows — be 1-click cancellable always
- ❌ Email-blast spammy frequency (max 2x/week to subscribers)

---

## The 90-day pricing/promo north stars

| Metric | Day 0 | Day 90 target |
|---|---|---|
| AOV | $20 (single jar) | $28-32 (lift via bundles) |
| Subscription rate (% of new customers) | 0% | 15-22% |
| Repeat purchase rate (60d) | unknown | 18-25% |
| Referral-acquired customers (%) | 0% | 8-12% |
| Free-shipping threshold hit rate | unknown | 55-65% |
| Average customer LTV (90d) | $20 | $42-58 |
