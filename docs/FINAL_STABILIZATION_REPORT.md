# Acadova final implementation / stabilization report

2026-10-06 · `p7-ux-hardening` · uncommitted candidate for final manual sign-off.

This report covers the final implementation request supplied with the independent review findings. The working tree already contained substantial earlier hardening work. The file lists below identify changes made **during this pass**, relative to that initial working tree, rather than attributing all differences from HEAD to this pass. Earlier phase reports retain their original results. No additional broad development phase is proposed.

## 1–2. Login defect, fix and actual Mongoose proof

`recordFailedLogin` passed an aggregation update array to `User.findOneAndUpdate` without `updatePipeline: true`. Installed Mongoose **9.9.3** rejects that construction before MongoDB execution. An existing-account wrong password could therefore reach the controller's 500 response without incrementing failures or producing the associated cooldown audit event. Previous tests replaced the entire Model method and concealed this failure.

The fix adds `updatePipeline: true` to the existing atomic query. Its persisted-count expression, failure window, cooldown calculation, conditional password/cooldown predicate and success reset remain unchanged. Unknown-user dummy bcrypt work and the IP limiter remain unchanged.

The new regression leaves the installed Mongoose Model and Query intact and intercepts **only `User.collection.findOneAndUpdate`**. It reproduces rejection when the option is omitted, then runs the real service query through casting, pipeline construction, execution and result hydration to that collection boundary. It verifies ObjectId casting, array update, return-after semantics, cooldown results and success-reset construction. The final suite reports `Installed Mongoose: 9.9.3`.

The existing controller regression verifies ordinary known/unknown wrong credentials have the same generic 401 response, failure increment, third-failure cooldown, extension after expiry, recovery/reset and audit events. Existing active-cooldown responses remain 429; this pass does not claim that the existing cooldown response is indistinguishable from every unknown-account response. No authentication redesign was made.

**Evidence limit:** real Mongoose query construction is exercised; the collection boundary is stubbed. Production MongoDB execution of the pipeline and persisted recovery must still be checked with disposable accounts. Local tests do not establish production database behavior.

## 3–5. Session duplicate policy, implementation and legitimate repetitions

A duplicate/replay candidate has all of:

- Same Learner and Tutor in the same contextual direction.
- Same subject after Unicode NFKC normalization, trimming, whitespace collapse and lowercase conversion.
- Same exact UTC instant as the existing Session's agreed `scheduledAt` or outstanding `proposedScheduledAt`.
- Existing raw state in `pending`, `accepted`, `scheduled`, `in_progress`, `awaiting_validation`, `no_show` or `disputed`, or an unsettled/inconsistent legacy `completed` record.

The existing creation transaction writes both eligible User records in sorted ID order, then checks candidates before inserting. It returns **409 / “You already have this session request pending.”** without exposing MongoDB errors or index names. Only the successful insertion produces the request notification. Subject-only, Tutor/subject-only, message text and frontend display labels are not duplicate keys.

Legacy completion is terminal for this comparison when the existing compatibility classifier finds exactly one matching historical payment. Declined/rejected, cancelled and resolved history does not block a new request. The tests preserve another date with the same Tutor/subject, another Tutor for the same subject, a different subject, and another request after terminal history.

Frontend discovery and Tutor Profile have synchronous ref guards as well as disabled submitting buttons, so repeated Enter or double-click cannot start another submission before React renders. Discovery also prevents closing/reopening its request form while the operation is pending. Success replaces the form with **Session request sent** and **View requested session**, pointing to the returned existing Session route.

No schema field or new index was added. A durable Session request-operation identifier was considered and omitted: exact active-context replay is covered inside the existing serialization, while distinguishing a much later lost-response retry after cancellation/rescheduling from a deliberately new request requires durable operation history. This bounded policy is not generalized idempotency and does not promise replay recognition after its context becomes terminal or changes to another instant.

## 6. Exact scheduling-conflict policy

Commitments are checked when the Tutor accepts a pending request (`accepted` or `scheduled`) and when the other participant accepts a reschedule. Both User records are written in consistent sorted order inside a transaction. The transaction checks other Sessions at the exact new agreed UTC instant where either participant appears as **Learner or Tutor**, in raw `accepted`, `scheduled`, `in_progress` or `awaiting_validation` state. A conflict returns a clear 409 and preserves the pending request or original schedule/proposal.

