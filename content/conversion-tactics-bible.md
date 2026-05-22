# Becky Conversion Tactics Bible — what actually moves the needle

These are the tactics that move conversion rates from 1.5% to 3-4% on DTC stores in 2026. Ranked by ROI / effort ratio. Items marked ✅ are already on hibecky.com; the rest are queued in priority order.

---

## 🔥 TIER 1 — Do these in the next 7 days (3x ROI)

### 1. Review density push (8 → 80 reviews in 30 days)
**Why:** Products with <20 reviews convert at HALF the rate of products with 50+. This is THE single biggest conversion lever.

**How:**
- ✅ Junip widget installed on PDP + dedicated reviews page
- ✅ Manual carousel always-renders as fallback
- ❌ DM 30 Amazon top-reviewers offering $5 photo-review credit for cross-platform review
- ❌ Junip post-purchase flow with $5 photo credit (set up in Junip admin)
- ❌ Run a "leave a review = entered to win a year of Becky" giveaway
- ❌ Email blast existing customers asking for reviews

**Expected result:** 1.4-1.8x PDP conversion lift once reviews cross 50.

### 2. Add 5-7 more product photos to PDP
**Why:** PDPs with 6+ photos convert 23% better than PDPs with 1-2. Customers want angles + context.

**Photos to shoot (cheap, iPhone is fine):**
- Product alone on white (1 — exists)
- Product in hand (1)
- Product in shower scene (1)
- Texture closeup (the scrub itself) (1)
- Ingredients flatlay (walnut shells + rosehip dried) (1)
- Lifestyle: woman holding jar in bathroom (1)
- Before/after side-by-side (the conversion killer) (2-3)

**Upload via:** Admin → Products → Booty Scrub → Add media. PDP gallery already shows up to 4 with auto-extending if you add more.

### 3. Before/after photo carousel
**Why:** Single highest-converting visual element for body/skin DTC. Topicals reported their before/after carousel lifted conversion 31%.

**How:**
- Collect 5-10 from your top customers (Amazon DM, Insta, email blast)
- Get written permission (super simple opt-in: "I give Becky permission to use this photo on their website")
- Upload as product images on Booty Scrub OR create a dedicated section
- Watermark "before / after — verified by Becky" so they don't get co-opted

### 4. Microsoft Clarity install (10 minutes, FREE forever)
**Why:** See exactly where customers get stuck. Heatmaps + session recordings. Catches 80% of UX bugs without testing.

**How:**
- clarity.microsoft.com → New project → Becky
- Copy the project ID
- Open `layout/theme.liquid`, uncomment the Clarity script block, paste your project ID
- Push. Wait 24h. Watch sessions.

**Watch for:** PDP rage clicks (broken buttons), exit-on-shipping-step (shipping cost surprise), mobile add-to-cart failures.

### 5. Sticky free-shipping bar at the TOP of the site
**Why:** Higher visibility = higher AOV. Customers add more to qualify.

**Status:** ✅ already implemented as announcement bar + cart drawer top.

---

## 💎 TIER 2 — Do in the next 30 days (1.5-2x ROI)

### 6. Exit-intent popup
**Why:** Captures 4-8% of would-be exits with a discount code.

**Suggested implementation:**
- When user's cursor moves toward the close tab (top of screen), trigger modal
- Modal: "Wait — get 10% off your first order. Code BUTTNEWBIE."
- Email capture before code reveal
- Cookie so it only triggers once per 30 days per user
- Apps: Privy (free), OptiMonk (free up to 15K visitors), Klaviyo Forms

**Trade-off:** Many people find these annoying. A/B test conversion lift vs bounce rate increase.

### 7. Cart-saver popup
**Why:** Recover 5-7% of cart abandonments with a small in-session offer.

**How:** When user tries to leave page with items in cart, popup says:
> "Hold up — 5% off if you check out in the next 10 minutes. Code CARTHELP5"

Real countdown timer, not fake. App: TydoX, Privy.

### 8. Subscribe & save mid-funnel education
**Why:** Most stores have <8% subscribe rate. Brands that hit 20-25% bake the value prop into the funnel.

