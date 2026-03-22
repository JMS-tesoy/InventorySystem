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
  const existing = localStorage.getItem('accounts');
  if (existing) {
    try {
      const accounts = JSON.parse(existing);
      if (Array.isArray(accounts)) {
        let changed = false;
        const hydrated = accounts.map((account) => {
          const username = String(account.username || '').toLowerCase();
          const copy = { ...account };
          if (!copy.email && username === 'admin') {
            copy.email = 'admin@inventory.local';
            changed = true;
          }
          if (!copy.phone && username === 'admin') {
            copy.phone = '09170000001';
            changed = true;
          }
          if (!copy.email && username === 'user') {
            copy.email = 'user@inventory.local';
            changed = true;
          }
          if (!copy.phone && username === 'user') {
            copy.phone = '09170000002';
            changed = true;
          }
          return copy;
        });
        
        // Automatically inject extra seeded users if they don't exist yet
        const extraUsers = [
          { username: 'alice', displayName: 'Alice Cooper', phone: '09170000003' },
          { username: 'bob', displayName: 'Bob Builder', phone: '09170000004' },
          { username: 'charlie', displayName: 'Charlie Chaplin', phone: '09170000005' },
          { username: 'diana', displayName: 'Diana Prince', phone: '09170000006' },
          { username: 'evan', displayName: 'Evan Wright', phone: '09170000007' },
          { username: 'fiona', displayName: 'Fiona Gallagher', phone: '09170000008' }
        ];
        
        extraUsers.forEach((u) => {
          if (!hydrated.some(a => (a.username || '').toLowerCase() === u.username)) {
            const nextId = hydrated.reduce((max, account) => Math.max(max, Number(account.id) || 0), 0) + 1;
            hydrated.push({ id: nextId, username: u.username, password: 'User@1234', role: 'user', displayName: u.displayName, email: u.username + '@inventory.local', phone: u.phone });
            changed = true;
          }
        });

        if (changed) saveAuthKey('accounts', hydrated);
      }
    } catch (_) {
      // ignore malformed storage and continue with seeded defaults below
    }
    return;
  }

  const accounts = [
    {
      id: 1,
      username:    'admin',
      password:    'Admin@1234',
      role:        'admin',
      displayName: 'Administrator',
      email:       'admin@inventory.local',
      phone:       '09170000001'
    },
    {
      id: 2,
      username:    'user',
      password:    'User@1234',
      role:        'user',
      displayName: 'Staff User',
      email:       'user@inventory.local',
      phone:       '09170000002'
    },
    {
      id: 3,
      username:    'alice',
      password:    'User@1234',
      role:        'user',
      displayName: 'Alice Cooper',
      email:       'alice@inventory.local',
      phone:       '09170000003'
    },
    {
      id: 4,
      username:    'bob',
      password:    'User@1234',
      role:        'user',
      displayName: 'Bob Builder',
      email:       'bob@inventory.local',
      phone:       '09170000004'
    },
    {
      id: 5,
      username:    'charlie',
      password:    'User@1234',
      role:        'user',
      displayName: 'Charlie Chaplin',
      email:       'charlie@inventory.local',
      phone:       '09170000005'
    },
    {
      id: 6,
      username:    'diana',
      password:    'User@1234',
      role:        'user',
      displayName: 'Diana Prince',
      email:       'diana@inventory.local',
      phone:       '09170000006'
    },
    {
      id: 7,
      username:    'evan',
      password:    'User@1234',
      role:        'user',
      displayName: 'Evan Wright',
      email:       'evan@inventory.local',
      phone:       '09170000007'
    },
    {
      id: 8,
      username:    'fiona',
      password:    'User@1234',
      role:        'user',
      displayName: 'Fiona Gallagher',
      email:       'fiona@inventory.local',
      phone:       '09170000008'
    }
  ];
  saveAuthKey('accounts', accounts);
}

