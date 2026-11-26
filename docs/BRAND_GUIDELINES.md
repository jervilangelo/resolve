<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
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

Slate palette, adopted by owner decision on 2026-11-24 (replacing forest, ivory and brass). It
applies to the logo artwork, icons, favicons, store, social and email images, and the interface.

| Token | HEX | Use |
|---|---|---|
| `ink` | `#0F172A` | Primary; serpent and wordmark on light, app tile, primary buttons |
| `ink-deep` | `#020617` | Dark-mode background, social and store banners |
| `paper` | `#F8FAFC` | Light background; serpent and wordmark on dark and on the tile |
| `rule` | `#E2E8F0` | Borders, dividers |
| `slate-300` | `#CBD5E1` | Secondary text and tagline on dark |
| `slate-400` | `#94A3B8` | Blade on dark and on the tile |
| `slate-500` | `#64748B` | Blade on light |

Measured contrast (WCAG): ink/paper 17.1 · slate-500/paper 4.5 · paper/ink-deep 19.3 ·
slate-300/ink-deep 13.6 · slate-400/ink-deep 7.9 · paper/ink 17.1 · slate-400/ink 7.0 ·
slate-400/paper **2.5** (never use for text on light).

### Interface tokens

Source of truth: `packages/ui/tokens.css`. Red is used only for errors and destructive actions.

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


## Typography

| Role | Typeface | Licence |
|---|---|---|
| Wordmark, display headings | Libre Baskerville Regular, capitals tracked +140 for the wordmark | SIL OFL 1.1 |
| UI, body, tagline | IBM Plex Sans 400/500/600; tagline 500, capitals, tracked +200 | SIL OFL 1.1 |

Logo files contain outlined paths, not live text. In apps, self-host the fonts with `@fontsource/libre-baskerville` and `@fontsource/ibm-plex-sans`. Do not load them from a runtime CDN.

## Logo usage

- **Lockups:** horizontal (default), horizontal with tagline, stacked, horizontal-compact (uses the small cut, for heights under 40 px).
- **Light/dark:** use `*-light` on paper or white and `*-dark` on ink or ink-deep. Use `black`/`white` only for one-colour reproduction.
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
├── icon/       app-icon.svg, app-icon-small.svg (ink tile)
├── extension/  icon-16/32/48/96/128.png
├── store/      store-icon-128.png, promo-small-440x280, promo-marquee-1400x560
├── web/        favicon.ico, favicon.svg, icon-192/512, icon-maskable-512, apple-touch-icon, site.webmanifest
├── social/     og-image 1200×630, github-social-preview 1280×640, cover 1500×500, profile-400
├── email/      email-header (600×120 @2x PNG)
└── ui/         loader.svg, icons/
```

## Implementation

- **Extension (WXT):** copy `extension/icon-*.png` to `apps/extension/public/icon/` and set `manifest.icons` (16/32/48/96/128) and `action.default_icon` (16/32). The tile icon works on light and dark toolbars in Chrome, Brave, Edge and Firefox, so Firefox `theme_icons` aren't needed. The popup header uses `horizontal-compact-{light,dark}.svg`.
- **Store listings:** Chrome and Edge use `store-icon-128.png` (96 px art + 16 px padding) and the two promo tiles. Firefox AMO uses `icon-128.png`.
- **Dashboard (Next.js):** place `web/*` in `apps/web/public/`. Use `horizontal-*` on the Cognito sign-in pages, `horizontal-compact-*` in the header, `stacked-*` on the landing hero, and `og-image.png` for Open Graph.
- **Email:** `email-header.png` at 600×120, alt text "Resolve".
- **GitHub:** upload `social/github-social-preview.png` under Settings → Social preview.

Run a professional trademark search before commercial launch. These guidelines don't establish trademark clearance.