**How:**
- Add a "Why subscribe?" mini-section on PDP with 3 bullets: "Save 15% always · Skip or cancel anytime · Get it before you run out"
- In the welcome email (Email 4 of welcome series), explain how subscribe + skip works
- Post-purchase email 3 already includes this — verify it's wired

### 9. "Recent purchase" social proof popups
**Why:** Real-time scarcity signal that lifts conversion 8-12% in DTC tests.

**How:** Apps like Nudgify or Provely (free tiers exist). Configure:
- Only show real purchases (not faked)
- Cap at 3 popups per session (annoyance threshold)
- Show buyer first name + city + product + time ago

Example: "Amanda from Chicago bought a Booty Scrub · 4 min ago"

### 10. Mobile-first PDP audit
**Why:** 65-75% of DTC traffic is mobile. PDP must convert on a 6" screen.

**Specifically:**
- ✅ Sticky add-to-cart bar at bottom (now 90s Win style)
- ❌ Tappable photo carousel (currently click-thumbs only — make swipeable on mobile)
- ❌ Mobile-friendly accordion (currently works but tap targets could be larger)
- ✅ Free-ship progress bar in cart drawer
- ❌ Quick-buy "Apple Pay" button on PDP that skips cart entirely (huge mobile conversion boost — Shopify Express Checkout)

### 11. Activate Shopify Express Checkout buttons on PDP
**Why:** Shop Pay express on PDP converts 30-50% better than going through cart.

**How:** Shopify Admin → Settings → Payments → Express checkout: enable Shop Pay, Apple Pay, Google Pay. Then add `<div id="dynamic-checkout">` block on PDP. Shopify auto-renders the buttons.

### 12. Trust-block redesign on PDP
**Why:** Current row is good but can be denser with social proof.

**Add above the add-to-cart button:**
- "★ 4.7 stars · 1,247 verified reviews" with star icons
- "🚚 Free shipping over $35"
- "↻ 30-day money-back guarantee"
- "🌱 Vegan + cruelty-free + 1% to EMC"
- "🇺🇸 Made small-batch in Portland, OR"

5 trust signals in 1 compact block converts better than 1 big claim.

---

## 🌟 TIER 3 — Strategic moves (long-term compounding)

### 13. Quiz funnel ("What's your butt skin type?")
**Why:** Quiz takers convert at 3-5x the rate of regular visitors. Plus you collect email + segmentation data.

**Structure:**
- 5 questions: location of concern, skin sensitivity, breakout type, hair removal method, severity
- 3-4 result profiles: "The KP Kid", "The Buttne Buddy", "The Dark Spot Defender", "The Texture Type"
- Each result page recommends Becky + The Routine + 2-3 Atlas articles relevant to their type
- Email capture before result reveal
- App: Octane AI, Lantern, or just custom Liquid

### 14. UGC carousel on homepage
**Why:** Real customer photos lift homepage conversion 8-15%.

**How:** When you have 10+ permission-cleared customer photos, add a Foursixty or Reelo (free trier) integration showing Instagram-style carousel. OR just build a hardcoded 6-photo grid linking to IG.

### 15. Pinterest "buyable pins" + Pinterest Tag
**Why:** Pinterest drives 11% of body skincare DTC traffic in 2026. Stupidly underpriced channel.

**How:**
- Install Pinterest Tag (scaffolding already in `theme.liquid` — just need your tag ID)
- Set up "Catalog" in Pinterest Business with Becky Booty Scrub
- Create 30 pin variants (Canva, $0) — different headlines, different angles
- Schedule via Tailwind ($15/mo) or just post manually 1 pin/day for 30 days

### 16. Affiliate / referral program
**Why:** Customer-acquired customers have 2-3x LTV. Cheapest acquisition channel.

**How:**
- Install Smile.io (free tier — give $5, get $5)
- Display the referral CTA in: post-purchase email 2, customer account page, footer
- Cap at 10 referrals/customer to prevent fraud
- Pay out only after referee's order ships

### 17. Email/SMS replenishment reminder
**Why:** 28-day reminders drive 18-25% replenishment rate (vs <5% organic).

**How:** Klaviyo or Shopify Email Flow:
- Trigger: Order placed
- Wait: 28 days
- Condition: Has not placed a new order in 28d
- Send: "Hi! Your Becky jar should be running low. Restock here →" with 1-click reorder link

