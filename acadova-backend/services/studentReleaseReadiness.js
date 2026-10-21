const contracts=require('../config/studentIndexes');
const fail=()=>{throw Object.assign(new Error('Required Student indexes are not ready.'),{code:'STUDENT_INDEX_READINESS_REQUIRED'});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const simple=value=>!value||value.locale==='simple'&&Object.keys(value).length===1;
async function verifyStudentIndexes(db){
  const cursor=db.listCollections({name:{$in:contracts.map(c=>c.name)}},{nameOnly:false,maxTimeMS:8000});
  let rows;try{rows=await cursor.toArray();}finally{await cursor.close();}
  if(rows.length!==4||new Set(rows.map(r=>r.name)).size!==4)fail();
  for(const contract of contracts){
    const ns=rows.find(r=>r.name===contract.name);
    if(!ns||ns.type!=='collection'||!simple(ns.options?.collation)
      ||Object.keys(ns.options||{}).some(k=>k!=='collation'))fail();
    const indexes=await db.collection(contract.name).listIndexes({maxTimeMS:8000}).toArray();
    if(indexes.length!==contract.indexes.length+1)fail();
    const id=indexes.find(i=>i.name==='_id_');
    if(!id||!same(id.key,{_id:1})||id.sparse||id.partialFilterExpression||id.hidden||id.buildUUID||!simple(id.collation))fail();
    for(const expected of contract.indexes){
      const i=indexes.find(i=>i.name===expected.options.name);
      if(!i||!same(i.key,expected.key)||Boolean(i.unique)!==Boolean(expected.options.unique)
        ||i.sparse||i.hidden||i.buildUUID||Object.hasOwn(i,'expireAfterSeconds')
        ||!same(i.partialFilterExpression,expected.options.partialFilterExpression)||!simple(i.collation))fail();
    }
  }
  return {ready:true,collections:4,secondaryIndexes:8};
}
module.exports={verifyStudentIndexes};
