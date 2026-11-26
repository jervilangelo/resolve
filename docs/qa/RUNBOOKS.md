<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Operational runbooks

What to do when something goes wrong (MASTER_PLAN §16). Commands assume the AWS CLI is signed in
(`aws login`) for the account and region of the stack (dev: `ap-southeast-1`, names `resolve-dev-*`).
Never paste tokens, emails or user data into tickets or chat; use user IDs (`sub`) only.

## Alarm: `…-notification-delivery-dlq-not-empty` or `…-delivery-stuck`

Alert emails are failing repeatedly or not being processed.

1. Worker errors: CloudWatch Logs `/aws/lambda/resolve-<stage>-notification-worker`; look for
   `Delivery failed; will retry` and its `errorName`. Delivery outcome counts are in the
   `Resolve/Notifications` metrics.
2. Common causes: SES sending paused or sender identity unverified (see "SES suspension");
   Cognito or DynamoDB throttling; no worker deployed (sender email unset).
3. After fixing the cause, replay: in the SQS console, "Start DLQ redrive" from the DLQ to
   `resolve-<stage>-notification-delivery`. Replays are safe: each recipient is claimed once and
   items older than 24 hours are dropped rather than sent late.

## Alarm: `…-outbox-relay-failures-not-empty`

The stream relay could not forward outbox items to the queue. Each message names a stream batch.
Fix the relay error (logs: `/aws/lambda/resolve-<stage>-outbox-relay`), then for each affected
outbox item send `{"outboxId":"<id>"}` to the delivery queue. Items expire after 30 days.

## SES suspension or bounce/complaint spike

1. `aws sesv2 get-account` — check `SendingEnabled` and enforcement status.
2. Stop the bleeding: if complaints come from one group, consider asking its admin to review
   sharing. Never send from another identity.
3. Resolve the AWS case, then redrive the DLQ (above).
   (Bounce/complaint handling is in the backlog; until then, monitor in the SES console.)

## Accidental broad block / policy rollback

An admin blocked something that breaks members' browsing.

1. The admin removes or reclassifies the domain in the dashboard; extensions pick it up on their
   next sync (within 15 minutes, or immediately from the popup's retry/reselect).
2. If an essential service was blocked, add it to the essential registry
   (`packages/domain-policy/src/essential.ts`), bump `ESSENTIAL_VERSION`, deploy: every extension
   re-syncs and the essential is excluded inside every rule.

## Group ownership recovery

The only admin lost access. Verify the request with another member out of band, then promote a
member by writing `role = ADMIN` on `GROUP#<id>` / `MEMBER#<sub>` and incrementing `adminCount` on
`META` in one transaction (`aws dynamodb transact-write-items`). Record what was done and why.

## Compromised token or account

1. `aws cognito-idp admin-user-global-sign-out --user-pool-id <pool> --username <email>` revokes
   refresh tokens; access tokens expire within their lifetime (1 hour).
2. Reset the password (`admin-reset-user-password`) or disable the user (`admin-disable-user`).
3. Review the domain audit of the user's groups (admins see it in the dashboard).

## Consent complaint ("I got an alert I did not agree to")

1. Check the recipient's consent item `GROUP#<id>` / `CONSENT#<recipientSub>` and the consent audit
   `CAUDIT#…` (actor, action, time; no browsing data).
2. Check the delivery record `DELIVERY#<outboxId>` / `<recipientSub>` for the outcome.
3. If a defect is suspected, treat it as a privacy incident: preserve evidence, fix, and notify
   affected users as appropriate.

## Data deletion request

1. Identify the user's `sub` from their verified email (Cognito).
2. For each group (`GSI1` query on `USER#<sub>`): if they are the only admin, ask them to promote
   someone or dissolve; otherwise remove the membership via the API (this also deletes their
   sharing and consent and may send a departure alert to members who opted in).
3. Delete `USER#<sub>` items (profile, rate counters, event markers) and the Cognito user.
4. Outbox and delivery records expire within 30 days; domain audit rows naming the user as actor
   expire within a year (they contain only a domain and an action).

## Working with production

Production is a separate AWS account (`514009713156`). From the management account's CLI session:
`aws ... --profile resolve-prod`. Terraform cannot use that profile directly with `aws login`
sessions, so export credentials first:
`eval "$(aws configure export-credentials --profile resolve-prod --format env)"; unset AWS_PROFILE`.
Routine deploys go through the "Deploy prod" workflow (manual, owner approval).

## Deploy failed or needs rollback

Deploys run from `main` through "Deploy dev". To roll back, revert the offending commit on `main`
(never force-push); the pipeline re-applies the previous state. Terraform state is in the
encrypted, versioned state bucket if a manual recovery is needed.

## Switching to the custom domain

The domain module (Route 53 zone, SES domain identity, Amplify domain) is applied first; the
dashboard and the alert sender switch only when everything verifies, because an unverified sender
is rejected by SES and an unissued certificate breaks the address.

1. At the registrar, set the nameservers to the zone's (`terraform output name_servers` in prod).
2. Wait until all three are verified:
   - `nslookup -type=NS getresolved.site 8.8.8.8` lists the awsdns servers;
   - `aws sesv2 get-email-identity --email-identity getresolved.site` shows
     `VerifiedForSendingStatus: true` and DKIM `SUCCESS` (MAIL FROM `SUCCESS`);
   - `aws amplify get-domain-association --app-id <id> --domain-name getresolved.site` shows
     `AVAILABLE`.
3. Change the default of `use_domain` to `true` in `environments/prod/variables.tf` (in code, so
   the Deploy prod workflow keeps it), commit and apply. Sign-in callbacks, CORS, alert links and
   the sender change together.
4. Rebuild the dashboard (`aws amplify start-job --app-id <id> --branch-name main --job-type
   RELEASE`): `NEXT_PUBLIC_*` values are fixed at build time.
5. Check: `https://www.getresolved.site` and the amplifyapp address redirect to
   `https://getresolved.site`; sign in; send a test alert to the SES simulator and check the
   headers (SPF, DKIM and DMARC pass, From "Resolve <no-reply@getresolved.site>").
6. Rebuild the beta extension with the new dashboard URL and send testers the new zip.
