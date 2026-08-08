# F-Stats-1 Fix Plan v1.26

| | |
|---|---|
| **Predecessor** | v1.25 (`3fdd49de`, #991). |
| **Basis** | `3fdd49de` (#991 squash-merged). |
| **Author date** | 2026-08-08 |
| **Gate effect** | None. §16's handler counts are corrected; its statement counts are confirmed by a third independent method. No disposition is made, no item closes, no gate moves. `worldEvents.js` remains the next executable surface and remains unblocked per §27. |

## What changed in v1.26

- **§28 (new):** re-derivation of `worldEvents.js` handler structure at basis, by bounded per-handler windows across all 61 handlers.
- **§16 CORRECTED on handler counts only:** 62 → **61** `router.*` handlers; 48 → **50** SQL-carrying; 14 → **11** carrying no raw SQL; Invitations 9 → **11**.
- **§16's 112 statements CONFIRMED**, now by a third independent method. The figure stands unchanged.
- **§16's group membership CONFIRMED.** All nine groups reconcile on statement count. Eight of nine reconcile on handler count. The correction is entirely within Invitations.
- **§16.1 and §16.2 unaffected.** Core CRUD and Overlays reconcile handler-for-handler and statement-for-statement against their disposition tables.
- **Open item 23 narrowed, not closed.** Its group totals are now re-derived at basis; its dispositions remain outstanding.
- **Tooling hazard recorded:** `Measure-Object -Line` is not a line count.
- Basis `3fdd49de`. Mints no FD. Tail: FD-61.

Written **before** any `worldEvents.js` execution. No disposition is performed by this revision.

---

## §28 — `worldEvents.js` handler re-derivation (NEW — derived live at `3fdd49de`)

### Why this was re-derived

§16's statement count was reconciled by two independent methods at derivation and recorded as settled. Its **handler** counts were not. They were carried from a single derivation at `5d9be42b` and repeated through v1.14–v1.25 unchallenged — the mechanism §16's own Forward Statement names: *a figure that has not been re-derived at the current basis is not evidence, however many revisions have repeated it.*

The discrepancy surfaced while establishing line boundaries for an Invitations disposition. It was found by re-deriving, not by hunting it.

### Method

`git show origin/main:src/routes/worldEvents.js` read once into a variable. Handler start lines taken by unanchored `router.(get|post|put|delete|patch|all)\(` match. Each handler bounded by the next handler's start line minus one; the final handler bounded by EOF at line 4005. Statements counted inside each bounded window by the direct call-site pattern `await (models\.)?sequelize\.query` — the same pattern §16 settled on.

**Windows must be bounded.** A fixed-width window (60 lines was tried) overruns into the following handler and reports every handler as SQL-carrying. That result is discarded and recorded here so the error is not repeated.

### Corrections to §16

| Figure | §16 | Re-derived | Disposition |
|---|---|---|---|
| Statements | 112 | **112** | CONFIRMED — third method |
| `router.*` handlers | 62 | **61** | CORRECTED |
| SQL-carrying handlers | 48 | **50** | CORRECTED |
| Handlers with no raw SQL | 14 | **11** | CORRECTED (61 − 50) |

The handler count was verified at **both** bases. `5d9be42b` also yields 61. This is a derivation error at §16, not drift in the file. `worldEvents.js` is untouched between `5d9be42b` and `3fdd49de`.

### Group structure — re-derived

| Group | §16 handlers | Re-derived | §16 statements | Re-derived |
|---|---|---|---|---|
| Core CRUD | 7 | 7 | 21 | 21 |
| Invitations | 9 | **11** | 23 | 23 |
| Episode generation | 5 | 5 | 15 | 15 |
| Overlays | 9 | 9 | 26 | 26 |
| Financial | 5 | 5 | 10 | 10 |
| Outfit | 4 | 4 | 7 | 7 |
| Venue/social | 4 | 4 | 5 | 5 |
| Distribution | 3 | 3 | 3 | 3 |
| Stories | 2 | 2 | 2 | 2 |
| **Total** | **48** | **50** | **112** | **112** |

**Every group reconciles on statements. Eight of nine reconcile on handlers.** The entire correction is Invitations, +2.

Group membership was recoverable from the bounded windows and is confirmed, including **Financial**, whose members are not line-contiguous: `affordability` (2219), `decline` (2252), `financial-pressure` (2278), `financial-forecast` (2352), and `balance` (3730). The three remaining bottom-of-file financial handlers — `complete` (3662), `finalize-financials` (3688), `financial-ledger` (3710) — carry no raw SQL and are out of scope.

### Invitations — the correction in detail

Invitations occupies lines 1041–1686, contiguous, fourteen handlers. Eleven carry SQL; three do not.

| Line | Handler | Stmts |
|---|---|---|
| 1041 | `POST /:eventId/generate-invitation` | 0 |
| 1076 | `GET /:eventId/invitation-text` | 1 |
| 1093 | `POST /:eventId/re-render-invitation` | 3 |
| 1164 | `GET /:eventId/invitation` | 1 |
| 1196 | `POST /:eventId/approve-invitation` | 4 |
| 1271 | `POST /:eventId/reject-invitation` | 2 |
| 1301 | `GET /:eventId/invitation-history` | 1 |
| 1330 | `POST /events/batch-generate-invitations` | 1 |
| 1391 | `GET /:eventId/invitation-pdf` | 0 |
| 1411 | `POST /:eventId/animate-invitation` | 2 |
| 1477 | `GET /:eventId/animate-invitation/:jobId` | 0 |
| 1510 | `POST /:eventId/edit-invitation-text` | 3 |
| 1605 | `POST /:eventId/unlink-invitation` | 1 |
| 1627 | `DELETE /:eventId/invitation/:assetId` | 4 |
| **Total** | **11 SQL-carrying** | **23** |

§16's statement total of 23 for this group is correct. Its handler count of 9 is not.

### Handlers carrying no raw SQL

Eleven, not fourteen: `ai-fix` (898), `generate-invitation` (1041), `invitation-pdf` (1391), `animate-invitation/:jobId` (1477), `generate-story` (3481), `stories` (3502), `generate-distribution` (3564), `distribution-defaults` PUT (3623), `complete` (3662), `finalize-financials` (3688), `financial-ledger` (3710).

### What this does not change

- **112 statements.** Unchanged, and now stronger: three independent methods agree.
- **§16.1 Core CRUD dispositions.** 1, 2, 5, 2, 8, 2, 1 across seven handlers — matches the disposition table exactly, including the eight at `POST /:eventId/inject`.
- **§16.2 Overlays dispositions.** 5, 8, 2, 2, 2, 1, 4, 1, 1 across nine handlers — matches, including both pending handlers (`reject-overlay` 2, `overlay-selections` 1).
- **§12.42 non-uniform convertibility.** Withdrawal rates are properties of dispositions, not handler counts.
- **§12.35, §12.41, §12.38.** Untouched.
- **Every disposition already made.** No statement changes disposition under this revision.

### Tooling hazard — `Measure-Object -Line`

`Measure-Object -Line` counts lines **with content**. On this file it returns 3539 against a positional length of 4005 — an undercount of 466. Used as an EOF bound it would have shifted every window past line 3539 and produced per-handler counts that were plausible and silently wrong.

Use `(… | Select-String -Pattern "^" -AllMatches | Select-Object -Last 1).LineNumber` for any line number that will be used as an offset. `Select-String` counts positionally and is directly comparable to handler line numbers.

This joins the accumulated PowerShell hazard set alongside `Get-Content -Raw` encoding damage and `&&`.

---

## §11 Plan Version History (UPDATED)

| v1.26 | 2026-08-08 | §16 handler counts corrected: 62→61 `router.*`, 48→50 SQL-carrying, 14→11 no-SQL, Invitations 9→11. §16's 112 statements confirmed by a third independent method. Group membership confirmed; eight of nine groups reconcile on handlers, all nine on statements. §16.1 and §16.2 unaffected. §28 minted. No dispositions, no closures, no gate change. Basis `3fdd49de`. |

v1.26 supersedes §16 **on handler counts only**. All other v1.25 and v1.14 forward direction stands unchanged, including §27's carry rationale, the item 40 re-homing, §16's statement counts, and the §16.1/§16.2 dispositions.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.25. Tail: FD-61.
- Mints: §28. Closes: nothing.
- Corrects: §16 handler counts. **62 superseded by 61; 48 by 50; 14 by 11; Invitations 9 by 11.**
- Confirms: §16's 112 statements, by a third independent method. §16's group membership.
- Narrows: open item 23 — group totals re-derived at basis; dispositions still outstanding.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.25; no destructive rewrite.
- No live-database contact. No prod-box contact. No dev-box contact. All conclusions derive from committed files read via `git show origin/main:` and `git show 5d9be42b:`.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.26 is the plan-of-record.

**`worldEvents.js` remains the next executable surface**, unblocked per §27, at 112 statements across **50** handlers in 9 groups.

**Open item 23 stands.** Seven groups remain undispositioned — Invitations (23), Episode generation (15), Financial (10), Outfit (7), Venue/social (5 less the 2 already dispositioned), Distribution (3), Stories (2) — plus two Overlays handlers. Their **totals** are now re-derived at basis and can be relied on. Their **dispositions** cannot; there are none.

**Open items 6 and 32 remain carried** per §27. Item 6's remainder resumes when open item 40 receives an owner. Item 32 resolves only in a dedicated, gated `db_password` rotation session meeting the §27 preconditions.

Two things this revision establishes:

**The count discipline works, and it is not optional.** §16 recorded 144→112 as its central lesson and then carried an unverified handler count through eleven revisions. The correction is small in effect — no disposition moves — but the mechanism that produced it is the one that produced 144. It was caught at one revision's distance from use, not two.

**Bounded windows are the method.** Fixed-width windows overrun handler boundaries and produce confident, wrong attributions. §16's original hand-attribution error and this revision's discarded 60-line pass are the same failure. Every count here is bounded by the next handler's start line.

After F-Stats-1 closes: **F-Ward-1 next** — which inherits two tables from the §26 inventory.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-08. Main at `3fdd49de` (#991). Predecessor: v1.25.*
*Minted: §28. Closed: nothing. Corrected: §16 handler counts 62→61, 48→50, 14→11, Invitations 9→11. Confirmed: 112 statements, third method. Mints no FD. Tail: FD-61. [skip-automerge]*