Pending alternatives are allowed. A reschedule proposal itself does not reserve its proposed time; its original agreed commitment remains until acceptance. Completed/declined/cancelled/no-show/disputed/resolved history does not act as a current scheduling commitment. Legacy acceptance without a recorded valid instant remains compatible and does not invent a null-time conflict.

No duration/end time is available, so only exact simultaneous commitments are prevented. Different start instants can still overlap in real life. No one-hour Session duration is inferred from Google Calendar.

The concurrent regressions use a serialized, rollback-capable transaction fixture. The source uses real participant-record transaction writes, but a real replica-set race/retry rehearsal remains a manual sign-off gate.

## 7. Scheduled cancellation

Either legitimate participant can cancel raw canonical `scheduled` state while **both check-ins, `startedAt`, `creditsSettledAt` and `confirmedAt` are absent**. A first check-in ends this pre-start cancellation window. The atomic update repeats all these null predicates, so a check-in racing between read and write causes conflict rather than cancelling an attended Session. Unsupported states and unrelated users are rejected.

Cancellation uses existing `cancelled`, clears outstanding reschedule fields, transfers no credits, uses the existing peer cancellation notification and invalidates upcoming reminders. It follows the existing participant notification architecture; no new privileged AuditLog action is invented. Pending and legacy accepted cancellation/completion compatibility is preserved.

The Session Room exposes the action under More session actions only when the raw contract permits it. Shared confirmation title: **Cancel this session?** Its message explains cancellation for both participants and no transfer. Cancel writes nothing; Confirm performs the existing status mutation. Terminal Progress stops showing unachievable steps as “Not yet complete.”

## 8. Learning navigation

`topic`, `module`, `resource` and `lesson` query parameters represent the selected library view; `view=contribute` represents the existing contribution tab. Returning to /learning clears contribution/detail context, and history restores either tab. Topic/module/resource actions and breadcrumbs update the existing router query; query removal clears stale Topic/Module state. Continue resolves the existing browser/account resume pointer into canonical selection parameters, replacing the transitional `continue` entry. Lesson selection is derived from the query and bounded to available resources.

Reactive loading handles same-route query changes and ignores responses from departed views. Content must belong to the selected Topic. The expanded browser regression uses **BrowserRouter and actual browser history**, covering Back/Forward, library return, query removal, resource/module selection and Continue. Existing rewards and unlock APIs remain unchanged.

## 9. Resource entitlement

An accessible module resource is readable when it is free, when the Student has module entitlement, **or when the Student already has standalone entitlement for that resource**. The module response now reads applicable standalone entitlements and applies this OR rule per published resource. Another unpaid resource remains locked and its body withheld.

An unowned paid Module itself remains locked; independently owned resources remain available through their standalone route. Owning a Module never creates standalone Resource ownership. No entitlement or ledger write occurs from viewing. Archived/unpublished bodies remain protected and missing-material warnings remain intact.

## 10. Suspension reason history

Admin suspension includes the reason in the same transactional AuditLog write as the status mutation. `auditService` permits it only for `user.suspended`, trims it and bounds it to 500 characters. It continues excluding arbitrary request data/credential fields. Reactivation may clear the current User reason while the historical suspension event retains its reason. Admin Audit Logs exposes that evidence in a collapsed disclosure.

Public peer responses exclude suspension reason and audit metadata. Regression covers suspend/reactivate retention, bounded evidence and public output. This is prospective retention: previously cleared reasons are not reconstructed or backfilled. Staff must enter a non-sensitive moderation reason, not secrets.

## 11–15. Account and logout design

One `AccountMenu` and the existing AuthContext logout serve every role:

| Context | Visible trigger | Menu |
| --- | --- | --- |
| Student desktop | Utility area: avatar, name, Student, chevron | Profile; Sign out |
| Moderator desktop | Sidebar bottom: avatar, name, Moderator, chevron | Sign out |
| Admin desktop | Sidebar bottom: avatar, name, Administrator, chevron | Sign out |
| Compact/mobile, every role | Visible header avatar account trigger | Actual identity/role; Student Profile where applicable; Sign out |

The staff header's redundant noninteractive identity is removed. No Settings or fake staff Profile route is added. Student desktop identity is no longer duplicated at sidebar bottom. Staff sidebar scrolling brings opened account actions into view with bottom clearance.

