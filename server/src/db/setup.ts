import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
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

// Seed a dev user so closet items can be added before auth is built
db.prepare(
  "INSERT OR IGNORE INTO users (id, email) VALUES ('dev-user-001', 'dev@ootdtwin.local')"
).run();

export default db;
