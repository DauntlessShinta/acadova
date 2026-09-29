import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreditActivityList } from '../src/components/credits/CreditActivityList.js';

test('wallet activity renders earned and spent events and an empty state', () => {
  const html = renderToStaticMarkup(React.createElement(CreditActivityList, { history: [
      { id: 'grant', label: 'Starting credits', description: 'Acadova welcome credit grant',
        direction: 'earned', amount: 100, occurredAt: '2026-09-29T00:00:00Z' },
      { id: 'payment', label: 'Tutoring session', description: 'Learned with Taylor · JavaScript',
        direction: 'spent', amount: 20, occurredAt: '2026-09-28T00:00:00Z' },
  ] }));
  assert.match(html, /\+100 credits/);
  assert.match(html, /Earned/);
  assert.match(html, /−20 credits/);
  assert.match(html, /Spent/);
  assert.match(html, /Learned with Taylor/);
  const empty = renderToStaticMarkup(React.createElement(CreditActivityList, { history: [] }));
  assert.match(empty, /No credit activity yet/);
  const malformed = renderToStaticMarkup(React.createElement(CreditActivityList, { history: [
    { id: 'old', label: 'Credit activity', direction: 'neutral', amount: null },
  ] }));
  assert.match(malformed, /Amount unavailable/);
});
