requireAuth();

const storedUser = getStoredUser();
if (storedUser && storedUser.role === 'admin') {
  window.location.href = '/admin.html';
}

renderAppNav('/dashboard.html');

const alertArea = document.getElementById('alert-area');

function showError(message) {
  alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
}

function renderSkillTags(list) {
  if (!list || list.length === 0) return `<span class="muted small">None added yet.</span>`;
  return `<div class="tag-list">${list.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>`;
}

function sessionCounterpart(session, userId) {
  const isLearner = session.learner && session.learner._id === userId;
  const other = isLearner ? session.tutor : session.learner;
  return { name: other ? other.name : 'Unknown user', role: isLearner ? 'learner' : 'tutor' };
}

async function loadProfile() {
  const result = await apiRequest('/api/users/me');
  const user = result.data;
  updateStoredUser({ name: user.name, credits: user.credits, role: user.role });
  updateNavCredits(user.credits);

  document.getElementById('greeting').textContent = `Welcome back, ${user.name.split(' ')[0]}`;

  document.getElementById('stat-grid').innerHTML = `
    <div class="stat-card"><div class="label">Credits</div><div class="value">${escapeHtml(user.credits)}</div></div>
    <div class="stat-card"><div class="label">Rating</div><div class="value">★ ${Number(user.rating).toFixed(1)}</div></div>
    <div class="stat-card"><div class="label">Member since</div><div class="value" style="font-size:1rem;">${formatDate(user.createdAt)}</div></div>
  `;

  document.getElementById('skills-summary').innerHTML = `
    <p class="small muted mt-0">Teaching</p>
    ${renderSkillTags(user.skillsToTeach)}
    <p class="small muted" style="margin-top:16px;">Learning</p>
    ${renderSkillTags(user.skillsToLearn)}
  `;

  return user;
}

async function loadRecentSessions(userId) {
  const result = await apiRequest('/api/sessions');
  const sessions = result.data;
  const container = document.getElementById('recent-sessions');

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="mark">—</div>
        <p>No sessions yet. Find a tutor or wait for a learning request.</p>
        <a href="/tutors.html" class="btn-secondary btn-sm">Find a tutor</a>
      </div>
    `;
    return;
  }

  const recent = sessions.slice(0, 5);
  container.innerHTML = `
    <table class="ledger-table">
      <thead>
        <tr><th>Subject</th><th>With</th><th>Your role</th><th>Status</th><th>Requested</th></tr>
      </thead>
      <tbody>
        ${recent.map((s) => {
          const cp = sessionCounterpart(s, userId);
          return `<tr>
            <td>${escapeHtml(s.subject)}</td>
            <td>${escapeHtml(cp.name)}</td>
            <td class="mono small">${cp.role}</td>
            <td>${statusStamp(s.status)}</td>
            <td class="mono small">${formatDate(s.createdAt)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

(async () => {
  try {
    const user = await loadProfile();
    await loadRecentSessions(user._id);
  } catch (error) {
    showError(error.message);
  }
})();
