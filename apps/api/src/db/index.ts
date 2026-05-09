import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/promotions.db";

// Ensure parent directory exists before SQLite tries to open the file.
const dir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DATABASE_PATH);

// WAL = better concurrent reads. foreign_keys = ON enforces FK constraints.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS brands (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  website_url   TEXT,
  hours_json    TEXT,
  social_json   TEXT NOT NULL DEFAULT '[]',
  source_url    TEXT NOT NULL,
  source_portal TEXT NOT NULL,
  scraped_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT,
  start_date    TEXT,
  end_date      TEXT,
  source_url    TEXT NOT NULL,
  source_portal TEXT NOT NULL,
  brand_id      TEXT,
  scraped_at    TEXT NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promotions_brand_id   ON promotions(brand_id);
CREATE INDEX IF NOT EXISTS idx_promotions_start_date ON promotions(start_date);
CREATE INDEX IF NOT EXISTS idx_promotions_end_date   ON promotions(end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_scraped_at ON promotions(scraped_at);
`);