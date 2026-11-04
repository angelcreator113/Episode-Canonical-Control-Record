# Prepared corrections for review (2026-11-04)

**Status:** prepared, **not applied**. No production write, migration, merge or deployment has happened. Each block below needs Evoni's separate, explicit approval before it runs. All SQL here is for review; the only thing to run now is the read-only `wardrobe-dependencies.sql` (§5), which confirms the "before" values.

## 1. Which record owns an episode's narrative purpose (architecture)

**Today there are two copies:**
- `season_slots.story_purpose` / `story_purposes[]`: the Season Roadmap, edited by the slot editor (`saveIntention`) or auto-drafted.
- `episode_briefs.narrative_purpose`: the Episode Brief's Intent, read by the script writer and scene planner.

`seasonSlotService` copies the slot's purpose into the brief **only when the brief's field is blank**. After that, the two drift independently (Episode 1's brief holds the event's marketing copy, while its slot holds the auto-drafted "design voice" line).

**Recommendation:**

| Phase | Authoritative record | The other screen |
|---|---|---|
| **Before an episode exists** (a planned slot) | **Season slot** `story_purpose` (the plan) | — |
| **From Start Episode onward** | **Episode Brief** `narrative_purpose` (what the episode is for; what generation reads; locked with the brief) | The **Season Roadmap shows the episode's brief purpose read-through** for that slot, labelled "from Episode Brief", with an "Edit in Episode Brief" link. The slot's own text is kept as the **planned** purpose (history), not edited independently. |

**Why the brief:**
- Generation reads it.
- It locks with the brief.
- It is episode-scoped.
- The Intent ruling already chose `narrative_purpose`.

The slot keeps what is genuinely season-level: the story threads on `story_purposes[]`, career focus, pressure and outcome range.

**Mechanics (a later PR, design only):**
- The Roadmap's slot read includes `brief.narrative_purpose` when `episode_id` is set.
- The slot editor, on a started slot, edits the **brief's** purpose (through the brief route, respecting its lock) instead of re-writing the slot and **re-snapshotting `season_context`** (see §2.3).
- The one-time copy at Start stays.

## 2. Edits 1 and 2: Episode 1 narrative purpose

**Approved wording** (readiness report §12):
- **Narrative purpose:** "Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities."
- **Core dilemma:** "How much should Lala invest in being seen before she knows whether the opportunity will pay off?"
- **Creator lesson:** "Looking successful and building a sustainable creator career aren't always the same thing."

### 2.1 Affected records, existing values and proposed replacements

| # | Record | Field | Existing value (production, 2026-11-04) | Proposed value |
|---|---|---|---|---|
| 1a | `season_slots` `3e9a5200-161e-4369-b596-a915a268cd43` (S1 · slot 1) | `story_purpose` | "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey." | the **Narrative purpose** paragraph |
| 1b | same slot | `story_purposes` | `[{"text": "Lala discovers her authentic design voice…", "source": "auto-drafted", "primary": true, "story_thread_id": null}]` | `[{"text": "<Narrative purpose paragraph>", "source": "edited", "primary": true, "story_thread_id": null}]` |
| 1c | same slot | `intention_source` | *(confirmed by E1 before applying)* | `edited` (so auto-draft can never overwrite it) |
| 2 | `episode_briefs` for episode `8b9301a6-2d99-45a7-8488-4fe40504dd55` (status **draft**) | `narrative_purpose` | "Wearable Experiments Studio Session — Step into STUDIO BY SABLE's workspace for an evening dedicated to celebrating independent design innovation. This showcase brings together wearable art… Expect a thoughtfully curated evening that honors craft, experimentation, and the stories behind each garment." (the event description) | the paragraph + "Core dilemma: …" + "Creator lesson: …" (three paragraphs) |
| — | `episodes.season_context` (frozen Start snapshot, `snapshotted_at` 2026-10-02T06:23:32.276Z) | — | unchanged | **unchanged** (the correction note is §3; not written now) |

**Not touched:**
- career focus, pressure, outcome range;
- the slot's event link;
- the brief's other fields;
- the script, locked beats, approved dialogue, story record;
- ledger, stats, wardrobe.

### 2.2 Side effects

- **Future** script and scene generation for Episode 1 reads the new Intent. Existing script text is not changed.
- The auto-drafter will not overwrite the slot (it never drafts over `edited`).
- The Start copy is not re-run (the brief is no longer blank).
- **No continuity effect:** wording is not state.

