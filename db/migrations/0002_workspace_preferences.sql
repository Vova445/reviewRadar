CREATE TABLE IF NOT EXISTS workspace_preferences (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'uk' CHECK(locale IN ('uk','en')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  updated_at INTEGER NOT NULL
);
