# Resolve — Brand Guidelines

> **Take every thought captive.** (2 Corinthians 10:5)

## Symbol

**The Severed Serpent.** A downward wedge drives through a serpent and severs it. It recalls Genesis 3:15, the serpent's head crushed, and Romans 8:13, putting sin to death. The wedge descends from above: victory over sin is given in Christ by the Spirit, not achieved by the software. Resolve is only a tool that supports that vigilance.

- **Full cut** (`symbol.svg`) for 48 px and above.
- **Small cut** (`symbol-small.svg`) for 16–32 px. It has fewer, heavier curves and a wider cut.
- The geometry is parametric (`assets/branding/source/geometry.py`). The serpent is a round-capped stroke clipped by the wedge's offset outline. Edit the parameters there, not the exported files.

## Colour

| Token | HEX | Use |
|---|---|---|
| `forest` | `#1F4A36` | Primary brand colour, symbol on light backgrounds, app tile |
| `forest-deep` | `#163627` | Pressed states, deep surfaces |
| `forest-soft` | `#27583F` | Tonal graphics on forest |
| `charcoal` | `#1E2321` | Text and wordmark on light backgrounds |
| `night` | `#121614` | Dark-mode background |
| `ivory` | `#F6F2E8` | Light background, wordmark on dark |
| `parchment` | `#E9E2D2` | Borders, dividers, subtle surfaces |
| `sage` | `#8FA894` | Decorative only (fails text contrast on ivory) |
| `sage-light` | `#B5CBB9` | Symbol and secondary text on dark |
| `brass` | `#A88A5C` | Rare warm accent; not for text |

**Measured contrast:**

| Pair | Ratio |
|---|---|
| forest / ivory | 8.98 : 1 |
| charcoal / ivory | 14.26 : 1 |
| sage-light / night | 10.61 : 1 |
| ivory / night | 16.33 : 1 |
| sage-light / forest | 5.84 : 1 |

```css
:root { --bg:#F6F2E8; --surface:#FFFFFF; --border:#E9E2D2; --text:#1E2321; --text-muted:#4A524E;
        --brand:#1F4A36; --brand-strong:#163627; --on-brand:#F6F2E8; --accent:#A88A5C; }
[data-theme="dark"] { --bg:#121614; --surface:#1A1F1C; --border:#2A322E; --text:#F6F2E8; --text-muted:#B5CBB9;
        --brand:#B5CBB9; --brand-strong:#D3E1D6; --on-brand:#121614; --accent:#C4A877; }
```

## Typography

- **Wordmark and display:** Libre Baskerville (OFL). It is a revival of an 18th-century face from Edwards' era. The wordmark is outlined, so never retype it.
- **Interface and tagline:** IBM Plex Sans (OFL), weights 400/500/600. Set the tagline in Plex Sans 500, uppercase, with +0.16em tracking.
- Both fonts are free on Google Fonts and `@fontsource`. Use at most these two families.

## Usage

- **Clear space:** keep at least the wedge's half-width (¼ of the symbol height) clear on every side.
- **Minimum sizes:** symbol 16 px (small cut below 48 px); horizontal lockup 20 px tall (`horizontal-compact-*` below 32 px); tagline lockup 40 px tall.
- **Backgrounds:** use `*-light` on ivory or white and `*-dark` on night or forest. Use `*-black` and `*-white` for one-colour printing.
- **Don't:**
  - recolour outside the palette
  - rotate, flip or stretch the mark
  - add outlines, shadows or gradients
  - close the cut or animate the serpent being harmed
  - retype the wordmark
  - place the mark on busy photographs
  - pair the mark with crosses or shields

## Feature icons

`assets/branding/ui/icons/` holds the custom icons: protection, ai-blur, blocked-site, group, privacy, notification and settings.

- Built on a 24 px grid with a 1.75 stroke, round caps and joins, and `currentColor`.
- For generic UI glyphs, use Lucide at the same stroke width so everything matches.
- `ui/loader.svg` is the branded loading indicator: the wedge presses down, and the animation respects `prefers-reduced-motion`.

## Assets (`assets/branding/`)

| Folder | Contents |
|---|---|
| `logo/` | `symbol`, `symbol-small`, `horizontal`, `horizontal-compact`, `stacked` and `tagline` lockups in `-light`/`-dark`/`-black`/`-white` SVG, with transparent PNGs in `logo/png/` |
| `icon/` | App tile masters (`app-icon.svg`, `app-icon-small.svg`) |
| `extension/` | `icon-16/32/48/128.png` |
| `web/` | `favicon.ico` (16/32/48), `favicon.svg`, `icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180), `site.webmanifest` |
| `store/` | Chrome Web Store / Edge Add-ons promo tiles: 440×280 and 1400×560 |
| `social/` | `github-social-preview` (1280×640), `og-image` (1200×630), `cover-1500x500`, `profile-400` |
| `email/` | `email-header.png` (600×96 @2x), with an ivory background for safe rendering in email clients |
| `source/` | `geometry.py`, `build.py`, `outlines.json` (cached glyph outlines). Rebuild with `python assets/branding/source/build.py`. Requires `cairosvg`, Pillow and fontTools. |

## Implementation

- **WXT extension:**
  - Copy `extension/icon-*.png` to `apps/extension/public/icon/`.
  - Reference them in `manifest.icons` and `action.default_icon` (16/32/48/128). The same set works in Chrome, Brave, Edge and Firefox.
  - In the popup header, use `horizontal-compact-light.svg` or `horizontal-compact-dark.svg` at 24 px tall.
- **Next.js dashboard:**
  - Put `web/*` in `apps/web/public/` and link them from `app/layout.tsx` metadata (`icons`, `manifest`, `themeColor: #1F4A36`).
  - Sidebar: `horizontal-light.svg` or `horizontal-dark.svg`, collapsing to `symbol-small.svg`.
  - Sign-in, onboarding and landing pages: `tagline-*.svg` or `stacked-*.svg`.
  - Open Graph: `social/og-image.png`.
- **GitHub:** upload `social/github-social-preview.png` under Settings → Social preview.
- **Firefox AMO:** needs only the 128 px icon and screenshots. Capture screenshots from the real UI once it exists.
- **Trademark:** before a commercial launch, run a professional trademark search for the name and the mark.
