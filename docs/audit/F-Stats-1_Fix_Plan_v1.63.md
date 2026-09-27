# F-Stats-1 Fix Plan v1.63

*Additive-supersede on v1.62. Mints §66. Records Evoni's ruling on the §65.3-P reach probe: item 3 closed, the `state_json` read ruled a defect with its fix owed, Phase B complete apart from its owed fixes, and the locked sequence moved to F-Ward-1. Mints no FD, no PE, no XK.*

## What changed in v1.63

**RULING (Evoni, 2026-09-27): "Item 3 closes on the reach probe. Class 4's read of state_json, a column that does not exist, is a defect; its fix is owed now and homed to F-Stats-1. F-Stats-1 Phase B is complete apart from its owed fixes, and the locked sequence moves to F-Ward-1."** **Added by Evoni before merge: "§66.3-F: the affordability and financial-pressure handlers take their balance from getCurrentBalance, the source /balance uses; their swallowing catches go and errors are logged; financialPressureService's logTransaction, unused and writing a column that does not exist, is removed if nothing calls it."** Both are quoted at §66.1. They are the only things this revision rules; every other clause is MEASURED, ATTESTED or carried, and says so.

**Item 3 closes on the reach probe** (`F-Stats-1_S355_ReachProbe_2026-09-27.md`, PR #2075). §65.3-P is discharged. §66.2.

**The `state_json` read is a defect. Its fix, §66.3-F, is owed now and homed to F-Stats-1.** §66.3.

**F-Stats-1 Phase B is complete apart from its owed fixes.** The owed fixes are listed at §66.4: §65.6-F, done, and §66.3-F, owed.

**The locked sequence moves to F-Ward-1.** §66.5.

---

## H1 — Basis

```
$ git rev-parse origin/main
b71444dd00bf43b823f74c5365264d0b004a329b
```

MEASURED. Date: 2026-09-27. The newest prior revision is v1.62:

```
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v1\.6[0-9]\.md$'
F-Stats-1_Fix_Plan_v1.60.md
F-Stats-1_Fix_Plan_v1.61.md
F-Stats-1_Fix_Plan_v1.62.md
```

---

## §66 — the reach probe ruled; Phase B complete

### §66.1 RULING — Evoni, 2026-09-27

**RULED**, verbatim, in the review chat:

> "Item 3 closes on the reach probe. Class 4's read of state_json, a column that does not exist, is a defect; its fix is owed now and homed to F-Stats-1. F-Stats-1 Phase B is complete apart from its owed fixes, and the locked sequence moves to F-Ward-1."

**Added by Evoni before merge**, verbatim, in the review chat the same day:

> "§66.3-F: the affordability and financial-pressure handlers take their balance from getCurrentBalance, the source /balance uses; their swallowing catches go and errors are logged; financialPressureService's logTransaction, unused and writing a column that does not exist, is removed if nothing calls it."

A trailing `"` in the first chat paste is left out as a paste artifact. **Nothing else is ruled.** Where the ruling leaves a point open, the sections below say so and do not fill it.

### §66.2 Item 3 — closed on the reach probe

**RULED:** item 3 closes on the reach probe.

The probe is `F-Stats-1_S355_ReachProbe_2026-09-27.md` (PR #2075, basis `073e57f8`), owed as §65.3-P by v1.62 §65.3. Its findings, as filed (carried, not re-derived here):
- Classes 2–6 are re-located by content in `worldEvents.js`. The one exception is v1.41's unlisted "5 further in-handler splits".
- Reach beyond `worldEvents.js` is established for classes 2, 4 and 6.
- For class 3, the population is established; the fabricated subset needs a read.
- For class 5, reach is not established.

**Disposition:** item 3 is closed and §65.3-P is discharged. v1.62 §65.3's homing (all five classes to F-Stats-1, class 4 the priority, class 6 an observation) stands as ruled. This revision does not revisit it.

### §66.3 The `state_json` read — a defect; §66.3-F owed

**RULED:** "Class 4's read of state_json, a column that does not exist, is a defect; its fix is owed now and homed to F-Stats-1."

**The sites the probe named, at this basis — MEASURED:**

```
$ git show origin/main:src/routes/worldEvents.js | grep -n "state_json\|router.get('/world/:showId/events/:eventId/affordability'\|router.get('/world/:showId/financial-pressure'"
2660:router.get('/world/:showId/events/:eventId/affordability', requireAuth, async (req, res) => {
2676:        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
2679:      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
2719:router.get('/world/:showId/financial-pressure', requireAuth, async (req, res) => {
2728:        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
2731:      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
```

`GET /world/:showId/events/:eventId/affordability` and `GET /world/:showId/financial-pressure` each read `character_state_history.state_json`. Each falls back to a balance of 500 in a bare catch. The column does not exist:
- **MEASURED:** no migration or model declares it. The table's creating migration declares `state_after_json` (probe §3.1).
- **ATTESTED, from a filed document:** the canon capture `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` lists no such column (probe §3.1).

**Owed: §66.3-F**, the fix for the `state_json` read, homed to F-Stats-1, owed now.

**The fix's shape — RULED (the added sentence, §66.1):**
- **The balance source.** Both handlers take their balance from `getCurrentBalance`, "the source /balance uses" (`worldEvents.js:4182` at this basis). This replaces the `state_json` read and its fixed 500 default.
- **The catches.** "their swallowing catches go and errors are logged." The ruling says "their swallowing catches" and does not list them. At this basis the affordability handler has one bare catch (2681) and the financial-pressure handler has four (2733, 2746, 2756, 2769; probe §1.2). **Not specified:** whether all four financial-pressure catches are meant, or only the balance read's. The fix's PR should name the catches it changes.
- **The third site.** `financialPressureService.js`'s `logTransaction` "is removed if nothing calls it" (below).

**A third `state_json` site, outside the probe's population — MEASURED; its removal RULED by the added sentence:**

```
$ git grep -n "state_json" origin/main -- src | grep -v state_after_json
origin/main:src/routes/worldEvents.js:2676:        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
origin/main:src/routes/worldEvents.js:2679:      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
origin/main:src/routes/worldEvents.js:2728:        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
origin/main:src/routes/worldEvents.js:2731:      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
origin/main:src/services/financialPressureService.js:197:      `SELECT id, state_json FROM character_state_history
origin/main:src/services/financialPressureService.js:203:      const stateJson = typeof state.state_json === 'string' ? JSON.parse(state.state_json) : (state.state_json || {});
origin/main:src/services/financialPressureService.js:208:        'UPDATE character_state_history SET state_json = :state, updated_at = NOW() WHERE id = :id',
```

- `financialPressureService.js`'s `logTransaction` (line 190) reads `state_json` and writes it back, with `updated_at`. Its catch logs with `console.warn`.
- The probe's population was route files only (probe §2.3), so it did not see this site.
- **MEASURED:** nothing at this basis calls it. The only file that requires `financialPressureService` is `worldEvents.js`, and it takes `checkAffordability`, `recordDeclinedInvite` and `buildFinancialPressureContext`, never `logTransaction`:

```
$ git grep -nE "require\(['\"][./]*services/financialPressureService['\"]\)" origin/main -- src
origin/main:src/routes/worldEvents.js:2683:    const { checkAffordability } = require('../services/financialPressureService');
origin/main:src/routes/worldEvents.js:2709:    const { recordDeclinedInvite } = require('../services/financialPressureService');
origin/main:src/routes/worldEvents.js:2771:    const { buildFinancialPressureContext } = require('../services/financialPressureService');
origin/main:src/routes/worldEvents.js:4180:    const { checkAffordability } = require('../services/financialPressureService');
```

**RULED (the added sentence):** `logTransaction` "is removed if nothing calls it". At this basis nothing calls it (MEASURED above). The condition is checked again when the fix is written, and the fix's PR shows the check.

**Disposition:** the defect is ruled, and so is the fix's shape. §66.3-F is owed now under F-Stats-1. It is agent-doable in `worldEvents.js` and `financialPressureService.js`. One point is open: which financial-pressure catches the ruling means.

### §66.4 Phase B — complete apart from its owed fixes

**RULED:** "F-Stats-1 Phase B is complete apart from its owed fixes".

Phase B's seven items, titled as `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` titles them, as the register now stands:

| Item | Closed by |
|---|---|
| 1 — Reads slice | v1.61 §64 |
| 2 — PE #62 overlap vs F-App-1 §12.11 (the `sync()` sites) | v1.62 §65.2 |
| 3 — §35.5 classes 2–6 homing | v1.62 §65.3 (homing); v1.63 §66.2 (the reach probe) |
| 4 — Second-shape mint decision | v1.62 §65.4 (XK-4 ratified) |
| 5 — StorytellerMemory references | v1.62 §65.5 |
| 6 — `worldStudio.js` transactionality (the character-delete cascade) | v1.62 §65.6 (as a ruling) |
| 7 — Three unread compound-predicate sites | v1.62 §65.7 |

**The owed fixes:**

| Fix | Ruled | Status at this basis |
|---|---|---|
| §65.6-F — the character delete is all-or-nothing | v1.62 §65.6 | **DONE in code:** PR #2071 (`073e57f8`), Task #2070. **Deployed**, ATTESTED: Deploy BB (`F-Deploy-1_Deploy_2026-09-27_BB.md`). |
| §66.3-F — the `state_json` read | v1.63 §66.3 | **OWED now.** |

**Not fixes, and not in this list:** XK-3's remedy, with §64.4-R folded into it by v1.62 §65.4, and XK-4's remedy. Both are Cross-Keystone items, UNEVALUATED and gated. The ruling does not name them as Phase B's owed fixes, and this revision does not add them.

**Disposition:** Phase B is complete apart from §66.3-F.

### §66.5 The locked sequence moves to F-Ward-1

**RULED:** "the locked sequence moves to F-Ward-1."

The locked sequence (Path A), as `PROJECT_CONTEXT.md` §6.1 carries it: F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → **F-Ward-1** → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= Director Brain) → F-Sec-3.

F-Ward-1 is the `episode_wardrobe` migration gap. `PROJECT_CONTEXT.md` §6.1 records it as "Queued; zero repository presence":

```
$ ls docs/audit | grep -c '^F-Ward-1'
0
```

**Not specified by the ruling:** F-Ward-1's first step. This revision opens no F-Ward-1 document.

**§66.3-F stays owed while the sequence moves.** The ruling says Phase B is complete "apart from its owed fixes"; it does not hold F-Ward-1 until they are done.

---

## What this revision does not do

- **Rules nothing beyond §66.1's quoted words.**
- **Mints no FD, no PE, no XK.** FD tail remains **FD-62**; XK tail remains **XK-4**.
- **Does not write the §66.3-F fix.** Its shape is Evoni's added sentence (§66.1, §66.3). This revision adds nothing to it.
- **Does not open F-Ward-1** or any F-Ward-1 document.
- **Does not re-read the probe's other findings as defects.** Classes 2, 3, 5 and 6 stay as v1.62 §65.3 homed them.
- **Does not edit** v1.62, the reach probe or any other filed document in place.
- Does not evaluate any XK remedy. XK-3's and XK-4's fixes stay **UNEVALUATED**.
- **No live database contact by any agent session. No prod-box or dev-box contact.** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

---

## §11 Plan Version History (UPDATED)

| v1.63 | 2026-09-27 | **RULES (Evoni): "Item 3 closes on the reach probe. Class 4's read of state_json, a column that does not exist, is a defect; its fix is owed now and homed to F-Stats-1. F-Stats-1 Phase B is complete apart from its owed fixes, and the locked sequence moves to F-Ward-1."** **Item 3 CLOSED** on `F-Stats-1_S355_ReachProbe_2026-09-27.md` (PR #2075); **§65.3-P discharged** (§66.2). **The `state_json` read (`worldEvents.js` `affordability` and `financial-pressure`) is a DEFECT; §66.3-F owed now, homed to F-Stats-1**; **added before merge: "§66.3-F: the affordability and financial-pressure handlers take their balance from getCurrentBalance, the source /balance uses; their swallowing catches go and errors are logged; financialPressureService's logTransaction, unused and writing a column that does not exist, is removed if nothing calls it."** A third `state_json` site, `financialPressureService.js` `logTransaction`, has no caller at this basis (§66.3). **Phase B COMPLETE apart from its owed fixes:** §65.6-F done (PR #2071, Deploy BB); §66.3-F owed (§66.4). **The locked sequence moves to F-Ward-1** (§66.5). Mints §66; no FD, no PE, no XK. No agent database contact. Basis `b71444dd`. |

## Register hygiene

- **RULES** (§66.1, Evoni): item 3 closed on the reach probe; the `state_json` read a defect, its fix owed now and homed to F-Stats-1; added before merge, §66.3-F's shape (`getCurrentBalance`, catches go and errors logged, `logTransaction` removed if uncalled); Phase B complete apart from its owed fixes; the locked sequence to F-Ward-1.
- **Mints:** §66. No FD (tail **FD-62**), no PE, no XK (tail **XK-4**).
- **Closes:** item 3 (§66.2). **Discharges:** §65.3-P. **Completes:** F-Stats-1 Phase B, apart from its owed fixes (§66.4).
- **Owes, new:** §66.3-F (the `state_json` read's fix, now; homed to F-Stats-1).
- **Owes, carried and done:** §65.6-F, done in code (PR #2071) and deployed (Deploy BB, ATTESTED).
- **Moves:** the locked sequence, from F-Stats-1 Phase B to F-Ward-1.
- Carries forward from v1.62: everything not named above.
- Additive-supersede on v1.62; no destructive rewrite.
- **Numeral disambiguation:** *§66* is unrelated to FD-66 and PE #66. **§66.3-F** is an address for owed work, not a finding. "Item 3" is Phase B item 3 (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`). "Class 4" is v1.33 §35.5's class 4.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**Phase B asked seven questions on 2026-09-10. All seven are answered.** The last one, how far `worldEvents.js`'s patterns reach, was answered by measuring instead of assuming.

**The probe found one thing that was simply wrong.** Two money handlers ask the history table for a column it has never had, so every show's balance there is 500. That fix is small and owed now. The sequence moves on to the wardrobe migration gap while it is done.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `b71444dd00bf43b823f74c5365264d0b004a329b`. Predecessor: v1.62.*
*Minted: §66. Ruled (Evoni): item 3 closed on the reach probe; the `state_json` read a defect, fix owed now, homed to F-Stats-1; §66.3-F's shape (added before merge); Phase B complete apart from its owed fixes; the locked sequence to F-Ward-1. Owed: §66.3-F. Discharged: §65.3-P. Mints no FD, no PE, no XK. Tail: FD-62. XK tail: XK-4. Task: #2076. [skip-automerge]*
