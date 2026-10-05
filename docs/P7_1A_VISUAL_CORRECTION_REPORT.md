# P7.1A visual correction report

Date: 2026-10-05. Branch: `p7-ux-hardening`. Continued from the existing P7.1A working tree. This report covers the correction pass only; the earlier full report remains in `docs/P7_1A_UI_UX_REPORT.md`.

No staging, commit, push, deployment, database seed, or P7.1B implementation was performed. Backend files and both name validators were unchanged in this pass. The pre-existing backend .gitignore, ZIP, and .agents directory were preserved.

## 1. Root-level global Toast architecture

The existing single ToastProvider remains mounted in main.jsx around the application and confirmation provider. Its viewport now renders through a React portal directly into document.body, so page positioning and layout containers cannot constrain it. It remains fixed while the document scrolls. All callers use the existing useToast hook.

Desktop feedback appears upper-right; staff feedback sits below the staff topbar. Tablet/mobile feedback is centered below the navigation header with safe viewport width and safe-area handling. Dismiss controls retain a 44px target. Errors use alert/assertive announcements; other outcomes use status/polite announcements. The latest outcome replaces the visible card, and previous timers are cleared, preventing a burst of cards from stacking over controls. The six-second dismissal and explicit dismiss button remain.

## 2. Pages/actions migrated to Toast

This pass migrated registration server/network failure and account creation, Login success/failure, password-recovery request outcomes, password-reset success/network failure, verification resend success/failure, and Google sign-in/sign-up failures. Onboarding completion/skip now provide feedback. Session manual Refresh reports its result; background polling does not generate repeated toasts.

Static audit confirmed that the existing P7.1A shared Toast calls already cover Profile save, tutor requests, Session acceptance/decline/cancel, meeting coordination, check-in, reschedule proposal/decision, finishing/confirmation/no-show/dispute, messages, reviews, assessment attempts, resource submission/unlock, staff learning management, assessment draft/publication, dispute decisions, review moderation, Admin role/suspension operations, credit rules and adjustments. Those implementations were preserved.

Persistent load failures, unavailable sections, expired/invalid reset links, verification-delivery problems, settlement/review evidence, and assessment results remain contextual. Existing destructive confirmation gates remain in place before mutations. No duplicate page-local toast implementation was added.

## 3. Field validation retained inline

Register no longer shows the redundant “Check the highlighted fields” banner. Register and Login focus and scroll to the first invalid field through a shared helper; policy review has a focusable target and retains its contextual explanation. Reset password strength/mismatch messages now attach to the relevant input with aria-invalid/aria-describedby.

Verification resend email errors appear beside its input. Profile/onboarding name errors remain inline and focus the name field. Tutor request errors focus the first invalid input without the redundant banner; insufficient credits on Tutor Profile appear beside the cost. Moderator resolution-note validation is inline, identified and focused. Admin audit Actor ID validation stays beside the filter. Credit-adjustment validation is contextual to its form rather than the page-load alert.

Native required/type/min/max validation remains for existing forms. Persistent policy and eligibility explanations are retained.

## 4. Student desktop sidebar

Existing App routes were already using StudentNavigation. The remaining inconsistency was authenticated public pages, which used Navbar's full horizontal role navigation. Authenticated Student public pages now reuse AppLayout, including Help and policy pages. Public Help remains accessible before profile setup; protected application routes retain their existing onboarding gate.

Navigation order is Acadova, Home, Find Tutors, Learning, Sessions, Messages, Credits, Notifications, Profile. The compact 224px sidebar remains fixed while content scrolls, has an obvious active state, and fits the tested normal desktop viewport. Required destinations remain available. There is no duplicate horizontal primary navigation on the tested Student App routes.

Authenticated staff public pages have a single Back to workspace link rather than the full repeated role menu. Guest marketing navigation remains.

## 5. Staff sidebar density

Shared CSS reduces brand spacing and navigation gaps and uses a viewport-height sidebar. All ten Admin destinations remain visible; Moderator destinations remain visible. No destination was removed or put behind an unnecessary group.

Actual App browser checks verified both staff roles' sidebar scrollHeight does not exceed clientHeight at 1366x768 and 1440x900. Account controls remain visible at the bottom. The content document handles ordinary scrolling.

## 6. Account/logout UX

The existing reusable AccountMenu remains in the Student and staff shells and authenticated public Navbar. It presents name, role, and an unobtrusive menu; Student Profile and Sign out remain in that menu. Long identity text is constrained to avoid distorting sidebar density.

No large competing logout action was added. Ordinary sign-out remains immediate. Unsaved-work confirmation is retained only when existing dirty forms report unsaved changes.

## 7. Home density

The greeting, compact Credits link, skill search and Find Tutor action now occupy one compact header area. Search navigates to the existing Tutors subject query. Three smaller pathway cards retain peer learning, self-paced learning and sharing skills.

