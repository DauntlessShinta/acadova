# Study-set rollout requirements

No production action has been performed. Study features require transaction-capable MongoDB, the existing unique Notification event key, and normal authentication/role/suspension/verification middleware. Browsing shared sets requires an authenticated eligible Student, just like Learning. Staff may review sets; staff cannot create/take Student study quizzes. No paid access or credits apply.

## Correctness index: StudyReport

Before enabling report intake in production, the operator must inspect `studyreports` and verify the exact unique compound definition `{ studySet: 1, reporter: 1 }`, named `uniq_study_report_set_reporter`, with no partial filter or sparse option. API reporting fails closed (503) if this definition is absent or different. One record per set/reporter is reused when a closed report is reopened; `cycle` rejects stale closures and each closure is audited. Active reports are capped at 100 per set. Existing documents must be inventoried and duplicate keys resolved with an owner-reviewed plan before a separately authorized index creation; never blindly drop or rebuild indexes.

All new collections start empty. No historical Session, balance, assessment claim or study content is migrated/backfilled. Auto-indexing is disabled in production. Verify existing correctness indexes for rewards/notifications separately under their existing rollout guides. Merely declaring schema indexes does not prove deployed constraints.

Performance indexes declared: StudySet `{ owner:1, deletedAt:1, updatedAt:-1 }` and `{ state:1, deletedAt:1, publishedAt:-1 }`; StudyAttempt `{ student:1, startedAt:-1 }`; StudyReport `{ state:1, updatedAt:1 }`. List/search/results and staff queues are bounded to 100 records. Approve representative production query plans and pagination/backlog handling separately; this basic UI does not implement a full LMS or unbounded search.

Study outcomes enqueue durable owner in-app Notifications inside the decision transaction, using the existing `notifications:scan` worker for optional push delivery/retries. Keep the worker running approximately once per minute with connectivity/backlog monitoring. No additional scheduler or provider configuration is introduced. Provider success, live index definitions and worker operation remain production prerequisites.

## Revision and retention policy

- Saves may be incomplete. Quiz start, answer review and submission for publication require 1–50 valid single-answer MCQs, 2–5 distinct options each, title and subject.
- A content edit increments `revision` and `version`, makes the set private and clears approval. Owners submit the saved revision again; staff approval/restore records its current revision and a fresh publication ID. All staff decisions require the observed version and a 10–500-character reason. Staff cannot approve their own historical Student sets.
- Owner quiz attempts use a private immutable snapshot. They can finish and view their started attempt after edits or deletion. Submitted results are always own-user only.
- Other-user start/detail/review/search require current publication. Active public attempts can be submitted only while the exact revision and publication ID remain available. Edit, withdrawal, unpublish, deletion and removal revoke active public access/submission. Republishing does not reactivate old attempts. Already submitted results remain in the taker's private history with their original snapshot.
- Deletion is a tombstone: it removes all set discovery/detail/start/review access. Snapshots and audit/report records are retained for consistency; this is not a privacy-erasure mechanism. Result/attempt deletion and automated retention are outside this requested phase.
- Reports are quiz-specific, never Session disputes. Publication decisions and report closure do not invoke any credit, official assessment or Session settlement controller.
- Official practice uses `/api/assessments/:id/practice` with answers only. Its mode is set by the server route, never by client reward flags. Rewarded Students' `/submit` calls also become practice. Failed official attempts retain eligibility; the original first-passing reward transaction and index gate remain.
