// First Student release: all historical case dispositions stay deferred.
// These constants are source-reviewed, never enabled by a client/environment.
// The separately bundled recovery variant changes ONLY RECOVERY_WRITE_HOLD.
const RECOVERY_WRITE_HOLD = true;
const legacyCaseWritesAllowed = () => false;
const recoveryWriteHold = () => RECOVERY_WRITE_HOLD;
function requestGuard(req,res,next) {
  if (!RECOVERY_WRITE_HOLD) return next();
  const method=req.method,path=(req.originalUrl||req.url||'').split('?')[0];
  const read=['GET','HEAD','OPTIONS'].includes(method);
  // Sign-in security state may update; this is a content/economy write hold,
  // not a claim of zero database writes. Existing auth protections still run.
  if (method==='POST' && path==='/api/auth/login') return next();
  if (read && (!path.startsWith('/api/auth/') || path==='/api/auth/me')) return next();
  res.set('Cache-Control','no-store');
  return res.status(503).json({success:false,code:'STUDENT_RELEASE_WRITE_HOLD',message:'Learning history remains available. Changes are temporarily paused for recovery.'});
}
module.exports={legacyCaseWritesAllowed,recoveryWriteHold,requestGuard};
