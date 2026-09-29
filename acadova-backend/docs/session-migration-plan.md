# Session lifecycle migration preparation (P2.9)

No production data was changed in this phase. The inventory script reads only `sessions`, `credittransactions`, and `ratings`. It does not load `.env`, and it refuses a connection unless MongoDB reports only the built-in `read` role on the `acadova` database. Use dedicated read-only credentials; do not substitute the application URI.

From `acadova-backend`, after setting `ACADOVA_DRY_RUN_MONGO_URI` through a secure environment mechanism, run:

```text
node scripts/sessionMigrationDryRun.js --dry-run
```

Review the JSON counts and anomaly samples. Only the first 100 anomalous Session IDs are shown; `anomaliesOmitted` reports additional cases. The report uses majority reads but is not a single point-in-time snapshot if users continue changing Sessions during the scan. Repeat during a quiet period before approving writes.

Future migration design (not implemented):

1. Record before counts and review every dry-run anomaly category. Hold any Session with contradictory payment, rating, or timestamp evidence for manual reconciliation.
2. After explicit approval, migrate only safe `accepted -> scheduled` and `rejected -> declined` candidates. A `safeCandidate` in the report means structurally eligible, not authorized for an immediate write: active `accepted` Sessions may still need the legacy completion path, so first confirm client rollout and drain or individually assess in-flight Sessions. Use per-document conditional updates requiring the old status and the structural evidence checked by the dry run. Batch with a restart cursor; rerunning must skip already-mapped records. Re-read each candidate before its write because the dry-run is not a snapshot.
3. Leave `completed` records stored as `completed`. A single matching `session_payment` ledger row establishes historical settlement; do not fabricate check-ins, `startedAt`, `awaitingValidationAt`, or participant-confirmation timestamps. Missing, mismatched, or duplicate payment evidence stays unchanged for manual review. Ratings alone never prove settlement.
4. Never change User balances, create or delete CreditTransactions, create Ratings, or automatically resolve anomalies in a status migration. Compare after counts and anomaly totals with the before report.
5. Keep `accepted`/`rejected` reads and request inputs, plus the legacy `accepted -> completed -> Learner confirmation` path, until deployed clients have switched to canonical decisions and stored legacy Sessions have been reconciled or migrated. Removing those branches needs a separate approval and deployment audit.
