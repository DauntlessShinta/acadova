# Acadova

Acadova is a peer-to-peer academic learning platform. This README distinguishes the current implementation from the locked final scope that remains to be built.

## Canonical architecture

- **Frontend:** React + Vite in `acadova-frontend` is the canonical user interface.
- **Backend:** Node.js + Express in `acadova-backend` provides the REST API.
- **Persistence:** MongoDB through Mongoose.
- **Deployment:** Frontend and backend are separate deployment units. `VITE_API_URL` configures the React app's backend API origin. Repository configuration alone does not prove the current Render deployment state.
- **Legacy UI:** `acadova-backend/public` contains an older frontend that is still served for compatibility. It is deprecated, is not the canonical UI, and must not receive new features. Do not disable or remove it without explicit approval and regression testing.

## Roles

Account roles are `student`, `moderator`, and `admin`. Learner and Tutor describe a user's contextual relationship to a Session; they are not account roles.

## Currently implemented

- Registration, email verification, login, and JWT authentication.
- Authorization uses the current user and role loaded from the database; registration does not allow users to assign themselves moderator or admin access.
- Verification email delivery uses Brevo's HTTPS transactional email API. `FRONTEND_URL` builds verification links to the React frontend; `FRONTEND_ORIGIN` is used for CORS.
- Skills to learn/teach, tutor search and profiles, session requests, the existing session workflow, ratings/reviews, and session-related credit transactions.
- Existing API and application security controls.

The Session API retains legacy `accepted`/`rejected` values for deployed clients and also accepts canonical `scheduled`/`declined` decisions. Accepted or scheduled Sessions can exchange an explicit, peer-approved reschedule proposal. Both participants may check in from 15 minutes before until 4 hours after the agreed start; the second check-in atomically moves the Session to `in_progress`. The Tutor then finishes the canonical Session into `awaiting_validation`; both participants independently confirm, and the second confirmation completes the Session and settles credits in one database transaction. After the check-in window ends, a participant can report a no-show using backend attendance evidence; a participant can dispute an awaiting-validation or no-show Session. Moderator/Admin resolution records a valid or invalid outcome, with credits transferred only for a valid resolution. Normal Sessions need no Moderator approval. The existing legacy `accepted` -> `completed` path remains available without check-in during rollout, with its existing Learner confirmation/settlement. The legacy frontend remains served, but some of its flows do not match the current API.

The P2 Session lifecycle is implemented, but legacy compatibility remains active. No legacy status migration or historical backfill has been executed. The read-only inventory procedure and future migration safeguards are in [Session migration preparation](acadova-backend/docs/session-migration-plan.md).

Newly registered Students start with 0 spendable credits and receive one ledger-backed grant when they verify their email (default 100 credits). New tutoring Sessions use a backend-owned, activity-based cost (default 20 credits), independent of meeting duration; learners do not choose the price. Existing Sessions retain their stored historical cost. The Student wallet shows event-aware history for opening grants, tutoring transfers, and approved assessment rewards, while its spendable balance comes from the User account rather than a ledger sum. Moderator-approved multiple-choice Assessments are graded server-side; a first passing result earns the configured reward (default 20 credits) once per Student and Assessment, while failed and repeated passes earn none. Production assessment rewards require the separately approved [reward index rollout](acadova-backend/docs/assessment-reward-index-rollout.md); historical balances have not been backfilled.

P3.5A adds governed learning topics, Student-submitted text or HTTPS-link resources, Moderator/Admin publication and rejection, and simple ordered resource modules. P3.5B allows Students to unlock paid published resources and modules with internal credits. The backend owns each price; a first paid unlock atomically deducts credits, records a durable entitlement, and writes one outgoing `learning_unlock` ledger event. Free content needs no entitlement or transaction. Paid bodies/links are withheld until access is granted, and the wallet records the actual amount spent. A paid module entitlement allows viewing its ordered resources inside that module, not standalone paid-resource access. Assessments remain free and retain the existing one-time reward; new assessments may optionally reference a governed topic while legacy topic text still works. There is no real-money payment system, advanced LMS, or video hosting. Production topic creation requires the separately managed [unique slug index rollout](acadova-backend/docs/learning-topic-index-rollout.md); paid unlocks require the separately managed [unlock index rollout](acadova-backend/docs/learning-unlock-index-rollout.md).

