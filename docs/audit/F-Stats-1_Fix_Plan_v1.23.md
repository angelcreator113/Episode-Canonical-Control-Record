# F-Stats-1 Fix Plan v1.23

## What changed in v1.23

- **§25 (new):** `worldEvents.js` is **fully dispositioned**. 66 statements
  dispositioned here; with §16.1's 21 and §16.2's 23, all 112 are accounted
  for. File-wide: 65 convert, 47 withdraw, 42% withdrawal.
- **§25.1 (new):** a discriminator for §12.41, stated in final form with its
  three-pass derivation.
- **§25.2 (new):** §12.38's scope rule applies to writes.
- **§25.3 (new):** seven regions carry adjacent statements with opposite scope
  requirements. Three are same-table pairs.
- **§25.4 (new):** derive paranoid behaviour from §16's matrix, never from the
  surrounding comment. Two mirror-image traps.
- **§25.5 (new):** the §12.41 pairs are one copy-pasted pattern replicated four
  times, not four independent findings.
- **§16 matrix AMENDED:** `shows` is a thirteenth table and is paranoid.
- **§12.41 EXTENDED:** sites 6 through 14.
- **Open item 37 (new):** §16's group membership is unpublished. Two groups of
  eight examined reconcile.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6.
  `worldEvents.js` remains the next executable surface, and its execution
  remains a separate session from any inventory work.
- **§11:** v1.23 row added.
- Basis: `30fba75d`. Mints no FD.

**Scope of authority.** These are *statement* dispositions, each citing a line
number in `worldEvents.js` at `30fba75d`. They are **not** group closures.
§16 published group counts but not handler membership (open item 37). Any
grouping named below is proposed, not established.

---

## §25 - statement dispositions

Scope column: **U** = `.unscoped()` required (paranoid table, no `deleted_at`
predicate in the raw SQL). **D** = default scope, `.unscoped()` must be omitted
(paranoid table, explicit predicate). **E** = explicit `deleted_at: null` in the
`where` (non-paranoid table carrying the predicate). **N** = no scope question.

### Convert (45)

| Line | Table | Scope | Notes |
|---|---|---|---|
| 1080 | `world_events` | U | `attributes`; `raw: true` |
| 1102 | `world_events` | U | `raw: true`; row passed to `compositeInvitation` |
| 1206 | `world_events` | U | `attributes`; `raw: true` |
| 1229 | `world_events` | U | static SET |
| 1345 | `world_events` | U | `invitation_asset_id IS NULL` maps to `{ invitation_asset_id: null }`, not `Op.eq` |
| 1423 | `world_events` | U | `attributes`; `raw: true` |
| 1431 | `assets` | D | `attributes`; `raw: true` |
| 1520 | `assets` | D | `raw: true` |
| 1526 | `world_events` | U | `raw: true` |
| 1580 | `assets` | U | static SET; metadata merged in JS at 1576-1590, column written whole |
| 1613 | `assets` | U | static SET |
| 1633 | `assets` | D | `attributes`; `raw: true` |
| 1658 | `assets` | U | **manual soft-delete; see §25.4** - `.unscoped().update()`, NOT `.destroy()` |
| 1664 | `world_events` | U | `attributes`; `raw: true` |
| 1669 | `world_events` | U | static SET |
| 1718 | `wardrobe` | E | `attributes`; `raw: true`; bare-swallow catch, converts per §25.1 |
| 1790 | `world_events` | U | `Op.in`; `raw: true` |
| 1816 | `wardrobe` | E | identical to 1718 |
| 1837 | `world_events` | U | static SET; catch reads `err.message` for a response field only - converts, see §25.1 |
| 1896 | `world_events` | U | `attributes`; `raw: true` |
| 1910 | `world_events` | U | static SET |
| 1911 | `episodes` | E | **`episodes` is NOT paranoid; see §25.4** - `.update()`, NOT `.destroy()` |
| 1915 | `world_events` | U | `raw: true` |
| 1923 | `wardrobe` | E | identical to 1718 |
| 1956 | `world_events` | N | hard DELETE on a paranoid model - **`force: true` required; see §25.4** |
| 1963 | `world_events` | N | as 1956 |
| 1972 | `world_events` | N | as 1956; bare-swallow catch |
| 2225 | `world_events` | U | `raw: true`; passed to `checkAffordability` |
| 2258 | `world_events` | U | `raw: true`; row mutated at 2265 |
| 2297 | `world_events` | D | `Op.in` on status; bare-swallow catch |
| 2310 | `opportunities` | D | `Op.in` on status; bare-swallow catch |
| 2320 | `episodes` | E | static ORDER BY; bare-swallow catch |
| 2568 | `world_events` | U | `raw: true`; row is mutated at 2609 |
| 2680 | `world_events` | U | `attributes`; `raw: true` |
| 2708 | `world_events` | U | `raw: true` |
| 2716 | `wardrobe` | E | `Op.in`; **empty-array sentinel at 2721 must be preserved** |
| 2763 | `world_events` | U | **write; see §25.2** |
| 2782 | `world_events` | U | `raw: true` |
| 2790 | `wardrobe` | E | `Op.or` on `show_id`, same shape as `listWardrobeItems`; static ORDER BY |
| 3465 | `world_events` | U | static SET; `selected_overlays` stringified in JS, not a jsonb function |
| 3590 | `episodes` | E | `attributes` |
| 3611 | `episodes` | N | static SET |
| 3643 | `shows` | D | see §16 amendment |
| 3742 | `world_events` | U | static ORDER BY; `raw: true`; bare-swallow catch |
| 3764 | `world_events` | D | `attributes` |
### Withdraw (21)

