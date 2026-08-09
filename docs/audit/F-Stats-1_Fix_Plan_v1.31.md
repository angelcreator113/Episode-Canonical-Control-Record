# F-Stats-1 Fix Plan v1.31

| | |
|---|---|
| **Predecessor** | v1.30 (`f499a3ba`, #996). |
| **Basis** | `f499a3ba`. |
| **Author date** | 2026-08-09 |
| **Gate effect** | Open item 40 (F-Stats-1) is ASSIGNED an owner as XK-1 in the new cross-keystone register. Open item 6 CLOSES with an explicit carve-out for the two wardrobe money-path purchase assertions, cited to XK-1. No fix evaluated, no gate lifted beyond item 6, no FD minted. Tail unchanged at FD-61. |

## What changed in v1.31

- **`docs/audit/Cross_Keystone_Register.md` is created**, ratified by this
  revision. It is the ownership home for findings upstream of two or more
  keystones in the locked sequence. It mints nothing on its own; a standalone
  artifact carries no register authority.
- **Open item 40 (F-Stats-1) is assigned an owner: XK-1.** This is an *ownership
  assignment*, not a second re-home. v1.24 (`95525f30`, #990) re-homed the item to
  `Paranoid_Exposure_Inventory_2026-08-07.md`, which remains the evidence artifact
  and is not superseded or moved. This revision supplies only what that document's
  §6 explicitly declined to supply.
- **Open item 6 CLOSES with carve-out.** Five of seven assertions closed. The two
  wardrobe money-path purchase cases — purchase-below-cost and purchase-covered —
  are recorded as NOT COVERED and cited to XK-1. See §33.2.
- **v1.23's ruling is not overturned. Its precondition changed.** See §33.1.
- **§33 minted:** the ownership-assignment record.
- **Deliberately out of scope:** open item 23's mint status, unchanged from v1.30
  §32.3. `worldEvents.js` remains unopened for the same reason. Open item 36
  carried.

## §33 — ownership assignment for a cross-keystone finding

### §33.1 The standing ruling, and what changed under it

v1.23 ruled that closing open item 6 at five of seven would record coverage that
does not exist. v1.30 restated that ruling as unchanged.

**This revision does not overturn it.** The ruling is correct and remains correct
against the case it addressed: a *silent* close at five of seven, which would
assert seven assertions' worth of coverage and leave the gap invisible.

What changed is the ruling's precondition. At v1.23 the blocker — open item 40
(F-Stats-1) — was **unowned at source**, and would have been cited to a document
whose §6 declines to assign an owner. A carve-out citing an orphan is not a
carve-out; it defers to nothing. With XK-1 established, the carve-out cites an
owned entry with a named reach, a recorded obligation, and a maintenance
convention.

The distinction the close must preserve, and does: **the plan was exercised; the
remaining coverage is upstream-blocked.** Those are different claims and the
disposition below records them separately.

This paragraph exists because v1.30 §32 was minted against precisely the failure
of moving past a prior ruling without supporting citation. The support is stated
here rather than assumed.

### §33.2 Open item 6 — disposition

**CLOSED WITH CARVE-OUT.**

| | |
|---|---|
| Assertions closed | 5 of 7, executed on main at `7e33b189` (#987) |
| Verifying environment | CI, per §24 as restored by v1.30 |
| Assertions carved out | 2 — purchase-below-cost, purchase-covered |
| Carve-out cited to | XK-1 |

The two carved assertions are the wardrobe money-path purchase cases. They depend
on `POST /characters/lala/state/update` and are blocked through open item 40
(F-Stats-1), now XK-1.

**What the carve-out asserts:** that these two cases are **not covered**, that the
gap is upstream of F-Stats-1, and that it does not resolve by further F-Stats-1
work. It does not assert that the money path is verified. Any downstream document
relying on wardrobe money-path coverage must read this carve-out first.

The carve-out discharges when XK-1's remedy lands and the two assertions execute.
Until then the gap stands open in the register, not in this plan.

### §33.3 What this revision does not do

- Does not evaluate or select a fix for XK-1. Schema-wide migration,
  scoped per-keystone migration, and removing the global `paranoid` all remain
  candidates; none is evaluated.
- Does not enumerate prod. Prod is FROZEN. Prod `character_state` almost certainly
  has `deleted_at` because Edit Stats works there — **unverified, and not to be
  assumed.**
- Does not open `worldEvents.js`. Its remaining-work characterisation depends on
  open item 23, whose identity is unestablished per v1.30 §32.3.
- Does not close open item 36.
- Does not touch F-Ward-1 or F-Ward-3. It records their inherited exposure; it
  does not act on it.
- **No live database contact.** This revision is source- and register-derived
  entirely.

## §11 Plan Version History (UPDATED)

Rows v1.0 through v1.30 carry forward from v1.30 unchanged. Appended:

| v1.31 | 2026-08-09 | `f499a3ba` | Cross-keystone register created and ratified by F-Stats-1 v1.31. Open item 40 (F-Stats-1) assigned owner XK-1. Open item 6 CLOSED with carve-out on two money-path assertions. §33 minted. No FD. |

## Register hygiene

- Creates: `docs/audit/Cross_Keystone_Register.md`. Ratifies XK-1.
- Closes: open item 6, with carve-out.
- Carries: open items 23 (identity unestablished), 36.
- Assigns ownership: open item 40 (F-Stats-1) → XK-1. Not a re-home; v1.24's
  re-home to the inventory stands and the inventory is not superseded.
- **Numeral disambiguation:** *open item 40 (F-Stats-1)* is unrelated to *FD-40
  (F-Deploy-1)*, which is the subject of
  `docs/audit/F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md`. Both
  live in `docs/audit/`. First reference in any document must carry the origin
  label in full.
- Changes no gate beyond item 6, no PR state, no unit disposition other than
  item 6's.
- Additive-supersede on v1.30; no destructive rewrite.
- Mints no FD. Tail unchanged: **FD-61**.

## Forward Statement

v1.31 is the plan-of-record.

**Open item 6 is CLOSED with carve-out.** Five of seven assertions closed;
purchase-below-cost and purchase-covered recorded as not covered, cited to XK-1.
The keystone is no longer blocked on an unowned item.

**XK-1 is owned but unremedied.** Ownership resolved the deadlock; it did not fix
48 tables. The remedy is unevaluated and touches a FROZEN prod.

**`worldEvents.js` remains unopened**, unchanged from v1.30 — its
remaining-work characterisation depends on open item 23, whose identity is
unestablished.

After F-Stats-1 closes: **F-Ward-1 next** — which inherits the §26 inventory's two
tables, eight of §30's canon-only wardrobe tables, and XK-1's
`episode_wardrobe` / `episode_wardrobe_defaults` exposure. Per XK-1's recorded
obligation, **F-Ward-1's first plan artifact must reference the inventory and
XK-1.** F-Ward-3 inherits `outfit_sets` / `outfit_set_items` under the same
obligation.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `f499a3ba`. Predecessor: v1.30.*
*Minted: §33. Closed: open item 6 (with carve-out). Carried: open items 23 and 36. Assigned: open item 40 (F-Stats-1) → XK-1. Mints no FD. Tail: FD-61. [skip-automerge]*
