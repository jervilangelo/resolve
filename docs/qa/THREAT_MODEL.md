<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Threat model

MASTER_PLAN §13 made concrete for the built system (Phase 9, 2026-11-24): each threat, how it is
mitigated, the evidence, and what remains. Findings from the Phase 9 adversarial reviews are listed
at the end.

## Assets and trust boundaries

- **Assets:** accounts and tokens; group membership and roles; confidential blocklists; each
  member's sharing and consent; alert integrity (no false or unwanted alerts); browsing privacy
  (URLs, pages, media never leave the device).
- **Untrusted:** web pages and their scripts (content scripts run beside them), any member's
  client (the extension is user-controlled), email recipients' mail clients.
- **Trusted:** the background service worker and extension pages; the API (all authorization is
  server side); AWS services; the deploy pipeline (GitHub OIDC role).

## Threats

| Threat | Mitigation in Resolve | Evidence | Residual |
| --- | --- | --- | --- |
| Uninstall-URL token leaked or guessed (installation alerts, §7.4) | 256-bit random token in the URL fragment (never in server logs), only its SHA-256 stored, one alert per installation (conditional update), revocable; the callback answers every request the same way | `installations.test.ts` (unknown token, repeated callback, revocation) | Whoever holds a browser's token can trigger one removal email for that browser |
| Inactivity alert where nothing is wrong | 72-hour grace, one alert per silent period, wording that a closed or offline browser looks the same, opt-in on both sides | `installations.test.ts` (grace, reset, single alert) | Partners may be alerted after a long trip; the email says so |
| Member reads the domain list via API/UI | Admin-only routes with re-check after read; rules only to extension clients; no member list/count/category | Route tests, backend review | — |
| Member infers the list by probing | Uniform 202, budget charged before lookup, same store path for every outcome | `domains.test.ts`, `e553d10` | A member can still read compiled rules on their own device (disclosed in the dashboard) |
| Malicious broad/parent domain blocks essentials | Normalization, public-suffix rejection, essential registry excluded inside every rule | Policy matrix, enforcement flow | New essential dependencies need registry updates |
| Role escalation / IDOR | Role from DB inside each transaction; path IDs validated; non-members 404 | Route and integration tests | — |
| Admin overrides a member's sharing or reads consent | No route acts on another member's choices; caller identity from token | `accountability.test.ts`, review | Admins can still talk to members outside the app |
| Forged or replayed navigation event | Extension clients only; user from token; strict schema; event-ID idempotency + per-member cooldown in one transaction; time window | `triggers.test.ts`, privacy test | A user controls their own extension: an event is not proof of intent (stated in every alert) |
| Automated navigation triggers an alert (false accusation) | Only top-level, active, extension-blocked pages under the non-negotiable rule; no cross-site redirects, pop-ups, page-initiated navigation within 5 s of a load, restores, discarded tabs, reloads; persisted cooldown | `navigation.test.ts` (10 cases), real Chromium run | Some deliberate visits are not reported (by design); some edge cases may remain |
| Alert to someone who did not consent | Recipients resolved from sharing ∩ consent; re-checked at send time; choices bound to memberships; no alerts about events before a recipient joined | `delivery.test.ts`, `accountability.test.ts` | Sent email cannot be recalled |
| Departure alert lost on crash | Outbox item written in the membership transaction; stream relay with retries and failure queue; worker retries into an alarmed DLQ; stuck-queue alarm | Integration test, Terraform | Email provider delivery is not guaranteed |
| Duplicate alerts | Event idempotency; per-recipient claim with a 'sending' mark that is never taken over | `delivery.test.ts` | A crash between the mark and the send loses one email (preferred to duplicates) |
| Phishing through names in alert emails | Names may not contain links, web or email addresses (look-alike dots normalised); emails omit old link-like names; HTML escaped; fixed subjects | `names.test.ts`, `delivery.test.ts` | Plain-language deception in names is still possible |
| Browser offline | Last valid rules cached and restored; stale status shown | `protection.test.ts` | New restrictions apply only after the next sync |
| Extension disabled, removed, or another browser used | Honest status messaging in popup/options; dashboard copy | UI | **Cannot be prevented on a personal device** |
| Content script / page attacks the extension | Content scripts get only the media vocabulary (validated); tokens in extension-origin IndexedDB; offscreen answers only the background; no web-accessible resources | Client review | A compromised renderer could make the extension re-read an image URL (no cookies; result is only a verdict) |
| Media or URLs leave the device | Classification in the offscreen document; only re-reads of images the page already loaded; strict event schema | Netlog E2E in 3 browsers; client review | — |
| Telemetry logs URLs or personal data | Allowlisted logger fields; worker logs counts and error names; access logs without paths/IPs | `privacy.test.ts` | Operational discipline for future log lines |
| Token theft from the dashboard | httpOnly `__Host-` cookies, A256GCM-encrypted, SameSite=Lax, PKCE + state, sign-out revokes | Web review | Device compromise is out of scope |
| Over-privileged deploy role | Separate prod account; deploy roles limited to their stage's names and GitHub environment, and may only create roles carrying the stage's permissions boundary (stage resources only); prod deploys need owner approval | Terraform, live deploys | Anyone who can approve a prod deploy controls production |
| Infrastructure misconfiguration | Checkov in CI; S3 private, TLS-only, encrypted; DynamoDB PITR; least-privilege Lambda roles by key prefix | `.checkov.yaml`, CI | Accepted exceptions documented there |
| Vulnerable dependencies | Lockfile; Dependabot; `pnpm audit` gate in CI | CI | Zero-day exposure until patched |
| Cost abuse | API Gateway throttles; per-user rate limits (domains 60/h, accountability 60/h); alert caps (10/recipient/h); SQS concurrency 2; budget alarm | Tests, Terraform | — |

## Phase 9 adversarial review findings (all fixed in `e553d10`)

| Severity | Finding | Fix |
| --- | --- | --- |
| Medium | Page/meta/script redirects and pop-unders could trigger Trigger A | Page-initiated navigation window, pop-up and restore suppression |
| Medium | Session restore and discarded tabs re-reported old blocks; cooldown reset on worker restart | Startup grace, discard tracking, reload window, persisted cooldown |
| Medium | A late delivery could reach someone who rejoined after the event | Recipient membership must predate the event |
| Medium | Duplicate email if recording the outcome failed after sending | 'sending' mark, never taken over |
| Medium | Popup went "offline" when the sharing lookup failed | Separate, optional lookup |
| Medium | Two tabs could both pass the client cooldown | Atomic, persisted claim per sign-in and group |
| Medium | Typing a blocked site right after opening a new tab was not reported | New tab/start pages do not open the automatic window |
| Medium | A domain add could return 500 after succeeding | Timing read cannot fail the request |
| Low | Report could go out under a changed sign-in or group | Session and group checked before every attempt |
| Low | "Alerts: on" without anything able to report; copy overstated | Background-computed status; precise copy |
| Low | Timing hint on member submissions | Same store path on every outcome |
| Low | Link-like names in emails | Name rule + email fallback |
| Low | Cooldown not bound to sign-in; tab listener woke the worker; repeat visits suppressed forever | Keyed by sign-in, filtered listener, time-bounded reload rule |

## Residual limitations to disclose

Users can disable or remove the extension, use another browser, profile or device, or use
browsers Resolve does not support (Firefox today). Blocking covers page and frame navigations, not
every request. The media filter misses some content and blurs some safe content. Alerts are
reported by software the user controls and are not proof of anything. Emails, once sent, are
outside Resolve's control.
