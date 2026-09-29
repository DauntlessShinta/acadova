# Acadova Project Instructions

## Project Overview

Acadova is a MERN-based peer-to-peer academic learning platform.

The platform allows users to both learn from other users and share skills they already know.

A Student account is not permanently assigned as only a Learner or Tutor.

- When a Student requests or receives tutoring, they act as the Learner.
- When a Student teaches another user, they act as the Tutor.

Learner and Tutor are contextual Session relationships, not account roles.

The system also provides self-paced learning resources for users who do not want or cannot schedule a live tutoring session.

---

## Technology Stack

Frontend:
- React
- Vite

Backend:
- Node.js
- Express.js

Database:
- MongoDB / Mongoose

Authentication:
- JWT
- Email verification

Notifications:
- OneSignal
- Acadova in-app notifications

Deployment:
- Frontend and backend currently use the existing Acadova deployment setup.
- Do not change hosting or deployment architecture unless explicitly requested.

---

# Core Acadova Flow

## 1. Landing Page

User enters the Acadova landing page.

Available actions:

- Register
- Login
- Learn about Acadova

---

## 2. Registration

User creates an account.

Account begins as:

emailVerified = false

Acadova sends an email verification link.

The verification link must use the production frontend URL when deployed and localhost only during local development.

---

## 3. Email Verification

User clicks the verification link.

Backend:

1. validates the verification token
2. finds the associated user
3. sets the user's email as verified
4. invalidates/removes the verification token

Only verified users should be allowed to fully authenticate.

---

## 4. User Profile

Users can define:

- skills they want to learn
- skills they can teach
- availability
- profile information

There are NOT separate permanent Student and Tutor accounts.

Role depends on the current learning interaction.

Example:

User A wants to learn Python from User B.

User A = Learner
User B = Tutor

Later, User A may teach HTML to User C.

User A = Tutor
User C = Learner

---

# Learning Paths

Acadova provides two primary ways to learn.

## Path A — Peer Tutoring

Learner:

1. chooses a skill/topic
2. searches for tutors
3. views tutor profile
4. sends session request
5. optionally writes a message
6. selects proposed schedule

Tutor:

1. receives notification
2. views request
3. accepts
4. declines
5. or proposes another schedule

If accepted:

Session status becomes scheduled.

Both users receive notifications.

---

## Path B — Self-Paced Learning

Learners may browse:

- learning topics
- learning resources
- learning modules
- assessments

This allows Acadova to remain useful even when tutors are unavailable.

Learners may earn credits after successfully completing qualifying assessments.

---

# Session Lifecycle

Preferred session states:

pending
scheduled
in_progress
awaiting_validation
completed
declined
cancelled
no_show
disputed
resolved

Normal flow:

pending
→ scheduled
→ in_progress
→ awaiting_validation
→ completed

---

# Session Meeting

Acadova does NOT implement its own video conferencing platform.

Sessions may use an external meeting link such as:

- Google Meet
- Microsoft Teams
- Zoom

For the current project, manually supplied meeting URLs are acceptable.

Automatic Google Meet creation is a FUTURE enhancement unless explicitly requested.

---

# Session Verification

Do NOT rely only on users answering:

"Did the session happen?"

Acadova should use multiple verification signals.

Current planned signals:

1. valid scheduled session
2. learner check-in
3. tutor check-in
4. join timestamps
5. optional session verification code
6. learner post-session confirmation
7. tutor post-session confirmation

If validation succeeds:

awaiting_validation
→ completed

If confirmations conflict:

awaiting_validation
→ disputed

Only disputed or suspicious sessions require Moderator intervention.

Normal sessions must NOT require manual Moderator approval.

---

# Credit System

Acadova credits are internal platform credits.

They have no real-money or cash value.

Credits should NOT be calculated directly from session duration.

Do NOT use:

1 minute = 1 credit

Instead, activities have predetermined credit rewards/costs.

Example values may use:

20
25
30
50
100

instead of very small values such as 1, 2, or 3.

Exact values should remain configurable.

---

## Tutor Credit Earning

Tutor earns credits when:

1. tutoring session occurs
2. session passes validation
3. session becomes completed

Example:

Verified tutoring session
→ tutor receives credits

Do NOT award tutoring credits merely because the tutor accepted a request.

---

## Learner Credit Earning

Learners may earn credits through qualifying learning activities.

Example:

Learning module
→ assessment
→ passing result
→ credits awarded

Opening a resource alone should NOT automatically award credits.

---

## Spending Credits

Credits may be used for:

- requesting tutoring
- unlocking learning resources
- unlocking learning modules
- other approved Acadova learning activities

---

# Credit Transactions

Do not modify balances without recording why.

Maintain a credit transaction history.

A transaction should conceptually contain:

- user
- amount
- transaction type
- related session/resource/assessment
- reason
- timestamp

