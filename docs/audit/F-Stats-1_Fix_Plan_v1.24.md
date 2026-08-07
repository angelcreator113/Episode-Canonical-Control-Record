# F-Stats-1 Fix Plan v1.24

| | |
|---|---|
| **Predecessor** | v1.23 (`f49acee4`, #988). |
| **Basis** | `394ca354` (#989 squash-merged). |
| **Author date** | 2026-08-07 |
| **Gate effect** | Item 37 CLOSED. Item 40 re-homed to a cross-keystone artifact; retained here as a pointer stub. |

## What changed in v1.24

- **Open item 37 CLOSED.** Verified by merge, by dispatch, and by use.
- **Open item 40 RE-HOMED.** Authority moves to
  `docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md`. Item 40 remains
  in this register as a pointer stub only.
- **§26 (new):** the inventory result and the re-homing rationale.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6. Item 6
  remains open at five of seven. `worldEvents.js` remains the next
  executable surface.
- **§11:** v1.24 row added.
- Basis `394ca354`. Mints no FD. Tail: FD-61.

## Open item 37 CLOSED

`workflow_dispatch` added to `.github/workflows/validate.yml`, merged as
#989 at `394ca354`.

Verification chain:

1. **Merged** - one line, `on:` block, no inputs or branch filter.
2. **Dispatchable** - `gh workflow run validate.yml --ref main` returned
   success. `workflow_dispatch` registers only from the default branch, so
   this could not be confirmed before merge.
3. **Used** - dispatched run `31211484715` on branch
   `diag/deleted-at-inventory`, a branch with no PR and no push trigger.
   That run produced the §26 inventory. The lever was not merely present;
   it was the only thing that made the next piece of work possible.

Closure meets the v1.22 bar for item 35: merged, exercised, and its result
consumed downstream.

## Open item 40 RE-HOMED - pointer stub

v1.23 minted item 40 as ownership-TBD on the assumption it was a finding
F-Stats-1 discovered but did not own. The inventory changed its size.

**48 model tables are exposed, across three keystones in the locked
sequence.** `character_state` is F-Stats-1's. `episode_wardrobe` and
`episode_wardrobe_defaults` are F-Ward-1's. `outfit_sets` and
`outfit_set_items` are F-Ward-3's. A finding upstream of three keystones
does not belong inside one keystone's register.

**Authority:** `docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md`.
Mechanism, numbers, method, per-keystone reach, and the 48-table appendix
live there and are not duplicated here.

**Item 40 stays open in this register as a stub.** It gates item 6's two
skipped assertions, so F-Stats-1 retains a dependency on it, not ownership
of it. Owner unassigned.

**Reciprocal references not filed.** No `F-Ward-*` artifact exists in
`docs/audit/` as of `394ca354`. The obligation is recorded in the shared
artifact §5, to be discharged when those tracks open a plan.

## §26 - inventory result

110 model tables inherit the global `paranoid: true`. 48 are missing
`deleted_at` and exposed. 4 more are missing it but immune, because
`timestamps: false` makes inherited paranoia inoperative.

Measured empirically. A temporary Jest probe queried
`information_schema.columns` against the CI Postgres and was then deleted
along with its branch; it never reached main. Static cross-reference was
rejected - 43 migrations touch `deleted_at`, and a static read describes
the migration chain rather than a real schema.

**Method caveat, recorded because it will recur:** `m.options.paranoid`
returns `true` even where `timestamps: false` prevents Sequelize from
writing the column. The probe over-counted by 4 on first pass. The exposed
set is models with timestamps AND no `deleted_at`, not models reporting
paranoid.

## §11 Plan Version History (UPDATED)

| v1.24 | 2026-08-07 | Open item 37 CLOSED (merged `394ca354`, dispatched, used for run 31211484715). Open item 40 RE-HOMED to `Paranoid_Exposure_Inventory_2026-08-07.md`, retained as pointer stub. §26 minted. No execution state changes. Basis `394ca354`. |

v1.24 supersedes v1.23 for all forward references.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.23. Tail: FD-61.
- Mints: §26. Closes: open item 37.
- Re-homes: open item 40 (authority external; stub retained).
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.23; no destructive rewrite.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

**Open items after this revision:** 6, 31, 32, 33, 34, 36, 38, 39, 40 (stub), 41, 42. Item 37 closed.

## Method note

Item 37 closed and was immediately load-bearing. The manual dispatch it
added was the mechanism that produced §26's inventory, on a branch that no
other trigger would have run. A one-line fix filed as a minor gap turned
out to gate the next piece of diagnostic work within the same day.

## Forward Statement

`worldEvents.js` remains the next executable surface. Item 6 stays open at
five of seven; its remainder gates on item 40, now externally owned. Items
32 and 6 still deserve resolution rather than carry before `worldEvents.js`.
After F-Stats-1 closes: **F-Ward-1 next** - which inherits two tables from
the §26 inventory.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-07. Main at `394ca354` (#989). Predecessor: v1.23.*
*Minted: §26. Closed: open item 37. Re-homed: open item 40. Mints no FD. Tail: FD-61. [skip-automerge]*