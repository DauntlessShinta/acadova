// Every page-specific script calls apiRequest() instead of fetch() directly,
// so auth headers, error messages, and expired-session handling stay in one place.

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (parseError) {
    payload = null;
  }

  // A 401 on a request that carried our own token means the session is
  // no longer valid (expired/invalid) - distinct from a login attempt
  // rejecting bad credentials, which callers pass { auth: false } for.
  if (response.status === 401 && auth) {
    clearSession();
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/login.html?expired=1&returnTo=${returnTo}`;
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const message = (payload && payload.message) || `Request failed (HTTP ${response.status})`;
    throw new Error(message);
  }

  return payload;
}
