const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const ISO_DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

class InvalidInput extends Error {}

const requiredText = (label, max, min = 1) => (value) => {
  if (typeof value !== 'string') throw new InvalidInput(`${label} must be text.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new InvalidInput(`${label} must be ${min} to ${max} characters.`);
  }
  return clean;
};

const optional = (validator) => (value) => value === undefined ? undefined : validator(value);

const skills = (label) => (value) => {
  if (!Array.isArray(value) || value.length > 15) {
    throw new InvalidInput(`${label} must be an array of at most 15 skills.`);
  }
  return value.map((item) => requiredText(`${label} item`, 50)(item));
};

const objectId = (label) => (value) => {
  if (!isValidObjectId(value)) throw new InvalidInput(`Invalid ${label}.`);
  return value;
};

const oneOf = (label, allowed) => (value) => {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new InvalidInput(`Invalid ${label}.`);
  }
  return value;
};

const booleanValue = (label) => (value) => {
  if (typeof value !== 'boolean') throw new InvalidInput(`${label} must be a boolean.`);
  return value;
};

const creditAmount = (value) => {
  if (!isPositiveCreditAmount(value)) throw new InvalidInput('Credit amount must be 1 or 2.');
  return value;
};

const rating = (value) => {
  if (!isValidRating(value)) throw new InvalidInput('Rating must be an integer from 1 to 5.');
  return value;
};

const emailAddress = (value) => {
  if (typeof value !== 'string') throw new InvalidInput('A valid email is required.');
  const clean = value.trim().toLowerCase();
  if (!isValidEmail(clean)) throw new InvalidInput('A valid email is required.');
  return clean;
};

const password = (value) => {
  if (!isValidPassword(value)) throw new InvalidInput('Password must be 6 to 128 characters.');
  return value;
};

const scheduledAt = (value) => {
  if (typeof value !== 'string') throw new InvalidInput('Enter a valid scheduled date and time with a timezone.');
  const match = ISO_DATE_TIME_REGEX.exec(value);
  if (!match) throw new InvalidInput('Enter a valid scheduled date and time with a timezone.');
  const [, year, month, day, hour, minute, second = '0', zone] = match;
  const numericYear = Number(year);
  const isLeapYear = numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month) - 1];
  const offset = zone === 'Z' ? [0, 0] : zone.slice(1).split(':').map(Number);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || offset[0] > 14 || offset[1] > 59 || (offset[0] === 14 && offset[1] !== 0)) {
    throw new InvalidInput('Enter a valid scheduled date and time with a timezone.');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new InvalidInput('Enter a valid scheduled date and time with a timezone.');
  return date.toISOString();
};

const httpsLink = (value) => {
  const clean = requiredText('Meeting link', 500)(value);
  try {
    if (new URL(clean).protocol === 'https:') return clean;
  } catch { /* Return a client validation error below. */ }
  throw new InvalidInput('Meeting link must be a valid HTTPS URL.');
};

const searchSubject = (value) => {
  const clean = requiredText('Search subject', 80)(value);
  if (/[\\^$*?()[\]{}|]/.test(clean)) throw new InvalidInput('Search subject contains unsupported characters.');
  return clean;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isPlainObject = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const validateFields = (source, schema, { requireOne = false, exactlyOne = false } = {}) => (req, res, next) => {
  const input = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
  if (!isPlainObject(input)) {
    return res.status(400).json({ success: false, message: `Invalid ${source}.` });
  }
  const keys = Object.keys(input);
  if (keys.some((key) => !Object.hasOwn(schema, key))) {
    return res.status(400).json({ success: false, message: `Unexpected ${source} field.` });
  }
  if (requireOne && keys.length === 0) {
    return res.status(400).json({ success: false, message: `At least one ${source} field is required.` });
  }
  if (exactlyOne && keys.length !== 1) {
    return res.status(400).json({ success: false, message: `Exactly one ${source} field is required.` });
  }
  try {
    const clean = {};
    for (const [key, validator] of Object.entries(schema)) {
      const result = validator(input[key]);
      if (result !== undefined) clean[key] = result;
    }
    if (source === 'query') req.validatedQuery = clean;
    else if (source === 'body') req.body = clean;
    next();
  } catch (error) {
    if (error instanceof InvalidInput) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const validateBody = (schema, options) => validateFields('body', schema, options);
const validateParams = (schema) => validateFields('params', schema);
const validateQuery = (schema = {}) => validateFields('query', schema);

const validationErrorHandler = (err, req, res, next) => {
  if (err instanceof URIError && err.status === 400) {
    return res.status(400).json({ success: false, message: 'Malformed URL parameter.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  if (err.type && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ success: false, message: 'Invalid request body.' });
  }
  next(err);
};

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

function isValidPassword(password) {
  // Kept intentionally simple for a college project: length is the main bar.
  return typeof password === 'string' && password.length >= 6 && password.length <= 128 && password.trim().length > 0;
}

function isValidRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function isPositiveCreditAmount(value) {
  return Number.isInteger(value) && value >= 1 && value <= 2;
}

function isValidObjectId(id) {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id) && mongoose.Types.ObjectId.isValid(id);
}

const schemas = {
  register: {
    name: requiredText('Name', 80, 2), email: emailAddress, password,
    skillsToTeach: optional(skills('Teaching skills')), skillsToLearn: optional(skills('Learning skills')),
  },
  login: { email: emailAddress, password },
  profile: {
    name: optional(requiredText('Name', 80, 2)),
    skillsToTeach: optional(skills('Teaching skills')),
    skillsToLearn: optional(skills('Learning skills')),
  },
  search: { subject: optional(searchSubject) },
  session: {
    tutorId: objectId('tutor id'), subject: requiredText('Subject', 120),
    scheduledAt, meetingMethod: oneOf('meeting method', ['online', 'in-person']),
    requestMessage: requiredText('Request message', 500),
    creditAmount: optional(creditAmount),
  },
  sessionStatus: { status: oneOf('session status', ['accepted', 'rejected', 'completed', 'cancelled']) },
  coordination: { meetingLink: optional(httpsLink), location: optional(requiredText('Location', 300)) },
  message: { body: requiredText('Message', 1000) },
  rating: { sessionId: objectId('session id'), rating, comment: optional(requiredText('Review comment', 500, 0)) },
  role: { role: oneOf('role', ['student', 'moderator']) },
  visibility: { hidden: booleanValue('hidden') },
  userId: { id: objectId('user id') },
  sessionId: { id: objectId('session id') },
  reviewId: { id: objectId('review id') },
};

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidRating,
  isPositiveCreditAmount,
  isValidObjectId,
  validateBody,
  validateParams,
  validateQuery,
  validationErrorHandler,
  schemas,
  escapeRegExp,
};