function normalizePhone(phoneValue) {
  return String(phoneValue || '').replace(/\D/g, '');
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

function setLoginMessage(message, isError = true) {
  const errorEl = document.getElementById('login-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.color = isError ? '#c62828' : '#2e7d32';
}

function setLoginActionMessage(elementId, message, isError = true) {
  const msgEl = document.getElementById(elementId);
  if (!msgEl) return;
  msgEl.textContent = message;
  msgEl.style.color = isError ? '#c62828' : '#2e7d32';
}

function openLoginActionDialog(dialogId, focusFieldId) {
  const dialog = document.getElementById(dialogId);
  const overlay = document.getElementById('login-overlay');
  if (!dialog) return;

  document.querySelectorAll('.login-action-dialog.is-open').forEach((node) => {
    if (node.id !== dialogId) {
      node.classList.remove('is-open');
      node.setAttribute('aria-hidden', 'true');
    }
  });

  dialog.classList.add('is-open');
  dialog.setAttribute('aria-hidden', 'false');
  if (overlay) overlay.classList.add('has-action-dialog');

  if (focusFieldId) {
    setTimeout(() => {
      const field = document.getElementById(focusFieldId);
      if (field) field.focus();
    }, 40);
  }
}

function closeLoginActionDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  const overlay = document.getElementById('login-overlay');
  if (!dialog) return;
  dialog.classList.remove('is-open');
  dialog.setAttribute('aria-hidden', 'true');

  const stillOpen = document.querySelector('.login-action-dialog.is-open');
  if (!stillOpen && overlay) {
    overlay.classList.remove('has-action-dialog');
  }
}

function createAccountFromLogin() {
  setLoginActionMessage('create-account-error', '', true);
  openLoginActionDialog('create-account-dialog', 'create-display-name');
}

function forgotPasswordFromLogin() {
  setLoginActionMessage('forgot-password-error', '', true);
  openLoginActionDialog('forgot-password-dialog', 'forgot-email');
}

function submitCreateAccountDialog(event) {
  event.preventDefault();

  const cleanDisplayName = (document.getElementById('create-display-name').value || '').trim();
  const username = (document.getElementById('create-username').value || '').trim().toLowerCase();
  const email = (document.getElementById('create-email').value || '').trim().toLowerCase();
  const password = document.getElementById('create-password').value || '';
  const confirmPassword = document.getElementById('create-confirm-password').value || '';

  setLoginActionMessage('create-account-error', '', true);

  if (!cleanDisplayName) {
    setLoginActionMessage('create-account-error', 'Please provide a valid full name.');
    return;
  }

  if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
    setLoginActionMessage('create-account-error', 'Username must be 3-24 chars using letters, numbers, ., _, or -.');
    return;
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setLoginActionMessage('create-account-error', 'Please enter a valid email address.');
    return;
  }

  const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  const exists = accounts.some(a => (a.username || '').toLowerCase() === username);
  if (exists) {
    setLoginActionMessage('create-account-error', 'That username is already taken.');
    return;
  }

  const emailExists = accounts.some(a => (a.email || '').toLowerCase() === email);
  if (emailExists) {
    setLoginActionMessage('create-account-error', 'That email is already in use.');
    return;
  }

  if (password.length < 6) {
    setLoginActionMessage('create-account-error', 'Password must be at least 6 characters.');
    return;
  }

  if (password !== confirmPassword) {
    setLoginActionMessage('create-account-error', 'Password confirmation did not match.');
    return;
  }

  const nextId = accounts.reduce((max, account) => Math.max(max, Number(account.id) || 0), 0) + 1;
  accounts.push({
    id: nextId,
    username,
    password,
    role: 'user',
    displayName: cleanDisplayName,
    email
  });
  saveAuthKey('accounts', accounts);

  const userField = document.getElementById('login-username');
  const passField = document.getElementById('login-password');
  if (userField) userField.value = username;
  if (passField) passField.value = password;

  document.getElementById('create-display-name').value = '';
  document.getElementById('create-username').value = '';
  document.getElementById('create-email').value = '';
  document.getElementById('create-password').value = '';
  document.getElementById('create-confirm-password').value = '';
  closeLoginActionDialog('create-account-dialog');
  setLoginMessage('✅ Account created. You can log in now.', false);
}

