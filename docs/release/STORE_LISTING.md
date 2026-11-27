<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Store listing pack (Chrome Web Store, Microsoft Edge Add-ons)

Copy for the store forms, checked against extension 0.4.1. If the code changes, update this file
first. Images: screenshots in `docs/release/screenshots/` (1280×800), icon
`assets/branding/store/store-icon-128.png`, small promo tile
`assets/branding/store/promo-small-440x280.png`, marquee `promo-marquee-1400x560.png`.

## Package

Build with production settings and **without** the beta key (the store assigns the ID):

```bash
SITE_URL=https://getresolved.site pnpm extension:env prod   # once: apps/extension/.env.production.local
pnpm --filter @resolve/extension zip                         # .output/resolveextension-X.Y.Z-chrome.zip
```

Upload only the `-chrome.zip` (never the `-sources.zip`).

## Store listing tab

- **Name:** Resolve
- **Short description (≤ 132 characters):**
  Free for Christians: block websites your group chooses, blur explicit images on your device,
  Focus Mode, voluntary accountability.
- **Category:** Productivity (the closest available sub-category, e.g. Tools)
- **Language:** English
- **Website:** https://getresolved.site
- **Support:** https://getresolved.site/support (questions: resolved.site@gmail.com)

**Detailed description:**

```text
Resolve is a free browser extension for Christians who want to be diligent and careful about how they use the internet. It helps you set boundaries online and invite trusted people to encourage you.

• Focus Mode: block Facebook, Instagram, X, TikTok and Reddit (and optionally YouTube, Netflix or Twitch) for 5 to 240 minutes while you study, work or read. It ends by itself; ending early takes two deliberate steps. No account needed, and it never alerts anyone.

• Image blurring on your device: an AI model inside the extension checks images and video frames in your browser and blurs explicit ones. Nothing is uploaded. Off until you turn it on; three sensitivity levels.

• Website blocking for your group: with a free account at getresolved.site, your accountability group decides which websites its members' browsers block. Admins manage the list; members can add websites but cannot see it. Essential services such as Gmail and Microsoft 365 always stay reachable.

• Voluntary accountability: off by default. Choose partners who agree to receive alerts. They may get a short email after a deliberate visit to a website your group marked non-negotiable, or if you leave the group. Alerts never name the website.

Free, no ads, no tracking.

Honest limits: any extension can be turned off or removed, Resolve protects only the browser it is installed in, the AI makes mistakes in both directions, and a blocked visit is not proof of intent.

Step-by-step guide: https://getresolved.site/tutorial
Privacy policy: https://getresolved.site/privacy
```

## Privacy practices tab

**Single purpose:**

```text
Help Christians keep the online boundaries they choose: blocking websites (their group's list or a timed Focus session), optionally blurring explicit images on the device, and optionally notifying consenting accountability partners of a deliberate blocked visit.
```

**Permission justifications:**

| Permission | Justification to paste |
| --- | --- |
| `identity` | Signs the user in to their Resolve account with the browser's sign-in window (OAuth with PKCE). |
| `declarativeNetRequest` | Blocks page loads to the websites on the user's group list and during a Focus session, with essential services excluded. Blocking happens in the browser; no request data is read or sent. |
| `alarms` | Checks for changes to the group's list every 15 minutes, ends a Focus session at its deadline, and (only if the user turned on removal and check-in alerts) checks in about once an hour. |
| `scripting` | Registers the image-blurring script only after the user turns blurring on. |
| `offscreen` | Runs the on-device image classifier in a hidden extension page. |
| Host permissions (Resolve API and sign-in domain) | Fetches the user's account, groups and block list from Resolve's own servers; nothing else. |
| Optional `<all_urls>` | Requested only when the user turns on image blurring (to check and blur images on the pages they open; images never leave the device) or allows it when starting Focus Mode (to show the Focus page on a blocked site). |
| Optional `webNavigation` | Requested only when the user turns on blocked-visit alerts: to recognise that a page the user opened was blocked and show Resolve's blocked page. Addresses are checked on the device and never stored or sent; an alert contains no website. |

**Remote code:** No, I am not using remote code. (The AI model ships inside the package.)

**Data usage:**

| Data type | Tick? | Notes |
| --- | --- | --- |
| Personally identifiable information | Yes | Email address and display name, for the account and alert delivery |
| Authentication information | Yes | Sign-in tokens, kept in the extension's private storage |
| Web history | No | Not stored or sent |
| Website content | No | Images are classified on the device; nothing is sent |
| User activity | Yes | Only "a non-negotiable restriction was triggered" (no website), and, if the user turned on removal and check-in alerts, that Resolve was removed or when this browser last checked in; only to partners who agreed |
| Health, financial, location, personal communications | No | |

Certify all three: not sold to third parties; not used or transferred for purposes unrelated to
the single purpose; not used for creditworthiness or lending.

**Privacy policy URL:** https://getresolved.site/privacy

## Distribution tab

- Payments: free. Visibility: **Public** (or **Unlisted** for a quiet first check). Regions: all.

## After the store assigns the ID

Add it to `store_extension_ids` in the production tfvars and apply, so sign-in accepts
`https://<id>.chromiumapp.org/` and the dashboard can talk to the store build. Do this before the
listing is published. Edge Add-ons assigns a different ID: register it the same way.
