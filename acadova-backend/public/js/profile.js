requireAuth();
const currentUser = getStoredUser();
if (currentUser && currentUser.role === 'admin') window.location.href = '/admin.html';

renderAppNav('/profile.html');

const alertArea = document.getElementById('alert-area');
function showError(message) { alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`; }
function showSuccess(message) { alertArea.innerHTML = `<div class="alert alert-success">${escapeHtml(message)}</div>`; }

// --- Tag editor (same pattern as register.js, seeded with existing values) ---
function setupTagEditor(inputId, addBtnId, listId, initial) {
  const state = [...(initial || [])];
  const input = document.getElementById(inputId);
  const addBtn = document.getElementById(addBtnId);
  const list = document.getElementById(listId);

  function render() {
    list.innerHTML = state.length
      ? state.map((tag, i) => `<span class="tag">${escapeHtml(tag)}<button type="button" data-i="${i}" aria-label="Remove">&times;</button></span>`).join('')
      : `<span class="muted small">None added yet.</span>`;
    list.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => { state.splice(Number(btn.dataset.i), 1); render(); });
    });
  }

  function add() {
    const value = input.value.trim();
    if (value && !state.includes(value)) { state.push(value); input.value = ''; render(); }
    input.focus();
  }

  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  render();
  return { get: () => state };
}

let teachEditor;
let learnEditor;

async function loadProfile() {
  const result = await apiRequest('/api/users/me');
  const user = result.data;

  document.getElementById('name').value = user.name;
  teachEditor = setupTagEditor('teach-input', 'teach-add', 'teach-tags', user.skillsToTeach);
  learnEditor = setupTagEditor('learn-input', 'learn-add', 'learn-tags', user.skillsToLearn);

  document.getElementById('stat-grid').innerHTML = `
    <div class="stat-card"><div class="label">Credits</div><div class="value">${escapeHtml(user.credits)}</div></div>
    <div class="stat-card"><div class="label">Rating</div><div class="value">★ ${Number(user.rating).toFixed(1)}</div></div>
    <div class="stat-card"><div class="label">Role</div><div class="value" style="font-size:1rem; text-transform:capitalize;">${escapeHtml(user.role)}</div></div>
  `;

  updateNavCredits(user.credits);
  updateStoredUser({ name: user.name });
}

async function loadCreditHistory() {
  const container = document.getElementById('credit-history');
  try {
    const result = await apiRequest('/api/credits/mine');
    const history = result.data;

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="mark">—</div>
          <p>No credit transactions yet. They appear here once a session is completed.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="ledger-table">
        <thead><tr><th>Subject</th><th>With</th><th>Direction</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>
          ${history.map((tx) => `
            <tr>
              <td>${escapeHtml(tx.subject || '—')}</td>
              <td>${escapeHtml(tx.counterparty || 'Unknown')}</td>
              <td>${tx.direction === 'earned' ? '<span class="stamp stamp-completed">Earned</span>' : '<span class="stamp stamp-pending">Spent</span>'}</td>
              <td class="mono">${tx.direction === 'earned' ? '+' : '-'}${escapeHtml(tx.amount)}</td>
              <td class="mono small">${formatDate(tx.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
  }
}

document.getElementById('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const result = await apiRequest('/api/users/me', {
      method: 'PATCH',
      body: {
        name: document.getElementById('name').value.trim(),
        skillsToTeach: teachEditor.get(),
        skillsToLearn: learnEditor.get(),
      },
    });
    updateStoredUser({ name: result.data.name });
    showSuccess('Profile updated.');
  } catch (error) {
    showError(error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save changes';
  }
});

(async () => {
  try {
    await loadProfile();
  } catch (error) {
    showError(error.message);
  }
  loadCreditHistory();
})();
