# IA-4 Deep-Dive & Fix Direction — `/universe/production` Single-Show Defect

> **CLEANUP-PLAN PHASE. NO CODE CHANGED.** Per Path A (inventory → findings →
> *plan* → remediation), this document analyses one finding and recommends a fix
> *direction with costs*. It writes no code, renames nothing, and touches no
> route. Frontend analysis — touches no backend, no DB, no frozen prod box.

| | |
|---|---|
| **Parent** | `Frontend_IA_Audit_Findings_v1.md`, finding **IA-4** (severity HIGH — the only functional defect in the IA set) |
| **Scope** | IA-4 only (first cleanup-plan item, per scope decision 2026-05-31). Other findings deferred to the broader consolidation pass. |
| **Direction chosen** | **True universe roll-up** (aggregate all shows) — selected 2026-05-31 |
| **Status** | Deep-dive + recommended direction. Implementation NOT started. |
| **Grounding** | `UniverseProductionPage.jsx` read in full. `ProductionTab.jsx` read partially (terminal-garbled mid-file) — structure confirmed, exact line edits require a clean re-read (see §6). |

---

## Sec 1 — The defect, mechanized from source

`/universe/production` presents franchise-level chrome but renders exactly **one
arbitrary show**. The mechanism, confirmed from code:

1. **`UniverseProductionPage`** (`pages/UniverseProductionPage.jsx`) loads **all**
   shows — `listShowsApi()` → `GET /api/v1/shows`, no filter — into `shows`, and
   passes the whole array down as the `shows` prop alongside a hardcoded
   `universeId = LALAVERSE_ID` (`'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e'`).
2. **`ProductionTab`** derives a single show from that array —
   `const show = linkedShows[0]` (findings `ProductionTab.jsx:125`), then
   `showId = show?.id` (`:126`).
3. **Every data call keys to that single `showId`** — episodes (`:136,171`), world
   events (`:137`), goals (`:138`), Lala's character state (`:160`). The
   studio-tool routes confirm single-show scope: all hardcode
   `/shows/${showId}/world…`.
4. **No picker, no URL param, no indication.** The hero even renders the literal
   "LalaVerse" and "Season 1" and a "Living World State" header — the framing
   *actively asserts* a franchise view while the data underneath is `shows[0]`.

**Impact:** with 10 shows in the DB, **nine are unreachable** from this page, and
`/episodes` redirects users straight into it (IA-3, `App.jsx:325`). This is an
accidental single-show view masquerading as a universe view — a functional defect,
not a naming nit.

---

## Sec 2 — `v2.12 §9.11` resolved (affects IA-5, not IA-4)

Chased per the cleanup-phase plan. **Outcome: note-and-proceed, evidence-based.**

- The `listShowsApi` comment (`UniverseProductionPage.jsx:15-17`) is self-documenting:
  a **deliberate** file-local duplicate — *"Path A (continue file-local convention)
  per CP15 Decision 2,"* reaching *"5-fold cross-CP existence after CP15 (6-fold
  including WorldSetupGuide)."*
- Repo-wide grep for the spec text found **no `v2.12` document in-tree** — only
  `node_modules` changelog version-string coincidences and the audit docs that
  already cite it.
- **Therefore:** §9.11 is a *logged decision to accept the duplication*, not a
  single-source mandate to conform to. It does **not** gate IA-4. For **IA-5** it
  reframes the `listShowsApi` duplication as *sanctioned (a prior decision to
  revisit)*, not *accidental (a bug)*. Record against IA-5 for the consolidation pass.

---

## Sec 3 — Chosen direction: true universe roll-up

Make `/universe/production` deliver what its chrome promises: a franchise-level view
across **all** shows, not `shows[0]`.

**Why this over the alternatives (recorded for the decision trail):**
- *Show picker* — cheapest, but keeps it a single-show view; the "Game Director
  Dashboard" framing stays a half-truth.
- *Honest relabel* — also cheap, but *retreats* from the franchise concept rather
  than delivering it; wastes the universe-level route.
- *True roll-up (chosen)* — most expensive, but the only one that makes the chrome
  honest, and it has a bonus: it **retroactively justifies IA-1 #1** (the
  `/universe/production` "Franchise OS" naming becomes accurate) and gives `/episodes`
  (IA-3) an honest destination.

---

## Sec 4 — What the roll-up entails (planning level)

