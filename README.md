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

The Session API retains legacy `accepted`/`rejected` values for deployed clients and also accepts canonical `scheduled`/`declined` decisions. Accepted or scheduled Sessions can now exchange an explicit, peer-approved reschedule proposal without changing their lifecycle status or meeting details. Later lifecycle states are not active yet. The legacy frontend remains served, but some of its flows do not match the current API.

## Locked final scope — planned, not yet implemented

The following are part of the final project scope but must not be represented as complete until implemented and verified:

- Later session lifecycle transitions, joining/check-in, session validation, no-show and dispute handling, and verified-session credit settlement.
- Self-paced topics, modules and resources; assessments and assessment credit rewards.
- In-app notifications, OneSignal delivery, notification cooldowns and unread reminders.
- Expanded moderator dispute/resource/suspicious-activity workflows, system configuration, persistent audit logs, and progressive login cooldown/security events.

## Future enhancements outside the locked final scope

Automatic Google Meet creation or attendance API, custom video conferencing, AI recommendations or fraud detection, real-money payments, a mobile application, advanced LMS features, video hosting, certificates, large gamification systems, and leaderboards.

## Development instructions

`AGENTS.md` is the authoritative project instruction and locked-scope file. `claude.md` points to it and must not contradict it.

For local development, see the package scripts in the repository root and the frontend/backend package files. In a deployed frontend, set `VITE_API_URL` to the backend API origin. Deployment URLs and service state must be confirmed in the hosting configuration, not inferred from this repository alone.
