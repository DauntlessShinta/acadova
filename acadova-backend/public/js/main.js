// Landing page logic: health check demo + adapting the nav for a visitor
// who is already logged in (so they see "Go to dashboard" instead of
// "Log in" / "Get started").

async function checkApiHealth() {
  const resultBox = document.getElementById('statusResult');
  if (!resultBox) return;

  resultBox.textContent = 'Checking...';
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    resultBox.textContent = data.status || 'Unknown status';
  } catch (error) {
    resultBox.textContent = 'Could not reach the API.';
  }
}

document.getElementById('statusBtn')?.addEventListener('click', checkApiHealth);

if (isLoggedIn()) {
  const user = getStoredUser();
  const dest = user && user.role === 'admin' ? '/admin.html' : '/dashboard.html';
  const loginLink = document.getElementById('nav-login-link');
  const registerLink = document.getElementById('nav-register-link');
  if (loginLink) { loginLink.textContent = 'Dashboard'; loginLink.href = dest; }
  if (registerLink) { registerLink.textContent = 'Go to dashboard'; registerLink.href = dest; }
}
