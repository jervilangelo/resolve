<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Resolve — Progress log

Where development stopped and what comes next. Read this first when resuming; update it before
pausing. Phase numbers follow [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

**Last updated:** 2026-11-25 · **Current:** Phase 10: production live (dashboard + API); waiting on
SES production access (AWS review), the prod GitHub settings and store accounts

## Phase status

| Phase                                 | Status      | Notes                                                                        |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| 1 — Branding                          | Done        | Owner-made; wordmark refined 2026-11-23                                      |
| 2 — Repository and engineering        | Done        | Monorepo, web, extension, contracts, CI, E2E                                 |
| 3 — AWS infrastructure and backend    | Done        | Dev deployed; CI deploy pipeline live; acceptance tests pass                 |
| 4 — Accounts and groups               | Done        | Dashboard + extension sign-in, groups, invites, roles, active group          |
| 5 — Domain protection                 | Done        | Policy engine, blocklist API/UI, extension enforcement (Chromium DNR)        |
| 6 — On-device AI media protection     | Done        | NSFWJS on-device blur (Chromium); FN rate to be measured on an owner dataset |
| 7 — Voluntary accountability          | Done        | Sharing modes, recipient consent, server-side resolver; dashboard UI         |
| 8 — Two notification triggers         | Done        | Blocked-visit + departure alerts: outbox → SQS → worker → SES, consent-checked |
| 9 — QA, security, privacy             | Done        | Reports in docs/qa; 2 live checks pending an AWS session (see Next steps)    |
| **10 — Beta and release**             | **In progress** | Pages, deletion, hosting module, store pack done; prod deploy pending owner |
| 11                                    | Not started | Focus Mode                                                                   |

## What exists and works (verified)

- **Dev stack on AWS** (ap-southeast-1, all prefixed `resolve-dev-`): Cognito user pool, DynamoDB
  single table, private avatar bucket, HTTP API + Lambda, outbox relay → SQS + DLQs, alarms, SNS
  alerts (email confirmed), tag-scoped monthly budget, SES sender identity (sandbox, verified).
- **API routes:** `GET /v1/health`, `GET/PATCH /v1/me`, `POST/GET /v1/groups`,
  `GET /v1/groups/{groupId}` (non-members get 404), members list, leave, admin removal,
  invitations (create/list/revoke; `POST /v1/invitations/preview` and `/accept` take the token in
  the body). Invites: hashed single- or multi-use tokens, 7-day expiry, one redemption per person,
  50-member cap, last admin cannot leave. Admins promote/demote (always ≥1 admin), rename and
  dissolve groups (`PATCH`/`DELETE /v1/groups/{groupId}`, `PATCH .../members/{userId}`).
- **Pipeline:** push to `main` → CI → "Deploy dev" (GitHub OIDC role, Terraform apply) →
  live integration tests. GitHub repo variables, `dev` environment and secrets are set.
- **Dashboard sign-in (Phase 4 slice 1):** Cognito managed login (branded, light/dark) on a Cognito
  domain; server-side authorization code + PKCE; tokens only in encrypted httpOnly cookies bound by
  a session ID; refresh in `apps/web/proxy.ts`; sign-out revokes the refresh token. Pages:
  `/dashboard/groups` (list, create), `/dashboard/groups/[id]`, `/dashboard/profile`. Verified with
  a real browser flow against dev Cognito. Run locally: `pnpm web:env dev`, then `pnpm dev:web`.
- **Members and invitations (Phase 4 slice 2):** group page shows the member directory; admins
  create invite links (`/invite#<token>`, token never sent in URLs), revoke them, and remove
  members; members can leave. Verified with a two-user real browser flow.
- **Ownership (Phase 4 slice 3a):** make-admin / step-down, rename, and dissolve (typed name
  confirmation). Dissolve marks the group dissolved atomically, then sweeps its items; any
  leftovers are inert and the marker expires via TTL.
- **Extension sign-in (Phase 4 slice 3b):** Cognito managed login via `identity.launchWebAuthFlow`
  (code + PKCE, `prompt=login`); tokens and the active group live only in the background worker's
  origin-private IndexedDB (no `storage` permission; unreachable from content scripts). Permissions:
  `identity` + host access to the API and Cognito origins only. Popup/options show account, active
  group picker (one per installation, verified against the API), dashboard link, sign out.
  Chromium only; Firefox sign-in stays off until a Gecko ID is chosen.
- **Domain policy (Phase 5a/5b):** `packages/domain-policy` (normalization via the browser URL
  parser, Public Suffix List rejection, essential registry `ESSENTIAL_VERSION`, `decide()`
  precedence). API: members add additional domains with a uniform 202 (no existence/category/full
  oracle; every submission charged to a 60/hour budget); admins add/list/remove/reclassify
  (1000 per group) with an audit trail; `GET /v1/extension/rules` serves versioned snapshots to the
  extension client only (lists live as string sets on the group META item). Dashboard: blocked
  websites section (admin list, reclassify, remove, recent changes; member submit-only).
- **Extension enforcement (Phase 5c):** two declarativeNetRequest block rules (non-negotiable,
  additional; page and frame navigations; essentials excluded inside each rule so Focus Mode can
  later use its own range ≥100000). Rules sync on sign-in, group switch, startup and every 15 min,
  are cached and restored offline, and are removed on sign-out or loss of membership. Popup shows
  on / stale / error (with retry). Verified in real Chromium: blocked/allowed matrix incl. Google
  sign-in, Gmail, Drive and YouTube reachable with google.com blocked.
- **On-device media filter (Phase 6):** NSFWJS MobileNetV2-Mid (MIT, 4.3 MB, unpacked at build
  from the pinned npm package by `scripts/extract-nsfw-model.mjs`) on TF.js WebGL in an offscreen
  document that closes after a minute idle. Off by default; turning it on in Settings requests
  optional `<all_urls>` access and registers a content script (all frames, `document_start`) that
  blurs every img/video until classified safe; visible-first, bounded queues, URL cache, re-checks
  on src changes, video sampled every 2 s; sensitivity strict/balanced/relaxed; media that can't
  be checked stays blurred by default. Nothing leaves the device (Chromium net-log E2E proof).
  Measured: 1.0–2.7% false positives on 300 general photos; ~35 ms per image warm, 3 s cold start.
  See [AI_FILTER_EVALUATION.md](AI_FILTER_EVALUATION.md).
  Reviewed by Claude.
- **Voluntary accountability (Phase 7):** each member sets who may receive their alerts
  (`PRIVATE` default / `SELECTED` / `EVERYONE`) and, separately, whose alerts they agree to receive
  (anyone who shares, or person by person). Only the member can read or change their own choices
  (no admin route). `eligibleRecipients` (services/api/src/accountability.ts) resolves recipients
  from current members and consent; choices made before someone (re)joined never count, and leaving
  deletes the member's own choices in the same transaction. Consent changes are audited (no
  browsing data), limited to 60/hour, and unchanged saves are no-ops. Dashboard: Accountability
  section on the group page. Verified: 14 unit/route scenarios (private, selected, everyone,
  one-way, mutual, withdrawn, admin cannot override, rejoin), a live DynamoDB integration test, and
  a two-user real-browser flow. No alerts are sent yet (Phase 8).
