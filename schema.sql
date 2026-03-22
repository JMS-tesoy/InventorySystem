CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  display_name TEXT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  text TEXT NOT NULL,
  color TEXT,
  target TEXT,
  reply_to TEXT,
  reactions TEXT DEFAULT '{}',
  attachment TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
