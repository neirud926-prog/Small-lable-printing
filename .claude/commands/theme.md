---
description: Generate consistent design tokens, color palette, and CSS variables
---

# Theme Factory

Generate a complete, consistent design system for the ski/snowboard lesson marketplace.

## Brand Context
- **Industry:** Outdoor sports / ski & snowboard
- **Market:** Hong Kong users booking lessons (often traveling to Japan, Korea, or China for skiing)
- **Vibe:** Professional but approachable, trustworthy, adventurous
- **Target users:** Young adults (20-40), tech-savvy, value convenience and trust

## Output: Tailwind CSS Config
Generate a complete `tailwind.config.js` theme extension with:

### Colors
- `primary` — Main brand color (buttons, links, active states)
- `secondary` — Complementary accent
- `success` — Confirmed bookings, verified badges, positive states
- `warning` — Pending states, Request-to-Book waiting period
- `danger` — Cancellations, errors, declined requests
- `instant` — Specific color for Instant Book flow
- `request` — Specific color for Request-to-Book flow
- `neutral` — Background, cards, borders (50-900 scale)

### Typography
- Font family stack (system fonts for performance)
- Font size scale for headings, body, captions
- Line heights and letter spacing

### Spacing & Borders
- Consistent border radius tokens
- Shadow tokens for cards and modals
- Spacing scale for layout consistency

### Component Tokens
- Card styles (instructor cards, course cards)
- Badge styles (trust badge, booking type badge)
- Button variants (primary, secondary, ghost, danger)
- Form input styles
- Rating star colors (filled, empty, half)

## Also Generate
- CSS custom properties (`:root` variables) for any values not covered by Tailwind
- Dark mode color variants if applicable
