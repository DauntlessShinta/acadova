# Acadova Phase C.2 implementation and release review

Completed locally on 2026-10-13, on `p7-ux-hardening`, HEAD `b6c1ce5e03e078e5fcaa695f4435b8c24cc25a08`. No staging, commit, push, merge, branch change, Render operation or production database/index operation. Existing Phase A/B/B.1/B.3/C.1 work and earlier backups are preserved.

## Admin Users and responsive layout

The eight-column table and inline role/suspension buttons consumed more width than the desktop content area. The table now has five essential columns (Name, Email, Role, Status, Actions), fixed proportional desktop widths, wrapping long emails and readable text. Verification, login protection and joined dates remain available in native keyboard-accessible Account details disclosures. A compact Actions button opens the existing accessible modal rather than a clipped floating menu. All permitted role/status actions use the original confirmation and mutation flows. Administrator accounts stay protected; Student/Moderator permissions and server audit records remain authoritative. The count uses a middle dot. Narrow screens retain internal table scrolling rather than document overflow.

No global zoom, scaling transform, root-font reduction or document overflow hiding was introduced. Existing width-based sidebars and short-height internal scrolling remain intact. Real Chrome component checks passed at 1920x1080, 1600x900, 1366x768, 1280x720, 1366x640, 844x480 and 375x667. They measure document scroll width, visible desktop navigation, control/dialog bounds, keyboard interactions, filters and pagination. These are fresh headless browser profiles with DPR 1 and loaded visual scale 1, with no zoom emulation; browser toolbar zoom UI was not exercised. Mobile also uses coarse-pointer/reduced-motion media. Desktop/mobile screenshots were inspected. The three additional C.2 reference images were absent from the attachment directory; visual fidelity was assessed against written requirements and preserved before/after rendering, not unseen images. Offline screenshots use fallback fonts.

## Public profile and compatibility

The existing `/tutors/:id` route now has a lightweight navy/blue CSS cover, overlapping default avatar, white panel, actual visible-review reputation, self-listed teaching subjects and four URL-addressable keyboard tabs: About, Subjects, Reviews and Availability. About uses two columns on desktop and stacks on mobile. No photo, activity timestamp, verification badge, subject certification or dashboard metric was fabricated. Test identities/data live only in synthetic fixtures.

Owner editing adds optional biography, university (120 characters), year level and up to ten supported languages using searchable native checkboxes. Biography is bounded to 1,000 characters; year/language enums and payload types are validated on the backend. Fields can be empty and are not registration requirements. Each detail defaults to private until an explicit public visibility choice. The update endpoint targets the authenticated owner and retains a strict field whitelist; role, credits, another user ID and other privileged mass assignment are rejected. The public DTO explicitly contains only approved profile data, opted-in optional details and visible-review reputation; email/authentication/security/verification fields and private preferences are excluded.

Old documents need no migration or backfill. Own-profile reads preserve absent historical `emailVerified` using lean reads; explicit false remains denied. Regression checking caught and corrected a public availability compatibility issue: cleared or absent availability is still returned as `null`. Model production automatic indexing remains disabled. No index definitions or new production environment variables were introduced.

Request Session uses only actual teaching subjects, a future online schedule, optional existing request message and server-provided configured cost (default 20). Requesting does not transfer or award credits. Own profiles show Edit Profile; ineligible or non-teaching peers do not present unusable requests. Message opens the existing protected Session conversation when available, otherwise focuses the optional request message. No separate messaging controller or video/provider infrastructure was added. Stale asynchronous profile/message results are discarded.

The new frontend's optional profile PATCH requires the new backend validator first. Old profile updates remain accepted. Release both applications at the same approved future SHA; today's HEAD excludes all uncommitted release work.

## Local validation

- Backend default suite: 344 passed, 0 failed, 7 opt-in database suites skipped. Frontend units: 66 passed, 0 failed, 0 skipped.
- Enabled isolated integration suites: Session integrity 19, completion 16, learning 12, Analytics 9, B.1 6, B.3 with actual Chrome/API/database 8 and C.2 with actual Chrome/API/database 8. All final enabled runs passed (78 passes, 0 failures, 0 skips).
- Final C.2 seven-size responsive matrix: 7 passed, including role-badge containment within each table column. Eight existing browser regressions passed: B.3, B, B.1, milestone, C.1 at desktop/mobile and final UI corrections at desktop/mobile. Two additional focused C.2 desktop/mobile checks passed. Preserved pre-change Admin Users/public-profile captures also completed.
- Final production build and lint passed. Only the pre-existing AuthContext Fast Refresh warning and large main chunk warning remain; Mongoose's existing `new` option deprecation is advisory. No dependency/package-lock changes. Local tests use installed dependencies; a clean Linux/Render install/build is still required.

