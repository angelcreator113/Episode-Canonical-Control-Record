# Contributing to Episode Canonical Control Record

## Avoiding Merge Conflicts

This project has two active developers. Follow these practices to minimize merge conflicts.

### Daily Workflow

1. **Start your day with a sync**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Keep branches short-lived** — merge within 1-2 days. Long-running branches diverge and create painful merges.

3. **Rebase before pushing**
   ```bash
   git pull --rebase origin main
   ```

4. **Small, focused PRs** — one feature or fix per PR. Avoid touching multiple domains in a single PR.

### Domain Ownership

The backend routes under `src/routes/memories/` are split by domain. When possible, coordinate so two developers aren't editing the same domain file simultaneously:

| File | Domain |
|------|--------|
| `core.js` | Memory extraction, confirm/dismiss, CRUD |
| `interview.js` | Character interview system, scene interview, narrative intelligence |
| `voice.js` | Voice sessions, career echoes, chapter drafts |
| `stories.js` | Story write/edit/continue/deepen/nudge |
| `planning.js` | Scene planner, story outlines, planner chat |
| `assistant.js` | Amber AI assistant, recycle bin |
| `engine.js` | Story engine, task arcs, generation, pipeline, batch |
| `extras.js` | Prose style, dramatic irony, intimate scenes, prompt enhance |
| `helpers.js` | Shared loaders, prompt builders, constants |

### Communication

- Before starting work, mention which files/domains you'll be touching
- If you need to edit `helpers.js` (shared code), coordinate first — this file affects all domains

### Resolving Conflicts

If you do hit a conflict:

1. **Don't panic** — read both sides carefully
2. **Prefer the newer logic** — if both sides changed the same function, the more recent change is usually correct
3. **Test after resolving** — run `npm run validate` and `npm test` after every conflict resolution
4. **Never force-push to main** — always create a merge commit so history is preserved

### Validation

Before pushing any branch:

```bash
npm run validate    # Routes + lint + route-health tests + cost audit
npm test            # Jest with coverage
```
