/* =====================================================
   app.js — All application logic
   Office Supplies Inventory System

   Depends on: db.js (must be loaded first)
   ===================================================== */

/* ─────────────────────────────────────────────────────
   NAVIGATION — Switch between pages
   ───────────────────────────────────────────────────── */

const NAV_PAGES = ['dashboard', 'request', 'addstocks', 'chat', 'settings'];
const LAST_PAGE_KEY = 'lastPageByUser';

function normalizePageName(name) {
  return NAV_PAGES.includes(name) ? name : 'dashboard';
}

function getLastPageMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_PAGE_KEY) || '{}');
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

function saveLastVisitedPage(name) {
  const page = normalizePageName(name);
  const username = (typeof getCurrentUsernameOrGuest === 'function')
    ? getCurrentUsernameOrGuest()
    : '__guest__';
  const map = getLastPageMap();
  map[username] = page;
  localStorage.setItem(LAST_PAGE_KEY, JSON.stringify(map));
}

function getLastVisitedPage() {
  const username = (typeof getCurrentUsernameOrGuest === 'function')
    ? getCurrentUsernameOrGuest()
    : '__guest__';
  const page = getLastPageMap()[username];
  return normalizePageName(page);
}

function restoreLastVisitedPage() {
  showPage(getLastVisitedPage());
}

let settingsDeleteHandlerBound = false;

function themedDeleteConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const {
      title = 'Confirm Delete',
      confirmLabel = 'Delete',
      confirmButtonClass = 'btn-danger'
    } = options;

    const existing = document.getElementById('delete-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-overlay';
    overlay.className = 'delete-confirm-overlay show no-print';
    overlay.innerHTML = `
      <div class="delete-confirm-card" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-message">
        <h3 id="delete-confirm-title"></h3>
        <p id="delete-confirm-message"></p>
        <div class="delete-confirm-actions">
          <button type="button" id="delete-confirm-cancel" class="btn btn-outline btn-sm">Cancel</button>
          <button type="button" id="delete-confirm-ok" class="btn ${confirmButtonClass} btn-sm"></button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    const titleEl = overlay.querySelector('#delete-confirm-title');
    const messageEl = overlay.querySelector('#delete-confirm-message');
    const cancelBtn = overlay.querySelector('#delete-confirm-cancel');
    const okBtn = overlay.querySelector('#delete-confirm-ok');

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmLabel;

    let isClosed = false;

    const onEsc = (event) => {
      if (event.key === 'Escape') cleanup(false);
    };

    const cleanup = (result) => {
      if (isClosed) return;
      isClosed = true;

      document.removeEventListener('keydown', onEsc);
      document.body.classList.remove('modal-open');
      overlay.remove();
      resolve(result);
    };

    cancelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      cleanup(false);
    });

    okBtn.addEventListener('click', (event) => {
      event.preventDefault();
      cleanup(true);
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(false);
    });

    document.addEventListener('keydown', onEsc);

    setTimeout(() => okBtn.focus(), 0);
  });
}

function bindSettingsDeleteHandler() {
  if (settingsDeleteHandlerBound) return;
  settingsDeleteHandlerBound = true;

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-delete-kind][data-delete-id]');
    if (!btn) return;

    const kind = btn.getAttribute('data-delete-kind');
    const id = btn.getAttribute('data-delete-id');

    if (kind === 'dept') deleteDept(id);
    if (kind === 'emp') deleteEmp(id);
    if (kind === 'item') deleteItem(id);
  });
}

function showPage(name) {
  const currentPage = normalizePageName(name);

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show the target page
  document.getElementById('page-' + currentPage).classList.add('active');

  // Update active state in sidebar
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.remove('active'));
  const idx = NAV_PAGES.indexOf(currentPage);
  document.querySelectorAll('#sidebar nav a')[idx]?.classList.add('active');

  // Update the top bar title
  const titles = {
    dashboard: '📊 Inventory Dashboard',
    request:   '📤 Less / Request',
    addstocks: '📥 Add Stocks',
    chat:      '💬 Team Chat',
    settings:  '⚙️ Settings'
  };
  document.getElementById('topbar-title').textContent = titles[currentPage] || '';

  if (typeof getSession === 'function' && typeof updateTopbarUser === 'function') {
    const session = getSession();
    if (session) updateTopbarUser(session);
  }

  // Load data for the selected page
  if (currentPage === 'dashboard') { renderDashboard(); populateDashDeptFilter(); }
  if (currentPage === 'request')   { populateReqForm(); renderRequestHistory(); }
  if (currentPage === 'addstocks') { populateStockForm(); renderStockHistory(); }
  if (currentPage === 'settings')  { renderSettings(); }

  saveLastVisitedPage(currentPage);

  closeSidebar(); // auto-close on mobile
}

/* ── Mobile sidebar toggle ─────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

/* Theme Controller -------------------------------------------------------- */
let themeMediaListenerBound = false;

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function getCurrentUsernameOrGuest() {
  if (typeof getSession === 'function') {
    const session = getSession();
    if (session?.username) return session.username;
  }
  return '__guest__';
}

function getThemeMapFromSettings() {
  const settings = getSettings() || {};
  const map = settings.theme_by_user;
  if (map && typeof map === 'object' && !Array.isArray(map)) return map;
  return {};
}

function loadThemePreferenceForUser() {
  const username = getCurrentUsernameOrGuest();
  const saved = getThemeMapFromSettings()[username];
  if (saved === 'light' || saved === 'dark') return saved;

  const legacy = localStorage.getItem('theme');
  if (legacy === 'light' || legacy === 'dark') return legacy;

  const system = getSystemTheme();
  return system === 'dark' ? 'dark' : 'light';
}

function getAppliedTheme() {
  const rootTheme = document.documentElement.getAttribute('data-theme');
  if (rootTheme === 'light' || rootTheme === 'dark') return rootTheme;
  if (document.body.classList.contains('theme-dark')) return 'dark';
  return 'light';
}

function updateThemeToggleUI(mode) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;

  if (!btn.querySelector('.theme-icon-stack')) {
    btn.innerHTML = `
      <span class="theme-icon-stack" aria-hidden="true">
        <span class="theme-icon theme-icon-moon">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3c.17 0 .34.01.5.02A7 7 0 0 0 21 12.79z"></path></svg>
        </span>
        <span class="theme-icon theme-icon-sun">
          <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path></svg>
        </span>
      </span>
      <span class="theme-label"></span>
    `;
  }

  const next = mode === 'dark' ? 'light' : 'dark';
  const label = mode === 'dark' ? 'Light Mode' : 'Dark Mode';

  btn.classList.toggle('is-dark', mode === 'dark');
  const labelEl = btn.querySelector('.theme-label');
  if (labelEl) labelEl.textContent = label;

  btn.setAttribute('aria-pressed', String(mode === 'dark'));
  btn.setAttribute('aria-label', `Switch to ${next} mode`);
  btn.setAttribute('title', `Switch to ${next} mode`);
}

function applyTheme(mode) {
  const normalized = mode === 'dark' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', normalized);
  document.documentElement.style.colorScheme = normalized;

  document.body.classList.toggle('theme-dark', normalized === 'dark');
  document.body.classList.toggle('theme-light', normalized === 'light');
  document.body.setAttribute('data-theme', normalized);

  updateThemeToggleUI(normalized);
}

function saveThemePreferenceForUser(mode) {
  const normalized = mode === 'dark' ? 'dark' : 'light';
  const username = getCurrentUsernameOrGuest();
  const settings = getSettings() || {};
  const themeMap = (settings.theme_by_user && typeof settings.theme_by_user === 'object' && !Array.isArray(settings.theme_by_user))
    ? settings.theme_by_user
    : {};
  themeMap[username] = normalized;
  saveSettings({ theme_by_user: themeMap });
  localStorage.setItem('theme', normalized);
}

function toggleTheme() {
  const next = getAppliedTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveThemePreferenceForUser(next);
}

function refreshThemeForCurrentUser() {
  applyTheme(loadThemePreferenceForUser());
}

function hasSavedThemeForUser(username) {
  const saved = getThemeMapFromSettings()[username];
  return saved === 'light' || saved === 'dark';
}

function initThemeController() {
  refreshThemeForCurrentUser();

  if (!window.matchMedia || themeMediaListenerBound) return;
  themeMediaListenerBound = true;

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemThemeChange = (event) => {
    const username = getCurrentUsernameOrGuest();
    if (hasSavedThemeForUser(username)) return;
    applyTheme(event.matches ? 'dark' : 'light');
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onSystemThemeChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(onSystemThemeChange);
  }
}


/* ─────────────────────────────────────────────────────
   PAGE 1: INVENTORY DASHBOARD
   ───────────────────────────────────────────────────── */

// Populate Department filter dropdown
function populateDashDeptFilter() {
  const depts = getData('departments');
  const sel = document.getElementById('dash-dept');
  sel.innerHTML = '<option value="">All Departments</option>';
  depts.forEach(d => {
    sel.innerHTML += `<option value="${d.id}">${d.dept_name}</option>`;
  });
}

// Clear all dashboard filters
function clearDashFilters() {
  ['dash-search', 'dash-date-from', 'dash-date-to'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('dash-dept').value = '';
  document.getElementById('dash-status').value = '';
  renderDashboard();
}

// Main function: render the inventory table with current filters
function renderDashboard() {
  let items = getData('items');

  // Apply search filter
  const search = document.getElementById('dash-search').value.toLowerCase();
  if (search) items = items.filter(i => i.item_name.toLowerCase().includes(search));

  // Apply status filter
  const statusF = document.getElementById('dash-status').value;
  if (statusF === 'ok')  items = items.filter(i => i.balance >= 10);
  if (statusF === 'low') items = items.filter(i => i.balance > 0 && i.balance < 10);
  if (statusF === 'out') items = items.filter(i => i.balance === 0);

  // Sort alphabetically by item name
  items.sort((a, b) => a.item_name.localeCompare(b.item_name));

  // Build table rows
  const tbody = document.getElementById('dash-tbody');
  tbody.innerHTML = '';

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);">No items found.</td></tr>';
  } else {
    items.forEach((item, i) => {
      const status = item.balance >= 10 ? 'ok' : item.balance > 0 ? 'low' : 'out';
      const badge = status === 'ok'
        ? `<span class="badge badge-ok">OK</span>`
        : status === 'low'
        ? `<span class="badge badge-low">Low</span>`
        : `<span class="badge badge-out">Out</span>`;

      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${item.item_name}</td>
          <td>${item.unit || '—'}</td>
          <td>${item.category || '—'}</td>
          <td><strong>${item.balance}</strong></td>
          <td>${badge}</td>
          <td>${item.updated_at ? fmtDate(item.updated_at) : '—'}</td>
        </tr>`;
    });
  }

  // Update the stat summary boxes
  const all = getData('items');
  const outCount  = all.filter(i => i.balance === 0).length;
  const lowCount  = all.filter(i => i.balance > 0 && i.balance < 10).length;
  const okCount   = all.filter(i => i.balance >= 10).length;
  document.getElementById('stat-boxes').innerHTML = `
    <div class="stat-box ok">    <div class="val">${okCount}</div>  <div class="lbl">In Stock</div></div>
    <div class="stat-box warn">  <div class="val">${lowCount}</div> <div class="lbl">Low Stock</div></div>
    <div class="stat-box danger"><div class="val">${outCount}</div> <div class="lbl">Out of Stock</div></div>
    <div class="stat-box">       <div class="val">${all.length}</div><div class="lbl">Total Items</div></div>
  `;
}

