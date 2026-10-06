# Production readiness and owner-run smoke checks

Current checklist: 2026-10-06. Production state remains unverified. Baseline `201bc07` is pushed; final hardening is an uncommitted, undeployed candidate. No database, index, deployment or secret was changed during this hardening. Current CODE FIXED evidence is documented in [the final stabilization report](FINAL_STABILIZATION_REPORT.md); all checks below REQUIRE LIVE PRODUCTION VERIFICATION with owner-selected disposable accounts. Never run local fixtures against production.

Frontend: https://acadova-ze91.onrender.com

Backend: https://acadova-api.onrender.com (read-only health: `/api/health`).

## Configuration references, names only

| Service | Required or conditional names |
| --- | --- |
| Backend core | `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `FRONTEND_ORIGIN` |
| Verification/recovery mail | `BREVO_API_KEY`, `MAIL_FROM`; verify provider/domain delivery separately |
| Frontend build | `VITE_API_URL` |
| Optional Google | backend `GOOGLE_CLIENT_ID`, frontend `VITE_GOOGLE_CLIENT_ID`; matching audience, HTTPS origin and consent required; Calendar API and calendar.events authorization are needed for optional Meet generation (no client secret/refresh-token architecture is introduced) |
| Optional push | backend `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `ONESIGNAL_IDENTITY_SECRET`; frontend `VITE_ONESIGNAL_APP_ID` |
| Proxy identity | backend `TRUST_PROXY_CIDRS`, only operator-verified immediate proxy IPs/subnets; absent means direct socket identity |
| Reminder tuning | `MESSAGE_PUSH_COOLDOWN_MINUTES`, `UNREAD_REMINDER_MINUTES`, `SESSION_REMINDER_MINUTES`; worker `DNS_SERVERS` when needed |

Do not place server secrets in `VITE_*`. Build variables require a frontend rebuild. CORS uses `FRONTEND_ORIGIN`; email/reset links use `FRONTEND_URL`. Set both to the deployed HTTPS frontend. Transactions require a replica set, including Session creation, request acceptance and accepted reschedule commitments after final stabilization; never infer deployed indexes from source declarations. API startup and reminder worker have different DNS handling, so check worker connectivity separately. Current hosting does not continuously schedule reminders; `npm run notifications:scan` remains an operator-run action.

## Final stabilization transaction checks

This pass adds no schema migration or correctness index. Do not create/drop production indexes for its duplicate/conflict checks. The existing User-record transaction serialization is authoritative; verify real replica-set write conflicts and driver transaction retries with disposable accounts before sign-off. Creation locks both eligible Students before matching same participant pair, normalized subject and exact agreed/proposed UTC instant. Acceptance/reschedule acceptance locks both participant records and checks both Learner/Tutor commitments at that exact time. Pending alternatives are allowed; no interval end time is inferred. Legacy missing-time acceptance remains compatible.

Verify pre-check-in scheduled cancellation versus a concurrent check-in; it must not mutate a started/settled Session. Verify the installed Mongoose login pipeline against real MongoDB, persisted counters/cooldowns/reset and selected audit events. Local regression exercises actual Mongoose 9.9.3 query construction with a stubbed collection boundary; it is not proof of production pipeline execution.

## Database requirements

Verify keys, uniqueness and partial/sparse definitions using the existing rollout documents before enabling their workflows. Do not automatically drop/rebuild indexes or backfill balances.

| Collection/model | Required correctness indexes |
| --- | --- |
| User | unique email; sparse unique `emailVerificationTokenHash`; sparse unique `uniq_user_google_sub` before enabling Google |
| CreditTransaction | `uniq_session_payment_session`, `uniq_initial_grant_recipient`, `uniq_assessment_reward_recipient_assessment`, `uniq_learning_unlock_ledger_resource`, `uniq_learning_unlock_ledger_module`, `uniq_admin_adjustment_reference` |
| LearningUnlock | `uniq_learning_unlock_student_resource`, `uniq_learning_unlock_student_module` |
| LearningTopic | `uniq_learning_topic_slug` |
| Notification | `uniq_notification_event_key` |
| Rating | unique Session/fromUser pair |

Public reputation now aggregates visible reviews before discovery sorting; the current Rating schema has no toUser index. Verify representative production query performance and plan any approved index rollout separately. Also review the documented AuditLog, recipient/read/push, skill-discovery and topic/module/resource query indexes for performance. Use existing guides under `acadova-backend/docs/`: phase3 credit verification, assessment reward, learning topic/unlock, Admin credit, AuditLog and P5 notification rollouts. P7 authentication revocation adds an optional hidden session-version field, with no new index or backfill. Deploy issuer and verifier changes together. Existing token-without-version remains valid only while the account's version is absent; password recovery revokes it. Google claiming an explicitly unverified account discards its untrusted local password/recovery state; the owner can use normal recovery later.

## Safe proxy/rate-limit verification (H2)

