# Focused Public/Auth visual rollback

October 6, 2026 (Asia/Manila) ? visual reference: **1ef2440**, the current committed HEAD.

The original Acadova Landing, Login and Register presentation is restored. Auth verification/recovery routes share the restored shell for consistency. This is a scoped visual rollback; current authenticated UI, authentication/security logic, backend fixes and assets are preserved.

## 1. Exact files restored or edited

These 19 files changed relative to the working tree at the start of this rollback. A file returning to its committed contents may disappear from `git status`; it is still listed here as restored.

```text
acadova-frontend/src/components/common/Footer.jsx
acadova-frontend/src/components/common/Navbar.jsx
acadova-frontend/src/index.css
acadova-frontend/src/layouts/AuthLayout.jsx
acadova-frontend/src/pages/ForgotPasswordPage.jsx
acadova-frontend/src/pages/LandingPage.jsx
acadova-frontend/src/pages/LoginPage.jsx
acadova-frontend/src/pages/RegisterPage.jsx
acadova-frontend/src/pages/ResetPasswordPage.jsx
acadova-frontend/src/pages/VerificationPendingPage.jsx
acadova-frontend/src/pages/VerifyEmailPage.jsx
acadova-frontend/src/styles/landing.css
acadova-frontend/tests/browser-demo.mjs
acadova-frontend/tests/browser-hardening.jsx
acadova-frontend/tests/browser-quality.jsx
docs/ACADOVA_MASTER_DESIGN_SYSTEM.md
docs/GLOBAL_UI_UX_POLISH_REPORT.md
acadova-frontend/tests/browser-rollback.jsx
docs/PUBLIC_AUTH_VISUAL_ROLLBACK_REPORT.md
```

The new browser fixture and report are additions. Screenshots in `docs/ui-ux-polish/rollback/` are separate local review evidence, not application assets. Prior polish screenshots/reports remain; the global report now identifies its public/auth redesign as historical and links here.

## 2. Landing changes rolled back

Restored the 1ef2440 component content and complete Landing-specific stylesheet: original blue/gradient composition, large two-part headline, value strip, connected-skill illustration, comparison section, How Acadova works timeline, credit exchange preview, Features, skill explorer, dashboard preview, community, original SDG 4 treatment and final CTA structure. Public navbar destinations and public footer content match these sections again.

Removed the rejected photo/Session-preview composition, shorter education-site narrative and redesigned two-path/trust panels. The illustration/interactive examples are back. No business rules or balances are changed by those examples.

Kept current role-aware workspace destinations, motion-aware hash scrolling and frame cleanup. Landing stylesheet and AuthLayout text match the reference apart from normal working-copy line endings; Landing JSX differs only for those technical navigation/scroll safeguards.

## 3. Login changes rolled back

Restored the split-screen brand/form composition, large brand heading, knowledge-network visual, original 465px form card, form heading typography, eyebrow treatment, spacing and account-switch presentation. The simplified centered shell is removed.

Login source/markup matches 1ef2440 while continuing to use the unchanged current auth services/context/utilities. Password visibility, field validation, server cooldown/error handling, Forgot Password, configured Google sign-in, auth recovery and loading/submission guards are preserved.

## 4. Register changes rolled back

Restored the same original Acadova shell/card, heading hierarchy and single-column password-requirements presentation. The simplified signup composition is removed.

Current Unicode-friendly syntactic name validation, email/password rules, visibility controls, verification flow, valid-value preservation, first-invalid focus, inline errors, submission guard and backend payload remain. Full name, Email and Password remain the core account fields; existing Confirm password and required policy-review acknowledgment are retained. No demographic fields were added.

## 5. Verify Email and shared Auth impact

Verification Pending/Result, Forgot Password and Reset Password use the restored AuthLayout and form H2 styling because they share the same shell. Only their heading/presentation changed; request/token/state/error handling did not. Pending verification retains the current clearer unverified/inbox/spam explanation, masked email, resend/cooldown and alternate-email action. Verification Result retains result focus and current authentication behavior.

The shared CSS was **not** restored wholesale. Only the Auth-specific block, its compact reflow and the recently added Auth-only overrides were changed. Policy separators are centered alongside their retained larger link targets.

## 6. Accessibility and branding preserved

Shared click-target floors, 44px important controls, form sizing, visible focus, semantic actions, password toggle names, associated validation, disabled/loading feedback, policy-dialog behavior and reduced-motion rules remain. Old Landing animation/style is restored with its existing reduced-motion media rule and current motion-aware navigation safeguard.