// Print the dashboard filtered view
function printDashboard() {
  injectPrintHeader('print-header-dash');
  document.getElementById('print-header-dash').style.display = 'block';
  injectSignatories('print-sigs-dash');
  document.getElementById('print-sigs-dash').style.display = 'flex';
  window.print();
  // Hide print elements after printing
  setTimeout(() => {
    document.getElementById('print-header-dash').style.display = 'none';
    document.getElementById('print-sigs-dash').style.display = 'none';
  }, 1000);
}

// Generic print for Request and Stock sections
function printSection(areaId) {
  const sigMap = { 'req-print-area': 'print-sigs-req',   'stock-print-area': 'print-sigs-stock' };
  const hdrMap = { 'req-print-area': 'print-header-req', 'stock-print-area': 'print-header-stock' };

  const hdrId = hdrMap[areaId];
  const sigId = sigMap[areaId];

  if (hdrId) { injectPrintHeader(hdrId); document.getElementById(hdrId).style.display = 'block'; }
  if (sigId) { injectSignatories(sigId); document.getElementById(sigId).style.display = 'flex'; }

  // Temporarily rename section to 'print-area' so @media print targets it
  const area = document.getElementById(areaId);
  area.id = 'print-area';
  window.print();
  area.id = areaId;

  setTimeout(() => {
    if (hdrId) document.getElementById(hdrId).style.display = 'none';
    if (sigId) document.getElementById(sigId).style.display = 'none';
  }, 1000);
}

// Build and inject print header HTML from Settings
function injectPrintHeader(targetId) {
  const s = getSettings();
  document.getElementById(targetId).innerHTML = `
    <div style="font-size:11px;">${s.header_logo || ''}</div>
    <div style="font-size:18px;font-weight:700;">${s.header_company || 'Office Name'}</div>
    <div style="font-size:12px;">${s.header_address || ''}</div>
    <div style="font-size:14px;font-weight:600;margin-top:6px;">${s.header_subtitle || 'Inventory Report'}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px;">
      Date Printed: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}
    </div>
    <hr style="margin:10px 0;">
  `;
}

