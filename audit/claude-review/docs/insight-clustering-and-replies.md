# Repeating issue detection and reply approval

ReviewRadar clusters semantically equivalent topic phrases such as `waiting`, `long wait`, `service slow`, and `waited 30 minutes` into a canonical topic. The aggregation job compares equivalent windows, requires minimum support and confidence, and records current count, previous count, percentage change, severity, and evidence review IDs. Severity combines volume, growth, negative sentiment, urgency, recency, and location spread; it must not be assigned from percentage growth alone.

Competitor analysis is intentionally excluded from this version. Insights use only the workspace's own connected reviews.

Generated replies always start as drafts. Publishing requires a server-side request tied to the authenticated owner, the exact draft and exact review. The server records `explicitly_approved_by` and `explicitly_approved_at` immediately before calling Google's review reply endpoint. Scheduled jobs, webhooks, bulk actions, and generation callbacks are not permitted to publish a reply. Editing creates a new draft revision and invalidates any earlier approval.