The result deliberately resembles the baseline rather than being pixel-identical: retained targets/focus and taller policy-link hit areas change some control heights/card centering. Before/after snapshots use identical viewport, fixture data, canonical fonts and 100% zoom. Reduced motion is enabled on both sides to avoid animation-phase noise.

The baseline already uses the same Layers mark and Acadova wordmark. Public/Auth treatment around it is restored. Authenticated sidebar/mobile/header branding is unchanged. The matching SVG favicon remains used; no logo replacement was necessary.

## 7. Unrelated holistic improvements preserved

An initial SHA-256 manifest confirms no edits to backend files, AuthContext, auth/name utilities, Dashboard, Peer/Tutor pages/components, Learning, Session Room/expanded Chat, staff pages or protected local files. The global stylesheet changes are confined to Auth selectors. Public footer content is conditional so the current authenticated footer remains.

Fresh actual-App fixtures pass on desktop/mobile for Dashboard/Peers, Learning and moderation, Session actions, Credits/Profile, Moderator/Admin surfaces, keyboard-scroll tables, enlarged targets and normal/expanded Chat. Chat behavioral regressions also pass for draft/scroll preservation, polling, new-message hint, send failure, focus/visibility/modal read gating, notification sound/mute, repeated navigation and one composer. No backend test rerun was needed because no backend file changed.

Protected `.agents/`, `Acadova-P7.zip`, backend `.gitignore`, AGENTS and deprecated backend/public remain untouched by this rollback.

## 8. Unused new Landing assets

- `acadova-frontend/public/images/peer-study.webp`: now unused by runtime source/styles; **retained**, 149,604 bytes (about 146 KiB).
- `acadova-frontend/public/images/README.md`: provenance/license record for that retained photograph; **retained**.

No runtime photo reference remains. No image or unrelated asset was deleted. Decide whether to exclude these unused photograph files when preparing a later final commit. The used `public/acadova-mark.svg` favicon is kept.

## 9. Visual verification

Reference captures were rendered from an isolated copy of the frontend source/public files read from 1ef2440; the current working tree was not checked out or reset. The reference source copy was removed after comparison. API responses were in-memory fixtures; no live database/account or production provider was used.

Landing, Login, Register and Verify Pending passed and were visually compared at **1648x920, 1366x768, 1024x920 and 390x844**, 100% zoom / device scale 1, with canonical fonts. How it works, credit preview, skill explorer, dashboard preview and SDG were additionally compared below the fold at desktop/mobile. No document overflow or new browser runtime/console errors were reported.

| Size | Landing | Login | Register | Verify Pending |
| --- | --- | --- | --- | --- |
| 1648x920 | [Reference](ui-ux-polish/rollback/baseline/landing-1648.png) / [Restored](ui-ux-polish/rollback/current/landing-1648.png) | [Reference](ui-ux-polish/rollback/baseline/login-1648.png) / [Restored](ui-ux-polish/rollback/current/login-1648.png) | [Reference](ui-ux-polish/rollback/baseline/register-1648.png) / [Restored](ui-ux-polish/rollback/current/register-1648.png) | [Reference](ui-ux-polish/rollback/baseline/pending-1648.png) / [Restored](ui-ux-polish/rollback/current/pending-1648.png) |
| 1366x768 | [Reference](ui-ux-polish/rollback/baseline/landing-1366.png) / [Restored](ui-ux-polish/rollback/current/landing-1366.png) | [Reference](ui-ux-polish/rollback/baseline/login-1366.png) / [Restored](ui-ux-polish/rollback/current/login-1366.png) | [Reference](ui-ux-polish/rollback/baseline/register-1366.png) / [Restored](ui-ux-polish/rollback/current/register-1366.png) | [Reference](ui-ux-polish/rollback/baseline/pending-1366.png) / [Restored](ui-ux-polish/rollback/current/pending-1366.png) |
| 1024x920 | [Reference](ui-ux-polish/rollback/baseline/landing-1024.png) / [Restored](ui-ux-polish/rollback/current/landing-1024.png) | [Reference](ui-ux-polish/rollback/baseline/login-1024.png) / [Restored](ui-ux-polish/rollback/current/login-1024.png) | [Reference](ui-ux-polish/rollback/baseline/register-1024.png) / [Restored](ui-ux-polish/rollback/current/register-1024.png) | [Reference](ui-ux-polish/rollback/baseline/pending-1024.png) / [Restored](ui-ux-polish/rollback/current/pending-1024.png) |
| 390x844 | [Reference](ui-ux-polish/rollback/baseline/landing-390.png) / [Restored](ui-ux-polish/rollback/current/landing-390.png) | [Reference](ui-ux-polish/rollback/baseline/login-390.png) / [Restored](ui-ux-polish/rollback/current/login-390.png) | [Reference](ui-ux-polish/rollback/baseline/register-390.png) / [Restored](ui-ux-polish/rollback/current/register-390.png) | [Reference](ui-ux-polish/rollback/baseline/pending-390.png) / [Restored](ui-ux-polish/rollback/current/pending-390.png) |

