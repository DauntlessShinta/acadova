// Initial domain approved by the project owner. Further institutional policy is
// pending; configuration changes require operator approval, not a public API.
const DEFAULT_DOMAINS = Object.freeze(['phinmaed.com']);
function registrationDomains(env = process.env) {
  const raw = env.STUDENT_EMAIL_DOMAINS;
  const domains = raw === undefined ? [...DEFAULT_DOMAINS] : raw.split(',').map(value => value.trim().toLowerCase());
  if (!domains.length || domains.some(value => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value))) {
    throw Object.assign(new Error('Institutional registration configuration is unavailable.'), { status: 503 });
  }
  return [...new Set(domains)];
}
function normalizeInstitutionalEmail(value, env = process.env) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  // Do not guess provider-specific dot rules. Reject plus aliases and unusual
  // local syntax for new registrations instead of creating parallel identities.
  const match = /^([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)@([a-z0-9.-]+)$/.exec(email);
  if (!match || email.length > 254 || match[1].length > 64 || match[1].includes('..')) return null;
  return registrationDomains(env).includes(match[2]) ? email : null;
}
module.exports = { registrationDomains, normalizeInstitutionalEmail };
