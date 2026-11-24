<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Resolve — Progress log

Where development stopped and what comes next. Read this first when resuming; update it before
pausing. Phase numbers follow [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

**Last updated:** 2026-11-24 · **Current:** Phase 7 complete; Phase 8 (exactly two notification
triggers) next

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
| **8 — Two notification triggers**     | **Next**    | Non-negotiable navigation + departure alerts via outbox/SQS/SES              |
| 9–11                                  | Not started | QA, beta, Focus Mode                                                         |

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
- **Whole-system review (2026-11-24, Claude reviewers per area):** no critical or high findings.
  Fixed: media re-reads no longer hit the HTTP disk cache, fetch/classify timeouts and a streamed
  size cap, late video verdicts can't unblur a new source, fair video sampling, rules removed at
  once on an implicit sign-out; dissolve answers within a time budget after commit, member
  submissions take the same path whatever the reason, reclassify retries conflicts, GSI1 IAM
  scoped to `USER#`; web "Try again" really retries, invite page tells outages from invalid
  links, "Copied" tracks the link, HSTS on HTTPS deployments.
- **Checks:** `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm integration` all passing at pause.

## Next steps

1. Phase 8 — exactly two notification triggers (MASTER_PLAN §7): (A) qualifying non-negotiable
   top-level navigation reported by the extension (minimal event, server-derived user, idempotency,
   cooldown, per-recipient caps, no domain in the alert); (B) leave/removal using the pre-departure
   sharing snapshot in the same transaction as the outbox record. Outbox → SQS → SES worker that
   rechecks membership and consent before sending (`eligibleRecipients`).
2. Extension popup: show the current sharing mode (MASTER_PLAN §8 popup contents).
3. Owner: measure the media filter's false-negative rate on a private labelled dataset
   (`node apps/extension/scripts/evaluate-model.ts <dir>`) and record it in AI_FILTER_EVALUATION.md.
4. Review leftovers (low): dissolve janitor (async sweep; leftovers are inert meanwhile), race
   outcomes on leave/remove that answer 404 instead of 409, `returnTo` after an API 401 and a
   loop guard, server-side dates in UTC, Cognito `error` on the callback shown as "expired".
5. Carry-overs: per-user group quota, dashboard revoked-token handling, idempotency request
   fingerprint, group picture upload, branded block page, Firefox enforcement adapter (with
   Firefox sign-in), media filter memory profiling and open shadow DOM.

## Decisions log

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
