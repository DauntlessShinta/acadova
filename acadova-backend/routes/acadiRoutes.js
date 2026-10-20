const express=require('express');
const {authenticateToken,requireRole}=require('../middleware/authMiddleware');
const {validateQuery}=require('../middleware/validation');
const {createRateLimiter}=require('../middleware/rateLimiter');
const {createAcadiConversation}=require('../services/acadiConversation');
function createAcadiRouter(options) {
  const router=express.Router(),service=createAcadiConversation(options);
  router.use(authenticateToken,requireRole('student'),validateQuery(),(req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
  const limit=createRateLimiter({windowMs:60000,max:8,keyForRequest:req=>req.user.id,message:'Too many chat requests. Wait before retrying.'});
  const privacyLimit=createRateLimiter({windowMs:60000,max:60,keyForRequest:req=>req.user.id,message:'Too many privacy changes. Wait briefly before retrying.'});
  const run=handler=>async(req,res)=>{try{const data=await handler(req,res);if(!res.headersSent&&!res.destroyed)res.json({success:true,data});}catch(error){if(!res.headersSent&&!res.destroyed)res.status(error.status||503).json({success:false,code:error.code||'ACADI_UNAVAILABLE',message:error.status?error.message:'Acadi is unavailable. Local guidance remains available.'});}};
  router.get('/status',run(req=>service.status(req.user.id)));
  router.put('/consent',privacyLimit,run(req=>service.setConsent(req.user.id,req.body)));
  router.post('/messages',limit,run(async(req,res)=>{const close=()=>{if(!res.writableEnded)service.cancel(req.user.id,req.body.requestId);};res.once('close',close);try{return await service.send(req.user.id,req.body);}finally{res.removeListener('close',close);}}));
  router.post('/cancel',privacyLimit,run(req=>{service.cancel(req.user.id,req.body?.requestId);return {cancelled:true};}));
  router.delete('/conversation',privacyLimit,run(req=>{service.clear(req.user.id);return {cleared:true};}));
  return router;
}
module.exports=createAcadiRouter();module.exports.createAcadiRouter=createAcadiRouter;
