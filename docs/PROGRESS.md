<!--
Resolve — Take every thought captive.
Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Resolve — Progress log

Where development stopped and what comes next. Read this first when resuming; update it before
pausing. Phase numbers follow [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

**Last updated:** 2026-11-24 · **Current:** Phase 4 complete; Phase 5 (domain protection) next

## Phase status

| Phase                                 | Status      | Notes                                                                        |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| 1 — Branding                          | Done        | Owner-made; wordmark refined 2026-11-23                                      |
| 2 — Repository and engineering        | Done        | Monorepo, web, extension, contracts, CI, E2E                                 |
| 3 — AWS infrastructure and backend    | Done        | Dev deployed; CI deploy pipeline live; acceptance tests pass                 |
| 4 — Accounts and groups               | Done        | Dashboard + extension sign-in, groups, invites, roles, active group          |
| **5 — Domain protection**             | **Next**    | Essential exemptions, non-negotiable/additional blocklists, enforcement      |
| 6–10                                  | Not started | AI blur, accountability, notifications, QA, beta                             |

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
- **Checks:** `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm integration` all passing at pause.

## Next steps (Phase 5 — domain protection)

1. Platform essential-domain allowlist (Facebook, Messenger, YouTube, Gmail, Outlook, Microsoft 365,
   Google login/Drive/Meet, Teams and tested dependencies) with precedence over group blocks.
2. Group domain API: admins add/remove/list non-negotiable and additional domains; members add
   additional domains without approval and get a generic response (no list/duplicate oracle).
3. Domain normalization (hostnames, IDNs, subdomains, public-suffix rejection) in a shared package.
4. Versioned rule snapshot for the extension's active group; Chromium declarativeNetRequest
   enforcement with an offline cache.
5. Carry-overs: per-user group quota, revoked-token handling for the dashboard, idempotency request
   fingerprint, group picture upload, a janitor for interrupted dissolves.

## Decisions log

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
- Codex CLI is the secondary reviewer (read-only); see the `/codex` skill.
- Extension (dev): `pnpm extension:env dev`, then `pnpm --filter @resolve/extension build:dev` and
  load `apps/extension/.output/chrome-mv3-dev` unpacked (fixed ID
  `glglgjmdobecmhnnnnobipaamapflppg`, registered as a Cognito callback in dev).