// Build and inject signatories HTML from Settings
function injectSignatories(targetId) {
  const s = getSettings();
  document.getElementById(targetId).innerHTML = `
    <div class="signatory">
      <div class="line">
        <div class="name">${s.sig1_name || 'Prepared By'}</div>
        <div class="pos">${s.sig1_pos || ''}</div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:var(--muted);">Prepared By</div>
    </div>
    <div class="signatory">
      <div class="line">
        <div class="name">${s.sig2_name || 'Checked By'}</div>
        <div class="pos">${s.sig2_pos || ''}</div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:var(--muted);">Checked By</div>
    </div>
    <div class="signatory">
      <div class="line">
        <div class="name">${s.sig3_name || 'Approved By'}</div>
        <div class="pos">${s.sig3_pos || ''}</div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:var(--muted);">Approved By</div>
    </div>
  `;
}


/* ─────────────────────────────────────────────────────
   PAGE 2: LESS / REQUEST (Items Out)
   ───────────────────────────────────────────────────── */

// Tracks how many item rows have been added to the request form
let requestItemCount = 0;

function populateReqForm() {
  // Default date to today
  document.getElementById('req-date').value = today();

  // Load employees and departments for dropdowns
  const emps  = getData('employees');
  const depts = getData('departments');

  // Populate the employee select
  const empSel = document.getElementById('req-emp');
  empSel.innerHTML = '<option value="">-- Select Employee --</option>';
  emps.sort((a, b) => a.full_name.localeCompare(b.full_name)).forEach(e => {
    const dept = depts.find(d => d.id === e.department_id);
    empSel.innerHTML += `<option value="${e.id}" data-dept="${dept?.dept_name || ''}">${e.full_name}</option>`;
  });

  // Populate the history filter employee dropdown
  const histSel = document.getElementById('req-hist-emp');
  histSel.innerHTML = '<option value="">All</option>';
  emps.forEach(e => {
    histSel.innerHTML += `<option value="${e.id}">${e.full_name}</option>`;
  });

  // Reset item rows and add one blank row
  requestItemCount = 0;
  document.getElementById('req-items-container').innerHTML = '';
  addRequestItem();
}

// Auto-fill Department field when an employee is selected
function autoFillDeptReq() {
  const sel = document.getElementById('req-emp');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('req-dept').value = opt.dataset.dept || '';
}

// Add a new item row to the request form
function addRequestItem() {
  requestItemCount++;
  const items = getData('items');
  const rowId = 'req-row-' + requestItemCount;

  // Build alphabetically sorted item options
  let opts = '<option value="">-- Select Item --</option>';
  items.sort((a, b) => a.item_name.localeCompare(b.item_name)).forEach(i => {
    opts += `<option value="${i.id}" data-bal="${i.balance}" data-unit="${i.unit || ''}">${i.item_name}</option>`;
  });

  const html = `
    <div class="item-row" id="${rowId}">
      <div class="form-group" style="min-width:200px;">
        <label>Item</label>
        <select onchange="onRequestItemChange(this, '${rowId}')">${opts}</select>
        <div class="balance-hint" id="hint-${rowId}"></div>
      </div>
      <div class="form-group" style="max-width:100px;">
        <label>Qty</label>
        <input type="number" id="qty-${rowId}" min="1" placeholder="0">
      </div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${rowId}').remove()">✕</button>
    </div>`;

  document.getElementById('req-items-container').insertAdjacentHTML('beforeend', html);
}

// Show live balance hint when an item is chosen in the request form
function onRequestItemChange(sel, rowId) {
  const opt = sel.options[sel.selectedIndex];
  const bal = parseInt(opt.dataset.bal) || 0;
  const unit = opt.dataset.unit || '';
  const hint = document.getElementById('hint-' + rowId);
  hint.textContent = opt.value ? `Available: ${bal} ${unit}` : '';
  hint.style.color = bal > 0 ? 'var(--success)' : 'var(--danger)';
}

