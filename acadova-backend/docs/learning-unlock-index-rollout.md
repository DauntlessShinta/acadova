# P3.5B paid learning unlock index rollout

This document is a plan, not an executed production migration. Production Mongoose automatic index creation is disabled for `LearningUnlock` and `CreditTransaction`. First paid unlocks fail closed with HTTP 503 until all four named unique indexes below are present. Already-owned and free content remain accessible.

Before any production index change, back up and inspect `learningunlocks` and `credittransactions`, their existing indexes, and any existing `learning_unlock` rows. Stop for manual review if there are duplicate Student/content pairs, orphaned rows, or unexpected legacy unlock events. Do not drop or alter the existing Session, opening-grant, assessment-reward, or learning-topic indexes.

In an approved maintenance window, create and verify:

1. `learningunlocks`: unique `{ student: 1, resource: 1 }`, name `uniq_learning_unlock_student_resource`, partial filter `{ resource: { $exists: true } }`.
2. `learningunlocks`: unique `{ student: 1, module: 1 }`, name `uniq_learning_unlock_student_module`, partial filter `{ module: { $exists: true } }`.
3. `credittransactions`: unique `{ fromUser: 1, resource: 1, type: 1 }`, name `uniq_learning_unlock_ledger_resource`, partial filter `{ type: 'learning_unlock', resource: { $exists: true } }`.
4. `credittransactions`: unique `{ fromUser: 1, module: 1, type: 1 }`, name `uniq_learning_unlock_ledger_module`, partial filter `{ type: 'learning_unlock', module: { $exists: true } }`.

Confirm exact names, key order, uniqueness, and partial predicates via `getIndexes()`. Do not call `syncIndexes()` or rely on application startup to create them. Then manually test one resource and one module unlock, retry and concurrent requests, insufficient balance, wallet history, direct-access protection, and archived-content behavior. Confirm each Student/content pair has one entitlement, one ledger row, and one balance deduction. Existing module entitlement allows viewing its ordered resources *within that module* but does not grant standalone resource entitlements. Archival removes Student access without deleting historical entitlement or ledger evidence. External HTTPS URLs can be shared once disclosed; Acadova controls disclosure, not third-party copies.
