const mongoose=require('mongoose');
const User=require('../models/User');
const Assessment=require('../models/Assessment');
const Attempt=require('../models/AssessmentAttempt');
// The User fence serializes same-account attempts; no credit claim is mutated.
async function submit({owner,assessmentId,answers,practice}) {
  const tx=await mongoose.startSession();let result;
  try { await tx.withTransaction(async()=>{
    const user=await User.findOneAndUpdate({_id:owner,role:'student',suspendedAt:null,emailVerified:{$ne:false}},{$currentDate:{updatedAt:true}},{session:tx,timestamps:false,new:true}).select('+rewardedAssessments').lean();
    if(!user)throw Object.assign(new Error('An eligible Student is required.'),{status:403});
    const row=await Assessment.findOneAndUpdate({_id:assessmentId,status:'published'},{$currentDate:{updatedAt:true}},{session:tx,timestamps:false,new:true}).lean();
    if(!row)throw Object.assign(new Error('Assessment not available.'),{status:404});
    if(!Array.isArray(answers)||answers.length!==row.questions.length||answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=row.questions[i].options.length))throw Object.assign(new Error('Submit one valid option for each question.'),{status:400});
    const correct=answers.filter((a,i)=>a===row.questions[i].correctIndex).length;
    const previous=await Attempt.exists({student:owner,assessment:row._id,mode:{$ne:'practice'},passed:true}).session(tx);
    const historical=(user.rewardedAssessments||[]).some(id=>String(id)===String(row._id));
    [result]=await Attempt.create([{student:owner,assessment:row._id,mode:practice||previous||historical?'practice':'official',progressionVersion:'student-free-exp-1',answers,score:Math.round(correct*100/answers.length),passed:correct*100>=row.passingScore*answers.length,rewardIssued:false,submittedAt:new Date()}],{session:tx});
  });return result; } finally {await tx.endSession();}
}
module.exports={submit};