Every Sign out opens the shared Confirm modal:

- **Sign out of Acadova?**
- **You'll need to sign in again to continue using your account.**
- **Stay signed in** / **Sign out**

Existing unsaved drafts add a loss-of-draft sentence in that same dialog. Cancel leaves authentication and drafts intact; Confirm calls existing logout and returns to Login. The shared provider gains an optional cancel-label field; all other dialogs retain their normal Cancel default. No `window.confirm` or separate role-specific logout mechanism is introduced.

## 16–20. Navigation, responsive behavior, discovery and Profile

Student links are grouped as Home/Find Tutors/Learning, Sessions/Messages/Credits, then Profile. How Acadova works follows the secondary group, eliminating its stranded middle position. Staff account stays anchored at sidebar bottom; navigation keeps a compact workspace density and controlled vertical scrolling.

The **height <=620px staff collapse rule is removed**. Desktop begins at 1025 CSS px; compact begins at 1024 and below. Short desktop height changes spacing/scrolling, never primary navigation. No zoom detection, transform scaling or 90% workaround is used. Table overflow is contained in its table region and existing keyboard-scroll access is preserved.

Student utilities use a compact Find Tutors shortcut and optional search disclosure instead of a large always-visible Tutor search. `/tutors` owns its single prominent discovery search and Quick Filters. Find Tutors terminology is consistent across discovery and Session recovery actions. Optional scoped Tutor/Learning search remains the existing Modal capability.

Profile/Tutor Profile have a maximum 1040px desktop wrapper with readable two-column proportions and single-column compact reflow. Both Profile skill labels reference stable input IDs; skill inputs enforce 50 characters and remain present but disabled at the existing tag-count limit. Misleading skill-recommendation helper copy is corrected. Visible-review-derived reputation remains authoritative; no-review profiles show No ratings yet. Analytics removes its repeated numeric value beside StarRating.

## 21–25. Session Room, staff, auth/public and copy

Session Room retains Overview/Chat/Progress/Details, coordination controls, polling, message drafts, bounded scroll history, follow/new-message hint behavior, read gating and notification/sound architecture. Chat removes its decorative outer card border/shadow while retaining bounded history and composer. Cancelled/declined/resolved-invalid Progress marks remaining steps Not applicable and preserves recorded evidence.

Home separates genuinely future agreed Sessions under Upcoming session from old/in-progress/awaiting-validation/no-show/disputed activity under Needs your attention. Incoming teaching requests keep their existing section. No dashboard metrics or fabricated activity are added.

Moderator queue sources have explicit availability: a failed dispute/resource source says Unavailable, and an incomplete queue does not claim authoritative zero/empty results. Existing review moderation already uses populated participant names, which are preserved. The Resource management API supplies a submitter ID, so no name is invented or extra lookup system added. Long resource bodies and inactive Topic/Resource/Module editors use disclosure; editing opens the relevant editor. Assessment browsing is labeled All assessments / Assessment library because it includes published records.

Staff headers/headings have compact plain treatment. Audit filters use a responsive grid with readable action labels and all 27 current backend action choices, including newer edit/security actions. The existing Actor ID filter stays available. Users retain table layout and scoped horizontal scroll. Existing Analytics panels are arranged without a tall neighboring cell forcing a large empty region. Admin reused Learning/Assessment screens derive Administration context from their route. Admin Sessions is labeled Session directory.

Auth forms/onboarding retain their existing behavior and are checked at the requested sizes; this pass changes no authentication UI architecture. Landing's obsolete 2-credit simulator display becomes **20 credits (example)**, explicitly illustrative. Dispute confirmation accurately says the note remains on Session resolution evidence while AuditLog records action/outcome. Notification failure has an unavailable/retry state and never simultaneously claims No notifications yet.

## 26. Final confirmation matrix

| Interaction | Policy |
| --- | --- |
| Navigation, search/filter, resource opening, Messages, tabs, notification read | Direct; no dialog |
| Check-in, Join Meeting, Profile save, first meeting-detail save | Direct; no dialog |
| Session request, reschedule proposal, review submission, resource contribution, assessment answers | Explicit form submission; no redundant dialog |
| Sign out, every role | Shared confirmation, project choice |
| Completion/settlement confirmation and existing finish/no-show actions | Existing shared confirmation retained |
| Paid Resource/Module unlock | Shared confirmation with credit cost |
| Topic/Resource/Module/Assessment publish | Shared confirmation with object/audience/consequence and applicable cost |
| Session cancellation, decline, dispute, proposed-time decline | Shared confirmation |
| Existing meeting-detail replacement | Shared confirmation |
| Moderator dispute resolution; review hide/restore; content reject/archive | Shared confirmation |
| Admin role/status change, credit correction, credit-rule change | Shared confirmation |

