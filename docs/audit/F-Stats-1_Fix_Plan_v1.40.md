# F-Stats-1 Fix Plan v1.40
*Additive-supersede on v1.39. Mints §43. Overturns v1.32 §34's ruling. Changes no disposition.*

## What changed in v1.40

**v1.32 §34's ruling that *open item 23 (F-Stats-1)* was NEVER MINTED is
OVERTURNED.** The item was minted at v1.14, is attested four times in that
revision, and has never been closed. **It is restored as OPEN.**

**v1.32's probes could not have found it.** All three are `-SimpleMatch` on the
phrase `item 23` or `open item 23`. §34.1's own design note states the phrasing
was chosen to exclude *"§23.1, `v1.23`, and the bare numeral."* **The bare numeral
is the mint form.** v1.14 mints as `23. **NEW:**` under `## Open items`, and as
`open items 22–24` in its footer. Neither string contains `item 23`.

**A controlled comparison establishes this rather than argues it** — §43.2.
Items 22, 23 and 24 were minted together, in one numbered list, in one revision,
under one footer line. v1.32's probe form run against v1.14 returns hits for
**22 and 24** and none for **23**. The three differ in one respect only: 22 and 24
are prose-cited elsewhere in v1.14, and 23 is not. **The probes measure
prose-citation incidence, not existence.**

**v1.32's Forward Statement bar — *"No downstream artifact may cite it"* — is
LIFTED.**

**v1.26–v1.29 were not carrying an unsupported claim.** They cited a real,
minted, open item correctly. v1.32's factual finding that v1.27 also references
the label stands; its characterisation of those references as an
inheritance-failure does not.

**v1.32 §34.3's re-anchor of the `worldEvents.js` characterisation to §28 is NOT
disturbed.** It is independently sound and is left standing.

**Item 23's substance is stale and is re-anchored** — §43.5. Its v1.14 text
predates every subsequent correction. The item exists and is open; what it tracks
is now stated by v1.39's accounting.

**A register-hygiene question is raised and NOT ruled** — §43.6. Item 23 and
open item 41 may track the same substance.

---

## §43 — *open item 23 (F-Stats-1)*: minted, open, restored

### §43.1 The mint

