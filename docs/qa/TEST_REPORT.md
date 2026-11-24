<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Test report (Phase 9)

State of verification on 2026-11-24, commit `e553d10` and later. What was tested, how, the result,
and what is not covered. Run everything yourself with the commands at the end.

## Summary

| Area                                  | Result                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Unit and route tests                  | 203 pass (API 73, extension 48, domain policy 47, web 17, worker 13, contracts 7)         |
| Live integration tests (AWS dev)      | 11 pass, on every deploy (CI)                                                             |
| Browser E2E (Playwright Chromium, CI) | 26 pass (dashboard, extension, media filter, zero-upload check, accessibility)            |
| Microsoft Edge 158, Brave 1.100       | Extension suite 8/8 each (status, settings, media filter, zero upload, accessibility)     |
| Real-browser flows against dev        | Sign-in, invites, ownership, domains, enforcement, accountability, Trigger A end to end    |
| Dependency vulnerabilities            | 0 known (pnpm audit); CI fails on high/critical                                           |
| Infrastructure scan (Checkov)         | 0 failing; accepted exceptions documented in `infrastructure/terraform/.checkov.yaml`     |
| Accessibility (axe, WCAG 2.1 A/AA)    | 0 violations on public pages and extension pages; signed-in dashboard audit pending (†)   |
| Security reviews (Claude, adversarial) | 0 critical/high; 15 medium/low findings fixed in `e553d10` (see THREAT_MODEL.md)        |
| Firefox                               | **Not supported yet** (owner decision: on hold)                                           |

† Needs an AWS session for test accounts; see "Open items".

## Requirement traceability (MASTER_PLAN §2)

| ID    | Requirement                                                   | Evidence                                                                                                  | Status        |
| ----- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| FR-01 | Signup, signin, verification, recovery                        | Cognito managed login (branded); web/extension sign-in real-browser flows; integration auth tests          | Pass          |
| FR-02 | Group name/picture, create, invite, join, leave, remove       | `members.test.ts`, integration membership lifecycle, invite/ownership real-browser flows                  | Pass, **picture upload not built** |
| FR-03 | ADMIN/MEMBER, server-side enforcement                         | Route tests (403/404 matrix), integration role checks, adversarial backend review                         | Pass          |
| FR-04 | One active group per install; many memberships                | Extension account tests; enforcement flow switches groups                                                 | Pass          |
| FR-05 | Essential exemptions take precedence                          | `domain-policy` tests (47); `compileRules` tests; enforcement flow (Gmail/Drive/YouTube reachable)        | Pass          |
| FR-06 | Only admins add/remove non-negotiable                          | `domains.test.ts` 403 cases; integration domain test                                                     | Pass          |
| FR-07 | Anyone adds additional immediately                            | `domains.test.ts`; integration                                                                            | Pass          |
| FR-08 | Only admins remove                                            | `domains.test.ts`; integration                                                                            | Pass          |
| FR-09 | Only admins enumerate the list                                | Route tests; rules refused to dashboard clients; backend review                                           | Pass (local rule inspection remains possible) |
| FR-10 | Generic member response, no oracle                            | Uniform 202 test; budget charged first; equalised store path (`e553d10`)                                  | Pass (residual: see threat model) |
| FR-11 | Browser blocking + offline cache                              | `protection.test.ts` (offline restore, stale); enforcement flow                                           | Pass          |
| FR-12 | On-device blur for images and feasible video                  | `media-filter.spec.ts` in Chromium/Edge/Brave; AI_FILTER_EVALUATION.md                                    | Pass (false-negative rate unmeasured) |
| FR-13 | PRIVATE/SELECTED/EVERYONE                                     | `accountability.test.ts`; integration; two-user browser flow                                              | Pass          |
| FR-14 | Explicit consent, independent and bilateral                   | `accountability.test.ts` (one-way, mutual, rejoin)                                                        | Pass          |
| FR-15 | Admin cannot change member sharing                            | `accountability.test.ts`; backend review                                                                  | Pass          |
| FR-16 | Qualifying navigation → generic alert                         | `navigation.test.ts` (10 cases), `triggers.test.ts`, live integration, real Chromium end to end           | Pass          |
| FR-17 | Departure alert from pre-departure policy                     | `triggers.test.ts`; snapshot race guard; live integration                                                 | Pass          |
| FR-18 | Additional blocks never alert                                 | Reporter only matches the non-negotiable rule; `navigation.test.ts` unlisted/other-block cases             | Pass          |
| FR-19 | No URL/domain/title/history in events/emails/logs             | Strict event schema; `privacy.test.ts` (logs); email tests; netlog zero-upload E2E                         | Pass          |
| FR-20 | Chrome, Brave, Edge, Firefox                                  | Chromium/Edge/Brave suites pass                                                                           | **Partial: no Firefox** |
| FR-21 | Idempotency, dedupe, cooldown, retries, DLQ                   | `triggers.test.ts`, `delivery.test.ts` (claims, refunds, deadlines, no duplicates), DLQ + stuck alarms     | Pass          |
| FR-22 | Revoke consent and sharing                                    | Worker re-checks at send time (`delivery.test.ts`); route tests                                          | Pass          |
| FR-23 | Protection status and AI toggle                               | Popup/options statuses (domain, media, alerts, sharing); accessibility tests                              | Pass          |
| FR-24 | Audit admin rule/membership changes, no browsing history      | Domain audit (1 y), consent audit; DATA_INVENTORY.md                                                      | Pass (membership audit not separate) |

