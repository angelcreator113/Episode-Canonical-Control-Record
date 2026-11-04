# Continuity readiness report (2026-11-04)

**Status:** read-only. Nothing in production, the ledger, wardrobe ownership, bonus specials or character state was changed. No migration was written or run.

**Basis:**
- Evoni's rulings of 2026-11-04 (fourth set, §1 below);
- the Episodes 1–2 continuity preview (`2026-11-04-consolidated-implementation-roadmap.md` §22.12–22.13);
- a read-only production query run by Evoni (`continuity-readiness.sql`, R1–R8, 2026-11-04);
- a code audit of every purchase path at origin/main `2ebacc78`.

## 1. Rulings this report answers

1. **Purchases.** A successful authoritative **Purchase** transaction confirms an actual purchase. **Outfit Lock** finalizes the selection and must not charge again. First audit all purchase paths and how the five Episode 1 purchases were recorded.
2. **Manual adjustments.** Only explicitly approved, story-effective adjustments enter continuity. Each needs a reason, source, effective story position, author, approval and duplicate protection. Administrative corrections and test activity are excluded unless separately authorized.
3. **Bonus specials.** The three same-time bonus specials stay excluded pending individual review. They are not deleted, merged or renumbered. This report gives their IDs, titles, creation sources and episode associations.
4. **Migration.** The continuity snapshot design is approved for specification and testing, not implementation. Show how it handles purchases, state changes, relationships, story order, acceptance and historical corrections.
5. **Episode 1 context.** Lala is not becoming a fashion designer. Propose a correction to the stale wording without silently changing approved historical records.
6. **Wardrobe.** A read-only reconciliation of voided purchases and owned items, including whether each item has another legitimate acquisition source.
7. **Episode 2.** Both opening-balance scenarios (1,900 / 768) are **diagnostic** until Episode 1's acceptance and purchase-timing rules are resolved.

## 2. Purchase paths (code audit)

| Path | Trigger | Charges? | Ownership | Notes |
|---|---|---|---|---|
| `POST /wardrobe/purchase` (`flow: 'purchase'`) | the **Buy** button (tile "🪙 Buy for N", inspect modal) | yes, one ledger row | set **after** commit | also writes a `character_state_history` row (`wardrobe_purchase`, **no episode id**) |
| `POST /wardrobe/lock-outfit-atomic` (`flow: 'lock_outfit'`) | the **Lock** button ("🪙 N on Lock"); LookBuilder Save | **yes**, every unowned for-sale piece, one transaction | set in the transaction | **conflicts with ruling 1** |
| `POST /wardrobe/select` (`flow: 'select'`) | no current UI caller (the Lock used it before 2026-09-25) | **yes** | set after commit | still mounted and callable; **conflicts with ruling 1** |
| `finalizeEpisodeFinancials` step 7 ("Purchase: X", no flow) | **Episode Complete** and `finalize-financials` | **yes**, for any unowned piece of the locked look | set in the transaction | skips pieces already owned or bought; **conflicts with ruling 1** (a deferred implicit purchase) |
| `PUT /wardrobe/:id` | World Admin "owned" checkbox | no | sets owned **true or false** freely | ownership with no ledger record |
| `POST /wardrobe/seed` | seed action | no | 10 starter pieces owned | — |
| `coinReconciliation.applyOne` | the one-time D1 reconciliation | voids rows | **never reverses ownership** | — |

**Risks:**
- Ownership is read outside the show lock, and there is no ledger uniqueness per item, so two quick Buys, or a Buy racing a Lock, can charge twice.
- In `/purchase` a failure after commit can leave a piece **paid but not owned**.
- A hand un-own lets a piece be bought again.
- **Voiding never un-owns.**

## 3. Verified records

### 3.1 The five Episode 1 purchases (episode `8b9301a6`), confirmed by `metadata.flow`