Reduced padding, gaps, type size and card spacing bring activity into view. Conditional next Session/resume/teaching/peers/topics remain driven by actual existing data. The established-Student fixture shows the complete Next Session card within 1366x768 and verifies the heading is within the viewport at 1440x900. Empty sections remain omitted.

## 8. Session Room information architecture

Existing handlers, state predicates, polling, stale-response gate, check-in windows, confirmation rules, review eligibility and settlement behavior were preserved.

The header contains subject, peer, human-readable status, agreed time, method and credits. Currently-valid acceptance, completion/confirmation, no-show and check-in actions stay near the top. The agreed online Join Meeting link appears once near those actions. A pending reschedule links directly to its review tab. Decline/cancel retain their original predicates in a compact More session actions disclosure near the top.

Overview, Messages, Reschedule, Details and Progress use a shared accessible tab component with linked panels, selected state, roving tab focus, Arrow Left/Right and Home/End keys. Panels remain mounted to preserve drafts but inactive workflows are hidden. The Messages hash opens its panel. Overview retains practical coordination, check-in/validation evidence and reviews. Details holds the request and repeated metadata. Reschedule retains the existing proposal/response workflow. Desktop has a compact sticky progress panel beside the main content; smaller layouts show progress through its tab in one column.

No floating chat, notification sound, attendance automation, session-state change or credit-rule change was introduced.

## 9. Other page-density improvements

- Sessions: a compact status selector replaces the wrapping set of status chips; role filters remain; desktop cards use two columns and mobile one.
- Profile: asymmetric desktop account/editor columns, smaller cards, editor before account details on mobile, sticky Save control.
- Tutor Profile: smaller card spacing, one mobile column, semantic page heading, request validation beside the relevant controls.
- Find Tutors: reduced search-card padding and spacing; first-error focus in the request dialog.
- Learning: Browse learning and Share a resource are distinct tabs; contributions remain unavailable without a published topic; lesson actions remain near the reading content.
- Onboarding: preserves the existing three-step workflow with smaller cards, inline name validation and root action feedback.
- Staff Learning: Topics, Resources and Modules are separate tabs; Assessments remains directly linked; drafts and prerequisite protections remain.
- Staff Assessments: Drafts, Create/edit and Review are separate tabs; opening review/edit selects the relevant workflow. Existing question-building controls remain, with contextual sticky actions.

UI/UX Pro Max guidance applied: clear hierarchy and next actions, reduced card/hero density, progressive disclosure, persistent navigation, field-specific feedback, adequate touch targets, visible focus, keyboard operation and responsive content flow. Existing Acadova color tokens, typography, Lucide icons, modal and account patterns were retained.

## 10. Responsive behavior

Desktop uses the fixed left sidebar with the remaining width for content. Existing tablet/short-viewport navigation switches to the compact header and More dialog. Mobile has no desktop sidebar and retains four bottom destinations plus More for the full navigation/account/notifications.

At 390px, actual App checks found no horizontal document overflow on Home, Tutors, Tutor Profile, Sessions, Session Room, Credits, Learning, Profile, Onboarding and Help. Toast bounds remain inside the viewport after scrolling. Session content is one column, tabs wrap, progress is reachable and actions remain reachable. The existing modal fit, focus trap, Escape and focus-restoration checks passed in P7.1A fixtures.

## 11. Name-validation follow-up

No validation-code changes were necessary. Frontend/backend remain aligned: normalize NFC; trim/collapse ordinary spaces; 2–80 Unicode code points; Unicode letters/marks, spaces, dash punctuation, straight/curly apostrophes and abbreviation periods. Controls/invisible formatting, digits/symbols, URL-like values, malformed punctuation and excessive identical-letter repetition remain rejected. International names and mononyms remain supported.

The helper now says “Enter the name you normally use for school or tutoring.” No dictionary, English-vowel or real-world identity check was added. Additional short-pattern heuristics were deliberately avoided because unfamiliar cultural names must remain supported. The unchanged frontend/backend parity test passed in the complete frontend run.

## 12. Exact files changed in THIS pass

“Modified” here means changed relative to the preserved working tree at the start of this pass; StudentNavigation already existed as an untracked P7.1A file.

Modified existing working-tree files (27):

