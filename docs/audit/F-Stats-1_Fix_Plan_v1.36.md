# F-Stats-1 Fix Plan v1.36

*Additive-supersede on v1.35. Mints §39. Closes no item. Changes no disposition.*

## What changed in v1.36

**§38.1's population figure is corrected.** v1.35 §38.1 states that v1.33
"dispositioned 22 of 63 statements." The file is **112 statements** — §28's
figure, derived by three independent methods at v1.26 and re-derived a fourth
time at this revision's basis. The 63 is §35's own scope presented as the file's
population; it omits §16's 47 dispositioned statements entirely.

**Open item 41 is not closed and its remainder is not disturbed.** §35.7's
41-statement remainder is sound. What was defective is the denominator the mint
was written against, not the work outstanding.

Three subordinate arithmetic defects are recorded at §39.4. None is resolved
here.

---

## §39 — correction to v1.35 §38.1: the `worldEvents.js` population figure

### §39.1 What v1.35 stated, and why it was wrong

| | v1.35 §38.1 | Correct |
|---|---|---|
| Statements dispositioned at v1.33 | 22 | 24 |
| `worldEvents.js` population | 63 | **112** |
| Statements outstanding | 41 | 41 — **unchanged** |

The 63 was never a measurement. It is the sum of §35's own scope: the four
groups §35.2 recorded as reconciling, plus §35.7's remainder.

| Component | Count |
|---|---|
| Stories | 2 |
| Distribution | 3 |
| Outfit | 7 |
| Financial | 10 |
| **§38.1's "22"** | **22** |
| §35.7 remainder (Ep. generation 15, Invitations 23, Venue/social 3) | 41 |
| **§38.1's "63"** | **63** |

The composition reconciles exactly and leaves no residue, which is the basis for
stating it as the derivation rather than as a hypothesis.

**Two populations are excluded by it:**

- **§16's 47.** §16.1 Core CRUD (21) and §16.2 Overlays (26) were dispositioned
  at v1.14 — both headers carry `DISPOSITIONED` in the title. §28 confirms both
  against their disposition tables. §35 had no occasion to open them and did not
  claim to.
