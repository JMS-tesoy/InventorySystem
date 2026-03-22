const fs = require('fs');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 }); // Allow up to 10MB payloads for images
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.sqlite3');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const STORAGE_KEYS = new Set([
  'departments',
  'employees',
  'items',
  'transactions',
  'settings',
  'accounts'
]);

const db = new sqlite3.Database(DB_PATH);

function normalizeAccountPayload(account) {
  const value = account && typeof account === 'object' ? account : {};
  const username = String(value.username || '').trim().toLowerCase();
  return {
    id: Number(value.id) || null,
    username,
    password: String(value.password || ''),
    role: value.role === 'admin' ? 'admin' : 'user',
    displayName: String(value.displayName || '').trim(),
    email: String(value.email || '').trim().toLowerCase(),
    phone: String(value.phone || '').trim()
  };
}

async function getAccountsFromTable() {
  const rows = await all(
    `SELECT id, username, password, role, display_name, email, phone
       FROM accounts
      ORDER BY id ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role,
    displayName: row.display_name || '',
    email: row.email || '',
    phone: row.phone || ''
  }));
}

async function replaceAccountsInTable(accounts) {
  const input = Array.isArray(accounts) ? accounts : [];
  const sanitized = input.map(normalizeAccountPayload).filter((account) => account.username);

  await run('BEGIN TRANSACTION');
  try {
    await run('DELETE FROM accounts');
    for (const account of sanitized) {
      await run(
        `INSERT INTO accounts(id, username, password, role, display_name, email, phone, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          account.id,
          account.username,
          account.password,
          account.role,
          account.displayName || null,
          account.email || null,
          account.phone || null
        ]
      );
    }
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

async function migrateAccountsFromKvStore() {
  const countRow = await get('SELECT COUNT(*) AS count FROM accounts');
  if (countRow && countRow.count > 0) return;

  const legacy = await get('SELECT value FROM kv_store WHERE key = ?', ['accounts']);
  if (!legacy) return;

  let parsed = [];
  try {
    parsed = JSON.parse(legacy.value);
  } catch (_err) {
    parsed = [];
  }

  if (!Array.isArray(parsed) || !parsed.length) return;

  await replaceAccountsInTable(parsed);
  await run('DELETE FROM kv_store WHERE key = ?', ['accounts']);
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, function onExec(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

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
  await exec(schema);
  await migrateAccountsFromKvStore();
  // Auto-upgrade existing database schema to support attachments
  try { await run("ALTER TABLE chat_history ADD COLUMN attachment TEXT"); } catch (e) { /* ignore if column already exists */ }
  await run("DELETE FROM kv_store WHERE key = 'currentUser'");
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));

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
    const rows = await all("SELECT key, value FROM kv_store WHERE key != 'accounts'");
    const state = {};
    rows.forEach((row) => {
      try {
        state[row.key] = JSON.parse(row.value);
      } catch (_err) {
        state[row.key] = row.value;
      }
    });

    const accounts = await getAccountsFromTable();
    if (accounts.length) state.accounts = accounts;

    res.json({ state, hasData: rows.length > 0 || accounts.length > 0 });
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
        if (key === 'accounts') {
          const inputAccounts = Array.isArray(inputState[key]) ? inputState[key] : [];
          const sanitized = inputAccounts.map(normalizeAccountPayload).filter((account) => account.username);
          await run('DELETE FROM accounts');
          for (const account of sanitized) {
            await run(
              `INSERT INTO accounts(id, username, password, role, display_name, email, phone, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              [
                account.id,
                account.username,
                account.password,
                account.role,
                account.displayName || null,
                account.email || null,
                account.phone || null
              ]
            );
          }
          continue;
        }

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
    if (key === 'accounts') {
      const accounts = await getAccountsFromTable();
      if (!accounts.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ key, value: accounts });
    }

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
    if (key === 'accounts') {
      if (!Array.isArray(req.body.value)) {
        return res.status(400).json({ error: '"accounts" value must be an array.' });
      }
      await replaceAccountsInTable(req.body.value);
      return res.json({ ok: true });
    }

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

app.get('/api/chat', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM chat_history ORDER BY timestamp ASC LIMIT 200');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.emit('online_users', Array.from(onlineUsers.values()));

  socket.on('user_join', (user) => {
    if (user && user.username) {
      onlineUsers.set(socket.id, user);
      io.emit('online_users', Array.from(onlineUsers.values()));
    }
  });

  socket.on('user_leave', () => {
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      io.emit('online_users', Array.from(onlineUsers.values()));
    }
  });

  socket.on('disconnect', () => {
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      io.emit('online_users', Array.from(onlineUsers.values()));
    }
  });

  socket.on('chat_message', async (msg) => {
    try {
      // Check if there is an image attachment as a Base64 string
      if (msg.attachment && msg.attachment.startsWith('data:image/')) {
        const matches = msg.attachment.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Get file extension and create a unique filename
          const ext = mimeType.split('/')[1] || 'png';
          const filename = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
          const filepath = path.join(UPLOADS_DIR, filename);
          
          // Save the file to the uploads directory
          await fs.promises.writeFile(filepath, buffer);
          
          // Update the message attachment to the new URL path
          msg.attachment = `/uploads/${filename}`;
        }
      }

      await run(
        `INSERT INTO chat_history (id, user, text, color, target, reply_to, attachment) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [msg.id, msg.user, msg.text, msg.color, msg.target, msg.replyTo ? JSON.stringify(msg.replyTo) : null, msg.attachment || null]
      );
    } catch (e) { console.error('Failed to save message', e); }
    socket.broadcast.emit('chat_message', msg);
  });
  socket.on('chat_reaction', async (msg) => {
    try {
      const row = await get(`SELECT reactions FROM chat_history WHERE id = ?`, [msg.msgId]);
      if (row) {
        const reactions = JSON.parse(row.reactions || '{}');
        if (!reactions[msg.emoji]) reactions[msg.emoji] = [];
        if (!reactions[msg.emoji].includes(msg.user)) {
          reactions[msg.emoji].push(msg.user);
          await run(`UPDATE chat_history SET reactions = ? WHERE id = ?`, [JSON.stringify(reactions), msg.msgId]);
        }
      }
    } catch (e) { console.error('Failed to save reaction', e); }
    socket.broadcast.emit('chat_reaction', msg);
  });
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`InventorySystem server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
