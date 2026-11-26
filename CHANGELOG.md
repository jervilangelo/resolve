<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Changelog

Versions of the Resolve browser extension, newest first. The website and backend deploy
continuously from `main`. Downloads: [GitHub Releases](https://github.com/jervilangelo/resolve/releases)
or [getresolved.site/downloads](https://getresolved.site/downloads). How releases are made:
[docs/RELEASING.md](docs/RELEASING.md).

## 0.4.1 — 2026-11-26

- The Access Blocked page now says plainly: "This page is blocked by Resolve. Please stay away
  from this website."
- The Focus Mode page says when the website opens again.
- The extension's settings, its package (NOTICE.txt) and every bundled script carry the ownership
  notice; the image model's own license notice is kept.

## 0.4.0 — 2026-11-26

- **Two distinct blocked pages.** Websites restricted by your accountability group show "Access
  Blocked", with a reflection, a Scripture verse or a Puritan quotation (each with its source), and
  one button: "Choose to Walk Away". Websites blocked by Focus Mode show "Focus Mode is On" with the
  time left. When both apply, the group's page is shown.
- Blocking is unchanged: the website never loads, and neither page names it. Back returns to the
  page you were on.
- The pages appear when blocked-visit alerts are on; otherwise the browser shows its own block page.
- New description on the browser's extensions page (first shipped as 0.3.1, never released alone).

## 0.3.0 — 2026-11-26

- **Focus Mode is a timed session:** 15, 25, 30, 45 or 60 minutes, or 5–240 custom. It ends by
  itself at the deadline, even if the popup is closed, the browser restarts or the computer sleeps.
- Ending early takes two steps: type "Yes, this is an emergency." and confirm.
- A more compact popup.

## 0.2.0 — 2026-11-26

- **New: Focus Mode.** Blocks Facebook, Instagram, X, TikTok and Reddit in this browser, plus
  YouTube, Netflix or Twitch if chosen. Personal and local: sends nothing to Resolve, alerts no one,
  and never changes the group's blocked websites.

## 0.1.1 — 2026-11-26 (beta)

- Redesigned popup and settings with one Protection list.
- Sign-out asks for confirmation; with one group, it is chosen automatically.
- The dashboard's "This browser" card shows whether the extension is connected.

## 0.1.0 — 2026-11-25 (limited beta)

First release of the dashboard and the extension for Chrome, Edge and Brave: accounts and groups
with invitations; confidential group website blocking with essential services always reachable and
offline enforcement; optional on-device media blurring with three sensitivity levels; voluntary,
consent-based accountability with exactly two alerts (a deliberate visit to a non-negotiable
website, and leaving or being removed from a group), never naming the website. Released after the
full release checklist, with both alerts verified on production.