| Time (2026-10-06 UTC) | Item | Coins | Path | Evidence |
|---|---|---|---|---|
| 05:00:26.61 | Midnight Bloom Lace Peplum Jacket | 120 | **Buy** (`flow: purchase`) | the matching history row "Purchased: … (120 coins)" at 05:00:26.64 (episode id NULL, as the code writes it) |
| 05:04:40.410504 | Noir Lace Illusion Pencil Skirt | 85 | **Lock** (`flow: lock_outfit`) | one transaction (identical timestamp); balances chain 1,780 → 1,695 → 1,663 → 1,568 |
| 05:04:40.410504 | Crimson Bloom Enamel Stud Earrings | 32 | **Lock** | same transaction |
| 05:04:40.410504 | Cloud Nine Pink Rainbow Eau de Parfum | 95 | **Lock** | same transaction; its episode-wardrobe link was created at the same instant |
| 17:48:21.695105 | Crystal Constellation Bucket Minaudière | 800 | **re-Lock** (`flow: lock_outfit`) | its episode-wardrobe link was created at exactly the same instant, so the bag was added and the outfit locked again |

- **Five distinct items, five charges, no double charge.** The balance is 1,900 − 1,132 = **768**, matching the live coins.
- **Under ruling 1,** only the jacket (120) was a Purchase. **1,012 coins (skirt, earrings, perfume, bag) were charged by Lock.** These are real executed rows. Whether they stand as purchases, are re-labelled, or are corrected is Evoni's decision (§6, gate G-P1). Nothing is changed.

### 3.2 Other verified facts

