// A random session version avoids counter overflow and never revives an old version.
function validAuthVersion(value) {
  return value === undefined || (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
}

function authVersionMatches(claim, stored) {
  return validAuthVersion(claim) && validAuthVersion(stored) && claim === stored;
}

module.exports = { validAuthVersion, authVersionMatches };
