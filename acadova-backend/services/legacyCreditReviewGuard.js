// The historical typo namespace is evidence only, never a normal model or a
// source of automatic settlements. Unknown/conflicting evidence also blocks.
const LEGACY_COLLECTION = 'credittranactions';
const MAX_TIME_MS = 8000;
const reject = message => { throw Object.assign(new Error(message), {status:409}); };

async function assertLegacyReviewable(row, tx, {Credit, User}) {
  if (!tx?.inTransaction()) throw new Error('Legacy review requires a transaction.');
  if ((row.economyVersion !== undefined && row.economyVersion !== null) || row.creditsSettledAt || row.legacyObligationResolvedAt
    || row.legacyObligationReview || !['pending','accepted','scheduled','in_progress','awaiting_validation','no_show','disputed','completed'].includes(row.status)
    || !Number.isSafeInteger(row.creditAmount) || row.creditAmount <= 0
    || !row.learner || !row.tutor || String(row.learner) === String(row.tutor)) {
    reject('Only unresolved priced legacy obligations can be reviewed.');
  }
  // Native read bypasses no write guard: this collection is never registered,
  // created, merged or written. Project only existence, within the same snapshot.
  for (const name of [Credit.collection.collectionName, LEGACY_COLLECTION]) {
    const evidence = await Credit.db.db.collection(name).findOne(
      {session:row._id}, {session:tx, projection:{_id:1}, maxTimeMS:MAX_TIME_MS});
    if (evidence) reject('Existing payment evidence requires restricted reconciliation before a proposal or consent.');
  }
  // Fence both accounts so suspension/promotion cannot race either consent.
  for (const id of [row.learner,row.tutor].sort((a,b)=>String(a).localeCompare(String(b)))) {
    const participant = await User.findOneAndUpdate(
      {_id:id,role:'student',suspendedAt:null,emailVerified:{$ne:false}},
      {$currentDate:{updatedAt:true}},
      {session:tx,timestamps:false,new:true,maxTimeMS:MAX_TIME_MS}).select('_id').lean();
    if (!participant) reject('Both actual participants must remain eligible; otherwise retain the obligation freeze.');
  }
}

module.exports = {assertLegacyReviewable, LEGACY_COLLECTION, MAX_TIME_MS};