- **Notification triggers (Phase 8):** exactly two. (A) Blocked non-negotiable visit: the
  extension (optional `webNavigation`, turned on in its settings) reports only top-level pages it
  blocked under the active group's non-negotiable rule (no frames, prerenders, cross-site
  redirects or essentials; 10-min cooldown) as a minimal event with no URL; `POST /v1/events`
  (extension clients only) records idempotency, cooldown and the outbox item in one transaction,
  only if someone consented. (B) Leave/removal writes the outbox item from the pre-departure
  sharing in the membership transaction (a racing sharing change forces a recompute). Delivery
  worker (SQS → Lambda): claims each recipient once (stale claims reclaimable), re-checks
  membership, sender sharing and recipient consent at send time, caps 10 alerts/recipient/hour
  (refunded unless delivered), looks the address up in Cognito, sends a generic SES email, stops
  before timing out, and retries sender-side failures into the alarmed DLQ; delivery metrics in
  CloudWatch (`Resolve/Notifications`) and an alarm when the queue stalls for an hour. Verified:
  unit tests (API 72, worker 11, extension 44), live integration (11) and a real-Chromium run
  (blocked visit → exactly one email to the consenting recipient; repeat within cooldown: none).
  SES is in sandbox: real emails reach only verified addresses until production access.