### 2.3 Why not use the slot editor (finding)

`PUT /world/:showId/season/slots/:slotId/intention` (`seasonIntentionService.saveIntention`) has a side effect: on a started slot whose episode is still a draft (Episode 1), it calls `seasonSlotService.snapshotEpisode`, which **rebuilds `episodes.season_context` from scratch with a new `snapshotted_at`**. That would overwrite the frozen Start snapshot Evoni asked to preserve.

It also requires the full intention body (career focus, pressure, outcome range); a partial body would clear them.

So the prepared change is a **narrow, guarded update** of exactly the fields in §2.1.

### 2.4 Prepared change (NOT run; requires approval; app credentials, not the read-only user)

```sql
-- Episode 1 narrative purpose: edits 1 and 2 (prepared 2026-11-04; run only on Evoni's explicit yes).
BEGIN;
-- Guards: abort unless the records hold exactly the reviewed "before" values.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43'
       AND story_purpose = $t$Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.$t$) THEN
    RAISE EXCEPTION 'slot 1 purpose is not the reviewed value; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM episode_briefs WHERE episode_id = '8b9301a6-2d99-45a7-8488-4fe40504dd55' AND deleted_at IS NULL
       AND status = 'draft' AND narrative_purpose LIKE 'Wearable Experiments Studio Session%') THEN
    RAISE EXCEPTION 'Episode 1 brief is not the reviewed draft value; nothing changed';
  END IF;
END $$;

-- Edit 1: Season slot 1 purpose (season_context is NOT touched).
UPDATE season_slots
   SET story_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$,
       story_purposes = jsonb_build_array(jsonb_build_object(
         'text', $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$,
         'source', 'edited', 'primary', true, 'story_thread_id', NULL)),
       intention_source = 'edited',
       updated_at = NOW()
 WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43'
RETURNING id, story_purpose, intention_source;

-- Edit 2: Episode 1 brief Intent (narrative_purpose).
UPDATE episode_briefs
   SET narrative_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.

Core dilemma: How much should Lala invest in being seen before she knows whether the opportunity will pay off?

Creator lesson: Looking successful and building a sustainable creator career aren't always the same thing.$p$,
       updated_at = NOW()
 WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND episode_id = '8b9301a6-2d99-45a7-8488-4fe40504dd55' AND deleted_at IS NULL AND status = 'draft'
RETURNING id, left(narrative_purpose, 80);
COMMIT;
```

### 2.5 Undo (prepared)

The undo restores the exact before values. `story_purposes` and `intention_source` are filled in from the E1 read (§5) before approval, and the brief text from the E1 `narrative_purpose`. It is guarded the same way: it runs only while the records still hold the new values.

```sql
-- Undo of edits 1 and 2 (exact before values from E1, 2026-11-04). Runs only while the new values are in place.
BEGIN;
UPDATE season_slots
   SET story_purpose = $o$Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.$o$,
       story_purposes = $j$[{"text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "source": "auto-drafted", "primary": true, "story_thread_id": null}]$j$::jsonb,
       intention_source = 'auto-drafted', updated_at = NOW()
 WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43' AND intention_source = 'edited' AND story_purpose LIKE 'Lala enters Studio by Sable%';
UPDATE episode_briefs
   SET narrative_purpose = $o$Wearable Experiments Studio Session — Step into STUDIO BY SABLE's workspace for an evening dedicated to celebrating independent design innovation. This showcase brings together wearable art—from conceptual sculptural pieces to documentary-driven collections—created by emerging designers working at the intersection of fashion and fine art. Move freely through the studio's gallery-like setting, examine pieces in intimate detail, and speak directly with creators about their inspirations and techniques. Expect a thoughtfully curated evening that honors craft, experimentation, and the stories behind each garment.$o$,
       updated_at = NOW()
 WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND narrative_purpose LIKE 'Lala enters Studio by Sable%';
COMMIT;
```

**E1 before values (production, 2026-11-04), confirmed:**

| Record | Value |
|---|---|
| slot `3e9a5200…` | `story_purpose` = the "design voice" sentence; `story_purposes` = one auto-drafted primary entry; `intention_source` = `auto-drafted`; career focus "Build the Portfolio, First Impressions", pressure Low, outcome safe–pass (all unchanged by the edit); `updated_at` 2026-10-02 06:23:32 |
| brief `661234d3-bf88-4c8f-b253-8352261185da` | draft; `narrative_purpose` = the event description; `updated_at` 2026-10-27 21:37:50 |
| frozen `season_context` | `snapshotted_at` 2026-10-02T06:23:32.276Z; `story_purpose` = the "design voice" sentence (kept as is) |