Harmless draft edits remain direct. No new dialog is inserted into every explicit submit.

## 27–28. Duplicate, conflict and idempotency matrix

| Operation/case | Final behavior / existing protection |
| --- | --- |
| Exact active Session request replay, immediate or concurrent | One insertion; second equivalent request 409 after participant serialization |
| Same Tutor/subject on another date; same subject with another Tutor; different subject | Allowed request; commitment still checked at acceptance |
| Another request after settled completion/decline/cancellation/resolution | Allowed; historical terminal interaction does not permanently block |
| Pending alternatives at one instant | Allowed; not treated as commitments |
| Confirmed exact-time overlap, either contextual side | Acceptance/reschedule acceptance 409; existing state/proposal preserved |
| Different start instants | Allowed; interval overlap cannot be inferred |
| Duplicate email; Google identity/sub | Existing unique identity/linking guards preserved and full-suite covered |
| Verification grant; initial credit grant | Existing conditional claim/unique ledger protection preserved |
| Session settlement; assessment reward | Existing transaction/unique reward keys preserved |
| Paid Resource/Module unlock | Existing entitlement plus ledger uniqueness preserved |
| Admin correction reference | Existing unique reference preserved |
| Rating Session/fromUser | Existing uniqueness and legitimate completion requirement preserved |
| Topic slug; notification event key | Existing unique keys and safe conflict handling preserved |
| Pending reschedule; check-in; confirmation; dispute resolution | Existing conditional state/evidence/proposal claims preserved |
| Repeated role/status transition | Existing stale/duplicate transition 409 and no partial audit preserved |
| Multiple assessment attempts | Allowed; reward still once per Student/Assessment |
| Identical chat text | Allowed; text is not an idempotency key |
| Resource reused across different Modules | Allowed; no standalone ownership side effect |
| Separate Learning content with similar names | Allowed subject to existing Topic slug rule |

Full backend tests cover these existing protections; real deployed correctness indexes remain an operational prerequisite. The new Session checks rely on transaction serialization, not a new unique index. A later context-changing Session retry and an ambiguous message-send retry are not generalized durable idempotency guarantees.

## 29. Messaging retry/read-boundary decision

**Deferred, both secondary items.** There is no durable per-send operation identifier today. Reliably distinguishing an intentionally identical new message from a lost-response retry requires message operation persistence and a reviewed concurrency/index policy. That rollout was not added to the locked stabilization pass.

GET messages still marks the whole thread read. A message inserted between query and read update can be marked read without being returned. Safely narrowing this also needs consistent notification/reminder clearing, rather than changing only the message predicate and leaving misleading notification state. The existing P7.1B behavior is preserved and its limitation remains explicit. No WebSockets or messaging rewrite was introduced.

## 30. Exact backend files changed in this pass

Modified (paths relative to repository root):

- `acadova-backend/controllers/adminController.js`
- `acadova-backend/controllers/learningController.js`
- `acadova-backend/controllers/sessionController.js`
- `acadova-backend/services/auditService.js`
- `acadova-backend/services/loginSecurityService.js`
- `acadova-backend/tests/finalHardening.test.js`
- `acadova-backend/tests/loginSecurity.test.js`
- `acadova-backend/tests/notifications.test.js`
- `acadova-backend/tests/p4AdminAudit.test.js`
- `acadova-backend/tests/reschedule.test.js`
- `acadova-backend/tests/sessionController.test.js`

Created:

- `acadova-backend/services/sessionRequestIntegrity.js`
- `acadova-backend/tests/stabilization.test.js`

## 31. Exact frontend files changed in this pass

Modified:

