const router=require('express').Router();
const {authenticateToken,requireRole}=require('../middleware/authMiddleware');
const {validateQuery}=require('../middleware/validation');
router.use(authenticateToken,validateQuery());
const {validateBody,validateParams,schemas}=require('../middleware/validation');
const {staffActionLimiter,sessionActionLimiter}=require('../middleware/writeLimiters');
const reviews=require('../controllers/growthReviewController');
const {InvalidInput}=require('../middleware/validation');
router.patch('/visibility',requireRole('student'),sessionActionLimiter,validateBody({
  showLevel:value=>{if(value===undefined)return undefined;if(typeof value!=='boolean')throw new InvalidInput('Choose level visibility.');return value;},
  showRank:value=>{if(value===undefined)return undefined;if(typeof value!=='boolean')throw new InvalidInput('Choose rank visibility.');return value;},
  badgeIds:value=>{if(value===undefined)return undefined;if(!Array.isArray(value)||value.length>5||value.some(id=>typeof id!=='string'||!['first-step','first-mentor','helping-hand','consistent-mentor','academic-explorer'].includes(id))||new Set(value).size!==value.length)throw new InvalidInput('Choose distinct earned achievements.');return value;},
},{requireOne:true}),require('../controllers/growthVisibilityController').updateVisibility);
router.get('/session-status/:id',requireRole('student'),validateParams(schemas.sessionId),reviews.sessionStatus);
router.get('/reports',requireRole('moderator','admin'),reviews.reports);
router.post('/reports/:id',requireRole('moderator','admin'),staffActionLimiter,validateParams(schemas.sessionId),validateBody({outcome:v=>{if(!['dismissed','upheld'].includes(v))throw new (require('../middleware/validation').InvalidInput)('Choose dismiss or uphold.');return v;},reason:schemas.dispute.reason}),reviews.decideReport);
router.get('/legacy-reviews',requireRole('moderator','admin'),reviews.legacyList);
router.get('/legacy-reviews/:id',validateParams(schemas.sessionId),reviews.legacyGet);
router.post('/legacy-reviews/:id',requireRole('moderator','admin'),staffActionLimiter,validateParams(schemas.sessionId),validateBody(schemas.dispute),reviews.proposeLegacy);
router.post('/legacy-reviews/:id/consent',requireRole('student'),sessionActionLimiter,validateParams(schemas.sessionId),validateBody({agree:v=>{if(v!==true)throw new (require('../middleware/validation').InvalidInput)('Explicit agreement required.');return v;},version:v=>{if(!Number.isSafeInteger(v)||v<1)throw new (require('../middleware/validation').InvalidInput)('Refresh the proposal.');return v;}}),reviews.consentLegacy);
router.post('/reversals/:id',requireRole('admin'),staffActionLimiter,validateParams(schemas.sessionId),validateBody(schemas.dispute),async(req,res)=>{try{const entry=await require('../services/expAwardService').reverseAward(req.params.id,req.user.id,req.body.reason);res.json({success:true,data:{id:String(entry._id),delta:entry.delta}});}catch(e){res.status(e.status||503).json({success:false,message:e.status?e.message:'Correction unavailable.'});}});
router.get('/',requireRole('student'),async(req,res)=>{try{res.set('Cache-Control','private, no-store').json({success:true,data:await require('../services/growthPresentation').summary(req.user.id)});}catch{res.status(503).json({success:false,message:'Growth is temporarily unavailable. Retry later.'});}});
module.exports=router;
