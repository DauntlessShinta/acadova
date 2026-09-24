import test from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordRequirements, validateRegistration, isVerificationRequired,
  verificationResultForError, registrationErrorMessage, loginErrorMessage, maskEmail,
  pendingRegistrationNavigation,
} from '../src/utils/authForm.js';
import { getRoleHomeRoute } from '../src/config/roleNavigation.js';

const valid = {
  name: '  María O’Neil   Smith  ', email: ' USER@EXAMPLE.TEST ',
  password: 'ValidSecret1!', confirmPassword: 'ValidSecret1!',
};

test('registration accepts international names and sends only normalized account fields', () => {
  const result = validateRegistration(valid);
  assert.deepEqual(result.fields, {});
  assert.deepEqual(result.account, {
    name: 'María O’Neil Smith', email: 'user@example.test', password: valid.password,
  });
  assert.equal(Object.hasOwn(result.account, 'confirmPassword'), false);
});

test('name, email, and confirmation mistakes receive specific errors', () => {
  assert.equal(validateRegistration({ ...valid, name: '   ' }).fields.name, 'Enter your full name.');
  assert.equal(validateRegistration({ ...valid, name: '<script>' }).fields.name, 'Enter a valid full name.');
  assert.equal(validateRegistration({ ...valid, name: 'x'.repeat(101) }).fields.name, 'Name must be 100 characters or fewer.');
  assert.equal(validateRegistration({ ...valid, email: 'wrong-address' }).fields.email, 'Enter a valid email address.');
  assert.equal(validateRegistration({ ...valid, confirmPassword: 'different' }).fields.confirmPassword, 'Passwords do not match.');
});

test('password checklist and submission policy agree with backend bounds', () => {
  assert.ok(passwordRequirements(valid.password).every(([, met]) => met));
  for (const password of ['short1!', 'lowercase1!', 'UPPERCASE1!', 'NoNumber!', 'NoSpecial1',
    `ValidSecret1!${'a'.repeat(53)}`, `ValidSecret1!${'é'.repeat(31)}`]) {
    const result = validateRegistration({ ...valid, password, confirmPassword: password });
    assert.ok(result.fields.password, password);
  }
});

test('auth API states produce the correct user-facing flow', () => {
  assert.equal(isVerificationRequired({ status: 403, data: { code: 'EMAIL_VERIFICATION_REQUIRED' } }), true);
  assert.equal(isVerificationRequired({ status: 401, data: { message: 'Invalid email or password' } }), false);
  assert.equal(loginErrorMessage({ status: 401 }), 'Email or password is incorrect.');
  assert.equal(registrationErrorMessage({ status: 409 }), 'An account with this email already exists.');
  assert.match(loginErrorMessage(new TypeError('network failed')), /Unable to reach Acadova/);
  assert.equal(getRoleHomeRoute('student'), '/dashboard');
  assert.equal(getRoleHomeRoute('moderator'), '/moderator');
  assert.equal(getRoleHomeRoute('admin'), '/admin');
});

test('verification errors distinguish expired, invalid, and unavailable without exposing details', () => {
  assert.equal(verificationResultForError({ status: 410, data: { code: 'VERIFICATION_EXPIRED' } }), 'expired');
  assert.equal(verificationResultForError({ status: 400, data: { code: 'VERIFICATION_INVALID' } }), 'invalid');
  assert.equal(verificationResultForError({ status: 500, data: { message: 'Private provider detail' } }), 'unavailable');
  assert.equal(verificationResultForError(new TypeError('network failed')), 'unavailable');
  assert.equal(maskEmail('john.doe@example.com'), 'j*******@example.com');
});

test('pending registration routes with only a normalized email; verified duplicates stay on Register', () => {
  const pending = pendingRegistrationNavigation({ status: 409, data: {
    code: 'REGISTRATION_PENDING_VERIFICATION',
  } }, ' USER@EXAMPLE.TEST ');
  assert.deepEqual(pending, {
    path: '/verify-email/pending', state: { email: 'user@example.test' },
  });
  assert.deepEqual(Object.keys(pending.state), ['email']);
  assert.equal(pendingRegistrationNavigation({ status: 409, data: {} }, 'user@example.test'), null);
  assert.equal(pendingRegistrationNavigation({ status: 503, data: {} }, 'user@example.test'), null);
});