function submitForgotPasswordDialog(event) {
  event.preventDefault();

  const email = (document.getElementById('forgot-email').value || '').trim().toLowerCase();
  const phone = (document.getElementById('forgot-phone').value || '').trim();
  const normalizedPhone = normalizePhone(phone);
  const newPassword = document.getElementById('forgot-new-password').value || '';
  const confirmPassword = document.getElementById('forgot-confirm-password').value || '';

  setLoginActionMessage('forgot-password-error', '', true);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setLoginActionMessage('forgot-password-error', 'Please enter a valid email address.');
    return;
  }

  if (normalizedPhone.length < 7) {
    setLoginActionMessage('forgot-password-error', 'Please enter a valid phone number.');
    return;
  }

  const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
  const account = accounts.find(
    (a) => (a.email || '').toLowerCase() === email && normalizePhone(a.phone) === normalizedPhone
  );
  if (!account) {
    setLoginActionMessage('forgot-password-error', 'No account matched that email and phone number.');
    return;
  }

  if (newPassword.length < 6) {
    setLoginActionMessage('forgot-password-error', 'New password must be at least 6 characters.');
    return;
  }

  if (newPassword !== confirmPassword) {
    setLoginActionMessage('forgot-password-error', 'Password confirmation did not match.');
    return;
  }

  account.password = newPassword;
  saveAuthKey('accounts', accounts);

  const userField = document.getElementById('login-username');
  const passField = document.getElementById('login-password');
  if (userField) userField.value = account.username;
  if (passField) passField.value = '';

  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-phone').value = '';
  document.getElementById('forgot-new-password').value = '';
  document.getElementById('forgot-confirm-password').value = '';
  closeLoginActionDialog('forgot-password-dialog');
  setLoginMessage('✅ Password reset complete. Please log in.', false);
}

let loginTiltBound = false;

function bindLoginCardTilt() {
  if (loginTiltBound) return;

  const card = document.getElementById('login-card');
  if (!card) return;

  const resetTilt = () => {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.classList.remove('is-tilting');
  };

  const onMove = (event) => {
    if (card.classList.contains('shake')) return;

    const bounds = card.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width;
    const py = (event.clientY - bounds.top) / bounds.height;

    const rotateY = ((px - 0.5) * 14).toFixed(2);
    const rotateX = ((0.5 - py) * 12).toFixed(2);

    card.style.setProperty('--tilt-x', `${rotateX}deg`);
    card.style.setProperty('--tilt-y', `${rotateY}deg`);
    card.classList.add('is-tilting');
  };

  card.addEventListener('mousemove', onMove);
  card.addEventListener('mouseleave', resetTilt);
  card.addEventListener('blur', resetTilt, true);

  card.resetTilt = resetTilt;
  loginTiltBound = true;
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
  bindLoginCardTilt();
  setTimeout(() => document.getElementById('login-username').focus(), 100);
}

