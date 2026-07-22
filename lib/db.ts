import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// NOTA: scripts/seed.mjs mantiene una copia de este esquema. Si cambias una
// tabla aquí, actualiza también el seed.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta_ads_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  error TEXT,
  campaigns_rows INTEGER NOT NULL DEFAULT 0,
  adsets_rows INTEGER NOT NULL DEFAULT 0,
  ads_rows INTEGER NOT NULL DEFAULT 0,
  recommendations_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS meta_ads_campaign_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  objective TEXT,
  status TEXT,
  date TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  frequency REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  cpc REAL NOT NULL DEFAULT 0,
  cpm REAL NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  purchase_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  results INTEGER NOT NULL DEFAULT 0,
  cpl REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meta_campaign_daily ON meta_ads_campaign_daily (account_id, date);

CREATE TABLE IF NOT EXISTS meta_ads_adset_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  adset_id TEXT NOT NULL,
  adset_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  status TEXT,
  date TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  frequency REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  cpc REAL NOT NULL DEFAULT 0,
  cpm REAL NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  purchase_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  results INTEGER NOT NULL DEFAULT 0,
  cpl REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, adset_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meta_adset_daily ON meta_ads_adset_daily (account_id, date);

CREATE TABLE IF NOT EXISTS meta_ads_ad_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL DEFAULT '',
  adset_id TEXT NOT NULL DEFAULT '',
  adset_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  status TEXT,
  creative_id TEXT,
  thumbnail_url TEXT,
  date TEXT NOT NULL,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  frequency REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  cpc REAL NOT NULL DEFAULT 0,
  cpm REAL NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  purchase_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  results INTEGER NOT NULL DEFAULT 0,
  cpl REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, ad_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meta_ad_daily ON meta_ads_ad_daily (account_id, date);

CREATE TABLE IF NOT EXISTS meta_ads_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  sync_run_id INTEGER REFERENCES meta_ads_sync_runs(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('campaign','adset','ad')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  rule TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  kpi_snapshot TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','discarded')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_meta_recs ON meta_ads_recommendations (account_id, status);

CREATE TABLE IF NOT EXISTS google_ads_campaign_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  status TEXT,
  channel_type TEXT,
  date TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  avg_cpc REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  conversions_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_google_campaign_daily ON google_ads_campaign_daily (account_id, date);

CREATE TABLE IF NOT EXISTS google_ads_adgroup_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  ad_group_id TEXT NOT NULL,
  ad_group_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  status TEXT,
  date TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  avg_cpc REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  conversions_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, ad_group_id, date)
);
CREATE INDEX IF NOT EXISTS idx_google_adgroup_daily ON google_ads_adgroup_daily (account_id, date);

CREATE TABLE IF NOT EXISTS google_ads_ad_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL DEFAULT '',
  ad_type TEXT,
  ad_group_id TEXT NOT NULL DEFAULT '',
  ad_group_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  status TEXT,
  date TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  avg_cpc REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  conversions_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, ad_id, date)
);
CREATE INDEX IF NOT EXISTS idx_google_ad_daily ON google_ads_ad_daily (account_id, date);

CREATE TABLE IF NOT EXISTS google_ads_keyword_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  keyword_text TEXT NOT NULL DEFAULT '',
  match_type TEXT,
  ad_group_id TEXT NOT NULL DEFAULT '',
  ad_group_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  avg_cpc REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  conversions_value REAL NOT NULL DEFAULT 0,
  roas REAL NOT NULL DEFAULT 0,
  cpa REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, ad_group_id, criterion_id, date)
);
CREATE INDEX IF NOT EXISTS idx_google_keyword_daily ON google_ads_keyword_daily (account_id, date);

CREATE TABLE IF NOT EXISTS google_ads_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('campaign','ad_group','ad','keyword')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  rule TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  kpi_snapshot TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','discarded')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_google_recs ON google_ads_recommendations (account_id, status);

-- Fila única (id=1): último snapshot calculado por Budget Navigator.
-- campaign_snapshots guarda un JSON (mismo patrón que kpi_snapshot en
-- recomendaciones) en vez de una tabla normalizada -- es solo el último
-- cómputo, no una serie histórica.
CREATE TABLE IF NOT EXISTS budget_navigator_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  monthly_budget REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  computed_at TEXT,
  total_daily_budget REAL NOT NULL DEFAULT 0,
  total_spend_mtd REAL NOT NULL DEFAULT 0,
  campaign_snapshots TEXT NOT NULL DEFAULT '[]'
);
`;

function createDb(): Database.Database {
  const file =
    process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim() !== ""
      ? process.env.DATABASE_PATH
      : path.join(process.cwd(), "db", "campaign_copilot.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrateDb(db);
  return db;
}

function migrateDb(db: Database.Database) {
  const metricColumns = [
    ["leads", "INTEGER NOT NULL DEFAULT 0"],
    ["messages", "INTEGER NOT NULL DEFAULT 0"],
    ["results", "INTEGER NOT NULL DEFAULT 0"],
    ["cpl", "REAL NOT NULL DEFAULT 0"],
  ] as const;
  for (const table of [
    "meta_ads_campaign_daily",
    "meta_ads_adset_daily",
    "meta_ads_ad_daily",
  ]) {
    const columns = new Set(
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => String((row as { name: string }).name))
    );
    for (const [name, definition] of metricColumns) {
      if (!columns.has(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    }
  }

  for (const table of ["meta_ads_recommendations", "google_ads_recommendations"]) {
    const columns = new Set(
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => String((row as { name: string }).name))
    );
    if (!columns.has("applied_action")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN applied_action TEXT`);
    }
  }
}

// Singleton para sobrevivir el HMR de Next en desarrollo
const globalForDb = globalThis as unknown as {
  __campaignCopilotDb?: Database.Database;
};

export function getDb(): Database.Database {
  if (!globalForDb.__campaignCopilotDb) {
    globalForDb.__campaignCopilotDb = createDb();
  }
  return globalForDb.__campaignCopilotDb;
}
