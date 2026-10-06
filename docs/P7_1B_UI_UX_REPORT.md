# P7.1B Session Room and messaging UX report

2026-10-05. Continued the committed P7.1A working tree on `p7-ux-hardening`. Frontend-only changes; existing routes, API contracts, Session lifecycle, Credits, settlement, Learning, authentication, authorization, notifications and Google architecture preserved. No database operations, staging, commits, pushes or deployment.

## Interaction changes

1. **Session Room architecture:** Overview / Chat / Progress / Details, mutually exclusive panels. Details contains meeting editing and disclosed rescheduling. Progress retains existing evidence-backed helpers. Unsupported canonical contracts are read-only for Session mutations and messaging.
2. **Primary next action:** Contextual request acceptance, meeting setup, proposed-time review, check-in, finishing, confirmation or expired-window no-show action. Opening the agreed meeting is secondary to check-in; raw supported status, participant perspective, existing evidence and time bounds govern controls. No new transition is introduced.
3. **Online meeting/check-in:** Separate actions preserve legitimate backend check-in and reliable browser opening. Join uses HTTPS, a new tab and noopener/noreferrer. Opening a link proves no attendance. Existing Google setup/feature guards remain. First link save has no confirmation; replacement does.
4. **Face-to-face:** Existing location and both participants' check-in evidence; first location save is immediate, replacement is confirmed. No GPS, photographs, new codes or verification backend.
5. **Chat layout:** Peer and subject context; compact bubbles, readable metadata, bounded history and associated labeled composer. The mobile Session header and actions are compact; long content reflows with normal page scrolling.
6. **Scroll:** Initial newest position; follow new polling messages only within 72px of bottom. Older-message reading preserves position and shows a counted go-to-newest hint. Successful own send scrolls to bottom. IDs deduplicate polling and preserve a just-sent message absent from a stale poll; failure preserves the draft.
7. **Unread:** GET messages only when Chat is selected, the document is visible, the window focused and no modal covers Chat. Other tabs, conversation pickers and inactive/background windows do not initiate read requests. Existing GET marks the whole thread read; the scroll hint is not an unread receipt or backend count.
8. **Global Messages:** Existing Session list and recent notification metadata populate one reusable conversation picker. Peer, subject, available generic message alert/status and an honest unread-notification indicator are shown. Selecting opens the single Session Room Chat; no message-body fetching for previews.
9. **Desktop:** Top utility Messages opens a right-side 420px modal drawer below the utility bar; sidebar Messages keeps the existing full-page route. The drawer preserves focus containment, Escape and restoration. No second floating composer or duplicate chat state.
10. **Mobile:** Messages utility opens a full-width picker at <=1024px; selection opens the full Session Room Chat. Existing four-item bottom navigation stays intact. At 1025px desktop sidebar returns and bottom navigation is hidden.
11. **Notifications:** One account-keyed provider shares unread notification count/list with Bell and picker. Existing read-one/read-all APIs and OneSignal remain. Visible polling is 60 seconds, with focus and read-action refresh. Panels report failures. Send success is an inline live status; send errors retain inline recovery and existing error feedback.
12. **Sound:** Opt-in, initially off, unlocked through user interaction using a short low-volume WebAudio tone. Historical initial load, repeated/old/read notifications, own sends and incoming alerts for the visible active Chat are silent. A 10-second cooldown prevents rapid repeats. No polling sounds when unchanged and no new incoming-message toasts.
13. **Mute:** Per-account localStorage key `acadova:sound:<userId>` stores on/off. Audio needs a browser-allowed gesture after reload. Storage failures leave the current in-memory preference usable; blocked audio does not break notifications.
14. **Confirmations:** Added existing-detail replacement (URL/location), proposed-schedule decline and dispute submission. Existing consequential actions retain shared confirmation. First save, check-in, Join, Chat send, tab selection and viewing do not prompt.
15. **Accessibility:** Existing arrow-key tab controls, meaningful tabpanel associations, labeled icon buttons, keyboard-scrollable polite conversation log, live send status, associated alert/error, dialog focus trap/Escape/restoration, new-tab announcement and reduced-motion conventions. No claim of complete WCAG certification.

## Files and backend

16. **Backend changes:** None. The pre-existing `acadova-backend/.gitignore` edit was preserved, not modified by this pass. Backend authorization is still authoritative. No backend tests required for this frontend-only pass.

