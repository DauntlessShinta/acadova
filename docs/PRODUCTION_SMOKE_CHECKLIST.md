# Production readiness and owner-run smoke checks

Production state remains unverified. No production record, deployment, secret, index or account was changed during P7. The local fixtures must never run against production. Run this checklist only after remaining local visual checks pass and with owner-selected production test accounts.

Frontend: https://acadova-ze91.onrender.com

Backend: https://acadova-api.onrender.com (read-only health: `/api/health`).

## Configuration references, names only

| Service | Required or conditional names |
| --- | --- |
| Backend core | `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `FRONTEND_ORIGIN` |
| Verification/recovery mail | `BREVO_API_KEY`, `MAIL_FROM`; verify provider/domain delivery separately |
| Frontend build | `VITE_API_URL` |
| Optional Google | backend `GOOGLE_CLIENT_ID`, frontend `VITE_GOOGLE_CLIENT_ID`; matching audience, HTTPS origin and consent required |
| Optional push | backend `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `ONESIGNAL_IDENTITY_SECRET`; frontend `VITE_ONESIGNAL_APP_ID` |
| Reminder tuning | `MESSAGE_PUSH_COOLDOWN_MINUTES`, `UNREAD_REMINDER_MINUTES`, `SESSION_REMINDER_MINUTES`; worker `DNS_SERVERS` when needed |

Do not place server secrets in `VITE_*`. Build variables require a frontend rebuild. CORS uses `FRONTEND_ORIGIN`; email/reset links use `FRONTEND_URL`. Set both to the deployed HTTPS frontend. Transactions require a replica set; never infer deployed indexes from source declarations. API startup and reminder worker have different DNS handling, so check worker connectivity separately. Current hosting does not continuously schedule reminders; `npm run notifications:scan` remains an operator-run action.

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

Also review the documented AuditLog, recipient/read/push, skill-discovery and topic/module/resource query indexes for performance. Use existing guides under `acadova-backend/docs/`: phase3 credit verification, assessment reward, learning topic/unlock, Admin credit, AuditLog and P5 notification rollouts. P7 authentication revocation adds an optional hidden session-version field, with no new index or backfill. Deploy issuer and verifier changes together. Existing token-without-version remains valid only while the account's version is absent; password recovery revokes it. Google claiming an explicitly unverified account discards its untrusted local password/recovery state; the owner can use normal recovery later.

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

Record actual deployment revision, configuration-name presence, index verification, observed outcome and screenshot for each step. Mail, OAuth, push, worker delivery and deployed database state must be verified on the real deployment; local mocked tests do not establish them. Do not label P7 complete until the local visual checklist and authorized production smoke results are recorded.