function hideLoginScreen() {
  document.querySelectorAll('.login-action-dialog.is-open').forEach((node) => {
    node.classList.remove('is-open');
    node.setAttribute('aria-hidden', 'true');
  });
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.remove('has-action-dialog');

  const card = document.getElementById('login-card');
  if (card && typeof card.resetTilt === 'function') card.resetTilt();
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
  const userName = session.displayName || session.username || 'Guest';
  const roleLabel = session.role === 'admin'
    ? '<span class="role-badge admin-badge">ADMIN</span>'
    : '';
    
  const themeOpts = [
    { id: 'light', name: 'Light' },
    { id: 'dark', name: 'Dark' },
    { id: 'ocean', name: 'Ocean Blue' },
    { id: 'forest', name: 'Forest Green' },
    { id: 'crimson', name: 'Crimson Red' },
    { id: 'amethyst', name: 'Amethyst Purple' },
    { id: 'sunset', name: 'Sunset Orange' },
    { id: 'teal', name: 'Teal Sky' },
    { id: 'rose', name: 'Rose Pink' },
    { id: 'aqua', name: 'Aqua Cyan' },
    { id: 'indigo', name: 'Midnight Indigo' },
    { id: 'lime', name: 'Lemon Lime' },
    { id: 'amber', name: 'Amber Glow' },
    { id: 'brown', name: 'Chocolate Brown' },
    { id: 'slate', name: 'Slate Grey' },
    { id: 'steel', name: 'Steel Blue' },
    { id: 'royal', name: 'Royal Purple' },
    { id: 'volcano', name: 'Volcano' },
    { id: 'sky', name: 'Sky Blue' },
    { id: 'mint', name: 'Mint Green' }
  ].map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  badge.innerHTML = `
    <span style="margin-right: 10px; font-weight: 600;">${userName}</span>
    ${roleLabel}
    <select id="theme-selector" class="no-print" onchange="changeTheme(this.value)" aria-label="Select App Theme" title="Select App Theme" style="margin-left: 10px; margin-right: 10px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color, #ccc); background: transparent; color: inherit; cursor: pointer; font-size: 13px;">
      ${themeOpts}
    </select>
    <button class="btn btn-sm btn-logout" onclick="doLogout()" style="display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c62828" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
      Logout
    </button>
  `;

  if (typeof applyTheme === 'function') {
    const mode = document.documentElement.getAttribute('data-theme') || 'light';
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
  const eyeIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path d="M12 5c5.3 0 9.3 4.2 10 6.8a1 1 0 0 1 0 .4C21.3 14.8 17.3 19 12 19S2.7 14.8 2 12.2a1 1 0 0 1 0-.4C2.7 9.2 6.7 5 12 5zm0 2c-3.9 0-7 2.9-7.9 5 .9 2.1 4 5 7.9 5s7-2.9 7.9-5c-.9-2.1-4-5-7.9-5zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>';
  const eyeOffIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path d="M3.3 4.7a1 1 0 1 1 1.4-1.4l14.6 14.6a1 1 0 1 1-1.4 1.4l-2.1-2.1A11.8 11.8 0 0 1 12 19C6.7 19 2.7 14.8 2 12.2a1 1 0 0 1 0-.4c.4-1.6 2.1-4.1 4.8-5.8L3.3 4.7zM8.5 7.4C6.4 8.7 5 10.6 4.1 12c.9 2.1 4 5 7.9 5 1.2 0 2.3-.3 3.4-.7l-2-2A3.5 3.5 0 0 1 9.7 10.6l-1.2-1.2zm10.7 4.6c-.9-2.1-4-5-7.9-5-.7 0-1.4.1-2 .2L7.8 5.7A11.6 11.6 0 0 1 12 5c5.3 0 9.3 4.2 10 6.8a1 1 0 0 1 0 .4 11.2 11.2 0 0 1-3.4 4.9l-1.4-1.4c.9-.9 1.6-2 2-2.7z"/></svg>';
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = eyeOffIcon;
    btn.setAttribute('aria-label', 'Hide password');
    btn.setAttribute('title', 'Hide password');
  } else {
    inp.type = 'password';
    btn.innerHTML = eyeIcon;
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('title', 'Show password');
  }
}

// Generic toggle for any password field with a toggle button
function togglePasswordVisibility(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp || !btn) return;
  const eyeIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" style="width:20px;height:20px;fill:currentColor;"><path d="M12 5c5.3 0 9.3 4.2 10 6.8a1 1 0 0 1 0 .4C21.3 14.8 17.3 19 12 19S2.7 14.8 2 12.2a1 1 0 0 1 0-.4C2.7 9.2 6.7 5 12 5zm0 2c-3.9 0-7 2.9-7.9 5 .9 2.1 4 5 7.9 5s7-2.9 7.9-5c-.9-2.1-4-5-7.9-5zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>';
  const eyeOffIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" style="width:20px;height:20px;fill:currentColor;"><path d="M3.3 4.7a1 1 0 1 1 1.4-1.4l14.6 14.6a1 1 0 1 1-1.4 1.4l-2.1-2.1A11.8 11.8 0 0 1 12 19C6.7 19 2.7 14.8 2 12.2a1 1 0 0 1 0-.4c.4-1.6 2.1-4.1 4.8-5.8L3.3 4.7zM8.5 7.4C6.4 8.7 5 10.6 4.1 12c.9 2.1 4 5 7.9 5 1.2 0 2.3-.3 3.4-.7l-2-2A3.5 3.5 0 0 1 9.7 10.6l-1.2-1.2zm10.7 4.6c-.9-2.1-4-5-7.9-5-.7 0-1.4.1-2 .2L7.8 5.7A11.6 11.6 0 0 1 12 5c5.3 0 9.3 4.2 10 6.8a1 1 0 0 1 0 .4 11.2 11.2 0 0 1-3.4 4.9l-1.4-1.4c.9-.9 1.6-2 2-2.7z"/></svg>';
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = eyeOffIcon;
    btn.setAttribute('aria-label', 'Hide password');
    btn.setAttribute('title', 'Hide password');
  } else {
    inp.type = 'password';
    btn.innerHTML = eyeIcon;
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('title', 'Show password');
  }
}
