# Resolve — Development & Branding Roadmap

> **Take every thought captive.**  
> Biblical inspiration: 2 Corinthians 10:5. Historical inspiration: Jonathan Edwards' *Resolutions*.

**Status:** Phases 1–11 delivered (2026-11-26); this file is the record of how Resolve was built.
Future work lives only in [ROADMAP.md](ROADMAP.md) (deferred, revisit 2027).  
**Repository:** https://github.com/jervilangelo/resolve  
**Authoritative system specification:** [MASTER_PLAN.md](MASTER_PLAN.md)

## Guiding principles

- Build a privacy-first, voluntary Christian browser protection and accountability platform.
- Classify supported sensitive media **locally**; never upload webpage images or video frames for AI inference.
- Preserve each user's control over accountability sharing and each recipient's consent.
- Do not describe a user-controlled extension as tamper-proof, or its local blocking rules as completely secret.
- Do not introduce additional alert triggers without a deliberate specification change.
- Complete each phase's acceptance criteria before treating it as finished. Phases can overlap where dependencies allow.

## Phase 1 — Branding and product identity

**Goal:** Establish a consistent identity before product UI development.

**Decisions:** Brand **Resolve**; tagline **Take every thought captive.**; biblical anchor 2 Corinthians 10:5; historical inspiration Jonathan Edwards' *Resolutions*. Communicate that the tool supports Christian discipline, not that software produces sanctification.

**Tasks:**
- Develop a distinctive primary wordmark, icon, horizontal/stacked variants, favicon, and browser extension icons.
- Explore a restrained visual direction: forest green, ivory, sage, accessible light and dark palettes; finalize after contrast testing.
- Define typography, design tokens, spacing, component states, iconography, illustrations, and motion guidance.
- Create branding for dashboard, extension popup, onboarding, GitHub social preview, and extension-store assets.
- Draft product description, positioning, audience, privacy claims, and tone of voice.
- Review name, domain, and trademark conflicts before commercial launch; avoid claiming availability without verification.
- Record decisions in `docs/BRAND_GUIDELINES.md`.

**Deliverables:** Brand kit, component foundations, brand guidelines, logo/icon exports, copy guidelines.

**Acceptance:** Name/tagline and identity are applied consistently; icons are legible at extension sizes; accessibility and trademark review are documented.

## Phase 2 — Repository and engineering foundation

**Goal:** Establish a maintainable monorepo and development workflow.

**Tasks:**
- Configure pnpm workspaces, TypeScript strict mode, linting, formatting, environment validation, and GitHub Actions.
- Create `apps/extension` (WXT + React), `apps/web` (Next.js), `services/api`, `services/notifications`, `packages/shared`, `packages/ui`, `packages/domain-policy`, and `infrastructure/terraform`.
- Create shared Zod schemas, API contracts, error types, and authorization conventions.
- Implement a design system using the Phase 1 brand tokens.
- Set up Vitest and Playwright test harnesses; separate dev and production configuration.

**Deliverables:** Compiling extension and dashboard, CI, workspace conventions.

**Acceptance:** Clean install, build, lint, and baseline tests pass from a fresh checkout.

## Phase 3 — AWS infrastructure and backend

**Goal:** Provide secure identity, data storage, APIs, and reliable event infrastructure.

**Tasks:**
- Provision Cognito, API Gateway, Lambda, DynamoDB, private S3, SQS, SES, CloudWatch with Terraform.
- Define users, groups, memberships, invitations, protected domains, blocked domains, sharing policies, recipient consents, minimal events, and notification outbox/jobs.
- Enforce least-privilege IAM, encrypted storage, restricted image access, token validation, and backend authorization.
- Implement API input validation, pagination, idempotency, structured logging, alarms, and infrastructure environments.
- Design durable notification outbox with DynamoDB transactions and asynchronous processing; prepare SES identity verification.

**Deliverables:** Secured development infrastructure, shared API contracts, deploy pipeline.

