# Resolve — Development & Branding Roadmap

> **Take every thought captive.**  
> Biblical inspiration: 2 Corinthians 10:5. Historical inspiration: Jonathan Edwards' *Resolutions*.

**Status:** Planned. **Schedule:** Phase-based, with no fixed dates or duration estimates.  
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

## Phase 11 — Focus Mode & Intentional Exit (post-launch v1.1)

**Status:** Planned for after Phase 10; not part of the initial MVP.

**Goal:** Add an optional, privacy-first, extension-native focus timer that temporarily restricts user-selected distracting websites and encourages deliberate decisions before ending a session early.

**Product principles:**
- Focus Mode is voluntary, controlled by the individual user, and separate from group accountability.
- Focus activity, selected websites, and basic session statistics stay on-device by default; no browsing history or page content is uploaded.
- Focus Mode creates **no new accountability notification triggers**; existing v1 alert triggers remain unchanged.
- User-selected Focus restrictions may cover otherwise group-exempt sites (such as Facebook or YouTube), but group-level essential-service exemptions and group block rules must remain unchanged.
- Focus restrictions cannot weaken or remove active group protection. Focus Mode is not tamper-proof, and the user retains ultimate control of their browser.

**Core user journey:**
1. Open the Resolve extension and choose Focus Mode.
2. Select a purpose (for example Deep Work, Studying, Prayer & Devotion, or Personal Time), a duration (presets such as 25, 60, 120, or 180 minutes), and websites to restrict.
3. Choose common distraction sites (Facebook, Instagram, X/Twitter, TikTok, Reddit, optionally YouTube/Netflix/Twitch) and/or enter custom domains. Validate domain inputs and explain subdomain coverage.
4. Click **Start Focus Mode**. Activate temporary browser-specific blocking rules and show the remaining time in the extension.
5. On attempted navigation to a selected website, show a branded Resolve focus page with the remaining time and an option to return to productive browsing.
6. At the scheduled end, automatically lift **only** the temporary Focus Mode restrictions and show a private completion summary.

**Intentional Exit — early termination flow:**
- The active-session interface offers **Stop Focus Mode**.
- **Step 1: “Is this an emergency?”** Require the exact typed phrase `Yes, this is an emergency.`
- **Step 2: “Are you sure?”** Show **Yes** and **No** buttons; No returns to the active session.
- **Step 3: “Like, really really sure?”** Require the exact typed response `Yes`.
- On completion of all three steps, end the session, remove its temporary rules, and mark the session as stopped early.
- The countdown continues during confirmation. Closing the popup or abandoning the flow does not end the session; normal expiration still ends it.
- Offer a clearly identified immediate emergency/accessibility override so urgent access is not delayed by the confirmation flow.
- **No CAPTCHA, Cloudflare Turnstile, or external verification service** is required.

**Engineering tasks:**
- Add extension popup/options UI for purposes, duration presets, selected sites, custom domains, and saved presets.
- Implement a background session controller with persistent start/deadline timestamps, browser alarms, local state recovery, and offline operation; avoid relying on a continuously running popup timer.
- Enforce temporary restrictions through Chromium declarativeNetRequest and a Firefox-compatible adapter where supported; document browser differences.
- Keep Focus rules and IDs isolated from group policy rules; ending or expiring Focus must never clear group blocks.
- Handle restarts, stale/expired rules, already-open tabs, subdomains, invalid domains, browser clock changes, and interrupted confirmation flows.
- Store minimal local session summaries (purpose, planned duration, completion/early stop); provide deletion controls and avoid storing visited URLs.
- Test accessibility, keyboard-only interactions, emergency override, performance, and extension disable/uninstall limitations.

**Deferred enhancements (v1.2+):** Pomodoro cycles and breaks, recurring schedules, advanced private analytics, optional Scripture prompts, distraction-free YouTube controls, and opt-in cross-device settings sync.

**Deliverables:** Extension-native Focus Mode UI, temporary website-blocking controller, branded restriction page, three-step Intentional Exit, local session persistence/recovery, privacy-preserving summaries, and cross-browser test coverage.

**Acceptance:** A user can start a timed session, block chosen sites, see a focus page on attempted navigation, complete or intentionally end the session, and regain access when Focus ends. All three early-exit confirmations function in sequence; urgent override remains accessible; Focus data is local by default; group restrictions and the two existing accountability triggers are unaffected.

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
