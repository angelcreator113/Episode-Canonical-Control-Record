# F-Stats-1 Surface Re-verification — 2026-07-21

**Purpose:** Certify F-Stats-1's audit map (Fix Plan v1.1/v1.2, Phase B G1
Planning) against current main, so the post-keystone executing session
inherits a live map, not a May-era one. Read-only exercise; no box
contact; no register mutation — findings routed to their owning
documents' next revisions.

**Basis (all reads this session, main at 45d73f00 / #944):** Fix Plan
v1.2 full header + delta sections; v1.1 section map; Phase B G1 Planning
section map; PR #684 metadata + merge commit; git grep / git show reads
per anchor as cited inline; every empty result exit-code-guarded or
re-read per FD-51.

## Provenance corrections

- Fix Plan v1.2 header's Phase A G2 commit `178c981` is the PRE-SQUASH
  branch commit, unreachable from main by design. The model landed as
  squash commit **30f10fe7** (#684, merged 2026-05-15) — the only commit
  ever to touch src/models/CharacterState.js. Model present and
  unmodified since.

## Anchor scorecard (v1.1 s12 findings vs main at 45d73f00)

| Anchor | Pinned | Verdict | Evidence |
|---|---|---|---|
| s12.1 helper | evaluation.js:45 | **HOLDS EXACT** | getOrCreateCharacterState at :45; call sites :217, :289 |
| s12.3 drift comment | evaluation.js:619-623 | **SUPERSEDED-IN-PART** | :621 comment now documents a FIX, not the bug (see Unregistered Remediation) |
| s12.6 atomic self-ref | wardrobe.js:1251 | **HOLDS, mechanism drift** | :1251 still `SET coins = coins - :cost` — atomic self-reference intact as parameterized raw SQL; no sequelize.literal remains (guarded grep, exit 1) |
| s12.8 in-file drift | worldEvents.js | **ALIVE, re-documented** | ~3831: fresh endpoint comment names 'justawoman' canonical and warns of 'lala' elsewhere |
| s12.10 stale comment | worldEvents.js:3834 | **ANCHOR SUPERSEDED** | File grew; pinned text gone; region now holds next-suggestions endpoint (new code) |
| s12.13 txn wrapper | episodeCompletionService:405 | **FIXED IN evaluation.js** (service itself unverified this pass) | evaluation.js ~614: transaction wraps state UPDATE + history + ledger mirror |
| s12.15 history mutation | financialPressureService | **HOLDS EXACT — unremediated** | :197 SELECT + :208 UPDATE character_state_history in place; the audit ledger is still mutated as live state |
| s12.18-adj pipeline 'lala' | careerPipelineService | **REMEDIATED, unregistered** | No character_key='lala' query remains (guarded, exit 1 on quoted form; case-insensitive hits are narrative columns only). worldEvents ~3832 warning is now STALE — cautions against a fixed bug |
| wardrobe 'lala' paths | wardrobe.js | **LIVE, unremediated** | :1236 read + :1251 purchase-deduct + :1342 read all `character_key = 'lala'` |

## Headline finding — the drift is now ASYMMETRIC

Partial remediation has sharpened the split-brain, not closed it:
evaluation.js writes are canonical-'justawoman' (the 'key === lala' gate
was DROPPED — its own comment says so); episode-completion deltas write
'justawoman' (worldEvents comment, matching episodeCompletionService:176
per that comment); but **wardrobe reads and purchase-deducts against the
'lala' row** (:1236/:1251/:1342). A purchase debits a row that
evaluation edits and episode income never touch. The s12.12 war-chest
bug is live, and the asymmetry means the two rows now diverge by
DIFFERENT mechanisms than the audit described. character_state still
lacks a unique constraint (unchanged; not re-verified this pass —
carried).

## Unregistered remediation (good work, no register entry)

evaluation.js's transaction wrapper, ledger mirror, idempotent seeding,
and lala-gate drop landed via commit **ddebf9d3** ("Claude/f auth 1
backup", #658) — F-AUTH-1-adjacent work predating #684. No F-Stats-1
register entry claims it. careerPipelineService's 'lala'-query removal
is similarly unclaimed (introducing commit not traced this pass).
Reconciliation — which document credits these and revises s12.3/s12.13/
s12.18 — belongs to the next F-Stats-1 register revision, not this note.

## Planning-doc PR inventory staleness verdicts

- **PR 3 evaluation.js (HIGH): MATERIALLY STALE.** Scoped against
  pre-remediation code; the executing session will find half-converted
  territory. Inventory (s6.1) must be re-derived before execution.
- **PR 2 wardrobe.js (HIGH): PARTIALLY STALE.** s12.6 mechanism changed;
  'lala' paths confirmed live; file touched by five PRs since planning
  (#585/#599/#606/#608/#647). Inventory (s5.1) re-derivation recommended.
- **PR 1 careerGoals.js + episodes.js, PR 4 worldEvents.js (LOW): NOT
  VERIFIED THIS PASS.** worldEvents grew substantially (pinned region
  now different code) — treat s4.1 as suspect. s3.1 unassessed.

## Handoff clause

The executing session (post-F-Deploy-1-keystone-close, per Decision #9)
inherits from this note: anchor verdicts above, provenance corrections,
and the asymmetric-drift framing. It must still re-derive: the four PR
conversion inventories line-by-line against its own HEAD; the
character_state constraint status; episodeCompletionService's own
transaction posture; and the unregistered-remediation reconciliation.
This note certifies the map's state at 45d73f00 only. Live state beats
this note the moment main moves.

---
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-21. Main at 45d73f00 (#944). Read-only. [skip-automerge]*