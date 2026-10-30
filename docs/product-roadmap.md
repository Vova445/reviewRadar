# Product focus and roadmap

ReviewRadar must answer only three questions: **What is happening? Why is it happening? What should the owner do?** It is not a CRM.

- Version 0.1: authentication, workspace, Google OAuth, locations, reviews, sentiment, topics, dashboard.
- Version 0.2: insights, assisted replies, email/Telegram alerts, weekly report.
- Version 0.3: multi-location, competitor research, advanced analytics, exports, team members, agency mode.
- Version 1.0: additional providers only after their commercial terms, data rights, retention policies, and useful review coverage are verified. A provider endpoint returning only excerpts is not treated as equivalent to full review access.

The acquisition wedge is **Reputation Autopsy**: connect Google, identify the top three issues hurting the business, quantify volume and change, estimate impact, and recommend the next action. The highest external dependency risk remains Google Business Profile API approval and ongoing policy compliance—not the application framework or model provider.

Through beta, the product uses the Vinext/Sites Cloudflare Worker with D1 as the authoritative datastore, as defined by ADR-001. The next architecture work is to move long-running synchronization, analysis, alerts, reports, and retention into Cloudflare-native durable jobs while preserving one Worker-facing API boundary.

## Future

Alternative databases or separately deployed services are considered only after beta and only when measured ADR-001 review triggers justify their migration cost.
