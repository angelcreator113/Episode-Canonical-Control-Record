<!-- Title must carry [skip-automerge]. Keep the body short; the diff is the record. -->

## What

<!-- One paragraph. Link the issue with plain text like "Task: #123" (no closing keywords - FD-21). -->

## Validation run (paste raw output, H1)

```
node scripts/validate-routes.js
bash scripts/lint-silent-catches.sh
bash scripts/audit-cost-exposure.sh
```

## Guardrails

- [ ] No host, AWS, database, or Cognito contact was made by the agent session.
- [ ] No file under `docs/audit/` was edited in place (amendments mint a new file; banners are additive).
- [ ] No migration file that has already run was edited; new schema changes are new files under `src/migrations/`.
- [ ] Explicit-path `git add` only; `git diff --cached` reviewed before commit.
