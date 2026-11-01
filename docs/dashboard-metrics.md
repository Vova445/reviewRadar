# Dashboard metrics

All-time metrics mean all review rows still retained under the configured retention policy. The current policy retains review data for 30 days, so this scope is bounded by retention.

| Metric | Formula | Scope | Denominator |
| --- | --- | --- | --- |
| Average rating | Sum of ratings / analyzed review count | All-time retained | Analyzed reviews only |
| Review count | Count of retained review rows | All-time retained | Not applicable |
| Analyzed coverage | Analyzed rows / all retained rows; UI shows “analyzed N of M” | All-time retained | All retained rows (coverage only) |
| Positive share | Positive sentiment analyzed rows / analyzed rows | Last 30 location-local calendar days | All analyzed reviews in that scope |
| Analyzed review volume | Count of analyzed reviews | Last 30 location-local calendar days | Not applicable |
| 30-day average rating | Sum of analyzed ratings / analyzed count | Last 30 location-local calendar days | Analyzed reviews only |
| Sentiment mix | Count per sentiment / analyzed count for visual shares | Last 30 location-local calendar days | All analyzed reviews; includes mixed sentiment |
| Review growth | (Current 30-day analyzed count − prior 30-day analyzed count) / prior count | Two consecutive 30-day location-local windows | Prior window analyzed review count |
| Topic mentions | Count of extracted topic mentions; negative count by negative sentiment | Last 30 location-local calendar days | Analyzed topic mentions |
| Connected locations | Count of connected locations | Current state (all-time scope) | Not applicable |
| Negative reviews | Count of negative analyzed reviews | All-time retained | Analyzed reviews only |

For date windows, each review is compared against midnight boundaries calculated in its location's IANA timezone. The current window includes the local date today and the preceding 29 local dates, through the current instant. The previous window is the 30 local dates immediately before that window.

The UI reports loading and error while the dashboard request is pending or fails; empty when there are no reviews in scope; partial when analysis is incomplete or chart rows are sampled; and stale when the newest location sync is older than 24 hours. Current charts are sampled to at most 5,000 most recent rows; the coverage count is calculated over the full retained dataset.

Google Business Profile Location does not provide a timezone field. Imported locations use a resolver for supported regions/cities and otherwise fall back to the workspace timezone. A timezone should be made explicitly editable if accurate local reporting is required for an unsupported or ambiguous location.