The current shape is "load all shows → keep `[0]` → fan all calls at one `showId`."
A roll-up changes the second and third steps. Two architecturally distinct ways to
aggregate, and **this is the central decision the implementation hinges on:**

**Option 4A — Frontend fan-out (no backend change).** For each of N shows, issue the
existing per-`showId` calls (episodes/events/goals/character-state) in parallel
(`Promise.allSettled`, the pattern `ShowAssetsTab` already uses), then aggregate
client-side into franchise totals + per-show breakdown.
- *Pro:* **freeze-safe and fully frontend** — no backend work, no collision with the
  audit/fix-cycle.
- *Con:* N× the requests (10 shows × 4 calls = 40 requests per page load); aggregation
  logic lives in the client; counter-truncation limits (the recurring P1) compound
  across shows.

**Option 4B — Backend aggregate endpoint (new `/universe/:id/rollup` or similar).**
One call returns franchise-level aggregates.
- *Pro:* clean, fast, single source of the aggregate shape.
- *Con:* **net-new backend work** — and that is the flag (§5). The backend is
  mid-audit under a strictly-sequenced fix-cycle, currently frozen behind F-Deploy-1.
  A new endpoint is not freeze-safe-by-default and cannot be slipped in; it has to be
  reconciled with the audit posture and sequencing.

**Render changes (either option):** the hero ("Living World State", mood/economy/
canon/episodes), the character-state meters (currently Lala's *per-show* state), and
the episode browser all currently assume one show. A roll-up must decide, per
element: franchise aggregate, per-show breakdown, or both. The character meters are
the thorniest — "Reputation/Wealth/Stress" are per-show character state; a franchise
view either sums them (semantically odd) or shows them per-show (a list, not meters).

---

## Sec 5 — The cross-tier flag (PM-level, surface now not mid-build)

**The roll-up's cost depends entirely on the §4 choice, and 4B crosses into frozen
backend territory.** This is exactly the dependency a cleanup *plan* exists to catch:

- **If 4A (frontend fan-out):** the whole fix is freeze-safe frontend work. It can be
  planned and built without touching the audit's critical path. Recommended as the
  **first implementation**, precisely because it sidesteps the freeze.
- **If 4B (backend endpoint):** it becomes net-new backend scope that must queue
  behind / reconcile with the F-Deploy-1 fix-cycle. Do **not** treat a new aggregate
  endpoint as a casual add — it is backend work under audit discipline.

**Recommendation:** build the roll-up as **4A first** (freeze-safe, ships the honest
view now), and record 4B as a *later optimization* to fold into backend work once the
fix-cycle reaches a point where new endpoints are in scope. This delivers the chosen
direction without waiting on the freeze, and avoids quietly adding backend scope.

---

## Sec 6 — Implementation prerequisites (before any code)

1. **Clean re-read of `ProductionTab.jsx`.** This deep-dive's copy was terminal-
   garbled mid-file. Exact line-level edits (where `[0]` is taken, how the hero/
   meters/browser consume `show`) need a clean read first — do not edit from the
   garbled copy.
2. **Decide the per-element aggregation semantics** (§4 render changes): which hero
   stats and meters are franchise-aggregate vs. per-show. This is a product call, not
   a mechanical one.
3. **Confirm 4A vs 4B** (§4/§5). Recommendation: 4A first.
4. **Account for counter-truncation** (the recurring P1 limit=200/100 pattern) — it
   compounds across N shows in a fan-out; the aggregate counts will be wrong on large
   shows unless the limits are addressed.

---

## Sec 7 — What this document does NOT do

- Does **not** write, rename, or change any code, route, component, or label.
- Does **not** implement the roll-up — it recommends the direction and its cost.
- Does **not** resolve the other IA findings (IA-1/2/3/5/6) — IA-4 only this pass,
  though the roll-up direction interacts with IA-1 #1 and IA-3 (noted §3).
- Does **not** touch backend, DB, or the frozen prod box. (4B *would* require backend
  work — which is exactly why it's flagged, not started.)

---

*IA-4 deep-dive and recommended fix direction (true universe roll-up). §9.11 resolved
to note-and-proceed. Central decision = frontend fan-out (4A, freeze-safe, recommended
first) vs. backend aggregate endpoint (4B, crosses frozen backend scope). Path A:
plan only, no code. Clean `ProductionTab.jsx` re-read required before implementation.*