**Acceptance:** Authenticated operations work; unauthorized group access is rejected; infrastructure is reproducible.

## Phase 4 — Accounts and groups

**Goal:** Support private membership-based groups with two roles.

**Tasks:**
- Implement Cognito sign-up, email verification, sign-in/out, recovery, and profile editing.
- Create groups with name and optional picture; creator becomes Admin.
- Implement admin invitations, joining, member lists, removal, and leaving.
- Enforce Admin/Member permissions server-side; require sole admins to transfer ownership or dissolve before departure.
- Support membership in multiple groups, with **one active protection group per extension installation** in v1.
- Design accessible onboarding and group-management interfaces.

**Deliverables:** Account pages, group dashboard, invitations, membership lifecycle.

**Acceptance:** Two accounts can join a group; permissions and lifecycle transitions are tested.

## Phase 5 — Domain protection and confidential blocklists

**Goal:** Enforce three domain categories without an approval workflow.

**Rules, in priority order:**
1. **Platform essential allowlist** — services such as Facebook, Messenger, YouTube, Gmail, Outlook, Google account services, Microsoft 365, and Teams are exempt from group blocking. Validate parent/wildcard overlap and dependencies.
2. **Admin non-negotiable blocked domains** — only Admin can add/remove; qualifying navigation attempts are blocked and eligible for accountability notifications.
3. **Additional blocked domains** — Admin and Member may add immediately **without approval**; only Admin may remove; blocked without accountability alerts by default.

**Tasks:**
- Normalize and validate hostnames, internationalized domains, subdomains, and public suffixes; reject unsafe broad rules.
- Implement Chromium declarativeNetRequest and a Firefox-compatible enforcement adapter.
- Implement versioned rule synchronization, local cache, offline enforcement, and group switching.
- Build admin-only full blocklist UI/API; members can submit domains but cannot list entries or infer duplicates from API responses.
- Clearly document that a skilled user can inspect local extension rules or probe sites: secrecy is at the interface/API layer, not a cryptographic guarantee.
- Ensure essential-domain exemptions override group rules, without making promises about system-wide DNS or device-level filtering.

**Deliverables:** Policy engine, admin console, member submission UI, browser adapters.

**Acceptance:** All categories enforce correct precedence; member submissions require no approval; removal is admin-only; essential services remain reachable.

## Phase 6 — On-device AI media protection

**Goal:** Blur potentially sensitive images and supported video frames locally.

**Tasks:**
- Prototype packaged NSFWJS/TensorFlow.js model; evaluate classification accuracy, model size, browser compatibility, and inference cost.
- Observe static/dynamic media, apply temporary protective blur, classify locally, and retain/remove blur by policy.
- Add bounded inference queues, deduplication, lazy-loading support, and conservative failure behavior.
- Sample supported video frames where technically possible; handle cross-origin restrictions and unsupported media transparently.
- Keep webpage media and classification results out of AWS and telemetry.

**Deliverables:** Local classifier, blur controller, settings, performance/accuracy evaluation.

**Acceptance:** Representative media tests pass with measured false positives/negatives; no media is transmitted.

## Phase 7 — Voluntary accountability and consent

**Goal:** Let each member independently control who receives their alerts.

**Sharing modes:** `PRIVATE` (default, no alerts); `SELECTED` (selected consenting group members); `EVERYONE` (all other consenting group members).

**Tasks:**
- Build per-user sharing settings and recipient consent/withdrawal.
- Support one-way and bilateral accountability without requiring reciprocity.
- Ensure admins cannot override a member's sharing choices.
- Resolve recipients server-side using current group membership and consent.
- Prevent retroactive exposure of events when settings change.

**Deliverables:** Sharing settings, consent screens, backend policy resolver.

**Acceptance:** Private, selected, everyone, unilateral, mutual, and revoked-consent scenarios pass.

## Phase 8 — Exactly two notification triggers