```text
acadova-frontend/src/components/auth/GoogleSignInButton.jsx
acadova-frontend/src/components/common/Navbar.jsx
acadova-frontend/src/components/common/StudentNavigation.jsx
acadova-frontend/src/context/ToastContext.jsx
acadova-frontend/src/index.css
acadova-frontend/src/layouts/AppLayout.jsx
acadova-frontend/src/layouts/PublicLayout.jsx
acadova-frontend/src/pages/admin/AdminAuditLogsPage.jsx
acadova-frontend/src/pages/admin/AdminCreditsPage.jsx
acadova-frontend/src/pages/DashboardPage.jsx
acadova-frontend/src/pages/FindTutorsPage.jsx
acadova-frontend/src/pages/ForgotPasswordPage.jsx
acadova-frontend/src/pages/LearningPage.jsx
acadova-frontend/src/pages/LoginPage.jsx
acadova-frontend/src/pages/moderator/ModeratorAssessmentsPage.jsx
acadova-frontend/src/pages/moderator/ModeratorDisputesPage.jsx
acadova-frontend/src/pages/moderator/ModeratorLearningPage.jsx
acadova-frontend/src/pages/OnboardingPage.jsx
acadova-frontend/src/pages/ProfilePage.jsx
acadova-frontend/src/pages/RegisterPage.jsx
acadova-frontend/src/pages/ResetPasswordPage.jsx
acadova-frontend/src/pages/SessionRoomPage.jsx
acadova-frontend/src/pages/SessionsPage.jsx
acadova-frontend/src/pages/TutorProfilePage.jsx
acadova-frontend/src/pages/VerificationPendingPage.jsx
acadova-frontend/tests/browser-demo.jsx
acadova-frontend/tests/browser-demo.mjs
```

Created in this pass (4):

```text
acadova-frontend/src/components/common/WorkflowTabs.jsx
acadova-frontend/src/utils/focusInvalidField.js
acadova-frontend/tests/browser-correction.jsx
docs/P7_1A_VISUAL_CORRECTION_REPORT.md
```

Browser-demo.jsx and browser-demo.mjs remain reusable isolated project tests. The runner now accepts an explicit height and the correction fixture. The new correction fixture imports the actual App routing, styles and providers rather than only testing hand-built layouts.

Temporary screenshots used for inspection were deleted; they are not deliverables or staging candidates. .p71-edits.cjs remains absent. Preserve/exclude .agents/, acadova-backend/.gitignore and Acadova-P7.zip. Generated dist output and temporary browser profiles are not staging candidates. Nothing was staged.

The original P7.1A report's allowlist remains the baseline. Any later reviewed staging list must also include this pass's legitimate files, including new shared tabs/helper/test/report, and the newly touched auth pages, ToastContext, PublicLayout and AdminAuditLogsPage; do not use a blanket git add.

## 13. Tests/results