- **QA, security and privacy (Phase 9):** docs/qa/ holds the test report (requirement-by-
  requirement evidence), threat model, data inventory and retention review, runbooks, backlog and
  release checklist. CI now also runs `pnpm audit` (fails on high/critical) and a Checkov IaC
  scan (accepted exceptions with reasons in `infrastructure/terraform/.checkov.yaml`); WCAG 2.1
  A/AA axe tests cover public pages and extension pages; a log-privacy test proves no domain, URL,
  name or token reaches logs. The extension suite passes in Chromium, Edge 158 and Brave 1.100
  (`RESOLVE_E2E_BROWSER=msedge|brave`). Two adversarial Claude reviews found no critical/high
  issues; 15 medium/low findings were fixed, notably stricter Trigger A qualification (no alerts
  for page-initiated redirects, pop-ups, restored/discarded tabs or reloads) and no retroactive or
  duplicate emails.
- **Production (Phase 10, 2026-11-25):** dedicated AWS account `514009713156` (in the owner's
  organization; CLI profile `resolve-prod`; Terraform via exported credentials:
  `eval "$(aws configure export-credentials --profile resolve-prod --format env)"`). Dashboard:
  https://main.dcwo6nhqxltjm.amplifyapp.com (Amplify, rebuilds on push to main). API:
  https://z3s1ohuvs5.execute-api.ap-southeast-1.amazonaws.com. Verified: health, public pages,
  security headers, sign-in -> create group -> self-service deletion. Stack roles in both
  accounts carry a permissions boundary; deploy roles can only create bounded roles. SES:
  sender verified, bounce/complaint suppression on, production access requested (pending).
  Prod deploys: manual "Deploy prod" workflow with owner approval (`prod` GitHub environment).
- **Beta release work (Phase 10, in progress):** public privacy, terms, support and
  getting-started pages (contact from Terraform `alert_email`, not the repo); self-service account
  deletion (`DELETE /v1/me`: leaves groups via the departure path, dissolves solo groups only if
  still solo, refuses for the sole admin of a populated group, deletes the user's data and Cognito
  account, 2-hour tombstone refuses leftover tokens; verified live); Amplify hosting module
  (`modules/hosting`, enabled per stage, token needed only at creation); store listing pack and
  release notes in docs/release. Owner's Windows desktop proposal recorded as post-launch
  (docs/HYBRID_DESKTOP_ARCHITECTURE_PROPOSAL.md).
- **Whole-system review (2026-11-24, Claude reviewers per area):** no critical or high findings.
  Fixed: media re-reads no longer hit the HTTP disk cache, fetch/classify timeouts and a streamed
  size cap, late video verdicts can't unblur a new source, fair video sampling, rules removed at
  once on an implicit sign-out; dissolve answers within a time budget after commit, member
  submissions take the same path whatever the reason, reclassify retries conflicts, GSI1 IAM
  scoped to `USER#`; web "Try again" really retries, invite page tells outages from invalid
  links, "Copied" tracks the link, HSTS on HTTPS deployments.
- **Checks:** `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm integration` all passing at pause.

## Next steps

1. Done 2026-11-25: prod GitHub environment configured; first "Deploy prod" run succeeded with
   owner approval (updated the three Lambda bundles; health check passed).
