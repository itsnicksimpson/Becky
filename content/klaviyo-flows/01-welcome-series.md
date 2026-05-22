# Klaviyo Welcome Series — 5 emails over 14 days

**Trigger:** New subscriber added to "Newsletter" list (from homepage CTA or quiz)
**Goal:** First-purchase conversion + brand education + Atlas content discovery

---

## Email 1 — Day 0, sends immediately
**Subject:** Hi, we're Becky. Welcome to your booty's new routine 💛
**Preview text:** Real talk + 10% off your first order

```
Hi {{ first_name|default:'friend' }},

Welcome. You just signed up for emails from a brand whose entire reason for existing is the skin between your hip and your knee. So, expect:

→ Real talk (no influencer voice)
→ Real ingredients (walnut shell, rosehip, jojoba — no microbeads, no mystery)
→ Real before-and-afters (yours and ours)

We started Becky because the skin back there breaks out, gets bumpy, gets darker, and gets ignored — by skincare brands and by every conversation about skincare. We made one product on purpose. We did it well.

As a thank-you for being here:

[ 10% off your first order with code BUTTNEWBIE ]

(Use it on the $20 Booty Scrub or save it for the Routine when we expand the line. Your call.)

Tomorrow we'll send you The Routine — the 3-step protocol that takes 4 weeks to give you smooth, even, confident skin.

xo,
The Becky team

P.S. 1% of every order goes to Every Mother Counts. Smoother skin + safer pregnancies. Both matter.

----
Becky | The Booty Brand
hibecky.com · @hibecky
Unsubscribe
```

---

## Email 2 — Day 2
**Subject:** The 3-step Becky Routine (only takes 4 minutes)
**Preview text:** It's not complicated. We promise.

```
Hi {{ first_name|default:'friend' }},

We're going to teach you The Routine.

It takes 4 minutes, three times a week. After 4 weeks, the skin between your hip and your knee will feel smoother than it has in years.

The Routine, in 3 steps:

1. EXFOLIATE (3x a week, in the shower)
The Becky Booty Scrub. Walnut shell powder = mechanical exfoliation. Rosehip oil = vitamin C for dark spots. Use on damp skin in the shower, massage in circles for 60 seconds, rinse.

2. ACID (2x a week, after shower)
A leave-on chemical exfoliant. Salicylic acid for buttne (oil-soluble, gets into pores). Glycolic acid for KP, ingrowns, dark spots. The Inkey List PHA pads are our favorite affordable pick.

3. MOISTURIZE (every night)
A simple body lotion with ceramides and niacinamide. CeraVe SA Cream is the dermatologist standard.

That's it. Three products. Three days a week max. Four weeks to results.

[ Read the full Routine guide → ]
[ Shop the Scrub ($20) → ]

Tomorrow we'll send you the Booty Atlas — the most-asked-questions library on butt skin, written by people who think about it for a living.

xo,
Becky

----
Becky · hibecky.com · Unsubscribe
```

---

## Email 3 — Day 5
**Subject:** Buttne vs Folliculitis vs KP: how to tell what's actually on your butt
**Preview text:** Spoiler: most "butt acne" isn't acne

```
Hi {{ first_name|default:'friend' }},

Here's the thing about the skin on your butt:

Most "butt acne" isn't acne. It's folliculitis (inflamed hair follicles, often bacterial) or keratosis pilaris (KP — keratin buildup around hair follicles). They look similar, but they're different conditions with different fixes.

This matters because treating folliculitis with regular acne stuff (benzoyl peroxide) often makes it worse. And treating KP with salicylic acid alone won't get you there — you need glycolic acid or urea.

We wrote a 1,800-word guide that walks you through:
→ The 3 conditions side by side (with what causes each)
→ The differential diagnosis (here's how to tell which one you have)
→ The treatment protocol for each
→ When to see a dermatologist

[ Read: Buttne vs. Folliculitis vs. KP → ]

It's the most-read post on hibecky.com for a reason. Spread it.

Tomorrow's email: dark spots, ingrowns, and the question we get asked the most (no, it's not weird).

xo,
Becky

----
Becky · hibecky.com · Unsubscribe
```

---

## Email 4 — Day 9
**Subject:** Why is my butt darker than the rest of my body?
**Preview text:** It's not weird. It's normal. And it's fixable.

```
Hi {{ first_name|default:'friend' }},

This is the question we get asked the most.

It comes in as DMs, as "anonymous question" submissions, as Reddit posts, as 2 a.m. Googles. People are embarrassed to ask. They shouldn't be — it's the most common condition on butt skin after KP.

Hyperpigmentation on the butt happens because of:
1. Friction (jeans, sitting all day, working out)
2. Old breakouts (post-inflammatory hyperpigmentation from buttne)
3. Hormonal shifts (pregnancy, birth control)
4. Sun exposure (yes, even there, for the people who get it)

The good news: it's super fixable. Slow — 8 to 12 weeks of consistent routine — but fixable.

The protocol:
→ Walnut + rosehip exfoliation 3x/week (Becky scrub)
→ Vitamin C body serum 1x/day
→ Niacinamide-heavy body moisturizer
→ SPF (yes, even back there, if you tan there)

[ Read: Why Is My Butt Darker? → ]
[ Anal Hyperpigmentation: The Honest Guide → ]
[ Shop the Scrub ($20) → ]

If you've never asked anyone about this — you're not alone. Most of our customers haven't either.

xo,
Becky

----
Becky · hibecky.com · Unsubscribe
```

---

## Email 5 — Day 14 — Cart abandon recovery / final push
**Subject:** {{ first_name|default:'Hey' }} — last chance on your 10% off
**Preview text:** Code BUTTNEWBIE expires tonight

```
Hi {{ first_name|default:'friend' }},

Quick reminder — your 10% off code BUTTNEWBIE expires tonight.

If you're still on the fence, here's the truth:

→ The Booty Scrub is $20. Most "butt facial" creams are $35-50.
→ One jar lasts 2-3 months at 3x/week use.
→ Free shipping over $35.
→ 30-day money-back if you hate it.

You've read the Routine, you know the science, you've seen the before-afters. There's no reason to wait.

[ Use BUTTNEWBIE for 10% off → ]

Or unsubscribe. We'll miss you, but we get it.

xo,
Becky

----
Becky · hibecky.com · Unsubscribe
```

---

## How to set this up in Klaviyo

1. Klaviyo → Flows → Create Flow → Welcome Series template
2. Set trigger: "Added to list" → Select your Newsletter list
3. Add 5 emails with these subjects + bodies (paste the content above)
4. Set timing: 0d, 2d, 5d, 9d, 14d delays between each
5. Add Profile Filter: "Has not placed order in last 30 days" (so existing customers don't get this)
6. Add Smart Sending: ON (prevents over-emailing)
7. Set the flow status to LIVE

**Variable mapping:**
- `{{ first_name|default:'friend' }}` — Klaviyo first_name property
- All other content is hardcoded

**A/B test ideas (after 2 weeks of data):**
- Email 1 subject: "Welcome to Becky 💛" vs current
- Email 5 subject: Personalized urgency vs generic urgency
- CTA button color: pink (#ff3465) vs yellow (#fde300)
