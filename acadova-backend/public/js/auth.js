// Client-side session handling. The JWT and a cached copy of the public
// user record (id, name, email, credits, role) live in localStorage so the
// nav and dashboards can render instantly without waiting on a network
// round trip. Credits are still re-fetched from /api/users/me wherever they
// need to be authoritative (see dashboard.js/profile.js).

const AUTH_TOKEN_KEY = 'acadova_token';
const AUTH_USER_KEY = 'acadova_user';

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

// Updates just the cached user record (e.g. after credits change).
function updateStoredUser(patch) {
  const current = getStoredUser() || {};
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ ...current, ...patch }));
}

function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function isLoggedIn() {
  return Boolean(getToken());
}

// Place at the top of any page that requires a logged-in user.
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
  }
}

// Place at the top of admin.html - sends non-admins back to their dashboard.
function requireAdmin() {
  requireAuth();
  const user = getStoredUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/dashboard.html';
  }
}

// Sends an already-logged-in visitor away from public pages like login/register.
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    const user = getStoredUser();
    window.location.href = user && user.role === 'admin' ? '/admin.html' : '/dashboard.html';
  }
}

function logout() {
  clearSession();
  window.location.href = '/login.html';
}
