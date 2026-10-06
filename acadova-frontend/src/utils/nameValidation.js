const normalizeName = (value) => typeof value === 'string' ? value.normalize('NFC').trim().replace(/ +/g, ' ') : '';
const nameValidationMessage = (value) => {
  const clean = normalizeName(value);
  if (!clean) return 'Enter your full name.';
  if ([...clean].length < 2 || [...clean].length > 80) return 'Use 2 to 80 characters for your name.';
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)
    || !/^[\p{L}][\p{L}\p{M} .\p{Pd}'\u2019]*[\p{L}\p{M}.]$/u.test(clean)
    || /[.\p{Pd}'\u2019]{2}|\.[^ ]| (?:[.\p{Pd}'\u2019])|(?:[\p{Pd}'\u2019]) /u.test(clean)
    || /(?:^| )www\./i.test(clean)) {
    return 'Use letters, spaces, apostrophes, hyphens, or an abbreviation with a period. Leave out numbers and links.';
  }
  return '';
};

export { normalizeName, nameValidationMessage };
