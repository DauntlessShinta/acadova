requireAdmin();
renderAppNav('/admin.html');

const alertArea = document.getElementById('alert-area');
function showError(message) { alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`; }

const STATUS_ORDER = ['pending', 'accepted', 'completed', 'rejected', 'cancelled'];

async function loadSubjectDemand() {
  const el = document.getElementById('subject-demand');
  try {
    const result = await apiRequest('/api/analytics/subjects');
    const rows = result.data;

    if (rows.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="mark">—</div><p>No sessions requested yet, so there's no demand data to reduce.</p></div>`;
      return;
    }

    const max = Math.max(...rows.map((r) => r.requestCount));
    el.innerHTML = `
      <table class="ledger-table">
        <thead><tr><th>Subject</th><th>Requests</th><th></th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.subject)}</td>
              <td class="mono">${escapeHtml(r.requestCount)}</td>
              <td style="width:40%;">
                <div style="background:var(--paper-deep); border-radius:3px; overflow:hidden; height:8px;">
                  <div style="background:var(--brass); width:${(r.requestCount / max) * 100}%; height:100%;"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return rows;
  } catch (error) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  }
}

async function loadSessionStats() {
  const el = document.getElementById('session-stats');
  try {
    const result = await apiRequest('/api/analytics/sessions');
    const { total, byStatus } = result.data;

    el.innerHTML = `
      <div class="stat-grid">
        ${STATUS_ORDER.map((status) => `
          <div class="stat-card">
            <div class="label">${escapeHtml(status)}</div>
            <div class="value">${escapeHtml(byStatus[status] || 0)}</div>
          </div>
        `).join('')}
      </div>
      <p class="small muted" style="margin-top:14px;">${escapeHtml(total)} sessions total.</p>
    `;
    return result.data;
  } catch (error) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  }
}

async function loadRatingStats() {
  const el = document.getElementById('rating-stats');
  try {
    const result = await apiRequest('/api/analytics/ratings');
    const { averageRating, totalRatings, distribution } = result.data;

    if (totalRatings === 0) {
      el.innerHTML = `<div class="empty-state"><div class="mark">—</div><p>No ratings submitted yet.</p></div>`;
      return result.data;
    }

    const byStar = {};
    distribution.forEach((d) => { byStar[d._id] = d.count; });
    const maxCount = Math.max(...distribution.map((d) => d.count), 1);

    el.innerHTML = `
      <p class="mono" style="font-size:1.4rem; color:var(--navy); margin:0 0 14px;">★ ${averageRating} <span class="small muted" style="font-family:var(--font-body);">average across ${totalRatings} ratings</span></p>
      ${[5, 4, 3, 2, 1].map((star) => `
        <div class="flex-between small" style="gap:10px; margin-bottom:6px;">
          <span class="mono" style="width:24px;">${star}★</span>
          <div style="flex:1; background:var(--paper-deep); border-radius:3px; overflow:hidden; height:8px;">
            <div style="background:var(--success); width:${((byStar[star] || 0) / maxCount) * 100}%; height:100%;"></div>
          </div>
          <span class="mono muted" style="width:24px; text-align:right;">${byStar[star] || 0}</span>
        </div>
      `).join('')}
    `;
    return result.data;
  } catch (error) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  }
}

async function loadCreditStats() {
  const el = document.getElementById('credit-stats');
  try {
    const result = await apiRequest('/api/analytics/credits');
    const { totalTransactions, totalCreditsMoved } = result.data;

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="label">Transactions</div><div class="value">${escapeHtml(totalTransactions)}</div></div>
        <div class="stat-card"><div class="label">Credits moved</div><div class="value">${escapeHtml(totalCreditsMoved)}</div></div>
      </div>
    `;
    return result.data;
  } catch (error) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  }
}

async function loadUsers() {
  const el = document.getElementById('users-table');
  try {
    const result = await apiRequest('/api/admin/users');
    const users = result.data;

    el.innerHTML = `
      <table class="ledger-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Credits</th><th>Rating</th><th>Joined</th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td class="small muted">${escapeHtml(u.email)}</td>
              <td class="mono small" style="text-transform:capitalize;">${escapeHtml(u.role)}</td>
              <td class="mono">${escapeHtml(u.credits)}</td>
              <td class="mono">★ ${Number(u.rating).toFixed(1)}</td>
              <td class="mono small">${formatDate(u.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return users;
  } catch (error) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderOverview({ users, sessions, ratings, credits }) {
  const el = document.getElementById('overview-stats');
  el.innerHTML = `
    <div class="stat-card"><div class="label">Users</div><div class="value">${escapeHtml(users ? users.length : '—')}</div></div>
    <div class="stat-card"><div class="label">Sessions</div><div class="value">${escapeHtml(sessions ? sessions.total : '—')}</div></div>
    <div class="stat-card"><div class="label">Completed</div><div class="value">${escapeHtml(sessions ? (sessions.byStatus.completed || 0) : '—')}</div></div>
    <div class="stat-card"><div class="label">Avg rating</div><div class="value">${ratings && ratings.averageRating !== null ? '★ ' + ratings.averageRating : '—'}</div></div>
    <div class="stat-card"><div class="label">Credits moved</div><div class="value">${escapeHtml(credits ? credits.totalCreditsMoved : '—')}</div></div>
  `;
}

(async () => {
  const [, sessions, ratings, credits, users] = await Promise.all([
    loadSubjectDemand(),
    loadSessionStats(),
    loadRatingStats(),
    loadCreditStats(),
    loadUsers(),
  ]);
  renderOverview({ users, sessions, ratings, credits });
})();
