# ReviewRadar audit bundle for Claude

Source repository: `https://github.com/Vova445/reviewRadar.git`

Audited commit: `d15b37a53f0ba70f68e34c02f52d8ec6edce1678`

Generated from a fresh clone of `origin/main`.

## Included

- `tree.txt` — output of `git ls-files`.
- `grep.txt` — output of `git grep -n -E 'D1|env\.DB|queue|cron|retention|stripe|csrf|origin'`, excluding `.env*` files.
- `docs-architecture-retention-claims.txt` — line-numbered extraction of architecture, runtime, database, queue, retention, privacy and deletion claims from `docs/`.
- `docs/` — all nine tracked Markdown documents from the repository.
- `status-update.md` — evidence-based resolution of blocked/unknown audit statuses.

No `.env`, `.env.local`, credentials, OAuth tokens or secret values are included.

## Commands used

```powershell
git clone https://github.com/Vova445/reviewRadar.git <temporary-directory>
git -C <temporary-directory> ls-files > tree.txt
git -C <temporary-directory> grep -n -E 'D1|env\.DB|queue|cron|retention|stripe|csrf|origin' -- ':!*.env*' > grep.txt
```

The quotation marks in the supplied grep command were normalized from typographic quotes to shell-safe ASCII quotes. The search expression itself was preserved.