Below-the-fold comparisons:

| Section | Desktop reference / restored | Mobile reference / restored |
| --- | --- | --- |
| how-it-works | [Reference](ui-ux-polish/rollback/baseline/landing-how-it-works-1366.png) / [Restored](ui-ux-polish/rollback/current/landing-how-it-works-1366.png) | [Reference](ui-ux-polish/rollback/baseline/landing-how-it-works-390.png) / [Restored](ui-ux-polish/rollback/current/landing-how-it-works-390.png) |
| credit-system | [Reference](ui-ux-polish/rollback/baseline/landing-credit-system-1366.png) / [Restored](ui-ux-polish/rollback/current/landing-credit-system-1366.png) | [Reference](ui-ux-polish/rollback/baseline/landing-credit-system-390.png) / [Restored](ui-ux-polish/rollback/current/landing-credit-system-390.png) |
| skill-network | [Reference](ui-ux-polish/rollback/baseline/landing-skill-network-1366.png) / [Restored](ui-ux-polish/rollback/current/landing-skill-network-1366.png) | [Reference](ui-ux-polish/rollback/baseline/landing-skill-network-390.png) / [Restored](ui-ux-polish/rollback/current/landing-skill-network-390.png) |
| dashboard-preview | [Reference](ui-ux-polish/rollback/baseline/landing-dashboard-preview-1366.png) / [Restored](ui-ux-polish/rollback/current/landing-dashboard-preview-1366.png) | [Reference](ui-ux-polish/rollback/baseline/landing-dashboard-preview-390.png) / [Restored](ui-ux-polish/rollback/current/landing-dashboard-preview-390.png) |
| sdg-section | [Reference](ui-ux-polish/rollback/baseline/landing-sdg-section-1366.png) / [Restored](ui-ux-polish/rollback/current/landing-sdg-section-1366.png) | [Reference](ui-ux-polish/rollback/baseline/landing-sdg-section-390.png) / [Restored](ui-ux-polish/rollback/current/landing-sdg-section-390.png) |

Preserved app samples: [Dashboard](ui-ux-polish/rollback/preserved-app/home-1366.png), [Tutors](ui-ux-polish/rollback/preserved-app/tutors-1366.png), [Learning](ui-ux-polish/rollback/preserved-app/learning-1366.png), [resource moderation](ui-ux-polish/rollback/preserved-app/review-1366.png), [Admin Users](ui-ux-polish/rollback/preserved-app/admin-users-1366.png), [expanded desktop Chat](ui-ux-polish/rollback/preserved-app/chat-expanded-1366.png), [expanded mobile Chat](ui-ux-polish/rollback/preserved-app/chat-expanded-390.png).

The 59 selected PNGs are local review artifacts. Temporary duplicate/result captures and reference-source files were removed after preservation. Reusable `browser-rollback.jsx` captures Public/Auth; `browser-quality.jsx` expectations now match the preferred design and retain authenticated checks; `browser-hardening.jsx` tests the restored named illustration/reduced motion. `browser-demo.mjs` supports an explicitly enabled isolated baseline root using the already-installed React Vite plugin. No dependencies were added.

## 10. Tests, lint, build and diff

| Check | Current result |
| --- | --- |
| Focused frontend auth/name/policy suite | **9 passed, 0 failed** |
| Complete frontend suite | **38 passed, 0 failed** |
| Before/after browser matrix | All four sizes passed for both reference/current |
| Current app quality regression | 1366x768 and 390x844 passed, including reduced-motion setting |
| Chat behavior regression | 1366x768 and 390x844 passed |
| Lint | Exit 0, 0 errors, **2 existing AuthContext warnings** (Fast Refresh and state-in-effect) |
| Production build | Passed; CSS 130.56 kB / 23.92 gzip, JS 541.62 kB / 148.90 gzip |
| Build warning | Existing >500 kB chunk warning remains |
| `git diff --check` | Passed |
| Backend | No changes in this rollback; not rerun |

Tests/build required approved local worker/browser execution. Initial lint included the temporary reference copy; final lint was run after removing it and has only the two existing warnings above. No test or verification required a real DB, production account or balance edit.

## 11. Stop-state

Nothing was staged, committed, amended, pushed, merged or deployed. Render, production MongoDB, Atlas indexes and user balances were not modified. Unrelated uncommitted work remains preserved. Stop after this report.
