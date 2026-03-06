/* =====================================================
   app.js — All application logic
   Office Supplies Inventory System

   Depends on: db.js (must be loaded first)
   ===================================================== */

/* ─────────────────────────────────────────────────────
   NAVIGATION — Switch between pages
   ───────────────────────────────────────────────────── */

function showPage(name) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show the target page
  document.getElementById('page-' + name).classList.add('active');

  // Update active state in sidebar
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.remove('active'));
  const order = ['dashboard', 'request', 'addstocks', 'settings'];
  const idx = order.indexOf(name);
  document.querySelectorAll('#sidebar nav a')[idx]?.classList.add('active');

  // Update the top bar title
  const titles = {
    dashboard: '📊 Inventory Dashboard',
    request:   '📤 Less / Request',
    addstocks: '📥 Add Stocks',
    settings:  '⚙️ Settings'
  };
  document.getElementById('topbar-title').textContent = titles[name] || '';

  // Load data for the selected page
  if (name === 'dashboard') { renderDashboard(); populateDashDeptFilter(); }
  if (name === 'request')   { populateReqForm(); renderRequestHistory(); }
  if (name === 'addstocks') { populateStockForm(); renderStockHistory(); }
  if (name === 'settings')  { renderSettings(); }

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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">No items found.</td></tr>';
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
    <div style="font-size:11px;color:#555;margin-top:2px;">
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
      <div style="margin-top:4px;font-size:11px;color:#888;">Prepared By</div>
    </div>
    <div class="signatory">
      <div class="line">
        <div class="name">${s.sig2_name || 'Checked By'}</div>
        <div class="pos">${s.sig2_pos || ''}</div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:#888;">Checked By</div>
    </div>
    <div class="signatory">
      <div class="line">
        <div class="name">${s.sig3_name || 'Approved By'}</div>
        <div class="pos">${s.sig3_pos || ''}</div>
      </div>
      <div style="margin-top:4px;font-size:11px;color:#888;">Approved By</div>
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No records found.</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No records found.</td></tr>';
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
          <button class="btn btn-outline btn-sm" onclick="editDept(${d.id})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.id})">🗑️</button>
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
  const editId = parseInt(document.getElementById('dept-edit-id').value) || null;
  if (!name) return alert('Please enter a department name.');
  const depts = getData('departments');
  if (editId) {
    const idx = depts.findIndex(d => d.id === editId);
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
  const dept = getData('departments').find(d => d.id === id);
  if (!dept) return;
  document.getElementById('dept-name').value = dept.dept_name;
  document.getElementById('dept-edit-id').value = id;
}

function cancelDeptEdit() {
  document.getElementById('dept-name').value = '';
  document.getElementById('dept-edit-id').value = '';
}

function deleteDept(id) {
  if (!requireAdmin()) return;
  if (!confirm('Delete this department?')) return;
  setData('departments', getData('departments').filter(d => d.id !== id));
  renderDepts();
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
          <button class="btn btn-outline btn-sm" onclick="editEmp(${e.id})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEmp(${e.id})">🗑️</button>
        </td>
      </tr>`;
  });
}

function saveEmp() {
  if (!requireAdmin()) return;
  const name   = document.getElementById('emp-name').value.trim();
  const deptId = parseInt(document.getElementById('emp-dept').value) || null;
  const editId = parseInt(document.getElementById('emp-edit-id').value) || null;
  if (!name) return alert('Please enter an employee name.');
  const emps = getData('employees');
  if (editId) {
    const idx = emps.findIndex(e => e.id === editId);
    if (idx !== -1) { emps[idx].full_name = name; emps[idx].department_id = deptId; }
  } else {
    emps.push({ id: newId(emps), full_name: name, department_id: deptId });
  }
  setData('employees', emps);
  cancelEmpEdit();
  renderEmps();
}

function editEmp(id) {
  const emp = getData('employees').find(e => e.id === id);
  if (!emp) return;
  document.getElementById('emp-name').value = emp.full_name;
  document.getElementById('emp-dept').value = emp.department_id || '';
  document.getElementById('emp-edit-id').value = id;
}

function cancelEmpEdit() {
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-dept').value = '';
  document.getElementById('emp-edit-id').value = '';
}

function deleteEmp(id) {
  if (!requireAdmin()) return;
  if (!confirm('Delete this employee?')) return;
  setData('employees', getData('employees').filter(e => e.id !== id));
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
          <button class="btn btn-outline btn-sm" onclick="editItem(${item.id})">✏️ Edit</button>
          <button class="btn btn-sm" style="background:#fb8c00;color:#fff;" onclick="openAdjust(${item.id})">⚖️ Adjust</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem(${item.id})">🗑️</button>
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
  const editId  = parseInt(document.getElementById('item-edit-id').value) || null;
  if (!name) return alert('Item name is required.');

  const items = getData('items');
  if (editId) {
    const idx = items.findIndex(i => i.id === editId);
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
  const item = getData('items').find(i => i.id === id);
  if (!item) return;
  document.getElementById('item-name').value    = item.item_name;
  document.getElementById('item-unit').value    = item.unit || '';
  document.getElementById('item-cat').value     = item.category || '';
  document.getElementById('item-balance').value = item.balance;
  document.getElementById('item-edit-id').value = id;
}

function cancelItemEdit() {
  ['item-name', 'item-unit', 'item-cat', 'item-balance'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('item-edit-id').value = '';
}

function openAdjust(id) {
  const item = getData('items').find(i => i.id === id);
  if (!item) return;
  adjustItemId = id;
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
  const idx   = items.findIndex(i => i.id === adjustItemId);
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

function deleteItem(id) {
  if (!requireAdmin()) return;
  if (!confirm('Delete this item? Transaction history will NOT be deleted.')) return;
  setData('items', getData('items').filter(i => i.id !== id));
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
checkAuth();           // show login screen if not logged in (defined in auth.js)
renderDashboard();     // show the dashboard table
populateDashDeptFilter(); // fill department filter dropdown