| Line | Basis | Detail |
|---|---|---|
| 1109 | Decision #23 | `metadata->>'event_id'` jsonb operator in WHERE; §16.2's stated basis |
| 1149 | Decision #23 | `jsonb_set` with `COALESCE` and `::jsonb` cast in the SET clause - **new sub-form, the write side of §16.2's jsonb basis** |
| 1170 | Decision #23 | `LEFT JOIN assets` plus aliased projection; same basis §16.1 gave `GET /events` |
| 1214 | §12.41 | site 11 - `UPDATE assets SET approval_status, episode_id` in try |
| 1221 | §12.41 | site 11 - narrower variant in catch |
| 1281 | §12.41 | site 12 - `UPDATE assets SET approval_status, deleted_at` in try |
| 1286 | §12.41 | site 12 - narrower variant in catch |
| 1307 | Decision #23 | four jsonb operators in the projection, one in WHERE, plus aliased projection |
| 1701 | §12.41 | site 13 - raw-in-try, `WorldEvent.findByPk` in catch |
| 2178 | §12.41 | site 7 - full INSERT, 22 columns |
| 2191 | §12.41 | site 8 - minimal INSERT, 12 "only guaranteed columns" |
| 2234 | §12.37 | `character_state_history` is modelless; identical statement to 2286 |
| 2286 | §12.37 | `character_state_history` is modelless |
| 2361 | §12.41 | site 9 - catch branches on `err.original.code` |
| 2370 | §12.41 | site 9 - fallback minus `is_free` |
| 2636 | §12.41 | site 6 - raw-in-try, ORM-in-catch |
| 2846 | §12.41 | site 10 - ORM-first, raw fallback on falsy |
| 3139 | §12.41 | site 14 - `UPDATE assets SET approval_status, deleted_at` in try |
| 3144 | §12.41 | site 14 - narrower variant in catch |
| 3525 | §12.37 | `stories` is modelless |
| 3551 | §12.37 | modelless; **also** dynamic SET clause, Decision #23 |

## §25 coverage - the file is fully dispositioned

| Source | Statements | Convert | Withdraw | Rate |
|---|---|---|---|---|
| §16.1 Core CRUD (v1.14) | 21 | 5 | 16 | 76% |
| §16.2 Overlays 7 handlers + next-suggestions (v1.14) | 25 | 15 | 10 | 40% |
| §25, this revision | 66 | 45 | 21 | 32% |
| **File total** | **112** | **65** | **47** | **42%** |

For comparison: `wardrobe.js` withdrew 29% overall, `evaluation.js` 30%.
`worldEvents.js` withdraws at **42%**, the highest of the three.

**Count confirmed.** A scan of `await\s+(models\.)?sequelize\.query` at
`30fba75d` returns exactly **112** call sites, partitioning with no gap and no
overlap: 21 at or below line 897 (§16.1), 25 across the overlay handlers plus
`next-suggestions` (§16.2), and 66 here. §16's count is confirmed by a third
independent method.

Line 104's `sequelize.query(query, { replacements })` is `GET /events`,
dispositioned in §16.1. The SQL is assembled across lines 84-102 with
conditional `AND` clauses and a dynamic `ORDER BY e.${sortCol} ${sortOrder}`,
which confirms §16.1's Decision #23 basis directly.

