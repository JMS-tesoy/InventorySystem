/* =====================================================
   auth.js — Login, Session & Role-Based Access Control
   Office Supplies Inventory System

   TWO ACCOUNTS:
   ┌──────────┬──────────────┬─────────────────────────────────────────┐
   │ Username │ Password     │ Access                                  │
   ├──────────┼──────────────┼─────────────────────────────────────────┤
   │ admin    │ Admin@1234   │ Full access to everything               │
   │ user     │ User@1234    │ View & print only. Can edit Header      │
   │          │              │ and Signatories in Settings.            │
   └──────────┴──────────────┴─────────────────────────────────────────┘

   HOW ROLES WORK:
   - After login, body gets class 'role-admin' or 'role-user'.
   - CSS hides elements with class 'admin-only' for role-user.
   - JS guards write actions (submitRequest, submitStock, etc.)
     by calling requireAdmin() which blocks and shows an alert.
   ===================================================== */


/* ─────────────────────────────────────────────────────
   ACCOUNT SEED — called once on first load
   Stored under localStorage key: 'accounts'
   ───────────────────────────────────────────────────── */
function initAccounts() {
  if (localStorage.getItem('accounts')) return; // already seeded
  const accounts = [
    {
      id: 1,
      username:    'admin',
      password:    'Admin@1234',
      role:        'admin',
      displayName: 'Administrator'
    },
    {
      id: 2,
      username:    'user',
      password:    'User@1234',
      role:        'user',
      displayName: 'Staff User'
    }
  ];
  saveAuthKey('accounts', accounts);
}

function saveAuthKey(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (typeof window.syncStorageKey === 'function') {
    window.syncStorageKey(key, value);
  }
}

/* ─────────────────────────────────────────────────────
   SESSION HELPERS
   Session is stored in localStorage under 'currentUser'
   so it persists across page refreshes.
   ───────────────────────────────────────────────────── */