**Goal:** Send reliable, minimal, consent-aware email alerts.

**Trigger A — Qualifying non-negotiable navigation:**
- Block navigation; distinguish intentional top-level navigation from background requests, ads, and redirects where feasible.
- Use conservative event qualification; avoid relying on Chromium debug-only rule-match APIs in production.
- Authenticate extension event submissions, apply idempotency, cooldowns, rate limits, and deduplication.
- Resolve only consenting recipients under the sender's current sharing policy.
- Send generic notifications with no domain, URL, page title, screenshot, or browsing history.
- Explain that extension-reported events are not cryptographic proof of deliberate behavior.

**Trigger B — Group departure:**
- On leaving or admin removal, snapshot **pre-departure** sharing preferences and recipient consents.
- Atomically end membership and record an outbox event before access is revoked.
- Process asynchronously through DynamoDB Streams/outbox worker, SQS, notification Lambda, and SES.
- Notify only eligible recipients; no accountability alert if sender's pre-departure mode was Private.

**Deliverables:** Two event pipelines, generic email templates, retry/DLQ strategy, delivery monitoring.

**Acceptance:** Both triggers work; no other alert triggers exist; duplicate, revoked-consent, and failure/retry cases pass.

## Phase 9 — QA, security, privacy, and cross-browser validation

**Goal:** Verify correctness, reliability, and honest limitations.

**Tasks:**
- Unit/integration/E2E tests with Vitest and Playwright; manually test Chrome, Brave, Edge, Firefox.
- Test role escalation, confidential blocklist API exposure, duplicate submissions, allowlist precedence, stale rules, offline sync, and group removal.
- Test classification accuracy/performance and video/cross-origin limitations.
- Test consent withdrawal, group departure transactions, queue retries, event spoofing/rate limits, and accidental navigation.
- Perform dependency/security scans, accessibility checks, privacy/data-retention review, and operational runbooks.
- Document that user-controlled browser extensions can be disabled/uninstalled and cannot guarantee enforcement outside supported browsers.

**Deliverables:** Test report, threat model, bug backlog, release checklist.

**Acceptance:** Critical security and functional acceptance criteria pass; remaining limitations are clearly disclosed.

## Phase 10 — Beta, deployment, and branded release

**Goal:** Release a trustworthy, polished beta before broad distribution.

**Tasks:**
- Deploy production Terraform resources and Next.js dashboard (Amplify Hosting).
- Configure production Cognito, SES sending identity, monitoring, alarms, and incident response.
- Build signed/packaged browser releases as required by each store.
- Publish landing page, onboarding, privacy policy, terms, support information, and store screenshots using Resolve branding.
- Run a limited beta, collect opt-in feedback without browsing-history collection, fix defects, and document release notes.
- Prepare public launch only after cross-browser store requirements and privacy reviews are satisfied.

**Deliverables:** Production dashboard, installable extensions, branded launch materials, support and monitoring.

**Acceptance:** A new beta user can register, join a group, enable protection, configure consent, and exercise both alert triggers.

## Phase 11 — Focus Mode (post-launch v1.1)

**Status:** Implemented 2026-11-26 (extension 0.2.0). Timer revision 2026-11-26 (owner
request, extension 0.3.0): Focus Mode is now a timed session (presets 15/25/30/45/60 or 5–240
custom minutes) that ends by itself at a persisted deadline (alarm plus a deadline check on every
worker start and status read). Ending early takes two steps: typing exactly
`Yes, this is an emergency.`, then confirming **Yes — End Focus Mode** (or **No — Keep
Focusing**). The rule range, isolation and the five + three sites are unchanged.

