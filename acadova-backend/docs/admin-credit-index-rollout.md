# P3.6 Admin credit adjustment index rollout

This is a deployment plan, not an executed production database change. `CreditTransaction` has `autoIndex` disabled in production. The Admin adjustment endpoint returns HTTP 503 until the exact unique index below exists. Read-only Admin credit rules and activity may be deployed before index creation, but do not manually run adjustments or enable their UI for operators until index verification is complete.

Target collection: `credittransactions`.

Before an approved maintenance window, back up the database and inspect existing indexes and rows. Stop for manual review if an `admin_adjustment` row has a missing/malformed `adjustmentReference`, missing target/actor/direction/reason, or if any reference occurs more than once:

```javascript
db.credittransactions.getIndexes()
db.credittransactions.aggregate([
  { $match: { type: 'admin_adjustment' } },
  { $group: { _id: '$adjustmentReference', count: { $sum: 1 }, ids: { $push: '$_id' } } },
  { $match: { $or: [{ count: { $gt: 1 } }, { _id: null }] } }
])
```

If inspection is clean, create the index through the approved production database change process (not application startup):

```javascript
db.credittransactions.createIndex(
  { adjustmentReference: 1 },
  { name: 'uniq_admin_adjustment_reference', unique: true,
    partialFilterExpression: { type: 'admin_adjustment', adjustmentReference: { $exists: true } } }
)
```

Verify `getIndexes()` returns exactly that name, key, `unique: true`, and partial predicate. Do not drop or alter existing Session, opening-grant, assessment-reward, or learning-unlock indexes. Do not run `syncIndexes()`.

Deployment order: deploy code with adjustment writes fail-closed; inspect and create this index under approval; verify the index; then manually test Admin credit/debit, insufficient debit, duplicate reference/retry, Student and Moderator denial, wallet directions, recent activity, and transaction/ledger consistency. A duplicate reference with different details must return conflict. Rule configuration does not require a new secondary index; its singleton uses MongoDB's built-in `_id` index.
