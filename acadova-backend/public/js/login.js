redirectIfLoggedIn();

const params = new URLSearchParams(window.location.search);
const alertArea = document.getElementById('alert-area');

if (params.get('expired') === '1') {
  alertArea.innerHTML = `<div class="alert alert-info">Your session expired. Please log in again.</div>`;
}

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertArea.innerHTML = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });

    saveSession(result.data.token, result.data.user);

    const returnTo = params.get('returnTo');
    if (returnTo && returnTo.startsWith('/') && !returnTo.includes('login')) {
      window.location.href = returnTo;
    } else {
      window.location.href = result.data.user.role === 'admin' ? '/admin.html' : '/dashboard.html';
    }
  } catch (error) {
    alertArea.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});
