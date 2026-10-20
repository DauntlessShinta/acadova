const mongoose=require('mongoose');
const Ledger=require('../models/ExpLedgerEntry');
const Award=require('../models/ExpAward');
const {growthStatus}=require('./growthFoundation');
const {levels}=require('../config/growthProgression');
const {aggregate}=require('../utils/analyticsWindow');
function levelFor(total) {
  if(!Number.isSafeInteger(total)||total<0)throw new Error('Invalid EXP evidence.');
  let index=0;while(index+1<levels.length&&total>=levels[index+1][0])index++;
  const next=levels[index+1];return {level:index+1,title:levels[index][1],floor:levels[index][0],next:next?{level:index+2,title:next[1],threshold:next[0]}:null,needed:next?next[0]-total:0,progress:next?(total-levels[index][0])/(next[0]-levels[index][0]):1};
}
function badgesFor(facts) {
  const rules=[['first-step','First Step','Pass one qualifying official assessment.',facts.assessments>=1,facts.everAssessments>=1],['first-mentor','First Mentor','Complete one confirmed eligible tutoring contribution.',facts.tutoring>=1,facts.everTutoring>=1],['helping-hand','Helping Hand','Help five unique learners in confirmed qualifying sessions.',facts.learners>=5,facts.everLearners>=5],['consistent-mentor','Consistent Mentor','Complete ten qualifying tutoring contributions.',facts.tutoring>=10,facts.everTutoring>=10],['academic-explorer','Academic Explorer','Pass three distinct approved official assessments.',facts.assessments>=3,facts.everAssessments>=3]];
  return rules.map(([id,title,condition,earned,ever])=>({id,title,condition,earned,revoked:ever&&!earned}));
}
async function summary(owner,{includeHistory=true}={}) {
  if(!require('../config/studentExperience').active())return growthStatus();
  const id=new mongoose.Types.ObjectId(owner);
  const [sum]=await aggregate(Ledger,[{$match:{owner:id}},{$group:{_id:null,total:{$sum:'$delta'}}}]);
  const totalExp=sum?.total||0;
  // Claims qualify only when backed by their exact immutable positive ledger row.
  const facts=await aggregate(Award,[{$match:{owner:id,status:{$in:['finalized','reversed']}}},{$lookup:{from:Ledger.collection.name,let:{award:'$_id',owner:'$owner',amount:'$amount',event:'$eventKey',source:'$sourceId',kind:'$kind'},pipeline:[{$match:{$expr:{$and:[{$eq:['$award','$$award']},{$eq:['$owner','$$owner']},{$eq:['$delta','$$amount']},{$eq:['$eventKey','$$event']},{$eq:['$sourceId','$$source']},{$eq:['$kind','$$kind']}]}}},{$limit:1}],as:'proof'}},{$match:{'proof.0':{$exists:true}}},{$group:{_id:'$status',assessments:{$sum:{$cond:[{$eq:['$kind','official_assessment']},1,0]}},tutoring:{$sum:{$cond:[{$eq:['$kind','verified_tutoring']},1,0]}},learners:{$addToSet:{$cond:[{$eq:['$kind','verified_tutoring']},'$learner',null]}}}}]);
  const confirmed=facts.find(f=>f._id==='finalized')||{};
  const distinct=rows=>new Set(rows.flatMap(r=>r.learners||[]).filter(Boolean).map(String)).size;
  const badgeFacts={assessments:confirmed.assessments||0,tutoring:confirmed.tutoring||0,learners:distinct([confirmed]),everAssessments:facts.reduce((n,r)=>n+r.assessments,0),everTutoring:facts.reduce((n,r)=>n+r.tutoring,0),everLearners:distinct(facts)};
  const events=includeHistory?await Ledger.find({owner:id}).sort({createdAt:-1,_id:-1}).limit(20).select('kind delta reason createdAt').maxTimeMS(8000).lean():[];
  const pending=includeHistory?await aggregate(Award,[{$match:{owner:id,status:{$in:['pending','held']}}},{$lookup:{from:'sessions',localField:'sourceId',foreignField:'_id',as:'source'}},{$project:{kind:1,amount:1,readyAt:1,status:{$cond:[{$in:['open',{$map:{input:'$source',as:'s',in:'$$s.expReport.status'}}]},'held','$status']}}},{$limit:20}]):[];
  const user=await require('../models/User').findById(id).select('_id role suspendedAt emailVerified +growthVisibility').lean();
  return {...require('../config/studentExperience').capabilities(),active:true,totalExp,rank:levelFor(totalExp),levels:levels.map(([threshold,title],index)=>({level:index+1,title,threshold})),visibility:visibility(user?.growthVisibility),badges:badgesFor(badgeFacts),events:events.map(r=>({id:String(r._id),kind:r.kind,delta:r.delta,reason:r.reason,createdAt:r.createdAt})),pending:pending.map(r=>({id:String(r._id),kind:r.kind,amount:r.amount,readyAt:r.readyAt,status:r.status})),message:'EXP is recognition, never a price, grade or institutional certification.'};
}
function visibility(value) { return {showLevel:value?.showLevel===true,showRank:value?.showRank===true,badgeIds:Array.isArray(value?.badgeIds)?value.badgeIds:[]}; }
async function publicGrowth(owner) {
  if(!require('../config/studentExperience').active())return undefined;
  const User=require('../models/User');
  const user=await User.findById(owner).select('_id role suspendedAt emailVerified +growthVisibility').lean();
  if(!user||user.role!=='student'||user.suspendedAt||user.emailVerified===false)return undefined;
  const allowed=visibility(user?.growthVisibility);
  if(!allowed.showLevel&&!allowed.showRank&&!allowed.badgeIds.length)return undefined;
  const data=await summary(owner,{includeHistory:false});
  // Recheck preference after the slower ledger reads; an opt-out wins.
  const latest=await User.findById(owner).select('_id role suspendedAt emailVerified +growthVisibility').lean();
  if(!latest||latest.role!=='student'||latest.suspendedAt||latest.emailVerified===false)return undefined;
  const current=visibility(latest.growthVisibility);
  const result={};
  if(current.showLevel)result.level=data.rank.level;
  if(current.showRank)result.rankTitle=data.rank.title;
  if(current.badgeIds.length)result.badges=data.badges.filter(b=>b.earned&&current.badgeIds.includes(b.id)).map(({id,title})=>({id,title}));
  return Object.keys(result).length?result:undefined;
}
module.exports={summary,levelFor,badgesFor,levels,visibility,publicGrowth};
