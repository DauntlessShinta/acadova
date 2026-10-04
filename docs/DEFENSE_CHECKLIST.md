# Acadova P7 defense and browser handoff

P7 visual sign-off remains **pending**. Automated regression is green; this document is the remaining manual proof checklist, not a claim that these flows were observed. The agent's built-in browser became unavailable on 2026-10-04. Continue from the prepared local records; do not repeat environment setup or baseline auditing.

## Repository transfer and existing isolated runtime

The P7 source, tests and reusable documentation have been transferred to the real Acadova repository. Its existing environment files are preserved and may point at a remote database. Do not start that backend for destructive demo testing. The existing local demo database and running test app remain attached to the original isolated checkout; no runtime state was copied into this repository.

- Checkout: `acadova-p7`, baseline `9c7b59c`, with uncommitted P7 fixes.
- Existing runtime data and checkpoint: `.p7-local/` beside the **isolated** checkout, including `progress.md`, `resume.ps1`, logs and Mongo data. That directory is not expected beside the real repository and is not a project artifact to stage.
- Frontend: `http://localhost:5174`; backend health: `http://localhost:5001/api/health`.
- MongoDB: loopback port **27027**, replica set **acadovaP7**, database **acadova**. Never substitute Atlas or the original checkout's environment.
- Run the existing `.p7-local/resume.ps1` beside the isolated checkout if those services stop. It verifies that checkout's ignored local environment and Mongo primary before starting hidden services. It does not initialize or replace the database. The restart script itself was not transferred.
- Preserve the original checkout's `acadova-backend/.gitignore` change and `Acadova-P7.zip`. Do not stage, commit or push.

The old synthetic password was held only in browser memory and is not recoverable after the browser runtime reset. To choose credentials privately, manually run `acadova-backend/scripts/Set-P7DemoPassword.ps1` in a clean local terminal. This reusable script is now available in the real repository, but targets only the dedicated P7 replica set on port27027; it never loads the real repository's dotenv configuration. It prompts with masked input, rotates only the five named synthetic accounts using bcrypt, revokes their previous sessions, and clears the temporary environment value. Do not paste the password into chat or save it in the repository.

| Actor | Local email | Role | Current balance |
| --- | --- | --- | --- |
| Student A, learner | p7-learner@example.test | student | 100 |
| Student B, contextual tutor | p7-tutor@example.test | student | 100 |
| Moderator | p7-moderator@example.test | moderator | 0 |
| Admin | p7-admin@example.test | admin | 0 |
| Student C, unrelated/insufficient credits | p7-unrelated@example.test | student | 0 |

All accounts are verified local fixtures. Tutor is a contextual Student behavior. No production credential is needed.

## Prepared local records

From `acadova-backend`, `node scripts/prepareP7Local.js --local-only --demo` safely reuses these records. It refuses production mode, any inherited `MONGO_URI`, a missing explicit local flag, an incorrect replica set, or an actor role mismatch. It never loads dotenv or enables external delivery. Student A must first exist from normal local registration. New Student B grants use the effective rules and normal verification controller; existing balances, profiles and passwords are preserved unless explicit password rotation is requested.

- Topic: **P7 JavaScript**.
- Free ordered module: **P7 Functions Path** with **P7 Functions** text and **P7 JavaScript Reference** HTTPS resource.
- Published assessment: **P7 Functions Check**, 100% passing score. Correct choices: “A reusable block”, “6”, “return”.
- Paid resource: **P7 Paid Practice**, 5 credits; paid module: **P7 Paid Module**, 10 credits.
- Student submission: **P7 Submission to Review**, still submitted for the moderation queue.
- **P7 JavaScript defense tutoring**: pending request from A to B, cost 20.
- **P7 JavaScript moderation case**: disputed, with actual local controller-generated schedule, manual meeting link, both check-ins and awaiting-confirmation evidence. No confirmation, settlement or fabricated balance write was performed.
- Content preparation uses existing validation/controllers and audited publication. Session preparation uses normal request, scheduling, coordination, check-in, finish and dispute controllers. These setup actions are fixture evidence, not visual E2E evidence.
- Repeat verified: 5 users, 1 topic, 4 resources, 2 modules, 1 assessment, 2 sessions, 2 opening-grant ledger rows, 14 audit rows, 10 notifications; balances unchanged on repeat.

## Last verified browser checkpoint

Observed before browser loss: landing → registration; required validation; policy initial disabled state, bottom-scroll enablement, explicit acknowledgment/agreement, close-before-agree, reopen-after-agree, keyboard/Escape focus return; approximately 390 px registration/modal; hidden unconfigured Google controls; generic Forgot Password response; registration → unavailable-email delivery state; safe local verification; Student A login; onboarding learning/teaching/name steps and save; Home balance/empty states; skill search → B profile and review empty state.

Two visual defects were reproduced and changed: onboarding could become blank on client navigation because its guard read global location without subscribing to router location; page navigation retained scroll and could hide headings/feedback. The fixes compile, but **post-fix browser retest is pending**. Native date-control entry through the agent did not take effect; the request was not submitted. This is not established as an application date-input defect.

## Demo 1 — peer tutoring

