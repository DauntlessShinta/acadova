// Exact existing P4 creation order/options. This module never performs DDL.
module.exports=Object.freeze([
  {name:'expaccountlocks',indexes:[]},
  {name:'expawards',indexes:[
    {key:{owner:1,eventKey:1},options:{unique:true,name:'uniq_exp_claim_owner_event'}},
    {key:{owner:1,createdAt:-1},options:{name:'owner_1_createdAt_-1'}},
    {key:{pairKey:1,createdAt:-1},options:{name:'pairKey_1_createdAt_-1'}},
    {key:{status:1,readyAt:1},options:{name:'status_1_readyAt_1'}},
  ]},
  {name:'expledgerentries',indexes:[
    {key:{owner:1,eventKey:1},options:{unique:true,name:'uniq_exp_owner_event'}},
    {key:{reversalOf:1},options:{unique:true,name:'uniq_exp_reversal',partialFilterExpression:{reversalOf:{$exists:true}}}},
    {key:{owner:1,createdAt:-1},options:{name:'exp_private_history'}},
  ]},
  {name:'legacycreditreviews',indexes:[
    {key:{session:1},options:{unique:true,name:'uniq_legacy_credit_review_session'}},
  ]},
].map(row=>Object.freeze({...row,options:Object.freeze({collation:Object.freeze({locale:'simple'})}),indexes:Object.freeze(row.indexes.map(Object.freeze))})));
