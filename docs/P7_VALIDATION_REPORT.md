# P7 stabilization report — 2026-10-04

**Visual sign-off remains pending.** This is the requested regression, fixture and manual handoff checkpoint. The built-in browser is unavailable to the agent. No staging, commit, push, deployment or production-data change occurred.

## Transfer to the real repository

On 2026-10-04, only the 17 source/test/reusable documentation files listed below were transferred from the isolated P7 checkout to the real Acadova repository. Both were at the same Batch A/B/C baseline `9c7b59c`. Comparison found 9 substantive tracked P7 changes, 8 new project files and 215 unrelated line-ending-only differences; those 215 files were left unchanged. The real backend `.gitignore` modification and untracked `Acadova-P7.zip` remain byte-for-byte unchanged and unstaged. Existing environment files, dependencies, Git metadata and isolated runtime/database state were not copied.

The results in the numbered table below describe the isolated P7 run. Fresh real-repository results are recorded in the following section. The local test app/database remain in the original isolated runtime; do not assume its `.p7-local/` directory or test-safe environment exists in the real repository.

## Real repository transfer validation — 2026-10-04

All commands below ran in the real repository using its existing dependencies. No application server, fixture writer, notification worker or database was started for this validation. Backend tests used `NODE_ENV=test` with inherited `MONGO_URI` removed from the test process; existing environment files were left untouched.

| Check | Fresh result |
| --- | --- |
| Focused backend | `node --test --test-concurrency=2 tests/authIdentity.test.js tests/authFlow.test.js tests/authRevocation.test.js tests/loginSecurity.test.js tests/apiSecurity.test.js tests/validation.test.js tests/p7LocalFixture.test.js`: **119 passed, 0 failed**, 17.78 seconds. |
| Complete backend | `node --test --test-concurrency=2`: **301 passed, 0 failed**, 34.73 seconds. |
| Focused frontend | `node --test tests/profileSetup.test.js tests/batchBUxFollowup.test.js`: **4 passed, 0 failed**. |
| Complete frontend | `node --test`: **21 passed, 0 failed**, 1.72 seconds. |
| Frontend lint | `npm.cmd run lint`: exit 0, **21 existing warnings, 0 errors**. |
| Frontend production build | `npm.cmd run build`: passed, **1893 modules**, 2.92 seconds. Build output is ignored and excluded from staging. |
| Backend syntax | `node --check` passed for all **10 transferred backend JavaScript files**. |
| Password helper syntax | PowerShell AST parsing passed without executing the credential-rotation script. |
| Whitespace | `git diff --check` passed; Git printed Windows LF/CRLF notices only. |
| Preservation | Unrelated tracked files, protected `.gitignore`, ZIP and existing environment files verified byte-for-byte against the pre-transfer manifest; HEAD unchanged and index empty. |

The first concurrent lint/build attempts hit host memory/process failures. Running lint and build individually with `RAYON_NUM_THREADS=1` passed without source changes. Logs and backups remain outside the real repository in the Codex workspace's `.p7-transfer/` directory.

This validates the source transfer and automated regression results. Remaining manual visual checks and production checks are still pending; neither is represented as complete.

## Existing isolated P7 checkpoint

