CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  return_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS google_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  encrypted_refresh_token TEXT NOT NULL,
  encrypted_access_token TEXT,
  scopes TEXT NOT NULL,
  access_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS google_available_locations (
  connection_id TEXT NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  title TEXT NOT NULL,
  address TEXT,
  selected INTEGER NOT NULL DEFAULT 0,
  discovered_at INTEGER NOT NULL,
  PRIMARY KEY(connection_id, location_name)
);
CREATE TABLE IF NOT EXISTS google_notification_events (event_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_google_available_connection_selected ON google_available_locations(connection_id, selected);