**Implementation notes:** `apps/extension/lib/focus.ts` holds the service-domain map and controller.
Focus owns declarativeNetRequest rule IDs 100000–100999 and only ever touches that range. Its rule
blocks group-exempt services (essential exemptions are scoped to group rules), while a group block
on the same request still wins, so group blocks and Trigger A reporting are unchanged.
accounts.youtube.com stays reachable for Google sign-in, and Messenger is not covered. With site
access (asked once) blocked visits redirect to the branded `focus.html`; otherwise the browser's
block page is shown. Verified by unit tests and real-browser Playwright specs in Chromium, Microsoft
Edge and Brave; the Firefox build uses the same rules with a plain block page and is not
browser-tested.

**Goal:** Provide a straightforward, voluntary way to reduce distracting browsing. Users simply turn Focus Mode **On** or **Off**; there are no activity/purpose categories.

**Product principles:**
- Focus Mode is personal and independent of group accountability. It does not send alerts to partners or introduce new accountability notification triggers.
- The only main control is a clear **Focus Mode On/Off switch** in the extension. Do not ask users to select Deep Work, Studying, Prayer & Devotion, Personal Time, or any other purpose.
- When enabled, Focus Mode blocks **Facebook, Instagram, X/Twitter, TikTok, and Reddit** by default.
- **YouTube, Netflix, and Twitch** are individually optional Focus Mode restrictions, disabled by default until a user chooses to include them.
- Focus Mode applies only to the user's own browsing; it never edits the platform essential allowlist, group policy rules, group permissions, or accountability-sharing preferences.
- A user-selected Focus restriction may temporarily block a site exempt from **group** restrictions (for example Facebook or YouTube). This is a separate, higher-priority personal Focus layer; when Focus Mode is Off, the existing group exemptions still apply.
- Focus Mode never weakens existing group blocking. Turning it off removes **only Focus Mode rules**, not group policy rules.
- Local settings and state remain on-device by default. No page content, screenshots, or browsing history are collected or sent to AWS.
- Be transparent that browser extension enforcement can be disabled or bypassed; do not claim Focus Mode is tamper-proof.

**Default blocked services while Focus Mode is On:**

| Service | Default | Scope |
| --- | --- | --- |
| Facebook | Blocked | Main site and appropriate web subdomains |
| Instagram | Blocked | Main site and appropriate web subdomains |
| X / Twitter | Blocked | Both `x.com` and `twitter.com` and relevant web subdomains |
| TikTok | Blocked | Main site and appropriate web subdomains |
| Reddit | Blocked | Main site and appropriate web subdomains |
| YouTube | Optional; Off by default | Block when the user enables the YouTube option |
| Netflix | Optional; Off by default | Block when the user enables the Netflix option |
| Twitch | Optional; Off by default | Block when the user enables the Twitch option |

Define and test a maintainable domain mapping for each service, including recognized alternate domains where needed. Restrict only the intended sites: avoid blanket wildcard rules that accidentally break unrelated services. In particular, verify Facebook/Messenger separation, Google account services, and YouTube versus essential Google functionality.

**Core user journey:**
1. Open the Resolve extension and navigate to **Focus Mode**.
2. See one main switch labeled **Focus Mode**, initially Off.
3. Optionally choose whether Focus Mode should also restrict **YouTube**, **Netflix**, and/or **Twitch** using three simple secondary toggles. The five default services cannot be unchecked while Focus Mode is On.
4. Turn **Focus Mode On**. Immediately activate the Focus blocking rules. Show a clear **Focus Mode is On** status.
5. An attempt to open a Focus-blocked site displays a simple branded page: **“Focus Mode is on”**, with a brief explanation and a safe way back. Do not display a timer when no timer exists.
6. Turn **Focus Mode Off** to remove its temporary restrictions and restore access to sites that are not separately blocked by active group rules. The optional-site selections remain saved locally for next time.