Basis `430696a9` (v1.39, #1012). Register-derived via `git show origin/main:`.

v1.14 attests the mint four times:

| Location | Text |
|---|---|
| "What changed" | *"**Open items 22–24.**"* |
| `## Open items` | *"23. **NEW:** seven of nine `worldEvents.js` groups remain undispositioned — …"* |
| §11 history row | *"… Core CRUD and Overlays dispositioned; open items 22–24."* |
| Footer | *"Minted: §16, §16.1, §16.2, §12.41, §12.42, §12.43, **open items 22–24**."* |

The numbered entry carries substance: the seven undispositioned groups with their
statement counts, plus the two Overlays handlers, plus the instruction
*"Re-derive live; the group totals in §16 are the basis, not the dispositions."*

**Items 22 and 24 are minted in the same list, in the same revision, under the
same footer line.** Neither has ever been questioned. Both are cited downstream.

### §43.2 The controlled comparison

v1.32's probe form, run at this revision against v1.14:

```
Select-String -Pattern "item 22","item 23","item 24" -SimpleMatch
```

| Item | Hits in v1.14 | Minted at v1.14 |
|---|---|---|
| 22 | 2 | yes |
| 23 | **0** | **yes** |
| 24 | 1 | yes |

**Three items, one mint, one revision, one footer line — and the probe
distinguishes them.** What it distinguishes is not existence. Items 22 and 24 are
prose-cited within v1.14 (*"See open item 22"*, *"See open item 24"*, and a
Forward-points hygiene line). Item 23 was minted and not prose-cited until v1.26.

**The probes measure prose-citation incidence.** For items that happen to be
cross-referenced in running text they return positive; for an item minted in the
numbered-list convention and not otherwise mentioned they return zero. The null
result for item 23 carries no evidential weight on the question v1.32 put to it.

This also explains why v1.32's conclusion was plausible rather than careless. Had
the probes been sanity-checked against items 22 and 24, they would have returned
positive — making item 23's null look like a real difference in kind rather than
an artifact of the pattern.

### §43.3 Never closed

Closures in the corpus are recorded as `Closes:` in Register hygiene and
`Closed:` in the footer. Across every F-Stats-1 revision from v1.14 — the mint —
through v1.31, immediately preceding v1.32's ruling, the closures recorded are:

open item 14 (v1.11), open item 17 (v1.13), open item 19 (v1.17, resolved), open
item 29 (v1.17, by withdrawal), open item 35 (v1.22), open item 37 (v1.24).

**No revision closes item 22, item 23 or item 24.** Item 23 has been open
continuously since v1.14.

### §43.4 What v1.32 got right, and what is left standing

§34.2's reasoning about v1.26 is sound on its own terms: *"v1.26's language is
assertion, not creation."* That is true. v1.26 did not need to create the item —
v1.14 did, twelve revisions upstream of where the probes began.

**Left standing, undisturbed:**

- **§34.3's re-anchor.** v1.32 re-anchored the `worldEvents.js` remaining-work
  characterisation to §28's re-derived totals. That was correct then and remains
  correct; the accounting has since advanced to v1.39, and the re-anchor's
  direction — to measured totals rather than to a label — is the right one.
- **§32.3's forward-path bar being lifted.** The bar is lifted either way; only
  the reason changes.
- **The factual finding that v1.27 references the label.** v1.32 corrected
  §32.3's set by adding v1.27. That is a fact about the corpus and it stands.

**Overturned:**

- The ruling that no register item exists under the label.
- The Forward Statement's bar: *"Open item 23 (F-Stats-1) does not exist and never
  did. No downstream artifact may cite it."*
- The characterisation of v1.26–v1.29 as a **carrying set** for an unsupported
  claim. They cited a real item. v1.32's reading instruction for those revisions —
  that their references point at §28's undispositioned groups — remains a correct
  description of the substance, but they are not carriers of a defect.

### §43.5 Item 23's substance is stale

The item exists and is open. **Its v1.14 text is superseded on every figure it
contains.**

As minted it reads: seven of nine groups undispositioned — Invitations (23),
Episode generation (15), Financial (10), Outfit (7), Venue/social (5 less the 2
above), Distribution (3), Stories (2) — plus two Overlays handlers.

Since then: v1.33 dispositioned five groups; v1.37 eliminated the Outfit row
undercount branch; v1.38 carried §16.2's pending handlers into arithmetic; v1.39
established that Venue/social's measured statements were dispositioned at v1.33
and corrected the remainder to 43.

**Item 23 is re-anchored to v1.39 §42.3.** What remains undispositioned is
Episode generation (15), Invitations (23), two Overlays handlers (3), and two
orphan statements at 2846 and 3764 — **43 statements, 69 dispositioned, 112
total.** Its v1.14 enumeration is historical.

Its closing instruction — *"Re-derive live; the group totals in §16 are the basis,
not the dispositions"* — was correct when written and has been vindicated
repeatedly. §16's totals held. The dispositions were the thing that moved.

### §43.6 Raised, not ruled: item 23 against open item 41

Item 23 tracks `worldEvents.js`'s undispositioned groups. **Open item 41 tracks
the same file's undispositioned remainder.** After §43.5's re-anchor they appear
to have the same subject and the same closure condition.

If so, one of them is redundant and the register should carry one. **This revision
does not rule on it.** Restoring an item and then immediately closing or merging
it in the same revision would compress two decisions into one, and the second is
not this revision's to take.

Recorded as owed. No ownership claimed.

### §43.7 Method note — a null result needs a positive control

v1.32 ran three probes, documented their design, explained the `-SimpleMatch`
choice, and reasoned carefully about scope: probe B a deliberate superset of A,
probe C extending beyond the Fix Plan family. **The design work was serious. The
one thing not done was running the probe against a case known to be positive.**

**A null result is evidence only if the probe could have returned a positive.**
Items 22 and 24 were available as controls in the same file, minted in the same
list, and would have taken one command.

The failure is not carelessness. It is a probe validated for scope and coverage
but never for sensitivity — and a pattern documented as *excluding* the bare
numeral, applied to a corpus whose mint convention *is* the bare numeral. The
exclusion was recorded in §34.1 and its consequence was not drawn.

This joins §28's fixed-width-window hazard, §28's `Measure-Object -Line` hazard,
§36.4's `LIMIT\s*1` probe hazard, §39.5's prose-population hazard, §40.6's
fit-to-authority hazard, §41.5's four hazards, and §42.6's table-beats-prose
hazard in the accumulated method-hazard set.

**Every ruling in this register that rests on a null probe result is a candidate
for the same defect.** Whether others exist is not established here.

---

## What this revision does not do

- Does not disposition any statement. **43 remain outstanding per v1.39 §42.3.**
- Does not close open item 23, or rule on its relationship to open item 41.
- Does not close open item 41, or alter its figure.
- Does not re-audit v1.32's other rulings, or survey the register for further
  null-probe conclusions.
- Does not disturb v1.32 §34.3's re-anchor, §32.3's lifted bar, or v1.32's
  factual finding on v1.27.
- Does not rewrite v1.32. Its body stands; this correction is additive-supersede.
- Does not disturb any disposition at §16.1, §16.2 or §35.2.
- Does not resolve §39.4 defect 1 or defect 3.
- Does not open Episode generation or Invitations.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
- Does not draw the XK-1 population conclusion, still deferred.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate. Decision #9's gate on F-Stats-1 Phase B was satisfied by
  F-Deploy-1's closure at its v1.48, independently of this revision.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.40 | 2026-08-13 | **v1.32 §34's NEVER MINTED ruling on *open item 23 (F-Stats-1)* OVERTURNED; the item is restored as OPEN.** It was minted at v1.14 and is attested four times there: the "What changed" bullet, the numbered entry with substance under `## Open items`, the §11 history row, and the footer's `Minted: … open items 22–24`. **v1.32's probes could not have found it** — all three are `-SimpleMatch` on `item 23` / `open item 23`, and §34.1's own design note records that the phrasing excludes the bare numeral, which is the mint form (`23. **NEW:**`, `open items 22–24`). **Controlled comparison at §43.2:** the same probe form run against v1.14 returns 2 hits for item 22 and 1 for item 24 — both minted in the same list, same revision, same footer line — and 0 for item 23. The three differ only in whether v1.14's prose cross-references them. The probes measure prose-citation incidence, not existence. **Never closed** — §43.3 enumerates every closure v1.14–v1.31 (items 14, 17, 19, 29, 35, 37); none is 22, 23 or 24. v1.32's Forward Statement bar on citing the item is **LIFTED**; v1.26–v1.29 cited a real open item and are not a carrying set for a defect. **Left standing:** §34.3's re-anchor to §28, §32.3's lifted bar, and the factual finding that v1.27 references the label. **Item 23's substance is stale and re-anchored to v1.39 §42.3** (43 outstanding / 69 dispositioned / 112). **Raised, not ruled at §43.6:** item 23 and open item 41 may track the same substance; no ruling, no ownership. Method hazard at §43.7 — a null result is evidence only if the probe could have returned a positive; positive controls were available in the same file and were not run. Mints no FD. No live DB contact. Prod FROZEN, untouched. §43 minted. Basis `430696a9`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.39. Tail: **FD-61**.
- Mints: **§43**.
- Closes: **nothing**.
- Overturns: **v1.32 §34's ruling** that *open item 23 (F-Stats-1)* was never
  minted, and v1.32's Forward Statement bar on citing it.
- Restores: ***open item 23 (F-Stats-1)*** — minted v1.14, **OPEN**, never closed,
  substance re-anchored to v1.39 §42.3.
- Leaves standing: v1.32 §34.3's re-anchor; §32.3's lifted forward-path bar;
  v1.32's factual finding that v1.27 references the label.
- Re-characterises: v1.26–v1.29's references as **correct citation of a real
  item**, not carriage of an unsupported claim. Those revisions are not
  superseded and are not corrected on any point.
- Raises, unruled: the **item 23 / open item 41 subject overlap** (§43.6).
- Carries: **open item 41** (OPEN, figure 43 per v1.39, denominator 112); **open
  item 23** (OPEN, restored); open item 6 (v1.31 carve-out stands); all other
  items carried from v1.39.
- Defers: §39.4 defect 1 (open, count- and disposition-neutral, unowned); §39.4
  defect 3 (unruled); XK-1's remedy; the XK-1 population question; any survey of
  further null-probe rulings.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no group disposition, no figure.
  Unit 19's withdrawal stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.39; no destructive rewrite. v1.32's body is not
  modified; the overturn lives here.
- **Numeral disambiguation:** *open item 23 (F-Stats-1)* is unrelated to §23.1
  (F-Stats-1) and to any FD-23. *Open item 41 (F-Stats-1)* is unrelated to FD-41
  (F-Deploy-1) and to §41; its figure is 43 and it is not renumbered, per v1.38
  §41.6. §43 is minted in v1.40; section numbers and their minting revision
  numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.32 ruled an item out of existence on a probe that had been documented, in the
same section, as excluding the form the item was minted in. The ruling held for
eight revisions. It was overturned by running the identical probe against the two
items minted beside it.

**The controls were in the same file the whole time.** One command, three
patterns.

The register's convention absorbed this without loss: v1.32's body stands, its
sound findings are left standing, and the correction is additive. But the
mechanism is now recorded twice in three revisions — §42.6's *the table is the
source*, and §43.7's *a null result needs a positive control*. Both are cases of
a conclusion drawn from an instrument that was never checked against a known
answer.

*Open item 23 (F-Stats-1)* is **OPEN**. Its substance is v1.39 §42.3's:
`worldEvents.js` at **69 of 112 dispositioned, 43 outstanding** — Episode
generation 15, Invitations 23, Overlays pending 3, and two orphan statements at
2846 and 3764.

**Episode generation and Invitations remain the executable surface**, contiguous,
unambiguous, 38 of the 43. Nothing outstanding is unlocated. Whether item 23 or
open item 41 is the register's instrument for tracking it is owed a ruling and is
not taken here.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `430696a9` (#1012). Predecessor: v1.39.*
*Minted: §43. Closed: nothing. Overturned: v1.32 §34's ruling. Restored: open item 23 (F-Stats-1), OPEN. Mints no FD. Tail: FD-61. [skip-automerge]*