## Roadmap Phase 9 checklist

| Task                                                                 | Result                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Role escalation                                                      | Not possible (route tests, adversarial review)                                           |
| Confidential blocklist exposure                                      | No API/UI path for members; timing path equalised; local rule inspection disclosed      |
| Duplicate submissions                                                | Idempotent create, uniform submissions, event IDs, delivery claims                       |
| Allowlist (essential) precedence                                     | Policy matrix + real enforcement                                                         |
| Stale rules, offline sync                                            | `protection.test.ts` (stale state, restore while offline)                                |
| Group removal                                                        | Membership, rules and accountability cleared; departure alert transaction                |
| Classification accuracy/performance; video/cross-origin limits       | AI_FILTER_EVALUATION.md; E2E for cross-origin and video fallbacks                         |
| Consent withdrawal, departure transactions, queue retries            | Unit + integration (see FR-17/21/22)                                                     |
| Event spoofing, rate limits, accidental navigation                   | Extension-only route, token identity, strict schema, cooldowns, conservative qualification |
| Dependency/security scans, accessibility, privacy review, runbooks   | This report, THREAT_MODEL.md, DATA_INVENTORY.md, RUNBOOKS.md                             |
| Disclose bypass limits                                               | Options page and dashboard copy; THREAT_MODEL.md "Residual limitations"                  |

## Cross-browser

| Browser                      | Extension suite | Notes                                                                                       |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| Chromium (Playwright, CI)    | 8/8 + web 18    | Whole-browser network log must stay local                                                   |
| Microsoft Edge 158           | 8/8             | Vendor background traffic exists; the extension's and pages' requests are checked instead |
| Brave 1.100 (Chromium 158)   | 8/8             | As Edge                                                                                     |
| Google Chrome                | Not automated   | Same engine as above; checked by hand before store submission (RELEASE_CHECKLIST.md) |
| Firefox                      | —               | Not supported: no offscreen documents (media filter), no Gecko ID (sign-in); on hold        |

## Open items

- Signed-in dashboard accessibility audit and a re-run of the Trigger A real-browser flow with the
  stricter qualification rules: both need an AWS CLI session (`aws login`); scripts are ready.
- Media filter false-negative rate needs the owner's private labelled dataset.
- Everything else open is in BACKLOG.md.

## How to reproduce

```sh
pnpm check && pnpm build && pnpm e2e        # unit, lint, types, build, browser E2E (Chromium)
RESOLVE_E2E_BROWSER=msedge pnpm --filter @resolve/e2e exec playwright test --project extension
RESOLVE_E2E_BROWSER=brave  pnpm --filter @resolve/e2e exec playwright test --project extension
pnpm integration                            # live dev stack (needs AWS credentials)
pnpm audit --audit-level high
checkov -d infrastructure/terraform --config-file infrastructure/terraform/.checkov.yaml
```
