const mongoose=require('mongoose');
const Session=require('../models/Session');
const Award=require('../models/ExpAward');
const Review=require('../models/LegacyCreditReview');
const User=require('../models/User');
const Credit=require('../models/CreditTransaction');
const {assertLegacyReviewable}=require('../services/legacyCreditReviewGuard');
const Audit=require('../models/AuditLog');
const {recordAudit,ACTIONS}=require('../services/auditService');
const policy=require('../config/studentExperience');
const releaseSafety=require('../config/studentReleaseSafety');
const same=(a,b)=>String(a?._id||a)===String(b?._id||b);
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const reason=text=>{if(typeof text!=='string'||text.trim().length<10||text.length>500||/[\p{Cc}\p{Cf}]/u.test(text))fail('Enter an audit reason of 10 to 500 characters.',400);return text.trim();};
const wrap=fn=>async(req,res)=>{try{if(!policy.active())fail('This cutover is not activated.',503);res.set('Cache-Control','private, no-store').json({success:true,data:await fn(req)});}catch(error){res.status(error.status||503).json({success:false,message:error.status?error.message:'Review is temporarily unavailable. No credit records were changed.'});}};
const legacyMutation=fn=>wrap(req=>{
  if(!releaseSafety.legacyCaseWritesAllowed())fail('This historical case remains frozen. A separately authorized case review is required before any proposal or disposition.',423);
  return fn(req);
});
async function transact(req,sessionId,write){
  const tx=await mongoose.startSession();let output;
  try{await tx.withTransaction(async()=>{
    const actor=await User.findOneAndUpdate({_id:req.user.id,role:req.user.role,suspendedAt:null,emailVerified:{$ne:false}},{$currentDate:{updatedAt:true}},{session:tx,timestamps:false,new:true}).lean();
    if(!actor)fail('Account access changed.',403);
    const source=await Session.findOneAndUpdate({_id:sessionId},{$inc:{reviewVersion:1}},{session:tx,timestamps:false,new:true}).select('+expReport').lean();
    if(!source)fail('Session unavailable.',404);
    output=await write(tx,source,actor);
  });return output;}finally{await tx.endSession();}
}
exports.report=wrap(req=>transact(req,req.params.id,async(tx,row)=>{
  if(!same(row.learner,req.user.id)&&!same(row.tutor,req.user.id))fail('Only a participant can report this contribution.',403);
  if(row.economyVersion!=='free-v1'||row.status!=='completed'||!row.completedAt||Date.now()>=+row.completedAt+48*3600000)fail('The 48-hour contribution reporting window is closed.');
  if(row.expReport?.status==='open')return {reported:true};
  if(row.expReport)fail('This report was already reviewed.');
  const note=reason(req.body.reason);
  await Session.updateOne({_id:row._id},{$set:{expReport:{reporter:req.user.id,reason:note,reportedAt:new Date(),status:'open'}}},{session:tx});
  await Audit.create([{actorRole:'system',actor:req.user.id,action:'exp.participant_reported',targetType:'Session',targetId:String(row._id),summary:'Authenticated participant opened an EXP contribution report'}],{session:tx});
  return {reported:true};
}));
exports.reports=wrap(async()=>Session.find({'expReport.status':'open'}).select('_id subject learner tutor completedAt +expReport').sort({completedAt:1}).limit(100).lean());
exports.decideReport=wrap(req=>transact(req,req.params.id,async(tx,row)=>{
  if(same(row.tutor,req.user.id)||same(row.learner,req.user.id))fail('An independent staff reviewer is required.',403);
  if(row.expReport?.status!=='open')fail('This report is no longer open.');
  if(!['dismissed','upheld'].includes(req.body.outcome))fail('Choose dismiss or uphold.',400);
  const note=reason(req.body.reason),now=new Date();
  await Session.updateOne({_id:row._id},{$set:{'expReport.status':req.body.outcome,'expReport.resolvedBy':req.user.id,'expReport.resolvedAt':now,'expReport.resolutionReason':note}},{session:tx});
  if(req.body.outcome==='upheld')await Award.updateOne({sourceId:row._id,status:'pending'},{$set:{status:'held',holdReason:note,holdActor:req.user.id}},{session:tx});
  await recordAudit({actor:req.user,action:ACTIONS.expReportReviewed,targetType:'Session',targetId:row._id,summary:'EXP contribution report reviewed',metadata:{reason:note,resolution:req.body.outcome},session:tx});
  return {status:req.body.outcome};
}));
exports.legacyList=wrap(async()=>{
  const rows=await Session.find({economyVersion:{$ne:'free-v1'},creditsSettledAt:null,legacyObligationResolvedAt:null,status:{$in:['pending','accepted','scheduled','in_progress','awaiting_validation','no_show','disputed','completed']}}).select('_id subject learner tutor creditAmount status').sort({_id:1}).limit(100).lean();
  const payments=await require('../models/CreditTransaction').find({session:{$in:rows.map(r=>r._id)}}).lean();
  const proposals=await Review.find({session:{$in:rows.map(row=>row._id)}}).select('session reason state version learnerConsentAt tutorConsentAt').lean();
  return rows.filter(row=>require('../utils/sessionLifecycleCompatibility').classifyLegacySession(row,payments.filter(p=>same(p.session,row._id))).settlementState!=='settled').map(row=>({...row,caseWritesAllowed:false,review:proposals.find(proposal=>same(proposal.session,row._id))||null}));
});
exports.legacyGet=wrap(async req=>{
  const row=await Session.findById(req.params.id).lean();if(!row)fail('Session unavailable.',404);
  if(!['admin','moderator'].includes(req.user.role)&&!same(row.learner,req.user.id)&&!same(row.tutor,req.user.id))fail('Not authorized.',403);
  const payments=await require('../models/CreditTransaction').find({session:row._id}).lean();
  const state=require('../utils/sessionLifecycleCompatibility').classifyLegacySession(row,payments);
  return {frozen:state.settlementState!=='settled'&&row.economyVersion!=='free-v1'&&!row.creditsSettledAt&&!row.legacyObligationResolvedAt,caseWritesAllowed:false,restrictions:{creditTransfer:false,automaticSettlement:false,noTransferDisposition:false},review:await Review.findOne({session:row._id}).lean()};
});
exports.proposeLegacy=legacyMutation(req=>transact(req,req.params.id,async(tx,row)=>{
  if(row.economyVersion==='free-v1'||row.creditsSettledAt||row.legacyObligationResolvedAt)fail('Only unresolved legacy obligations can be reviewed.');
  if(same(row.tutor,req.user.id)||same(row.learner,req.user.id))fail('An independent staff reviewer is required.',403);
  await assertLegacyReviewable(row,tx,{Credit,User});
  const indexes=await Review.collection.indexes();if(!indexes.some(i=>i.name==='uniq_legacy_credit_review_session'&&i.unique===true&&JSON.stringify(i.key)==='{"session":1}'&&!i.sparse&&!i.partialFilterExpression))fail('Legacy review uniqueness index requires verification.',503);
  const existing=await Review.findOne({session:row._id}).session(tx).lean();
  if(existing)fail('A proposal already exists. It remains frozen unless both participants explicitly consent.');
  const note=reason(req.body.reason);
  const [review]=await Review.create([{session:row._id,proposedBy:req.user.id,reason:note,version:1,state:'proposed',createdAt:new Date()}],{session:tx});
  await recordAudit({actor:req.user,action:ACTIONS.legacyProposal,targetType:'LegacyCreditReview',targetId:review._id,summary:'Proposed explicit closure without credit transfer; both participant consents required',metadata:{reason:note},session:tx});
  return review;
}));
exports.consentLegacy=legacyMutation(req=>transact(req,req.params.id,async(tx,row)=>{
  const learner=same(row.learner,req.user.id),tutor=same(row.tutor,req.user.id);
  if(!learner&&!tutor)fail('Only the actual participants can consent.',403);
  await assertLegacyReviewable(row,tx,{Credit,User});
  const review=await Review.findOne({session:row._id,state:'proposed'}).session(tx);
  if(!review||review.version!==req.body.version||req.body.agree!==true)fail('Review the current proposal and explicitly agree.');
  const field=learner?'learnerConsentAt':'tutorConsentAt';
  if(review[field])return review;
  review[field]=new Date();review.version++;
  if(review.learnerConsentAt&&review.tutorConsentAt){review.state='closed';review.closedAt=new Date();await Session.updateOne({_id:row._id},{$set:{legacyObligationResolvedAt:review.closedAt,legacyObligationReview:review._id}},{session:tx});}
  await review.save({session:tx});
  await Audit.create([{actorRole:'system',actor:req.user.id,action:'credit.legacy_participant_consented',targetType:'LegacyCreditReview',targetId:String(review._id),summary:review.state==='closed'?'Both participants explicitly closed legacy obligation without any transfer':'Participant explicitly consented to proposed no-transfer closure'}],{session:tx});
  return review;
}));

exports.sessionStatus=wrap(async req=>{
 const row=await Session.findById(req.params.id).select('+expReport').lean();
 if(!row||!same(row.learner,req.user.id)&&!same(row.tutor,req.user.id))fail('Session unavailable.',404);
 return {reportStatus:row.expReport?.status||null,canReport:row.economyVersion==='free-v1'&&row.status==='completed'&&Boolean(row.completedAt)&&Date.now()<+row.completedAt+48*3600000&&!row.expReport,reviewWindowClosesAt:row.completedAt?new Date(+row.completedAt+48*3600000):null};
});
