# F-Stats-1 Fix Plan v1.6

## What changed in v1.6

- **§12.27 (new):** live-schema verification of both `deleted_at` columns,
  closed from the CI deploy record without database contact
- **Open items 4 and 5: CLOSED.** Both columns are applied on dev.
- **§13 provenance correction:** PR 1 squash-merged as `4bfc3115` (#956);
  v1.5 §13's six branch commits are no longer reachable from `main`
- **§11:** v1.6 row added
- Basis: `4bfc3115`. Mints no FD.

**§13's inventory is not re-cut.** PR 1 shipped complete at 14/14 and
nothing about it has changed. PR 2's inventory remains deliberately
underived — see open item 3, unchanged since v1.3: pre-deriving it would
make it stale by its own execution date.

---

## §12.27 — `deleted_at` live-schema state: VERIFIED (NEW)

v1.4 §12.24 and v1.5 §12.26 each recorded a `deleted_at` column present in
schema but undeclared on its model, and each left live execution state
unverified. Open items 4 and 5 owed that verification before PR 2 cuts.

**Both are now verified applied on dev.** No database contact was required
and none occurred; the proof is in the CI deploy record.

### Evidence

Workflow run `29841468909` — *Deploy to Development*, `workflow_dispatch`,
conclusion `success`, created `2026-07-21T14:55:26Z`, head SHA
**`1844e56b`**.

Deploy job, `2026-07-21T15:00:22Z`, three consecutive lines:

- `SequelizeMeta entries: 219, episodes table exists: true`
- `SequelizeMeta already has entries — no bootstrap needed`
- **`No migrations were executed, database schema was already up to date.`**

The migration adding both columns —
`20260719000000-career-pipeline-links.js`, adding `deleted_at` to
`world_events` and to `career_goals` — merged 2026-07-19. Two days later
`npx sequelize-cli db:migrate --env development` ran against dev and found
nothing to apply. That is only possible if the migration was already
recorded in `SequelizeMeta`, i.e. already executed by an earlier run.

**Conclusion: both `deleted_at` columns exist on dev.** §12.24 and §12.26
describe real schema, not a merged-but-unapplied migration.

### Why job status alone would not have sufficed

`deploy-dev.yml` wraps the migration step as:

```
if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then
  echo 'Migration failed — trap will still restart PM2 so the site stays up'
  MIGRATION_FAILED=true
fi
```

A failed migration sets a flag and lets the deploy continue so PM2
restarts and the site stays up. **The job can conclude `success` with
migrations failed.** The verification therefore rests on the explicit
"already up to date" line and its `SequelizeMeta` corroboration, never on
the green check. Recorded because the same trap applies to any future
migration-state question answered from this workflow.

### Scope of the proof, stated precisely

- **Point-in-time.** This proves dev's schema at 2026-07-21 15:00:22Z,
  against tree `1844e56b`. Later drift is outside this evidence set.
- **Carries forward to `4bfc3115`.** `1844e56b` is an ancestor of current
  `main`; everything between is documentation plus PR 1's route
  conversions. No migration joined `src/migrations` in that span, so no
  schema change is pending. The conclusion holds at present `main`.
- **Dev only.** Says nothing about prod, which is a separate box under a
  standing freeze posture.
- **Presence, not posture.** Proves the columns exist. Does not establish
  what should be done about the model/schema divergence — that is PR 2's
  decision.

### Method note

The finding took five search passes because the CI log interleaves a
`test` job and a `deploy` job, and the `test` job's fresh-database
migration run matches every obvious migration pattern first. Filter to
deploy-job lines *before* pattern-matching:

```
gh run view <id> --log | Select-String -Pattern "^deploy" | Select-String -Pattern "<term>"
```

Recorded as reusable technique; the same interleaving will recur on any
future deploy-log question.

---

## §13 provenance correction

v1.5 §13's execution record tables six branch commits on
`fstats/phase-b-pr1` (`5d93dd33`, `a72a7e19`, `b63a25f8`, `94561fc7`,
`8b622ca2`, `42cb1cf2`). PR #956 squash-merged, so **those six are not
reachable from `main`.** The single squash commit is **`4bfc3115`**.

The branch was merged forward from `main` before the PR (merge commit
`fb6f1c4f`) rather than rebased, specifically so that v1.5's cited hashes
stayed valid on the branch. The squash then superseded them anyway. The
per-unit reasoning survives in the PR's commit list on GitHub; the
authoritative on-`main` record is `4bfc3115` plus v1.5 §13.

Same class as v1.3's `30f10fe7` / `178c981` correction. Recorded here so a
future session looking up a v1.5 hash against `main` finds the reason
rather than a gap.

**Merge record:**

| PR | Title | Squash | Landed |
|---|---|---|---|
| #955 | Fix Plan v1.5 | `487eb0eb` | 2026-08-01 |
| #956 | Phase B PR 1, 14 units | `4bfc3115` | 2026-08-01 |

Both merged `CLEAN` / `MERGEABLE`, no review required, no `--admin`
bypass, all four checks green (Cost Exposure Audit, Route Validation,
Tests, Frontend Tests).

---

## Open items carried to PR 2

1. `episodeCompletionService` transaction posture (§12.13 residue) —
   carried, unchanged.
2. `character_state` unique-constraint status — carried since v1.1; owner
   F-Sec-3, verify-only here.
3. PR 2–4 inventories (wardrobe, evaluation, worldEvents) — **re-derive at
   execution time.** Carries the full response-shape package: E1, C1, C7,
   C9, C17, plus the paranoid-posture decision now owed for both tables.
4. ~~`world_events.deleted_at` live-schema state~~ — **CLOSED at v1.6,
   §12.27.**
5. ~~`career_goals.deleted_at` live-schema state~~ — **CLOSED at v1.6,
   §12.27.**
6. Test coverage over PR 1's converted handlers — **still unknown.**
   `Validate/Tests` ran 2m6s on #956 against 1m58s on doc-only #955, an
   8-second delta. That is consistent with both "these routes have fast
   tests" and "these routes have none." Green means nothing else broke; it
   does not confirm the response-identical invariant. Unresolved.
7. **NEW:** `character_state` ten-column assumption (v1.5 §13) is now
   shipped in production code at C5 and C11. Its PE #62 residue is
   unchanged and it remains unverified against live schema. §12.27's
   technique makes this checkable cheaply if a future session wants it.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan. Committed at `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed; §12.1–§12.18 populated. Committed at `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 (deploy incident); Decision #8 (F-Deploy-1 promoted). |
| v1.3 | 2026-07-22 | Decisions #10–#12; §12.21–§12.23; §13 PR 1 inventory (19 units); 30f10fe7 provenance correction. |
| v1.4 | 2026-07-24 | §13 re-cut to 17/16; §12.24; Decision #13 (E1/C17 → PR 2); C17 anchor 624 → 625. Basis `544cb9ad`. |
| v1.5 | 2026-08-01 | Decision #14 (C1/C7/C9 → PR 2); §12.25 response-shape hazard class; §12.26; §13 re-cut to 14/14; PR 1 execution record. Basis `a61d4913`. |
| v1.6 | 2026-08-01 | §12.27 `deleted_at` live-schema verification, open items 4 and 5 CLOSED; §13 provenance correction for the `4bfc3115` squash; open item 7 added. Basis `4bfc3115`. |

v1.6 supersedes v1.5 for all forward references. **v1.5 §13's inventory
stands unamended** — v1.6 corrects its provenance, not its content.

---

## Register hygiene

- Mints no FD. Tail unchanged.
- Mints: §12.27. Corrects: §13 provenance. Adds: open item 7.
- **Closes: open items 4 and 5.**
- No live-database contact. No prod-box contact. No dev-box contact. All
  conclusions derive from committed files and the GitHub Actions record.
- FD-21 check: PR references historical; no closing keywords adjacent to
  `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.6 is the plan-of-record. Both schema-verification gates owed before
PR 2 are closed, so **PR 2 is unblocked and may cut.** Its opening scope:
the response-shape package (E1, C1, C7, C9, C17) and the paranoid-posture
decision for `world_events.deleted_at` and `career_goals.deleted_at`,
which §12.27 now confirms are both live. Its inventory is derived at
execution time against `main` as it stands then, not from this document.
After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-01. Main at `4bfc3115` (#956). Predecessor on main: v1.5 squash (`487eb0eb`, #955).*
*Minted: §12.27, open item 7. Closed: open items 4, 5. No FD numbers. [skip-automerge]*