// Get the currently logged-in user object (or null)
function getSession() {
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

// Save session after successful login
function setSession(user) {
  // Store only safe fields — never store password in session
  saveAuthKey('currentUser', {
    id:          user.id,
    username:    user.username,
    role:        user.role,
    displayName: user.displayName
  });
}

// Clear session on logout
function clearSession() {
  localStorage.removeItem('currentUser');
  if (typeof window.syncStorageKey === 'function') {
    window.syncStorageKey('currentUser', null);
  }
}

// Shortcut: is the current user an admin?
function isAdmin() {
  const s = getSession();
  return s && s.role === 'admin';
}

// Shortcut: get current role string ('admin' or 'user' or null)
function getCurrentRole() {
  const s = getSession();
  return s ? s.role : null;
}


/* ─────────────────────────────────────────────────────
   AUTH GATE — call on every page load
   Shows login screen if no valid session exists.
   ───────────────────────────────────────────────────── */
function checkAuth() {
  const session = getSession();
  if (!session) {
    showLoginScreen();
  } else {
    hideLoginScreen();
    applyRoleUI(session.role);
    updateTopbarUser(session);
    if (typeof restoreLastVisitedPage === 'function') restoreLastVisitedPage();
  }
}


/* ─────────────────────────────────────────────────────
   LOGIN LOGIC
   ───────────────────────────────────────────────────── */
function doLogin() {
  const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
  const passwordInput = document.getElementById('login-password').value;
  const errorEl       = document.getElementById('login-error');

  errorEl.textContent = '';

  if (!usernameInput || !passwordInput) {
    errorEl.textContent = 'Please enter both username and password.';
    return;
  }

  const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  const match = accounts.find(
    a => a.username.toLowerCase() === usernameInput && a.password === passwordInput
  );

  if (!match) {
    errorEl.textContent = '❌ Incorrect username or password.';
    // Shake the login card for visual feedback
    const card = document.getElementById('login-card');
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
    return;
  }

  // Success — set session and enter app
  setSession(match);
  hideLoginScreen();
  applyRoleUI(match.role);
  updateTopbarUser(match);
  if (typeof refreshThemeForCurrentUser === 'function') refreshThemeForCurrentUser();
  if (typeof restoreLastVisitedPage === 'function') restoreLastVisitedPage();

  // Clear login fields
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

// Allow pressing Enter in the password field to submit
function loginKeydown(e) {
  if (e.key === 'Enter') doLogin();
}


/* ─────────────────────────────────────────────────────
   LOGOUT
   ───────────────────────────────────────────────────── */
async function doLogout() {
  let shouldLogout = false;

  if (typeof themedDeleteConfirm === 'function') {
    shouldLogout = await themedDeleteConfirm('You are about to end your current session.', {
      title: 'Confirm Logout',
      confirmLabel: 'Log out',
      confirmButtonClass: 'btn-warning'
    });
  } else {
    shouldLogout = confirm('Log out of the system?');
  }

  if (!shouldLogout) return;
  clearSession();
  if (typeof refreshThemeForCurrentUser === 'function') refreshThemeForCurrentUser();
  // Reset body role class
  document.body.classList.remove('role-admin', 'role-user');
  // Go back to dashboard view so login screen looks clean
  showPage('dashboard');
  showLoginScreen();
}


/* ─────────────────────────────────────────────────────
   SHOW / HIDE LOGIN SCREEN
   ───────────────────────────────────────────────────── */
function showLoginScreen() {
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('sidebar').style.visibility    = 'hidden';
  document.getElementById('main').style.visibility      = 'hidden';
  document.getElementById('hamburger').style.visibility = 'hidden';
  setTimeout(() => document.getElementById('login-username').focus(), 100);
}

function hideLoginScreen() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('sidebar').style.visibility    = 'visible';
  document.getElementById('main').style.visibility      = 'visible';
  document.getElementById('hamburger').style.visibility = 'visible';
}


/* ─────────────────────────────────────────────────────
   ROLE-BASED UI — apply after login
   Adds 'role-admin' or 'role-user' class to <body>.
   CSS then shows/hides .admin-only elements.
   ───────────────────────────────────────────────────── */
function applyRoleUI(role) {
  document.body.classList.remove('role-admin', 'role-user');
  document.body.classList.add('role-' + role);
}


/* ─────────────────────────────────────────────────────
   TOPBAR USER BADGE — shows who is logged in
   ───────────────────────────────────────────────────── */
function updateTopbarUser(session) {
  const badge = document.getElementById('topbar-user');
  if (!badge) return;
  const roleLabel = session.role === 'admin'
    ? '<span class="role-badge admin-badge">ADMIN</span>'
    : '<span class="role-badge user-badge">USER</span>';
  badge.innerHTML = `
    ${roleLabel}
    <button id="theme-toggle-btn" class="theme-toggle no-print" onclick="toggleTheme()" aria-label="Switch theme" title="Switch theme">Dark Mode</button>
    <button class="btn btn-sm btn-logout" onclick="doLogout()">🚪 Logout</button>
  `;

  if (typeof applyTheme === 'function') {
    const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(mode);
  }
}


/* ─────────────────────────────────────────────────────
   ROLE GUARD — blocks write actions for non-admins
   Call this at the start of any admin-only JS function.
   ───────────────────────────────────────────────────── */
function requireAdmin() {
  if (!isAdmin()) {
    alert('⛔ Access Denied. This action requires Admin privileges.');
    return false;
  }
  return true;
}


/* ─────────────────────────────────────────────────────
   CHANGE PASSWORD — available to all logged-in users
   (change their own password only)
   Admin can also manage all accounts.
   ───────────────────────────────────────────────────── */
function changeOwnPassword() {
  const session  = getSession();
  if (!session) return;

  const current  = document.getElementById('pwd-current').value;
  const newPwd   = document.getElementById('pwd-new').value;
  const confirm  = document.getElementById('pwd-confirm').value;
  const msgEl    = document.getElementById('pwd-msg');
  msgEl.textContent = '';

  if (!current || !newPwd || !confirm) {
    msgEl.textContent = 'Please fill in all password fields.';
    msgEl.className = 'alert alert-error';
    return;
  }

  // Validate current password
  const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  const idx = accounts.findIndex(a => a.id === session.id);
  if (idx === -1 || accounts[idx].password !== current) {
    msgEl.textContent = '❌ Current password is incorrect.';
    msgEl.className = 'alert alert-error';
    return;
  }

  // Validate new password strength
  if (newPwd.length < 6) {
    msgEl.textContent = 'New password must be at least 6 characters.';
    msgEl.className = 'alert alert-error';
    return;
  }
  if (newPwd !== confirm) {
    msgEl.textContent = '❌ New passwords do not match.';
    msgEl.className = 'alert alert-error';
    return;
  }

  // Save new password
  accounts[idx].password = newPwd;
  saveAuthKey('accounts', accounts);

  msgEl.textContent = '✅ Password changed successfully!';
  msgEl.className = 'alert alert-success';

  // Clear fields
  ['pwd-current','pwd-new','pwd-confirm'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

// ADMIN ONLY: reset another account's password
function adminResetPassword() {
  if (!requireAdmin()) return;

  const targetUsername = document.getElementById('admin-reset-user').value;
  const newPwd         = document.getElementById('admin-reset-pwd').value;
  const msgEl          = document.getElementById('admin-reset-msg');
  msgEl.textContent    = '';

  if (!targetUsername || !newPwd) {
    msgEl.textContent = 'Please select a user and enter a new password.';
    msgEl.className = 'alert alert-error';
    return;
  }
  if (newPwd.length < 6) {
    msgEl.textContent = 'Password must be at least 6 characters.';
    msgEl.className = 'alert alert-error';
    return;
  }

  const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  const idx = accounts.findIndex(a => a.username === targetUsername);
  if (idx === -1) {
    msgEl.textContent = 'User not found.';
    msgEl.className = 'alert alert-error';
    return;
  }

  accounts[idx].password = newPwd;
  saveAuthKey('accounts', accounts);

  msgEl.textContent = `✅ Password for "${targetUsername}" reset successfully!`;
  msgEl.className = 'alert alert-success';
  document.getElementById('admin-reset-pwd').value = '';
}

// Populate the admin-reset user dropdown
function populateAdminResetDropdown() {
  const sel = document.getElementById('admin-reset-user');
  if (!sel) return;
  const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  sel.innerHTML = '<option value="">-- Select Account --</option>';
  accounts.forEach(a => {
    sel.innerHTML += `<option value="${a.username}">${a.displayName} (${a.username})</option>`;
  });
}

// Toggle show/hide password in the login form
function toggleLoginPassword() {
  const inp = document.getElementById('login-password');
  const btn = document.getElementById('toggle-pwd-btn');
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️';
  }
}