// Submit the request: validate quantities and deduct from stock
function submitRequest() {
  if (!requireAdmin()) return; // USER role cannot submit requests
  const alertEl = document.getElementById('req-alert');
  alertEl.innerHTML = '';

  const empSel = document.getElementById('req-emp');
  const empId  = parseInt(empSel.value);
  const dept   = document.getElementById('req-dept').value;
  const date   = document.getElementById('req-date').value;
  const remarks = document.getElementById('req-remarks').value;

  // Basic validation
  if (!empId || !date) {
    alertEl.innerHTML = `<div class="alert alert-error">Please select an Employee and Date.</div>`;
    return;
  }

  // Gather all item rows
  const rows = document.querySelectorAll('#req-items-container .item-row');
  const entries = [];
  let hasError = false;

  rows.forEach(row => {
    const sel = row.querySelector('select');
    const qtyInput = row.querySelector('input[type=number]');
    const itemId = parseInt(sel.value);
    const qty    = parseInt(qtyInput.value) || 0;
    if (!itemId || !qty) return; // skip empty rows

    const opt = sel.options[sel.selectedIndex];
    const balance = parseInt(opt.dataset.bal) || 0;

    // Validate: requested qty must not exceed available balance
    if (qty > balance) {
      alertEl.innerHTML = `<div class="alert alert-error">
        ❌ <strong>${opt.textContent}</strong>: Requested (${qty}) exceeds available balance (${balance}).
      </div>`;
      hasError = true;
    }
    entries.push({ itemId, qty, itemName: opt.textContent, balance });
  });

  if (hasError) return;
  if (!entries.length) {
    alertEl.innerHTML = `<div class="alert alert-error">Please add at least one item.</div>`;
    return;
  }

  // All good — deduct balances and save transaction records
  const items = getData('items');
  const transactions = getData('transactions');
  const emps  = getData('employees');
  const depts = getData('departments');
  const emp   = emps.find(e => e.id === empId);
  const deptObj = depts.find(d => d.id === emp?.department_id);

  entries.forEach(entry => {
    // Deduct from item balance
    const idx = items.findIndex(i => i.id === entry.itemId);
    if (idx !== -1) {
      items[idx].balance -= entry.qty;
      items[idx].updated_at = today();
    }
    // Save transaction record (OUT)
    transactions.push({
      id: newId(transactions),
      txn_date: date,
      txn_type: 'OUT',
      item_id: entry.itemId,
      item_name: entry.itemName,
      quantity: entry.qty,
      employee_id: empId,
      employee_name: emp?.full_name || '—',
      department_id: emp?.department_id || null,
      department_name: deptObj?.dept_name || dept,
      remarks
    });
  });

  setData('items', items);
  setData('transactions', transactions);

  alertEl.innerHTML = `<div class="alert alert-success">✅ Request submitted successfully!</div>`;

  // Reset form
  document.getElementById('req-emp').value = '';
  document.getElementById('req-dept').value = '';
  document.getElementById('req-remarks').value = '';
  requestItemCount = 0;
  document.getElementById('req-items-container').innerHTML = '';
  addRequestItem();
  renderRequestHistory();
}

// Render the recent requests table with optional filters
function renderRequestHistory() {
  let txns = getData('transactions').filter(t => t.txn_type === 'OUT');

  const empFilter = document.getElementById('req-hist-emp').value;
  const from = document.getElementById('req-hist-from').value;
  const to   = document.getElementById('req-hist-to').value;

  if (empFilter) txns = txns.filter(t => t.employee_id == empFilter);
  if (from) txns = txns.filter(t => t.txn_date >= from);
  if (to)   txns = txns.filter(t => t.txn_date <= to);

  // Newest first
  txns.sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  const tbody = document.getElementById('req-hist-tbody');
  tbody.innerHTML = '';

  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);">No records found.</td></tr>';
  } else {
    txns.forEach(t => {
      tbody.innerHTML += `
        <tr>
          <td>${fmtDate(t.txn_date)}</td>
          <td>${t.employee_name}</td>
          <td>${t.department_name}</td>
          <td>${t.item_name}</td>
          <td>${t.quantity}</td>
          <td>${t.remarks || '—'}</td>
        </tr>`;
    });
  }
}


/* ─────────────────────────────────────────────────────
   PAGE 3: ADD STOCKS (Items In)
   ───────────────────────────────────────────────────── */

function populateStockForm() {
  document.getElementById('stock-date').value = today();

  const items = getData('items');
  const emps  = getData('employees');
  const depts = getData('departments');

  // Populate item dropdown (alphabetical)
  const itemSel = document.getElementById('stock-item');
  itemSel.innerHTML = '<option value="">-- Select Item --</option>';
  items.sort((a, b) => a.item_name.localeCompare(b.item_name)).forEach(i => {
    itemSel.innerHTML += `<option value="${i.id}" data-bal="${i.balance}">${i.item_name}</option>`;
  });

  // Populate employee dropdown
  const empSel = document.getElementById('stock-emp');
  empSel.innerHTML = '<option value="">-- Optional --</option>';
  emps.sort((a, b) => a.full_name.localeCompare(b.full_name)).forEach(e => {
    const dept = depts.find(d => d.id === e.department_id);
    empSel.innerHTML += `<option value="${e.id}" data-dept="${dept?.dept_name || ''}">${e.full_name}</option>`;
  });

  // Populate history item filter
  const histItemSel = document.getElementById('stock-hist-item');
  histItemSel.innerHTML = '<option value="">All Items</option>';
  items.forEach(i => {
    histItemSel.innerHTML += `<option value="${i.id}">${i.item_name}</option>`;
  });
}

// Show current balance when an item is selected in Add Stocks
function showStockBalance() {
  const sel = document.getElementById('stock-item');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('stock-current').value = opt.value ? opt.dataset.bal : '';
}