17. **Exact frontend files changed (paths relative to repository root):**

Modified:

- `acadova-frontend/src/App.jsx`
- `acadova-frontend/src/components/common/Modal.jsx`
- `acadova-frontend/src/components/common/NotificationBell.jsx`
- `acadova-frontend/src/components/common/StudentNavigation.jsx`
- `acadova-frontend/src/index.css`
- `acadova-frontend/src/pages/SessionRoomPage.jsx`
- `acadova-frontend/src/pages/SessionsPage.jsx`
- `acadova-frontend/tests/browser-correction.jsx`
- `acadova-frontend/tests/browser-demo.mjs`

Created:

- `acadova-frontend/src/components/student/SessionConversations.jsx`
- `acadova-frontend/src/context/NotificationContext.jsx`
- `acadova-frontend/src/context/notificationAccess.js`
- `acadova-frontend/src/services/notificationSound.js`
- `acadova-frontend/src/utils/messagingUx.js`
- `acadova-frontend/tests/browser-p71b.jsx`
- `acadova-frontend/tests/messagingUx.test.js`

Documentation: modified `docs/ACADOVA_MASTER_DESIGN_SYSTEM.md`; created this `docs/P7_1B_UI_UX_REPORT.md`. No package/dependency changes. Pre-existing `.agents/`, ZIP and backend `.gitignore` remain excluded. Temporary screenshot artifacts were removed after inspection.

18. **Exact tests added/changed:** New `messagingUx.test.js` covers read gating, supported states, scroll hint classification, notification baseline/deduplication, audio permission/cooldown/failure and per-account opt-in persistence. New `browser-p71b.jsx` exercises the real React app through entirely mocked APIs and WebAudio. `browser-correction.jsx` now expects the consolidated tabs and waits for lazy Chat; `browser-demo.mjs` permits the new reusable fixture. Fixtures never access a real database.

## Final validation

Commands below run from `acadova-frontend`, except diff-check from repository root.

19. **Focused:** `node --test tests/messagingUx.test.js tests/refreshGate.test.js tests/batchBUxFollowup.test.js tests/sessionPresentation.test.js` - 14 passed, 0 failed.
20. **Complete frontend:** `node --test tests/*.test.js` - 32 passed, 0 failed, 0 skipped.
21. **Backend:** Not run; no backend code changed. Previous P7.1A results are not represented as P7.1B tests.
22. **Lint:** `npm run lint` - exit 0, 0 errors, 13 existing warnings in AuthContext, AboutPage and FeaturesPage; no new warnings.
23. **Build:** `npm run build` - passed. CSS 110.62 kB (20.55 gzip); JS 525.52 kB (144.81 gzip). Vite retains its >500 kB chunk warning; no dependency/architecture changes to address it in this scope.
24. **Diff/browser:** `git diff --check` - passed. P7.1B browser fixture passed at 1648x920, 1024x920, 1025x920 and 390x844, device scale 1 / fresh browser default zoom. P7.1A correction fixture passed at 1648x920. Desktop/mobile screenshots were visually inspected. Browser command pattern: `node tests/browser-demo.mjs 'C:/Program Files/Google/Chrome/Application/chrome.exe' browser-p71b.jsx WIDTH '../.p71b-NAME.png' HEIGHT`; regression substitutes `browser-correction.jsx`. Tests cover scroll following/hint, drafts, modal/background read gating, first/replacement saves, separate check-in, face-to-face location, safe links, one composer, sound suppression/cooldown and picker keyboard focus.

## Limitations and manual sign-off

25. **Known limitations:** The existing GET messages endpoint marks the whole thread read even while reading older messages; it has no peek/per-message read API. A request initiated while Chat is viewed cannot be undone after switching away. No last-message preview or exact per-conversation unread count is available; picker alerts only reflect the latest 50 notification records and may omit older unread activity. Chat polls every 5 seconds and notifications every 60 seconds, so activity/audio delivery can be delayed. Notification grouping/cooldowns remain backend-controlled. Drafts survive polling/tab changes/failure within the mounted Room, but are not stored across different Rooms/reloads. This is a conversation drawer linking to full Chat, not a floating second Chat. Browser audio was mocked for deterministic checks; actual audibility/autoplay policy, assistive technology, real peer accounts and a physical mobile keyboard require manual testing. Existing lint and bundle warnings remain.