2. SES production access: wait for AWS's review (check `aws sesv2 get-account --profile
   resolve-prod`); answer any follow-up questions from AWS.
3. Store: owner creates Chrome Web Store and Edge Partner Center developer accounts; create draft
   items to get their extension IDs; add them to prod `extension_ids` (creates the extension's
   Cognito client); build the extension against prod (`pnpm extension:env prod`, build, zip);
   upload as unlisted/testers with docs/release/STORE_LISTING.md; screenshots.
4. Beta acceptance on production: a new user registers, joins a group, enables protection,
   configures consent and triggers both alerts (after SES production access).
5. docs/qa/RELEASE_CHECKLIST.md before inviting testers.
6. Later: custom domain (Amplify domain + SES domain identity with SPF/DKIM/DMARC); Firefox.

## Decisions log

- 2026-11-25: Release choices: production in a new dedicated AWS account; dashboard on AWS Amplify
  (GitHub Pages cannot host the server-rendered dashboard); no custom domain until the project is
  built (Amplify address and the verified alerts address meanwhile); the owner is named operator
  with the alerts email as contact.

- 2026-11-24: Trigger A favours missing an alert over a false one: no report for navigations a
  page starts within 5 s of loading, pop-ups, restored/discarded tabs or block-page reloads, and
  none in the 20 s after browser start. Names may not contain links, web or email addresses.
  Accepted IaC scan exceptions are documented and revisited before production.

- 2026-11-24: Alerts: blocked-visit reporting uses `webNavigation` as an optional permission
  (Chrome words it "read your browsing history"), requested only on opt-in. Departure emails use
  the same generic wording for leaving and removal. One alert per member per group per 10
  minutes; at most 10 alerts per recipient per hour. Late (over 24 h) alerts are dropped.

- 2026-11-24: Accountability consent is pairwise and personal: a recipient accepts a sender
  individually or turns on "accept from anyone who shares with me". Senders can see whether each
  chosen member has agreed (needed to know who actually receives alerts); nobody sees other
  members' relationships. Choices are bound to the membership they were made in (a leave/rejoin
  resets them). Owner decision: reviews use Claude (Claude Pro plan), not Codex.

- 2026-11-24: Media filter design: classification in an offscreen document (one model per
  browser, not per tab); site access is an optional permission requested only when the user turns
  the filter on (install-time permissions unchanged apart from `scripting` and `offscreen`, which
  show no warning); off by default; cross-origin images are re-read by the extension without
  cookies; unverifiable media stays blurred by default; SVGs and images under 64 px are treated
  as safe. No explicit test material in the repository; fixtures use a harmless photo the model
  misreads.

- 2026-11-25: Group blocks apply to page and frame navigations only (never subresources), so
  essential services keep their third-party dependencies; public suffixes (incl. private ones such
  as github.io) cannot be blocked; broad domains may be blocked with essentials staying reachable.

- 2026-11-24: Brand palette changed to slate (navy-charcoal ink, cool greys, slate-grey blade) by
  owner request: interface, logos, icons, favicons, store, social and email images were all
  recoloured; artwork shapes unchanged. See BRAND_GUIDELINES.md.

## Open decisions for the owner

- Phase order: roadmap (Phase 4 next) vs. handbook (on-device AI blur next). Currently following the
  roadmap.
- 5 open Dependabot PRs bumping GitHub Actions versions (#1–#5); CI passes on all. Review/merge?
- Longer term: move Resolve to a dedicated AWS account (the deploy role is near-admin in the shared
  account). Firefox signing ID is on hold by owner request.

## Resuming a session

- AWS: `aws sts get-caller-identity`; if expired, `aws login` (default profile).
- GitHub CLI: `gh auth status` (installed at `C:\Program Files\GitHub CLI\gh.exe`).
- Terraform (local): files `environments/dev/backend.hcl` and `terraform.tfvars` are git-ignored
  and exist only on the owner's machine. Build Lambdas before plan/apply:
  `pnpm --filter @resolve/api --filter @resolve/notifications build`.
- Reviews: Claude via the owner's Claude Pro plan (`/code-review`, reviewer agents); Codex is no
  longer used (owner decision 2026-11-24). See handbook §4.2.
- Extension (dev): `pnpm extension:env dev`, then `pnpm --filter @resolve/extension build:dev` and
  load `apps/extension/.output/chrome-mv3-dev` unpacked (fixed ID
  `glglgjmdobecmhnnnnobipaamapflppg`, registered as a Cognito callback in dev).
