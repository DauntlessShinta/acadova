# Lesson completion rollout

This guide is a deployment prerequisite, not authorization to modify production. No production migration or index operation was executed in this implementation.

Deploy the compatible backend and frontend together. LearningResource adds `draft` to the existing status enum and optional immutable `creationOrigin` / `authorRole` evidence. New staff content starts as Draft; new Student submissions stay submitted. Existing records, including historical staff submissions, retain their original status and missing origin. Do not backfill or approve the pending QA resources. An older backend does not support the new Draft enum; inspect new drafts before any rollback.

The new `lessoncompletions` collection stores Student, Module, Resource and the server completion timestamp. No User, Module, AssessmentAttempt or credit-history migration is needed. Production auto-indexing is disabled. Completion writes return 503 until the exact unique index is present:

```javascript
{ key: { student: 1, module: 1, resource: 1 },
  name: 'uniq_student_module_lesson', unique: true }
```

The index must cover exactly those three fields, with no sparse option or partial filter. Have an authorized operator inspect the intended database, collection indexes and any duplicate compound keys before separately approving index creation. Do not drop/rebuild indexes automatically or discard duplicate evidence. The index also supports own-Student/module progress reads. Existing topic, entitlement, assessment-reward and audit index requirements remain in force; existing staff publication and assessment reward transactions require a replica set.

After the separately reviewed rollout, rehearse staff Draft -> Publish and Student contribution -> Approve with synthetic staging accounts; verify paid access, concurrent repeat completion, unchanged credits on completion and one reward on an official passing assessment. Inspect the recorded actor, origin, publication audit and persisted Module/Topic counts. Do not use the two pending QA resources as rollout mutations.

Historical lesson completion is never fabricated. Resources are completed separately in each Module. Removed/archived requirements retain their historical completion but leave the current denominator. Reattaching the same resource to the same module restores its existing completion evidence. Published compatible assessment requirements use passing official attempts, including legacy attempts whose mode is absent; practice passes are excluded. A shared attached assessment can satisfy each Module's distinct assessment requirement using the same official pass. Standalone assessments never enter curriculum progress. Empty curriculum has null percentage and is not complete. Display percentages are rounded to whole numbers and capped at 99 until every requirement is complete; exact numerator and denominator remain available.

Progress reads are read-only views of current curriculum and evidence; they do not grant credits or entitlements. External-resource completion is Student acknowledgment, not independent attendance/activity verification. Existing global content catalogs retain their 100-record bounds; the scoped staff workspace and Topic progress calculation query the selected topic's actual records.
