const Ledger = require('../models/ExpLedgerEntry');
const Award = require('../models/ExpAward');
const User = require('../models/User');
const { aggregate, dateMatch } = require('../utils/analyticsWindow');
const { levels } = require('../config/growthProgression');

exports.getExpAnalytics = async (req, res) => {
  res.set('Cache-Control','private, no-store');
  if (!require('../config/studentExperience').active()) return res.json({success:true,data:{active:false,message:'EXP recognition is not active. Historical Credits remain unchanged.'}});
  try {
    const period = dateMatch(req,'createdAt');
    const [metrics, distribution, claims, integrity] = await Promise.all([
      aggregate(Ledger, [{$match:period},{$facet:{
        totals:[{$group:{_id:null,awarded:{$sum:{$cond:[{$gt:['$delta',0]},'$delta',0]}},corrections:{$sum:{$cond:[{$lt:['$delta',0]},'$delta',0]}},net:{$sum:'$delta'}}}],
        students:[{$group:{_id:'$owner',net:{$sum:'$delta'}}},{$match:{net:{$gt:0}}},{$lookup:{from:User.collection.name,localField:'_id',foreignField:'_id',pipeline:[{$project:{_id:1,role:1,suspendedAt:1,emailVerified:1}}],as:'student'}},{$match:{'student.role':'student','student.suspendedAt':null,'student.emailVerified':{$ne:false}}},{$count:'count'}],
        types:[{$match:{delta:{$gt:0}}},{$group:{_id:'$kind',exp:{$sum:'$delta'},awards:{$sum:1}}},{$sort:{_id:1}}],
        trend:[{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt',timezone:'UTC'}},awarded:{$sum:{$cond:[{$gt:['$delta',0]},'$delta',0]}},corrections:{$sum:{$cond:[{$lt:['$delta',0]},'$delta',0]}}}},{$sort:{_id:1}}],
      }}]),
      aggregate(User,[{$match:{role:'student',suspendedAt:null,emailVerified:{$ne:false}}},{$lookup:{from:Ledger.collection.name,let:{owner:'$_id'},pipeline:[{$match:{$expr:{$eq:['$owner','$$owner']}}},{$group:{_id:null,total:{$sum:'$delta'}}}],as:'exp'}},{$set:{total:{$ifNull:[{$arrayElemAt:['$exp.total',0]},0]}}},{$match:{total:{$gte:0}}},{$group:{_id:{$switch:{branches:levels.slice(1).map(([threshold],index)=>({case:{$gte:['$total',threshold]},then:index+2})).reverse(),default:1}},students:{$sum:1}}},{$sort:{_id:1}}]),
      aggregate(Award,[{$group:{_id:'$status',count:{$sum:1}}},{$sort:{_id:1}}]),
      aggregate(Ledger,[{$facet:{duplicates:[{$group:{_id:{owner:'$owner',event:'$eventKey'},count:{$sum:1}}},{$match:{count:{$gt:1}}},{$count:'count'}],negativeTotals:[{$group:{_id:'$owner',total:{$sum:'$delta'}}},{$match:{total:{$lt:0}}},{$count:'count'}]}}]),
    ]);
    const facts = metrics[0] || {};
    res.json({success:true,data:{active:true,
      totals:{awarded:0,corrections:0,net:0,...Object.fromEntries(Object.entries(facts.totals?.[0]||{}).filter(([key])=>key!=='_id'))},
      progressingStudents:facts.students?.[0]?.count||0,
      types:(facts.types||[]).map(row=>({kind:row._id,exp:row.exp,awards:row.awards})),
      trend:(facts.trend||[]).map(row=>({date:row._id,awarded:row.awarded,corrections:row.corrections})),
      distribution:levels.map(([threshold,title],index)=>({level:index+1,title,threshold,students:distribution.find(row=>row._id===index+1)?.students||0})),
      claims:Object.fromEntries(claims.map(row=>[row._id,row.count])),
      integrity:{duplicateEventGroups:integrity[0]?.duplicates?.[0]?.count||0,negativeOwnerTotals:integrity[0]?.negativeTotals?.[0]?.count||0},
      definitions:{period:'Ledger entries recorded in the selected inclusive UTC period.',progressingStudents:'Current eligible Students with positive net EXP in the period; not logins or attendance.',distribution:'Current eligible Student population with nonnegative cumulative net ledger EXP, independent of selected period. Invalid negative totals are separately flagged.',integrity:'Duplicate persisted owner/event groups. Rejected replay attempts are not counted; a zero is not proof that abuse never occurred.'},
    }});
  } catch { res.status(503).json({success:false,message:'EXP analytics could not be loaded. Retry without changing any records.'}); }
};
