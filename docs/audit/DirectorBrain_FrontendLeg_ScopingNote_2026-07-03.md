# Director Brain — Frontend-Leg Scoping Note — 2026-07-03

**Type:** Planning input. NOT a design, NOT a build proposal, NOT an execution authorization.
**Status of Director Brain:** F-Franchise-1 resolution. LAST in the fix sequence. Gated behind F-Deploy-1 full close (FD-31 / [3] not yet executed) and the structural keystones ahead of it (F-AUTH-1, F-App-1, F-Stats-1 Phase B, F-Ward-1, F-Reg-2, F-Ward-3). This note authorizes nothing.
**Source (on main, 4b4831dd):** Frontend IA Inventory Part 3 §1 (F-3-1..F-3-3), §2 (F-3-4/F-3-5). Verified via git show this session; not from summary.
**Reconcile live before any use:** re-read Part 3 §1 at F-Franchise-1 session start; frontend surfaces may have moved.

---

## Why this note exists

The F-Franchise-1 audit finding — franchise-tier canon held as private JS literals, routed around the DB — was scoped backend-only. Part 3 §1 establishes the pattern **crosses the stack boundary**: the frontend holds its own JS-literal canon copies. Consequence, stated by the IA doc: a Director Brain that centralizes only backend constants produces *illusory* centralization — the frontend keeps its divergent copies and canon still forks. The frontend leg is therefore an input to Director Brain's scope, not a separate cleanup.

---

## Frontend-leg inputs (planning material — each is a finding on main, not a task here)

**1. canonicalRoles — triple-homed, sync-by-comment, unenforceable (F-3-1).**
- Backend `src/constants/canonicalRoles.js` + a frontend copy + role names in FOUR DB locations (`assets.asset_role`; `template_studio.required_roles[]/optional_roles[]`; `thumbnail_compositions.asset_map{}`).
- Frontend header mandates "CRITICAL: keep in sync" — **no mechanism enforces it.**
- This session's blob diff: 31 roles semantically in sync *today*, but files are format-divergent (reorder, comma style, CommonJS vs ESM) → a ~400-line zero-drift diff, meaning **real drift would be invisible in the noise.**
- Scope implication for Director Brain: a sync *mechanism* (single source → generated consumers), not another hand-maintained copy. **Mechanism options are UNSPECIFIED here — that is F-Franchise-1 design work, not this note's call.**

**2. dreamCities.js — sole surviving JS city-canon copy (F-3-2).**
- Backend migration `20260725000000-unify-dream-cities.js` unified city names into the DB; grep confirms no `DREAM_CITIES` constant remains in `src/`.
- Frontend `dreamCities.js` survives: 5 cities + UNIVERSITIES(4) + CORPORATIONS(5) + WORLD_LAYERS(5) as literals, consumed by 8+ frontend files (DreamMap, PhoneMapView, WorldFoundation, WorldAdmin, EvaluateEpisode, Sidebar, EventsTab, ScreenContentRenderer, +).
- **Post-migration DB canon edits do not reach the frontend.** This is the F-Franchise-1 write-only pattern, frontend side.
- Scope implication: a DB-read migration for the frontend (consume unified city canon instead of the literal). Shape UNSPECIFIED here.
- **PRECEDENT NOTE (settled 2026-07-03):** `20260725000000-unify-dream-cities.js` is the DREAM unification — confirmed by file tree (`git ls-tree origin/main`). The OVERLAY_TYPES migration is a separate earlier file (`20260721000000-create-ui-overlay-types.js`). Prior session memory conflated the two by timestamp; Part 3 §1's correction is verified correct. No open conflict remains.

**3. worldStudio.js:3296 — DREAM_INFRA route-handler literal (F-3-3).**
- Backend infrastructure seed (districts/venues/properties/landmarks) the unification did NOT reach — parallel-seed residue, backend-side.
- Distinct from #2: cities were unified, infrastructure was not. Director Brain's DREAM leg has two sub-surfaces at different migration states.

---

## Adjacent but NOT this note's scope (cross-referenced, owned elsewhere)

**F-3-4 / F-3-5 — frontend justawoman/lala key surfaces** (`characterAppearanceRules.js:35`, `feedConstants.js:102`, `WorldAdmin.jsx:1232`). These belong to the **F-Sec-3 frontend leg**, not Director Brain. Named here only so the two legs are not conflated. The war-chest split is grep-confirmed end to end (manual→`'lala'`, episode-completion deltas→`'justawoman'`) — but that is F-Sec-3's to close.

---

## What this note explicitly does NOT do

- Does not design the sync mechanism (input #1) or the DB-read migration (input #2).
- Does not sequence Director Brain earlier — it stays last, gated.
- Does not fold in F-Sec-3's frontend key surfaces as Director Brain scope.
- Authorizes no code and no migration.
