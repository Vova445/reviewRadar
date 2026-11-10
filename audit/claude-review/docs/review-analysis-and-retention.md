# Review analysis and Google Content retention

## Data boundaries

The database separates provider metadata, temporary source content, and ReviewRadar-derived analysis.

- `reviews`: workspace/location ownership, source identifiers, rating, provider timestamps, fetch time, and retention deadline.
- `review_source_content`: temporary Google-sourced author, comment, reply, language, and content hash. `purge_after` is set from the policy-aware retention configuration and never later than the currently permitted window.
- `review_analyses`: sentiment, score, emotion, urgency, summary, model version, and analysis timestamp.
- `topics`: both `system` and `ai_discovered` topics. There is no global fixed topic enum.
- `review_topics`: per-review topic sentiment and confidence.

The production implementation must re-check the current Google Business Profile policies and contractual terms before launch. A scheduled retention job deletes expired `review_source_content`; refresh-on-demand must not silently extend retention beyond what the current policy permits. Deletion must also cover logs, queues, debug payloads, exports, backups, and AI-provider request retention.

## AI pipeline

`Review → language detection → sentiment → topics → emotion → urgency → AI summary`

Analysis output is schema-validated. Overall sentiment supports `positive`, `neutral`, `negative`, and `mixed`; `sentiment_score` is clamped to `[-1, 1]`. Each topic has its own sentiment so mixed reviews do not lose nuance.

System topics provide stable reporting dimensions for a business vertical. AI-discovered topics are created only after normalization, confidence checks, and similarity matching to avoid duplicates such as `wait time`, `waiting`, and `long queue`. A human can later merge or promote discovered topics without rewriting historical reviews.