Initial attempts included Windows virtual-memory process crashes, a screenshot timeout, a transient local fetch failure and browser runs returning no completion. The runner uses bounded test-process heaps and one isolated Chrome tab; production settings and the user's browser were not altered. Fixtures also needed textarea setters, proper Link selectors, UTF-8 separator preservation and awaiting dialog/save completion. The older C.1 fixture now observes the Moderator denial directly instead of waiting to enter the forbidden Admin route. A test-only missing router mount was corrected. The milestone check caught the role badge wrapping regression; single-line badges and adequate narrow-screen internal table width were restored without shrinking text. Failures and final reruns remain in external evidence. The availability contract regression was fixed in application code, not hidden by weakening its test. The owned loopback test MongoDB server was guarded by its exact bind address, port and data directory before shutdown; its files remain preserved.

## Exact C.2 scope

21 files (13 existing, 8 new):

- `acadova-backend/controllers/userController.js`
- `acadova-backend/middleware/validation.js`
- `acadova-backend/models/User.js`
- `acadova-backend/utils/profileDetails.js` (new)
- `acadova-backend/tests/profileDetails.test.js` (new)
- `acadova-backend/tests/phaseC2.integration.test.js` (new)
- `acadova-frontend/src/components/student/ProfileDetailsEditor.jsx` (new)
- `acadova-frontend/src/utils/profileDetails.js` (new)
- `acadova-frontend/src/pages/ProfilePage.jsx`
- `acadova-frontend/src/pages/TutorProfilePage.jsx`
- `acadova-frontend/src/pages/admin/AdminUsersPage.jsx`
- `acadova-frontend/src/services/userService.js`
- `acadova-frontend/src/index.css`
- `acadova-frontend/tests/browser-demo.mjs`
- `acadova-frontend/tests/browser-release-c1.jsx`
- `acadova-frontend/tests/browser-release-c2.jsx` (new)
- `acadova-frontend/tests/browser-release-c2-live.jsx` (new)
- `docs/PHASE_B_IMPLEMENTATION_REPORT.md`
- `docs/PHASE_B3_IMPLEMENTATION_REPORT.md`
- `docs/PHASE_B3_UI_CORRECTIONS_REPORT.md`
- `docs/PHASE_C2_IMPLEMENTATION_REPORT.md` (new)

The three earlier reports only replace unnecessary personal Windows temp-path prefixes with `%TEMP%/`; their technical results are retained and original copies remain in the C.1 backup.

## Full release audit and stopping point

The refreshed external audit replaces the stale 91-path staging snapshot with the complete 101-path release (prior reviewed work plus these changes). It includes a source preservation manifest, raw SHA-256 and Git-normalized blob hashes, exact NUL pathspec, exclusions, full candidate projection, import/case/dependency and sensitive-content review, screenshots/logs, Render checklist and a guarded future staging script. The old script must not be used. Local agent directories, ZIP backups, fixture scripts, evidence, generated outputs, unrelated reports and ignored environment configuration remain excluded and preserved. Sensitive local configuration is kept separately under restricted backup permissions.

No claim of production readiness follows from local passes. Before a separately authorized rollout, verify actual Render service types/commands/runtime, both Auto-Deploy settings, exact backend/frontend revision selection, production API/CORS/JWT/mail configuration, database `acadova`, transaction support, required unique/partial indexes (especially StudyReport and credit idempotency), notification job/provider behavior and a compatible rollback revision pair. No migration/index/provider verification was performed against production.

Future sequence: review the exact manifest and fresh backup, explicitly approve staging, run only the guarded script, inspect the full cached diff and sensitive-content scan, separately approve commit/push and deployment. Backend first, frontend promptly at the same reviewed SHA; pause staff writes during their pagination transition. Record compatible previous frontend/backend SHAs before rollout. Application rollback restores that compatible pair without undoing balances, ledgers, indexes or database state. Stop here until explicit approval.
