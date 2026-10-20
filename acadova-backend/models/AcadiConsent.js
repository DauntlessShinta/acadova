const mongoose=require('mongoose');
const schema=new mongoose.Schema({owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},general:{type:Boolean,default:false},context:{type:Boolean,default:false},version:{type:Number,default:0,min:0},policyVersion:{type:String,required:true},updatedAt:{type:Date,required:true}},{autoIndex:false,autoCreate:false,versionKey:false,strict:'throw'});
schema.index({owner:1},{unique:true,name:'uniq_acadi_consent_owner'});
module.exports=mongoose.model('AcadiConsent',schema);
