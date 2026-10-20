// Real student context needs a separately reviewed privacy/provider release.
const CONTEXT_RELEASE_APPROVED=false;
function acadiConfig(env=process.env) {
  return {enabled:env.ACADI_GEMINI_ENABLED==='true'&&env.ACADI_AUDIENCE_APPROVED==='true',
    contextEnabled:CONTEXT_RELEASE_APPROVED,syntheticOnly:false,
    apiKey:env.GEMINI_API_KEY||'',model:env.ACADI_GEMINI_MODEL||env.GEMINI_MODEL||'gemini-3.5-flash-lite',
    dailyLimit:20,timeoutMs:30000,maxInputTokens:6000,maxOutputTokens:1024,policyVersion:'acadi-consent-1'};
}
function acadiError(message,status=400,code='ACADI_INVALID'){return Object.assign(new Error(message),{status,code});}
module.exports={acadiConfig,acadiError};