**On/Off behavior and scope:**
- No purpose selection, mandatory duration, session presets, countdown, Pomodoro cycle, or automatic expiration in v1.1. Focus Mode remains enabled until the user turns it Off or enforcement is unavailable.
- An explicit Off action should be straightforward. Do not require typed phrases, multi-step confirmation dialogs, CAPTCHAs, or an emergency-exit challenge for a simple toggle.
- If the user disables Focus Mode, remove only the Focus-specific dynamic rules. Never clear, overwrite, or bypass the group policy.
- Persist the chosen switch state and optional-site toggles locally, and restore the intended policy after supported browser/extension restarts.
- Provide truthful status if an extension lacks a permission or the browser cannot enforce some rule; never display a misleading “On/protected” state.
- Focus Mode blocks navigation in the supported browser extension only; it is not system-wide filtering.

**Engineering tasks:**
- Add a simple Focus Mode switch to the extension popup/options, plus three optional site toggles for YouTube, Netflix, and Twitch.
- Build a local Focus policy module for the fixed default services and optional service selections, with cross-browser domain normalization and tests.
- Implement activation/deactivation and startup recovery through the extension background runtime, independent of whether the popup is open.
- Apply rules using Chromium declarativeNetRequest and a compatible Firefox adapter where supported; isolate Focus rule IDs/state from all group rules.
- Build a branded, accessible Focus restriction page with no unnecessary settings or timer.
- Handle browser restarts, already-open tabs, subdomain/redirect behavior, changes to optional selections while enabled, offline usage, and inconsistent rule state.
- Verify Focus restrictions on group-exempt websites without altering the underlying essential allowlist, and check that sign-in/Messenger and unrelated services remain functional.
- Keep storage minimal: the enabled flag, three optional booleans, and any enforcement metadata needed for recovery. Do not create a focus-history database or transmit browsing events.
- Test mouse/keyboard interactions, reduced-motion behavior, rule cleanup, extension limitations, and every supported browser.

**Deferred enhancements:** timed sessions shipped in 0.3.0; the rest (schedules, Pomodoro cycles, personal site lists, statistics) is in [ROADMAP.md](ROADMAP.md#extension).

**Deliverables:** Simple extension Focus Mode UI; fixed service blocklist with three optional services; isolated local browser enforcement; branded restriction page; reliable On/Off state and restart recovery; cross-browser tests.

**Acceptance:** With the switch On, Facebook, Instagram, X/Twitter, TikTok, and Reddit are restricted, while YouTube/Netflix/Twitch are restricted only when individually opted in. The switch can be turned Off without friction, removing Focus rules while leaving every active group restriction and the two existing accountability alert triggers unchanged. State persists across supported restarts; the UI accurately reflects actual enforcement; no Focus browsing history is collected or sent.

## MVP release acceptance checklist

- [ ] Resolve branding, tagline, icons, and accessible design system are consistent.
- [ ] Extension and dashboard build reliably.
- [ ] AWS authentication, authorization, and infrastructure work.
- [ ] Users can create/join/leave private groups.
- [ ] Admin and Member permissions are enforced.
- [ ] Essential domains cannot be blocked by group rules.
- [ ] Admin non-negotiable domains block and support qualifying alerts.
- [ ] Members add additional domains without approval.
- [ ] Only admins remove domains or view the full list in the product UI/API.
- [ ] Extension syncs rules and enforces cached policies offline.
- [ ] Supported sensitive media is blurred locally without uploads.
- [ ] Private, Selected, Everyone, and bilateral accountability work.
- [ ] Recipients explicitly consent and may revoke consent.
- [ ] Qualifying restricted navigation generates privacy-preserving alerts.
- [ ] Group departure generates consent-aware pre-departure alerts.
- [ ] No URLs, screenshots, browsing history, or media are included in accountability notifications.
- [ ] Cross-browser, security, privacy, and reliability tests pass.
- [ ] Production launch materials accurately describe capabilities and limitations.

## Change control

Update [MASTER_PLAN.md](MASTER_PLAN.md) for architectural or requirement changes. Update this roadmap when phase deliverables or completion criteria change. Do not treat planning documents as evidence that functionality is implemented.