26. **Exact manual browser checklist:** Use two verified Student accounts with legitimate Sessions and realistic message history; 100% zoom at 1648x920, 1024x920, 1025x920 and 390x844.

- Verify only sidebar OR bottom navigation appears; utility/header offsets, scoped search, Home/Learning and Session Room have no overlap or horizontal overflow.
- Open all four Room tabs using pointer, Tab and arrow keys. Check subject, peer, time/timezone, contextual role and status; Progress must show only recorded evidence. Review pending, scheduled, in-progress, awaiting-validation, completed and terminal states; unsupported states expose no mutation controls.
- Online: first Tutor link save writes without a prompt; invalid/non-HTTPS URLs fail; replacement prompts; Cancel writes nothing. Learner cannot edit Tutor-owned details. Join opens one safe new tab without check-in/attendance credit; Check in separately respects the legitimate time/state and proposals. Existing configured/unconfigured Google behavior remains.
- Face-to-face: correct location and both participants' actual check-in evidence; no meeting-link action; first location save immediate and replacement confirmed.
- Open long Chat at newest; peer sends near bottom follow; scroll up, send multiple peer messages, and verify no jump and correct new-position hint. Click hint to newest; repeated polls do not add duplicates or inflate the hint.
- Send while scrolled up: success scrolls bottom and clears only the submitted draft. Simulate offline/server failure: draft survives, error is announced and retry works. Keep typing during polling and switch tabs: draft remains. Review long/multiline messages and remaining-character feedback.
- With unread peer messages, remain on Overview/Details/Progress: thread stays unread. Cover Chat with Messages/Search/More modal; blur window/background tab: no new thread-read requests. Return to visible Chat: existing whole-thread read behavior resumes and notification count refreshes. Do not expect per-message read receipts while scrolled up.
- Desktop Messages drawer shows peer, subject and honest notification activity; opening it alone reads no thread. Choose a conversation: exactly one full Chat composer. Verify sidebar full-page Messages route, empty state and failed-load Retry. Escape/Close restores trigger focus; keyboard focus stays inside the drawer.
- Mobile full-width picker is readable without overflow; selection opens Room Chat. On a physical phone open the keyboard, reach/send from composer, scroll history and dismiss keyboard; bottom navigation must not obscure focused input or send action.
- Sound off by default: historical list and own send silent. Enable through a real gesture; a new peer alert outside active Chat sounds once, rapid alerts obey cooldown, active visible thread remains silent, muted mode is silent. Reload/account-switch verifies per-account persistence and required gesture. Test browser-denied/unavailable audio and denied local storage; in-app notifications/messaging still work. Check OneSignal behavior separately without claiming this tone changes push delivery.
- Cancel and accept consequential confirmation flows (replacement, decline schedule, dispute and existing lifecycle actions); harmless viewing/check-in/Join/send has no modal prompt. Verify unchanged settlement/rewards/reviews and authorization with legitimate demo flows.
- Review focus rings, labels, live error/status announcements, Escape, 200% zoom and reduced motion. Check no duplicate toast/notification polling or competing Chat view after repeated navigation.

27. **Readiness:** Ready for manual P7.1B sign-off with the above limitations documented. Automated mock-browser validation passes; live/manual sign-off is still required before considering the pass accepted.

## Skill guidance actually used

Installed UI/UX Pro Max local Python query: `python .agents/skills/ui-ux-pro-max/scripts/search.py 'chat scroll position new messages focus unread' --domain ux -n 3`. Returned error-announcement, smooth-scroll and stacking-context guidance. Applied labeled contextual errors/live statuses and disciplined overlay layout alongside existing MASTER tokens, keyboard/dialog conventions and responsive hierarchy. Smooth forced polling scroll was rejected because preserving an older-message reader's position is the explicit requirement. No palette/font replacement or new framework.

## Subsequent final hardening note - 2026-10-06

The later final hardening pass fixes repeated selection of the same Session/hash after switching to Details: each router navigation reactivates Chat while preserving the room and draft. The reusable P7.1B browser fixture now covers that case. Original P7.1B validation above remains historical; current results and broader backend/UI changes are recorded separately in [FINAL_DEFENSE_HARDENING_REPORT.md](FINAL_DEFENSE_HARDENING_REPORT.md).