- **Voided rows.** The four voided rows were voided together on 2026-09-29 14:42:46 by the D1 reconciliation (#2250), reason *"Test data, not story purchases (Evoni, 2026-09-29)"*. Three came from `select`, one from `lock_outfit` on the deleted test episode "I Got Invited to the Underground's Most Exclusive Night".
- **Seed.** 1,900 from `show_init` (2026-05-15).
- **Order.** `seasonStoryOrder` places 24 weekly slots plus the bonuses, with no unslotted live episode.
- **Episode 1 state.** Episode 1 is unaccepted, its story record is a draft, and it has no completion stat row.

## 4. Disputed records

### 4.1 Owned items with no legitimate acquisition (wardrobe reconciliation, R3)

13 items are marked owned:
- 5 have an executed purchase (the Episode 1 five);
- 4 have **only voided** purchases;
- 4 have **no acquisition record at all**.

None of these items is a seed basic, and no gift, borrow or rental marking explains any of them (`acquisition_type` is `purchased` for all but the jacket, `vintage`).

| Item | Coins | Records | Where used | Status |
|---|---|---|---|---|
| Crystal Lace-Up Clear Stiletto Sandal | 385 | 1 voided (`select`) | deleted test episode | **Disputed:** purchase voided as test data, still owned |
| Molten Gold Double Pearl Drop Earrings | 285 | 1 voided (`select`) | deleted test episode | **Disputed** |
| Polka Dot Puff Halter Mini Dress | 385 | 1 voided (`select`) | deleted test episode | **Disputed** |
| Sage Corset Lace-Up Halter Midi | 385 | 1 voided (`lock_outfit`) | deleted test episode | **Disputed** |
| **Crimson Crystal Lariat Drop Necklace** | 285 | none | **Episode 1** (linked in the 05:04:40 Lock, which skipped it because it was already owned) | **Disputed:** owned before the Lock with no record; matches the Episode 1 audit's "necklace likely a missing purchase" |
| **Crimson Satin Ballerina Pump** | 685 | none | **Episode 1** (linked 2026-10-05) | **Disputed:** owned with no record |
| **Champagne Satin Oversized Button-Down Blouse** | 165 | none | **Episode 1** (linked 2026-10-05) | **Disputed:** owned with no record |
| Glen Plaid Safari Vest Dress | 185 | none | no episode | **Disputed:** owned with no record |

- **Most likely cause** for the four with no record: the World Admin "owned" checkbox (`PUT /wardrobe/:id`), which writes no ledger row. They are not seed basics.
- **Value at list price:** 1,440 coins voided-but-owned, plus 1,320 owned-without-record.
- **Three of the record-less items (necklace, pump, blouse) are part of Episode 1's look.** So Episode 1's real cost is undetermined until Evoni rules whether Lala owned them before the episode (story-effective, then they need an acquisition record) or bought them for it (then 1,135 coins were never charged).

### 4.2 Other disputed records

- **Duplicate history row.** The jacket's stat-history row (`aa28d875`, coins −120, no episode) duplicates its ledger row. It is administrative noise and is not used by continuity (the ledger is the coin source).
- **February history rows.** "Rose & Vanilla Body Mist" (−80, `manual`) and "Pleated Midi Dress" (−200, `wardrobe_purchase`) are pre-ledger test-era rows with no ledger counterpart. They are excluded as administrative/test (ruling 2).
- **Two February "Manual edit from World Admin" stat rows.** Administrative; excluded.

## 5. The three bonus specials (kept excluded; not deleted, merged or renumbered)

| ID | Title | Event | Episode | Release | Created (UTC) |
|---|---|---|---|---|---|
| `53d218f3-4911-4912-96ed-8c00df9be722` | Midnight Atelier: Dark Couture Preview | `1e0eb6a9-a5ef-483c-a56e-1388bf83e818` | none | 2026-12-02 10:00 | 2026-10-26 19:59:39 |
| `f7f6208d-d215-4e59-861a-b83883bf73d3` | Studio Access: The Obsidian Preview | `11f567f1-d116-416b-8496-40b2cc4f53b6` | none | 2026-12-02 10:00 | 2026-10-26 20:00:15 |
| `e8a5fcff-cf05-4468-9132-060367f64be0` | A Special Host Presents: A Haunt the Feed — LalaVerse Halloween Creator Talent Show Evening | `0c8beb51-2cb1-4b9c-af30-4d7e3d5e18e4` | none | 2026-12-02 10:00 | 2026-10-26 20:00:24 |

- **Correction to the preview (§22.12):** these are **three distinct bonus candidates, not duplicates.** Each has its own title and event (they are among the Episode 2 candidate events from the Dream Cities audit).
- **Why they are ambiguous:** all three sit after slot 3 with the **same suggested release date and time**, so `seasonStoryOrder` cannot order them and correctly marks them `order_ambiguous`.
- **Creation source:** the Season planning routes (`POST /world/:showId/season/specials`, or "make this event a special" `POST …/season/full/events/:eventId/special`). These write **no activity log** (the audit query found none), so the author and click path are not recorded.
- **Also worth Evoni's look:** a Halloween talent show released on 2026-12-02.

## 6. Missing data

| Missing | Effect | Fix (proposed) |
|---|---|---|
| Episode 1 `money_plan` was never frozen at Start | no record of what was *planned* vs bought | Start freezes it (exists for later episodes) |
| Story-effective position on every ledger and history row | purchases can't be placed inside an episode; episode-less rows can't be placed at all | §7.1 |
| Episode id on `/purchase` history rows | the duplicate row is orphaned | the purchase service writes it |
| Activity log for season specials and ownership changes | creation and ownership sources can't be traced | audit rows on create/edit |
| Acquisition records for 4 owned items | ownership can't be justified | Evoni's ruling per item (§4.1) |
| `pulse_followers`, relationship events, approved story records | nothing to carry (empty, which is expected) | none |
| Episode 1 completion (no `computed` row) | Episode 2's opening is diagnostic only (ruling 7) | Episode 1 acceptance |

## 7. Continuity specification (ruling 4: design, not implementation)

### 7.1 Purchases
- **One authoritative purchase service.** `/wardrobe/purchase` becomes its thin wrapper. In one transaction it:
  - locks the show and the item row;
  - re-checks ownership and existing counted purchase rows;
  - writes the ledger row (`flow: 'purchase'`, `idempotency_key`, `story_position {episode_id, point: 'pre-episode'|beat|scene, effective_at}`, `episode_id`);
  - sets owned;
  - writes the history row **with** the episode id;
  - syncs coins.
- **Lock never charges.** It refuses unowned pieces with "buy these first", and the UI offers a "Buy N pieces (total)" step that calls the purchase service per piece **before** the Lock.
- **`/select` never charges** (owned pieces only, or retired).
- **Complete never buys:** unbought look pieces are shown in the money plan as hypothetical, and Complete warns or refuses while any remain. Rentals and event costs stay Complete charges unless ruled otherwise.
- **Exactly once:**
  - a partial unique index on executed `wardrobe_purchase` rows per (show, item);
  - a unique `(show, idempotency_key)`;
  - so a retry returns the original row.

  Both need a migration (G2), after any existing duplicates are resolved (none found).
- **In continuity:** a purchase counts for the episode whose `story_position` it carries, at that point.
  - E's opening state excludes E's own purchases.
  - E's later beats, and the next episode, see them.
  - Hypothetical items live only in the money plan.
- **Voiding a purchase** must set ownership in the same transaction, or record why ownership stands.

### 7.2 State changes
- Stats are replayed from `computed` deltas of accepted predecessors in story order.
- Only **approved story-effective adjustments** count. Each is a history row with:
  - `kind = story_effective_adjustment`;
  - reason, source, character, effective position, before/after;
  - author, `approved_by/at`;
  - a unique `idempotency_key`.
- `manual`, `override`, `wardrobe_purchase` and test rows are `administrative` and never count.

### 7.3 Relationships
- `relationship_events` tied to accepted predecessors give the stage per pair as of E.
- Current `character_relationships` are never read for a past episode.
- Brand-party rows (§18 of the roadmap) follow the same rule.

### 7.4 Story order
- `seasonStoryOrder` is the only order.
- Unslotted episodes have no continuity.
- Specials (`needs_review`) and ambiguous same-slot entries are excluded and listed.
- `storyClock` disagreements are reported, not fixed.

### 7.5 Acceptance
- Only `evaluation_status = 'accepted'` predecessors carry.
- A preview may include unaccepted ones **as simulated**, never canonical.
- Two-parters carry as one unit.

### 7.6 Historical corrections
- Corrections are **new records, never edits**:
  - a void with a reason;
  - an approved story-effective adjustment;
  - an annotation on a frozen snapshot.
- Each changes the inputs hash. Affected later snapshots show "continuity changed since Start" with a diff and are re-frozen only on Evoni's explicit action.

## 8. Proposed corrections (none applied; each needs its own approval)

| # | Correction | Records | Gate |
|---|---|---|---|
| C1 | **Episode 1's Lock-made charges** (1,012 coins): keep as purchases (re-label `story_position` only), or treat as made in error and void with a reason | 4 ledger rows | G-P1 |
| C2 | **The four test-voided items still owned:** un-own them (matching their voided purchases), or record a legitimate acquisition if Lala should own them | 4 wardrobe rows | G-W1 |
| C3 | **The four owned items with no record** (necklace, pump, blouse, vest): for each, either "owned before the story" (an acquisition record with a story position, no charge), "bought for Episode 1" (a purchase through the authoritative service, with a story position), or un-own | 4 wardrobe rows (+ ledger if bought) | G-W2 |
| C4 | **Episode 1 wording** (§9): correct at the source and annotate the snapshot | 1 slot, 1 brief, 1 annotation | G-T1 |
| C5 | **The three bonus specials:** order them, give distinct release times, or remove any not wanted | 3 specials | G-B1 |
| C6 | **Duplicate jacket history row:** mark administrative (annotation only) | 1 history row | G-A1 |

## 9. Episode 1 wording (ruling 5)

**Where the stale wording lives:**
1. `season_slots` slot 1: `story_purpose` and `story_purposes[0]`, marked **`source: "auto-drafted"`** (never approved):
   *"Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey."*
2. `episodes.season_context.story_purpose`: the **frozen Start snapshot** (2026-10-02) of that slot text.
3. `episode_briefs.narrative_purpose` (Episode Intent): it holds the **event's description** ("Wearable Experiments Studio Session — Step into STUDIO BY SABLE's workspace…"), not a purpose at all. The brief is a draft.

**Proposed correction** (the wording is Evoni's to approve or rewrite):
- **Slot purpose** (the source; auto-drafted, so not an approved record), corrected through the normal slot edit with a provenance note `source: "corrected by Evoni, 2026-11-xx"`. Proposed text:
  > *Lala steps into Studio by Sable's experimental workspace as a stylist and creator, not a designer, proving her eye for styling belongs in luxury rooms and setting the tone for her career as a style creator.*
- **Frozen snapshot:** **not overwritten.** An annotation is appended (e.g. `season_context.corrections: [{ field: 'story_purpose', corrected_text, reason: "Lala is not becoming a fashion designer (Evoni, 2026-11-04)", by, at }]`). Readers prefer the latest correction while the original stays visible. If jsonb annotation on the snapshot is not wanted, a separate correction record does the same job.
- **Episode Intent** (`narrative_purpose`, draft brief): replace the event description with the corrected purpose. Editing it steers script generation (the script writer reads it).
- **Approved records:** none of these three is an approved record. Episode 1 is unaccepted and its story record is a draft, so nothing approved is changed.

## 10. Approval gates

| Gate | What needs Evoni's explicit yes |
|---|---|
| G-P1 | Episode 1's Lock-made charges (C1) |
| G-P2 | Code change: Lock, select and Complete stop charging; the single purchase service (PR, then merge) |
| G-W1 / G-W2 | Each wardrobe ownership correction (C2, C3), per item |
| G-T1 | The Episode 1 wording text and the annotation method (C4) |
| G-B1 | Each bonus special (C5) |
| G-A1 | Annotating administrative rows (C6) |
| G-M1 | Story-effective adjustment fields (schema, migration) |
| G-M2 | The `episode_continuity_snapshots` migration |
| G-M3 | Purchase uniqueness indexes (migration) |
| G-E1 | Episode 1 acceptance (Complete), which settles Episode 2's opening balance (ruling 7) |

Every production write: snapshot first, one record set at a time, with an undo list. No stat reset, ledger rewrite, special deletion or ownership change without its gate.

## 11. Tests needed before the migration

**Replay (unit, on fixtures):**
- accepted vs unaccepted predecessors;
- simulated never canonical;
- a bonus after a slot;
- a special excluded;
- ambiguous same-slot excluded;
- unslotted target;
- two-parter as one unit;
- deleted episode rows excluded;
- voided rows excluded;
- administrative history excluded;
- an approved story-effective adjustment counted once;
- diminishing returns at high stats.

**Purchases:**
- Buy charges once (concurrent double click gives one row);
- Lock with unowned pieces refuses and charges nothing;
- `/select` charges nothing;
- Complete with unbought look pieces warns or refuses and charges nothing;
- Buy then Lock gives one row;
- a retry with the same idempotency key returns the original;
- a void sets or records ownership;
- the purchase row carries `story_position` and the history row carries the episode id.

**Continuity at purchase points:**
- E's own purchases are not in E's opening state but are in E+1's (once E is accepted);
- an episode-less purchase without a position is flagged, not counted.

**Stability:**
- completing a later episode leaves E's snapshot hash unchanged;
- accepting, resetting or re-completing an earlier one marks E stale with a diff;
- Dream Cities activity with no story position changes nothing.

**Consumers:**
- the script context, grounded generator, brief goal, script skeleton and Complete's evaluation input read the snapshot for E;
- dashboards and planning read current state;
- the scene planner is unchanged.

**Production preview regression:** the replay of the 2026-11-04 export reproduces §22.12 (Episode 1: 1,900 / 1 / 1 / 1 / 0; Episode 2 diagnostic 1,900 or 768).

**Migration:** up / down / up on the test database; down refuses while snapshots exist (or after an export).
