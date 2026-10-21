// Login's atomic cooldown calculation is the only permitted User pipeline.
// Replacement/projection/unset/unknown stages remain fail-closed. Expressions
// can only assign these security fields; balances and promises stay untouched.
const loginFields=new Set(['failedLoginAttempts','lastFailedLoginAt','loginCooldownUntil','updatedAt']);
function safeLoginPipeline(update){
  return Array.isArray(update)&&update.length>0&&update.every(stage=>
    stage&&Object.keys(stage).length===1&&stage.$set&&typeof stage.$set==='object'
    &&Object.keys(stage.$set).length>0&&Object.keys(stage.$set).every(key=>loginFields.has(key)));
}
module.exports={safeLoginPipeline};
