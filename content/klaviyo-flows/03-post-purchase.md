# Klaviyo Post-Purchase Flow — 3 emails over 28 days

**Trigger:** Order Placed event (Klaviyo native)
**Goal:** Maximize first 30 days — set expectations, gather reviews, drive repeat purchase

---

## Email 1 — 1 hour after order
**Subject:** Your Booty Scrub is on the way 🍑 + how to use it
**Preview text:** Quick tips for the best first session

```
Hi {{ first_name|default:'there' }},

Thank you. Your Booty Scrub ships in 1-2 business days.

While you wait, the 4-step protocol for your first session:

1. Shower as usual. Skin should be damp, not dry.
2. Squeeze a quarter-sized scoop into your palm.
3. Massage onto butt, thighs, anywhere bumpy. Circles, 60 seconds.
4. Rinse. Pat dry. Moisturize (CeraVe SA Cream is our pick).

Use 3x a week. Not daily — your skin needs recovery time.

What to expect:
→ Week 1: Skin feels smoother immediately
→ Week 2-3: Active buttne starts to calm
→ Week 4: Dark spots visibly faded
→ Week 6+: Cumulative results — even tone, soft skin

[ Read the full Routine → ]

Questions? Reply to this email. We read every one.

xo,
Becky
```

---

## Email 2 — 14 days after order
**Subject:** How's your booty?
**Preview text:** We want to hear about your first 2 weeks

```
Hi {{ first_name|default:'friend' }},

You've had the Becky Booty Scrub for 2 weeks. By now you should be noticing:
→ Smoother skin
→ Less active buttne
→ Maybe some dark spots starting to fade

If you're loving it — we'd LOVE if you left a quick review. It helps other people decide.

[ Leave a review (60 seconds) → ]

Bonus: if you submit a photo review (yes, of your butt — clothed or not, your call), we'll send you a $5 credit on your next order.

If it's not working for you yet — reply and tell us what you're seeing. We've helped a lot of people troubleshoot, and 9 times out of 10 it's a tweak away from working.

xo,
Becky

[ Subscribe + save 15% → ]
```

---

## Email 3 — 28 days after order
**Subject:** Time to restock — and a 15% subscribe-and-save offer
**Preview text:** Your jar is almost out. Don't let your skin slip back.

```
Hi {{ first_name|default:'friend' }},

You're at the 4-week mark. Your jar is probably running low (one jar = ~12 sessions).

Here's the thing about exfoliation: consistency is the entire game. If you stop now, the buttne and KP come right back within 2-3 weeks.

Two options:

OPTION 1: One-time reorder ($20, free shipping)
[ Reorder the Scrub → ]

OPTION 2: Subscribe and save 15% — billed every 6 weeks (matches your use cadence)
That's $17/jar. Skip or cancel anytime.
[ Subscribe and save → ]

xo,
Becky

P.S. If you're still on your first jar at 4 weeks, you're probably under-using. Up to 3x a week. The skin between your hip and your knee is thicker than face skin — it can handle it.
```

---

## Klaviyo setup

1. Flows → Create → "Post-Purchase" template
2. Trigger: Order Placed
3. Add 3 emails with subjects/bodies above
4. Delays: 1h, 14d, 28d
5. Profile filter Email 2: "Has Junip review = false" (only ask non-reviewers)
6. Profile filter Email 3: "Last Order Placed > 21 days ago"
7. Smart Sending: ON
8. Set status: LIVE

**Variable mapping:**
- `{{ first_name|default:'friend' }}` — Klaviyo first_name property
- `{{ event.order_number }}` — for "Your order #XXXX" references if you want them

**Optional add-on:** Email 4 at 60d for second restock if no reorder happened by then.
