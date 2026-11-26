<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Release record: 0.1.0 beta (limited, unpacked)

docs/qa/RELEASE_CHECKLIST.md as run on 2026-11-25 for the limited beta. "Deferred" items belong
to the store release.

## Production

| Item | Value |
| --- | --- |
| AWS account | `514009713156` (dedicated, in the owner's organization), ap-southeast-1 |
| Dashboard | https://getresolved.site (Amplify custom domain; www and the amplifyapp address redirect; rebuilds on push to main) |
| API | https://z3s1ohuvs5.execute-api.ap-southeast-1.amazonaws.com |
| Email | SES production access granted; sender "Resolve" <no-reply@getresolved.site> (domain identity, DKIM 2048, MAIL FROM mail.getresolved.site, SPF, DMARC quarantine); bounce and complaint suppression on |
| Extension | Beta build, fixed key, ID `jlgcfgmonpplhjanafoghpebgjnplbkc` (registered as a production sign-in callback) |
| Deploys | "Deploy prod" workflow, manual, owner approval |

## Checklist result

| Item | Result |
| --- | --- |
| CI green (lint, types, unit, build, E2E, Terraform, Checkov, audit) | Pass |
| Live integration tests (dev) | Pass (12) |
| Extension suite in Edge and Brave | Pass |
| ★ AI privacy: zero-upload check | Pass (Chromium, Edge, Brave) |
| ★ Domain precedence | Pass (enforcement flow; policy matrix) |
| ★ Member write and secrecy | Pass (tests; uniform responses) |
| ★ Admin control | Pass (tests) |
| ★ Sharing modes and consent | Pass (tests, dev and production flows) |
| ★ Alert A | Pass on **production**: deliberate blocked visit → exactly one email; script redirect → none (dev) |
| ★ Alert B | Pass on **production**: leaving the group → departure email |
| ★ Delivery (no duplicates, consent re-check, DLQ) | Pass (unit + live); DLQ alarm configured |
| ★ Cross-browser | Chromium-family pass; Firefox not supported (disclosed) |
| No open critical/high backlog items | Pass |
| Data inventory and privacy policy in step | Pass |
| Log privacy test | Pass |
| Built manifest permissions as listed | Pass (identity, declarativeNetRequest, alarms, scripting, offscreen; API + Cognito hosts; optional `<all_urls>`, `webNavigation`) |
| Secrets not in repo or bundles | Pass (settings from Terraform; git-ignored files) |
| Terraform plan reviewed; deletion protection on | Pass |
| Alarms subscribed | Pass (owner's alerts address) |
| Manual check in Google Chrome stable, including self sign-up with a real inbox | **Owner, before inviting testers** |
| Store packaging and listing | Deferred to the store release (docs/release/STORE_LISTING.md ready) |

## Acceptance (ROADMAP Phase 10)

"A new beta user can register, join a group, enable protection, configure consent, and exercise
both alert triggers" — passed on production on 2026-11-25 through the hosted dashboard and the
beta extension: admin set up a group with a non-negotiable website and an invitation; a recipient
joined and agreed to receive alerts; the beta user joined, chose to share with everyone, signed in
to the extension (production), had protection on, triggered Trigger A by a deliberate visit and
Trigger B by leaving; then all three accounts were deleted through the dashboard. Accounts were
created by the operator, because self sign-up sends a verification code to a real inbox: the owner
checks self sign-up by hand with a real address before inviting testers.
