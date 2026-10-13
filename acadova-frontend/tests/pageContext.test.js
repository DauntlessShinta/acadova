import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageContext, getRoleNavigation } from '../src/config/roleNavigation.js';

test('route context names Home and every staff navigation destination including trailing slashes', () => {
  assert.equal(getPageContext('/dashboard').title, 'Home');
  for (const role of ['admin', 'moderator']) {
    for (const link of getRoleNavigation(role)) {
      assert.equal(getPageContext(link.to + '/').title, link.label);
    }
  }
});
test('detail and query views get accurate context without substring query matches', () => {
  assert.equal(getPageContext('/sessions', '?view=messages').title, 'Messages');
  assert.equal(getPageContext('/sessions', '?preview=messages').title, 'Sessions');
  assert.equal(getPageContext('/sessions/123').title, 'Session room');
  assert.equal(getPageContext('/tutors/123').title, 'Tutor profile');
  assert.equal(getPageContext('/study-sets/123', '?edit=1').title, 'Edit study set');
  assert.equal(getPageContext('/study-sets/123', '?attempt=456').title, 'Study quiz');
  assert.equal(getPageContext('/study-sets/new').title, 'Create a study set');
  assert.equal(getPageContext('/assessments').learning, true);
});

test('administrator disputes retain their shell context and moderation destination', () => {
  assert.deepEqual(getPageContext('/admin/disputes/'), {
    title: 'Session disputes', area: 'Administration', to: '/admin/moderation',
  });
  assert.equal(getPageContext('/moderator/disputes').area, 'Moderator');
});
