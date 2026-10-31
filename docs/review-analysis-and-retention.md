# Review analysis and Google Content retention

## Data boundaries

The database separates provider metadata, temporary source content, and ReviewRadar-derived analysis.

- `reviews`: workspace/location ownership, source identifiers, rating, provider timestamps, fetch time, and a `retention_until` deadline set once at first import (30 days).
- `review_source_content`: temporary Google-sourced author, comment, reply, language, and content hash. Its purge deadline is the same first-import deadline and a repeated sync never moves it.
- `review_analyses`: sentiment, score, emotion, urgency, summary, model version, and analysis timestamp.
- `topics`: both `system` and `ai_discovered` topics. There is no global fixed topic enum.
- `review_topics`: per-review topic sentiment and confidence.

The daily 03:00 UTC Worker Cron deletes expired `reviews`; foreign-key cascades remove source content, analyses, and review-topic links. It logs only the deleted row count. Disconnecting Google immediately removes imported Google reviews and cancels active sync jobs for Google locations. Repeated sync may refresh review fields only while the original retention window is still active. The production implementation must re-check current Google Business Profile policies and contractual terms before launch. Deletion must also cover logs, queues, debug payloads, exports, backups, and AI-provider request retention.

## AI pipeline

`Review → language detection → sentiment → topics → emotion → urgency → AI summary`

Analysis output is schema-validated. Overall sentiment supports `positive`, `neutral`, `negative`, and `mixed`; `sentiment_score` is clamped to `[-1, 1]`. Each topic has its own sentiment so mixed reviews do not lose nuance.

System topics provide stable reporting dimensions for a business vertical. AI-discovered topics are created only after normalization, confidence checks, and similarity matching to avoid duplicates such as `wait time`, `waiting`, and `long queue`. A human can later merge or promote discovered topics without rewriting historical reviews.
