const mongoose = require('mongoose');
const User = require('../models/User');
const Audit = require('../models/AuditLog');
const growth = require('../services/growthPresentation');

exports.updateVisibility = async (req, res) => {
  if (!require('../config/studentExperience').active()) return res.status(503).json({ success:false, message:'EXP recognition is not active yet.' });
  let tx;
  try {
    const data = await growth.summary(req.user.id);
    const earned = new Set(data.badges.filter(row => row.earned).map(row => row.id));
    if (req.body.badgeIds?.some(id => !earned.has(id))) return res.status(400).json({ success:false, message:'Only currently earned achievements can be shared.' });
    tx = await mongoose.startSession();
    let saved;
    await tx.withTransaction(async () => {
      const updates = Object.fromEntries(Object.entries(req.body).map(([key,value]) => ['growthVisibility.'+key,value]));
      const user = await User.findOneAndUpdate({_id:req.user.id,role:'student',suspendedAt:null,emailVerified:{$ne:false}},{$set:updates},{new:true,runValidators:true,session:tx}).select('+growthVisibility').lean();
      if (!user) throw Object.assign(new Error('Student account access changed.'), {status:403});
      saved = growth.visibility(user.growthVisibility);
      await Audit.create([{actor:req.user.id,actorRole:'system',action:'growth.visibility_updated',targetType:'User',targetId:String(req.user.id),summary:'Student updated optional progression visibility'}],{session:tx});
    });
    res.set('Cache-Control','private, no-store').json({success:true,data:saved});
  } catch (error) { res.status(error.status||503).json({success:false,message:error.status?error.message:'Visibility could not be saved. Retry; no progress was changed.'}); }
  finally { if(tx)await tx.endSession(); }
};
