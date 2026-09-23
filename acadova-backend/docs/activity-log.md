# Activity Log

## 2026-08-25

- Fixed `.gitignore` (was empty; `.env` was not actually excluded from version control). Added `.env.example`.
- Added `middleware/authMiddleware.js`: `authenticateToken` (JWT verification) and `requireRole` (RBAC).
- Added `middleware/rateLimiter.js`: dependency-free fixed-window limiter, applied to `/api/auth/register` and `/api/auth/login` (20 requests / 15 min / IP).
- Added `middleware/validation.js`: server-side validators for email, password, rating, credit amount, ObjectId.
- Added `utils/mapReduce.js`: `mapSessions` -> `groupMappedResults` -> `reduceGroupedResults` for Subject Demand Frequency analytics. Verified against the spec's sample data (Java:3, Database:2, Python:2, Networking:1).
- Added models: `Session`, `Rating`, `CreditTransaction`. Added `min: 0` guard to `User.credits`.
- Kept the existing single `role: ['student', 'admin']` design instead of introducing separate learner/tutor roles — the existing `skillsToTeach`/`skillsToLearn` arrays on `User` already let one account act as both. Learner/tutor behavior is enforced by who initiated a session, not by a role field.
- Added `controllers/sessionController.js`: request/accept/reject/complete/cancel with ownership checks, state-transition whitelist, and an atomic (Mongo transaction) credit transfer from learner to tutor on completion.
- Added `controllers/ratingController.js`: 1-5 rating tied to a completed session, one rating per rater per session, recalculates the target user's average rating.
- Added `controllers/analyticsController.js`: `/api/analytics/subjects` (MapReduce-backed), `/sessions`, `/ratings`, `/credits` — all admin-only.
- Added `controllers/userController.js`: `/api/users/me`, `/api/users/tutors?subject=`.
- Added route files for sessions, ratings, analytics, users; wired all into `server.js`.
- Hardened `authController.js`: server-side email/password validation, removed leaked `error.message` from 500 responses, switched to `{success, message, data}` response shape, `409` for duplicate email, `401` with a generic message for any login failure.
- `server.js`: added JSON 404 for unmatched `/api/*` routes (previously fell through to `index.html`), added a final error-handling middleware.
- Fixed `public/js/main.js` (was empty; the existing landing-page button called a function that didn't exist).

### Testing performed
- Syntax-checked every JS file in the project — all pass.
- Unit-tested the MapReduce utility against the spec's sample data — output matches exactly.
- Unit-tested `authenticateToken`/`requireRole` with mocked req/res and locally-generated test JWTs (not the real secret) — all 5 cases (no token, invalid token, valid token, wrong role, correct role) behave correctly.
- Booted the real server and hit it over HTTP: health check, unmatched-route 404, unauthenticated 401 on protected routes, missing-field 400 on register, rate limiter (20 allowed, 21st+ blocked with 429).
- Confirmed DB-dependent routes fail gracefully (500, no stack trace, ~11s Mongoose buffer timeout) when MongoDB Atlas is unreachable, and that the server keeps running afterward.
- Could not test against a live MongoDB Atlas connection — this sandbox has no network access. Full register/login/session/rating/analytics flows against a real database need to be run locally (`npm run dev`).

### Known limitations / not built
- No frontend forms for register/login/session flows — only `acadova-backend` exists in this repository (no `acadova-frontend`), so this was backend-only scope.
- No `Skill` collection — subjects remain simple strings on `User.skillsToTeach`/`skillsToLearn` and `Session.subject`, matching the existing design rather than the master prompt's suggested normalized model.

## 2026-08-25 (continued) — Backend additions for frontend support

While mapping the API for the frontend, found four real gaps and closed them (all additive, non-breaking):

- `sessionController.getMySessions`/`createSession`/`updateSessionStatus` now populate `learner`/`tutor` with `name`/`email` — previously only raw ObjectIds were returned, so a UI had no way to show who the counterpart was.
- Added `PATCH /api/users/me` (`controllers/userController.js`) — whitelisted to `name`/`skillsToTeach`/`skillsToLearn` only. Needed for "manage skills" (tutor requirement); no endpoint existed to edit a profile after registration.
- Added `GET /api/credits/mine` (`controllers/creditController.js`, `routes/creditRoutes.js`) — a user's own credit transaction history with server-computed earned/spent direction. Previously the only credit analytics were admin-only aggregates.
- Added `GET /api/admin/users` (`controllers/adminController.js`, `routes/adminRoutes.js`) — read-only user list for the admin dashboard. No ban/promote actions implemented (out of scope for now).
- Explicitly did NOT build report/dispute management in the frontend — the backend has no such model or endpoints, and the brief only asked for it "if the backend supports it."

Verified: syntax check on all files, server boots, all three new/changed route groups correctly return 401 without a token.

Starting frontend build next: plain HTML/CSS/JS (no React present in the repo, so none introduced), served from the existing `public/` folder.

## 2026-08-25 (continued) — Frontend completed

Finished the plain HTML/CSS/JS frontend (no React introduced — none was present, and the brief explicitly said not to add one without cause). All 8 pages now exist and are wired up:

- `index.html` (landing, redesigned with real copy), `login.html`, `register.html` (with teach/learn skill tag inputs), `dashboard.html`, `tutors.html` (search + request-session modal), `sessions.html` (learner/tutor tabs, accept/reject/complete/cancel, star-rating modal), `profile.html` (edit name + skills, credit history), `admin.html` (overview, subject-demand MapReduce table, session/rating/credit stats, user list).
- Shared JS layer: `util.js` (formatting/escaping), `auth.js` (session storage + `requireAuth`/`requireAdmin` guards), `api.js` (fetch wrapper — attaches JWT, redirects to login on a real 401 from an authenticated call, distinguishes that from a login-page credential rejection), `nav.js` (role-aware navbar with live credit pill).
- Design: a "ledger/passbook" visual system (ruled paper, ink, a brass "stamp" motif for status badges and credit balance) — chosen because the subject is a credit exchange, not a payment app.

Found `profile.html` had been created in an earlier pass referencing `/js/profile.js`, which didn't exist yet (page was non-functional, stuck on loading states). Wrote `profile.js` to complete it. `admin.html`/`admin.js` had not been started; both written this session.

### Testing performed
- Syntax-checked all JS (backend + frontend) — pass.
- Verified `<div>`/`</div>` balance in every HTML page — pass.
- Booted the server and confirmed all 8 pages return 200 with `text/html`, and all 13 JS/CSS assets return 200.
- Verified every `href`/`src` reference across all pages resolves to a real file on disk — no dead links.
- Confirmed every page requiring login calls `requireAuth()` or `requireAdmin()`.
- Could not exercise the live register → login → request session → accept → complete → rate → analytics flow in a browser, since this sandbox has no network access to MongoDB Atlas and has no browser/JS engine to run client-side code against a live API. This needs a manual run-through locally (`npm run dev`, then open `http://localhost:5000`).

### Known gaps
- No ban/promote actions on the admin user list (read-only by design — flagged as a possible future addition, not required by the brief).
- No dispute/report management anywhere (backend has no such model; brief said only to build it "if the backend supports it").

## 2026-08-26 — Full MERN Stack Frontend Transition

- Per user directive, initiated full MERN stack frontend using Vite + React 18 (`acadova-frontend`).
- Backend additions:
  - Added `GET /api/users/:id` (`controllers/userController.js`, `routes/userRoutes.js`) for dedicated tutor profile lookups.
- React Frontend architecture:
  - `src/services/api.js`, `authService.js`, `userService.js`, `sessionService.js`, `ratingService.js`, `creditService.js`, `analyticsService.js` connecting cleanly to the Express backend.
  - `src/context/AuthContext.jsx` handling JWT lifecycle, user profile hydration, credit updates, and automatic 401 interception.
  - Design system implemented in `src/index.css` following the [Acadova Reference Website](https://acadova01-svg.github.io/Acadova/) (Navy `#14223a`, Brass gold `#c8961e`, card elevation, responsive mobile drawers, typography hierarchy).
  - Public pages: `LandingPage` (Hero, How Acadova Works 4-step flow, Credit model comparison, Skill explorer, SDG 4 section, CTAs), `AboutPage`, `FeaturesPage`, `LoginPage`, `RegisterPage` (with tag inputs and +2 starting credit callout).
  - Student / Learner / Tutor pages: `DashboardPage` (role-adaptive Learner/Tutor modes, metric cards, incoming requests, active sessions, tutor recommendations), `FindTutorsPage` (live search, filter pills, tutor cards, session request modal), `TutorProfilePage` (tutor details, skills, direct session booking), `SessionsPage` (Learner/Tutor tabs, accept/reject, cancel, complete session, 5-star rating modal with feedback text), `CreditsPage` (wallet balance, cashless concept diagram, transaction history table), `ProfilePage` (name, skills to teach & learn manager).
  - Admin page: `AdminDashboardPage` (platform KPI stat cards, interactive MapReduce Subject Demand Frequency pipeline visualization and bar charts, session status breakdown, rating distribution, user directory table).
  - Verified: `vite build` completed in 1.92s with 0 errors; Express backend health check functional; proxy configured for `/api` in `vite.config.js`.