## 3. Frozen Start snapshot: append-only correction note (prepared, NOT written)

**The original is preserved byte for byte.** `episodes.season_context` keeps every existing key, including the old `story_purpose` and `snapshotted_at` 2026-10-02T06:23:32.276Z.

The note would be **appended** under a new key, `corrections`:

```json
{
  "corrections": [
    {
      "field": "story_purpose",
      "original_text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.",
      "corrected_text": "Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.",
      "reason": "Lala is not becoming a fashion designer (Evoni, 2026-11-04).",
      "authority": "continuity-readiness report §12; Evoni's approval of the wording",
      "corrected_by": "Evoni",
      "corrected_at": "<set when written>",
      "snapshot_snapshotted_at": "2026-10-02T06:23:32.276Z"
    }
  ]
}
```

**Writing it later** (separate approval): one guarded UPDATE that uses `jsonb_set` to add or append `corrections` only, and fails if `snapshotted_at` differs from the reviewed value. **Undo:** remove the appended element; the rest of the snapshot is untouched.

**Readers:** prefer the newest correction for display and generation, and show the original as "as frozen at Start".

## 4. Wardrobe: answered decisions and prepared plans

### 4.1 Four test-voided items: remove ownership that exists only because of voided test purchases (plan only)

| Item ID | Name | Coins | Voided ledger row | Known references |
|---|---|---|---|---|
| `051d2cac-3723-404b-b481-5274dcb88957` | Molten Gold Double Pearl Drop Earrings | 285 | `1e9da9a3-e7fc-48a7-850e-295c1ae7945d` (`select`) | `episode_wardrobe` → deleted test episode "I Got Invited to the Underground's Most Exclusive Night" (`be95953c`) |
| `ee7a7e6b-6583-4f2f-8c73-a44785a77c34` | Polka Dot Puff Halter Mini Dress | 385 | `d7b34f33-b51d-4d3f-8659-3f2dd2516575` (`select`) | same |
| `46967b7a-6a9a-4453-b75a-aa5eb7806031` | Crystal Lace-Up Clear Stiletto Sandal | 385 | `b008d849-f3f1-4306-a32f-31ae18d844ac` (`select`) | same |
| `a173120e-2618-4da2-bed1-e6ace3a4d867` | Sage Corset Lace-Up Halter Midi | 385 | `3408a459-f230-48e5-8c80-11fd1c173588` (`lock_outfit`, on `be95953c`) | same |

**Every** reference to these items (lookbook images, brand tags, order lines, event outfit pieces, polls, reveals, posts) is listed by the read-only `wardrobe-dependencies.sql` W2 (§5) **before** any plan is approved.

