# Plans, entitlements, and usage

Feature access is enforced server-side from the workspace subscription, never only through locked UI. The Free plan permits one location, the last 30 days, 50 imported reviews, and basic sentiment. AI Insights, Telegram, Reports, and historical analytics require a paid entitlement.

Monthly usage counters are incremented in the same durable workflow that accepts a normalized review or AI operation. Limits must be checked atomically to avoid concurrent overages. Billing provider webhooks update subscription status idempotently; browser redirects never grant entitlements.

CSV is the first export format. PDF is intentionally outside MVP and should reuse a closed report snapshot when added later.
