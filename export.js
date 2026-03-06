/* =====================================================
   export.js — Excel Export for Office Supplies Inventory
   Uses SheetJS (xlsx) loaded via CDN in index.html

   EXPORTS AVAILABLE:
   1. exportInventory()     — Current filtered inventory list
   2. exportRequests()      — Filtered request / items-out history
   3. exportStockIn()       — Filtered stock-in history
   4. exportAllData()       — Full workbook: all sheets in one file
   ===================================================== */


/* ─────────────────────────────────────────────────────
   SHARED HELPER — Style a header row in a worksheet
   SheetJS doesn't natively support cell styles in the
   free version, so we use column widths + a bold trick
   via the !cols and !rows worksheet properties.
   ───────────────────────────────────────────────────── */

// Auto-fit column widths based on the longest value in each column
function autoWidth(data) {
  if (!data.length) return [];
  const keys = Object.keys(data[0]);
  return keys.map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 4, 50) }; // cap at 50 chars wide
  });
}

// Build a report info block (2 rows) to prepend above the table
function buildReportHeader(title) {
  const s = getSettings();
  return [
    { A: s.header_logo || '', B: '', C: '', D: '', E: '', F: '', G: '' },
    { A: s.header_company || 'Office Supplies Inventory', B: '', C: '', D: '', E: '', F: '', G: '' },
    { A: s.header_address || '', B: '', C: '', D: '', E: '', F: '', G: '' },
    { A: title, B: '', C: '', D: '', E: '', F: '', G: '' },
    { A: `Date Exported: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`, B: '', C: '', D: '', E: '', F: '', G: '' },
    { A: '', B: '', C: '', D: '', E: '', F: '', G: '' }, // blank spacer row
  ];
}

// Append signatory rows at the bottom of a data array
function buildSignatories() {
  const s = getSettings();
  return [
    { A: '', B: '', C: '', D: '', E: '', F: '', G: '' },
    { A: '___________________________', B: '', C: '___________________________', D: '', E: '___________________________', F: '', G: '' },
    { A: s.sig1_name || 'Prepared By',  B: '', C: s.sig2_name || 'Checked By',  D: '', E: s.sig3_name || 'Approved By',  F: '', G: '' },
    { A: s.sig1_pos  || '',             B: '', C: s.sig2_pos  || '',             D: '', E: s.sig3_pos  || '',             F: '', G: '' },
    { A: 'Prepared By',                 B: '', C: 'Checked By',                 D: '', E: 'Approved By',                 F: '', G: '' },
  ];
}

/* ─────────────────────────────────────────────────────
   HELPER — Download a workbook as .xlsx file
   ───────────────────────────────────────────────────── */
function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}

/* ─────────────────────────────────────────────────────
   1. EXPORT INVENTORY DASHBOARD
      Exports the CURRENTLY FILTERED inventory table
   ───────────────────────────────────────────────────── */
function exportInventory() {
  // Re-apply current filters to get exactly what's on screen
  let items = getData('items');

  const search  = document.getElementById('dash-search').value.toLowerCase();
  const statusF = document.getElementById('dash-status').value;

  if (search)           items = items.filter(i => i.item_name.toLowerCase().includes(search));
  if (statusF === 'ok')  items = items.filter(i => i.balance >= 10);
  if (statusF === 'low') items = items.filter(i => i.balance > 0 && i.balance < 10);
  if (statusF === 'out') items = items.filter(i => i.balance === 0);

  items.sort((a, b) => a.item_name.localeCompare(b.item_name));

  if (!items.length) {
    alert('No items to export. Try clearing your filters.');
    return;
  }

  // Map to clean row objects for Excel
  const rows = items.map((item, i) => ({
    '#':            i + 1,
    'Item Name':    item.item_name,
    'Unit':         item.unit      || '—',
    'Category':     item.category  || '—',
    'Balance':      item.balance,
    'Status':       item.balance >= 10 ? 'OK' : item.balance > 0 ? 'Low' : 'Out of Stock',
    'Last Updated': item.updated_at ? fmtDate(item.updated_at) : '—',
  }));

  // Build worksheet: header block + data rows + signatories
  const headerRows  = buildReportHeader('INVENTORY REPORT');
  const sigRows     = buildSignatories();

  // Convert report header to same shape as data rows
  const headerAsRows = headerRows.map(r => ({
    '#': r.A, 'Item Name': r.B, 'Unit': r.C,
    'Category': r.D, 'Balance': r.E, 'Status': r.F, 'Last Updated': r.G
  }));
  const sigAsRows = sigRows.map(r => ({
    '#': r.A, 'Item Name': r.B, 'Unit': r.C,
    'Category': r.D, 'Balance': r.E, 'Status': r.F, 'Last Updated': r.G
  }));

  const ws = XLSX.utils.json_to_sheet(headerAsRows, { skipHeader: true });
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });              // append data
  XLSX.utils.sheet_add_json(ws, sigAsRows, { origin: -1, skipHeader: true }); // append sigs

  ws['!cols'] = autoWidth(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

  const date = new Date().toISOString().split('T')[0];
  downloadWorkbook(wb, `Inventory_Report_${date}.xlsx`);

  showExportToast('✅ Inventory exported!');
}


