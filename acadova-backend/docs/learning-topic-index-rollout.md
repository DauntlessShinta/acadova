# P3.5A learning topic index rollout

Production Mongoose automatic index creation is disabled for the new learning-content models. Do not rely on deployment to create indexes or run `syncIndexes()` automatically.

Before staff create topics in production, inspect `db.learningtopics.getIndexes()` and existing topic slugs. Resolve duplicate normalized slugs manually if any exist. In an approved maintenance window, create `{ slug: 1 }` as a unique index named `uniq_learning_topic_slug`. Verify its key and `unique: true` with `getIndexes()`. Topic creation fails closed with HTTP 503 while this index is missing. Do not drop or change existing credit indexes. The nonunique topic/resource/module browse indexes are performance optimizations and may be rolled out separately after inspection.

No production database or index changes are performed by P3.5A code changes.
