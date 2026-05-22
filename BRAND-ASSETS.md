# Becky | Brand Asset Audit

Extracted from the legacy Luca theme (config/settings_data.json + assets/luca-theme.scss) for porting to the modern Horizon theme on the `horizon` branch.

---

## Color palette

### Primary brand colors
| Use | Hex | Notes |
|---|---|---|
| Header banner | `#fde300` | Becky signature yellow. Currently shows "FREE 3 DAY SHIPPING ON ALL ORDERS" |
| Footer | `#ff3465` | Becky signature pink. Used in CTA buttons and accent moments |
| Footer text | `#ffffff` | White on pink |

### Section background colors (the editorial rhythm)
| Use | Hex | Where it appeared |
|---|---|---|
| Hero / featured product | `#ffebeb` | Very light blush |
| Ingredients section | `#f3e5fe` | Very light lavender |
| Testimonial sections | `#fcfcdd` | Pale butter |
| FAQ section | `#fddbd1` | Peach |
| Story section | `#ff3465` | Brand pink (used as full-bleed on Our Story) |

### Text and accent colors
| Use | Hex |
|---|---|
| Primary text | `#3d4246` (dark slate) |
| Body text | `#69727b` (medium slate) |
| Sale/accent | `#557b97` (slate blue) |
| Button (legacy) | `#557b97` |
| Button text | `#ffffff` |
| Borders | `#e8e9eb` |
| Body bg | `#ffffff` |
| Coral accent | `#fc9476` |
| Lavender accent | `#f098f9` |
| Periwinkle accent | `#6a7ef2` |
| Pink accent (primary) | `#ff3465` |

### Checkout colors
- Accent: `#197bbd`
- Button: `#197bbd`
- Error: `#e32c2b`
- Background: `#ffffff`
- Sidebar bg: `#fafafa`

---

## Typography

- **Heading font:** Work Sans, weight 600 (`work_sans_n6`)
- **Body font:** Poppins, weight 500 (`poppins_n5`)
- **Heading base size:** 26px
- **Body base size:** 14px
- **Body bold for product titles:** off

For Horizon, the closest CSS:
```css
--font-primary--family: 'Work Sans', system-ui, sans-serif;
--font-primary--weight: 600;
--font-body--family: 'Poppins', system-ui, sans-serif;
--font-body--weight: 500;
```

---

## Logo

- Filename: `BECKY_LOGO_b.png`
- Max width: 100px in header
- Alignment: left

---

## Iconography & visual motifs

- **Wavy SVG dividers** between sections (SVG path: `M320 28C160 28 80 49 0 70V0h1280v70c-80 21-160 42-320 42-320 0-320-84-640-84z`). Color-shift transitions between adjacent pastel sections.
- **Cartoon brand mascot illustrations** (e.g. "okay" wave illustrations, "Group-1" mark, "Group-15" mark) — sourced from Shopify CDN files. Should be inventoried and re-uploaded as Files in Horizon.
- **Product photography style:** clean, white-on-white, lots of negative space, jar centered. Some lifestyle shots (shower, bath, hands).

---

## Voice library (verbatim from legacy site)

Use these for hero copy, CTAs, and microcopy in the modernized theme:

- **Hero greeting:** "Hi, we're Becky. Nice to meet you."
- **Brand thesis:** "Let's talk about your booty. Why? Because it's not getting enough recognition."
- **Anti-establishment positioning:** "Big brands were too busy overcharging for products containing artificial ingredients, made in big factories, with shiny packaging, and marketed by women who looked like they haven't eaten a carb in 3 years."
- **Self-aware aside:** "*Disclaimer: we eat carbs*"
- **Joke about photoshop:** "Photoshop is more popular than we thought."
- **Final CTA on home:** "Can we touch your butt?"
- **Trust badges:** "NO SYNTHETIC FRAGRANCES, TOXINS OR PARABENS. KEEPS SENSITIVE SKIN HAPPY. VEGAN + CRUELTY-FREE."
- **Shipping banner:** "FREE 3 DAY SHIPPING ON ALL ORDERS"
- **Mission line:** "We donate 1% of all revenue to women's causes around the world."

---

## Page structure rhythm (legacy homepage, top to bottom)

