---
name: validate
description: Run this repo's fast static checks (route registration, silent-catch lint, schema-agreement ratchet, cost-exposure audit, root-junk guard, syntax checks) without a database or network, and paste raw results. Use before every commit.
allowed-tools: Bash(node scripts/validate-routes.js) Bash(bash scripts/lint-silent-catches.sh) Bash(bash scripts/audit-cost-exposure.sh) Bash(node scripts/check-root-junk.js) Bash(node scripts/check-schema-agreement.js --baseline scripts/schema-agreement.baseline) Bash(node -c:*) Bash(npx eslint:*) Bash(cd frontend && npx vite build) Bash(cd frontend && npx vitest run:*) Bash(git diff:*)
---

# Validate (no DB, no network)

Run each and paste the raw tail of its output with its exit code. Do not summarise a check as "passed" without the output.

```
node scripts/validate-routes.js
bash scripts/lint-silent-catches.sh
bash scripts/audit-cost-exposure.sh
node scripts/check-root-junk.js
node scripts/check-schema-agreement.js --baseline scripts/schema-agreement.baseline
```

The schema-agreement ratchet prints its full report, then a last line `baseline scripts/schema-agreement.baseline: N entries, X new, Y no longer occur`. Paste that line and any `NEW` / `GONE` lines. A `NEW` line (exit 1) is a query or write naming an attribute its model does not declare: fix the code or the model, do not add it to the baseline. `GONE` lines do not fail; regenerate with `--update-baseline` in a PR that shrinks the set. It needs `node_modules` (`npm ci`).

Syntax-check every backend file you touched: `node -c <file>` for each. For anything under `src/routes/memories/`, check the whole directory.

If you touched `frontend/src`, run `cd frontend && npx vite build` and, for files that have a sibling `*.test.jsx`, `cd frontend && npx vitest run <path>`.

`npm test` needs Postgres (`TEST_DATABASE_URL`). Run it only when `docker compose up -d postgres` is available locally; in a cloud session say NOT RUN and rely on the CI `Tests` job on the PR.

`npm run lint` runs eslint over src/ and tests/. At `433b1f22` it fails with 38 pre-existing errors in 23 `src/` files, and CI does not run ESLint, so do not treat its exit code as a gate. Run `npx eslint <files you changed>` instead, paste the result, and fix only problems in files you changed.