- `acadova-frontend/src/components/common/AccountMenu.jsx`
- `acadova-frontend/src/components/common/NotificationBell.jsx`
- `acadova-frontend/src/components/common/StudentNavigation.jsx`
- `acadova-frontend/src/components/common/TagInput.jsx`
- `acadova-frontend/src/context/ConfirmContext.jsx`
- `acadova-frontend/src/index.css`
- `acadova-frontend/src/layouts/StaffLayout.jsx`
- `acadova-frontend/src/pages/DashboardPage.jsx`
- `acadova-frontend/src/pages/FindTutorsPage.jsx`
- `acadova-frontend/src/pages/LandingPage.jsx`
- `acadova-frontend/src/pages/LearningPage.jsx`
- `acadova-frontend/src/pages/ProfilePage.jsx`
- `acadova-frontend/src/pages/SessionRoomPage.jsx`
- `acadova-frontend/src/pages/SessionsPage.jsx`
- `acadova-frontend/src/pages/TutorProfilePage.jsx`
- `acadova-frontend/src/pages/admin/AdminAnalyticsPage.jsx`
- `acadova-frontend/src/pages/admin/AdminAuditLogsPage.jsx`
- `acadova-frontend/src/pages/admin/AdminSessionsPage.jsx`
- `acadova-frontend/src/pages/moderator/ModeratorAssessmentsPage.jsx`
- `acadova-frontend/src/pages/moderator/ModeratorDisputesPage.jsx`
- `acadova-frontend/src/pages/moderator/ModeratorLearningPage.jsx`
- `acadova-frontend/src/pages/moderator/ModeratorOverviewPage.jsx`
- `acadova-frontend/src/utils/sessionPresentation.js`
- `acadova-frontend/tests/browser-correction.jsx`
- `acadova-frontend/tests/browser-demo.mjs`
- `acadova-frontend/tests/browser-hardening.jsx`
- `acadova-frontend/tests/browser-p71.jsx`

Created:

- `acadova-frontend/tests/stabilization.test.js`

## 32. Exact documentation changed

- `README.md`
- `docs/ACADOVA_MASTER_DESIGN_SYSTEM.md`
- `docs/DEFENSE_CHECKLIST.md`
- `docs/PRODUCTION_SMOKE_CHECKLIST.md`
- `docs/FINAL_STABILIZATION_REPORT.md` (new)

Total this pass: **46 source/test/documentation files: 13 backend, 28 frontend, 5 documentation.** Files already untracked at the start are called modified if they existed at that point. The overall git diff also includes earlier work outside this list; it is not a staging allowlist. Nothing was staged.

## 33. Tests added/changed

New backend `stabilization.test.js` has 12 regressions: normalized immediate/concurrent replay, legitimate repeats/terminal history, active/proposed-time duplicates, both contextual conflict sides, concurrent commitment, reschedule conflict preservation, guarded cancellation, attendance race, resource entitlement/content protection, suspension audit retention, unscheduled legacy acceptance, and public privacy.

`loginSecurity.test.js` adds the real installed-Mongoose collection-boundary regression. Existing Session/reschedule/notification/final-hardening fixtures are updated for the new transaction/query contract, and the existing scheduled-terminal assumption is corrected for approved cancellation. Admin audit expectations now require retained suspension reason.

New frontend `stabilization.test.js` covers cancellation eligibility and terminal Progress. `browser-hardening.jsx` adds real AuthProvider account/logout checks for all roles, request guards/success, actual BrowserRouter history/query/Continue, cancellation, all publication categories, editor disclosure, role context, queue/notification errors, short-height navigation, menu bounds and representative route overflow. Existing correction/P7.1A fixtures are updated for intentional discovery and navigation behavior. Existing P7.1B fixture is rerun without rewriting its history or behavior.

## 34–39. Fresh automated results

Commands run in their corresponding frontend/backend directories; diff check from repository root.

| Check | Command / fixture | Result |
| --- | --- | --- |
| Focused backend contracts | `node --test tests/loginSecurity.test.js tests/stabilization.test.js` | **22 passed, 0 failed, 0 skipped** |
| Complete backend | `npm test` (`node --test`) | **323 passed, 0 failed, 0 skipped** |
| Complete frontend | `node --test tests/*.test.js` | **38 passed, 0 failed, 0 skipped** |
| Frontend lint | `npm run lint` | Exit 0; **0 errors**, 2 pre-existing AuthContext warnings |
| Frontend production build | `npm run build` | Passed; existing >500 kB bundle warning remains |
| Diff whitespace | `git diff --check` | Passed; Git's LF/CRLF notices are not whitespace failures |
| Existing layout/correction | `browser-correction.jsx`, 1648×920 | Passed |
| Existing P7.1A | `browser-p71.jsx`, 1366×768 | Passed |
| Existing P7.1B messaging | `browser-p71b.jsx`, 1648×920 and 390×844 | Passed |

