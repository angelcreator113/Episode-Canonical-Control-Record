# F-Deploy-1 — Box/Repo Reconciliation: SESSION 1 RESULT (read-only delta)

> **READ-ONLY INVESTIGATION RESULT. AUTHORIZES NO BOX ACTION.**
> All findings below were produced by workstation-side, read-only git object
> reads (`hash-object`, `rev-parse`, `cat-file -e`). Nothing on `episode-backend`
> (`54.163.229.144`, `i-02ae7608c531db485`) was touched, fetched, or mutated.
> The box stays FROZEN. This note records the Sec 2 #1 / #2 delta findings from
> the Reconciliation Plan; it does not choose a strategy and does not schedule a
> box-alignment session.

| | |
|---|---|
| **Scope** | Sec 2 #1 (per-file box-vs-origin delta) and Sec 2 #2 (scripts-deletion delta) of `F-Deploy-1_Box_Repo_Reconciliation_Plan_DRAFT.md`. |
| **Method** | Git blob identity. Each captured box file hashed with `git hash-object`; compared to `git rev-parse origin/main:<path>`. Equal hash = byte-identical blob (immune to CRLF / encoding-render noise). Deletions tested with `cat-file -e origin/main:<path>`. |
| **Reference state** | origin/main HEAD `931526af` at time of reads. |
| **Inputs** | `Documents\PrimeStudios-Backups\box-uncommitted-20260608\` (five captured source files + 356KB patch). The migration was checked via the patch's recorded blob hashes, as it was not captured as a standalone file. |
| **Status** | Captured-modifications delta COMPLETE (six items, all already upstream). One check remains (two deploy files, expected-divergent — see Open Tail). |

---

## Finding 1 — All six captured modifications are already upstream

All five captured box source files plus the one tracked migration are
**byte-identical** to current origin/main. Blob hashes matched exactly:

| File (repo path) | Blob hash (box == origin/main) | Verdict |
|---|---|---|
| `src/config/sequelize.js` | `6b394fec` | Already upstream |
| `src/models/index.js` | `8e0c5236` | Already upstream |
| `src/models/CharacterState.js` | `988cd968` | Already upstream |
| `src/app.js` | `f6ea263e` | Already upstream |
| `src/middleware/aiRateLimiter.js` | `1a17fe82` | Already upstream |
| `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js` | `b8152d0c` | Already upstream |

The migration was checked differently from the five source files, which were
captured as standalone files in the backup dir; the migration's box version
exists only inside the 356KB patch. The patch header records the migration going
from blob `14d7a009` (the box's stale *committed* baseline) to `b8152d0c` (the
box's edited *working-tree* version). `rev-parse origin/main:` returned
`b8152d0c` — i.e. origin/main is byte-identical to the box's **edited** version.
Same verdict as the rest: the box edit reproduces what is already committed
upstream; redundant, never pulled.

**Migration content note (cross-reference, not a new finding):** the box edit
converts plain `addIndex` calls into idempotent self-healing logic — it
`describeTable`-checks for a missing `version` column and adds it if absent, then
uses `CREATE ... INDEX IF NOT EXISTS` instead of bare `addIndex`. The inline
comment states the reason: self-heal for partially-created tables from failed
prior attempts. This is the same defensive-migration / prod-doesn't-match-dev
schema-drift pattern the audit already flagged at `wardrobe.js:1291` and
`WorldEvent.js:57`. The migration is both already-in-canon AND itself an instance
of that documented hazard. Cross-reference in the audit; do not mint a new
finding.

**Both keystone-class worries from the Plan's Sec 0 are resolved as already-canon:**

- **sequelize split-brain fix (FD-36 / DATABASE_URL parse-pathway removal):**
  identical to origin/main. The fix is in canon. The box edit was redundant —
  the box never pulled it. Not box-unique.
- **F-Stats-1 Phase A CharacterState model (`index.js` registration +
  `CharacterState.js` model):** both identical to origin/main. The model is
  fully in canon, not prod-only. `CharacterState.js` being "untracked on the
  box" was an artifact of the box's stale git (predating the upstream commit),
  not evidence of box-unique work. No broken-reference state on main: the
  registration and the model file are both present and matching.

## Finding 2 — Sampled script deletions are already upstream

The 356KB patch carries ~90 `scripts/` deletions (AK-5-class cleanup). A sample
of four was tested for existence on origin/main via `cat-file -e`:

| Deleted script (from patch) | On origin/main? |
|---|---|
| `scripts/check-dev-db.sh` | absent |
| `scripts/deploy/FIX-MIME-TYPE-MANUAL.ps1` | absent |
| `scripts/deploy/TEST_SCENE_API.ps1` | absent |
| `scripts/deploy/add-s3-permissions.ps1` | absent |

All four are already absent on origin/main — i.e. main had already removed them;
the box deletion is redundant/un-pulled, not box-unique.

**Caveat (honest scope):** this is a 4-of-~90 sample, not a full enumeration. It
strongly indicates the whole AK-5 cleanup is already upstream and converges with
Finding 1, but it does not prove all 90. If certainty across all 90 is required
before the Session 3 box operation, run the same `cat-file -e` loop against the
full extracted deletion path list. Not run now — sample is sufficient to
characterize the pattern for Session 1.

## Headline

**No box-unique source work and no box-unique deletion work found** among
everything checked. The month of "uncommitted prod-only hand-edits" that FD-39
treated as potentially irreplaceable keystone work is — for all items checked —
**redundant with origin/main**. The box's divergence is "stale remote, never
pulled," not "work that exists only on prod."

**Implication for strategy (framing only, not a decision):** Strategy A's
commit-first spine ("turn box edits into PRs before aligning the box") appears
**not required** for the checked items, since there is nothing box-unique to
capture. This points reconciliation toward the lighter path — bring the box onto
committed code (Strategy A's second half, or Strategy B) — rather than the
heavier capture-then-align path the Plan budgeted for. Strategy choice still
belongs to a later step, after the Open Tail closes.

## Open Tail — to finish Session 1

One check remains before the delta table is fully complete:

1. **`ecosystem.config.js` and `.github/scripts/deploy-production.sh`** — added
   to the Sec 2 #1 delta list this session. These are EXPECTED to diverge: Sec 0
   establishes the box runs the pre-#746 4-app `ecosystem.config.js`, and PR #752
   (the corrected deploy script) exists only on origin/main. Hash to confirm and
   quantify the divergence; the expected verdict is "box is behind," not
   "box-unique work." This is #752 territory — both files belong to the Session 3
   box-alignment / Track-B topology step, parked until then. Confirmation, not
   discovery.

The migration file (`20260718000000-…`) was in this tail in the prior revision;
it is now RESOLVED — see Finding 1.

## Relationship to existing plans

- **Reconciliation Plan:** this note supplies the Sec 2 #1/#2 delta findings the
  Plan's Session 1 was scoped to produce. Sec 2 #3 (does clean origin/main boot
  on the dev box, dev-safe config) and Sec 2 #4/#5 remain open and unaffected by
  this note.
- **#752:** verified-correct and parked; this note confirms its premise (box runs
  the older deploy/ecosystem files).
- **F-Stats-1:** CharacterState model confirmed in canon — relevant to the
  Phase B sequencing; confirm against the F-Stats-1 plan, do not infer an unblock
  from this note alone (Phase B remains gated on F-Deploy-1 full close).
- **FD register / handoff:** this materially lightens FD-39's severity (no
  box-unique work found in the checked set). Fold into the next handoff; do NOT
  inline fingerprint numbers — point to this note and the Plan.

---
*Session 1 read-only delta result for the prod box/repo divergence. All six
captured modifications (five source files + one migration) byte-identical to
origin/main; sampled script deletions (4/90) already absent upstream. No
box-unique work found in the checked set — divergence is "stale remote, never
pulled." One check remains (the two expected-divergent deploy files). Box stays
FROZEN; no strategy chosen; no box session scheduled.*
