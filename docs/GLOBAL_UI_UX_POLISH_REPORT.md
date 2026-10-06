# Acadova final research-driven product-quality pass

> Later focused rollback: Public/Auth visuals now follow commit 1ef2440 at the user's request. This document records the prior holistic pass; its Landing/Auth design and screenshots are historical. Current scoped results are in [PUBLIC_AUTH_VISUAL_ROLLBACK_REPORT.md](PUBLIC_AUTH_VISUAL_ROLLBACK_REPORT.md). Authenticated and backend improvements remain.

October 6, 2026 (Asia/Manila) ? `p7-ux-hardening` ? canonical frontend: `acadova-frontend`.

Implementation and local visual/browser acceptance are complete. This is a candidate for owner-run live/manual sign-off. Live deployment/provider acceptance remains an owner-run check; no deployment has occurred.

## 1. Research sources and access limits

Sources were consulted on October 6, 2026 before further UI edits, with retries for unavailable pages. Principles were adapted to Acadova; no competitor branding, assets, code, testimonials, statistics or exact layouts were copied. No UI library or dependency was installed.

| Primary source | Finding adopted / access limit |
| --- | --- |
| [Facebook registration](https://www.facebook.com/reg/?entry_point=login) and [account guidance](https://www.facebook.com/help/188157731232424) | Registration could not be fetched; guidance redirected to a login/temporary-block page. No current Facebook signup screen is claimed as inspected. The focused signup direction comes from the user's brief and Acadova's actual fields. |
| [Coursera Plus](https://www.coursera.org/courseraplus) | Readable current page: concise value proposition, prominent entry action and a progressive explanation. Adopted narrative hierarchy only. |
| [WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 CSS px minimum principle with documented exceptions; important controls use practical 44px surfaces. |
| [WCAG Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | Keyboard focus must be visible. Existing rings and whole-card focus are retained; scroll regions get explicit focus treatment. |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) and [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Native semantics first; actual dialogs contain focus, close with Escape and restore focus. Expanded Chat is an in-page workspace, so normal tab order remains available. |
| [Carbon tile guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/tile/guidelines) | Current page dated September 30, 2026: distinguish a single clickable destination from a passive container with independent actions. |
| [Material Design 3](https://m3.material.io/) | Site required JavaScript and detailed layout URL was unavailable. No visual inspection claim; retained Acadova's existing tokens and responsive structure. |
| [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | Respect system motion preferences, including entrances and smooth navigation scrolling. |
| [Carbon repository](https://github.com/carbon-design-system/carbon), [Tile implementation](https://github.com/carbon-design-system/carbon/blob/main/packages/react/src/components/Tile/Tile.tsx) | Reviewed open implementation structure for tile semantics/state discipline; no source copied. |
| [Radix repository](https://github.com/radix-ui/primitives), [Dialog implementation](https://github.com/radix-ui/primitives/blob/main/packages/react/dialog/src/dialog.tsx) | Reviewed focus/dismissal concepts; existing Acadova components remain. |
| [W3C APG repository](https://github.com/w3c/aria-practices), [dialog pattern source](https://github.com/w3c/aria-practices/blob/main/content/patterns/dialog-modal/dialog-modal-pattern.html) | Checked keyboard and focus expectations alongside readable APG guidance. |
| [Material Web repository](https://github.com/material-components/material-web), [button guidance](https://github.com/material-components/material-web/blob/main/docs/components/button.md) | State/semantic reference; no package, component code or theme imported. |
| [Pexels license](https://www.pexels.com/license/) and [Unsplash license](https://unsplash.com/license) | Reviewed licensing/endorsement limits. Existing licensed Unsplash photo was retained. |

The installed UI/UX Pro Max skill supplied a focused local search: `python .agents/skills/ui-ux-pro-max/scripts/search.py 'responsive action button wrapping chat workspace forms focus' --domain ux -n 3`. Focus and history guidance was applied; native-app pt/dp guidance was not substituted for web CSS pixels.

## 2. Principles and working-tree decisions

Preserved correct prior work: 24/44px targets, blue/white identity, shared focus/hover/active states, reduced motion, Dashboard 32px section rhythm, whole single-destination surfaces, explicit independent Session actions, contribution/review metadata, mutation guards and shared consequential confirmations. Existing navigation, RBAC, entitlement, credit, Session, assessment and notification contracts remain.

Redesigned only observed/requested gaps: split-screen auth marketing, narrow Peer grids/actions, the separate Chat composer column, expanded Chat, repetitive Landing storytelling and human-facing monospace. Photography stayed intact. The existing Layers logo stayed intact; its mark is repeated in a new SVG favicon. Generated screenshots are evidence, not production assets.

Documents inspected: AGENTS, README, MASTER design system, P7.1A/P7.1B reports, final defense hardening/stabilization reports, prior global report and production smoke checklist. Current source/routes/tests determined filenames and supported behavior.

## 3. Exact implementation/documentation files in the accumulated polish working tree

This list includes preserved earlier polish changes and the final research-driven refinements. Protected pre-existing `.agents/`, `Acadova-P7.zip` and backend `.gitignore` are excluded. Screenshot files are listed separately in section 24.

```text
acadova-backend/controllers/learningController.js
acadova-backend/tests/learningContent.test.js
acadova-backend/tests/p71Ux.test.js
acadova-backend/utils/nameValidation.js
acadova-frontend/index.html
acadova-frontend/public/acadova-mark.svg
acadova-frontend/public/images/README.md
acadova-frontend/public/images/peer-study.webp
acadova-frontend/src/components/common/Footer.jsx
acadova-frontend/src/components/common/Navbar.jsx
acadova-frontend/src/components/common/StarRating.jsx
acadova-frontend/src/components/common/StatCard.jsx
acadova-frontend/src/components/common/StudentNavigation.jsx
acadova-frontend/src/components/learning/ResourceRow.jsx
acadova-frontend/src/components/staff/ReviewModeration.jsx
acadova-frontend/src/components/student/SessionCard.jsx
acadova-frontend/src/index.css
acadova-frontend/src/layouts/AuthLayout.jsx
acadova-frontend/src/pages/AboutPage.jsx
acadova-frontend/src/pages/AssessmentsPage.jsx
acadova-frontend/src/pages/CreditsPage.css
acadova-frontend/src/pages/DashboardPage.jsx
acadova-frontend/src/pages/FeaturesPage.jsx
acadova-frontend/src/pages/FindTutorsPage.jsx
acadova-frontend/src/pages/ForgotPasswordPage.jsx
acadova-frontend/src/pages/LandingPage.jsx
acadova-frontend/src/pages/LearningPage.jsx
acadova-frontend/src/pages/LoginPage.jsx
acadova-frontend/src/pages/ProfilePage.jsx
acadova-frontend/src/pages/RegisterPage.jsx
acadova-frontend/src/pages/ResetPasswordPage.jsx
acadova-frontend/src/pages/SessionRoomPage.jsx
acadova-frontend/src/pages/TutorProfilePage.jsx
acadova-frontend/src/pages/VerificationPendingPage.jsx
acadova-frontend/src/pages/VerifyEmailPage.jsx
acadova-frontend/src/pages/admin/AdminAnalyticsPage.jsx
acadova-frontend/src/pages/admin/AdminAuditLogsPage.jsx
acadova-frontend/src/pages/admin/AdminCreditsPage.jsx
acadova-frontend/src/pages/admin/AdminSessionsPage.jsx
acadova-frontend/src/pages/admin/AdminUsersPage.jsx
acadova-frontend/src/pages/moderator/ModeratorAssessmentsPage.jsx
acadova-frontend/src/pages/moderator/ModeratorDisputesPage.jsx
acadova-frontend/src/pages/moderator/ModeratorLearningPage.jsx
acadova-frontend/src/styles/landing.css
acadova-frontend/src/utils/nameValidation.js
acadova-frontend/tests/browser-correction.jsx
acadova-frontend/tests/browser-demo.mjs
acadova-frontend/tests/browser-hardening.jsx
acadova-frontend/tests/browser-p71b.jsx
acadova-frontend/tests/browser-quality.jsx
acadova-frontend/tests/nameValidation.test.js
docs/ACADOVA_MASTER_DESIGN_SYSTEM.md
docs/GLOBAL_UI_UX_POLISH_REPORT.md
```

## 4. Landing Page

Concise navigation: How it works, Ways to learn, About, account entry. Hero explains peer tutoring, approved self-paced learning and internal credits, with two actions. One explicitly illustrative Session preview connects the photograph to the product. The page then explains the actual request/check-in/confirmation flow, two learning paths, credits without cash value, resource review/disputes and the existing SDG 4 mission. SDG text and its two educational pillars are preserved. Final CTA is brief; footer destinations are real. Obsolete skill-map/dashboard/simulator demonstrations and repetitive comparison panels were removed from marketing, not from the authenticated application.

## 5. Photography and logo

Retained Brooke Cagle's real photograph: [original source](https://unsplash.com/photos/three-people-sitting-in-front-of-table-laughing-together-g1Kr4Ozfoac), [photographer](https://unsplash.com/@brookecagle), [Unsplash license](https://unsplash.com/license). The source identifies it as free under that license. It remains local at `public/images/peer-study.webp`, 1200 x 800, approximately 146 KiB, with intrinsic dimensions, descriptive alt text and high fetch priority. Visible attribution and [asset record](../acadova-frontend/public/images/README.md) remain. Pictured people are illustrative, not claimed users or endorsers. No AI people or raster logo was generated.

The same existing SVG Layers identity remains across public/auth/Student/staff. The new favicon repeats the mark on blue. At <=375px, the Student header shows the intact 23px mark in a 44px named link rather than squeezing it beside five utility controls; larger mobile widths retain the wordmark.

## 6. Register and Auth

All auth routes share a centered, maximum-480px form card with compact branding and one H1. The duplicate marketing panel is removed. Register retains its actual Full name, Email, Password, Confirm password and required policy-review contract; conditional supported Google sign-in remains. Password requirements use a compact grid, accessible visibility toggles and neutral unmet states before submission. Labels/autocomplete, inline errors, first-invalid focus, valid entered values, loading/duplicate guards and policy dialog remain. Pending verification clearly says the account is not verified, masks the known email, offers resend/another email and retains the countdown. Login, recovery, reset and verification results use the same family.

Name rules remain shared, Unicode-friendly, bounded and syntactic. Removed the repeated-letter plausibility heuristic in frontend/backend: an alphabetic string is not rejected merely because software considers it implausible. No two-name/space requirement or mailbox-existence service was added. Email ownership remains verification-based.

## 7. Dashboard

Preserved 32px major-section separation and 16px heading/content gaps, distinct Upcoming/Needs attention sections, real Continue pointer, peers/topics/profile setup and full shortcut links. Section links remain padded secondary actions with arrows. No fabricated activity or metrics were added. The populated Dashboard regression checks physical section separation, not just CSS declarations.

## 8. Tutor regression: root cause and fix

The old Home grid forced four columns while Peer actions forced two equal, shrinkable columns. Increased target padding reduced text space further, causing normal action labels to split inside words. The discovery grid also depended on fixed columns.

Both Home and discovery now use a content-aware grid with a 320px minimum card width when space permits, filling the existing content container. Actions use intrinsic readable labels and one-line text; their grid stacks when two practical controls cannot fit. Wider 1440/1648 layouts show View Profile and Request Session together; narrower cards stack. Targets remain 44px. The card background is passive; each action remains independent. Names/skills wrap naturally. Reputation remains derived from visible reviews, with No ratings yet when appropriate, and normal product typography.

## 9. Learning

Browse remains the primary selected task, with contribution secondary. Topic/Module cards have one full-surface destination and an arrow-only hint, removing repeated Explore/Open text CTAs. Resource rows remain semantic whole buttons. Existing scoped search, breadcrumbs, module/resource query navigation, browser history, Continue pointer, resource ordering, costs and entitlement are preserved. No backend search or invented progress was introduced.

## 10. Sessions

Single-destination previews retain a full-surface heading link and View session arrow hint. Teaching requests retain passive backgrounds with separate View/Accept/Decline controls. Next action, status, Overview/Chat/Progress/Details and supported state guards remain. Card details/actions wrap without squeezed text. Join remains separate from check-in and proves no attendance.

## 11. Chat normal layout

One bordered conversation surface contains context/Expand, full-width bounded history and a bottom composer. The side composer is removed. Own/peer bubbles remain right/left aligned, width-limited and readable; long URLs wrap. Sender/time evidence remains visible. Composer grows up to 144px, with an integrated Send action, loading/disabled states, secondary counter and inline result/errors. The old mobile full-width-button rule initially squeezed the textarea; explicit composer flex/width rules fixed the rendered defect.

## 12. Expanded Chat

Expansion is a large in-page workspace, not browser fullscreen or a div masquerading as a modal. It fits the available viewport with a taller history and a visible composer above compact navigation. The same log/textarea nodes and Room state remain mounted. Scroll snapshots preserve an older-message reader; near-bottom following and new-message hints continue. Enter activates Expand; Escape inside the workspace minimizes and restores trigger focus. Normal tab order remains available.

Existing polling authorization, ordering, drafts, sending/error/character limits, read gating, notifications and mute behavior remain. No additional poller, Session reload or message write is triggered by resize. Existing GET-whole-thread-read and ambiguous-send-retry limitations remain documented in FINAL_STABILIZATION_REPORT.

## 13. Moderator

Preserved exception-led overview, clear queue destinations, status/type/sort filters and availability/error truth. Resources open on Awaiting review and expose title, Topic, submitter, content type, date/status and preview. Publish/Reject remain explicit, separated, authorized and confirmed where consequential. No second moderation subsystem or routine Moderator approval of normal Sessions was added.

## 14. Admin

Preserved readable Users/actions, role/status/credit confirmations, bounded reasons, ledger references, Audit/Security filters and role separation. Human-facing amounts/ratings use body typography with tabular numerals. Audit and Session directories now expose named, keyboard-focusable horizontal scroll regions, matching Users; their focus is visible. Tables scroll internally rather than forcing page overflow. Populated Audit records and security-event fixtures were inspected, alongside empty/error states from the hardening regression.

## 15. Accessibility

Measured 24px minimum interactive surfaces, important 44px targets and 46px forms are retained; assessment labels expose 48px targets. Whole-card semantics, independent actions, one H1 per auth page, labels/errors, icon names, visible focus, policy/confirmation focus behavior and meaningful photo alt remain. Real Chrome keyboard input exercises Tab/Shift+Tab, password visibility, Enter on Topics/Expand and Escape minimization. Sampled token contrast ratios: body/muted text on canvas 7.24:1, white/action-blue 5.17:1, white/primary-blue 10.36:1, danger 5.30:1, success 4.99:1 and warning 4.51:1 on their existing semantic surfaces. These are token-pair checks, not an exhaustive rendered contrast audit; important status is also text, not color alone. Reduced-motion emulation passes. No comprehensive screen-reader/WCAG certification is claimed.

## 16. Responsive behavior

Desktop/compact navigation remains width-based at 1025/1024 CSS px. Cards fill available content width and stack actions rather than shrinking targets. Auth is one column. Mobile Chat avoids a separate composer, narrow text field and hidden Send action. Compact expanded mode clears bottom navigation. Smallest headers preserve the brand mark. Staff table scroll is keyboard reachable. Major-screen captures were visually inspected, including contact-sheet overview and full-size desktop/mobile examples.

## 17. Credit contract

Current source and passing auth/identity tests confirm schema default 0; password registration is unverified/0 and snapshots configured eligibility/amount. Eligible verification issues one `initial_grant` with that snapshot, default 100. Current Mongo CreditConfig can override the default; no credit environment override or runtime frontend fallback of 2 was found. Google creation/eligible claim grants once; historical/staff balances remain unchanged. `/users/me`, AuthContext, header and wallet use authoritative stored balance. No fresh-user defect reproduced; no credit backend change was made.

### Credit investigation addendum

The user corrected the example to **Dwight Ramos showing 20 Credits on local Acadova**, and confirmed that a fresh account receiving exactly 2 credits was unverified. The current User schema defaults to 0; password registration explicitly stores 0/unverified plus grant eligibility and the current configured grant snapshot. Eligible email verification credits that snapshot once and creates one `initial_grant`; older eligible snapshots without an amount retain the documented 100 fallback. Google creation grants the current configured amount once; claiming an eligible pending registration uses its snapshot. Historical accounts and staff are not backfilled.

`/users/me` returns the stored account balance. AuthContext establishes/refreshes from that response and exposes `user.credits ?? 0`; the header and wallet consume that value. The wallet also refreshes the profile after reading ledger activity. No runtime fallback assigns 2 or 20, and no credit-related environment override was found. Remaining literal `credits: 2` values occur only in isolated frontend/backend test fixtures, including intentional historical/staff compatibility cases; they do not create application accounts. The topic seed tool seeds topics, not user grants.

The existing automated fresh-registration/verification and Google-identity regressions were verified: 0 before verification, one default 100 grant and ledger entry, repeat verification rejected, repeat Google login without another grant, configured snapshots respected, and legacy/staff balances retained. No current fresh-account grant defect was reproduced, so credit business logic was not changed.

A native-driver read-only diagnostic attempted to read Dwight's account, ledger and current credit config from the datasource configured for the local backend (`dbName: acadova`). Connection failed with `ECONNREFUSED` before any reads completed. The diagnostic used only `find`/`findOne` and did not start the application, initialize models/indexes or perform writes. A separate browser inventory exposed no connected tab for a normal wallet inspection. **The actual reason for Dwight's 20 balance is therefore not established.** Legacy balance, prior activity, configured rules, stale state or an older running process remain possibilities, not findings. No balance was manually set or backfilled.


## 18. Student Resource moderation flow

Current flow is Student submission -> submitted review state -> existing Moderator/Admin queue -> Publish or Reject -> published Student access. UI says Submit for review and Resource submitted for review, explains staff publication and creator notification, and retains awaiting-review context. Students cannot choose privileged status, publish/approve their submissions or receive submission-only credits. Backend RBAC, DTO and spending tests pass; live notification delivery remains an owner-run smoke check.

## 19. Backend scope

Accumulated polish includes the existing staff-only batched `_id name` lookup for submitterName, retaining original creator IDs and nullable names without exposing email/security data. This final request also removes one name-plausibility regex in the shared validator, with parity/explicit syntax regressions. No schema, credit rules/grants, Session lifecycle, authorization, moderation, assessment rewards, index or deployment architecture changed.

## 20. Tests

Reported prior baseline: 323 backend / 38 frontend. Initial sandbox runs could not spawn workers (`EPERM`); approved local execution completed the real suites. Final frontend `node --test tests/*.test.js`: **38 passed, 0 failed**. Backend `npm test`, after backend/name/metadata changes: **323 passed, 0 failed**. Name parity and explicit non-plausibility assertions are included; existing fresh grant, identity, RBAC, moderation, spending and settlement regressions passed.

Browser fixtures render the actual App, Auth/Toast/Confirm/Notification providers and CSS with in-memory APIs and no live DB. New quality fixture checks 25 routed surfaces plus normal/expanded Chat and Topic keyboard activation, realistic Unicode names and long history/URLs. Existing P7.1B desktop/mobile regressions pass for older-message position, polling, new hints, drafts/send failure, tab/focus/visibility/modal read gating, sound baseline/cooldown/mute, repeated conversation selection and one composer. Existing hardening checks pass for contribution, publication, confirmations, queue/history/entitlements, errors/suspension and physical Dashboard rhythm.

## 21. Lint

`npm run lint`: exit 0, 0 errors, **2 existing AuthContext warnings** (Fast Refresh exports and state-in-effect). No added warnings.

## 22. Production build and sanity checks

`npm run build`: passed. CSS 105.81 kB / 19.47 gzip; JS 524.46 kB / 144.61 gzip. Existing >500 kB chunk warning remains. No dependency changes. Hero/favicon paths are local and present in build output; no temporary evidence imports or hardcoded localhost URLs in runtime source/assets were found. API uses configured VITE_API_URL or same origin; localhost proxy is development-only in existing Vite config. BrowserRouter/SPA and Render build behavior remain unchanged. Actual deployed deep-link/CORS/provider configuration still requires the existing runbook.

## 23. Diff and protected files

Final `git diff --check`: passed. Git index was empty. SHA-256 comparison confirms protected `.agents/`, ZIP, AGENTS and backend `.gitignore` bytes remain unchanged. Deprecated backend/public is not in the diff. No staging, commit, push, merge, deployment, Render configuration, production data/index operation, historical balance adjustment or destructive DB operation occurred.

## 24. Exact viewport results and evidence

All nine final matrix runs passed at these exact CSS sizes: 1648x920, 1440x900, 1366x768, 1280x800, 1024x920, 768x1024, 430x932, 390x844, 360x800. Fresh Chrome profiles use scale 1, normal 100% zoom and canonical fonts. Checks include target dimensions, readable action bounds, document overflow, table regions, keyboard operation and composer visibility. Runtime exceptions and console errors are monitored.

Additional hardening reflow at 684x600 and browser **2x visual zoom/reset** passed. This is a browser visual/pinch-scale sanity check, not a claim of exhaustive desktop text-only zoom coverage. Reduced-motion 390x844 and Chat behavioral 1366x768 / 390x844 runs passed.

Current captures use illustrative API-fixture accounts and canonical fonts, not live user/provider data. All nine contact sheets were visually inspected, with full-size views for the critical layouts. Expanded history is at least 25% taller than normal history across the matrix, with the composer inside the available viewport. No new runtime exception or console error was recorded.

| Viewport at 100% | Result / visual overview |
| --- | --- |
| 1648x920 | PASS ? [Contact sheet](ui-ux-polish/final/contact-1648.jpg) |
| 1440x900 | PASS ? [Contact sheet](ui-ux-polish/final/contact-1440.jpg) |
| 1366x768 | PASS ? [Contact sheet](ui-ux-polish/final/contact-1366.jpg) |
| 1280x800 | PASS ? [Contact sheet](ui-ux-polish/final/contact-1280.jpg) |
| 1024x920 | PASS ? [Contact sheet](ui-ux-polish/final/contact-1024.jpg) |
| 768x1024 | PASS ? [Contact sheet](ui-ux-polish/final/contact-768.jpg) |
| 430x932 | PASS ? [Contact sheet](ui-ux-polish/final/contact-430.jpg) |
| 390x844 | PASS ? [Contact sheet](ui-ux-polish/final/contact-390.jpg) |
| 360x800 | PASS ? [Contact sheet](ui-ux-polish/final/contact-360.jpg) |

Representative full-resolution evidence:

| Surface | Desktop | Mobile |
| --- | --- | --- |
| Landing | [1648](ui-ux-polish/final/landing-1648.png) | [390](ui-ux-polish/final/landing-390.png) |
| Register (invalid-password feedback, valid values retained) | [1366](ui-ux-polish/final/register-1366.png) | [390](ui-ux-polish/final/register-390.png) |
| Login | [1366](ui-ux-polish/final/login-1366.png) | [390](ui-ux-polish/final/login-390.png) |
| Home | [1366](ui-ux-polish/final/home-1366.png) | [390](ui-ux-polish/final/home-390.png) |
| Tutor actions | [1440, side by side](ui-ux-polish/final/tutors-1440.png) | [390, stacked](ui-ux-polish/final/tutors-peer-actions-390.png) |
| Learning | [1366](ui-ux-polish/final/learning-1366.png) | [390](ui-ux-polish/final/learning-390.png) |
| Sessions | [1366](ui-ux-polish/final/sessions-1366.png) | [390](ui-ux-polish/final/sessions-390.png) |
| Normal Chat | [1366](ui-ux-polish/final/chat-normal-1366.png) | [390](ui-ux-polish/final/chat-normal-390.png) |
| Expanded Chat | [1366](ui-ux-polish/final/chat-expanded-1366.png) | [390](ui-ux-polish/final/chat-expanded-390.png), [360](ui-ux-polish/final/chat-expanded-360.png) |
| Credits | [1366](ui-ux-polish/final/credits-1366.png) | [390](ui-ux-polish/final/credits-390.png) |
| Profile | [1366](ui-ux-polish/final/profile-1366.png) | [390](ui-ux-polish/final/profile-390.png) |
| Moderator queue | [1366](ui-ux-polish/final/moderator-1366.png) | [390](ui-ux-polish/final/moderator-390.png) |
| Resource review | [1366](ui-ux-polish/final/review-1366.png) | [390](ui-ux-polish/final/review-390.png) |
| Admin Users | [1366](ui-ux-polish/final/admin-users-1366.png) | [390](ui-ux-polish/final/admin-users-390.png) |
| Populated Audit | [1366](ui-ux-polish/final/admin-audit-1366.png) | [390](ui-ux-polish/final/admin-audit-390.png) |
| Security | [1366](ui-ux-polish/final/admin-security-1366.png) | [390](ui-ux-polish/final/admin-security-390.png) |

The exact 44 current evidence files are:

```text
docs/ui-ux-polish/final/admin-audit-1366.png
docs/ui-ux-polish/final/admin-audit-390.png
docs/ui-ux-polish/final/admin-security-1366.png
docs/ui-ux-polish/final/admin-security-390.png
docs/ui-ux-polish/final/admin-users-1366.png
docs/ui-ux-polish/final/admin-users-390.png
docs/ui-ux-polish/final/chat-expanded-1366.png
docs/ui-ux-polish/final/chat-expanded-360.png
docs/ui-ux-polish/final/chat-expanded-390.png
docs/ui-ux-polish/final/chat-normal-1366.png
docs/ui-ux-polish/final/chat-normal-390.png
docs/ui-ux-polish/final/contact-1024.jpg
docs/ui-ux-polish/final/contact-1280.jpg
docs/ui-ux-polish/final/contact-1366.jpg
docs/ui-ux-polish/final/contact-1440.jpg
docs/ui-ux-polish/final/contact-1648.jpg
docs/ui-ux-polish/final/contact-360.jpg
docs/ui-ux-polish/final/contact-390.jpg
docs/ui-ux-polish/final/contact-430.jpg
docs/ui-ux-polish/final/contact-768.jpg
docs/ui-ux-polish/final/credits-1366.png
docs/ui-ux-polish/final/credits-390.png
docs/ui-ux-polish/final/home-1366.png
docs/ui-ux-polish/final/home-390.png
docs/ui-ux-polish/final/landing-1648.png
docs/ui-ux-polish/final/landing-360.png
docs/ui-ux-polish/final/landing-390.png
docs/ui-ux-polish/final/learning-1366.png
docs/ui-ux-polish/final/learning-390.png
docs/ui-ux-polish/final/login-1366.png
docs/ui-ux-polish/final/login-390.png
docs/ui-ux-polish/final/moderator-1366.png
docs/ui-ux-polish/final/moderator-390.png
docs/ui-ux-polish/final/profile-1366.png
docs/ui-ux-polish/final/profile-390.png
docs/ui-ux-polish/final/register-1366.png
docs/ui-ux-polish/final/register-390.png
docs/ui-ux-polish/final/review-1366.png
docs/ui-ux-polish/final/review-390.png
docs/ui-ux-polish/final/sessions-1366.png
docs/ui-ux-polish/final/sessions-390.png
docs/ui-ux-polish/final/tutors-1440.png
docs/ui-ux-polish/final/tutors-peer-actions-360.png
docs/ui-ux-polish/final/tutors-peer-actions-390.png
```

The six earlier screenshots below remain preserved as historical captures, not current acceptance screenshots:

```text
docs/ui-ux-polish/landing-1648.png
docs/ui-ux-polish/dashboard-1366.png
docs/ui-ux-polish/chat-1366.png
docs/ui-ux-polish/admin-short-1366.png
docs/ui-ux-polish/review-1024.png
docs/ui-ux-polish/learning-390.png
```
 WebP/favicon are production assets; screenshots/contact sheets are review artifacts and never imported by the app. Temporary duplicate/failed captures, numeric files from the corrected argument issue and browser logs are removed after preserving this selection.

Reproduce from `acadova-frontend` with `ACADOVA_BROWSER_FONTS=1` and `ACADOVA_SCREENSHOT_DIR` pointing to an existing folder:

```text
node tests/browser-demo.mjs "C:/Program Files/Google/Chrome/Application/chrome.exe" browser-quality.jsx 1366 ../quality-result.png 768
```

Use explicit PNG and height arguments; the runner rejects shifted numeric screenshot arguments. Substitute each matrix width/height. The quality fixture captures each route through the screenshot handshake; browser-p71b and browser-hardening remain reusable behavioral regressions. Optional ACADOVA_REDUCED_MOTION=1 and ACADOVA_ZOOM_CHECK=1 reproduce motion/visual zoom checks.

## 25. Remaining warnings and limits

Two existing lint warnings and the existing JS chunk-size warning remain. Resource lists retain the existing 100-record cap; review-filter counts describe returned records. Notification picker activity is limited to existing records and does not invent exact per-thread unread counts/snippets. Message retry ambiguity and whole-thread read race remain. Failed initial fixture selectors/argument handling and the mobile composer/logo defects were corrected and rerun; failed/duplicate captures are not final acceptance evidence.

## 26. Remaining manual deployment checks and stop condition

Use [production smoke checklist](PRODUCTION_SMOKE_CHECKLIST.md) and [defense checklist](DEFENSE_CHECKLIST.md) for the actual deployed revision, frontend API URL, SPA deep links, CORS, verified mail/Google flows, transactions/indexes, OneSignal, reminder operation and optional Calendar flow. Rehearse real participant tutoring/settlement/review, self-paced assessment/reward and staff review/dispute/audit with owner-selected accounts. Confirm physical mobile keyboard/touch, screen reader, native browser/text zoom and real latency. These live checks were not substituted with mocked evidence.

Dwight's 20-credit explanation requires his local account/ledger when reachable; do not manually change it or backfill history. Local browser acceptance supports a candidate for live/manual sign-off, not a claim that production providers/data are verified.

| Action | Performed? |
| --- | --- |
| Production data modified | NO |
| Staged | NO |
| Committed/amended | NO |
| Pushed/merged | NO |
| Deployed / Render configuration changed | NO |
| Production MongoDB / Atlas indexes changed | NO |
| Manual balance changes / historical backfill | NO |

Stop after implementation, verification and this report.
