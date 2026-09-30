# Phase 3 credit verification and reconciliation

Acadova credits are internal, non-cash units. The only supported ledger events are `initial_grant`, `session_payment`, `assessment_reward`, `learning_unlock`, and `admin_adjustment`. The backend owns amounts: defaults are 100 / 20 / 20 for starting grant, tutoring cost, and assessment pass. Admin rules affect only new events. A registration snapshots its grant, a Session stores its price, an awarded attempt stores its reward, a paid entitlement stores `pricePaid`, and every ledger row stores its actual amount. No historical row is rewritten by a rule change.

Credit writes must be transactionally paired: verification grant + User balance; Session Learner debit + Tutor credit + ledger; assessment reward + User balance + attempt; paid learning debit + entitlement + ledger; Admin correction + User balance + ledger. Database uniqueness and conditional claims guard retries. The Student wallet shows the current `User.credits` and *recorded* ledger totals, never a reconstructed lifetime balance.

## Read-only dry-run

Use a dedicated MongoDB account with only the built-in `read` role on the `acadova` database. The script does not load `.env`, will not connect without an explicitly supplied URI, and rejects connections with broader roles. Review the target URI yourself before running it; do not put production credentials in logs or shell history. From `acadova-backend`:

```powershell
$env:ACADOVA_CREDIT_DRY_RUN_MONGO_URI = '<explicit read-only URI>'
node scripts/creditReconciliationDryRun.js --dry-run
```

The script only calls `find` and `indexes`. It reports User and event counts, invalid amounts/balances, structurally broken Session payments, duplicate-looking event/entitlement evidence, orphaned paid entitlements/ledger rows, malformed Admin adjustments, and readiness of the nine named unique indexes. Samples are capped at 25 identifiers per category; no names, emails, passwords, or tokens are reported. It performs no fixes, writes, backfill, index creation/drop, or `syncIndexes()`.

`legacyUnreconcilableUsers` counts Students without an opening-grant ledger row. Their current balance cannot be inferred from recorded events because historical balances may predate ledger coverage. A `ledgerCoveredBalanceMismatchCandidate` is only a review signal, not proof of a missing transaction; inspect historical context manually. Never auto-adjust these balances from dry-run output.

The checker verifies the named production indexes declared by `CreditTransaction`, `LearningUnlock`, and `LearningTopic`: Session payment; initial grant; assessment reward; resource/module unlock ledger; Admin adjustment reference; resource/module entitlement; and topic slug. Historical rollout procedures are in `credit-index-rollout.md`, `assessment-reward-index-rollout.md`, `learning-unlock-index-rollout.md`, `admin-credit-index-rollout.md`, and `learning-topic-index-rollout.md`. Those plans are not evidence of the *current* deployment state. The index readiness report is read-only; any missing index requires a separate approved database procedure.

## Final manual integration checks

On a dedicated test database first, exercise two concurrent paid debits against one low balance, an intentionally failed ledger write to confirm transaction rollback, concurrent same-key adjustment/unlock/reward requests, and all production unique indexes. The unit suite mocks Mongoose transactions and cannot by itself prove replica-set rollback or deployed index state. An automated live-Mongo integration test is intentionally not part of the normal suite because no isolated `TEST_MONGO_URI` is configured here.

For a deployed E2E pass, verify registration/grant; configured Session price and one validated settlement; a historical 1/2-credit Session; assessment first pass/repeat; free and paid resources/modules; module-scoped access versus standalone paid-resource access; archived-content denial without deleting historical evidence; Admin credit/debit and duplicate-reference conflict; Student/Moderator denial; wallet signs and current balance; and Admin analytics source categories. Do not use this checklist to mutate production balances or indexes without separate approval.