`GET /events` carries a second, independent withdrawal basis §16.1 did not
cite: its catch at 108 inspects `error.message?.includes('does not exist')` and
returns a different response body. That is §25.1's branching case. The
statement was already withdrawn; the basis is recorded for completeness.

By proposed group, on the 66 statements dispositioned here:

| Proposed group | Stmts | Convert | Withdraw | Rate |
|---|---|---|---|---|
| Invitations | 23 | 15 | 8 | 35% |
| Episode generation | 13 | 12 | 1 | 8% |
| Outfit | 6 | 6 | 0 | 0% |
| Financial | 6 | 3 | 3 | 50% |
| Venue/social | 4 | 1 | 3 | 75% |
| Overlays, 2 pending handlers | 3 | 1 | 2 | 67% |
| Distribution | 3 | 3 | 0 | 0% |
| Stories | 2 | 0 | 2 | 100% |
| Affordability / decline | 3 | 2 | 1 | 33% |
| Balance / generate-lists (3742, 3764) | 2 | 2 | 0 | 0% |
| Unassigned (2846) | 1 | 0 | 1 | 100% |

§12.42 predicted non-uniformity by group. The spread runs 0% to 100%, wider
than the Core-CRUD-to-Overlays span that prompted the rule.

---
## §25.1 - the §12.41 discriminator

§12.41 withdraws statements whose recovery depends on the raw driver error
shape. Applying it across the file required three passes to state precisely.
The progression is recorded because each refinement came from a real statement
and the final form is not obvious from the first.

**First pass.** Several catches cite schema drift in a comment but never touch
the error. Line 2369 branches on `err.original.code`; lines 2292, 2305, 2315,
2328 and 3747 are bare swallows to a default. Proposed rule: withdraw if the
catch *reads* the error object.

**Second pass.** That rule wrongly converts 1214/1221, 1281/1286 and
3139/3144. Each is a bare catch - no error is read - containing **a narrower
variant of the same write**, which is v1.14's original defining shape for sites
3, 4 and 5. Rule extended: withdraw if the catch reads the error **or** contains
a variant of the same statement.

**Third pass.** That rule wrongly withdraws 1837. Its catch reads
`linkErr.message`, but only to push a reason string into a response array. No
retry, no fallback statement, no branch on the error's shape.

**Final form:**

> **Withdraw** if the catch either (a) branches on the error's shape or code,
> or (b) contains a variant of the same statement.
> **Convert** if the catch merely swallows, defaults, or records the message
> without altering what the code does next.

Worked examples:

| Line | Catch | Verdict |
|---|---|---|
| 2369 | `if (err?.original?.code !== '42703' && !String(err?.message||'').includes('is_free')) throw err;` | withdraw - branches on error code |
| 108 | `if (error.message?.includes('does not exist')) return res.json({ ... })` | withdraw - branches on message content |
| 1218 | bare `catch {` containing `UPDATE assets SET updated_at = NOW()` | withdraw - variant of the same write |
| 1706 | bare `catch {` containing `WorldEvent.findByPk` | withdraw - variant of the same read |
| 1842 | `catch (linkErr) { skippedExtras.push({ reason: linkErr.message }) }` | convert - records, does not branch |
| 1723 | `catch { /* wardrobe table may not exist yet */ }` | convert - swallows to `[]` |

**Precedence.** Decision #23 outranks §25.1. Line 1149 has a bare-swallow catch
but its SQL uses `jsonb_set` in the SET clause and is unconvertible regardless.
§25.1 only decides statements that are otherwise convertible.

**Recorded as the least certain rule in this revision.** A reviewer could
withdraw the bare-swallow statements on precautionary grounds, reasoning that
the author's expectation of drift is itself the signal. The argument for
converting is that §12.41's stated basis is mechanical - error-shape dependency
- and there is none. Whoever executes should know the argument was made, not
just the verdict.

## §25.2 - §12.38 applies to writes

