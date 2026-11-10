# Prompt for Claude: exhaustive ReviewRadar audit and execution plan

Скопіюй увесь текст нижче в новий чат Claude.

---

Ти — principal software architect, staff full-stack engineer, application-security engineer, SRE, QA lead і SaaS product manager в одній особі. Проведи максимально ретельний read-only аудит публічного репозиторію ReviewRadar:

https://github.com/Vova445/reviewRadar

## Головна мета

Мені потрібен не загальний огляд і не короткі поради, а **повний практичний план доведення проєкту від поточного стану до production-ready SaaS**. План має бути настільки конкретним, щоб junior-розробник міг виконувати його крок за кроком без здогадок.

Не змінюй код і не вигадуй реалізовані можливості. Спочатку реально переглянь дерево репозиторію, README/документацію, package.json, конфігурацію, маршрути, серверні модулі, схеми БД, міграції, UI та інтеграції. Якщо GitHub не дає прочитати частину файлів, прямо назви, що саме не вдалося перевірити.

## Жорсткі правила аудиту

1. Спирайся лише на фактичний код і документацію репозиторію.
2. Для кожного твердження про реалізацію або проблему вказуй файл і, якщо можливо, рядок чи конкретний символ/функцію.
3. Не вважай interface, type, SQL-таблицю, UI-макет або документацію завершеною функцією, якщо немає повного runtime-шляху.
4. Розрізняй статуси:
   - `[x]` — повністю реалізовано і фактично підключено до runtime;
   - `[~]` — реалізовано частково, існує лише прототип/схема/UI/контракт або потребує суттєвого hardening;
   - `[ ]` — відсутнє;
   - `[?]` — неможливо перевірити з репозиторію або потрібен зовнішній доступ.
5. Усе вже реалізоване одразу позначай `[x]`; не додавай це повторно як нову задачу.
6. Якщо документація суперечить коду, опиши суперечність і запропонуй одне остаточне рішення.
7. Не показуй і не шукай реальні секрети. Не проси `.env.local`. Аналізуй лише назви змінних із `.env.example`.
8. Не обмежуйся MVP. Покрий шлях MVP → beta → production → scale.
9. Не використовуй розмиті задачі на кшталт «покращити безпеку». Кожна задача повинна мати конкретні підкроки, файли/компоненти, перевірки та Definition of Done.
10. Якщо бачиш критичну помилку, вразливість, оманливу метрику або неправдиву marketing/legal claim — виділи її окремо.

## Контекст продукту

ReviewRadar — SaaS для аналізу репутації бізнесу. Основна продуктова обіцянка:

1. Що відбувається з відгуками?
2. Чому це відбувається?
3. Що власнику робити далі?

Ключовий acquisition wedge — **Reputation Autopsy**: після підключення Google показати три головні проблеми, що шкодять бізнесу, їхню частоту й динаміку, оцінку впливу та рекомендовану дію.

Поточний задум релізів:

- v0.1: auth, workspace, Google OAuth, locations, reviews, sentiment, topics, dashboard;
- v0.2: insights, assisted replies, email/Telegram alerts, weekly reports;
- v0.3: multi-location, competitor research, advanced analytics, exports, team members, agency mode;
- v1.0: додаткові providers після юридичної/API-перевірки.

## Відомі факти, які обов’язково перевір самостійно

Не приймай цей список на віру — підтвердь або спростуй його кодом:

- Проєкт використовує Next.js/Vinext, Cloudflare runtime і D1.
- ADR-001 тепер фіксує Workers + D1 до beta; перевір, що активний код, README та product docs дотримуються цього рішення, а альтернативні backend/database варіанти позначені лише як майбутні.
- Є email/password registration/login/logout і cookie sessions.
- Є Google OAuth connect/callback, state validation, encrypted token storage, account/location discovery, location selection, review pagination/import, refresh і disconnect.
- Google sync і notification handling можуть виконувати важку роботу синхронно в HTTP request.
- Є AI schema, pipeline contracts, anomaly helper, Stripe/Telegram/email/webhook abstractions, але вони можуть не бути підключені до runtime.
- `/onboarding` може бути заглушкою/redirect.
- Billing, entitlements, alerts, reports, assisted replies і additional providers можуть бути лише частково реалізовані.
- Автоматизованих тестів і CI/CD може не бути.
- Lint може не проходити.
- Можуть існувати dependency vulnerabilities — перевір package versions за актуальними advisories, але чітко познач дату перевірки.
- Метрики dashboard можуть змішувати all-time і 30-day scopes або мати неправильні denominators.
- Retention deadline може поновлюватися під час кожного sync, що суперечить задекларованій політиці.

