function apiIdentity() {
  const revision = process.env.RENDER_GIT_COMMIT;
  return { status: 'Acadova API Running',
    revision: /^[a-f\d]{40}$/i.test(revision || '') ? revision : null,
    capabilities: ['study-sets', 'session-completion', 'analytics-date-filter', 'learning-analytics'],
  };
}
module.exports = { apiIdentity };