§12.38's framing is read-oriented. Line 2763 is an `UPDATE world_events ...
WHERE id` with no `deleted_at` predicate. `Model.update()` on a paranoid model
adds `deleted_at IS NULL` to the WHERE by default, so converting without
`.unscoped()` silently stops updating soft-deleted rows.

**The rule is the same in both directions and applies to writes.** Affects
lines 1229, 1580, 1613, 1658, 1669, 1837, 1910, 2763, 3465.

## §25.3 - adjacent statements in opposite scope directions

Seven regions carry statements whose scope handling is opposite, within a few
lines of each other:

| Region | Statement A | Statement B | Gap |
|---|---|---|---|
| `POST /:eventId/animate-invitation` | 1423 `world_events`, U | 1431 `assets`, D | 8 lines |
| `POST /:eventId/edit-invitation-text` | 1520 `assets`, D | 1526 `world_events`, U | 6 lines |
| `DELETE /:eventId/invitation/:assetId` | 1633 `assets`, D | 1658 `assets`, U | 25 lines, same table |
| `PUT /:eventId/outfit` | 2708 `world_events`, U | 2716 `wardrobe`, E | 8 lines |
| `GET /:eventId/wardrobe-options` | 2782 `world_events`, U | 2790 `wardrobe`, E | 8 lines |
| `GET /:showId/balance` to `POST /:eventId/generate-lists` | 3742 `world_events`, U | 3764 `world_events`, D | 22 lines, same table |
| `GET /financial-pressure` | 2297, 2310 paranoid, D | 2320 non-paranoid, E | within one handler |

**Three of the seven are same-table pairs.** A converter cannot shortcut on "is
this table paranoid"; every predicate must be read.

## §25.4 - derive paranoid behaviour from the matrix, never from the comment

Two mirror-image traps, one in each direction. Both would be introduced by a
converter who trusts the surrounding comment.

**Trap A - non-paranoid model, comment claims paranoid.** Line 1911:

    UPDATE episodes SET deleted_at = NOW() WHERE id = :episodeId AND deleted_at IS NULL

The comment at 1905 reads "Soft-delete the previous episode (paranoid mode
handles this)". **`episodes` is not paranoid** per §16's matrix - named scope
only. `Episode.destroy()` would issue a hard DELETE. The faithful conversion is
`Episode.update({ deleted_at: fn('NOW') }, { where: { id, deleted_at: null } })`.

**Trap B - paranoid model, raw hard DELETE.** Lines 1956, 1963, 1972:

    DELETE FROM world_events WHERE show_id = :showId

`world_events` **is** paranoid. `WorldEvent.destroy()` soft-deletes. The
faithful conversion needs `force: true`. Omitting it turns three destructive
endpoints into soft-deletes - arguably an improvement, but a behaviour change,
and F-Stats-1 converts rather than improves. Note also that 1956 and 1963 read
`result?.rowCount`, while `destroy()` returns a count directly.

**The rule:** for any DELETE, or any write touching `deleted_at`, take the
paranoid flag from §16's matrix as amended. The word `destroy` is wrong in both
directions here, for opposite reasons.

Also affected: 1281, 1658 and 3139 write `deleted_at = NOW()` on `assets`,
which is paranoid. All three set other columns in the same statement, so
`.destroy()` would lose those writes. 1281 and 3139 withdraw for other reasons;
1658 converts as `.unscoped().update()`.

## §25.5 - the §12.41 pairs are one pattern, replicated

Sites 4, 11, 12 and 14 are the same code:

| Site | Handler | Try | Catch |
|---|---|---|---|
| 4 (v1.14) | `approve-overlay` | `UPDATE assets` with `approval_status` | without it |
| 11 | `approve-invitation` (1214/1221) | `UPDATE assets SET approval_status, episode_id` | `SET updated_at` only |
| 12 | `reject-invitation` (1281/1286) | `UPDATE assets SET approval_status, deleted_at` | without `approval_status` |
| 14 | `reject-overlay` (3139/3144) | `UPDATE assets SET approval_status, deleted_at` | without `approval_status` |

Sites 12 and 14 are near-identical: same table, same columns, same fallback,
different route. Site 5 (`generate-overlay`, two INSERT variants) is the same
idea applied to creation.

**Consequence for whoever owns open item 22.** These are not five or six
independent defects. They are one defensive idiom - "try with the optional
column, fall back without it" - copy-pasted across the invitation and overlay
surfaces. A single decision about whether `approval_status` exists resolves all
of them at once. Scoping that work as one fix rather than several changes its
size considerably.

---
## §16 matrix AMENDED - `shows` is a thirteenth table

`GET /world/:showId/distribution-defaults` (line 3643) reads `FROM shows`.
`shows` does not appear in §16's twelve-table matrix.

`src/models/Show.js:142` declares `tableName: 'shows'` with `paranoid: true`.

| Table | Model | Paranoid |
|---|---|---|
| `shows` | `Show` | **yes** |

**Consequence for §12.38.** Its framing reads "five paranoid models of ten."
With `shows`, it is **six of eleven**. The direction of the rule is unchanged;
the count in its text is superseded.

No criticism of §16 is intended. §16 reconciled its statement count twice by
two independent methods and was right about the count. Surfacing a missing
table is what per-statement reading is for.

## §12.41 EXTENDED - sites 6 through 14

v1.14 listed five sites, all write-variant pairs. Per-statement reading found
nine more across five sub-shapes. See §25.5 for how many of these are the same
code.

**Sites 6 and 13 - raw-in-try, ORM-in-catch.**
`POST /:eventId/generate-social-checklist` (2636) and
`POST /:eventId/generate-episode` (1701). Raw `SELECT` in the try;
`WorldEvent.findByPk` in the catch. Both carry a comment about unmigrated
columns. Converting the try collapses both branches into the same call and the
fallback becomes dead.

**Sites 7 and 8 - ORM-first, progressive raw degradation.**
`POST /events/from-profile` (2178, 2191). `WorldEvent.create()` at 2166, raw
INSERT with 22 columns at 2178, raw INSERT with 12 "only guaranteed columns" at
2191. A three-tier ladder. Converting either raw tier reproduces the call that
already failed at tier one.

**Site 9 - catch branches on the driver error code.**
`GET /:eventId/financial-forecast` (2361, 2370). Gated on `err.original.code`
equal to `42703`, or message text containing `is_free`. See §25.1.

**Site 10 - ORM-first with raw fallback on falsy, not on throw.**
`GET /:eventId/feed-activity` (2846). `WorldEvent.findByPk` at 2843, then
`if (!event)` and a raw `SELECT`. No try/catch at all.

Site 10's justification differs from the rest and is recorded as weaker. There
is no error-shape dependency. It withdraws because **the two queries disagree
on scope**: the ORM call carries no `.unscoped()`, the raw query carries no
`deleted_at` predicate. For a soft-deleted event the ORM returns null and the
raw query finds it. The fallback is doing real work by accident.

**Sites 11, 12 and 14 - write-variant pairs, matching v1.14's original shape.**
`approve-invitation` (1214, 1221), `reject-invitation` (1281, 1286) and
`reject-overlay` (3139, 3144). All three are bare catches containing a narrower
variant of the same `UPDATE assets`. See §25.5.

---

## Open item 37 (new) - §16 group membership does not reconcile

§16 published per-group handler and statement counts. It did not publish
**which handlers belong to which group**. Dispositioning by inferring
membership from route names reconciled in four groups of nine examined:

| Proposed group | §16 says | Found | Reconciles |
|---|---|---|---|
| Core CRUD | 7 handlers, 21 stmts | 21 sites, lines 35-897, all 7 handlers present in order | **yes** |
| Invitations | 9 handlers, 23 stmts | 23 stmts, lines 1041-1680 | **yes** |
| Overlays | 9 handlers, 26 stmts | 23 in §16.2 plus 3 here = 26 | **yes** |
| Episode generation | 5 handlers, 15 stmts | 13 stmts in 1687-1990 | no |
| Outfit | 4 handlers, 7 stmts | 6 stmts, 4 handlers | no |
| Financial | 5 handlers, 10 stmts | 6 stmts; 2 named handlers delegate entirely | no |
| Venue/social | 4 handlers, 5 stmts | 2 in §16.2 (3836, 3855) plus 4 here = 6 | no |
| Distribution | 3 handlers, 3 stmts | 3 stmts; 2 of 5 named handlers delegate | count only |
| Stories | 2 handlers, 2 stmts | 2 stmts | **yes** |

`GET /:eventId/feed-activity` (2846) cannot be assigned to a group from its
name or position at all. `GET /:eventId/affordability` (2219) and
`POST /:eventId/decline` (2252) likewise have no obvious group.

The statements at 3836 and 3855 sit inside `GET /events/next-suggestions`
(3825), which §16.2 dispositioned early and assigned to Venue/social. An
earlier draft of this revision counted them a second time. Corrected: they
belong to §16.2's 25, not to §25's 66.

None of this overturns §16's total of 112. What is in question is the
**per-group attribution**, which the inventory did not publish and which cannot
be re-derived from route names.

**Consequence:** §12.42 requires per-group PRs. That requires membership.
Membership must be published before `worldEvents.js` execution is sequenced.
This is now the **only** thing between full statement dispositioning and a
sequenced execution plan.

Ownership: **F-Stats-1.** Not resolved by this revision.

---
## §11 Plan Version History (UPDATED)

| v1.23 | 2026-08-06 | §25 `worldEvents.js` fully dispositioned - 66 statements here, 112 file-wide with §16.1 and §16.2, 65 convert 47 withdraw, 42% withdrawal; §25.1 the §12.41 discriminator in final form with its three-pass derivation; §25.2 §12.38 applies to writes; §25.3 seven opposite-direction regions; §25.4 derive paranoid behaviour from the matrix not the comment, two mirror traps; §25.5 the §12.41 pairs are one replicated pattern; §16 matrix amended with `shows`; §12.41 extended to sites 6-14; open item 37 group membership. No execution state changes. Basis `30fba75d`. |

v1.23 supersedes v1.22 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.22.
- Mints: §25, §25.1, §25.2, §25.3, §25.4, §25.5, open item 37.
- Amends: §16's table matrix. Extends: §12.41, sites 6-14. Supersedes
  §12.38's paranoid-model count.
- Changes no unit disposition in `wardrobe.js`, no PR state, no gate.
- Additive-supersede on v1.22; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

**Open items after this revision:** 6, 31, 32, 33, 34, 36, 37.

## Method note

No live-database contact. No prod-box contact. No dev-box contact. No test
execution. All dispositions derive from `git show origin/main:` reads of
`src/routes/worldEvents.js`, `src/models/Show.js`, and
`docs/audit/F-Stats-1_Fix_Plan_v1.14.md` at `30fba75d`. Every disposition
cites a line number; none is carried from memory or from a summary.

Five citations in earlier drafts of this revision were wrong, across three
distinct causes. All are corrected here; the causes are recorded because each
produces a different kind of wrong.

**Window-offset arithmetic** - 2566 for 2568, 2635 for 2636, 2608 for 2609.
Derived by counting from the start offset of a `Select-Object -Skip` window
rather than read from numbered output. **Line numbers in this register must
come from a source that emits them** - a `ForEach-Object` counter - never from
arithmetic on a window offset.

**Citing the SQL rather than the call** - 3526 for 3525. A grep matching on
table name returns the line holding the SQL string, which sits one or more
lines below the `sequelize.query(` call. **A citation in this register names
the line of the call**, which is what the scan pattern finds and what a
converter edits.

**Claiming statements another section already owns** - 3836 and 3855, which
belong to §16.2. Caught by partitioning all 112 call sites by owner and
checking for overlap. **Before claiming a statement, verify no other section
has dispositioned it.** The partition above is that check.

A disposition that cannot be found at the line it cites, or that is counted
twice, is worse than no disposition. Every citation and every count in this
revision was re-verified against numbered output before commit.

`worldEvents.js` was **not** inventoried in this session; §16's inventory
already existed. Dispositioning is not execution. The standing rule that no
file is inventoried in the same session as its execution is unaffected, and
`worldEvents.js` execution remains a separate session.

Two observations recorded because they surfaced here and are not F-Stats-1's
to own:

`POST /events/from-profile` carries `ARCHETYPE_STYLES` (10 archetypes) and
`CATEGORY_STYLE_TWEAKS` as inline JS literals keyed off `profile.archetype`.
The audit's triple-taxonomy finding names `influencerData.js`,
`SocialProfile.js`, and the franchise-law seeder. This is a fourth vocabulary,
and it belongs to the Director Brain migration inventory (F-Franchise-1).

The `'justawoman'` literal at 3839 carries an in-line comment naming the drift
explicitly: it cross-references `episodeCompletionService:176` as matching, and
flags `careerPipelineService.getAccessibleCareerTier` as querying `'lala'`,
described as "a pre-existing bug - don't reuse that helper here." The defect
was known and worked around rather than fixed. F-Sec-3 owns it; the statement
converts verbatim.

---

## Forward Statement

`worldEvents.js` is fully dispositioned at statement level. 112 statements, 65
convert, 47 withdraw.

**Open item 37 is the remaining blocker.** §12.42 requires per-group PRs and
group membership is unpublished. Statement-level work on this file is complete;
sequencing is not possible until membership is.

`worldEvents.js` remains the next executable surface. Open items 6 and 32 still
deserve resolution rather than carry before it. After F-Stats-1 closes:
**F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-06. Main at `30fba75d` (#986). Predecessor: v1.22.*
*Minted: §25, §25.1-§25.5, open item 37. Amended: §16. Extended: §12.41. Mints no FD. Tail: FD-61. [skip-automerge]*
