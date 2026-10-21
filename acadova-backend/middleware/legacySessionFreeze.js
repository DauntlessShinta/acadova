const Session=require('../models/Session');
const {isValidObjectId}=require('./validation');
// An individual historical Session cannot be altered through Student actions.
// New free-v1 Sessions keep the normal lifecycle. No case is marked settled,
// repriced or forgiven; both historical ledgers remain read-only evidence.
module.exports=async(req,res,next)=>{
  if(!require('../config/studentExperience').active()||['GET','HEAD','OPTIONS'].includes(req.method))return next();
  const id=(req.path||'').split('/')[1];if(!isValidObjectId(id))return next();
  try{
    const row=await Session.findOne({_id:id,$or:[{learner:req.user.id},{tutor:req.user.id}]}).select('economyVersion').lean();
    // Existing controllers retain their 403/404 behavior for nonparticipants.
    if(row&&row.economyVersion!=='free-v1')return res.status(423).json({success:false,code:'LEGACY_SESSION_FROZEN',message:'This historical Session is retained under a case-specific change and settlement freeze. A separately authorized review is required.'});
    return next();
  }catch{return res.status(503).json({success:false,message:'Historical Session protection could not be verified. No action was performed.'});}
};
