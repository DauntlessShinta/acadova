const policy=require('../config/studentExperience');
const Attempt=require('../models/AssessmentAttempt');
const Session=require('../models/Session');
const Award=require('../models/ExpAward');
const engine=require('./expAwardService');
const running=new Set();
const lastWarning=new Map();
function warn(stage,error){const code=/^EXP_[A-Z_]+$/.test(error?.code||'')?error.code:'INFRASTRUCTURE_UNAVAILABLE';const key=stage+':'+code;if(Date.now()-(lastWarning.get(key)||0)>60000){lastWarning.set(key,Date.now());console.warn('growth.replay_deferred',{stage,code});}}
const unreported={'expReport.status':{$nin:['open','upheld']}};
async function dueAwards(owner) {
  return Award.aggregate([{$match:{...(owner?{owner:new (require('mongoose').Types.ObjectId)(String(owner))}:{}),status:'pending',kind:'verified_tutoring',readyAt:{$lte:new Date()}}},{$sort:{readyAt:1}},{$lookup:{from:Session.collection.name,localField:'sourceId',foreignField:'_id',as:'source'}},{$match:{'source.expReport.status':{$nin:['open','upheld']}}},{$limit:20}]);
}
const mark=async(Model,row,eventKey,write)=>{
  try {
    if(!await Award.exists({owner:row.student||row.tutor,eventKey}))await write();
    await Model.updateOne({_id:row._id},{$set:{expProcessedAt:new Date(),expOutcome:'recorded'}});
  }catch(error){
    warn('source',error);
    if(['EXP_AWARD_CAP','EXP_TUTORING_CAP','EXP_STUDENT_INELIGIBLE','EXP_ASSESSMENT_EVIDENCE','EXP_TUTORING_EVIDENCE','EXP_HISTORICAL_EVENT'].includes(error.code))await Model.updateOne({_id:row._id},{$set:{expProcessedAt:new Date(),expOutcome:'ineligible'}});
  }
};
// Source records are durable retry evidence. Only newly marked events are read.
// No engine transaction is invoked inside an uncommitted lifecycle transaction.
async function replayOwner(owner) {
  if(require('../config/studentReleaseSafety').recoveryWriteHold())return;
  if(!policy.active()||running.has(String(owner)))return;
  running.add(String(owner));
  try {
    const attempts=await Attempt.find({student:owner,expProcessedAt:null,progressionVersion:'student-free-exp-1',mode:'official',passed:true}).sort({submittedAt:1}).limit(20).lean();
    const sessions=await Session.find({tutor:owner,expProcessedAt:null,economyVersion:'free-v1',status:'completed',...unreported}).sort({completedAt:1}).limit(20).lean();
    for(const row of attempts) {
      await mark(Attempt,row,'assessment:'+row.assessment,()=>engine.awardAssessment(String(row._id)));
    }
    for(const row of sessions) {
      await mark(Session,row,'session:'+row._id,()=>engine.queueTutoring(String(row._id)));
    }
    const due=await dueAwards(owner);
    for(const row of due)try{await engine.finalizeTutoring(String(row._id));}catch(error){warn('finalize',error);/* Holds, changed evidence and caps are not waived. */}
  } catch(error) {warn('owner',error);/* A committed learning event remains successful; durable source evidence retries. */}
  finally{running.delete(String(owner));}
}
async function replayBatch() {
  if(require('../config/studentReleaseSafety').recoveryWriteHold())return;
  if(!policy.active())return;
  const rows=await Attempt.find({expProcessedAt:null,progressionVersion:'student-free-exp-1',mode:'official',passed:true}).sort({submittedAt:1}).limit(20).select('student').lean();
  const sessions=await Session.find({expProcessedAt:null,economyVersion:'free-v1',status:'completed',...unreported}).sort({completedAt:1}).limit(20).select('tutor').lean();
  const pending=await dueAwards();
  for(const owner of new Set([...rows.map(r=>String(r.student)),...sessions.map(r=>String(r.tutor)),...pending.map(r=>String(r.owner))]))await replayOwner(owner);
}
module.exports={replayOwner,replayBatch};