Windows sandbox initially prevented Node worker spawning. Authorized fixture-only commands ran outside that sandbox through automatic approval review; no production access was involved. Build/test exit codes and logs were checked, not inferred from shell warnings.

## 40. Browser viewport results at 100% zoom

Fresh isolated headless Chrome profiles, device scale 1, default browser zoom, asserted `visualViewport.scale === 1` and `devicePixelRatio === 1`. APIs are fixture-only; no database/provider attendance is simulated as live proof. The app uses real routes, components, providers and CSS. Actual BrowserRouter/history is used for the expanded regression.

| Viewport | Expanded browser regression |
| --- | --- |
| 1648×920 | Passed |
| 1440×900 | Passed |
| 1366×768 | Passed |
| 1366×600 | Passed; desktop staff sidebar retained, opened account actions fit after controlled scrolling |
| 1280×800 | Passed |
| 1025×920 | Passed; desktop navigation |
| 1024×920 | Passed; compact navigation |
| 768×1024 | Passed |
| 390×844 | Passed |

Each run checks Student Home, Find Tutors, Tutor Profile, Profile, Learning/Module/Resource, Assessments, Sessions/Room/Progress, Messages and Credits; Moderator landing/disputes/reviews/Learning/Assessments; Admin Overview/Users/Sessions/Analytics/Credits/Audit/Security/moderation/Learning/Assessments; and landing/Login/Register/Forgot/Reset/onboarding. P7.1B additionally exercises long Chat, composer/draft/scroll/focus/read/sound behavior. Representative desktop Profile/Tutor Profile, Moderator Learning, Audit toolbar, short Admin Users and mobile Profile/Chat screenshots were visually inspected. Fixture mock results do not replace physical keyboard, assistive technology or live multi-account rehearsal.

## 41–45. Remaining risks, deferments and production/index work

**BLOCKER:** no confirmed local blocker remains in the requested fixes. Final manual sign-off is still pending; a real replica-set/index/configuration/provider failure can block defense.

**HIGH:** no confirmed source HIGH is knowingly left from this request. Real concurrent duplicate/acceptance/reschedule/role/suspension races, MongoDB pipeline persistence, production proxy identity, deployment revision and existing correctness indexes remain release gates requiring operator evidence. Mocked transaction serialization is not live race proof.

**MEDIUM / intentional limitations:** ambiguous message-send retry and GET/read-boundary race; Session retry after context has changed; no authoritative duration/interval-overlap detection; credits are not reserved at request/acceptance; purchased content can lose access when its dependencies are archived. Existing 2 lint warnings and bundle-size warning remain maintenance items. Physical mobile keyboard/accessibility/provider behavior needs manual verification.

**Deferred:** durable message/Session operation identifiers and coordinated read-boundary handling; interval scheduling requires an authoritative duration policy outside this pass. No generalized idempotency platform, WebSockets, escrow, attendance API, new major feature, historical backfill or schema migration was introduced. Canonical Sessions keep stronger attendance/confirmation evidence; legacy accepted/completed API compatibility remains reachable and is not described as universally requiring both check-ins.

**Production/index changes later:** none newly required by these fixes. Acceptance/reschedule now also rely on the already required transaction-capable MongoDB. Verify existing User identity, Session payment, grant/reward, learning entitlement/ledger, Admin correction, Rating pair, Topic slug and Notification event indexes against their reviewed rollout documents. Any absent/conflicting existing index needs separate owner-reviewed handling. Do not create/drop indexes or backfill balances from this report. Keep existing hosting and operator-verified proxy allowlist policy.

## 46. Exact manual sign-off checklist

Use owner-approved disposable verified Students A/B/C plus Moderator/Admin, a transaction-capable test database and the exact candidate revision. Privately record effective rules, balances and UTC instants; never store credentials or real personal records here.

