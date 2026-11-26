<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Release checklist

Run before every beta or production release. Each line needs a person's initials and the date;
"n/a" needs a reason. Items marked ★ are MASTER_PLAN §14.5 acceptance gates.

## Code and tests

- [ ] `main` is green in CI: lint, types, unit tests, build, E2E, Terraform validate, Checkov, `pnpm audit`
- [ ] Live integration tests pass against the target stack (`pnpm integration`)
- [ ] Extension suite passes in Edge and Brave (`RESOLVE_E2E_BROWSER=msedge|brave`)
- [ ] Manual run in Google Chrome stable: install, sign in, choose group, blocked site blocked,
      essential site reachable, media filter on/off, alerts on/off, sign out removes rules
- [ ] ★ AI privacy: zero-upload check passes (media filter E2E); no new network calls in the extension
- [ ] ★ Domain precedence: essential services reachable under a broad block (enforcement flow)
- [ ] ★ Member write and secrecy: member can add, cannot list; generic responses
- [ ] ★ Admin control: only admins remove or manage non-negotiable rules
- [ ] ★ Sharing: three modes, selected and mutual consent behave as specified
- [ ] ★ Alert A: one generic email for a deliberate blocked visit; none for redirects, pop-ups, restores
- [ ] ★ Alert B: departure email after leave and after removal, with the browser closed
- [ ] ★ Delivery: no duplicates, consent re-checked, DLQ alarm tested once
- [ ] ★ Cross-browser: critical flows pass in every browser listed in the store (Firefox only once supported)
- [ ] No open critical or high item in docs/qa/BACKLOG.md

## Privacy and security

- [ ] DATA_INVENTORY.md matches what the code stores; privacy policy updated from it
- [ ] Any new log line uses allowlisted fields only (`privacy.test.ts` still passes)
- [ ] Permissions in the built manifest are exactly: identity, declarativeNetRequest, alarms,
      scripting, offscreen; host access to the API and Cognito only; optional `<all_urls>` and
      `webNavigation`
- [ ] Store listing permission justifications match the options-page explanations
- [ ] Secrets: none in the repo or bundles; CI secrets reviewed
- [ ] THREAT_MODEL.md reviewed for changes since the last release

## Infrastructure

- [ ] Terraform plan reviewed for the target stage; no unexpected destroys
- [ ] SES: production access, verified domain with SPF/DKIM/DMARC, sender address set
- [ ] Alarms subscribed and confirmed (SNS email); budget alarm set
- [ ] DynamoDB point-in-time recovery on; state bucket versioned

## Extension packaging

- [ ] Version bumped (`apps/extension/package.json`), changelog written
- [ ] Production build (`pnpm --filter @resolve/extension build`) without the development key
- [ ] Zip created with `pnpm --filter @resolve/extension zip`; contents spot-checked
- [ ] Store listing text honest about limits (can be disabled, not proof, not every block alerts)

## After release

- [ ] Smoke test on the released build (install from store/zip)
- [ ] Watch alarms and delivery metrics for 48 hours
- [ ] Record the release in docs/PROGRESS.md