/* ─────────────────────────────────────────────────────
   2. EXPORT REQUEST HISTORY (Items Out)
      Exports the CURRENTLY FILTERED request history
   ───────────────────────────────────────────────────── */
function exportRequests() {
  let txns = getData('transactions').filter(t => t.txn_type === 'OUT');

  const empFilter = document.getElementById('req-hist-emp').value;
  const from      = document.getElementById('req-hist-from').value;
  const to        = document.getElementById('req-hist-to').value;

  if (empFilter) txns = txns.filter(t => t.employee_id == empFilter);
  if (from)      txns = txns.filter(t => t.txn_date >= from);
  if (to)        txns = txns.filter(t => t.txn_date <= to);

  txns.sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  if (!txns.length) {
    alert('No request records to export.');
    return;
  }

  const rows = txns.map((t, i) => ({
    '#':           i + 1,
    'Date':        fmtDate(t.txn_date),
    'Employee':    t.employee_name   || '—',
    'Department':  t.department_name || '—',
    'Item':        t.item_name       || '—',
    'Qty Issued':  t.quantity,
    'Remarks':     t.remarks         || '—',
  }));

  const headerRows = buildReportHeader('REQUEST / ISSUANCE REPORT');
  const sigRows    = buildSignatories();

  const shape = r => ({
    '#': r.A, 'Date': r.B, 'Employee': r.C,
    'Department': r.D, 'Item': r.E, 'Qty Issued': r.F, 'Remarks': r.G
  });

  const ws = XLSX.utils.json_to_sheet(headerRows.map(shape), { skipHeader: true });
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });
  XLSX.utils.sheet_add_json(ws, sigRows.map(shape), { origin: -1, skipHeader: true });

  ws['!cols'] = autoWidth(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Requests');

  const date = new Date().toISOString().split('T')[0];
  downloadWorkbook(wb, `Request_Report_${date}.xlsx`);

  showExportToast('✅ Request history exported!');
}


/* ─────────────────────────────────────────────────────
   3. EXPORT STOCK-IN HISTORY
      Exports the CURRENTLY FILTERED stock-in history
   ───────────────────────────────────────────────────── */
function exportStockIn() {
  let txns = getData('transactions').filter(t => t.txn_type === 'IN');

  const itemFilter = document.getElementById('stock-hist-item').value;
  const from       = document.getElementById('stock-hist-from').value;
  const to         = document.getElementById('stock-hist-to').value;

  if (itemFilter) txns = txns.filter(t => t.item_id == itemFilter);
  if (from)       txns = txns.filter(t => t.txn_date >= from);
  if (to)         txns = txns.filter(t => t.txn_date <= to);

  txns.sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  if (!txns.length) {
    alert('No stock-in records to export.');
    return;
  }

  const rows = txns.map((t, i) => ({
    '#':            i + 1,
    'Date':         fmtDate(t.txn_date),
    'Item':         t.item_name       || '—',
    'Qty Added':    t.quantity,
    'Received By':  t.employee_name   || '—',
    'Department':   t.department_name || '—',
    'Remarks':      t.remarks         || '—',
  }));

  const headerRows = buildReportHeader('STOCK-IN / RECEIVING REPORT');
  const sigRows    = buildSignatories();

  const shape = r => ({
    '#': r.A, 'Date': r.B, 'Item': r.C,
    'Qty Added': r.D, 'Received By': r.E, 'Department': r.F, 'Remarks': r.G
  });

  const ws = XLSX.utils.json_to_sheet(headerRows.map(shape), { skipHeader: true });
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });
  XLSX.utils.sheet_add_json(ws, sigRows.map(shape), { origin: -1, skipHeader: true });

  ws['!cols'] = autoWidth(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock-In');

  const date = new Date().toISOString().split('T')[0];
  downloadWorkbook(wb, `StockIn_Report_${date}.xlsx`);

  showExportToast('✅ Stock-in history exported!');
}


