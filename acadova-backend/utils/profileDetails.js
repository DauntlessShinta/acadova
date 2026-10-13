const YEAR_LEVELS = ['', '1st year', '2nd year', '3rd year', '4th year', '5th year', '6th year', 'Other'];
const LANGUAGES = ['English', 'Filipino', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Waray', 'Spanish', 'Japanese', 'Korean', 'Mandarin Chinese', 'French', 'German', 'Arabic', 'Malay', 'Indonesian', 'Thai', 'Vietnamese', 'Hindi', 'Portuguese', 'Filipino Sign Language'];
const DETAIL_FIELDS = ['bio', 'university', 'yearLevel', 'languages'];

const text = (label, max) => value => {
  if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be text of at most ${max} characters.`);
  }
  return value.trim();
};
const validators = {
  bio: text('Biography', 1000),
  university: text('University', 120),
  yearLevel: value => {
    if (!YEAR_LEVELS.includes(value)) throw new Error('Choose a supported year level.');
    return value;
  },
  languages: value => {
    if (!Array.isArray(value) || value.length > 10 || new Set(value).size !== value.length || !value.every(item => LANGUAGES.includes(item))) {
      throw new Error('Choose at most 10 distinct supported languages.');
    }
    return value;
  },
  profileVisibility: value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !DETAIL_FIELDS.includes(key))
      || Object.values(value).some(flag => typeof flag !== 'boolean')) throw new Error('Invalid profile visibility preferences.');
    // A replacement is intentional: any omitted preference returns to private.
    return Object.fromEntries(DETAIL_FIELDS.map(key => [key, value[key] === true]));
  },
};
function profileUpdates(body) {
  return Object.fromEntries(Object.entries(validators).filter(([key]) => body[key] !== undefined)
    .map(([key, validate]) => [key, validate(body[key])]));
}
function publicProfileDetails(profile) {
  return Object.fromEntries(DETAIL_FIELDS.filter(key => profile.profileVisibility?.[key] === true
    && (key === 'languages' ? profile[key]?.length : profile[key]))
    .map(key => [key, profile[key]]));
}
module.exports = { YEAR_LEVELS, LANGUAGES, DETAIL_FIELDS, validators, profileUpdates, publicProfileDetails };