| Check | Result |
| --- | --- |
| Complete frontend Node suite: node --test tests/*.test.js | 22 passed; 0 failed/skipped. One successfully executed complete run. |
| Focused Session/learning utility check | 2 passed. |
| Existing Session/Profile browser behavior fixture | 9 checks passed after final Session presentation changes. |
| Actual App correction fixture, 1366x768 | Passed, including final auth feedback, keyboard tabs, Help before onboarding, runtime-error checks and bounded Toast. |
| Actual App correction fixture, 390x844 | Passed with the same final checks and no horizontal overflow. |
| Actual App correction fixture, 1440x900 and 768x900 | Passed layout/navigation/Toast checks earlier in this pass; subsequent fixes were covered at desktop/mobile. |
| Existing browser-p71 fixture, 1366px | Passed navigation, conditional Home, prerequisites, Messages, staff isolation and confirmation focus/Tab/Cancel. |
| Final frontend lint | Passed; 0 errors, same 13 pre-existing warnings in AboutPage, FeaturesPage and AuthContext. |
| Final production build | Passed; JS 508.76 kB / 139.90 kB gzip, CSS 98.03 kB / 18.51 kB gzip. Existing >500 kB chunk warning remains. |
| git diff --check | Passed after removing one trailing-space line. |
| Staged index | Empty. |
| Backend tests in this pass | Not rerun: no backend or name-validation changes. Earlier complete backend result remains 304 passed. |
| Seed / live database writes | None. Browser mutations use isolated mocked APIs only. |

Sandbox process restrictions initially prevented browser/Vite/Node-test spawning; authorized local validation succeeded outside that restriction. Those attempts were infrastructure failures, not executed assertion failures. Focused browser iteration exposed a fixture routing/heading synchronization issue and a leftover verification state setter; both were corrected. Final correction fixtures fail on uncaught errors/unhandled rejections.

Production build/lint were repeated only after subsequent frontend fixes. The unchanged complete frontend/backend suites were not repeatedly run.

Example reproducible browser command from acadova-frontend:

```powershell
node tests/browser-demo.mjs 'C:/Program Files/Google/Chrome/Application/chrome.exe' browser-correction.jsx 1366 correction-check.png 768 '/sessions/demo'
```

## 14. Remaining known visual limitations

- Headless mocked-API checks and inspected screenshots are not live authenticated end-to-end testing or final human visual sign-off. Real long names, large datasets, all Session states and zoom need the checklist below.
- Long content and moderation evidence still require document scrolling; only workflow stacking was reduced. Message history retains its natural bounded scroll region.
- Toasts are transient overlays and can cover supporting text briefly; only one card is visible. The latest result replaces earlier rapid results.
- Small/short viewports use compact navigation rather than forcing an overfull desktop sidebar.
- Existing lint warnings and the production chunk warning remain. No deployment/performance architecture change was made.
- Staff have no invented Profile route. Floating messaging, sound, attendance codes/automation, feed interactions and new notification architecture remain deferred.
- No starter-topic seed was executed; existing seed safeguards and draft publication strategy remain intact.

## 15. Updated manual visual checklist

Use the current source-built frontend with the existing backend and approved test accounts/data.

1. At 1366x768 and 1440x900, log in as Student. Visit Home, Find Tutors, Tutor Profile, Learning, Sessions, Messages, Credits, Profile, Onboarding where eligible, Help and policies. Confirm one left sidebar, correct order/active state, no repeated horizontal menu, no sidebar scrollbar, bottom account access and content scrolling independently.
2. At both desktop sizes, log in as Admin and Moderator. Check every required destination, account menu and Help. Confirm all normal sidebar destinations fit without sidebar scrolling.
3. At 768px width and 390x844, confirm compact/mobile header, More, bottom navigation, no desktop sidebar and no horizontal document scrolling. Check More/Notifications nesting, Escape, Tab focus and focus restoration.
4. With an established Student, confirm greeting, search, choices, compact Credits and at least the start of Next Session are visible at the desktop fold. With a new Student or no sessions/topics, confirm omitted empty sections and a useful next action.
5. Search Home for a skill containing spaces/accented text; confirm Tutors receives the correct subject query. Clear search and confirm browsing still works.
6. At the bottom of Profile, save successfully and force a network failure. Confirm one fixed visible Toast, dismiss control, safe mobile width and no duplicate success/error banner. Trigger rapid outcomes and confirm one visible card.
7. Repeat action feedback for request submission, acceptance/decline/cancel, coordination save/replacement, reschedule proposal/accept/decline, check-in, finish, confirmation, no-show/dispute, message send/failure, review, assessment, resource submission/unlock, staff decisions, Admin operations and credit adjustment. Confirm destructive decisions require the existing dialog and Cancel performs no write.
8. Submit invalid Register and Login fields; confirm first-error focus, adjacent messages and no “Check highlighted fields” banner. Exercise policy review and server failure separately.
9. Exercise password-recovery success/rate limit/network error; reset weak/mismatched password, expired/invalid token and successful reset; verification resend invalid email/success/network error; Google policy/server paths if configured. Confirm inline validation versus global action feedback.
10. Edit Profile/onboarding with international names, mononyms, apostrophes, abbreviations, extra spaces, overlength/repetition/URL/digit spam. Confirm front/back agreement, helpful wording and preservation of unsaved drafts through refresh.
11. Open Session Room as both participants for pending, scheduled, in_progress, awaiting_validation, completed, no_show, disputed, resolved and legacy records. Confirm compact metadata, only currently-valid actions, no duplicate Join link and original state/credit behavior.
12. Use Overview, Messages, Reschedule, Details and Progress by pointer and keyboard. Type drafts, switch tabs, refresh and return; confirm drafts survive and hidden workflows are not tabbable. Open a Messages hash link.
13. Check reschedule proposal review, check-in window, both confirmation states, review eligibility and moderation outcome presentation. Verify relevant actions remain near the top. Open More session actions and check original decline/cancel availability.
14. At 390px, inspect Session with long subject/peer names, online and in-person methods, multi-line messages and progress. Confirm one readable column, action targets, visible composer and no overflow. Inspect refresh placement while Toast is visible.
15. Check Sessions filters/two-column desktop cards/one-column mobile; Tutor request flow; Profile editor order/Save visibility; Tutors search density; Learning Browse/Share and zero-topic prerequisites; Onboarding steps.
16. As staff, switch Learning Topics/Resources/Modules and Assessment Drafts/Create-edit/Review. Confirm drafts persist, unavailable prerequisites stay disabled and publishing/archiving/removal dialogs and results remain correct.
17. Test AccountMenu: ordinary sign-out has no prompt; dirty Profile/resource contribution triggers the existing unsaved-work decision. Confirm no large competing Logout action.
18. Test resolution-note, credit-adjustment and audit Actor ID errors beside their controls. Check loading failures remain contextual rather than disappearing as transient messages.
19. Check keyboard-only navigation, visible focus, dialog Tab/Escape/restoration, screen-reader field associations/Toast announcements and 200% zoom. Recheck touch targets and safe-area padding on a real mobile device.
20. Verify served assets are built from acadova-frontend/current branch, not cached old deployment or deprecated backend/public assets. Do not declare visual sign-off until these live checks are reviewed.

Stop at this report. No staging, commit, push, deployment or seed was performed.
