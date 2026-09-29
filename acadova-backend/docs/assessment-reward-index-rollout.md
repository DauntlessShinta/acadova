# P3.4 assessment reward index rollout — approval required

This plan has **not** been run against production. `CreditTransaction` disables automatic production index creation. Passing assessment submissions fail closed with HTTP 503 in production until the named unique index is present. Do not bypass that gate.

1. Back up `credittransactions`. Inspect `db.credittransactions.getIndexes()` and check for existing `assessment_reward` rows, duplicate `{toUser, assessment}` pairs, and missing references. Stop for manual review if any unexpected rows or conflicts exist. Do not rewrite historical Session payments or opening grants.
2. In an approved maintenance window, create a unique partial index on `db.credittransactions` with keys `{ toUser: 1, assessment: 1, type: 1 }`, name `uniq_assessment_reward_recipient_assessment`, and `partialFilterExpression: { type: 'assessment_reward', toUser: { $exists: true }, assessment: { $exists: true } }`. Verify the exact keys, unique setting, and predicate via `getIndexes()`.
3. Keep the existing `uniq_session_payment_session` and `uniq_initial_grant_recipient` indexes unchanged. Do not run `syncIndexes()`, drop indexes, or rely on Mongoose auto-indexing in production.
4. Deploy and test one failed attempt, first pass, repeated pass, concurrent retry, and a second Student's pass. Confirm each Student receives at most one 20-credit ledger row and 20-credit balance increment for the Assessment. The atomic per-User claim and transaction remain required even with the unique index.

MongoDB multi-document transactions are required. If the index is absent or the rollout fails, leave rewards unavailable and investigate before enabling production use.
