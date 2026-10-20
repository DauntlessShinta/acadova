const {randomUUID}=require('node:crypto');
const Consent=require('../models/AcadiConsent');
const Quota=require('../models/AcadiQuota');
const User=require('../models/User');
const Audit=require('../models/AuditLog');
const {acadiConfig,acadiError}=require('../config/acadi');
const {contextFor}=require('./acadiContext');
const {createGeminiAcadiService}=require('./geminiAcadiService');
const uuid=value=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);
const privateText=value=>/[\w.+-]+@[\w.-]+\.[a-z]{2,}|AIza[a-z\d_-]{12,}|eyJ[a-z\d_-]{20,}|(?:password|api.?key|jwt.?secret)\s*[:=]|meet\.google\.com\/|zoom\.us\/(?:j|my)\/|teams\.(?:microsoft|live)\.com\//i.test(value);
function createAcadiConversation({config=acadiConfig(),provider=createGeminiAcadiService(),resolveContext=contextFor}={}) {
  const conversations=new Map(),pending=new Map();
  const key=(owner,id)=>String(owner)+':'+id;
  const cleanup=()=>{for(const [id,row] of conversations)if(row.expiresAt<Date.now()&&!pending.has(row.owner))conversations.delete(id);};
  // Access expires exactly at expiresAt; idle processes also purge stale RAM.
  const expiryTimer=setInterval(cleanup,60000);expiryTimer.unref();
  async function indexes() {
    try {
      const [consent,quota]=await Promise.all([Consent.collection.indexes(),Quota.collection.indexes()]);
      const exact=(rows,name,key)=>rows.some(row=>row.name===name&&row.unique===true&&!row.sparse&&!row.partialFilterExpression&&JSON.stringify(row.key)===JSON.stringify(key));
      if(!exact(consent,'uniq_acadi_consent_owner',{owner:1})||!exact(quota,'uniq_acadi_owner_day',{owner:1,day:1}))throw new Error();
    }catch{throw acadiError('Chat consent and quota indexes need operator verification. Local guidance remains available.',503,'ACADI_INDEXES_REQUIRED');}
  }
  function configured() {
    if(!config.enabled)throw acadiError('Gemini conversation is disabled. Local guidance remains available.',503,'ACADI_DISABLED');
    if(config.syntheticOnly&&!require('../config/studentExperience').active())throw acadiError('Synthetic chat requires the verified isolated database.',503,'ACADI_ISOLATED_ONLY');
  }
  async function consent(owner) { return await Consent.findOne({owner}).lean()||{general:false,context:false,version:0}; }
  function clear(owner) {
    pending.get(String(owner))?.abort.abort();
    for(const [id,row] of conversations)if(row.owner===String(owner)){row.epoch++;conversations.delete(id);}
  }
  async function status(owner) {
    cleanup();const row=await consent(owner);
    return {enabled:config.enabled,provider:config.syntheticOnly?'synthetic':'gemini',contextEnabled:config.contextEnabled,consent:{general:row.general===true&&row.policyVersion===config.policyVersion,context:row.context===true&&row.policyVersion===config.policyVersion,version:row.version},dailyLimit:config.dailyLimit,historyMinutes:15,policyVersion:config.policyVersion};
  }
  async function setConsent(owner,body) {
    if(!body||Object.keys(body).some(k=>!['general','context'].includes(k))||typeof body.general!=='boolean'||typeof body.context!=='boolean'||body.context&&!body.general)throw acadiError('Choose explicit general and optional context permissions.');
    if(body.context&&!config.contextEnabled)throw acadiError('Personal-context processing is not approved for this deployment.',403,'ACADI_CONTEXT_DISABLED');
    await indexes();clear(owner);
    const tx=await require('mongoose').startSession();
    try{await tx.withTransaction(async()=>{
      await Consent.findOneAndUpdate({owner},{$set:{...body,policyVersion:config.policyVersion,updatedAt:new Date()},$inc:{version:1}},{session:tx,upsert:true,new:true});
      await Audit.create([{actor:owner,actorRole:'system',action:'acadi.consent_changed',targetType:'AcadiConsent',targetId:String(owner),summary:'Authenticated Student updated Acadi consent',metadata:{general:body.general,context:body.context,policyVersion:config.policyVersion}}],{session:tx});
    });return status(owner);}finally{await tx.endSession();}
  }
  async function reserve(owner) {
    const leaseId=randomUUID();
    const now=new Date(),day=now.toISOString().slice(0,10);
    try{await Quota.updateOne({owner,day},{$setOnInsert:{used:0,leaseUntil:new Date(0),expiresAt:new Date(now.getTime()+2*86400000)}},{upsert:true});}catch(error){if(error.code!==11000)throw error;}
    const row=await Quota.findOneAndUpdate({owner,day,used:{$lt:config.dailyLimit},leaseUntil:{$lte:now}},{$inc:{used:1},$set:{leaseId,leaseUntil:new Date(now.getTime()+config.timeoutMs+5000)}},{new:true}).lean();
    if(!row)throw acadiError('Daily chat allowance reached or a reply is already in progress. Retry later.',429,'ACADI_QUOTA');
    return {day,leaseId,remaining:Math.max(0,config.dailyLimit-row.used)};
  }
  async function send(owner,body) {
    configured();await indexes();cleanup();
    if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['requestId','conversationId','message','mode','subjectId','moduleId'].includes(k))||!uuid(body.requestId)||body.conversationId&&!uuid(body.conversationId)||!['general','context'].includes(body.mode)||typeof body.message!=='string'||!body.message.trim()||body.message.length>1000||/[\p{Cc}\p{Cf}]/u.test(body.message.replace(/[\r\n\t]/g,'')))throw acadiError('Use a valid chat request and a question of 1 to 1000 characters.');
    if(privateText(body.message))throw acadiError('Remove personal details, meeting invitations and credentials before sending.');
    if(body.mode==='general'&&(body.subjectId||body.moduleId))throw acadiError('General assistance does not accept account context.');
    const permission=await consent(owner);
    if(!permission.general||permission.policyVersion!==config.policyVersion||body.mode==='context'&&(!permission.context||!config.contextEnabled))throw acadiError('Explicit current consent is required for this chat mode.',403,'ACADI_CONSENT_REQUIRED');
    const binding=JSON.stringify([body.mode,body.subjectId||null,body.moduleId||null]);
    let row=body.conversationId?conversations.get(key(owner,body.conversationId)):null;
    if(body.conversationId&&!row)throw acadiError('This conversation expired or is unavailable. Clear chat to begin again.',404,'ACADI_CONVERSATION_UNAVAILABLE');
    if(row&&(row.binding!==binding||row.consentVersion!==permission.version))throw acadiError('Clear chat before changing context or consent.',409,'ACADI_CONTEXT_CHANGED');
    if(row?.receipts.has(body.requestId)){if(body.mode==='context'){const currentFacts=await resolveContext(owner,body);if(JSON.stringify(currentFacts)!==JSON.stringify(row.receipts.get(body.requestId).facts))throw acadiError('Saved context changed. Clear chat before continuing.',409,'ACADI_CONTEXT_CHANGED');}return row.receipts.get(body.requestId);}
    if(pending.has(String(owner)))throw acadiError('A reply is already in progress.',409,'ACADI_BUSY');
    if(!row){if(conversations.size>=200)throw acadiError('Chat is busy. Try again later.',503,'ACADI_BUSY');row={id:randomUUID(),owner:String(owner),binding,consentVersion:permission.version,history:[],receipts:new Map(),expiresAt:Date.now()+900000,epoch:0};conversations.set(key(owner,row.id),row);}
    const epoch=row.epoch,abort=new AbortController();pending.set(String(owner),{id:body.requestId,abort});
    let lease;
    try {
      const facts=body.mode==='context'?await resolveContext(owner,body):[];
      if(privateText(JSON.stringify(facts)))throw acadiError('Selected context contains details that cannot be sent. Use general assistance.');
      const unknownDate=/\bwhen\b.*\b(?:exam|examination)\b|\b(?:exam|examination)\b.*\bdate\b/i.test(body.message);
      let text,source=config.syntheticOnly?'synthetic':'gemini';
      if(unknownDate){const exam=facts.find(f=>f.kind==='student_entered_exam');text=exam?`Your saved student-entered exam plan is ${exam.title}, ${new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:exam.timezone||'UTC'}).format(new Date(exam.date))} (${exam.timezone||'UTC'}). This is not a verified institutional schedule.`:'No upcoming exam date is available in the selected saved context. Check My Subjects or add your own study-plan date; I cannot infer an official exam schedule.';source='saved-facts';}
      else{
        lease=await reserve(owner);
        const history=row.history.slice(-10);
        if(history.reduce((n,r)=>n+r.text.length,body.message.length)>18000)throw acadiError('Clear this conversation before continuing.',400,'ACADI_INPUT_LIMIT');
        text=await provider.generate({history,message:body.message.trim(),facts,config,signal:abort.signal});
      }
      const current=await consent(owner);
      const eligible=await User.exists({_id:owner,role:'student',emailVerified:{$ne:false},suspendedAt:null});
      if(abort.signal.aborted||epoch!==row.epoch||!conversations.has(key(owner,row.id))||!eligible||current.version!==permission.version||!current.general)throw acadiError('Reply cancelled after context or account access changed.',409,'ACADI_CANCELLED');
      if(typeof text!=='string'||!text.trim()||text.length>6000)throw acadiError('Acadi returned an incomplete reply.',502,'ACADI_BAD_OUTPUT');
      row.history=[...row.history,{role:'user',text:body.message.trim()},{role:'assistant',text}].slice(-12);row.expiresAt=Date.now()+900000;
      const result={conversationId:row.id,requestId:body.requestId,text,source,facts:body.mode==='context'?facts:[],remaining:lease?.remaining??null};row.receipts.set(body.requestId,result);if(row.receipts.size>6)row.receipts.delete(row.receipts.keys().next().value);
      return result;
    }catch(error){if(!row.history.length&&!row.receipts.size)conversations.delete(key(owner,row.id));throw error;}finally{if(pending.get(String(owner))?.id===body.requestId)pending.delete(String(owner));if(lease)await Quota.updateOne({owner,day:lease.day,leaseId:lease.leaseId},{$set:{leaseUntil:new Date(0)},$unset:{leaseId:1}});}
  }
  const cancel=(owner,requestId)=>{const item=pending.get(String(owner));if(item?.id===requestId)item.abort.abort();};
  return {status,setConsent,send,clear,cancel};
}
module.exports={createAcadiConversation,privateText};