// Auto-fill Department when employee is selected in Add Stocks
function autoFillDeptStock() {
  const sel = document.getElementById('stock-emp');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('stock-dept').value = opt.dataset.dept || '';
}

// Submit the stock addition form
function submitStock() {
  if (!requireAdmin()) return; // USER role cannot add stock
  const alertEl = document.getElementById('stock-alert');
  alertEl.innerHTML = '';

  const date    = document.getElementById('stock-date').value;
  const itemId  = parseInt(document.getElementById('stock-item').value);
  const qty     = parseInt(document.getElementById('stock-qty').value) || 0;
  const empSel  = document.getElementById('stock-emp');
  const empId   = parseInt(empSel.value) || null;
  const empName = empSel.options[empSel.selectedIndex].textContent;
  const dept    = document.getElementById('stock-dept').value;
  const remarks = document.getElementById('stock-remarks').value;

  // Validation
  if (!date || !itemId || qty < 1) {
    alertEl.innerHTML = `<div class="alert alert-error">Please fill in Date, Item, and a valid Quantity.</div>`;
    return;
  }

  // Add to item balance
  const items = getData('items');
  const transactions = getData('transactions');
  const idx = items.findIndex(i => i.id === itemId);
  const itemName = items[idx]?.item_name || '—';
  items[idx].balance += qty;
  items[idx].updated_at = today();

  // Save transaction record (IN)
  transactions.push({
    id: newId(transactions),
    txn_date: date,
    txn_type: 'IN',
    item_id: itemId,
    item_name: itemName,
    quantity: qty,
    employee_id: empId,
    employee_name: empId ? empName : '—',
    department_name: dept || '—',
    remarks
  });

  setData('items', items);
  setData('transactions', transactions);

  alertEl.innerHTML = `<div class="alert alert-success">✅ Stock added! New balance: <strong>${items[idx].balance}</strong></div>`;

  // Reset form fields
  document.getElementById('stock-qty').value = '';
  document.getElementById('stock-remarks').value = '';
  document.getElementById('stock-current').value = '';
  document.getElementById('stock-item').value = '';
  renderStockHistory();
  populateStockForm();
}

// Render the Stock-In history table with optional filters
function renderStockHistory() {
  let txns = getData('transactions').filter(t => t.txn_type === 'IN');

  const itemFilter = document.getElementById('stock-hist-item').value;
  const from = document.getElementById('stock-hist-from').value;
  const to   = document.getElementById('stock-hist-to').value;

  if (itemFilter) txns = txns.filter(t => t.item_id == itemFilter);
  if (from) txns = txns.filter(t => t.txn_date >= from);
  if (to)   txns = txns.filter(t => t.txn_date <= to);

  txns.sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  const tbody = document.getElementById('stock-hist-tbody');
  tbody.innerHTML = '';

  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);">No records found.</td></tr>';
  } else {
    txns.forEach(t => {
      tbody.innerHTML += `
        <tr>
          <td>${fmtDate(t.txn_date)}</td>
          <td>${t.item_name}</td>
          <td><strong>+${t.quantity}</strong></td>
          <td>${t.employee_name}</td>
          <td>${t.department_name}</td>
          <td>${t.remarks || '—'}</td>
        </tr>`;
    });
  }
}


/* ─────────────────────────────────────────────────────
   PAGE 4: SETTINGS
   ───────────────────────────────────────────────────── */

function renderSettings() {
  renderDepts();
  renderEmps();
  renderItems();
  loadHeaderForm();
  loadSigForm();
  if (typeof populateAdminResetDropdown === 'function') populateAdminResetDropdown();
}

function sameId(a, b) {
  return String(a) === String(b);
}

/* ── Departments ──────────────────────────────────── */