- **Venue/social's measured 2.** §35.2 records this group as `DOES NOT
  RECONCILE`; its two measured statements are absent from the 22.

63 + 47 + 2 = **112**.

### §39.2 The authority, and why it was not consulted

`worldEvents.js` is 112 statements. §28 (v1.26) states this in its group table's
total row and records it as `CONFIRMED — third method`, agreeing with §16 at a
different basis. A fourth derivation at this revision's basis returns 112 under
§28's own pattern.

§28 is cited by §35, by §36, and by v1.35. **None of the three re-read its group
table.** Each cited §28 for method — the handler-window bounding, the counting
pattern, the tooling hazard — and none for its population figure, which is in
the same section.

§35.1 re-derived two of §28's figures at `2c9ead22`: the 61 `router.*` handlers
and the positional EOF at 4005. Both `CONFIRMED`. Neither figure tests the
statement count, which is why a defect in the population figure could survive an
explicit re-derivation pass without being touched.

### §39.3 Consequence for open item 41

Item 41's closure condition is full disposition of the `worldEvents.js` surface
or formal re-homing, with partial disposition not closing it. That condition is
measurable; it was written against the wrong universe.

| Frame | Dispositioned | Outstanding |
|---|---|---|
| §38.1's 63 | 22 — **35%** | 41 — **65%** |
| Corrected, 112 | 71 — **63%** | 41 — **37%** |

**The distortion runs toward understatement.** A cold session reading item 41's
mint reads the keystone as roughly one-third dispositioned with the majority of
the surface outstanding. It is roughly two-thirds dispositioned with about a
third outstanding. The absolute remainder — 41 — is identical in both frames,
which is what allowed the wrong denominator to read as coherent.

**Item 41 remains OPEN.** Its closure condition is unchanged. The denominator
against which "full" is measured is **112**, supplied by §28.

**Carve-out carried forward:** §16.2 records Overlays as dispositioned with **2
handlers pending** — `reject-overlay` (2 statements) and `overlay-selections`
(1), per §28. Three of Overlays' 26 are dispositioned-with-pending rather than
closed. Item 41's closure accounting must carry this. Adjacent in kind to open
item 6's v1.31 carve-out; not merged with it here.

### §39.4 Subordinate defects — recorded, none resolved

Three defects surfaced during this pass. Each is stated at the strength its
evidence supports. **None is resolved in this revision** and no ownership is
claimed for any.

1. **§35.2's Outfit row sums to 6 against a header of 7.** Rows: 2675 (1),
   2697 (3), 2776 (2). §28 records Outfit at 7 statements across 4 handlers, and
   §35.2's header agrees. The header is corroborated; **a row undercounts, or a
   fourth handler's row is absent.** Resolution requires re-measuring the group
   at source.

2. **Venue/social is 5 at §28, not 3.** §35.4 reads §28 as "5 statements, less
   the 2 already dispositioned," inferring 3 remain, and measures 2 in the
   undispositioned set. Whether §28's 5 is the group total or its remainder is
   not established. §35.4 records the defect and declines resolution; that
   position stands. **The defect is against §28's group membership, which §35.4
   correctly identifies as its own pass.**

3. **Site 570 appears in two censuses.** §36.1 lists 570 among scoped reads,
   parenthetically identifying it as a `DELETE`. §36.2 lists 570 among scoped
   writes. §36.2's total of "49 raw access sites" counts it twice. Either the
   figure is 48, or the dual count is deliberate and owed an explicit ruling.
   **Not ruled here.**

### §39.5 Method note — recorded so it is not repeated

The 63 entered the register because a scope-local sum was carried into a
sentence that reads as a file-wide measurement. It was not challenged across
§35, §36, and v1.35 because each of those revisions cited §28 for method while
deriving population from the preceding revision's prose.

**A count stated in prose is not a measurement.** Where a section states a
population, the counting authority's own table is the thing to read, not the
section that cites it. §28's Forward Statement names the same mechanism for a
different figure: *a figure that has not been re-derived at the current basis is
not evidence, however many revisions have repeated it.* This is that mechanism
operating on a figure that was never derived at any basis.

This joins §28's fixed-width-window hazard, §28's `Measure-Object -Line` hazard,
and §36.4's `LIMIT\s*1` probe hazard in the accumulated method-hazard set.

### §39.6 What this revision does not do

- Does not close open item 41, or alter its closure condition.
- Does not change any group disposition. All of §16's and §35.2's stand.
- Does not resolve any defect at §39.4.
- Does not re-derive §28's group membership.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not disposition Episode generation or Invitations.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
- Does not draw the XK-1 population conclusion, still deferred.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not mint an FD, PE, or XK number.
- Does not enumerate prod. Prod remains FROZEN and this revision confers no
  authority to touch it.
- **No live database contact. No prod-box contact. No dev-box contact.**
  Source- and register-derived entirely, via `git show origin/main:` and
  `git grep` at `8b6a2587`.

---

## §11 Plan Version History (UPDATED)

| v1.36 | 2026-08-13 | **§38.1's population figure corrected** — `worldEvents.js` is 112 statements per §28's group table (three methods at v1.26, fourth at this basis), not 63. The 63 is §35's scope-local sum: its four reconciling groups (22) plus §35.7's remainder (41); it omits §16's 47 dispositioned statements (Core CRUD 21, Overlays 26, both DISPOSITIONED at v1.14) and Venue/social's measured 2. 63 + 47 + 2 = 112. **Open item 41 remains OPEN**; §35.7's 41-statement remainder is sound and undisturbed; the denominator for its closure condition is 112. §16.2's 2-pending-handler carve-out carried forward into item 41's accounting. Three subordinate defects recorded at §39.4, none resolved, no ownership claimed: §35.2's Outfit row sum (6 vs. header 7); Venue/social 5-vs-3 against §28 (§35.4's defect, restated at §28's figure); site 570 double-counted across §36.1 and §36.2 censuses. Method hazard recorded at §39.5. Mints no FD. No live DB contact. Prod FROZEN, untouched. §39 minted. Basis `8b6a2587`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.35. Tail: **FD-61**.
- Mints: **§39**.
- Closes: **nothing**.
- Carries: **open item 41** (open, closure condition unchanged, denominator
  corrected to 112); open item 6 (v1.31 carve-out stands); open item 23; all
  other items carried from v1.35.
- Defers: XK-1's remedy; the XK-1 population question; all three defects at
  §39.4.
- Forward-points: nothing new. v1.35's §29 write hazard and
  `scripts/migrations/` hardcoded-fallback class remain forward-pointed and
  unowned; this revision does not adopt them.
- Changes no unit disposition, no PR state, no group disposition. Unit 19's
  withdrawal stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.35; no destructive rewrite. v1.33's, v1.34's, and
  v1.35's bodies are not modified; the correction lives here.
- **Numeral disambiguation:** *open item 41 (F-Stats-1)* is unrelated to *FD-41
  (F-Deploy-1)* and to any §41. *§16 (F-Stats-1, minted v1.14)* — note that the
  section number and its minting revision number do not correspond; §16 is not
  in v1.16.

## Forward Statement

The 63 survived three revisions because each one cited §28 for method and took
population from the prose preceding it. The correction was available in §28's
group table the entire time.

Item 41 exists to make an undispositioned surface visible to the register. This
revision corrects the figure that mint was written against. The surface itself
is unchanged: 41 statements outstanding, six finding classes unminted, finding
class 1 homing-owed and outside F-AUTH-1 as scoped.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `8b6a2587`. Predecessor: v1.35 (`8b6a2587`, #1008).*
*Minted: §39. Closed: nothing. Mints no FD. Tail: FD-61. [skip-automerge]*
