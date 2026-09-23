redirectIfLoggedIn();

const alertArea = document.getElementById('alert-area');
const form = document.getElementById('register-form');
const submitBtn = document.getElementById('submit-btn');

// --- Tag inputs for skillsToTeach / skillsToLearn ---
function setupTagInput(inputId, addBtnId, listId) {
  const state = [];
  const input = document.getElementById(inputId);
  const addBtn = document.getElementById(addBtnId);
  const list = document.getElementById(listId);

  function render() {
    list.innerHTML = state
      .map((tag, i) => `<span class="tag">${escapeHtml(tag)}<button type="button" data-i="${i}" aria-label="Remove">&times;</button></span>`)
      .join('');
    list.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.splice(Number(btn.dataset.i), 1);
        render();
      });
    });
  }

  function add() {
    const value = input.value.trim();
    if (value && !state.includes(value)) {
      state.push(value);
      input.value = '';
      render();
    }
    input.focus();
  }

  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  });

  return { get: () => state };
}

const teachTags = setupTagInput('teach-input', 'teach-add', 'teach-tags');
const learnTags = setupTagInput('learn-input', 'learn-add', 'learn-tags');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertArea.innerHTML = '';

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    alertArea.innerHTML = `<div class="alert alert-error">Passwords do not match.</div>`;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const result = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name,
        email,
        password,
        skillsToTeach: teachTags.get(),
        skillsToLearn: learnTags.get(),
      },
      auth: false,
    });

    saveSession(result.data.token, result.data.user);
    window.location.href = '/dashboard.html';
  } catch (error) {
    alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
  }
});