## Обов’язкові області аудиту

### 1. Репозиторій та runtime

- структура;
- package scripts і Node/package-manager versions;
- build, lint, typecheck, tests;
- unused/dead/scaffolding code;
- environment variables;
- Cloudflare/Sites/Vinext configuration;
- local, preview, staging і production environments;
- reproducible deployment.

### 2. Архітектура

- фактичний runtime data flow;
- D1 як поточний beta runtime та критерії можливого майбутнього перегляду ADR;
- API/BFF boundaries;
- queues/workers/cron;
- transactions, idempotency і consistency;
- tenancy/workspace isolation;
- authoritative schemas і migrations;
- масштабування та vendor lock-in.

### 3. Authentication і account lifecycle

- registration/login/logout/session;
- password hashing/policy/pepper;
- rate limiting/brute-force protection;
- CSRF, CORS, Origin validation;
- email verification;
- password reset/change;
- email change;
- session rotation, expiry, cleanup, revoke-all;
- safe `next` redirects;
- account/workspace deletion;
- audit events.

### 4. Authorization і multi-tenancy

- workspace selection;
- RBAC roles and casing;
- one canonical authorization layer;
- IDOR/cross-workspace risks;
- owner/admin/member/viewer semantics;
- invitations and membership lifecycle;
- agency mode.

### 5. Google Business Profile integration

- exact OAuth redirect URI handling;
- local callback:
  `http://localhost:4000/v1/integrations/google/callback`
- production callback:
  `https://reviewradar.reviewradar-vova445.workers.dev/v1/integrations/google/callback`
- consent screen, scope, test users, API approval;
- OAuth state/PKCE/return URL;
- token exchange, refresh, revocation;
- encryption, key IDs, key rotation/KMS;
- account/location discovery;
- location selection/deselection;
- initial and incremental sync;
- cursors/checkpoints/watermarks;
- pagination;
- 429/5xx retries, timeouts, jitter, circuit breaking;
- concurrency and per-tenant fairness;
- Pub/Sub authentication and deduplication;
- job status, retries and DLQ;
- disconnected/revoked/error UX;
- Google API policy and retention compliance.

### 6. Review ingestion та AI

- normalization;
- idempotent upsert;
- changed-review detection;
- queueing after transaction commit;
- AI provider adapter;
- strict schema validation;
- prompt/model versioning;
- sentiment/topics/emotion/urgency;
- mixed sentiment;
- retries and DLQ;
- token/cost accounting;
- PII minimization;
- AI retention/training settings;
- deterministic aggregation;
- Reputation Autopsy;
- hallucination and confidence handling.

### 7. Dashboard і UX

- truthfulness of all metrics;
- date/timezone boundaries;
- analyzed-data coverage;
- denominators;
- loading/empty/error/stale/partial states;
- sync progress;
- review search/filter/sort/pagination;
- deep links and browser history;
- responsive behavior;
- localization;
- accessibility WCAG 2.2 AA;
- keyboard/focus/screen reader behavior;
- honest feature/provider status;
- onboarding flow.

### 8. Insights, alerts, reports і replies

- anomaly detection;
- insight generation and evidence;
- threshold/support/confidence;
- alert rule evaluation;
- email/Telegram channel verification;
- delivery idempotency/retries/history;
- quiet hours/timezone/unsubscribe;
- weekly immutable snapshots;
- Reputation Score formula/version/components;
- CSV/PDF export policy;
- assisted reply generation;
- explicit human approval;
- Google reply publication;
- revision and audit trail.

