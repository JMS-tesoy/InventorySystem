/* =====================================================
   db.js — Data layer for Office Supplies Inventory System
   Uses localStorage to simulate a database.
   
   HOW IT WORKS:
   - Each "table" is a JSON array stored in localStorage.
   - Keys used: 'departments', 'employees', 'items',
                'transactions', 'settings'
   
   TO CONNECT A REAL BACKEND:
   - Replace getData() / setData() with fetch() API calls.
   - Example: getData('items') → fetch('/api/items')
   ===================================================== */

/* ─────────────────────────────────────────────────────
   CORE DATA HELPERS
   ───────────────────────────────────────────────────── */

// Get a data table from localStorage (returns [] if empty)
function getData(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

// Save a data table to localStorage
function setData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// Generate next unique ID for a table array
function newId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

// Format a YYYY-MM-DD string to readable Philippine date
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Return today's date as YYYY-MM-DD
function today() {
  return new Date().toISOString().split('T')[0];
}

/* ─────────────────────────────────────────────────────
   SETTINGS HELPERS
   ───────────────────────────────────────────────────── */

// Load the entire settings object (stored as one JSON object)
function getSettings() {
  return JSON.parse(localStorage.getItem('settings') || '{}');
}

// Merge new key-values into existing settings
function saveSettings(obj) {
  const cur = getSettings();
  localStorage.setItem('settings', JSON.stringify({ ...cur, ...obj }));
}

/* ─────────────────────────────────────────────────────
   SEED DATA — Loaded ONCE on first visit
   (If 'items' table already has data, seed is skipped)
   NOTE: initAccounts() is called separately in auth.js
   ───────────────────────────────────────────────────── */
function initSeedData() {
  // If items already exist, skip seeding
  if (getData('items').length) return;

  // --- Departments ---
  setData('departments', [
    { id: 1, dept_name: 'Administration' },
    { id: 2, dept_name: 'Finance' },
    { id: 3, dept_name: 'IT Department' },
  ]);

  // --- Employees (linked to departments by department_id) ---
  setData('employees', [
    { id: 1, full_name: 'Maria Santos',   department_id: 1 },
    { id: 2, full_name: 'Juan dela Cruz', department_id: 2 },
    { id: 3, full_name: 'Anna Reyes',     department_id: 3 },
  ]);

  // --- Items / Office Supplies (sorted alphabetically) ---
  setData('items', [
    { id: 1,  item_name: 'Ball Pen (Black)', unit: 'pcs',  category: 'Writing',      balance: 50, updated_at: today() },
    { id: 2,  item_name: 'Bond Paper A4',    unit: 'ream', category: 'Paper',        balance: 8,  updated_at: today() },
    { id: 3,  item_name: 'Binder Clips',     unit: 'box',  category: 'Fastening',    balance: 3,  updated_at: today() },
    { id: 4,  item_name: 'Correction Tape',  unit: 'pcs',  category: 'Writing',      balance: 12, updated_at: today() },
    { id: 5,  item_name: 'Envelope (Long)',  unit: 'pcs',  category: 'Mailing',      balance: 0,  updated_at: today() },
    { id: 6,  item_name: 'Folder (Long)',    unit: 'pcs',  category: 'Filing',       balance: 20, updated_at: today() },
    { id: 7,  item_name: 'Highlighter',      unit: 'pcs',  category: 'Writing',      balance: 6,  updated_at: today() },
    { id: 8,  item_name: 'Scissors',         unit: 'pcs',  category: 'Tools',        balance: 5,  updated_at: today() },
    { id: 9,  item_name: 'Stapler',          unit: 'pcs',  category: 'Fastening',    balance: 4,  updated_at: today() },
    { id: 10, item_name: 'Sticky Notes',     unit: 'pack', category: 'Organization', balance: 0,  updated_at: today() },
  ]);

  // --- Default Settings (header + signatories) ---
  saveSettings({
    header_company:  'Local Government Unit',
    header_address:  'City Hall, Main Ave.',
    header_subtitle: 'Office Supplies Inventory Report',
    header_logo:     'Republic of the Philippines',
    sig1_name: 'Supply Officer',  sig1_pos: 'Prepared By',
    sig2_name: 'Division Chief',  sig2_pos: 'Checked By',
    sig3_name: 'Department Head', sig3_pos: 'Approved By',
  });
}

/*
=====================================================
  SQL SCHEMA REFERENCE (for backend / developer use)
  This shows how the data would look in a real database.
=====================================================

-- DEPARTMENTS
CREATE TABLE departments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dept_name  VARCHAR(100) NOT NULL UNIQUE
);

-- EMPLOYEES
CREATE TABLE employees (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name      VARCHAR(150) NOT NULL,
  department_id  INTEGER,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ITEMS (office supplies)
CREATE TABLE items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name   VARCHAR(150) NOT NULL,
  unit        VARCHAR(30),
  category    VARCHAR(80),
  balance     INTEGER NOT NULL DEFAULT 0,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- STOCK TRANSACTIONS (IN / OUT / ADJ)
CREATE TABLE stock_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_date       DATE NOT NULL,
  txn_type       VARCHAR(3) NOT NULL,   -- 'IN', 'OUT', 'ADJ'
  item_id        INTEGER NOT NULL,
  quantity       INTEGER NOT NULL,
  employee_id    INTEGER,
  department_id  INTEGER,
  remarks        TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id)      REFERENCES items(id),
  FOREIGN KEY (employee_id)  REFERENCES employees(id),
  FOREIGN KEY (department_id)REFERENCES departments(id)
);

-- SETTINGS (key-value pairs)
CREATE TABLE settings (
  setting_key    VARCHAR(100) PRIMARY KEY,
  setting_value  TEXT
);
-- Example rows:
-- ('header_company',  'Local Government Unit')
-- ('header_address',  'City Hall, Main Ave.')
-- ('header_subtitle', 'Office Supplies Inventory Report')
-- ('sig1_name', 'Supply Officer'),  ('sig1_pos', 'Prepared By')
-- ('sig2_name', 'Division Chief'),  ('sig2_pos', 'Checked By')
-- ('sig3_name', 'Department Head'), ('sig3_pos', 'Approved By')
*/
