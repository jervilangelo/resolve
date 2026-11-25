<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Bug and gap backlog

Known open issues after Phase 9 (2026-11-24), most important first. No critical or high security
findings are open. "Before beta" items block the Phase 10 release checklist.

## Before beta (Phase 10)

| # | Item | Why it matters |
| --- | --- | --- |
| 1 | SES production access, verified sender **domain** (SPF, DKIM, DMARC), bounce and complaint handling | Sandbox delivers only to verified addresses; reputation and deliverability |
| 2 | Production stack (separate account recommended) and deploy-role permissions boundary | The dev deploy role can create roles within its prefix without a boundary |
| 3 | ~~Public privacy policy and terms pages~~ | Done (Phase 10) |
| 4 | ~~Self-service account deletion~~ | Done (Phase 10) |
| 5 | Manual check in Google Chrome (stable) of install, sign-in, blocking, media filter, alerts | Not automated here |
| 6 | ~~Signed-in dashboard accessibility audit and Trigger A re-run~~ | Done 2026-11-25 |
| 7 | Media filter false-negative measurement on a labelled dataset | Accuracy claims need it |

## Product gaps

| # | Item |
| --- | --- |
| 8 | Firefox support: Gecko ID and sign-in, enforcement adapter, media filter without offscreen documents, alerts (FR-20) |
| 9 | Group picture upload (FR-02): bucket exists, flow not built |
| 10 | Dissolve janitor: finish sweeps that ran out of time (leftovers are inert meanwhile) |
| 11 | Popup: quick "add a domain" action (MASTER_PLAN §8.1) |
| 12 | Branded block page for blocked navigations (needs a redirect rule and host access) |
| 13 | Media filter: open shadow DOM, CSS backgrounds, animated images beyond the checked frame, memory profiling |
| 14 | Separate membership-change audit (FR-24 covers domains and consent today) |

## Minor defects and polish

| # | Item |
| --- | --- |
| 15 | Leave/remove racing a role change answers 404 instead of 409 |
| 16 | After an API 401 the dashboard returns to `/dashboard`, not the page you were on; add a loop guard |
| 17 | Server-rendered dates use the server time zone (UTC) |
| 18 | Sign-in cancelled at Cognito shows "link expired" wording |
| 19 | Per-user group quota (how many groups one person can create) |
| 20 | Idempotency key is not bound to the request body (fingerprint) |
| 21 | Dashboard handling of revoked refresh tokens could be clearer |
| 22 | A deliberate visit started within 5 s of a page loading in the same tab is not reported (conservative by design; revisit with real usage) |

## Hardening (accepted for now, revisit before production)

| # | Item |
| --- | --- |
| 23 | Lambda code signing and X-Ray tracing |
| 24 | Customer-managed KMS keys if a compliance need appears |
| 25 | Reserved concurrency per function once account limits are raised |
| 26 | Narrow the delivery worker's read of group META to the attributes it needs |
