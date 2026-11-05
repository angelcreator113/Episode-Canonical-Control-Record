# Corrections A and B: execution record (2026-11-05)

**Status:** applied and verified on production on 2026-11-05. Evoni accepted both as complete in the session that ran them. This records what ran, what it changed and what it left untouched. The prepared plan, guards and undo scripts are in `docs/reads/2026-11-04-prepared-corrections.md` and `docs/reads/2026-11-04-corrections/`.

No migration, deploy or schema change was part of either correction.

## 1. How they ran

- **Approvals:** Evoni gave a separate yes for each. "YES TO A" was reaffirmed on 2026-11-05 after a read-only preflight. "YES TO B" was given after A had been verified and accepted.
- **Path:** each script ran on the production instance through SSM, as the box's `ubuntu` user, with the migration credential (the owner of `data_correction_log`).
- **Access check first:** before A ran, the SSM access was checked and narrowed to the production instance only. A harmless command sent to any other instance is refused.
- **The scripts were not modified.** The copies on the box matched `main` byte for byte (sha256):

| Script | sha256 |
|---|---|
| `A-episode1-purpose.sql` | `002ac9225694b958bbf915e1c3c55ad2212d5e7551bd7b46a66ad12496402eee` |
| `A-verify.sql` | `e0bd5fbfe32813236e3e4725cab9a4ac1ddf35b47c84e1334dff3b65a549d253` |
| `A-undo.sql` | `931bf5ab0b88a182bda1daa48710a4cc0fea531697cd00c0e2410d582b465406` |
| `B-unown-test-items.sql` | `421a6d3a78b5f87fea029f97f849ef4bc2c650ddfd2930fc7164d3f734c1a1f7` |
| `B-verify.sql` | `1f6aab8c5d68551e1c39e8fa7183304773e1e90a7db5edf77bca0c96c4d86988` |
| `B-undo.sql` | `da8664aa56d1e97f9a7ffd81034a948d413953602fbb41c3c19826100cbcd582` |

- **Sequence:** each correction ran in this order:
  1. a read-only side check (fingerprints of everything the correction must not touch, plus every table's write counters);
  2. the correction script (SERIALIZABLE, row locks, exact guards and post-checks; it rolls back on any mismatch);
  3. its verify script;
  4. the side check again, compared with step 1.
- **No other activity:** no application traffic wrote to the database between the two side checks of either correction.

## 2. Correction A: Episode 1 narrative purpose

- **Applied:** 2026-11-05 22:24:45 UTC. Log key **`A-2026-11-04`**, with 4 rows: `story_purpose`, `story_purposes`, `intention_source`, `narrative_purpose`. All were applied by `postgres` and none has been undone.
- **What changed:**
  - **Season Roadmap slot 1** (`season_slots` `3e9a5200-…`):
    - `story_purpose` is now the approved paragraph ("Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.").
    - `story_purposes` holds the same text, with source `edited`.
    - `intention_source` is now `edited`.
  - **Episode 1 Brief Intent** (`episode_briefs` `661234d3-…`, still `draft`):
    - `narrative_purpose` is now the same paragraph, plus "Core dilemma: How much should Lala invest in being seen before she knows whether the opportunity will pay off?" and "Creator lesson: Looking successful and building a sustainable creator career aren't always the same thing."
- **Verified (`A-verify.sql`):**
  - `slot_purpose_exact` t;
  - `slot_purposes_exact` t;
  - `brief_intent_exact` t;
  - `frozen_snapshot_unchanged` t.
- **Unchanged:**
  - **The frozen Start snapshot** (`episodes.season_context` for Episode 1). It keeps the original purpose and `snapshotted_at` 2026-10-02T06:23:32.276Z. Its append-only correction note (prepared-corrections §3) was not written; it was never part of A.
  - **The show's other 23 slots, other 5 briefs and all 23 episodes:** identical fingerprints.
- **Write counters:** across `public`, the only moves were `season_slots` +1 update, `episode_briefs` +1 update and `data_correction_log` +4 inserts.

## 3. Correction B: un-own the four test-voided wardrobe items

- **Applied:** 2026-11-05 22:28:04 UTC. Log key **`B-2026-11-04`**, with 4 rows, each `is_owned` `true` → `false`. All were applied by `postgres` and none has been undone.
- **Guards before B** (all as prepared):
  - 4 items owned, live and in this show;
  - their ledger rows: 0 executed and the 4 reviewed voided ones;
  - 8 references in total: 4 `episode_wardrobe` links to the deleted test episode, plus the 4 ledger rows. Every other reference type was 0.
- **What changed:** `is_owned = false`, and `updated_at`, on:
  - `46967b7a-…` Crystal Lace-Up Clear Stiletto Sandal;
  - `051d2cac-…` Molten Gold Double Pearl Drop Earrings;
  - `ee7a7e6b-…` Polka Dot Puff Halter Mini Dress;
  - `a173120e-…` Sage Corset Lace-Up Halter Midi.
- **Verified (`B-verify.sql`):**
  - all four are `f`;
  - their 4 ledger rows are still `voided`;
  - the 4 test-episode links are kept;
  - Lala's coins are 768;
  - owned items are 9.
- **Unchanged:**
  - **Transaction history:** the 10 rows, the sum and the fingerprint (below) are all identical, and no row was deleted or edited.
  - **The four items,** apart from `is_owned` and `updated_at`.
  - **The show's other 53 wardrobe rows,** `episode_wardrobe` and Correction A's 4 log rows: identical fingerprints.
  - **Correction A:** `A-verify.sql` gives the same results after B.
- **Write counters:** across `public`, the only moves were `wardrobe` +4 updates and `data_correction_log` +4 inserts.

## 4. Baselines preserved

| Item | Before A | After A | After B |
|---|---|---|---|
| Lala coins (`character_state`) | 768 | 768 | 768 |
| `character_state` for the show (1 row, whole-row md5) | `e8c82c13…` | identical | identical |
| Prime Bank ledger: rows / sum / md5 | 10 / 4472.00 / `de4ca45fcc333b4e57cbcf4054cec387` | identical | identical |
| Transaction history, whole-row md5 | `9c2383fd…` | identical | identical |
| Wardrobe owned (57 rows) | 13 | 13 | **9** |
| Continuity tables (timelines, characters, beats, beat characters) | 0 rows each | identical | identical |
| `data_correction_log` rows | 0 | 4 (A) | 8 (A 4, B 4) |

## 5. Undo

Neither undo has been run, and each would need Evoni's separate yes.

- **A:** `docs/reads/2026-11-04-corrections/A-undo.sql` restores the 4 previous values from log key `A-2026-11-04` and marks those rows undone.
- **B:** `docs/reads/2026-11-04-corrections/B-undo.sql` sets the four items back to owned from log key `B-2026-11-04` and marks those rows undone.

The log's guards stop either correction from being applied twice.

## 6. Nothing further is needed to close A and B

No database correction, migration, deploy or configuration change is outstanding for A or B. Prepared-corrections items that were never part of A or B remain separate decisions, and nothing was written for them:

- the snapshot correction note (§3);
- the provisional pre-owned items (§4.2);
- the plaid vest dress (§4.3);
- the Lock-origin charges (§4.4).
