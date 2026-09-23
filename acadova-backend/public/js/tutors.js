requireAuth();
const currentUser = getStoredUser();
if (currentUser && currentUser.role === 'admin') window.location.href = '/admin.html';

renderAppNav('/tutors.html');

const alertArea = document.getElementById('alert-area');
const resultsEl = document.getElementById('results');
const modalRoot = document.getElementById('modal-root');

function showError(message) {
  alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
}
function showSuccess(message) {
  alertArea.innerHTML = `<div class="alert alert-success">${escapeHtml(message)}</div>`;
}

function renderTutors(tutors) {
  const others = tutors.filter((t) => t._id !== currentUser.id);

  if (others.length === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="mark">—</div>
        <p>No tutors found for that subject yet. Try a broader search, or check back later.</p>
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = `
    <div class="features">
      ${others.map((t) => `
        <div class="feature-card">
          <div class="flex-between">
            <h3 style="margin-bottom:4px;">${escapeHtml(t.name)}</h3>
            <span class="mono small" style="color:var(--brass-deep);">★ ${Number(t.rating).toFixed(1)}</span>
          </div>
          <div class="tag-list" style="margin:10px 0 16px;">
            ${(t.skillsToTeach || []).map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join('') || '<span class="muted small">No subjects listed</span>'}
          </div>
          <button class="btn-primary btn-sm" data-request='${escapeHtml(JSON.stringify({ id: t._id, name: t.name, skills: t.skillsToTeach || [] }))}'>Request a session</button>
        </div>
      `).join('')}
    </div>
  `;

  resultsEl.querySelectorAll('[data-request]').forEach((btn) => {
    btn.addEventListener('click', () => openRequestModal(JSON.parse(btn.dataset.request)));
  });
}

async function loadTutors(subject) {
  resultsEl.innerHTML = `<div class="loading-row"><span class="spinner"></span> Searching...</div>`;
  try {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    const result = await apiRequest(`/api/users/tutors${query}`);
    renderTutors(result.data);
  } catch (error) {
    showError(error.message);
    resultsEl.innerHTML = '';
  }
}

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  loadTutors(document.getElementById('subject-input').value.trim());
});
document.getElementById('clear-btn').addEventListener('click', () => {
  document.getElementById('subject-input').value = '';
  loadTutors('');
});

function openRequestModal(tutor) {
  const skillOptions = tutor.skills.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <h3 class="mt-0">Request a session with ${escapeHtml(tutor.name)}</h3>
        <div id="modal-alert"></div>
        <form id="request-form">
          <div class="field">
            <label for="subject-select">Subject</label>
            ${tutor.skills.length
              ? `<select id="subject-select" required>${skillOptions}</select>`
              : `<input type="text" id="subject-select" placeholder="Subject" required>`}
          </div>
          <div class="field">
            <label for="scheduled-at">Preferred time <span class="muted">(optional)</span></label>
            <input type="datetime-local" id="scheduled-at">
          </div>
          <div class="field">
            <label for="credit-amount">Credit offer</label>
            <input type="number" id="credit-amount" min="1" step="1" value="1" required>
            <div class="hint">Credits move from you to the tutor once the session is completed.</div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn-primary" id="modal-submit">Send request</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  document.getElementById('request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('modal-submit');
    const modalAlert = document.getElementById('modal-alert');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const scheduledAt = document.getElementById('scheduled-at').value;
      await apiRequest('/api/sessions', {
        method: 'POST',
        body: {
          tutorId: tutor.id,
          subject: document.getElementById('subject-select').value,
          creditAmount: Number(document.getElementById('credit-amount').value),
          ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
        },
      });
      closeModal();
      showSuccess(`Session request sent to ${tutor.name}. Track it on your Sessions page.`);
    } catch (error) {
      modalAlert.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send request';
    }
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
}

loadTutors('');