function renderDepts() {
  const depts = getData('departments');
  const tbody = document.getElementById('dept-tbody');
  tbody.innerHTML = '';
  depts.forEach((d, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${d.dept_name}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='editDept(${JSON.stringify(d.id)})'>✏️ Edit</button>
          <button class="btn btn-danger btn-sm" data-delete-kind="dept" data-delete-id="${String(d.id)}">🗑️</button>
        </td>
      </tr>`;
  });

  // Also refresh the employee-dept dropdown
  const sel = document.getElementById('emp-dept');
  sel.innerHTML = '<option value="">-- Select --</option>';
  depts.forEach(d => { sel.innerHTML += `<option value="${d.id}">${d.dept_name}</option>`; });
}

function saveDept() {
  if (!requireAdmin()) return;
  const name   = document.getElementById('dept-name').value.trim();
  const editIdRaw = document.getElementById('dept-edit-id').value;
  const editId = editIdRaw === '' ? null : editIdRaw;
  if (!name) return alert('Please enter a department name.');
  const depts = getData('departments');
  if (editId) {
    const idx = depts.findIndex(d => sameId(d.id, editId));
    if (idx !== -1) depts[idx].dept_name = name;
  } else {
    depts.push({ id: newId(depts), dept_name: name });
  }
  setData('departments', depts);
  document.getElementById('dept-name').value = '';
  document.getElementById('dept-edit-id').value = '';
  renderDepts();
}

function editDept(id) {
  const dept = getData('departments').find(d => sameId(d.id, id));
  if (!dept) return;
  document.getElementById('dept-name').value = dept.dept_name;
  document.getElementById('dept-edit-id').value = String(dept.id);
}

function cancelDeptEdit() {
  document.getElementById('dept-name').value = '';
  document.getElementById('dept-edit-id').value = '';
}

async function deleteDept(id) {
  if (!requireAdmin()) return;
  const ok = await themedDeleteConfirm('Delete this department?');
  if (!ok) return;
  setData('departments', getData('departments').filter(d => !sameId(d.id, id)));
  renderDepts();
  renderEmps();
}

/* ── Employees ────────────────────────────────────── */

function renderEmps() {
  const emps  = getData('employees');
  const depts = getData('departments');
  const tbody = document.getElementById('emp-tbody');
  tbody.innerHTML = '';
  emps.sort((a, b) => a.full_name.localeCompare(b.full_name)).forEach((e, i) => {
    const dept = depts.find(d => d.id === e.department_id);
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${e.full_name}</td>
        <td>${dept?.dept_name || '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='editEmp(${JSON.stringify(e.id)})'>✏️ Edit</button>
          <button class="btn btn-danger btn-sm" data-delete-kind="emp" data-delete-id="${String(e.id)}">🗑️</button>
        </td>
      </tr>`;
  });
}

function saveEmp() {
  if (!requireAdmin()) return;
  const name   = document.getElementById('emp-name').value.trim();
  const deptId = parseInt(document.getElementById('emp-dept').value) || null;
  const editIdRaw = document.getElementById('emp-edit-id').value;
  const editId = editIdRaw === '' ? null : editIdRaw;
  if (!name) return alert('Please enter an employee name.');
  const emps = getData('employees');
  if (editId) {
    const idx = emps.findIndex(e => sameId(e.id, editId));
    if (idx !== -1) { emps[idx].full_name = name; emps[idx].department_id = deptId; }
  } else {
    emps.push({ id: newId(emps), full_name: name, department_id: deptId });
  }
  setData('employees', emps);
  cancelEmpEdit();
  renderEmps();
}

function editEmp(id) {
  const emp = getData('employees').find(e => sameId(e.id, id));
  if (!emp) return;
  document.getElementById('emp-name').value = emp.full_name;
  document.getElementById('emp-dept').value = emp.department_id || '';
  document.getElementById('emp-edit-id').value = String(emp.id);
}

function cancelEmpEdit() {
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-dept').value = '';
  document.getElementById('emp-edit-id').value = '';
}

async function deleteEmp(id) {
  if (!requireAdmin()) return;
  const ok = await themedDeleteConfirm('Delete this employee?');
  if (!ok) return;
  setData('employees', getData('employees').filter(e => !sameId(e.id, id)));
  renderEmps();
}

/* ── Items / Supplies ─────────────────────────────── */

let adjustItemId = null; // tracks which item is being adjusted

