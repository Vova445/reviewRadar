# Dependency and secret-security audit

Last verified: 2026-10-30 (Europe/Kyiv)

## Production dependency audit

Command: `npm audit --omit=dev`

The initial audit reported five vulnerable production dependency entries: one critical and four high. The affected dependency paths included Next.js, PostCSS, Sharp, source-map-js and Zod.

Remediation:

- Updated `next` and the matching `eslint-config-next` from 16.2.6 to 16.4.3.
- Updated `zod` from 4.1.5 to 4.6.7.
- Regenerated the npm lockfile, which updated the vulnerable transitive PostCSS, Sharp and source-map-js versions.

Result after remediation: 0 critical, 0 high, 0 moderate, 0 low; 0 total known production vulnerabilities. No findings were deferred.

## Secret scanning

Gitleaks 8.30.1 was run from the repository root with `gitleaks detect --source . --log-opts="--all" --redact`. It scanned all seven commits then present in Git history and found no leaks. No credential rotation was required.

CI fetches the complete history and runs Gitleaks on Ubuntu for every pull request and push to `main`. GitHub secret scanning and push protection are enabled at repository level.
