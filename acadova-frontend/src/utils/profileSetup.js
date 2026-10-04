// The current User schema has a display name and skill lists, not separate
// name/bio/availability fields. Either learning or teaching interest is enough
// to mark the lightweight setup complete.
export const needsProfileSetup = (user) => user?.role === 'student'
  && !user.onboardingFinishedAt
  && !(user.skillsToLearn?.length || user.skillsToTeach?.length);

export const splitDisplayName = (name = '') => {
  const [firstName = '', ...lastParts] = name.trim().split(/\s+/);
  return { firstName, lastName: lastParts.join(' ') };
};
