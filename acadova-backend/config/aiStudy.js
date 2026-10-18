const integer = (env, key, fallback, max) => {
  const value = Number(env[key] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
};
function aiStudyConfig(env = process.env) {
  const syntheticOnly = env.AI_STUDY_LOCAL_QA === 'true';
  const supportedEnvironment = syntheticOnly ? ['development', 'test'].includes(env.NODE_ENV)
    : ['development', 'production'].includes(env.NODE_ENV);
  return {
    enabled: env.AI_STUDY_ENABLED === 'true' && supportedEnvironment,
    syntheticOnly,
    apiKey: env.GEMINI_API_KEY || '', model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    maxBytes: integer(env, 'AI_STUDY_MAX_BYTES', 5 * 1024 * 1024, 5 * 1024 * 1024),
    maxPages: integer(env, 'AI_STUDY_MAX_PAGES', 20, 40),
    maxSlides: integer(env, 'AI_STUDY_MAX_SLIDES', 30, 60),
    maxChars: integer(env, 'AI_STUDY_MAX_CHARS', 30000, 60000),
    maxCards: integer(env, 'AI_STUDY_MAX_CARDS', 10, 10), maxQuestions: integer(env, 'AI_STUDY_MAX_QUESTIONS', 5, 5),
    dailyLimit: integer(env, 'AI_STUDY_DAILY_LIMIT', 3, 3), maxSets: integer(env, 'AI_STUDY_MAX_SETS', 30, 50),
    timeoutMs: integer(env, 'AI_STUDY_TIMEOUT_MS', 60000, 60000), parserTimeoutMs: 10000,
    maxOutputTokens: 8192, maxInputTokens: 20000, historyLimit: 20, previewMinutes: 30,
  };
}
function aiError(message, status = 400, code = 'AI_STUDY_INVALID') { return Object.assign(new Error(message), { status, code }); }
function requireConfigured(config) {
  if (!config.enabled) throw aiError('AI generation is disabled by the server administrator. Saved study sets remain available.', 503, 'AI_STUDY_DISABLED');
  if (!config.apiKey) throw aiError('Gemini is not configured on the backend. Saved study sets remain available.', 503, 'AI_STUDY_UNCONFIGURED');
  if (!/^gemini-[a-z0-9][a-z0-9.-]{0,99}$/.test(config.model || '')) throw aiError('The configured AI model is invalid. Contact the administrator.', 503, 'AI_STUDY_MODEL_INVALID');
}
module.exports = { aiStudyConfig, aiError, requireConfigured };