1. At all nine listed sizes and 100% zoom, inspect the representative pages. At 1366×600, retain desktop staff navigation, scroll to account, open the menu and keep Sign out visible. Reach table actions by table-region keyboard scrolling. Check labels/focus/Escape/focus return and a physical mobile keyboard.
2. For all roles, open Account → Sign out → Stay signed in. Authentication and edited Profile drafts must survive. Repeat and Confirm: existing logout clears auth and returns to Login. Staff have no fake Profile destination.
3. Register → verify email → login → profile/onboarding. Verify production-appropriate email URL, single verification/starting grant, duplicate email/Google identity behavior, recovery revocation and historical missing-verification compatibility.
4. On C, test a known wrong password and unknown email: ordinary failures generic 401. Verify persisted increment, third-failure cooldown, expiry/extension/recovery/reset, selected audit events and unchanged IP limiter. No flooding/permanent lock.
5. Find B → request a future Session. Submit equivalent requests concurrently/retry a lost response while active: one Session/notification and one clear 409. Try other date, other Tutor, different subject and new request after terminal history: allowed.
6. With a shared participant as Learner on one Session and Tutor on another, concurrently accept exact simultaneous alternatives: one commitment; second 409. Repeat with accepted reschedule: preserve original time/proposal on conflict. Explain absent interval-duration protection.
7. Before either check-in, cancel a scheduled Session as each participant: shared prompt, Cancel no write; Confirm cancelled for both, no transfer, peer notification and old reminder cleared. Reject unrelated user, started/checked-in/settled/invalid state and test check-in race.
8. Run canonical tutoring: accept → details → manual HTTPS Join/check-ins → Tutor finish → both confirmations → exactly one configured transfer → eligible review. Retry claims without duplicate rewards. Inspect legacy accepted/completed compatibility separately and describe it honestly.
9. Run Learning: Topic → ordered Module/Resource → Back/Forward/library/query removal/Continue → assessment fail/pass/retry → one qualifying reward. Verify existing paid Resource/Module confirmation, debit and durable entitlement. Own standalone Resource inside a free Module is readable; unpaid bodies remain protected; Module ownership creates no standalone entitlement.
10. Publish Topic, Resource, Module and Assessment: context/audience/cost/consequence; Cancel no write, Confirm one mutation. Edit drafts directly. Review reject/archive and missing published material. Check Admin context, All assessments label, named review participants and source/notification unavailable states.
11. Explicitly dispute a supported awaiting-validation/no-show Session. Moderator resolves valid/invalid with real evidence; normal Sessions need no moderation. Verify settlement once or no transfer, resolution note on Session and outcome/action in AuditLog.
12. Admin role/status/credit controls: in-flight promotion conflicts and terminal-history allowance, request-versus-role/suspension transactions, prospective rule changes, referenced corrections and retry protections. Suspend with non-sensitive reason → reactivate → inspect retained Admin audit reason; public response excludes it.
13. Verify exact deployed revision, SPA refresh/deep links, API origin/CORS, real proxy chain/client limiter identity, required indexes/transactions, received email, in-app/OneSignal delivery and operator reminder scan. Optional Google Calendar Meet remains unverified until separately exercised; manual HTTPS link is fallback, not attendance proof.
14. Record the three required complete demo flows and Admin/security results. Accept the documented retry/read race, non-reservation/content-availability/legacy limits, or address any **observed** sign-off failure within the locked scope. Do not start another broad feature phase.

Detailed operational steps remain in [DEFENSE_CHECKLIST.md](DEFENSE_CHECKLIST.md) and [PRODUCTION_SMOKE_CHECKLIST.md](PRODUCTION_SMOKE_CHECKLIST.md).

## 47–48. Readiness and final decision

**90/100**, an engineering estimate rather than a measured certification: workflow/source 29/30; integrity/authorization 24/25; UX/accessibility 14/15; automated regression 15/15; operational preparation 8/15. Operational preparation reflects documented safeguards/runbooks, not completed live provider/production verification. Remaining deductions are for the explicit limits and manual/live evidence above.

**Ready as the candidate for FINAL MANUAL SIGN-OFF. Sign-off and production readiness are not asserted.** No additional broad development phase is required. Use the checklist to record live evidence and fix only any observed scoped failure.

Protected `AGENTS.md`, `acadova-backend/.gitignore` and `Acadova-P7.zip` match their initial hashes. `.agents/` was read for skill guidance, with no edits, and deprecated `acadova-backend/public` was not modified. Temporary screenshots/logs were removed after inspection and result verification; the local test harness can reproduce them. No staging, commit, push, deployment, production MongoDB/index operation or historical balance change was performed. Stop after this report.