Examples:

+50 Verified tutoring contribution
+20 Passed assessment
-50 Tutor session request
-25 Learning resource unlock

Prevent duplicate credit rewards.

---

# Ratings and Reviews

Reviews should only be available after a legitimate completed tutoring session.

Users must not be able to review tutors they never completed a session with.

---

# Notifications

Acadova uses:

1. in-app notifications
2. OneSignal push notifications

MongoDB remains the source of truth.

OneSignal is only a delivery mechanism.

Important notifications include:

- new tutoring request
- request accepted
- request declined
- schedule changed
- upcoming session reminder
- unread session-related message
- session awaiting validation
- dispute resolution

---

# Smart Notification Cooldown

Messaging notifications should avoid excessive alerts.

Planned behavior:

- first message triggers normal push notification
- additional rapid messages within the cooldown window may be grouped/silenced
- unread messages may receive one reminder after a defined delay
- reminders must be capped to avoid notification fatigue
- opening/reading the chat thread clears the unread state

Do not make this system unnecessarily complex.

---

# Moderator Role

Moderator primarily handles exceptions and content moderation.

Responsibilities:

- disputed sessions
- reports
- inappropriate reviews/content
- suspicious sessions
- suspicious credit activity
- learning topic/resource moderation
- resource approval when applicable

Moderator must NOT manually verify every normal tutoring session.

---

# Admin Role

Admin has broader platform management privileges.

Responsibilities may include:

- user management
- moderator management
- system configuration
- credit configuration
- session oversight
- reports
- archives
- audit logs
- platform statistics

Keep Admin and Moderator responsibilities clearly separated.

---

# Audit Logs

Important actions should create audit records.

Examples:

- moderator resolves dispute
- moderator approves resource
- admin suspends user
- admin changes important system configuration
- significant security events

---

# Security Requirements

Maintain existing security controls.

Expected protections include:

- JWT authentication
- role-based access control
- input validation
- Helmet
- CORS restrictions
- Mongo sanitization
- rate limiting
- secure error responses

Do not weaken existing security to make a feature easier to implement.

---

# Brute-Force Protection

Login endpoints should include reasonable protection against automated password guessing.

Preferred approach:

- rate limiting
- track consecutive failures where practical
- progressive cooldown/delay
- temporary lock/cooldown after excessive failures
- reset appropriate counters after successful authentication
- security/audit event for suspicious login activity

Do NOT permanently lock accounts after a small number of failures.

A complete enterprise SIEM is outside the current project scope.

---

# Current Project Priority

The project is approaching final defense.

Priorities are:

1. complete existing core workflows
2. fix bugs
3. improve UX
4. finish revised credit system
5. implement session validation
6. finish Moderator/Admin functionality
7. improve notifications
8. test security
9. test end-to-end workflows
10. stabilize deployment
11. prepare documentation and defense

---

# Required End-to-End Demo Flows

## Demo 1 — Tutoring

Register
→ Verify Email
→ Login
→ Complete Profile
→ Search Tutor
→ View Tutor
→ Request Session
→ Tutor Receives Notification
→ Tutor Accepts
→ Learner Receives Notification
→ Session Scheduled
→ Join / Check In
→ Session Validation
→ Session Completed
→ Tutor Receives Credits
→ Learner Leaves Review

## Demo 2 — Self-Paced Learning

Login
→ Browse Topic
→ Open Learning Module
→ Study Resource
→ Take Assessment
→ Pass Assessment
→ Earn Credits

## Demo 3 — Moderation

Session validation conflict
→ Session becomes disputed
→ Moderator reviews evidence
→ Moderator resolves dispute
→ Audit log created

---

# Scope Lock

The major Acadova feature scope is now LOCKED.

Do not introduce major new features unless explicitly requested.

The following are FUTURE ENHANCEMENTS:

- automatic Google Meet creation
- Google Meet attendance API
- custom video conferencing
- AI tutor recommendations
- AI fraud detection
- full SIEM integration
- real-money payments
- mobile application
- advanced LMS features
- video hosting
- certificates
- large gamification systems
- leaderboards

When implementing a request, prefer improving existing architecture instead of creating unnecessary new systems.

---

# Coding Rules for Codex

Before modifying code:

1. Inspect the relevant existing files.
2. Understand the current implementation.
3. Preserve working features.
4. Reuse existing models/controllers/routes/components when appropriate.
5. Do not duplicate functionality.
6. Do not replace working architecture without a clear reason.
7. Keep changes scoped to the requested task.
8. Maintain existing UI conventions.
9. Maintain security controls.
10. Run relevant tests after changes.
11. Fix regressions caused by the change.
12. Do not silently make major schema or architecture changes.

When a requested feature conflicts with existing implementation, explain the conflict before making a large architectural change.

The objective is to complete and stabilize Acadova for final defense, not continuously expand its scope.