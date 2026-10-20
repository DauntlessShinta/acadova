const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),jwt=require('jsonwebtoken'),{randomBytes}=require('node:crypto');
const mongoose=require('mongoose'),User=require('../models/User'),{aiStudyConfig}=require('../config/aiStudy');
test('synthetic multipart stays gated without an isolated local database; default limits unchanged',{timeout:30000},async t=>{
 const original=User.findById,secret=process.env.JWT_SECRET;process.env.JWT_SECRET=randomBytes(32).toString('hex');
 const id='507f1f77bcf86cd799439011';User.findById=()=>({select:()=>({lean:async()=>({_id:id,name:'Synthetic upload QA',email:'qa@example.test',role:'student',emailVerified:true,credits:100})})});
 let extraction=0,provider=0;const config=aiStudyConfig({NODE_ENV:'test',AI_STUDY_ENABLED:'true',AI_STUDY_LOCAL_QA:'true',GEMINI_API_KEY:'synthetic-offline-only'});
 assert.deepEqual([config.maxBytes,config.maxPages,config.maxSlides],[5242880,20,30]);
 const app=express();app.use('/api/ai-study',require('../routes/aiStudyRoutes').createAiStudyRouter({configFor:()=>config,extract:async()=>{extraction++;throw Error('Unexpected extraction');},provider:{generate:async()=>{provider++;throw Error('Unexpected provider');}}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));User.findById=original;if(secret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=secret;});
 const token=jwt.sign({id},process.env.JWT_SECRET),url=`http://127.0.0.1:${server.address().port}/api/ai-study/generate`;
 for(const size of [5242881,8*1048576,10*1048576]){const data=Buffer.alloc(size);data.write('%PDF-1.7');const form=new FormData();form.append('document',new Blob([data],{type:'application/pdf'}),'synthetic.pdf');form.append('type','both');form.append('mode','strict_source');form.append('syntheticConsent','true');const response=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+token},body:form});assert.equal(response.status,503);assert.match((await response.json()).message,/isolated local MongoDB/);}
 assert.equal(extraction,0);assert.equal(provider,0);assert.equal(mongoose.connection.readyState,0,'No database connection or quota/persistence operation');
});
