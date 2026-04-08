import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'ootd.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Closet Items Table
  CREATE TABLE IF NOT EXISTS closet_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT,
    image_path TEXT,
    brand TEXT,
    last_worn DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Style Profiles Table
  CREATE TABLE IF NOT EXISTS style_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    aesthetic_pref TEXT,
    color_palette TEXT,
    weather_sensitivity INTEGER DEFAULT 5,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Outfit History Table
  CREATE TABLE IF NOT EXISTS outfit_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    items_json TEXT NOT NULL,
    rating INTEGER,
    weather_data TEXT,
    worn_on DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Enable foreign key enforcement
db.pragma('foreign_keys = ON');

// ── Schema migrations (safe on existing DB) ───────────────────────
// SQLite throws if a column already exists — we catch and continue.
const migrations = [
  // Enriched closet columns from Intake Agent
  'ALTER TABLE closet_items ADD COLUMN secondary_color TEXT',
  'ALTER TABLE closet_items ADD COLUMN fabric TEXT',
  'ALTER TABLE closet_items ADD COLUMN formality INTEGER',
  'ALTER TABLE closet_items ADD COLUMN season TEXT',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

// User feedback table — thumbs up/down on generated outfits
db.exec(`
  CREATE TABLE IF NOT EXISTS user_feedback (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    outfit_json TEXT NOT NULL,
    rating     INTEGER NOT NULL,  -- 1 = thumbs down, 5 = thumbs up
    reason     TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed a dev user so closet items can be added before auth is built
db.prepare(
  "INSERT OR IGNORE INTO users (id, email) VALUES ('dev-user-001', 'dev@ootdtwin.local')"
).run();

export default db;
