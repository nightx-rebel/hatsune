import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class AppDatabase {
  constructor(filePath = './data/hatsune.db') {
    const resolvedPath = resolve(filePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        phone TEXT,
        status TEXT NOT NULL,
        user_id TEXT,
        pairing_code TEXT,
        session_key TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        metadata TEXT DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_chat_id TEXT,
        whatsapp_number TEXT,
        owner INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);
    `);
  }

  setState(key, value) {
    this.db.prepare(`INSERT INTO bot_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
  }

  getState(key, defaultValue = null) {
    const row = this.db.prepare('SELECT value FROM bot_state WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  }

  upsertSession(session) {
    const payload = JSON.stringify(session.metadata || {});
    this.db.prepare(`
      INSERT INTO sessions(id, phone, status, user_id, pairing_code, session_key, metadata, updated_at)
      VALUES (@id, @phone, @status, @user_id, @pairing_code, @session_key, @metadata, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        phone = excluded.phone,
        status = excluded.status,
        user_id = excluded.user_id,
        pairing_code = excluded.pairing_code,
        session_key = excluded.session_key,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      ...session,
      metadata: payload,
    });
  }

  getSession(id) {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, metadata: JSON.parse(row.metadata || '{}') };
  }

  listSessions() {
    return this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all().map((row) => ({ ...row, metadata: JSON.parse(row.metadata || '{}') }));
  }

  saveUser(user) {
    this.db.prepare(`
      INSERT INTO users(id, telegram_chat_id, whatsapp_number, owner, updated_at)
      VALUES (@id, @telegram_chat_id, @whatsapp_number, @owner, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        telegram_chat_id = excluded.telegram_chat_id,
        whatsapp_number = excluded.whatsapp_number,
        owner = excluded.owner,
        updated_at = CURRENT_TIMESTAMP
    `).run(user);
  }

  getUserByTelegramChat(chatId) {
    return this.db.prepare('SELECT * FROM users WHERE telegram_chat_id = ?').get(String(chatId));
  }

  close() {
    this.db.close();
  }
}

export default AppDatabase;
