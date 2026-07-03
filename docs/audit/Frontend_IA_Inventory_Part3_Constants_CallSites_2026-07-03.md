# Frontend IA Inventory — Part 3: Constants, Canon Copies & Call Sites — 2026-07-03

Grounded at 4cb9f824 via git grep / git show / git diff on screen this session.
Inventory only; nothing changed. Path A. Closes all open items from Parts 1-2.

## 1. HEADLINE: canon duplication crosses the stack boundary

The JS-literal-canon pattern (backend audit, F-Franchise-1) is not backend-only.
Director Brain scope must include a frontend leg or centralization is illusory.

**F-3-1: canonicalRoles.js is triple-homed.** Backend src/constants/canonicalRoles.js
+ frontend copy + role names stored in FOUR DB locations (assets.asset_role,
template_studio.required_roles[]/optional_roles[], thumbnail_compositions.asset_map{}
— per the backend file's own header). Frontend header mandates "CRITICAL: Keep in
sync" — sync-by-comment, no mechanism. Blob diff run this session: 31 roles
SEMANTICALLY IN SYNC today, but the files are format-divergent (section reordering,
comma style, CommonJS vs ESM) — a ~400-line diff with zero drift, meaning real
drift would be invisible inside the noise. The sync instruction is unenforceable
as written.

**F-3-2: dreamCities.js is the sole surviving JS copy of city canon.** Backend
migration 20260725000000-unify-dream-cities unified city names into the DB; grep
confirms NO DREAM_CITIES constant remains in src/. The frontend file survives:
5 cities + UNIVERSITIES (4) + CORPORATIONS (5) + WORLD_LAYERS (5) as literals,
consumed by 8+ frontend files (DreamMap, PhoneMapView, WorldFoundation, WorldAdmin,
EvaluateEpisode, Sidebar, EventsTab, ScreenContentRenderer, +). No sync to the
unified DB data. Post-migration canon edits will not reach the frontend.
[Memory correction logged: the Director Brain precedent migration IS the DREAM
unification, not OVERLAY_TYPES.]

**F-3-3: worldStudio.js:3296 — DREAM_INFRA literal inside a route handler.**
Backend infrastructure seed (districts/venues/properties/landmarks) the
unification did not reach. Parallel-seed pattern, backend-side residue.

**F-3-4: two frontend files carry the justawoman character key.**
characterAppearanceRules.js:35 (justawoman-keyed appearance block) and
feedConstants.js:102 (key:'justawoman' feed-layer selector). The F-Sec-3 key
sweep has a frontend leg; consolidation that only touches backend writers leaves
these keys live in UI logic.

## 2. F-Sec-3 open item #3 CLOSED — frontend evaluation call sites

**F-3-5: WorldAdmin.jsx:1232 passes 'lala' in the URL path** —
POST /api/v1/characters/lala/state/update (source:'manual', Edit Stats surface).
This is the frontend half of the war-chest split, now grep-confirmed end to end:
manual edits -> 'lala' row (this call); episode-completion deltas -> 'justawoman'
row (episodeCompletionService.js:405-418, backend inventory). EvaluateEpisode.jsx
passes NO key — it reads/writes evaluation_json on episodes; the server-side
default ('lala', evaluation.js:262) governs. No frontend caller passes
'justawoman' to the state endpoint.

## 3. Ghost-import call sites (OI-1b/OI-7 CLOSED) — with two tripwires

No live JSX renders any of the five ghosts. Hits outside App.jsx are comments,
extraction-lineage notes, and CSS references. Classification per ghost:
- StorytellerPage: ABSORBED — WriteMode.jsx:17 "Merged from StorytellerPage";
  8+ components note "Extracted from StorytellerPage." The page was decomposed;
  the shell remained imported.
- StoryEngine: superseded, BUT two live dependencies on its family:
  **TRIPWIRE 1:** StoryHealthDashboard.jsx:10 imports './StoryEngine.css' — a
  live page depends on the ghost's stylesheet. Family-delete breaks it.
  **TRIPWIRE 2 / F-3-6:** hooks/useStoryEngine.js (+substantial test file) is
  consumed ONLY by StoryEngine.jsx:5 and its own test — second-order dead code:
  live-looking infrastructure whose sole consumer is unreachable.
- FranchiseBrainPage / ShowBrain: no references outside App.jsx + own files.
  F-Franchise-1 fossils, fully unreferenced.
- CharacterGenerator: no component references, but constants/characterConstants.js
  header claims "Both CharacterGenerator.jsx and CharacterRegistryPage.jsx import"
  it, and hooks/useRegistries.js names both — shared-infra comments still treat
  the ghost as live. Cleanup must update these or they mislead.
Cleanup class: per-file, never per-family. CSS and shared hooks/constants need
individual disposition.

## 4. SocialImport reclassified (OI-6 CLOSED) — Part 2 F-2-4 falsified

**F-3-7: SocialImport.jsx is LIVE and load-bearing.**
UniverseSocialImportPage.jsx:6 imports it; :9 renders <SocialImport
embedded={false} />. The routed page is a thin wrapper; SocialImport.jsx is the
implementation. NOT a legacy duplicate; DO NOT delete. NovelAssembler.jsx also
consumes social-import data (state naming only, distinct surface).

## 5. Open-item ledger — all Parts 1-2 items closed

| ID | Status |
|---|---|
| OI-1/1b/7 (ghost call sites) | CLOSED — unreferenced as components; 2 tripwires; per-file cleanup class |
| OI-2 (RelationshipEngine exists) | CLOSED in Part 2; 7-artifact plan stands |
| OI-3 (evaluation.js frontend keys) | CLOSED — 'lala' via URL path, WorldAdmin:1232; no frontend 'justawoman' caller |
| OI-4 (constants canon scan) | CLOSED — F-3-1..F-3-4 |
| OI-6 (SocialImport) | CLOSED — live, reclassified |
| OI-8/mount-points (F-11 squatters) | PARTIAL — SocialImport + ScenesPanel (StorytellerPage-lineage) located; full mount map deferred, LOW priority |

## 6. Carried forward (planning inputs, not tasks)

1. Director Brain (F-Franchise-1) scope note: frontend leg required —
   canonicalRoles sync mechanism, dreamCities DB-read migration, DREAM_INFRA.
2. F-Sec-3 planning input: frontend key surfaces (F-3-4) join the sweep.
3. Ghost cleanup plan (5 components + useStoryEngine + stale shared-infra
   comments + CSS tripwire): plannable any session, execution gated on decision.
4. F-11 full mount-point map: only if a concrete need appears.

Entry state: origin/main 4cb9f824, no open PRs. Cold sessions re-derive live.