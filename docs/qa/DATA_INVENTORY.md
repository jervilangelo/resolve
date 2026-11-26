<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Data inventory and retention

Everything Resolve stores, who can see it and how long it lives (Phase 9 privacy and data-retention
review, 2026-11-24). Use it for the privacy policy, deletion requests and store listings.

**Correct privacy claim (MASTER_PLAN §13):** images and video frames are processed on the device;
no browsing history or visited URLs are intentionally stored or sent in accountability events.
Resolve does store accounts, memberships, group domain policies, consent and limited delivery
metadata.

## Server side (AWS, ap-southeast-1)

| Data                                                      | Where                                                  | Contains                                                              | Who can read it                                                                 | Lifetime                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Account                                                   | Cognito user pool                                      | Email, password hash, verification state                              | The user; Cognito admins (operator)                                             | Until the account is deleted                                                    |
| Profile                                                   | `USER#<sub>` `PROFILE`                                 | Display name (optional)                                               | Members of the user's groups see the name                                       | Until deleted                                                                   |
| Group                                                     | `GROUP#<id>` `META`                                    | Name, counts, rule version, blocklist sets (non-negotiable/additional) | Members see the name; only admins see the lists                                 | Until dissolved (marker 30 days)                                                |
| Membership                                                | `GROUP#<id>` `MEMBER#<sub>`                            | Role, joined date                                                     | Fellow members                                                                  | Until leave/removal                                                             |
| Invitation                                                | `GROUP#<id>` `INVITE#…`, `INVITE#<hash>`, `REDEEMED#…` | Token **hash** only, use counts, expiry; who redeemed                 | Admins (list); nobody can recover the token                                     | Expiry + 1 day                                                                  |
| Blocked domain                                            | `GROUP#<id>` `DOMAIN#<domain>`                         | Domain, category, who added it, when                                  | Admins only (members can only submit)                                           | Until removed or group dissolved                                                |
| Domain audit                                              | `GROUP#<id>` `AUDIT#…`                                 | Domain, action, actor, time                                           | Admins only                                                                     | 1 year                                                                          |
| Sharing choice                                            | `GROUP#<id>` `SHARE#<sub>`                             | Mode, chosen member IDs, times                                        | The member; affected recipients see only that they were chosen                  | Until changed, the member leaves, or the group is dissolved                     |
| Consent                                                   | `GROUP#<id>` `CONSENT#<sub>`                           | "Accept all", accepted sender IDs, times                              | The member; senders see only whether each chosen member agreed                  | Same as above                                                                   |
| Consent audit                                             | `GROUP#<id>` `CAUDIT#…`                                | Action, mode/flag/sender ID, actor, time (no browsing data)           | Operator only (no API)                                                          | 1 year                                                                          |
| Trigger A markers                                         | `USER#<sub>` `EVENT#…`, `COOLDOWN#…`                   | Event ID; cooldown end (no URL, no domain)                            | Operator only                                                                   | 1 day / cooldown + 1 hour                                                       |
| Outbox item                                               | `OUTBOX#<id>`                                          | Kind, group/sender names and IDs, recipient IDs, times                | Operator only                                                                   | 30 days                                                                         |
| Delivery state                                            | `DELIVERY#<outbox>` `<recipient>`                      | Outcome (sent/skipped/rejected) and times; **no email address**       | Operator only                                                                   | 30 days                                                                         |
| Rate counters                                             | `USER#<sub>` `RATE#…`                                  | Counts per hour                                                       | Operator only                                                                   | 2 hours                                                                         |
| Idempotency                                               | `USER#<sub>` `IDEMP#…`                                 | Group ID for a create request                                         | Operator only                                                                   | 1 day                                                                           |
| Application logs                                          | CloudWatch                                             | Route template, status, duration, error code/name, correlation ID     | Operator only                                                                   | 14 days (dev), 90 days (prod)                                                   |
| API access logs                                           | CloudWatch                                             | Route template, status, timing (no paths, IPs or user agents)         | Operator only                                                                   | 14 days (dev), 90 days (prod)                                                   |
| Delivery metrics                                          | CloudWatch metrics                                     | Counts by outcome and kind                                            | Operator only                                                                   | CloudWatch default                                                              |
| Alert emails                                              | Recipients' mailboxes (via SES)                        | Sender's name, group name, generic text                               | The recipient                                                                   | Outside Resolve's control once sent                                             |
| Avatar bucket                                             | S3 (private, versioned)                                | Not yet used                                                          | —                                                                               | Replaced versions 7 days                                                        |

Never stored server side: visited URLs, hostnames of visited pages, page titles, screenshots,
images or video frames, classification results, browsing history, email addresses outside
Cognito (the worker looks them up at send time and does not keep them).

## On the device (extension)

| Data                       | Where                                   | Contains                                                      | Lifetime                            |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Session                    | Extension-origin IndexedDB              | Tokens, email, active group (unreachable by content scripts)  | Until sign-out                      |
| Group rules cache          | Extension-origin IndexedDB              | Compiled block rules for the active group                     | Until group switch or sign-out      |
| Media filter settings      | Extension-origin IndexedDB              | On/off, sensitivity, fallback                                 | Until changed                       |
| Focus Mode settings        | Extension-origin IndexedDB              | Running session's start and end time, last duration, the three optional sites (no visits, no history; the emergency phrase is never stored) | Until changed; a session clears at its end |
| Media verdict cache        | Worker and page memory only             | Scores per image URL (worker), verdicts per URL (page)        | Until the worker or page goes away  |
| Navigation tracking        | Worker memory only                      | Per tab: host a navigation started at, last page host and time, last blocked host and time | Until the tab closes or the worker stops |
| Alert cooldowns            | Extension-origin IndexedDB              | Per sign-in and group: time of the last report (no URL)       | 10 minutes (expired entries dropped) |
| Setup checklist answer     | Sent to the dashboard page only (same browser, its exact origin) | Two yes/no facts: signed in, media blurring on. Not stored by the dashboard or sent to the server | Not kept (asked on each visit) |

## Deletion

- **Leave/removal** deletes the membership, the member's sharing and consent in that group.
- **Dissolve** deletes the whole group partition (best effort within 5 s; leftovers are inert and
  expire or are swept later).
- **Account deletion** is self-service (profile page, `DELETE /v1/me`): it leaves every group
  through the normal departure path, dissolves groups where the user is the only member, deletes
  the user's partition and the Cognito account, and writes a 2-hour tombstone so tokens issued
  before deletion are refused. Kept until they expire: the user's ID as "added by" on blocked
  domains and in domain/consent audits (1 year), in other members' sharing/consent lists (until
  they change them), and their display name in outbox items (30 days).