- [ ] Verify onboarding fix with Student C's first login: onboarding displays immediately, without reload. Choose **Skip for now**, log out/in, confirm no repeated trap; edit Profile later.
- [ ] Confirm Student A's completed setup persists across logout/login. Open Home, Find Tutors and B profile; inspect at desktop, tablet and 390 px.
- [ ] Create a fresh request through B's profile with a real local date/time, online method and short message. Record A=100/B=100 before any spend. Alternatively continue the named pending fixture, while recording that its request originated from setup.
- [ ] B logs in, sees incoming request/notification, accepts to Scheduled. If the old fixture date is stale, agree a new time through the normal reschedule controls.
- [ ] A proposes a different time. Agreed time stays unchanged; proposer cannot accept. B accepts; only then agreed time changes. Repeat with a declined proposal.
- [ ] B opens the Session Room. Unconfigured automatic Google generation is hidden. **Open Google Meet** opens the expected HTTPS destination in another tab; return without using a real meeting/account.
- [ ] Enter a safe manual HTTPS meeting URL. Save near the bottom of the long page: success toast visible in the current viewport. Try an invalid URL: visible friendly error and unchanged stored meeting details.
- [ ] A sees Join Meeting and cannot overwrite Tutor-owned meeting details. Student C cannot open/edit this room or its meeting details.
- [ ] Type a chat draft; wait at least 3 polling intervals (at least 15 seconds); draft/composer remain and message list does not repeatedly flash. Send; only successful sending clears the draft. Check B sees the same message once, in order. Safely test failure and retained draft if practical.
- [ ] Both check in using an agreed time within the allowed window: 15 minutes before through 4 hours after start. Do not disable time guards. Inspect Scheduled → Session in progress timeline.
- [ ] B finishes; inspect Waiting for confirmation. Both confirm separately. Inspect Completed and ledger-backed A=80/B=120 at the current 20-credit cost. Reopen/refresh; no second transfer.
- [ ] A leaves a rating/review; verify B profile displays it and duplicates/ineligible attempts are blocked. Inspect Moderator review controls.
- [ ] C attempts request with balance 0 and receives helpful earning guidance.

## Demo 2 — self-paced learning

- [ ] A opens Learning → P7 JavaScript → P7 Functions Path. Inspect text and external link, ordered previous/next navigation, narrow layout.
- [ ] Leave and return via Home Continue Learning in the **same browser**. It is a local resume pointer, not cross-device durable completion tracking.
- [ ] Open P7 Functions Check and submit the three correct choices. Record effective assessment reward (default 20), balance and one reward ledger row. Retry/refresh; no extra reward. Try an incomplete/failed attempt and confirm no reward.
- [ ] Unlock P7 Paid Practice (5) and P7 Paid Module (10) separately; check one debit/entitlement each, refresh/reopen without duplicates. Module entitlement permits in-module viewing; it does not grant standalone paid-resource ownership.
- [ ] C with balance 0 gets clear insufficient-credit guidance and cannot see paid bodies/links.

## Demo 3 — moderation

- [ ] Moderator Home/Needs Attention: filters, sort, content/dispute/resolved views and empty states.
- [ ] Open P7 JavaScript moderation case. Evidence matches participants, schedule, check-ins, confirmations, meeting coordination and unsettled state; no invented attendance proof.
- [ ] Resolve through UI with an explicit outcome/reason. For **cancel session**, no credit transfer; for **confirm session**, exactly one configured transfer. Verify participant notifications and Admin AuditLog. Repeat/reopen cannot settle twice.
- [ ] Review P7 Submission to Review; publish with a configured price or reject with actionable feedback. Verify audit and student notification. There is no invented Return-for-Changes state.
- [ ] Review flags say “Review recommended”; do not imply proven fraud.
- [ ] Moderator cannot access Admin Users, global Audit Logs, Security Center or credit-rule management.

## Demo 4 — security/admin

- [ ] Admin Overview, Users, Moderator management, Credits/configuration, Audit Logs and Security Center render at desktop/tablet/390 px; inspect table access, filters, safe identifiers and actorless **System** rows.
- [ ] Against Student C only, submit 3 wrong passwords once each; observe temporary cooldown, without flooding the IP limit. Admin sees cooldown event. Wait the cooldown, log in correctly and verify recovery event.
- [ ] Suspend C through Admin UI with a local-test reason; correct-password login stays blocked, suspended attempt appears. Reactivate C afterward. Never target Admin or production actors.
- [ ] Student A cannot reach `/moderator`, `/admin`, `/admin/security` or privileged learning controls by direct route navigation. Moderator cannot reach Admin-only paths. C cannot edit A/B Session or progress, resolve a dispute or alter credit rules.
- [ ] Missing/invalid recovery link page is clear. Actual new-password entry and submission is performed by the user, with invalid/expired/reused cases recorded where practical.

## Final visual sign-off

- [ ] Landing/Register, Login, Onboarding, Home, Find Tutors, Tutor Profile, Learning, Sessions, Room, Credits, Moderator Dispute and Admin Users/Security at desktop, tablet/narrow and approximately 390 px.
- [ ] No horizontal overflow, clipped actions, modal/table obstruction or overlapping fixed elements; long names and missing data remain understandable.
- [ ] Success/error toast on a long page is visible, wraps at mobile width, dismisses, and leaves primary controls accessible.
- [ ] Keyboard Tab/focus, Escape, validation labels and loading/empty states checked. Confirm page navigation resets scroll while request/policy hash links still work.
- [ ] Record observations/screenshots and any failure in the original isolated runtime's `.p7-local/progress.md`; fix/retest concrete defects before declaring P7 complete.

Automatic Google sign-in/Calendar Meet is optional and unconfigured locally. Manual external meeting links are the current reliable path. OneSignal/email delivery is disabled for fixtures; durable in-app notifications remain available. Reminder scanning is a separate manual command, not continuously scheduled on current hosting. Acadova Credits have **no real-money value**.