**Reversible correction plan** (prepared; run only on approval, after W2):
1. **Snapshot:** save W1 (`id, is_owned, updated_at`) and W2 to an undo manifest.
2. **One guarded transaction.** For each item, `UPDATE wardrobe SET is_owned = false, updated_at = NOW() WHERE id = :id AND is_owned = true AND NOT EXISTS (executed, non-deleted purchase row for it)`. It refuses any item that has gained a legitimate purchase since.
3. **Records left untouched:**
   - the voided ledger rows stay as history;
   - `episode_wardrobe` links to the deleted test episode stay (that episode is deleted, so they don't count);
   - nothing is deleted.
4. **Undo:** `UPDATE wardrobe SET is_owned = true WHERE id IN (…manifest…) AND is_owned = false`.
5. **Effect:** the four items become "for sale" again at their coin cost. The balance does not change (their rows were already voided).

**W2 dependency results (production, 2026-11-04):** each item has exactly two references, and nothing else:
- one `episode_wardrobe` link to the **deleted** test episode "I Got Invited to the Underground's Most Exclusive Night" (approved): link ids `129ceb3c…` (earrings), `8e5ae4e7…` (sandal), `8a72dfad…` (corset midi), `cd862526…` (polka dot dress);
- its **voided** ledger row (reason "Test data, not story purchases (Evoni, 2026-09-29)").

There are no lookbook images, brand tags, order lines, event outfit pieces, polls, reveals or posts. All four are owned (`is_owned = true`); three were last touched in one action at 2026-09-26 02:26:33 and the dress at 00:39:29.

**Prepared un-own (NOT run; requires approval; app credentials):**

```sql
-- Remove ownership that exists only because of voided test purchases (D2). Guarded; leaves links and ledger rows as history.
BEGIN;
CREATE TEMP TABLE d2_undo ON COMMIT DROP AS
  SELECT id, is_owned, updated_at FROM wardrobe
   WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867');
SELECT * FROM d2_undo;   -- copy this output: it is the undo manifest
UPDATE wardrobe w SET is_owned = false, updated_at = NOW()
 WHERE w.id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867')
   AND w.is_owned = true AND w.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM financial_transactions ft
                    WHERE ft.source_id::text = w.id::text AND ft.status = 'executed' AND ft.deleted_at IS NULL)
RETURNING w.id, w.name, w.is_owned;   -- expect exactly 4 rows; if not, ROLLBACK
COMMIT;
```

**Undo:**

```sql
UPDATE wardrobe SET is_owned = true, updated_at = NOW()
 WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867')
   AND is_owned = false;
```

**Effect:**
- The four pieces become available to buy again at their coin cost.
- The balance is unchanged (their rows were already voided).
- The deleted test episode's links stay as history.

### 4.2 Necklace, pumps, blouse: provisionally pre-owned (no write)

| Item ID | Name | Coins |
|---|---|---|
| `b20b20af-1df4-4d5c-a4f2-1913b239835a` | Crimson Crystal Lariat Drop Necklace | 285 |
| `f06a2373-4dcc-46f0-8a2c-b87b53e79eb7` | Crimson Satin Ballerina Pump | 685 |
| `ba5e3bd8-424a-4bce-8a43-bd63a8922384` | Champagne Satin Oversized Button-Down Blouse | 165 |

- **For continuity planning:** owned before Episode 1 (story position "pre-season"), **provisional**, not verified, never charged.
- **No schema exists** to mark this, so for now the provisional status lives in the continuity design and the preview. A later `ownership_status` (`verified` | `provisional_pre_owned` | `unresolved`) plus an acquisition note is part of the continuity migration request (G-M2).

### 4.3 Plaid vest dress: unresolved (no write)

| Item ID | Name | Coins |
|---|---|---|
| `dc3c7b98-fa70-441c-9c94-a842f079811f` | Glen Plaid Safari Vest Dress | 185 |

- **Excluded from canonical wardrobe availability** in the continuity view until verified.
- `is_owned` is **not** changed in production. The exclusion is a continuity rule, not a data change.

### 4.4 Episode 1 Lock charges: legacy Lock-origin purchases (no write)

| Ledger row | Item | Coins | Flow |
|---|---|---|---|
| `97161723-af81-4489-9151-43b93569bc7a` | Noir Lace Illusion Pencil Skirt | 85 | `lock_outfit` |
| `9a039e46-895e-46ae-b3cd-1d56b9292296` | Crimson Bloom Enamel Stud Earrings | 32 | `lock_outfit` |
| `4a599f77-0c02-4894-a9b5-f2c3e83bf812` | Cloud Nine Pink Rainbow Eau de Parfum | 95 | `lock_outfit` |
| `ec194628-c2ac-4959-8feb-168c6b14ad4c` | Crystal Constellation Bucket Minaudière | 800 | `lock_outfit` |

These are kept as valid historical purchases. No refund and no duplicate charge.

**Classification:** "legacy Lock-origin purchase". Continuity reads it from `metadata.flow = 'lock_outfit'` on rows dated before the purchase-path fix. **No metadata is rewritten.** If a stored label is later wanted, it is an appended `metadata.classification` (separate approval).

## 5. Read-only query to run before approving anything

`wardrobe-dependencies.sql` (read-only; validated on the test database):

| Section | Reads |
|---|---|
| W1 | the four items now |
| W2 | every reference to them, across episode wardrobe, lookbook images, brand tags, order lines, event outfit pieces, polls, reveals, ledger and posts |
| E1 | the exact current values of slot 1, the Episode 1 brief and the frozen `season_context`, which complete the undo in §2.5 |

## 6. Bonus specials (answered; nothing to prepare)

All three are preserved as distinct stories:
- `53d218f3…` Midnight Atelier: Dark Couture Preview;
- `f7f6208d…` Studio Access: The Obsidian Preview;
- `e8a5fcff…` the LalaVerse Halloween talent show.

Story order and release times stay pending Evoni's review. They stay excluded from continuity carry-over (ambiguous same-slot order). No deletion, merge or rescheduling.

## 7. Execution procedure for A and B (approved by Evoni 2026-11-04; run only after this procedure is confirmed)

The files live in `docs/reads/2026-11-04-corrections/`:

| File | Purpose |
|---|---|
| `A-episode1-purpose.sql` | the change |
| `A-verify.sql` | read-only check |
| `A-undo.sql` | rollback |
| `B-unown-test-items.sql` | the change |
| `B-verify.sql` | read-only check |
| `B-undo.sql` | rollback |

**A** is the §2.4 SQL with `ON_ERROR_STOP`, plus a post-update check inside the transaction that confirms the frozen snapshot is unchanged.

**B** is the §4.1 SQL with the manual "expect exactly 4 rows" turned into automatic guards. Inside one transaction, it stops (nothing changed) unless:
- exactly 4 of the items are owned;
- 0 valid purchases exist for them;
- exactly the 8 reviewed references exist (4 test-episode links + 4 voided rows);
- exactly 4 ownership changes result;
- the Prime Bank ledger sum and row count are unchanged.

**Local test against a fixture mirroring the production rows (2026-11-04):**

| Test | Result |
|---|---|
| A run | `UPDATE 1`, `UPDATE 1`, `COMMIT`, `A COMMITTED` |
| A verify | slot `edited` / `edited` / "Lala enters Studio by Sable…"; brief draft with the dilemma and lesson; snapshot `2026-10-02T06:23:32.276Z`, the original text, no `corrections` key |
| A rerun | `A STOPPED: slot 1 is not the reviewed value; nothing changed` (exit 3) |
| A undo | exact before values restored |
| B run | 4-row manifest, `UPDATE 4`, `COMMIT`, `B COMMITTED` |
| B verify | 4 items not owned; voided rows kept (4); test-episode links kept (4) |
| B rerun | `B STOPPED: expected 4 owned items, found 0` |
| B with a valid purchase present | `B STOPPED: 1 valid purchase(s) now exist` |
| B with an extra reference | `B STOPPED: expected the 8 reviewed references…, found 9` (ownership unchanged) |
| B undo | ownership restored |

**On the box** (writes need the **app** database user from `~/episode-metadata/.env`; no value is printed):

```
getv(){ grep -E "^$1=" "$2" | tail -1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']\$//"; }
APP=~/episode-metadata/.env
export PGHOST="$(getv DB_HOST $APP)" PGDATABASE="$(getv DB_NAME $APP)" PGPORT="$(getv DB_PORT $APP)"
[ -z "$PGDATABASE" ] && export PGDATABASE="$(getv DB_DATABASE $APP)"; export PGPORT="${PGPORT:-5432}" PGSSLMODE=require
export PGUSER="$(getv DB_USER $APP)" PGPASSWORD="$(getv DB_PASSWORD $APP)"
# A (independent):
psql -X -f ~/A-episode1-purpose.sql; echo "exit $?"
psql -X -f ~/A-verify.sql
# B (independent):
psql -X -f ~/B-unown-test-items.sql; echo "exit $?"
psql -X -f ~/B-verify.sql
unset PGPASSWORD
```

**Expected success:**

| Step | Expected |
|---|---|
| A | `UPDATE 1` twice, `DO`, `COMMIT`, `A COMMITTED`, `exit 0` |
| A verify | slot `edited` / `edited` / "Lala enters Studio by Sable's…"; brief `draft`, `has_dilemma t`, `has_lesson t`; frozen snapshot `2026-10-02T06:23:32.276Z`, "Lala discovers her authentic design voice…", `has_corrections f` |
| B | manifest of 4 rows (all `is_owned t`), `UPDATE 4`, `DO`, `COMMIT`, `B COMMITTED`, `exit 0` |
| B verify | the 4 items `is_owned f`; `voided 4` and no `executed` row; `test_episode_links_kept 4`; `lala_coins 768` (unchanged); `owned_items 9` (was 13) |

**Any `A STOPPED` or `B STOPPED` (exit 3):** nothing was changed. Stop, paste the output, and do not retry or adjust.

**Undo** (only on Evoni's request): `psql -X -f ~/A-undo.sql` and/or `psql -X -f ~/B-undo.sql`.

## 8. Version 2: the three safeguards (Evoni's review question, 2026-11-04)

**Answer to the review question about version 1:** none of the three safeguards was in place.
1. **Exact full-value comparisons:** no. The old brief Intent and the after-checks used `LIKE` prefixes (v1 `A-episode1-purpose.sql` lines 17 and 39–43).
2. **Concurrency protection:** no. There were no row locks, no isolation level, and no show lock in B.
3. **Durable, conditional undo:** no. B's manifest was a temporary table plus console output; the undo files used hard-coded values and prefix matches.

**Version 2** replaces every file in `2026-11-04-corrections/`. Nothing has been executed.

| Safeguard | Implemented in v2 |
|---|---|
| **1. Exact full values** | A compares the slot `story_purpose` and `story_purposes` (jsonb equality), `intention_source`, the brief `narrative_purpose` (all 615 characters) and the frozen `season_context` (jsonb equality) with `=` before the change. After the change it checks every new value with `=` and the snapshot again. `00-preflight.sql` prints md5 fingerprints that must match before anything runs: slot purpose `3bdba32fcc61f942ea888962f2e112f8`, slot purposes `37c3bc219a3c36bc2c63ced52c4fa560`, brief `7ee5fbf79bc60eeb6d03531f8cb3f76e` (length 615), snapshot `87af8a60b96fae7b3d7419f1fa72e6cb`. |
| **2. Concurrency** | Both run `BEGIN ISOLATION LEVEL SERIALIZABLE` with `lock_timeout 10s`. **A** locks the slot, brief and episode rows `FOR UPDATE` before its guards. **B** takes the **same show lock that purchases take** (`shows … FOR NO KEY UPDATE`, as `coinLedgerSync.lockedLedgerBalance` does), so no purchase, Lock or Complete charge can interleave. It also locks the four wardrobe rows `FOR UPDATE` (blocking ownership edits and FK-linked references), then re-checks purchases, the exact four voided row ids, all eight references and that the four links point to the deleted test episode. Serializable isolation aborts anything the locks do not cover. |
| **3. Durable, conditional undo** | A new table **`data_correction_log`**: one row per corrected field with the exact before/after values, `approved_by`, `approval_ref`, `applied_at`/`applied_by`, `undone_at`/`undone_by`, and `UNIQUE (correction_key, record_table, record_id, field)`, so a correction cannot be applied twice. No API route reads it, and `REVOKE ALL … FROM PUBLIC`. A and B write their undo rows **inside** their transactions. Each undo restores the **logged** before-values only while every record still holds the **logged** after-value, then marks the rows undone; a second undo stops. **This needs a migration**, which is the one thing v2 requires beyond the A and B approvals (proposed file: `proposed-migration-create-data-correction-log.js`, kept outside `src/migrations` so it cannot run). |

**Local test on a fixture with the exact production values (2026-11-04):**

| # | Test | Result |
|---|---|---|
| 1 | A | `A COMMITTED` |
| 2 | A verify | all exact checks `t`; 4 log rows |
| 3 | A rerun | stopped: "slot 1 does not hold the exact reviewed values" |
| 4 | A undo | `A UNDONE`; slot, purposes, source, brief and snapshot fingerprints all restored exactly |
| 5 | A undo again | stopped: "no complete, not-yet-undone A record" |
| 6 | A after an undo | stopped by the unique key (re-applying needs a new correction key) |
| 7–8 | B, B verify | `B COMMITTED`; 4 items not owned, 4 voided rows kept, 4 links kept, 4 log rows (true → false) |
| 9 | B rerun | stopped: "expected 4 owned items, found 0" |
| 10 | B undo | `B UNDONE`, 4 owned again |
| 11 | B undo again | stopped |
| 12 | valid purchase present | B stopped |
| 13 | new dependency | B stopped ("found 9") |
| 14 | a reviewed voided row changed | B stopped |
| 15–16 | log table missing | A and B stopped |
| 17 | a purchase holding the show lock | B cancelled by lock timeout; nothing changed |
| 18 | the slot being edited | A cancelled by lock timeout; nothing changed |

The migration (up, guarded re-run, down when empty, up) also passed locally. The fixture and the test table were removed afterwards.

**Revised order (each step needs Evoni's go-ahead):**
1. **Approve the `data_correction_log` migration** (G2). It goes into `src/migrations` through a PR and runs through the Deploy workflow, which snapshots first. Not authorized yet.
2. Run `00-preflight.sql` read-only; the four fingerprints must match.
3. Run A, then `A-verify.sql`.
4. Run B, then `B-verify.sql`.

A and B stay independent and each has its own undo.
