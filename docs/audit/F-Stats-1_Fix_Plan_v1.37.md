# F-Stats-1 Fix Plan v1.37
*Additive-supersede on v1.36. Mints §40. Closes §39.4 defect 2. Changes no disposition.*

## What changed in v1.37

**§39.4's defect 2 is CLOSED at source.** §28's Venue/social figure of 5 is the
**group total**, not a remainder. §35.4's inference of 3 outstanding was correct;
its measurement of 2 was the undercount. **Open item 41's remainder stands at 41,
undisturbed.**

**§39.4's defect 1 is narrowed but NOT closed.** The disjunction §39.4 offered —
"a row undercounts, **or** a fourth handler's row is absent" — resolves to its
second branch. §35.2's three rows measure exactly 1 / 3 / 2 at source; none
undercounts. A fourth handler's row is absent, and it is one of exactly two
candidates. Neither is outfit-substantive. **Membership cannot be determined from
the register or from this pass.**

**The 112 is corroborated at a fifth basis**, by a method independent of the four
at §28: a whole-file statement census under bounded windows, reconciled group by
group with no residue.

**§39.4's defect 3 (site 570) is untouched.** Not ruled here.

A method hazard is recorded at §40.6 against **this revision's own drafting
process**, not against a predecessor.

---

## §40 — §39.4's defects examined at source

### §40.1 Basis and method

Basis `99e487d9` (v1.36, #1009). Two censuses over
`src/routes/worldEvents.js`, read via `git show origin/main:`:

- **Handler census** — `^\s*router\.(get|post|put|patch|delete)\(`
- **Statement census** — `\.query\(`

Every statement is attributed to the handler whose start line precedes it, bounded
by the next handler's start line. **No fixed-width windows** — §28's recorded
hazard, and the mechanism behind §16's original mis-attribution.

**Handler census yields 61.** This matches §28's corrected file total (§16's
62→61). §28's table figure of 50 is the SQL-carrying subset; the two numbers are
not in tension and both are now confirmed at this basis.

