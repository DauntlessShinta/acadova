const Subject=require('../models/PersonalSubject');
const Module=require('../models/PersonalModule');
const Plan=require('../models/StudyPlanItem');
const {acadiError}=require('../config/acadi');
const id=value=>typeof value==='string'&&/^[a-f\d]{24}$/i.test(value);
const clean=value=>String(value||'').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu,' ').slice(0,120);
async function contextFor(owner,{subjectId,moduleId}={}) {
  if(subjectId&&!id(subjectId)||moduleId&&!id(moduleId))throw acadiError('Choose an authorized subject or module.');
  if(!subjectId&&!moduleId)return [];
  let module;
  if(moduleId){module=await Module.findOne({_id:moduleId,owner}).select('subjectId title status').lean();if(!module)throw acadiError('Module unavailable.',404);if(subjectId&&String(module.subjectId)!==subjectId)throw acadiError('Module unavailable.',404);subjectId=String(module.subjectId);}
  const subject=await Subject.findOne({_id:subjectId,owner,archived:false}).select('name').lean();if(!subject)throw acadiError('Subject unavailable.',404);
  const facts=[{kind:'saved_subject',value:clean(subject.name)}];
  if(module)facts.push({kind:'saved_module',value:clean(module.title)},{kind:'self_reported_status',value:module.status});
  const plans=await Plan.find({owner,subjectId,completed:false,dueAt:{$gte:new Date()},...(moduleId?{$or:[{moduleId},{moduleId:null}]}:{})}).sort({dueAt:1}).limit(3).select('kind title dueAt timezone').lean();
  for(const plan of plans)facts.push({kind:plan.kind==='exam'?'student_entered_exam':'student_entered_plan',title:clean(plan.title),date:new Date(plan.dueAt).toISOString(),timezone:clean(plan.timezone)});
  return facts;
}
module.exports={contextFor};