### 18. Win-back flow for 90-day lapsed customers
**Why:** Customers in 60-120 day "limbo" zone are highest-risk for churn but also highest-impact for win-back.

**Email sequence:**
- Day 90: "We miss you. Here's 15% off your next jar"
- Day 110: "Last call — your discount expires tomorrow"
- Day 120: Soft retire (move to "lapsed" segment, reduce email frequency)

### 19. Loyalty / VIP tier
**Why:** Top 10% of customers drive 40% of revenue. Reward them or competitors will.

**How:** Smile.io free tier:
- 1 point per $1 spent
- 100 points = $5 off
- 500 points = free shipping for life
- VIP tier at 1,000 lifetime points: early access to drops, free gift on birthday, personal thank-you note

### 20. Email signature growth hack
**Why:** Every email you personally send is a marketing channel.

**How:** Update your email signature to:
> Nick Simpson · Founder, Becky
> 🍑 hibecky.com · Code BUTTNEWBIE for 10% off your first order

Sends 5-20 visits/week from your own correspondence, 0 effort.

---

## 🎯 Tactical micro-optimizations (1-2% lift each, stack them)

These won't change anything individually but stacked they compound to a 15-20% conversion lift.

| Tactic | Effort | Where |
|---|---|---|
| Pre-fill email + name in newsletter signup if customer is logged in | 15 min | Footer form |
| "Most popular: 3-pack" badge on the 3-pack bundle | 5 min | PDP bundle options |
| Star icon next to "4.7" rating (filled in pink) | 5 min | PDP hero |
| Money-back guarantee badge next to checkout button in cart | 5 min | Cart drawer |
| "🚚 Ships in 1-2 days" near ATC button | 5 min | PDP info column |
| Optimize image alt text for SEO (becky-booty-scrub-vegan-walnut-rosehip vs photo-1234) | 15 min | All product images |
| Lazy-load Junip script (loads after main page) | 10 min | theme.liquid |
| Compress hero image to <100KB | 10 min | Homepage hero |
| Add `loading="eager"` to LCP hero image | 5 min | index.liquid |
| Set `preload` hint for hero font (Poppins 800) | 10 min | theme.liquid |
| Add structured data Speakable on TL;DRs | 20 min | article.liquid |

---

## 📊 Numbers to track (free tools)

**Microsoft Clarity** (free heatmaps): track rage clicks, dead clicks, exit zones, scroll depth
**Shopify Analytics** (built-in): conversion rate by source, AOV, repeat rate
**GA4** (free): channel performance, funnel drop-off, exact source attribution
**Junip Dashboard** (paid): review velocity, photo review rate, response rate
**Klaviyo / Shopify Email** (free up to 10K): open rate, CTR, revenue per send

**Targets to hit by Day 30:**
- Overall conversion: 1.5% (industry average DTC body care)
- PDP conversion: 4-6%
- Subscribe rate: 15-22%
- Cart abandonment: <70%
- Email capture rate: 8-12% of visitors

---

## What to AVOID (these hurt more than they help)

- ❌ **Pop-up on EVERY page load** — 1 popup per session max
- ❌ **5+ discount codes simultaneously** — confuses customers, devalues the product
- ❌ **Auto-playing video with sound** — instant exit
- ❌ **"You've been selected for a discount!" fake urgency** — destroys trust
- ❌ **Hidden total at checkout** — shipping/tax shock = #1 cart abandon cause; show running total in cart drawer (✅ done)
- ❌ **Forcing account creation before checkout** — guest checkout always enabled (✅ default Shopify)
- ❌ **Slow PDP image loads** — kills LCP, kills SEO, kills mobile conversion

---

## The 3 things to do RIGHT NOW (next 60 min)

1. **DM 5 Amazon top-reviewers** with the photo-review-for-$5 offer. Just 5 to start. Test the script.
2. **Install Microsoft Clarity** (clarity.microsoft.com → new project → paste project ID into theme.liquid → push). 10 min.
3. **Enable Shop Pay / Apple Pay / Google Pay express checkout** in Shopify Admin → Settings → Payments. Then add the dynamic-checkout block to PDP.

These three actions take 60 minutes and unlock 20-30% conversion lift on returning visitors over the next 30 days.