### 9. Billing

- Stripe route, raw-body signature verification and event ledger;
- checkout/customer portal;
- subscription state machine;
- entitlements;
- plan limits;
- atomic usage counters;
- trials/grace periods/past_due/canceled;
- reconciliation;
- invoices/tax/currency/refunds;
- webhook replay and out-of-order events;
- preventing UI bypass.

### 10. Security

- dependency vulnerabilities;
- headers: CSP/HSTS/frame/MIME/referrer/permissions;
- input/body/array limits;
- Zod or equivalent boundary schemas;
- SQL injection, XSS, SSRF, open redirects;
- secret handling and rotation;
- log redaction;
- webhook authentication;
- CSRF/CORS;
- rate limits;
- encryption at rest/in transit;
- audit logs;
- threat model;
- supply-chain/SBOM/provenance/secret scanning.

### 11. Privacy, retention та legal

- data inventory/classification;
- lawful purpose/minimization;
- retention anchor and purge worker;
- account deletion/export/correction;
- queues/logs/exports/backups/model provider retention;
- consent/legal version tracking;
- privacy/terms accuracy versus runtime;
- subprocessors and DPA requirements;
- data residency/transfers;
- provider-specific terms.

### 12. Testing

- unit tests;
- integration tests;
- route tests;
- database/migration tests;
- provider mocks/fixtures;
- E2E tests;
- tenant-isolation security tests;
- OAuth callback tests;
- duplicate/retry/failure tests;
- accessibility tests;
- load tests;
- resilience/fault injection;
- dependency/SAST/secret scans;
- production smoke tests.

### 13. CI/CD і operations

- GitHub Actions or equivalent;
- clean install, lint, typecheck, test, build;
- preview/staging/prod promotion;
- migrations;
- secrets provisioning;
- immutable deployments;
- rollback/canary;
- health/readiness/startup endpoints;
- structured logging;
- metrics/tracing/error tracking;
- SLO/SLI/error budgets;
- alerts/on-call/runbooks;
- backups and restore drills;
- RPO/RTO;
- incident response;
- cost monitoring.

### 14. Product truthfulness і roadmap

- compare landing/privacy/terms/product docs with actual implementation;
- flag unavailable providers/features presented as available;
- distinguish MVP, beta and future;
- define feature flags;
- recommend what to remove/postpone;
- identify the shortest path to a trustworthy paid beta.

## Формат відповіді — дотримуйся його буквально

### A. Executive verdict

На початку дай:

- короткий опис фактичного стану;
- production readiness score `0–100` із поясненням;
- security score;
- reliability score;
- product completeness score;
- maintainability score;
- список top-10 release blockers;
- чіткий висновок: що вже можна показувати демо-користувачам, а що не можна давати реальним клієнтам.

### B. Verified inventory

Зроби таблицю всіх помітних можливостей:

| Area | Feature | Status `[x/~ / /?]` | Evidence | Runtime path | Missing piece |

Не обмежуйся 10–20 рядками. Інвентар має бути максимально повним.

### C. Contradictions and dead scaffolding

Окремо переліч:

- docs vs runtime contradictions;
- відокремлення поточної D1-схеми від майбутніх/дослідницьких schema artifacts;
- UI without backend;
- backend/interface without caller;
- schema without runtime;
- environment variables without use;
- marketing/legal claims without implementation;
- duplicate or competing implementations.

Для кожного пункту дай остаточне рішення: що залишити, що видалити, що мігрувати.

### D. Master roadmap

Створи один великий нумерований roadmap у dependency order:

- `P0 — blockers/security/data loss`;
- `P1 — complete trustworthy v0.1`;
- `P2 — paid beta/v0.2`;
- `P3 — scale/v0.3+`.

Для **кожної задачі без винятку** використовуй шаблон:

#### `ID. Назва задачі` — `[x]`, `[~]`, `[ ]` або `[?]`

