ALTER TABLE google_notification_events ADD COLUMN status TEXT NOT NULL DEFAULT 'received';
ALTER TABLE google_notification_events ADD COLUMN locked_until INTEGER;
ALTER TABLE google_notification_events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE google_notification_events ADD COLUMN completed_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_google_notification_status_lease ON google_notification_events(status, locked_until);
