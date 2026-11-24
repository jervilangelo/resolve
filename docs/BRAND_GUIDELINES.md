<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Resolve — Brand Guidelines

> **Take every thought captive.** (2 Corinthians 10:5)

## Symbol: the Pierced Serpent

A serpent drawn as an **S** (for sin) is run through by a horizontal blade. Its head droops onto the blade, defeated, and its tail tapers away. Where the blade passes, the spine is cut cleanly.

- **Genesis 3:15 and Colossians 2:15:** the serpent's power is broken in Christ.
- **Romans 8:13:** "by the Spirit … put to death the deeds of the body." The blade recalls the sword of the Spirit (Ephesians 6:17). The putting to death is God's work. Resolve is only a tool that supports that vigilance.
- The upright serpent and the horizontal blade form a cross implicitly. No cross is drawn.
- Wordmark: tracked Baskerville capitals. Baskerville is a typeface from Jonathan Edwards' own century. The **S** is custom: a drooping head terminal, a tapering tail, and a clean cut through the spine on the blade's axis. Do not replace it with the stock S.

| Cut | File | Use |
|---|---|---|
| Full | `logo/symbol*.svg` | 48 px and above |
| Small | `logo/symbol-small.svg`, `icon/app-icon-small.svg` | 16–48 px; heavier strokes, no pommel |
| Pixel-snapped | `extension/icon-16.png`, `icon-32.png` | Blade aligned to whole pixels; do not regenerate by resizing |

## Colour

| Token | HEX | Use |
|---|---|---|
| `forest` | `#1F4A36` | Primary; serpent on light, app tile, primary buttons |
| `forest-deep` | `#163627` | Pressed states, deep surfaces |
| `charcoal` | `#1E2321` | Text and wordmark on light |
| `night` | `#121614` | Dark-mode background, social/store banners |
| `ivory` | `#F6F2E8` | Light background; serpent and wordmark on dark |
| `parchment` | `#E9E2D2` | Borders, dividers |
| `sage` | `#8FA894` | Decorative only |
| `sage-light` | `#B5CBB9` | Secondary text and tagline on dark |
| `brass-deep` | `#7E6339` | Blade on light |
| `brass-light` | `#C9AE80` | Blade on dark and on forest |

Measured contrast (WCAG): charcoal/ivory 14.3 · forest/ivory 9.0 · brass-deep/ivory 5.0 · ivory/night 16.3 · sage-light/night 10.6 · brass-light/night 8.6 · ivory/forest 9.0 · brass-light/forest 4.7 · sage/ivory **2.3** (never use for text).

### Interface palette (slate)

By owner decision (2026-11-24), the dashboard, extension and sign-in pages use a restrained
**slate** interface: navy-charcoal text and buttons on soft cool-grey surfaces. The brand colours
above remain in the logo artwork, app icons, favicons and store/social images. Red is used only for
errors and destructive actions. Source of truth: `packages/ui/tokens.css`.

```css
:root {
  --rs-bg: #F8FAFC; --rs-surface: #FFFFFF; --rs-border: #E2E8F0; --rs-subtle: #F1F5F9;
  --rs-text: #0F172A; --rs-text-muted: #475569;
  --rs-primary: #0F172A; --rs-primary-pressed: #1E293B; --rs-on-primary: #F8FAFC;
  --rs-accent: #334155; --rs-focus: #0F172A; --rs-danger: #B91C1C;
}
[data-theme="dark"] {
  --rs-bg: #020617; --rs-surface: #0F172A; --rs-border: #1E293B; --rs-subtle: #1E293B;
  --rs-text: #F1F5F9; --rs-text-muted: #94A3B8;
  --rs-primary: #F1F5F9; --rs-primary-pressed: #CBD5E1; --rs-on-primary: #0F172A;
  --rs-accent: #CBD5E1; --rs-focus: #CBD5E1; --rs-danger: #F87171;
}
```

In the interface, use the one-colour lockups: `horizontal-black.svg` on light and
`horizontal-white.svg` on dark (at least 140 px wide).

## Typography

| Role | Typeface | Licence |
|---|---|---|
| Wordmark, display headings | Libre Baskerville Regular, capitals tracked +140 for the wordmark | SIL OFL 1.1 |
| UI, body, tagline | IBM Plex Sans 400/500/600; tagline 500, capitals, tracked +200 | SIL OFL 1.1 |

Logo files contain outlined paths, not live text. In apps, self-host the fonts with `@fontsource/libre-baskerville` and `@fontsource/ibm-plex-sans`. Do not load them from a runtime CDN.

## Logo usage

- **Lockups:** horizontal (default), horizontal with tagline, stacked, horizontal-compact (uses the small cut, for heights under 40 px).
- **Light/dark:** use `*-light` on ivory or white and `*-dark` on night or forest. Use `black`/`white` only for one-colour reproduction.
- **Clear space:** the blade's thickness × 3 on all sides (≈ 0.28 × symbol height).
- **Minimum sizes:** symbol 16 px (small cut); horizontal lockup 96 px wide (compact) or 140 px wide (full); tagline lockup 240 px wide.
- **Do not:** recolour the serpent and blade outside the palette; add gradients, shadows or outlines; rotate the mark or reverse the blade; separate the blade from the serpent; close the cut; re-set the wordmark in another font; place light lockups on busy imagery; scale `icon-16.png` up.

## Iconography

`ui/icons/*.svg`: 24 px grid, 1.75 stroke, round caps and joins, `currentColor`. Draw new icons the same way. The protection icon carries the blade motif; keep others plain. Lucide icons match this style if more are needed.

`ui/loader.svg`: the blade slides through the serpent. It follows `prefers-color-scheme` and respects `prefers-reduced-motion`.

## Assets

```text
assets/branding/
├── logo/       symbol, symbol-small, horizontal, horizontal-compact, stacked, tagline (SVG masters + png/)
├── icon/       app-icon.svg, app-icon-small.svg (forest tile)
├── extension/  icon-16/32/48/96/128.png
├── store/      store-icon-128.png, promo-small-440x280, promo-marquee-1400x560
├── web/        favicon.ico, favicon.svg, icon-192/512, icon-maskable-512, apple-touch-icon, site.webmanifest
├── social/     og-image 1200×630, github-social-preview 1280×640, cover 1500×500, profile-400
├── email/      email-header (600×120 @2x PNG)
└── ui/         loader.svg, icons/
```

## Implementation

- **Extension (WXT):** copy `extension/icon-*.png` to `apps/extension/public/icon/` and set `manifest.icons` (16/32/48/96/128) and `action.default_icon` (16/32). The tile icon works on light and dark toolbars in Chrome, Brave, Edge and Firefox, so Firefox `theme_icons` aren't needed. The popup header uses `horizontal-{black,white}.svg`.
- **Store listings:** Chrome and Edge use `store-icon-128.png` (96 px art + 16 px padding) and the two promo tiles. Firefox AMO uses `icon-128.png`.
- **Dashboard (Next.js):** place `web/*` in `apps/web/public/`. Use `horizontal-{black,white}.svg` in the interface (header, landing hero, Cognito sign-in pages) and `og-image.png` for Open Graph.
- **Email:** `email-header.png` at 600×120, alt text "Resolve".
- **GitHub:** upload `social/github-social-preview.png` under Settings → Social preview.

Run a professional trademark search before commercial launch. These guidelines don't establish trademark clearance.
