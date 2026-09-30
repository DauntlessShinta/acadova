# P4 AuditLog production rollout

The P4 code does not create production indexes or backfill historical audit records. `AuditLog` writes are required for the new privileged actions and share their MongoDB transactions. Deploy only against the existing replica-set-capable MongoDB setup already used for Session and Credit transactions.

After approval, inspect `db.auditlogs.getIndexes()` and collection size. The optional nonunique read-performance indexes are `{ createdAt: -1, _id: -1 }`, `{ action: 1, createdAt: -1 }`, `{ actor: 1, createdAt: -1 }`, and `{ targetType: 1, targetId: 1, createdAt: -1 }`. Create them in an approved maintenance window if needed for production traffic; no unique AuditLog index or data migration is required. Do not run `syncIndexes()` or enable production `autoIndex` to perform this rollout automatically.

Confirm an Admin can read a bounded audit page and a Moderator cannot. Exercise one nonfinancial privileged action, verify exactly one audit row, and confirm the action fails without committing when audit storage is unavailable. Review production operations before exercising financial or dispute writes.
