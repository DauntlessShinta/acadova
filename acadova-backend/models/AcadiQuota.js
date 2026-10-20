const mongoose=require('mongoose');
const schema=new mongoose.Schema({owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},day:{type:String,required:true},used:{type:Number,default:0,min:0},leaseUntil:{type:Date,default:()=>new Date(0)},leaseId:String,expiresAt:{type:Date,required:true}},{autoIndex:false,autoCreate:false,versionKey:false,strict:'throw'});
schema.index({owner:1,day:1},{unique:true,name:'uniq_acadi_owner_day'});
schema.index({expiresAt:1},{expireAfterSeconds:0,name:'acadi_quota_expiry'});
module.exports=mongoose.model('AcadiQuota',schema);
