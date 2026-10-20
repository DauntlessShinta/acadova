const mongoose=require('mongoose');
const schema=new mongoose.Schema({session:{type:mongoose.Schema.Types.ObjectId,ref:'Session',required:true,immutable:true},proposedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},reason:{type:String,required:true,minlength:10,maxlength:500},version:{type:Number,required:true,min:1},state:{type:String,enum:['proposed','closed'],required:true},learnerConsentAt:Date,tutorConsentAt:Date,createdAt:{type:Date,required:true},closedAt:Date},{autoIndex:false,autoCreate:false,versionKey:false,strict:'throw'});
schema.index({session:1},{unique:true,name:'uniq_legacy_credit_review_session'});
module.exports=mongoose.model('LegacyCreditReview',schema);
