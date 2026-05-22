# Klaviyo Abandoned Cart Flow — 3 emails over 36 hours

**Trigger:** Checkout Started event (Klaviyo native integration with Shopify)
**Goal:** Recover 8-15% of abandoned checkouts (industry: $15-30 LTV per recovered cart)
**Profile filter:** Has not placed an order since checkout started

---

## Email 1 — 30 minutes after cart abandon
**Subject:** Wait, you forgot something 🍑
**Preview text:** Your Booty Scrub is sitting in your cart

```
Hi {{ first_name|default:'there' }},

You left a Booty Scrub in your cart.

We don't judge — we get distracted by Instagram too. But just in case it was an accident:

[ Finish your order — {{ event.value|currency }} → ]

Quick reminders:
→ Free shipping over $35
→ 30-day money-back if you hate it
→ Lasts 2-3 months at 3x/week

If you decided not to — totally fine. Reply and tell us why. We read every email.

xo,
Becky

----
Becky · hibecky.com · Unsubscribe
```

---

## Email 2 — 24 hours after cart abandon
**Subject:** {{ first_name|default:'Hey' }}, here's what 1,247 reviews say
**Preview text:** 4.7 stars from real people with real butts

```
Hi {{ first_name|default:'friend' }},

You're still thinking about it. We get it — $20 isn't a tiny purchase if it's not going to work.

So here's what {{ '1247' }} reviewers said:

★★★★★ "Changed. My. LIFE." — Amanda, verified buyer
"I had a ton of dark marks on my butt due to a bad bout of dermatitis. I tried the anese that booty tho but I couldn't justify the price. Switched to Becky and it's even better than the anese!"

★★★★★ "The best booty scrub ever!" — Tabitha
"I never run out of this stuff! Makes the cheeks so soft and wards off 'buttne.'"

★★★★★ "Worked very well for me" — Sarah
"I'd always been embarrassed about my booty. Now after a few weeks, almost all the weird booty marks are gone and it is smoother than ever."

[ Read all 1,247 reviews → ]
[ Add to cart — {{ event.value|currency }} → ]

If it doesn't work in 30 days, money back. No questions.

xo,
Becky
```

---

## Email 3 — 36 hours after cart abandon (final)
**Subject:** Final reminder + 10% off your cart
**Preview text:** Code COMEBACK10 — expires tonight

```
Hi {{ first_name|default:'friend' }},

Last email about this. Promise.

Your cart's about to expire and we're going to make it easy:

[ Use code COMEBACK10 for 10% off → ]

That makes the Booty Scrub $18. Plus free shipping over $35. Plus 30-day money-back.

Hit the button or hit unsubscribe. Either way we appreciate you.

xo,
Becky

[ Complete checkout → ]
```

---

## Klaviyo setup

1. Flows → Create → "Abandoned Cart" template
2. Trigger: Checkout Started
3. Add 3 emails with the subjects/bodies above
4. Set delays: 30 min, 24h, 36h
5. Profile filter (all emails): "Placed Order zero times since trigger"
6. Smart Sending: ON
7. Set status: LIVE

**Variable mapping:**
- `{{ event.value|currency }}` — total cart value
- `{{ event.checkout_url }}` — link them back to the abandoned cart (paste this in CTA button URLs)
- `{{ first_name|default:'friend' }}` — Klaviyo first_name property

**Optional:** add SMS step at 4h mark for SMS subscribers — recover an extra 5-7%.
