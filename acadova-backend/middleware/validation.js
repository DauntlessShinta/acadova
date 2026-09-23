const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function isValidPassword(password) {
  // Kept intentionally simple for a college project: length is the main bar.
  return typeof password === 'string' && password.length >= 6;
}

function isValidRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function isPositiveCreditAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidRating,
  isPositiveCreditAmount,
  isValidObjectId,
};