- [ ] Obtain the actual immediate proxy socket addresses, forwarding-header behavior and permitted network path from the hosting configuration/operator. Repository evidence does not prove Render's hop topology; local loopback tests are not deployed proof.
- [ ] Set `TRUST_PROXY_CIDRS` only to verified explicit IPs/non-global CIDRs. Never use boolean trust, guessed hop counts, names, wildcard or `/0`. Absent/blank leaves trust disabled; malformed configuration must fail before database bootstrap. Do not broadly trust a network that also admits arbitrary clients.
- [ ] Ensure the trusted proxy overwrites or appends the true source to `X-Forwarded-For`, and direct access cannot present itself as a trusted proxy. Verify actual `req.ip` privately without logging credentials or publishing client addresses.
- [ ] From two legitimate clients behind the proxy, verify distinct limiter identity. Prepending a forged forwarded address must not bypass the existing throttle. With an untrusted direct source, forwarded headers must not change identity. Keep existing thresholds; do not flood production.

## Transaction/index and deployment gates

- [ ] Inspect real replica-set transaction support. Test new request creation, settlement, grants, unlocks and Admin adjustments with rollback/idempotency using disposable accounts. Verify request-versus-promotion/suspension race behavior in the real candidate environment.
- [ ] Inspect deployed index definitions, not just their names. In particular, a legacy unfiltered unique `session_1` CreditTransaction index can conflict with non-session transactions. Follow existing rollout guides and owner-reviewed migration planning; this checklist does not authorize creating/dropping indexes.
- [ ] Verify the exact backend/frontend candidate revision after a separately authorized release. A pushed baseline or successful build is not evidence this uncommitted patch is deployed.
- [ ] Refresh SPA deep routes (`/learning`, `/sessions/:id`, `/moderator/learning#manage-panel-resources`, `/admin/users`) on Render. Hash routing still requires the path to return the frontend document. Verify API health, CORS and configured HTTPS URLs independently.
- [ ] Reminder delivery needs an explicit operator-run/scheduled `npm run notifications:scan`; API startup does not start a continuous reminder worker. Check worker DNS/connectivity and capped cooldown/reminder behavior without sending unintended real alerts.

## Owner-run smoke sequence

“Writes” means creates/changes real production records; those steps require explicit owner authorization and disposable accounts. Keep passwords, tokens, auth headers and provider details out of screenshots/reports.

| Step | Exact check | Production records |
| --- | --- | --- |
| 1 | Open frontend and backend health; check expected origin, HTTPS, navigation and absent broken optional Google control | Read only |
| 2 | Register chosen disposable Student, scroll policies, acknowledge and agree explicitly; confirm required validation | Writes User/policy/verification state; sends email |
| 3 | Open received verification, confirm single use, login; check grant exactly once | Writes verification/grant/ledger and login state |
| 4 | Finish onboarding; use a second disposable Student to Skip, logout/login and edit Profile | Writes profile/setup |
| 5 | Forgot Password shows generic result and received link points at correct HTTPS frontend; user enters new password; prior session is rejected | Writes recovery/credential/session version; sends email |
| 6 | Discover selected disposable teaching Student, inspect profile, request, accept, propose/accept reschedule | Writes Session and notifications |
| 7 | Tutor saves manual HTTPS meeting URL; learner sees Join and cannot overwrite it; confirm visible long-page toast | Writes coordination; no provider OAuth required |
| 8 | Exchange one synthetic message; keep draft through 3 polls and inspect participant notification | Writes messages/notifications/read state |
| 9 | Within legitimate time guards, check in both, finish, confirm both, inspect balances/history/review; reopening doesn't duplicate transfer | Writes lifecycle, ledger, balances, review and notifications |
| 10 | Use owner-approved published topic/module; navigate ordered lessons, assessment pass/retry, then optional paid unlock with chosen spend limit | Writes assessment/reward/balances/resume pointer; paid entitlement/ledger if exercised |
| 11 | Selected Moderator checks queue and owner-approved disposable conflict/content item; verify evidence, resolution and audit | Writes only if resolving/reviewing; no destructive item chosen automatically |
| 12 | Admin checks Users/Audit/Security; inspect one approved test-account cooldown/recovery case; avoid flooding | Read only browsing; login cases write security state/audit |
| 13 | Student/Moderator direct-route boundaries and unrelated Session access denied | Read only unless a forbidden write is attempted; expected no mutation |
| 14 | Desktop, tablet/narrow, 390 px; toast, modal, chat, tables, focus and long-page navigation | Read only |

Record actual deployment revision, configuration-name presence, index verification, observed outcome and screenshot for each step. Mail, OAuth, push, worker delivery and deployed database state must be verified on the real deployment; local mocked tests do not establish them. Do not declare production verified or final manual sign-off complete until the current [five-demo rehearsal](DEFENSE_CHECKLIST.md) and authorized production smoke outcomes are recorded. Historical P7/P7.1A/P7.1B reports retain their original validation counts.
