# Alerts, weekly reports, and Reputation Score

Alert evaluation is event-driven after review normalization and AI analysis. Rules are workspace-scoped and deliveries use a unique `(channel_id, event_key)` key so retries cannot send duplicates. Telegram destinations and email addresses are encrypted at rest; webhook secrets and bot tokens remain server-side.

The Monday report is generated from a closed weekly window and stores the component snapshot used to calculate its score. Delivery retries do not regenerate the report.

`Reputation Score = rating × 0.40 + recent trend × 0.20 + sentiment × 0.15 + response rate × 0.10 + negative issue health × 0.15`

Every component is normalized to 0–100 using documented bounds. The UI must call the score a directional indicator, expose component weights and values, and avoid presenting it as an objective or absolute judgment. Formula versions must be stored with reports when the weighting model changes.