- **Навіщо:** пояснення простою мовою.
- **Що є зараз:** точні файли/функції/маршрути.
- **Що не так або чого бракує:** конкретний gap.
- **Залежності:** task IDs, які треба завершити раніше.
- **Файли/компоненти:** що створити або змінити.
- **Покрокова реалізація:** нумерований список настільки докладний, щоб його виконав junior.
- **Edge cases:** конкретні failure/race/security cases.
- **Тести:** unit/integration/E2E/security/load.
- **Acceptance criteria:** перевірювані умови.
- **Definition of Done:** команди, міграції, документація, observability.
- **Оцінка:** S/M/L/XL і приблизні engineer-days без удаваної точності.
- **Ризик:** low/medium/high/critical.
- **Результат для користувача:** що він побачить або зможе зробити.

Не об’єднуй десятки незалежних робіт в одну гігантську задачу. Розбий їх на маленькі послідовні кроки.

### E. Beginner implementation handbook

Після roadmap додай окрему покрокову інструкцію «що робити завтра зранку»:

1. як створити branch;
2. які команди виконати;
3. як запустити проєкт;
4. як перевірити Node version;
5. як працювати з `.env` без витоку секретів;
6. як виконувати D1 migrations;
7. як тестувати route локально;
8. як створити PR;
9. які checks повинні пройти;
10. як не зламати production.

Пояснюй терміни: migration, queue, worker, idempotency, CSRF, RBAC, DLQ, cursor, webhook, SLO, RPO/RTO.

### F. Release plans

Дай окремо:

- 7-day stabilization plan;
- 30-day trustworthy MVP plan;
- 60-day paid beta plan;
- 90-day production plan.

Для кожного періоду вкажи:

- scope;
- dependencies;
- deliverables;
- release gates;
- tasks intentionally deferred;
- measurable success criteria.

### G. Verification matrix

Склади таблицю:

| Requirement | How to verify | Command/test | Expected result | Failure owner |

Обов’язково включи build, lint, typecheck, unit, integration, E2E, migrations, auth, tenant isolation, CSRF, OAuth, webhook replay, queue retry, retention, billing, accessibility, load, rollback і restore.

### H. Environment and external-service checklist

Переліч усі потрібні зовнішні налаштування без значень секретів:

- Google Cloud/OAuth/APIs/PubSub;
- Cloudflare Worker/D1/Queues/Cron/Secrets/Custom Domain;
- AI provider;
- Stripe;
- email provider;
- Telegram;
- error monitoring/metrics/logging;
- DNS/domain/legal email.

Для кожного ключа/налаштування поясни:

- де його отримати;
- де зберігати;
- для чого він;
- чи потрібен локально/staging/production;
- як перевірити;
- як ротувати;
- що станеться, якщо він відсутній.

Не друкуй секретні значення.

### I. Final prioritized checklist

Заверши єдиним master checklist, готовим для перенесення в GitHub Issues/Linear:

- `[x]` для підтверджено завершеного;
- `[~]` для часткового;
- `[ ]` для відсутнього;
- task ID;
- title;
- priority;
- dependency IDs;
- estimate;
- owner role;
- milestone.

Він має охоплювати **весь** проєкт, а не лише Google OAuth.

## Додаткові вимоги до якості

- Пиши українською, але залишай технічні назви, route paths, env keys і команди англійською.
- Не скорочуй відповідь через її довжину. Якщо вона не вміщується, розбий на послідовні частини `Part 1/N`, `Part 2/N` тощо та продовжуй, доки весь план не буде завершено.
- Не повторюй однакові загальні поради.
- Відділяй підтверджені факти від припущень.
- Для актуальних security advisories вкажи дату перевірки і першоджерело.
- Не пропонуй додаткових providers, доки Google flow, security, retention, tests і deployment не стануть production-ready.
- Найвище став правильність, безпеку, tenant isolation, recoverability і чесність продукту, а не швидкість додавання feature.

Почни з перегляду репозиторію. Перед фінальним roadmap коротко переліч файли й директорії, які ти фактично проаналізував.

---
