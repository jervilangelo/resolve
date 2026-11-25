<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Store listing pack (Chrome Web Store, Microsoft Edge Add-ons)

Copy for the store forms. Every statement here matches what the extension does; if the code
changes, update this file first. Screenshots: `docs/release/screenshots/` (1280×800).

## Basics

- **Name:** Resolve
- **Short description (≤ 132 characters):**
  Privacy-first protection for your group: block chosen websites, blur sensitive images on-device,
  and voluntary accountability.
- **Category:** Productivity (Chrome) / Productivity (Edge)
- **Language:** English
- **Website:** the dashboard address (Amplify address until a custom domain is set)
- **Support:** `<dashboard>/support`
- **Privacy policy:** `<dashboard>/privacy`

## Detailed description

Resolve helps people who choose to pursue faithfulness online, together with a small group they
trust. It is a supporting tool, never a replacement for real community.

- **Block websites your group chose.** Group admins keep a confidential list; members can add to
  it. Essential services (Gmail, YouTube, Microsoft 365 and others) always stay reachable.
- **Blur sensitive images and video on your device.** An AI model runs inside your browser. Images
  and video frames are never uploaded. Off until you turn it on; choose a sensitivity.
- **Voluntary accountability.** You decide who may receive your alerts, and they decide whether to
  receive them. Alerts never say which website it was. Off by default.

Honest limits: the extension can be turned off or removed, other browsers and devices are not
covered, the AI makes mistakes, and an alert is not proof of intent.

Requires a free Resolve account (dashboard). Beta.

## Single purpose (Chrome)

Help a user keep the online boundaries they chose with their accountability group: blocking the
group's chosen websites, optionally blurring sensitive media on the device, and optionally
notifying consenting group members of blocked visits.

## Permission justifications

| Permission | Why it is needed |
| --- | --- |
| `identity` | Sign in to the user's Resolve account (OAuth with PKCE via the browser's sign-in window). |
| `declarativeNetRequest` | Block page loads to the websites on the user's active group list, with essential services excluded. Blocking happens in the browser; no request data is read or sent. |
| `alarms` | Check for changes to the group's list every 15 minutes. |
| `scripting` | Register the media-blurring script only after the user turns the filter on. |
| `offscreen` | Run the on-device image classifier in a hidden extension page (no network use besides re-reading images the page already loaded). |
| Host access to the Resolve API and sign-in domain | Fetch the user's account, groups and block list; nothing else. |
| Optional: access to all sites (`<all_urls>`) | Requested only when the user turns on media blurring: to blur and check images on the pages they open. Images never leave the device. |
| Optional: `webNavigation` | Requested only when the user turns on accountability alerts: to recognise that Resolve blocked a page the user opened. Page addresses are seen briefly on the device and never stored or sent; an alert contains no website. |

Remote code: **none.** The AI model ships inside the extension; no code is downloaded at run time.

## Data use disclosures (Chrome "Privacy practices" / Edge)

| Data type | Collected? | Notes |
| --- | --- | --- |
| Personally identifiable information | Yes | Email address (account sign-in, alert delivery). |
| Authentication information | Yes | Sign-in tokens, kept in the extension's private storage. |
| Web history | **No** | Not stored or transmitted. Page addresses are only checked locally. |
| Website content | **No** | Images/video are classified locally; the extension may re-read an image from the site that served it, but nothing is sent to Resolve. |
| User activity | Limited | Only "a non-negotiable restriction was triggered", without the website, and only when the user turned alerts on and chose recipients who agreed. |
| Health, financial, location, personal communications | No | — |

Certifications to tick: data is not sold to third parties; not used or transferred for purposes
unrelated to the single purpose; not used to determine creditworthiness or for lending.

## Before submitting

1. Production build with production settings (`RESOLVE_*` from the prod stack), then
   `pnpm --filter @resolve/extension zip`.
2. Create the store item (draft) to obtain its extension ID; add
   `https://<id>.chromiumapp.org/` to the production Cognito callbacks (`extension_ids`), redeploy,
   rebuild, zip, upload. Edge assigns its own ID: register that one too.
3. Fill this listing, upload screenshots, set visibility to **unlisted** or a testers group for the
   beta.
