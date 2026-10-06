import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normalizeName, nameValidationMessage } from '../src/utils/nameValidation.js';
const backend = createRequire(import.meta.url)('../../acadova-backend/utils/nameValidation.js');

test('frontend and backend names agree across cultures, punctuation, whitespace, and malformed inputs', () => {
  const accepted = ['Joshua Hernandez', "Mary-Jane O'Connor", 'José Dela Cruz', '王小明', 'Nguyễn Thị Ánh', 'Sukarno', 'A. Rahman', 'Jean–Luc', 'Jose\u0301', '  Mary   Jane  ', 'aaaaaa'];
  const rejected = ['John123', 'https://example.com', 'www.example.com', 'example.com', '... !!!', '---', 'A'.repeat(81), 'John\nDoe', ' ', 'John.. Doe', "John '' Doe"];
  for (const name of [...accepted, ...rejected]) {
    assert.equal(nameValidationMessage(name), backend.nameValidationMessage(name), name);
    assert.equal(Boolean(nameValidationMessage(name)), rejected.includes(name), name);
    assert.equal(normalizeName(name), backend.normalizeName(name));
  }
  assert.equal(normalizeName('  Mary   Jane  '), 'Mary Jane');
  assert.equal(normalizeName('Jose\u0301'), 'José');
});
