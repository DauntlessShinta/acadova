const test=require('node:test'),assert=require('node:assert/strict');
const {assertLegacyReviewable:guard,LEGACY_COLLECTION,MAX_TIME_MS}=require('../services/legacyCreditReviewGuard');
const row={_id:'synthetic-session',learner:'learner',tutor:'tutor',creditAmount:20,status:'completed'};
const tx={inTransaction:()=>true};
function fixture({normal=null,legacy=null,unavailable=null,error=null}={}) {
  const reads=[],fences=[];
  const Credit={collection:{collectionName:'credittransactions'},db:{db:{collection:name=>({findOne:async(filter,options)=>{
    reads.push({name,filter,options});if(error)throw error;return name===LEGACY_COLLECTION?legacy:normal;
  }})}}};
  const User={findOneAndUpdate:(filter,update,options)=>({select:projection=>({lean:async()=>{
    fences.push({filter,update,options,projection});return filter._id===unavailable?null:{_id:filter._id};
  }})})};
  return {Credit,User,reads,fences};
}
test('no payment in either physical source permits review and fences both eligible accounts in the transaction',async()=>{
  const f=fixture();await guard(row,tx,f);
  assert.deepEqual(f.reads.map(r=>r.name),['credittransactions','credittranactions']);
  for(const read of f.reads){assert.deepEqual(read.filter,{session:row._id});assert.equal(read.options.session,tx);assert.deepEqual(read.options.projection,{_id:1});assert.equal(read.options.maxTimeMS,8000);}
  assert.equal(MAX_TIME_MS,8000);assert.deepEqual(f.fences.map(f=>f.filter._id),['learner','tutor']);
  for(const fence of f.fences){assert.equal(fence.filter.role,'student');assert.deepEqual(fence.filter.emailVerified,{$ne:false});assert.equal(fence.filter.suspendedAt,null);assert.equal(fence.options.session,tx);assert.deepEqual(fence.update,{$currentDate:{updatedAt:true}});}
});
for(const source of ['normal','legacy'])test(source+' payment or conflicting ledger evidence blocks without settlement or participant updates',async()=>{
  const f=fixture({[source]:{_id:'any-evidence'}});await assert.rejects(guard(row,tx,f),{status:409});assert.equal(f.fences.length,0);
});
test('new legacy payment appearing between proposal and consent blocks the next consent',async()=>{
  await guard(row,tx,fixture());await assert.rejects(guard(row,tx,fixture({legacy:{_id:'new-payment'}})),{status:409});
});
for(const unavailable of ['learner','tutor'])test('unavailable '+unavailable+' blocks proposal or consent',async()=>{
  await assert.rejects(guard(row,tx,fixture({unavailable})),{status:409});
});
test('failed source read fails closed without a participant update',async()=>{
  const f=fixture({error:new Error('synthetic timeout')});await assert.rejects(guard(row,tx,f),/synthetic timeout/);assert.equal(f.fences.length,0);
});
test('free, resolved, unknown economy/status, invalid price and self-participant cases cannot be closed as unpaid',async()=>{
  for(const patch of [{economyVersion:'free-v1'},{economyVersion:'unknown'},{economyVersion:''},{creditsSettledAt:new Date()},{legacyObligationResolvedAt:new Date()},{legacyObligationReview:'review'},{status:'resolved'},{status:'cancelled'},{creditAmount:0},{creditAmount:NaN},{creditAmount:'20'},{tutor:row.learner}]){
    const f=fixture();await assert.rejects(guard({...row,...patch},tx,f),{status:409});assert.equal(f.reads.length,0);
  }
});
test('outside transaction is rejected before any source reads',async()=>{
  const f=fixture();await assert.rejects(guard(row,{inTransaction:()=>false},f),/requires a transaction/);assert.equal(f.reads.length,0);
});