/* ─────────────────────────────────────────────────────
   4. EXPORT ALL DATA — Full workbook with 4 sheets:
      Sheet 1: Inventory
      Sheet 2: All Requests (OUT)
      Sheet 3: All Stock-In (IN)
      Sheet 4: Employees & Departments
   ───────────────────────────────────────────────────── */
function exportAllData() {
  const wb   = XLSX.utils.book_new();
  const date = new Date().toISOString().split('T')[0];

  // ── Sheet 1: Inventory ──
  const items = getData('items')
    .sort((a, b) => a.item_name.localeCompare(b.item_name))
    .map((item, i) => ({
      '#':            i + 1,
      'Item Name':    item.item_name,
      'Unit':         item.unit      || '—',
      'Category':     item.category  || '—',
      'Balance':      item.balance,
      'Status':       item.balance >= 10 ? 'OK' : item.balance > 0 ? 'Low' : 'Out of Stock',
      'Last Updated': item.updated_at ? fmtDate(item.updated_at) : '—',
    }));

  const ws1 = XLSX.utils.json_to_sheet(items);
  ws1['!cols'] = autoWidth(items);
  XLSX.utils.book_append_sheet(wb, ws1, '📦 Inventory');

  // ── Sheet 2: All Requests ──
  const reqTxns = getData('transactions')
    .filter(t => t.txn_type === 'OUT')
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date))
    .map((t, i) => ({
      '#':           i + 1,
      'Date':        fmtDate(t.txn_date),
      'Employee':    t.employee_name   || '—',
      'Department':  t.department_name || '—',
      'Item':        t.item_name       || '—',
      'Qty Issued':  t.quantity,
      'Remarks':     t.remarks         || '—',
    }));

  const ws2 = XLSX.utils.json_to_sheet(reqTxns.length ? reqTxns : [{ 'Note': 'No request records yet.' }]);
  ws2['!cols'] = autoWidth(reqTxns.length ? reqTxns : [{ 'Note': '' }]);
  XLSX.utils.book_append_sheet(wb, ws2, '📤 Requests');

  // ── Sheet 3: All Stock-In ──
  const inTxns = getData('transactions')
    .filter(t => t.txn_type === 'IN')
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date))
    .map((t, i) => ({
      '#':            i + 1,
      'Date':         fmtDate(t.txn_date),
      'Item':         t.item_name       || '—',
      'Qty Added':    t.quantity,
      'Received By':  t.employee_name   || '—',
      'Department':   t.department_name || '—',
      'Remarks':      t.remarks         || '—',
    }));

  const ws3 = XLSX.utils.json_to_sheet(inTxns.length ? inTxns : [{ 'Note': 'No stock-in records yet.' }]);
  ws3['!cols'] = autoWidth(inTxns.length ? inTxns : [{ 'Note': '' }]);
  XLSX.utils.book_append_sheet(wb, ws3, '📥 Stock-In');

  // ── Sheet 4: Employees & Departments ──
  const emps  = getData('employees');
  const depts = getData('departments');
  const empRows = emps
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((e, i) => {
      const dept = depts.find(d => d.id === e.department_id);
      return {
        '#':           i + 1,
        'Employee Name': e.full_name,
        'Department':    dept?.dept_name || '—',
      };
    });

  const ws4 = XLSX.utils.json_to_sheet(empRows.length ? empRows : [{ 'Note': 'No employees yet.' }]);
  ws4['!cols'] = autoWidth(empRows.length ? empRows : [{ 'Note': '' }]);
  XLSX.utils.book_append_sheet(wb, ws4, '👤 Employees');

  downloadWorkbook(wb, `InventorySystem_FullExport_${date}.xlsx`);
  showExportToast('✅ Full workbook exported! (4 sheets)');
}


/* ─────────────────────────────────────────────────────
   TOAST NOTIFICATION — brief success message
   ───────────────────────────────────────────────────── */
function showExportToast(message) {
  // Remove any existing toast
  const old = document.getElementById('export-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'export-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 60px;
    right: 24px;
    background: #1565c0;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideUp 0.3s ease;
  `;
  document.body.appendChild(toast);

  // Auto-dismiss after 3 seconds
  setTimeout(() => toast.remove(), 3000);
}