The legacy home — even though it was misused as the PDP — had a nice editorial rhythm. To preserve as inspiration for the new modern home (which won't BE the PDP):

1. **Yellow shipping bar** (announcement)
2. **Half-slider + featured product** (hero)
3. **"How it works" section** — peach bg, walnut shell explanation
4. **Wavy divider**
5. **Active Ingredients section** — lavender bg, 2-column ingredient grid (Rosehip Seed Oil / Jojoba / Aloe / Walnut / Provitamin B5)
6. **Wavy divider**
7. **See full ingredients / How to use** — lavender bg, expandable blocks
8. **Wavy divider**
9. **Testimonial section** — butter bg, customer quote + photo
10. **Wavy divider**
11. **FAQ section** — peach bg, 3-column Q&A
12. **Wavy divider**
13. **Second testimonial** — butter bg
14. **"Can we touch your butt?"** — blush bg, final CTA

---

## Existing FAQs from old home (to preserve voice)

1. **IS BECKY VEGAN?** "That's correct, Becky is 100% vegan and cruelty-free. Becky has been formulated using 98% natural ingredients."
2. **$20 FOR 2OZ?** "First, our product doubles when wet and all of our ingredients are sourced in the United States. Our product is made in Portland, OR and we also use the same ingredients in high-end cosmetics. We cover the cost of shipping and donate a percentage of your order to Every Mother Counts, an organization that is committed to making pregnancy and childbirth safe for women everywhere. Oh… and we spent about $5 in ads just to get you reading this. 😉"
3. **HOW DO I STORE MY SCRUB?** "We suggest storing it in a cool, dry place in between scrubs with the lid closed to prevent drying out."
4. **WHY SHOULD I SCRUB?** "Using a natural scrub like Becky has many benefits. Becky is a natural exfoliator that removes dead skin that can clog pores and helps regenerate new, healthy skin cells in its place."
5. **HOW OFTEN SHOULD I SCRUB?** "For the best results, we recommend scrubbing 2-3 times per week."
6. **HOW LONG UNTIL I SEE RESULTS?** "Our customers can expect to see results anywhere from the first couple of uses up to 2-3 weeks."
7. **CAN I USE BECKY ON MY TATTOO?** "Becky doesn't recommend using her scrub on a freshly inked butt. You should wait until the area has healed completely before scrubbing."
8. **DO YOU TEST ON ANIMALS?** "Nope! We would never do such a thing."

---

## Full ingredient list (from legacy PDP)

Walnut Shell Powder (natural exfoliator) · Organic Aloe Leaf Juice* (moisturizer) · Decyl Glucoside (moisturizing agent) · Lauryl Glucoside (cleansing agent) · Cocamidopropyl Betaine (moisturizer) · Phenoxyethanol (helps increase shelf life) · Organic Lavender Flower Water (anti-inflammatory and anti-bacterial) · Roman Chamomile Flower Water (antioxidant) · Glycerin (moisturizes and protects skin) · Provitamin B5 (helps skin regenerate new cells) · Hydrolyzed Wheat Protein (moisturizer) · Organic Oatstraw Extract* (calming agent for sensitive skin) · Vitamin E (antioxidant) · Sunflower Seed Oil (soothes skin) · Organic White Willow Bark Extract* (natural exfoliator) · Organic Jojoba Seed Oil* (long-lasting moisturizer & rich in vitamins) · Rosehip Seed Oil (rich with vitamins and antioxidants) · Organic Alcohol* (increases absorption of vitamins) · Xanthan Gum (adds texture) · Tetrasodium EDTA (helps increase shelf life)

*Certified Organic Ingredient*

---

## Social handles to preserve

- Instagram: https://instagram.com/beckybootyscrub
- Facebook: https://www.facebook.com/beckybootyscrub
- (TikTok: TODO — add when active)

---

## CSS oddities from legacy that we can drop in Horizon

- `padding:0` on `.index-section--slideshow, #MainContent` — Horizon has proper section padding controls; not needed
- Custom `.flex-container` / `.flex-item-1` / `.flex-item-3` grid — Horizon has native grid blocks
- `pointer:cursor` typo in `.slide-button` — drop
- Manual `display:none` on `.slide-content` for click-to-reveal — Horizon has native accordion blocks

The legacy CSS is a fine reference for spacing intent but the actual structure should use Horizon's modern block system.
