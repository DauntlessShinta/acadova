// Renders the top nav for every logged-in page into <div id="app-nav">.
// activePage should match the href of the current page, e.g. "/sessions.html".
function renderAppNav(activePage) {
  const container = document.getElementById('app-nav');
  const user = getStoredUser();
  if (!container || !user) return;

  const isAdmin = user.role === 'admin';

  const links = isAdmin
    ? [{ href: '/admin.html', label: 'Admin Dashboard' }]
    : [
        { href: '/dashboard.html', label: 'Dashboard' },
        { href: '/tutors.html', label: 'Find a Tutor' },
        { href: '/sessions.html', label: 'Sessions' },
        { href: '/profile.html', label: 'Profile' },
      ];

  const linkHtml = links
    .map((l) => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`)
    .join('');

  const creditHtml = isAdmin
    ? ''
    : `<span class="credit-pill"><span class="dot"></span><span id="nav-credits" class="mono">${escapeHtml(user.credits)}</span> credits</span>`;

  container.innerHTML = `
    <nav class="app-nav">
      <div class="app-nav-inner">
        <a href="${isAdmin ? '/admin.html' : '/dashboard.html'}" class="logo">Acadova</a>
        <div class="app-nav-links">${linkHtml}</div>
        <div class="nav-right">
          ${creditHtml}
          <span class="small muted">${escapeHtml(user.name)}</span>
          <button class="link-btn" id="nav-logout">Log out</button>
        </div>
      </div>
    </nav>
  `;

  document.getElementById('nav-logout').addEventListener('click', logout);
}

// Keeps the nav's credit pill in sync after an authoritative fetch.
function updateNavCredits(credits) {
  updateStoredUser({ credits });
  const el = document.getElementById('nav-credits');
  if (el) el.textContent = credits;
}