| Requested item | Evidence and outcome |
| --- | --- |
| 1. Initial state | Matching original main checkout at `9c7b59c`; only pre-existing changes were backend `.gitignore` and `Acadova-P7.zip`. Existing isolated `acadova-p7` reused. |
| 2. Test accounts | Five verified synthetic local actors: A/B are students with 100 credits, Moderator/Admin/C have 0. A registered through UI; normal verification and ledger-backed grants used. No credentials printed/committed. |
| 3. Browser flows | Landing, registration validation/policy, recovery generic response, email-unavailable state, safe verification, A login/setup/save, Home, skill search, B profile. Full two-user E2E is not claimed. |
| 4. Learner | Setup save and Home interests, actions, balance100 and empty states observed. Post-fix onboarding/skip/return retest pending. |
| 5. Tutor | B found for P7 JavaScript, role student; profile/no-review state observed. Teaching acceptance UI pending. |
| 6. Lifecycle | Pending request and disputed case prepared through normal controllers, including check-ins and finish. Visible confirmation/completion pending; time guards preserved. |
| 7. Chat | Automated coverage passes. Visual draft survival across 3 polls, two-user delivery/order/failure pending. |
| 8. Meeting | Optional Google unconfigured; manual coordination link used in fixture. Visual save/join/invalid URL/ownership/fallback-tab checks pending. |
| 9. Credits | Only two opening grants; A/B100 and staff/C0. Fixture repeat preserved balances/counts. Settlement/reward/unlock tests pass; visible once-only wallet proof pending. |
| 10. Reviews | Empty profile state observed; creation/display/duplicate/moderation UI pending. Automated checks pass. |
| 11. Learning | Published topic, ordered free/paid modules, text/HTTPS/paid resources and review submission prepared through audited controllers. Student visual navigation/resume pending. |
| 12. Assessment | Published qualifying 3-question assessment ready. No setup reward performed. Automated grading/reward passes; visible pass/retry/credit proof pending. |
| 13. Moderator | Disputed evidence and submission ready; queue/filter/resolve/content/audit UI pending. |
| 14. Admin | Local Admin ready; Users/configuration/correction/audit UI pending. Automated role/transaction coverage passes. |
| 15. Security Center | Cooldown/suspension/audit tests pass; local UI cooldown/recovery/suspended-attempt case pending. |
| 16. Policy | Gated scroll/check/agreement, early close, reopen, Tab/Escape focus and narrow layout observed; explicit user approval obtained. |
| 17. Responsive | Approximately390px register/modal inspected without observed overflow. Remaining student/staff desktop/tablet/mobile matrix pending. |
| 18. Accessibility | Policy keyboard/Escape/focus observed; broader labels, validation focus, tables/notifications/toasts pending. No full accessibility audit claimed. |
| 19. Roles | Source/API regression preserves current DB roles and participant ownership. Direct-route browser denial matrix pending. |
| 20. Visual defects | First login led to blank onboarding; reload rendered it. Page changes retained scroll and hid headings/feedback. Automated native date entry did not populate; no product date defect established. |
| 21. Fixes | Router-subscribed onboarding guard; navigation scroll reset preserving hash links; unverified Google claim discards prior password/recovery state; atomic random authentication version on recovery/claim plus bearer enforcement; neutral DB connection log. |
| 22. Changed files | Exact list below, all in isolated checkout. |
| 23. Security | Both existing auth findings fixed with focused tests. Fresh reviewer found no concrete bypass/regression. Lean Google reads preserve raw historical missing verification fields. Random version avoids counter overflow. Verified/legacy linking and single-use recovery retained. |
| 24. Backend | **301 passed/0 failed**, concurrency2,42.25s. Focused auth/authorization checks **118 passed/0 failed**. |
| 25. Frontend | **21 passed/0 failed**,1.56s. |
| 26. Lint/build | Lint exit0,21 existing warnings/no errors. Build passed,1893modules,2.85s with one worker. Changed backend JS syntax passed; Git whitespace passed, Windows line-ending notices only. |
| 27. DB/indexes | Local primary and exact target verified on27027. Production transaction topology/critical indexes remain owner-verified requirements. Session-version field needs no index/backfill. |
| 28. Production config | Names-only core/mail/optional Google/push/reminder checklist prepared. No secret values reported. |
| 29. Production limits | URLs could not be confirmed through web retrieval. No deployed revision, live delivery/provider/consent/index/scheduler result claimed. |
| 30. Smoke plan | `PRODUCTION_SMOKE_CHECKLIST.md` lists exact owner-run steps and which create production records. |
| 31. Defense plan | `DEFENSE_CHECKLIST.md` includes 4 demos, actors, prepared starting points, private credentials/restart and unchecked visual matrix. |
| 32. Known limits | Browser unavailable and UI fixes not visually retested. Prior synthetic password lived only in lost browser memory; masked-input local rotation script provided. Google optional, mail/push disabled, reminders manual, same-browser resume only; credits have no money value. |
| 33. Deferred extras | No new major features or aesthetic redesign added; no WebSockets/video/payments/uploads/social/AI/new-role architecture. |
| 34. Stage list | Exact future review/stage list below; **do not stage** until user approval after visual sign-off. |
| 35. Future message | `fix: stabilize P7 auth onboarding and local defense workflow`, only after remaining verification/report updates and approval. |

## Security proof and review limits

Recovery regression executes the actual controller, login service and middleware with synthetic persistence: access succeeds before recovery; old and legacy tokens return401 after recovery; fresh password login/access works; reused reset links fail without revoking the new session. Google regression executes actual controller/bcrypt: old pending password fails comparison, old recovery state is cleared, grant stays once-only, verified staff and raw historical missing-verification accounts retain normal linking. Provider identity and persistence are mocked; no live Google exploit is claimed.

The existing baseline security scan was sealed with **partial coverage:77/249 tracked files**.172 paths were deferred at the user's instruction to avoid another repo-wide audit. Focused financial review found no additional concrete issue; deployed indexes remain unknown. The audit harness was blocked by sandbox EPERM and automatic approval review rejected escalation under its read-only worker instruction. Authorized fix regression subsequently passed. The sealed source audit describes the baseline, not a second whole-repository post-fix audit.

## Exact transferred files for future review/staging

```text
README.md
acadova-backend/controllers/authController.js
acadova-backend/middleware/authMiddleware.js
acadova-backend/models/User.js
acadova-backend/server.js
acadova-backend/services/loginSecurityService.js
acadova-backend/utils/authVersion.js
acadova-backend/scripts/prepareP7Local.js
acadova-backend/scripts/Set-P7DemoPassword.ps1
acadova-backend/tests/authIdentity.test.js
acadova-backend/tests/authRevocation.test.js
acadova-backend/tests/p7LocalFixture.test.js
acadova-frontend/src/App.jsx
acadova-frontend/src/layouts/AppLayout.jsx
docs/DEFENSE_CHECKLIST.md
docs/PRODUCTION_SMOKE_CHECKLIST.md
docs/P7_VALIDATION_REPORT.md
```

Exclude `.p7-local/` and `.p7-transfer/` runtime/transfer state, ignored environments, node_modules/build output, Mongo data/logs, credentials, the pre-existing `.gitignore` change and `Acadova-P7.zip`. No full checkout copy was performed. Record manual outcomes/screenshots and update this report before declaring P7 complete.
