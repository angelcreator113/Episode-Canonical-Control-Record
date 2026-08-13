# F-Stats-1 Fix Plan v1.41
*Additive-supersede on v1.40. Mints §44. Dispositions 38 statements. Corrects open item 41's figure.*

## What changed in v1.41

**Episode generation (15 statements) and Invitations (23 statements) are
DISPOSITIONED.** 38 statements across 16 handlers, **19 convert / 19 withdraw**,
**zero injection findings.** Every statement is parameterized; no request data
reaches any SQL text.

**Open item 41's remainder figure is corrected from 43 to 5.** Corrected
accounting at §44.5: **107 dispositioned / 5 outstanding**, summing to 112.

**What remains outstanding is 5 statements**: §16.2's two pending Overlays
handlers (3), Outfit's orphan (1), Venue/social's orphan (1). The two orphans are
2846 and 3764, identified at v1.39 §42.5.

**Both disposition formats are carried** — §44.2. §16's `Convert / Withdraw /
Basis` and §35.2's `Injection / non-injection findings` are recorded for every
statement, because the register does not establish which constitutes disposition.

**Finding class 1 has a stronger sub-form than §35.5 recorded** — §44.7. In
Invitations, **22 of 23 statements are unscoped**, and three handlers do not read
their route's scope parameters at all, operating on a caller-supplied `assetId`
alone. §35.5 characterises the class as *scope parameter used as filter, not
authorization boundary*. These are not filters used weakly; **there is no scope
term in the statement.** Recorded, not minted; the homing question is unchanged
and now more urgent.

**The format divergence is raised and NOT ruled** — §44.8.

---

## §44 — Episode generation and Invitations, dispositioned

### §44.1 Basis and method

Basis `9ed5fb38` (v1.40, #1013). Source-derived via
`git show origin/main:src/routes/worldEvents.js`.

§28's method, unchanged: handler starts by unanchored
`router.(get|post|put|patch|delete)\(`; each window bounded by the next handler's
start line minus one; statements counted by `await (models\.)?sequelize\.query`.
**No fixed-width windows.** Every handler in both bands was read in full.

Statement counts confirmed against v1.37 §40.1's census: Episode generation 15
across 5 handlers (all SQL-carrying); Invitations 23 across 11 of 14 handlers.
**The three no-SQL Invitations handlers are confirmed at source**:
`generate-invitation` (1041), `invitation-pdf` (1391), `animate-invitation/:jobId`
(1477). §28's 14-of-which-11 reconciles exactly.

### §44.2 Format — both conventions carried

The register uses two disposition formats and does not say which constitutes
disposition:

- **§16.1 / §16.2 (v1.14):** `Handler | Stmts | Convert | Withdraw | Basis` — a
  per-statement ORM-convertibility verdict.
- **§35.2 (v1.33):** `Line | Handler | Stmts | Injection | Non-injection
  findings` — an injection audit with findings. **No convert/withdraw column, and
  no convertibility ruling anywhere in v1.33.**

This revision carries **both** for all 38 statements. See §44.8.

### §44.3 Episode generation — DISPOSITIONED

**`POST /:eventId/generate-episode` (1687) — 2 statements**

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 1701 | `SELECT * FROM world_events WHERE id AND show_id LIMIT 1` | CLEAN | Convert | `.unscoped()`; `SELECT *` on drifted table |
| 1718 | `SELECT id,name,coin_cost,price,acquisition_type FROM wardrobe WHERE show_id AND deleted_at IS NULL` | CLEAN | Convert | Explicit projection, scoped, soft-delete filtered |

Findings: primary read **scoped** (positive). Bare-catch fallback to
`WorldEvent.findByPk(eventId)` **loses the scope check** — class 1, same shape as
§35.2's 2626, with the same comment naming unmigrated columns as the trigger.
1718's bare catch degrades a money-adjacent input silently — class 3. `deleted_at`
split within one handler — class 2.

**`POST /events/generate-episode-from-many` (1779) — 3 statements**

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 1790 | `SELECT * FROM world_events WHERE show_id AND id IN (:eventIds)` | CLEAN | Convert | `.unscoped()`; `IN (:ids)` safely expanded, as §35.2 cleared at 2697 |
| 1816 | `SELECT ... FROM wardrobe WHERE show_id AND deleted_at IS NULL` | CLEAN | Convert | Byte-identical to 1718 |
| 1837 | `UPDATE world_events SET used_in_episode_id, status, updated_at WHERE id` | CLEAN | **WITHDRAW** | **Unscoped write**; converting encodes the defect |

Findings: 1790 scopes, 1837 does not. The scope holds only by a JS invariant —
`eventIds.map(id => eventsById.get(id)).filter(Boolean)` over rows from the scoped
read — cashed at the write ~50 lines later. No transaction across episode
creation, N link updates, and a script write; per-iteration catches surface
failures in `skippedExtras` (positive).

**`POST /:eventId/regenerate-episode` (1889) — 5 statements**

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 1896 | `SELECT id,used_in_episode_id FROM world_events WHERE id AND show_id LIMIT 1` | CLEAN | Convert | Explicit projection, scoped |
| 1910 | `UPDATE world_events SET used_in_episode_id = NULL WHERE id` | CLEAN | **WITHDRAW** | Unscoped write |
| 1911 | `UPDATE episodes SET deleted_at = NOW() WHERE id AND deleted_at IS NULL` | CLEAN | **WITHDRAW** | **Hand-rolled soft delete on a paranoid model** — §12.41 / XK-1 class; unscoped |
| 1915 | `SELECT * FROM world_events WHERE id AND show_id LIMIT 1` | CLEAN | Convert | `.unscoped()` |
| 1923 | `SELECT ... FROM wardrobe WHERE show_id AND deleted_at IS NULL` | CLEAN | Convert | Third byte-identical copy |

Findings: **1911's comment says *"paranoid mode handles this"* and then bypasses
paranoid mode**, writing `deleted_at` by hand. It declines to cascade *because*
paranoid will mask children — while not using paranoid. The reasoning is
internally inconsistent and the masking it relies on is not established by the
statement. No transaction across the destructive pair 1910/1911; failure between
them orphans an episode. 1896 and 1915 duplicate-read the same row 19 lines apart.

**`POST /events/bulk-delete` (1946) — 3 statements**

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 1956 | `DELETE FROM world_events WHERE show_id` | CLEAN | **WITHDRAW** | **Hard delete, unbounded** — §12.41 class |
| 1963 | `DELETE FROM world_events WHERE show_id AND status='draft'` | CLEAN | **WITHDRAW** | Hard delete |
| 1972 | `DELETE FROM world_events WHERE id AND show_id` | CLEAN | **WITHDRAW** | Hard delete, per-id loop |

All three **scoped and parameterized** — the best scoping hygiene in Episode
generation. The defect is the operation: hard `DELETE` on a table the rest of the
file treats as soft-deleted, with 1911 hand-writing `deleted_at` 40 lines above.
**This is a new instance of open item 22's substance** — *"a schema difference
escalates a soft delete to permanent removal on a paranoid model"* — which §16.1
withdrew at §12.41 site 2 and which open item 22 carries as **unassigned, not
F-Stats-1's to remedy.** Withdrawn on that authority.

`delete_all` is the sharpest single statement in the group: one truthy body flag
destroys every event for a show permanently — no status filter, no confirmation,
no count check, no transaction; `used_in_episode_id` links become dangling. The
`ids` loop swallows failures (`catch { /* skip */ }`) but increments only on
success, so the returned count does not lie — class 3, milder than 2278.

**`POST /events/from-profile` (1988) — 2 statements**

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 2178 | `INSERT INTO world_events (22 columns)` | CLEAN | **WITHDRAW** | Second tier beneath an existing ORM `.create()`; converting reproduces the call it exists to bypass |
| 2191 | `INSERT INTO world_events (11 columns)` | CLEAN | **WITHDRAW** | Third tier; writes a knowingly incomplete row |

Findings: a **three-tier degradation ladder** — `WorldEvent.create()` → 22-column
raw INSERT → 11-column *"only guaranteed columns"* INSERT. The structure
documents that the target schema is unknown. Tier 3 returns `201 {success:true}`
identical to tier 1 while omitting eleven columns, **and the response echoes
`eventData` rather than the persisted row** — the client is told all 22 fields
were written. Class 3, and the most consequential instance in the group: 2278
fabricates a read; this fabricates a canon write.

### §44.4 Invitations — DISPOSITIONED

| Line | Handler | Stmt | Inj. | C/W | Basis |
|---|---|---|---|---|---|
| 1080 | `invitation-text` (1076) | `SELECT canon_consequences FROM world_events WHERE id` | CLEAN | Convert | Single column; `QueryTypes.SELECT` |
| 1102 | `re-render-invitation` (1093) | `SELECT * FROM world_events WHERE id` | CLEAN | Convert | `.unscoped()` |
| 1109 | ″ | `SELECT s3_url_raw FROM assets WHERE metadata->>'event_id' AND asset_type ORDER BY created_at DESC` | CLEAN | **WITHDRAW** | **jsonb-operator predicate** — §12.41's stated basis |
| 1149 | ″ | `UPDATE world_events SET canon_consequences = jsonb_set(COALESCE(...),'{invitation_text}',:textJson::jsonb)` | CLEAN | **WITHDRAW** | `jsonb_set` + cast; Sequelize cannot express partial JSONB path update |
| 1170 | `invitation` (1164) | `SELECT e.*,a.s3_url_processed AS invitation_url ... LEFT JOIN assets a ...` | CLEAN | **WITHDRAW** | **LEFT JOIN + aliased projection** — Decision #23 class, §16.1's basis for `GET /events` |
| 1206 | `approve-invitation` (1196) | `SELECT used_in_episode_id FROM world_events WHERE id` | CLEAN | Convert | Single column |
| 1214 | ″ | `UPDATE assets SET approval_status, episode_id, updated_at WHERE id` | CLEAN | **WITHDRAW** | Tier 1 of a drift ladder |
| 1221 | ″ | `UPDATE assets SET updated_at WHERE id` | CLEAN | **WITHDRAW** | Tier 2; writes a timestamp and calls it approval |
| 1229 | ″ | `UPDATE world_events SET invitation_asset_id = :assetId WHERE id` | CLEAN | **WITHDRAW** | **Unscoped write of a caller-supplied FK**, no existence or ownership check |
| 1281 | `reject-invitation` (1271) | `UPDATE assets SET approval_status, deleted_at = NOW() WHERE id` | CLEAN | **WITHDRAW** | Hand-rolled soft delete — §12.41 / XK-1 |
| 1286 | ″ | `UPDATE assets SET deleted_at = NOW() WHERE id` | CLEAN | **WITHDRAW** | Tier 2, same |
| 1307 | `invitation-history` (1301) | `SELECT ... metadata->>'version', ->>'theme', ->>'theme_source', ->>'composited' ... WHERE metadata->>'event_id' ...` | CLEAN | **WITHDRAW** | Four jsonb operators in projection, one in `WHERE`, plus aliasing |
| 1345 | `batch-generate` (1330) | `SELECT id FROM world_events WHERE show_id AND invitation_asset_id IS NULL` | CLEAN | Convert | **The only scoped statement in the group** |
| 1423 | `animate-invitation` (1411) | `SELECT invitation_asset_id FROM world_events WHERE id` | CLEAN | Convert | Single column |
| 1431 | ″ | `SELECT s3_url_processed FROM assets WHERE id AND deleted_at IS NULL` | CLEAN | Convert | Id derives from 1423's row, not the caller (positive) |
| 1520 | `edit-invitation-text` (1510) | `SELECT * FROM assets WHERE id AND deleted_at IS NULL` | CLEAN | Convert | `.unscoped()` |
| 1526 | ″ | `SELECT * FROM world_events WHERE id` | CLEAN | Convert | `.unscoped()` |
| 1580 | ″ | `UPDATE assets SET s3_url_processed, metadata = :metadata WHERE id` | CLEAN | **WITHDRAW** | **Whole-JSONB read-modify-write**; last-write-wins |
| 1613 | `unlink-invitation` (1605) | `UPDATE assets SET episode_id = NULL WHERE id` | CLEAN | Convert | Two scalar columns |
| 1633 | `invitation/:assetId` DELETE (1627) | `SELECT s3_url_processed, s3_url_raw FROM assets WHERE id AND deleted_at IS NULL` | CLEAN | Convert | Explicit projection |
| 1658 | ″ | `UPDATE assets SET deleted_at = NOW(), episode_id = NULL WHERE id` | CLEAN | **WITHDRAW** | Hand-rolled soft delete — third instance |
| 1664 | ″ | `SELECT invitation_asset_id FROM world_events WHERE id` | CLEAN | Convert | Single column |
| 1669 | ″ | `UPDATE world_events SET invitation_asset_id = NULL WHERE id` | CLEAN | Convert | Single scalar nulled |

Selected findings:

- **1149 is a swallowed write on the canon path.** `catch { /* non-blocking */ }`
  — the edited invitation text silently fails to persist while the response
  returns `success:true` with the new image URL. **Image and canon record diverge
  with no signal, losing a user's edit.** Class 3, and worse in kind than 2278's
  fabricated read.
- **1214/1221 silently downgrade approval to a no-op.** If the optional columns
  are absent, tier 2 writes `updated_at` alone, the inner catch is non-blocking,
  and the response reads *"Invitation approved"*. The asset is not approved.
  Second ladder instance; third counting 2178/2191.
- **1229 writes a caller-supplied FK** with no validation that the asset exists,
  belongs to the show, or is an invitation — and runs **unguarded** while
  1214/1221 are wrapped. No transaction across three writes.
- **1109 and 1307 query the same table on the same jsonb key with inconsistent
  `deleted_at` handling** — 1307 filters, 1109 does not. Class 2.
- **1345's scope is bypassable**: when `eventIds` is supplied in the body, no
  query validates them against `showId` before generation. The group's only scope
  check does not cover its own primary path. `MAX_BATCH` caps image API calls
  (positive).
- **S3 object deleted before the DB row at 1627.** If 1658 throws, the asset row
  survives pointing at a deleted S3 object — permanent, unrecoverable divergence.
  The S3 delete is not soft. No transaction across four statements.
- **`jobId` interpolates unvalidated into a Runway URL** at 1477, and the host is
  `api.dev.runwayml.com` — a **dev endpoint in a production route file**. Not SQL,
  outside the census, recorded as an observation only.

### §44.5 Corrected accounting

| Dispositioned | Stmts |
|---|---|
| Carried from v1.39 §42.3 | 69 |
| **Episode generation (v1.41)** | **15** |
| **Invitations (v1.41)** | **23** |
| **Dispositioned** | **107** |

| Outstanding | Stmts |
|---|---|
| Overlays — 2 pending handlers (`overlay-selections` 1, `reject-overlay` 2) | 3 |
| Outfit — orphan | 1 |
| Venue/social — orphan | 1 |
| **Outstanding** | **5** |

**107 + 5 = 112.**

| Group | Stmts | Convert | Withdraw | Withdrawal |
|---|---|---|---|---|
| Core CRUD (§16.1) | 21 | 5 | 16 | 76% |
| Overlays, 7 handlers (§16.2) | 23 | 13 | 10 | 43% |
| **Episode generation (§44.3)** | **15** | **7** | **8** | **53%** |
| **Invitations (§44.4)** | **23** | **12** | **11** | **48%** |

**Open item 41's figure is corrected 43 → 5.** The item is **not closed** and is
**not renumbered**, per v1.38 §41.6.

### §44.6 Findings — new instances, none minted

Every instance below is an instance of a class already recorded at §35.5. **No
class is minted, no reach beyond `worldEvents.js` is asserted, and no ownership is
claimed.** Cross-Keystone Register §2 continues to exclude findings whose reach is
asserted but not established, and two groups in one file is not establishment.

| Class | New instances in this pass |
|---|---|
| 1 — scope as filter, not boundary | 25 of 38 statements unscoped; 3 unscoped writes in Ep. generation (1837, 1910, 1911); 22 of 23 Invitations statements; 3 handlers reading no scope param at all. **See §44.7.** |
| 2 — soft-delete filter maintained by hand | 5 further in-handler splits; 1109-vs-1307 divergence on one table |
| 3 — swallowing catch producing a fabricated result | 1149 (canon write lost), 1214/1221 (approval no-op), 2178/2191 (incomplete canon row echoed as complete), 1718, 1972 |
| 5 — denormalized JSON with no refresh path | 1580 whole-JSONB read-modify-write, last-write-wins |
| 6 — model-acquisition idiom drift | `getModels()` vs `req.app.get('models')` vs `require('../models')` across both groups |

**New shapes not cleanly inside §35.5's six**, recorded for the homing decision:

- **Drift ladders.** Three instances (2178/2191, 1214/1221, 1281/1286) of
  tiered fallbacks that degrade a write and report success. Related to class 3 but
  distinct: the fabrication is structural, not incidental to a catch.
- **Absent transactions on multi-write paths.** 1837's loop, 1910/1911's
  destructive pair, 1196's three writes, 1627's four plus an S3 delete. Adjacent
  to the audit's Career Goals *"4 parallel completion writers, no transactions"*.
- **Hard delete on a soft-deleted table** (1956, 1963, 1972) — open item 22's
  substance, new instances.

### §44.7 Finding class 1 — a stronger sub-form

§35.5 characterises class 1 as *scope parameter used as filter, not authorization
boundary*, measured as 11 unscoped of 24 census sites. **Invitations is a
different and more severe shape.**

Three handlers do not read their route's scope parameters at all:

| Handler | Reads | Effect |
|---|---|---|
| `reject-invitation` (1271) | `assetId` from body only | Soft-deletes any asset by id |
| `unlink-invitation` (1605) | `assetId` from body only | Unlinks any asset by id |
| `edit-invitation-text` (1510) | `assetId` from body, `eventId` from path, neither cross-checked | Composites one show's event data onto another show's asset |

`showId` and `eventId` are present in every one of these route paths and are
unused. **This is not a filter applied weakly; there is no scope term in the
statement.** Every handler declares `requireAuth` and passes every CP12 grep, so
§35.5's homing conclusion is unchanged: **not F-Stats-1, and not F-AUTH-1 as
scoped.**

Exploitation requires a known asset UUID, and none of these handlers provides an
enumeration path. **That bounds the severity; it does not remove the finding.**
Recorded at the strength the evidence supports, unminted, and **the homing
decision is more urgent than §35.5's record implies.**

### §44.8 Raised, not ruled: what constitutes disposition

§16 rules convertibility. §35.2 rules injection and records findings, and v1.33
rules convertibility **nowhere** — a probe for `onvert` / `ithdraw` across v1.33
returns zero. The 69 statements carried into this revision are therefore
**dispositioned in two different senses**: §16's 46 with convert/withdraw verdicts,
§35.2's 23 without.

Open item 41's closure condition does not say which sense it requires. If
convertibility is required, §35.2's 23 are not closed and 107 overstates. If the
injection audit suffices, §16 did work beyond the bar.

**This revision does not rule.** It carries both formats for all 38 statements, so
its own contribution is unaffected either way. **The status of §35.2's 23 is
owed a ruling.** No ownership claimed.

### §44.9 Method note

Both bands were read in full at source rather than sampled, and every handler
window was bounded by the next handler's start line. The census figures — 15 and
23 — were confirmed rather than assumed, and the three no-SQL Invitations
handlers were confirmed individually.

**Zero injection findings across 38 statements**, matching §35.2's result across
its 22. Across 60 statements now audited for injection in this file, every one is
parameterized. **This is a positive finding about the codebase and is stated as
one.** The defects in this file are authorization, transactionality, and
soft-delete discipline — not injection.

---

## What this revision does not do

- Does not close open item 41. Its figure is corrected to 5; it is not
  renumbered.
- Does not close open item 23, or rule on its overlap with open item 41
  (v1.40 §43.6).
- Does not rule on what constitutes disposition (§44.8), or on the status of
  §35.2's 23.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not resolve §39.4 defect 1 or defect 3. The two orphans remain outstanding
  and identified; defect 1 is count- and disposition-neutral per v1.39 §42.5.
- Does not disposition the 5 outstanding statements.
- Does not evaluate or apply any conversion. **A `Convert` verdict is a
  convertibility ruling, not a fix.**
- Does not disturb §16.1, §16.2 or §35.2's dispositions.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
- Does not draw the XK-1 population conclusion, still deferred, though 1911, 1281,
  1286 and 1658 are further instances of its subject.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not adopt open item 22's substance. The three hard deletes are withdrawn
  on its authority and remain **unassigned**.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.41 | 2026-08-13 | **Episode generation (15) and Invitations (23) DISPOSITIONED — 38 statements, 16 handlers, 19 convert / 19 withdraw, ZERO injection findings.** Both register formats carried per statement (§16's Convert/Withdraw/Basis and §35.2's Injection/findings), because the register does not establish which constitutes disposition. **Open item 41's figure corrected 43 → 5**; accounting is **107 dispositioned / 5 outstanding = 112**. Outstanding is §16.2's two pending Overlays handlers (3), Outfit's orphan (1), Venue/social's orphan (1) — the orphans being 2846 and 3764. Withdrawal bases: hard DELETE on a soft-deleted table (1956, 1963, 1972 — new instances of open item 22's substance, unassigned); hand-rolled `deleted_at` on paranoid models (1911, 1281, 1286, 1658 — §12.41 / XK-1); jsonb-operator predicates and projections (1109, 1307); `jsonb_set` partial-path update (1149); LEFT JOIN + aliased projection (1170 — Decision #23 class); unscoped writes (1837, 1910, 1229); drift-ladder tiers (2178/2191, 1214/1221); whole-JSONB read-modify-write (1580). **Finding class 1 recorded with a stronger sub-form at §44.7**: 25 of 38 statements unscoped, and three Invitations handlers read no scope parameter at all, operating on caller-supplied `assetId` — not a weak filter but no scope term at all; severity bounded by the absence of an enumeration path; homing unchanged (not F-Stats-1, not F-AUTH-1 as scoped) and more urgent. New shapes recorded unminted at §44.6: drift ladders, absent transactions on multi-write paths, hard delete on soft-deleted table. **Raised, NOT ruled at §44.8:** v1.33 rules convertibility nowhere, so the 69 carried statements are dispositioned in two different senses and open item 41's closure condition does not say which it requires. Mints no FD. No live DB contact. Prod FROZEN, untouched. §44 minted. Basis `9ed5fb38`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.40. Tail: **FD-61**.
- Mints: **§44**.
- Dispositions: **Episode generation (15)**, **Invitations (23)**.
- Closes: **nothing**.
- Corrects: **open item 41's figure, 43 → 5**. Item not closed, not renumbered.
- Raises, unruled: **what constitutes disposition** (§44.8); the status of
  §35.2's 23 statements under that question.
- Records, unminted: new instances of §35.5 classes 1, 2, 3, 5, 6; three new
  shapes (drift ladders, absent transactions, hard delete on soft-deleted table);
  class 1's stronger sub-form at §44.7.
- Carries: **open item 41** (OPEN, figure 5, denominator 112); **open item 23**
  (OPEN, restored at v1.40, substance re-anchored to this revision's accounting);
  open item 22 (unassigned, new instances recorded); open item 6 (v1.31 carve-out
  stands); all other items carried from v1.40.
- Defers: §39.4 defect 1 (open, count- and disposition-neutral, unowned); §39.4
  defect 3 (unruled); XK-1's remedy; the XK-1 population question; the item 23 /
  item 41 overlap.
- Forward-points: cross-file reach at `episodeGeneratorService`,
  `invitationGeneratorService`, `invitationCompositingService`,
  `timelinePlacementService`, `scriptSkeletonGenerator`, `todoListService` —
  recorded, not adopted, relevant to the class-homing question.
- Changes no PR state, no gate. Unit 19's withdrawal stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.40; no destructive rewrite.
- **Numeral disambiguation:** *open item 41 (F-Stats-1)* is unrelated to *FD-41
  (F-Deploy-1)* and to any §41; its figure is now 5. *Open item 22
  (F-Stats-1)* and *open item 23 (F-Stats-1)* are unrelated to FD-22 / FD-23 and
  to §22 / §23.1. §44 is minted in v1.41; section numbers and their minting
  revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

Five revisions of this thread corrected a figure that had never been measured.
This one measures the thing the figure was about.

**`worldEvents.js` is 107 of 112 dispositioned.** What remains is five statements
in three known places: two Overlays handlers carved out at v1.14, and two orphans
at 2846 and 3764 whose group labels are the subject of §39.4 defect 1. **Nothing
outstanding is unlocated, and nothing outstanding is large.**

**Zero injection findings across 38 statements**, and across all 60 statements
audited for injection in this file. Every statement parameterized, including three
JSONB paths, an `IN (:ids)` expansion, and a `jsonb_set` with an explicit cast.
That result is worth stating plainly: **the exposure in this file is not
injection.** It is authorization — 25 of 38 statements carrying no scope term, and
three handlers whose route scope parameters are decorative.

Six finding classes remain unminted and homing-owed. §44.7 does not change their
homing and does not attempt to. It does change what the register knows about their
severity, and that knowledge is now on the record for whoever takes the homing
decision.

**Two questions are owed before open item 41 can close:** what constitutes
disposition (§44.8), and which group owns each orphan (§39.4 defect 1). Neither
requires further counting.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `9ed5fb38` (#1013). Predecessor: v1.40.*
*Minted: §44. Dispositioned: Episode generation (15), Invitations (23). Closed: nothing. Corrected: open item 41's figure 43 → 5. Mints no FD. Tail: FD-61. [skip-automerge]*
