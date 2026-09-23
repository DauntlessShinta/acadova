// Log only fixed security metadata. Never include request bodies, URLs with
// query strings, authorization headers, tokens, or raw error objects.
function logSecurityEvent(event, req, details = {}) {
  console.info(JSON.stringify({
    event,
    route: `${req.baseUrl || ''}${req.route?.path || ''}`,
    actorId: req.user?.id || null,
    actorRole: req.user?.role || null,
    ...details,
  }));
}

module.exports = { logSecurityEvent };