function renderItems() {
  const items = getData('items');
  const tbody = document.getElementById('item-tbody');
  tbody.innerHTML = '';

  items.sort((a, b) => a.item_name.localeCompare(b.item_name)).forEach((item, i) => {
    const badge = item.balance >= 10
      ? `<span class="badge badge-ok">OK</span>`
      : item.balance > 0
      ? `<span class="badge badge-low">Low</span>`
      : `<span class="badge badge-out">Out</span>`;

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${item.item_name}</td>
        <td>${item.unit || '—'}</td>
        <td>${item.category || '—'}</td>
        <td>${item.balance} ${badge}</td>
        <td>${item.updated_at ? fmtDate(item.updated_at) : '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='editItem(${JSON.stringify(item.id)})'>✏️ Edit</button>
          <button class="btn btn-warning btn-sm" onclick='openAdjust(${JSON.stringify(item.id)})'>⚖️ Adjust</button>
          <button class="btn btn-danger btn-sm" data-delete-kind="item" data-delete-id="${String(item.id)}">🗑️</button>
        </td>
      </tr>`;
  });
}

function saveItem() {
  if (!requireAdmin()) return;
  const name    = document.getElementById('item-name').value.trim();
  const unit    = document.getElementById('item-unit').value.trim();
  const cat     = document.getElementById('item-cat').value.trim();
  const balance = parseInt(document.getElementById('item-balance').value) || 0;
  const editIdRaw = document.getElementById('item-edit-id').value;
  const editId = editIdRaw === '' ? null : editIdRaw;
  if (!name) return alert('Item name is required.');

  const items = getData('items');
  if (editId) {
    const idx = items.findIndex(i => sameId(i.id, editId));
    if (idx !== -1) {
      items[idx].item_name  = name;
      items[idx].unit       = unit;
      items[idx].category   = cat;
      items[idx].updated_at = today();
    }
  } else {
    items.push({ id: newId(items), item_name: name, unit, category: cat, balance, updated_at: today() });
  }
  setData('items', items);
  cancelItemEdit();
  renderItems();
}

function editItem(id) {
  const item = getData('items').find(i => sameId(i.id, id));
  if (!item) return;
  document.getElementById('item-name').value    = item.item_name;
  document.getElementById('item-unit').value    = item.unit || '';
  document.getElementById('item-cat').value     = item.category || '';
  document.getElementById('item-balance').value = item.balance;
  document.getElementById('item-edit-id').value = String(item.id);
}

function cancelItemEdit() {
  ['item-name', 'item-unit', 'item-cat', 'item-balance'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('item-edit-id').value = '';
}

function openAdjust(id) {
  const item = getData('items').find(i => sameId(i.id, id));
  if (!item) return;
  adjustItemId = item.id;
  document.getElementById('item-adjust-name').textContent = item.item_name;
  document.getElementById('item-adj-balance').value = item.balance;
  document.getElementById('item-adj-reason').value  = '';
  document.getElementById('item-adjust-box').style.display = 'block';
}

function applyAdjust() {
  if (!requireAdmin()) return;
  const newBal = parseInt(document.getElementById('item-adj-balance').value);
  const reason = document.getElementById('item-adj-reason').value.trim() || 'Manual adjustment';
  if (isNaN(newBal) || newBal < 0) return alert('Please enter a valid balance.');

  const items = getData('items');
  const idx   = items.findIndex(i => sameId(i.id, adjustItemId));
  if (idx !== -1) { items[idx].balance = newBal; items[idx].updated_at = today(); }
  setData('items', items);

  // Log the adjustment as a transaction (ADJ type)
  const txns = getData('transactions');
  txns.push({
    id: newId(txns),
    txn_date: today(),
    txn_type: 'ADJ',
    item_id: adjustItemId,
    item_name: items[idx]?.item_name,
    quantity: newBal,
    remarks: reason
  });
  setData('transactions', txns);

  cancelAdjust();
  renderItems();
  alert('Balance adjusted successfully.');
}

function cancelAdjust() {
  adjustItemId = null;
  document.getElementById('item-adjust-box').style.display = 'none';
}

async function deleteItem(id) {
  if (!requireAdmin()) return;
  const ok = await themedDeleteConfirm('Delete this item? Transaction history will NOT be deleted.');
  if (!ok) return;
  setData('items', getData('items').filter(i => !sameId(i.id, id)));
  renderItems();
}

/* ── Report Header ────────────────────────────────── */

function loadHeaderForm() {
  const s = getSettings();
  ['company', 'address', 'subtitle', 'logo'].forEach(k => {
    const el = document.getElementById('hdr-' + k);
    if (el) el.value = s['header_' + k] || '';
  });
}

function saveHeader() {
  saveSettings({
    header_company:  document.getElementById('hdr-company').value.trim(),
    header_address:  document.getElementById('hdr-address').value.trim(),
    header_subtitle: document.getElementById('hdr-subtitle').value.trim(),
    header_logo:     document.getElementById('hdr-logo').value.trim(),
  });
  alert('Header saved!');
}

/* ── Signatories ──────────────────────────────────── */

function loadSigForm() {
  const s = getSettings();
  for (let n = 1; n <= 3; n++) {
    document.getElementById(`sig${n}-name`).value = s[`sig${n}_name`] || '';
    document.getElementById(`sig${n}-pos`).value  = s[`sig${n}_pos`]  || '';
  }
}

function saveSignatories() {
  const obj = {};
  for (let n = 1; n <= 3; n++) {
    obj[`sig${n}_name`] = document.getElementById(`sig${n}-name`).value.trim();
    obj[`sig${n}_pos`]  = document.getElementById(`sig${n}-pos`).value.trim();
  }
  saveSettings(obj);
  alert('Signatories saved!');
}


/* ─────────────────────────────────────────────────────
   BOOTSTRAP — Run on page load
   ───────────────────────────────────────────────────── */
initAccounts();        // seed default login accounts (defined in auth.js)
initSeedData();        // seed default inventory data (defined in db.js)
initThemeController(); // apply saved/system theme and setup theme listener
bindSettingsDeleteHandler(); // ensure all trash buttons work via delegated click handling
checkAuth();           // show login screen if not logged in (defined in auth.js)