**Statement census yields 112.** Fifth derivation. The first four are §28's
(three at v1.26, a fourth at v1.36's basis).

### §40.2 The group reconciliation

| Group | Handlers in band | SQL-carrying | Statements | §28 |
|---|---|---|---|---|
| Core CRUD | 8 | 7 | 21 | 7 / 21 |
| Invitations | 14 | 11 | 23 | 11 / 23 |
| Episode generation | 5 | 5 | 15 | 5 / 15 |
| Financial | 5 | 5 | 10 | 5 / 10 |
| Overlays | 9 | 9 | 26 | 9 / 26 |
| Distribution | 5 | 3 | 3 | 3 / 3 |
| Stories | 4 | 2 | 2 | 2 / 2 |
| **Seven groups, subtotal** | | **42** | **100** | |
| Outfit — §35.2's known members | 3 | 3 | 6 | 4 / 7 |
| Venue/social — known members | 2 | 2 | 2 | 4 / 5 |
| **Unassigned residue** | 3 | 3 | 4 | — |
| **Total** | | **50** | **112** | **50 / 112** |

The seven groups above the subtotal are assigned **by contiguity alone**. Each
occupies an unbroken line band with no membership question; none required
reference to §28 to attribute.

**§28's enumerated members are confirmed.** Financial's five — `affordability`
(2219), `decline` (2252), `financial-pressure` (2278), `financial-forecast`
(2352), `balance` (3730) — are non-contiguous exactly as §28 records, and the
three bottom-of-file financial handlers `complete` (3662),
`finalize-financials` (3688), `financial-ledger` (3710) carry **zero** statements,
out of scope as §28 states. Invitations is 14 handlers in band of which 11 carry
SQL — §28's figure verbatim.

**The residue is the load-bearing result.** After the seven unambiguous groups,
what remains is **3 handlers / 4 statements**. Outfit's shortfall against its §28
header is +1 handler / +1 statement; Venue/social's is +2 handlers / +3
statements. Combined: **+3 handlers / +4 statements.** The residue is consumed
exactly, with nothing left over and nothing owed.

**What this establishes and what it does not.** It establishes both headers as
consistent with the census at this basis — the totals are forced, not fitted. It
does **not** establish membership. See §40.4.

### §40.3 Defect 2 — CLOSED

The unassigned pool, with per-handler statement counts under bounded windows:

| Line | Handler | Stmts | Statement lines |
|---|---|---|---|
| 2836 | `GET /:eventId/feed-activity` | 1 | 2846 |
| 3756 | `POST /:eventId/generate-lists` | 1 | 3764 |
| 3825 | `GET /events/next-suggestions` | 2 | 3836, 3855 |

Venue/social's known members are `generate-venue` (2560, 1 statement) and
`generate-social-checklist` (2626, 1 statement) — **2 statements, 2 handlers.**
Against §28's 5 / 4 it requires +3 statements across +2 handlers.

Only two subsets of the pool satisfy that: {2836, 3825} and {3756, 3825}. Both
are 2 handlers summing to 3 statements. **Under either admissible assignment,
Venue/social is 4 handlers / 5 statements.**

The ambiguity at §40.4 therefore does not reach this question. §28's 5 is the
**group total**. Two members are dispositioned; **3 remain**.

§35.4 inferred 3 and measured 2, recorded the discrepancy, and declined
resolution. That was the correct posture and the inference was sound. The
measurement was short by one statement.

**§35.7's 41-statement remainder is confirmed at source**: Episode generation 15,
Invitations 23, Venue/social 3. **Open item 41 remains OPEN at 41.** Its
denominator is 112 per §39.

### §40.4 Defect 1 — narrowed, NOT closed

**The undercount branch is eliminated.** §35.2's three rows measure at source:
2675 → 1 (2680); 2697 → 3 (2708, 2716, 2763); 2776 → 2 (2782, 2790). Sum 6.
Each row is individually correct. §39.4's alternative — *a fourth handler's row is
absent* — is the surviving branch.

**The fourth handler is one of {2836, 3756}.** Outfit requires +1 handler carrying
exactly 1 statement. 3825 carries 2 and is excluded. Whichever of the remaining
two is not Outfit's belongs to Venue/social with 3825.

**Neither candidate is outfit-substantive.** Both were read at source:

- **`feed-activity` (2836)** — reads `world_events` for `id, name,
  canon_consequences`. No outfit or wardrobe table, no wardrobe service, no
  wardrobe semantics in the route or the body.
- **`generate-lists` (3756)** — its counted statement at 3764 reads `world_events`
  for `id, name, used_in_episode_id`. Its `listType` parameter admits
  `'wardrobe' | 'career' | 'both'`, and its body runs **two co-equal branches**:
  `generateEpisodeTodoList` (wardrobe) and `generateCareerList` (career), both
  from `services/todoListService`. It is no more a wardrobe handler than a career
  handler.

**Route semantics do not adjudicate.** §28's groups are constituted by route
semantics rather than by table touched — Financial's members are
`affordability` / `decline` / `financial-pressure` / `financial-forecast` /
`balance`, and Outfit's known three are `/outfit`, `/outfit`,
`/wardrobe-options`. Under that criterion `generate-lists` has a partial claim via
its `listType` default and `feed-activity` has none. **That claim rests on a
default parameter value in a dual-purpose handler, which is not a measurement.**
This plan does not convert it into one.

**§28 never enumerated Outfit's membership.** It records the group at 4 / 7 and
gives no line numbers. The register cannot supply what was never written down.

**Defect 1 stands OPEN**, narrowed from §39.4's disjunction to: *a fourth
handler's row is absent from §35.2; it is 2836 or 3756; neither is
outfit-substantive; the criterion for assignment is itself unestablished.*
Resolution is owed a ruling on group-constitution criteria, not a further count.
**No ownership is claimed.**

### §40.5 Defect 3 — untouched

Site 570's double count across §36.1 and §36.2, and the consequent 49-vs-48
question on raw access sites, is **not ruled here**. It lies in §36's access-site
census, not the statement census, and nothing in this pass bears on it.

### §40.6 Method note — recorded against this revision's own drafting

During this pass the group table at §40.2 was first stated as reproducing §28
"cell-for-cell," including Outfit at 4 / 7 and Venue/social at 4 / 5. That
statement was reached by **assigning the ambiguous handlers so that the totals
would match §28**, then reporting the match as corroboration. It was retracted
within the session and before any write.

**Fitting to an authority and measuring against it produce the same table and
different evidence.** The distinction is whether the assignment was forced by the
data or chosen to satisfy the target. Here it was chosen.

What survives the retraction is stated at §40.2: the seven unambiguous groups are
assigned by contiguity, and the residue matches the two headers' combined
shortfall exactly. That is forced, and it is why the totals hold under either
admissible assignment. The membership does not follow from it.

This is §39.5's mechanism — *a count stated in prose is not a measurement* —
recurring one revision after §39.5 was written, in the revision written to apply
it. It joins §28's fixed-width-window hazard, §28's `Measure-Object -Line`
hazard, §36.4's `LIMIT\s*1` probe hazard, and §39.5's prose-population hazard in
the accumulated method-hazard set.

### §40.7 Observations recorded, not minted

Neither is dispositioned, and no finding class is minted for either.

1. **Cross-file reach at `generate-lists` (3756).** The handler calls
   `generateEpisodeTodoList` and `generateCareerList` from
   `services/todoListService`. This is reach beyond `worldEvents.js`. It is
   recorded against the standing question of where the six unminted finding
   classes home, and asserts nothing about that question here.

2. **A third instance of the defensive-fallback shape.** `feed-activity`
   (2836) branches `if (models.WorldEvent)` to an ORM read and otherwise issues
   raw SQL over the same columns — the pattern the audit records at
   `wardrobe.js:1291` and `WorldEvent.js:57` as a production-migration-drift
   tell. It contributes one statement under either branch and does not move the
   census.

---

## What this revision does not do

- Does not resolve §39.4 defect 1 or defect 3.
- Does not rule on group-constitution criteria.
- Does not re-derive §28's membership for any group beyond confirming Financial's
  and Invitations' enumerated figures.
- Does not disposition Episode generation, Invitations, or Venue/social.
- Does not close open item 41, or alter its closure condition.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
- Does not draw the XK-1 population conclusion, still deferred.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate. F-Deploy-1's closure at its v1.48 satisfies Decision #9
  independently of this revision; this revision neither effects nor relies on it.
- Does not bear on `deploy-dev.yml` trigger state, which remains a gated decision
  under the 2026-06-27 AllStopped authority.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**
  Source- and register-derived entirely, via `git show origin/main:` at
  `99e487d9`.

---

## §11 Plan Version History (UPDATED)

| v1.37 | 2026-08-13 | **§39.4 defect 2 CLOSED at source.** §28's Venue/social 5 is the group **total**, not a remainder: known members `generate-venue` (2560) and `generate-social-checklist` (2626) carry 2 statements, and only two pool subsets supply the +3 across +2 handlers, both yielding 4 / 5. §35.4's inference of 3 outstanding was sound; its measurement of 2 undercounted. **Open item 41 remains OPEN at 41**; §35.7's remainder confirmed at source (Ep. generation 15, Invitations 23, Venue/social 3). **112 corroborated at a fifth basis** by whole-file statement census under bounded windows, reconciling group by group with zero residue; handler census yields 61, matching §28's 62→61. Financial's five enumerated members and Invitations' 14-of-which-11 confirmed. **Defect 1 narrowed, NOT closed**: undercount branch eliminated (rows measure 1/3/2 exactly); a fourth handler's row is absent; it is 2836 or 3756; neither is outfit-substantive; assignment criterion unestablished; no ownership claimed. Defect 3 (site 570) untouched. Method hazard at §40.6 recorded against this revision's own drafting — fit-to-authority retracted pre-write. Two observations recorded unminted at §40.7. Mints no FD. No live DB contact. Prod FROZEN, untouched. §40 minted. Basis `99e487d9`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.36. Tail: **FD-61**.
- Mints: **§40**.
- Closes: **§39.4 defect 2**.
- Carries: **open item 41** (open, remainder confirmed at 41, denominator 112,
  closure condition unchanged); open item 6 (v1.31 carve-out stands); open item
  23; all other items carried from v1.36.
- Defers: §39.4 defect 1 (narrowed, unowned); §39.4 defect 3 (unruled); XK-1's
  remedy; the XK-1 population question.
- Forward-points: nothing new. v1.35's §29 write hazard and
  `scripts/migrations/` hardcoded-fallback class remain forward-pointed and
  unowned; this revision does not adopt them. §40.7's cross-file reach and
  fallback-shape observations are recorded, not forward-pointed.
- Changes no unit disposition, no PR state, no group disposition. Unit 19's
  withdrawal stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.36; no destructive rewrite. v1.36's body is not
  modified; §39.4's defect entries are not edited in place. Their resolution
  lives here.
- **Numeral disambiguation:** *open item 41 (F-Stats-1)* is unrelated to *FD-41
  (F-Deploy-1)* and to any §41. *§40 (F-Stats-1, minted here in v1.37)* — the
  section number and its minting revision number do not correspond. §28 is not in
  v1.28; §16 is not in v1.16.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

§39 corrected a denominator that had never been derived at any basis. This
revision tests the two defects §39.4 recorded against that denominator and finds
them unlike each other: one dissolves under measurement, and one survives it
because the thing it turns on was never measured by anyone.

Venue/social closes because the arithmetic is over-determined — the answer holds
under every assignment the data admits, so the open question does not reach it.
Outfit does not close because §28 recorded a total without a membership, and no
count can recover a criterion. **The next move on defect 1 is a ruling, not a
count.**

Item 41 is unchanged in every respect: 41 statements outstanding, denominator
112, six finding classes unminted, finding class 1 homing-owed and outside
F-AUTH-1 as scoped. Its remainder is now confirmed at source rather than
inherited.

`worldEvents.js` remains the next executable surface. F-Deploy-1 closed at its
v1.48; Decision #9's gate on F-Stats-1 Phase B is satisfied.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `99e487d9` (#1009). Predecessor: v1.36.*
*Minted: §40. Closed: §39.4 defect 2. Mints no FD. Tail: FD-61. [skip-automerge]*
