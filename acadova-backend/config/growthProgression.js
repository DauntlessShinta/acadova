// Reviewed, deterministic cumulative floors. Changing these is a versioned
// policy change, not a client option or an environment-only activation switch.
const version = 'academic-progression-1';
const levels = Object.freeze([
  [0, 'Beginner'], [100, 'Explorer'], [250, 'Scholar'],
  [500, 'Achiever'], [900, 'Mentor'], [1500, 'Elite Scholar'],
].map(row => Object.freeze(row)));
module.exports = { version, levels };
