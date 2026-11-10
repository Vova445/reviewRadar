# Product focus and roadmap

ReviewRadar must answer only three questions: **What is happening? Why is it happening? What should the owner do?** It is not a CRM.

- Version 0.1: authentication, workspace, Google OAuth, locations, reviews, sentiment, topics, dashboard.
- Version 0.2: insights, assisted replies, email/Telegram alerts, weekly report.
- Version 0.3: multi-location, competitor research, advanced analytics, exports, team members, agency mode.
- Version 1.0: additional providers only after their commercial terms, data rights, retention policies, and useful review coverage are verified. A provider endpoint returning only excerpts is not treated as equivalent to full review access.

The acquisition wedge is **Reputation Autopsy**: connect Google, identify the top three issues hurting the business, quantify volume and change, estimate impact, and recommend the next action. The highest external dependency risk remains Google Business Profile API approval and ongoing policy compliance—not the application framework or model provider.

The target repository structure separates marketing/auth/dashboard routes, domain components, provider libraries, services/repositories/jobs, Prisma schema, and independently deployable workers. The current prototype keeps the working Vinext/Sites UI while production backend contracts and PostgreSQL migrations evolve separately.
