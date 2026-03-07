const fs = require('fs');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.sqlite3');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const STORAGE_KEYS = new Set([
  'departments',
  'employees',
  'items',
  'transactions',
  'settings',
  'accounts',
  'currentUser'
]);

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await run(schema);
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

app.get('/api/health', async (_req, res) => {
  try {
    await get('SELECT 1 AS ok');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/state', async (_req, res) => {
  try {
    const rows = await all('SELECT key, value FROM kv_store');
    const state = {};
    rows.forEach((row) => {
      try {
        state[row.key] = JSON.parse(row.value);
      } catch (_err) {
        state[row.key] = row.value;
      }
    });
    res.json({ state, hasData: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/state/import', async (req, res) => {
  const inputState = req.body && req.body.state;
  if (!inputState || typeof inputState !== 'object') {
    return res.status(400).json({ error: 'Body must include a "state" object.' });
  }

  try {
    const existing = await get('SELECT COUNT(*) AS count FROM kv_store');
    if (existing.count > 0) {
      return res.status(409).json({ error: 'Database already has data. Import skipped.' });
    }

    await run('BEGIN TRANSACTION');
    try {
      const keys = Object.keys(inputState).filter((key) => STORAGE_KEYS.has(key));
      for (const key of keys) {
        const value = JSON.stringify(inputState[key]);
        await run(
          'INSERT INTO kv_store(key, value, updated_at) VALUES (?, ?, datetime(\'now\'))',
          [key, value]
        );
      }
      await run('COMMIT');
    } catch (innerErr) {
      await run('ROLLBACK');
      throw innerErr;
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/key/:key', async (req, res) => {
  const key = req.params.key;
  if (!STORAGE_KEYS.has(key)) {
    return res.status(400).json({ error: `Unsupported key: ${key}` });
  }

  try {
    const row = await get('SELECT value FROM kv_store WHERE key = ?', [key]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json({ key, value: JSON.parse(row.value) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/key/:key', async (req, res) => {
  const key = req.params.key;
  if (!STORAGE_KEYS.has(key)) {
    return res.status(400).json({ error: `Unsupported key: ${key}` });
  }

  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'value')) {
    return res.status(400).json({ error: 'Body must include "value".' });
  }

  try {
    const value = JSON.stringify(req.body.value);
    await run(
      `INSERT INTO kv_store(key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || 'Unexpected server error' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`InventorySystem server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