P3.6 adds Admin-managed starting grants, tutoring Session costs, and assessment rewards (defaults 100 / 20 / 20, each 1–1000 whole credits). Rules apply to new events only: registration snapshots its starting grant, new Sessions store their cost, and rewarded attempts retain their actual award. Historical balances and ledger rows remain unchanged. Admin-only credit/debit corrections require a Student target, reason, actor, and idempotency reference; the balance change and `admin_adjustment` ledger row are atomic. Rule changes have a durable before/after actor record. Corrections fail closed in production until the separately managed [Admin adjustment index rollout](acadova-backend/docs/admin-credit-index-rollout.md) is complete. These credits have no real-money value.

Phase 3 credit activity is limited to `initial_grant`, `session_payment`, `assessment_reward`, `learning_unlock`, and `admin_adjustment`. New debits use conditional database balance checks; Admin analytics separates tutoring transfers from credits issued or spent. The read-only [credit verification and reconciliation guide](acadova-backend/docs/phase3-credit-verification.md) lists required unique indexes, a guarded `--dry-run` inventory command, legacy-balance limitations, and final E2E checks. Recorded ledger totals are not a lifetime balance reconstruction for older accounts.

P4 adds persistent append-only AuditLog records for Moderator dispute/content/review actions and Admin credit, role, and account-status actions. These privileged mutations and their required audit evidence share MongoDB transactions. Admins can browse bounded, filtered audit pages; Moderators do not receive global audit access. Admins may suspend/reactivate non-Admin accounts with a reason, and suspension blocks both new login and already-issued JWT access without deleting historical activity. P4 logs begin at deployment; older privileged actions are not fabricated. Production audit-index planning is documented in [AuditLog rollout](acadova-backend/docs/audit-log-rollout.md).

P5 adds persistent own-user in-app notifications for Session transitions, messages, reminders, learning-content review, review moderation, and account status. MongoDB Notification records are the source of truth; optional OneSignal web push is only delivery and cannot erase them. The existing navbar/staff header has a notification center with unread count and read controls. Rapid messages in one thread are grouped by a server-owned cooldown; unread-message and upcoming-Session reminders are generated by a restart-safe database scan (`npm run notifications:scan`) that must be scheduled separately in production. Historical pre-P5 messages are not retroactively marked unread. Production OneSignal setup, environment variables, worker scheduling, and manual index rollout are in [P5 notification rollout](acadova-backend/docs/p5-notification-rollout.md).

P6 retains the existing per-IP login rate limit and adds per-account consecutive-failure tracking. After 3 failures within 24 hours, temporary cooldowns start at 15 seconds and double after subsequent failures, capped at 5 minutes. A successful eligible login resets the counters; there is no permanent account lock. Threshold and recovery events enter the existing Admin-only AuditLog without credentials, tokens, or request bodies. Historical users need no backfill or new index. A targeted attacker may still inconvenience a known account for up to the capped cooldown; the IP limiter reduces but cannot eliminate that risk.

## Locked final scope — planned, not yet implemented

The following are part of the final project scope but must not be represented as complete until implemented and verified:

- Broader post-completion report intake beyond Session disputes.
- Complex progress tracking is not included in the learning-content foundation.
- Broader report intake and deterministic suspicious-activity dashboards, and system configuration beyond credit rules.

## Future enhancements outside the locked final scope

Automatic Google Meet creation or attendance API, custom video conferencing, AI recommendations or fraud detection, real-money payments, a mobile application, advanced LMS features, video hosting, certificates, large gamification systems, and leaderboards.

## Development instructions

`AGENTS.md` is the authoritative project instruction and locked-scope file. `claude.md` points to it and must not contradict it.

For local development, see the package scripts in the repository root and the frontend/backend package files. In a deployed frontend, set `VITE_API_URL` to the backend API origin. Deployment URLs and service state must be confirmed in the hosting configuration, not inferred from this repository alone.
