export const normalizeName = (value) => value.trim().replace(/ +/g, ' ');
export const normalizeEmail = (value) => value.trim().toLowerCase();

export const passwordRequirements = (password) => [
  ['At least 8 characters', password.length >= 8],
  ['An uppercase letter', /[A-Z]/.test(password)],
  ['A lowercase letter', /[a-z]/.test(password)],
  ['A number', /[0-9]/.test(password)],
  ['A special character', /[^A-Za-z0-9\s]/.test(password)],
];

export const validateRegistration = ({ name, email, password, confirmPassword }) => {
  const cleanName = normalizeName(name);
  const cleanEmail = normalizeEmail(email);
  const fields = {};
  if (!cleanName) fields.name = 'Enter your full name.';
  else if (cleanName.length > 100) fields.name = 'Name must be 100 characters or fewer.';
  else if (cleanName.length < 2 || /[\p{Cc}\p{Cf}]/u.test(name)
    || !/^[\p{L}\p{M}\p{N} .\p{Pd}'\u2019]+$/u.test(cleanName)) {
    fields.name = 'Enter a valid full name.';
  }
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    || /[\p{Cc}\p{Cf}]/u.test(cleanEmail)) fields.email = 'Enter a valid email address.';
  if (!passwordRequirements(password).every(([, met]) => met)
    || password.length > 64 || new TextEncoder().encode(password).length > 72
    || /[\p{Cc}\p{Cf}]/u.test(password)) {
    fields.password = 'Password does not meet the requirements (maximum 64 characters and 72 UTF-8 bytes).';
  }
  if (confirmPassword !== password) fields.confirmPassword = 'Passwords do not match.';
  return { fields, account: { name: cleanName, email: cleanEmail, password } };
};

export const isVerificationRequired = (error) => error?.data?.code === 'EMAIL_VERIFICATION_REQUIRED';
export const pendingRegistrationNavigation = (error, email) =>
  error?.status === 409 && error?.data?.code === 'REGISTRATION_PENDING_VERIFICATION'
    ? { path: '/verify-email/pending', state: { email: normalizeEmail(email) } }
    : null;
export const verificationResultForError = (error) => {
  if (error?.data?.code === 'VERIFICATION_EXPIRED') return 'expired';
  if (error?.data?.code === 'VERIFICATION_INVALID' || error?.status === 400) return 'invalid';
  return 'unavailable';
};

export const registrationErrorMessage = (error) => {
  if (error?.status === 409) return 'An account with this email already exists.';
  if (!error?.status) return 'Unable to reach Acadova. Check your connection and try again.';
  if (error.status >= 500) return 'Acadova is temporarily unavailable. Please try again.';
  return error.data?.message || 'Account could not be created. Check your details and try again.';
};

export const loginErrorMessage = (error) => {
  if (error?.status === 401) return 'Email or password is incorrect.';
  if (!error?.status) return 'Unable to reach Acadova. Check your connection and try again.';
  if (error.status >= 500) return 'Acadova is temporarily unavailable. Please try again.';
  return 'Unable to sign in. Please try again.';
};

export const maskEmail = (value) => {
  const [local, domain] = value.split('@');
  if (!local || !domain) return '';
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
};
