requireAuth();
const currentUser = getStoredUser();
if (currentUser && currentUser.role === 'admin') window.location.href = '/admin.html';

renderAppNav('/sessions.html');

const alertArea = document.getElementById('alert-area');
const listEl = document.getElementById('sessions-list');
const modalRoot = document.getElementById('modal-root');

let allSessions = [];
let activeTab = 'learning';

function showError(message) {
  alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
}
function showSuccess(message) {
  alertArea.innerHTML = `<div class="alert alert-success">${escapeHtml(message)}</div>`;
}
function clearAlert() {
  alertArea.innerHTML = '';
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    render();
  });
});

// Buttons available for a given session, based on which side the current
// user is on and the session's current status. Mirrors the backend's
// ALLOWED_TRANSITIONS + tutor-only accept/reject rule exactly.
function actionsFor(session, isLearner) {
  const isTutor = !isLearner;
  const actions = [];

  if (session.status === 'pending') {
    if (isTutor) {
      actions.push({ label: 'Accept', status: 'accepted', variant: 'btn-primary' });
      actions.push({ label: 'Reject', status: 'rejected', variant: 'btn-danger' });
    } else {
      actions.push({ label: 'Cancel request', status: 'cancelled', variant: 'btn-ghost' });
    }
  } else if (session.status === 'accepted') {
    actions.push({ label: 'Mark completed', status: 'completed', variant: 'btn-primary' });
    actions.push({ label: 'Cancel', status: 'cancelled', variant: 'btn-ghost' });
  } else if (session.status === 'completed') {
    actions.push({ label: 'Rate', status: null, variant: 'btn-secondary', rate: true });
  }

  return actions;
}

function renderRows(sessions, isLearner) {
  if (sessions.length === 0) {
    return `
      <div class="empty-state">
        <div class="mark">—</div>
        <p>${isLearner ? "You haven't requested any sessions yet." : 'No one has requested a session from you yet.'}</p>
        ${isLearner ? '<a href="/tutors.html" class="btn-secondary btn-sm">Find a tutor</a>' : ''}
      </div>
    `;
  }

  return `
    <table class="ledger-table">
      <thead>
        <tr><th>Subject</th><th>${isLearner ? 'Tutor' : 'Learner'}</th><th>Credits</th><th>Status</th><th>Requested</th><th></th></tr>
      </thead>
      <tbody>
        ${sessions.map((s) => {
          const other = isLearner ? s.tutor : s.learner;
          const actions = actionsFor(s, isLearner);
          return `<tr>
            <td>${escapeHtml(s.subject)}</td>
            <td>${escapeHtml(other ? other.name : 'Unknown')}</td>
            <td class="mono">${escapeHtml(s.creditAmount)}</td>
            <td>${statusStamp(s.status)}</td>
            <td class="mono small">${formatDate(s.createdAt)}</td>
            <td>
              <div class="row-actions">
                ${actions.map((a) => a.rate
                  ? `<button class="${a.variant} btn-sm" data-rate="${s._id}" data-other="${escapeHtml(other ? other.name : '')}">${a.label}</button>`
                  : `<button class="${a.variant} btn-sm" data-transition="${s._id}" data-status="${a.status}">${a.label}</button>`
                ).join('')}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function render() {
  const meId = currentUser.id;
  const learning = allSessions.filter((s) => s.learner && s.learner._id === meId);
  const teaching = allSessions.filter((s) => s.tutor && s.tutor._id === meId);

  listEl.innerHTML = activeTab === 'learning' ? renderRows(learning, true) : renderRows(teaching, false);

  listEl.querySelectorAll('[data-transition]').forEach((btn) => {
    btn.addEventListener('click', () => transitionSession(btn.dataset.transition, btn.dataset.status));
  });
  listEl.querySelectorAll('[data-rate]').forEach((btn) => {
    btn.addEventListener('click', () => openRateModal(btn.dataset.rate, btn.dataset.other));
  });
}

async function transitionSession(sessionId, status) {
  clearAlert();
  try {
    await apiRequest(`/api/sessions/${sessionId}/status`, { method: 'PATCH', body: { status } });
    await loadSessions();
    showSuccess('Session updated.');
  } catch (error) {
    showError(error.message);
  }
}

function openRateModal(sessionId, otherName) {
  let selected = 0;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <h3 class="mt-0">Rate ${escapeHtml(otherName)}</h3>
        <div id="modal-alert"></div>
        <form id="rate-form">
          <div class="field">
            <label>Rating</label>
            <div id="star-row" style="font-size:1.6rem; letter-spacing:4px; cursor:pointer;">
              ${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}" style="color:var(--rule);">★</span>`).join('')}
            </div>
          </div>
          <div class="field">
            <label for="comment">Comment <span class="muted">(optional)</span></label>
            <textarea id="comment" maxlength="500" placeholder="How was the session?"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn-primary" id="modal-submit">Submit rating</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const stars = modalRoot.querySelectorAll('[data-star]');
  function paintStars() {
    stars.forEach((s) => { s.style.color = Number(s.dataset.star) <= selected ? 'var(--brass)' : 'var(--rule)'; });
  }
  stars.forEach((s) => s.addEventListener('click', () => { selected = Number(s.dataset.star); paintStars(); }));

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  document.getElementById('rate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const modalAlert = document.getElementById('modal-alert');
    if (selected < 1) {
      modalAlert.innerHTML = `<div class="alert alert-error">Pick a star rating first.</div>`;
      return;
    }
    const submitBtn = document.getElementById('modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      await apiRequest('/api/ratings', {
        method: 'POST',
        body: { sessionId, rating: selected, comment: document.getElementById('comment').value.trim() || undefined },
      });
      closeModal();
      showSuccess('Rating submitted.');
    } catch (error) {
      modalAlert.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit rating';
    }
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
}

async function loadSessions() {
  const result = await apiRequest('/api/sessions');
  allSessions = result.data;
  render();
}

(async () => {
  try {
    await loadSessions();
  } catch (error) {
    showError(error.message);
  }
})();
