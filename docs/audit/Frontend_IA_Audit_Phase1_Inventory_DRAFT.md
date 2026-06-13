# Frontend IA Audit — Phase 1: Inventory (DRAFT v0.1)

> **PATH A DISCOVERY DOCUMENT. INVENTORY ONLY — NO REORG PROPOSED.**
> This records what the frontend *is* (catalog, routing backbone, reachability
> reconciliation, observed smells) as of the HEAD below. It does NOT propose
> renames, moves, deletions, or consolidations. Workflow-mapping and
> mismatch-resolution are later phases. Nothing here authorizes a code change.

| | |
|---|---|
| **Authored** | 2026-06-12 |
| **Repo HEAD at inventory** | `a0350c83` (origin/main) |
| **Scope** | `frontend/src` — single router (`App.jsx`, 623 lines), single `pages/` tree |
| **Method** | Read-only: directory enumeration + `App.jsx` import/route extraction, cross-referenced. No box, no [3], no execution. |
| **Status** | DRAFT v0.6 — Path A IA audit. v0.2 Sec 1D; v0.3 Continue-Working stale; v0.4–v0.6 Phase 2 nav-reachability (v0.6: ~23 genuinely-orphaned feature pages identified, Sec 3.5). |

---

## Sec 0 — Headline numbers

- **Frontend components total (`*.jsx`/`*.tsx`):** 422 files under `frontend/` (incl. `node_modules` noise; the audited tree is `frontend/src`).
- **`frontend/src/pages`:** ~229 files, but this inflates the page count — it includes co-located `.css` and `.test.jsx` siblings. **Distinct page components ≈ 110.**
- **`frontend/src/components`:** 131 files, organized into feature folders (Episodes 23, SceneStudio+nested ~26, RelationshipEngine 12, Timeline 12, Show 11, phone/phone-editor 12, Assets, Culture, Search, layout, etc.).
- **Supporting dirs:** `hooks` 18, `services` 20, `contexts` 3, `data` 7, `utils` 8, `styles` 14, `constants` 2, `lib` 3.
- **Router:** ONE — `App.jsx`. ~95 `<Route>` declarations. All page imports are `lazy()` except `Login`, `LandingPage`, `Home` (eager).

**First correction to prior framing:** "229 pages" is wrong as a workload estimate; the real page-component count is ~110. The `.css`/`.test.jsx` co-location pattern is consistent across the tree.

---

## Sec 1 — Routing backbone (reachability reconciliation)

Every page's status is one of four buckets, determined by cross-referencing the
`App.jsx` import block (lines 11–145) against the `<Route>` declarations.

### 1A — Routed to a live page (reachable)
The majority. Examples across feature areas: `Home` (`/`), `UniversePage` (`/universe`),
`EpisodeDetail` (`/episodes/:episodeId`), `CreateEpisode`, `WorldAdmin` (`/shows/:id/world`),
`WorldStudio` (`/world-studio`), `SceneStudio` (`/scene-studio`), `SceneStudioPage`
(`/studio/scene/:sceneId`), `ShowBiblePage` (`/show-bible`), `CharacterRegistryPage`,
`StoriesPage`, and so on. These are the real navigable surface.

### 1B — Redirect-tombstones (routed, but resolve to `<Navigate>`, not a page)
A deliberate consolidation pattern. The route exists for backward-compat / old
bookmarks but renders no page. Catalogued because it maps where features were merged:

- **Wardrobe cluster (entire area disabled):** `/wardrobe`, `/wardrobe/analytics`, `/wardrobe/outfits`, `/wardrobe-library`, `/wardrobe-library/upload`, `/wardrobe-library/:id` → all `Navigate to "/"`. Only `/wardrobe/calendar` (`OutfitCalendar`) survives as a live page.
- **Storyteller/story-engine → stories:** `/storyteller`, `/story-engine` → `/stories`.
- **Intelligence cross-redirects:** `/franchise-brain`, `/intelligence/franchise-brain` → `/show-bible?tab=decisions`; `/show-brain`, `/intelligence/show-brain` → `/show-bible?tab=knowledge`; `/universe/knowledge` → `/show-bible`.
- **Other:** `/episodes` → `/universe/production`; `/character-generator` → `/world-studio`; `/universe/wardrobe` → `/`; `/social-import` → `/universe/social-import`; `/world` → `/character-registry?view=world`; `/storyteller` covered above.

### 1C — Imported but NEVER routed (dead imports — in bundle, no entry point)
Components `lazy()`-imported by `App.jsx` whose only paths are tombstones, so the
component itself is never rendered:

- **`ShowBrain`** (import line 142) — all show-brain paths `<Navigate>` to `/show-bible`. Imported, never rendered.
- **`CharacterGenerator`** (line 109) — `/character-generator` tombstones to `/world-studio`. Imported, never rendered.
- **`StoryEngine`** (line 102) — `/story-engine` tombstones to `/stories`. Imported, never rendered.

These three pay bundle/maintenance cost with no reachable route. (Finding only — not proposing deletion.)

### 1D — On disk but NOT imported by the router (orphan candidates)
Pages present in `frontend/src/pages` with no `App.jsx` import. **Status "candidate"
— requires a who-imports-me grep before any can be called truly dead, since some are
likely child components of routed pages (esp. the `feed/` subtree):**

- Likely **child components mislocated in `pages/`** (probably imported by a parent page, not the router): `feed/FeedViews`, `feed/ProfileCard`, `feed/ProfileDetailPanel`, `feed/FeedEnhancements`.
- **CLASSIFIED (who-imports-me pass, 2026-06-12):** the candidates resolve into three distinct states. The importer graph was run over `frontend/src` excluding each file's own definition + test.

  **Reachable child components (mislocated in `pages/`, but imported by a routed parent — NOT dead):**
  - `ScenesPanel` ← `BookEditor`, `WriteMode` (`/write/:bookId/:chapterId`)
  - `ProductionTab` ← `UniverseProductionPage` (`/universe/production`)
  - `SocialImport` ← `UniverseSocialImportPage` (`/universe/social-import`)
  - `FeedViews`, `ProfileCard`, `ProfileDetailPanel` ← `SocialProfileGenerator` (`/feed`) — confirms the `feed/` subtree is child components, not orphans
  - `FeedEnhancements` ← `SocialProfileGenerator` + `WorldAdmin` (both routed)

  **DEAD SUBTREE rooted at `StoryEngine` (high confidence):** `StoryEngine` is itself bucket-1C (imported by `App.jsx`, only reachable via the `/story-engine`→`/stories` tombstone, so never rendered). Every importer of the following traces back exclusively to `StoryEngine`, so none is ever rendered:
  - `StoryInspector` ← only `StoryEngine`
  - `StoryNavigator` ← only `StoryEngine`
  - `ArcGenerationStatus` ← `StoryEngine` + `StoryNavigator` (both inside the dead subtree)

    The cleanup unit here is a **connected 4-component cluster** (`StoryEngine → {StoryInspector, StoryNavigator → ArcGenerationStatus}`), not scattered orphans. **Confidence note:** classification rests on (a) the grep showing no importer outside the subtree, and (b) the assumption no barrel/re-export file re-exposes these. (b) is unverified — a `grep -r` for re-exports is the final certification before any removal. Recorded high-confidence, NOT certified.

  **DEFINITIVELY DEAD (zero importers anywhere):**
  - `ProductionOverlaysTab` — no importer in `frontend/src`. Not even a mislocated child. Pure orphan.

  **Reachable via alias (NOT an orphan):** `SocialSystems.jsx` is imported at `App.jsx:139` aliased as `SocialSystemsPage` and routed at `/social-systems`. Flagged for the name/file divergence only (see 2C).

**Orphaned stylesheets (no matching `.jsx`):** `Shows.css`, `StudioPickerPage.css` — component absent. Residue of a removed/renamed page.

---

## Sec 2 — Observed structural smells (recorded, not resolved)

### 2A — `pages/` vs `components/` boundary is not maintained
- **`QuickEpisodeCreator`** is imported from `./components/` (line 116) yet serves as a **routed page target** (`/episodes/:episodeId/edit`, `/shows/:showId/quick-episode`). A component acting as a page.
- **"Tab"/"Panel"-named files living in `pages/`:** `UIOverlaysTab` (routed at `/phone-hub`), `ProductionTab`, `ProductionOverlaysTab`, `SceneSetsTab`, `ScenesPanel`. Names imply embedded sub-views; location implies pages. `UIOverlaysTab` is confirmed promoted to a route despite the "Tab" name.

### 2B — Naming near-twins (clarity smell, NOT confirmed duplication)
- **`SceneStudio` vs `SceneStudioPage`** — both routed, to *different* paths (`/scene-studio` and `/studio/scene/:sceneId`). Two distinct screens with near-identical names. NOT dupes; do not "dedupe."
- **Seven World-prefixed pages:** `WorldAdmin`, `WorldStudio`, `WorldDashboard`, `WorldFoundation`, `WorldInfrastructure`, `WorldLocations`, `WorldSetupGuide` — all routed to distinct paths. Whether the feature genuinely needs seven World-* screens is a *workflow-phase* question, not an inventory claim.
- **Show cluster:** `ShowManagement`, `ShowDetail`, `ShowSettings`, `EditShow`, `CreateShow` + orphaned `Shows.css`.

### 2C — Import alias
- Line 139: `const SocialSystemsPage = lazy(() => import('./pages/SocialSystems'))`. The route name and file name diverge (`SocialSystemsPage` ← `SocialSystems.jsx`). Minor, but the kind of indirection that makes grep-based audits miss things — recorded so later phases account for it.

---

## Sec 3 — Tie-in to known P0 audit findings (confirmation the lens lands)

The IA lens independently lands on files already flagged in the forensic audit,
which is corroboration that this inventory is finding real structure, not inventing it:

- **"Continue Working" P0 — RESOLVED via live derivation (2026-06-12); original wording STALE.** The P0 as filed reads "dead at two of six stages, missing routes in App.jsx." This was traced end-to-end against current main (`a0350c83`) and **does not hold as written.**

  **Source of truth:** `frontend/src/utils/workflowRouter.js` — the "Smart Workflow Router" defining six statuses (`STATUS_CONFIG`) and a `route(id)` per status. The six, mapped to target paths, each cross-referenced against the live `App.jsx` route table:

  | # | Status | `route(id)` target | App.jsx resolution |
  |---|--------|--------------------|--------------------|
  | 1 | DRAFT | `/episodes/:id/edit` | LIVE → `QuickEpisodeCreator` (App.jsx:327) |
  | 2 | SCRIPTED | `/episodes/:id/plan` | LIVE → `ScenePlannerPage` (353) |
  | 3 | IN_BUILD | `/episodes/:id/timeline` | LIVE → `TimelineEditor` (365) |
  | 4 | IN_REVIEW | `/episodes/:id/review` | LIVE → `EpisodeReview` (401) |
  | 5 | SCHEDULED | `/episodes/:id/review` | LIVE → `EpisodeReview` (401) |
  | 6 | PUBLISHED | `/episodes/:id` | LIVE → `EpisodeDetail` (330) |

  **All six target paths resolve to live routes. None is missing from App.jsx.** The "missing routes" framing is stale — the routes now exist (consistent with the repo having advanced many PRs since the P0 was filed).

  **The DRAFT-stage suspicion is also refuted.** DRAFT routes to a component named `QuickEpisodeCreator`, which *looked* like a create-only mismatch — but reading it (`frontend/src/components/QuickEpisodeCreator.jsx`) shows it is fully edit-aware: reads `episodeId` from params (`:79`), sets `isEditMode` (`:81`), loads the existing episode via `GET /api/v1/episodes/:id` (`:196`), and branches load / validation / save-as-PUT / header / button-label on `isEditMode` throughout. Continuing a draft lands in a working edit form. **Not dead.**

  **What actually survives scrutiny (smaller findings, NOT the filed P0):**
  1. **SCHEDULED and IN_REVIEW collapse to the same target** (`/episodes/:id/review`). SCHEDULED has no dedicated "continue" destination — it reuses review. A target-collision / design ambiguity, not a dead stage; the user still lands somewhere functional.
  2. **Naming smell only:** DRAFT's "continue" action routes to a component whose name (`QuickEpisodeCreator`) hides its edit capability. Confusing to read, correct in behavior.

  **Disposition recommendation:** the Continue-Working P0 should be **downgraded/closed as stale**, not actioned as written. Actioning "add missing routes" would add routes that already exist; "fix the dead DRAFT stage" would touch a working component. The two real residues (SCHEDULED/IN_REVIEW collision; the Creator naming) are P2-class clarity items, not a P0. *(Original P0 body left intact at its filing location per additive-supersede convention; this is the correction authority.)*

- **`WorldAdmin.jsx`** — routed (`/shows/:id/world`); subject of the episode→event substring-match P0 (`WorldAdmin.jsx:1475`). (Untouched by this session — listed as a lens-confirmation only.)
- **`SceneSetsTab.jsx`** — present in `pages/` (boundary smell 2A); subject of the scene-set `world_location_id` FK-orphan P0. (Untouched by this session.)

---

## Sec 3.5 — Nav-surface reachability (Phase 2, started 2026-06-12)

**Question:** of the ~95 live routes, which have a global navigation entry point, and which are reachable only by deep-link / known URL? Derived by reading the three nav surfaces and diffing their targets against the live-route set.

### The three nav surfaces, characterized
- **`Sidebar` (`components/layout/Sidebar.jsx`, 401 lines)** — the only global *feature* nav. Data-driven: section groups each with an `items:` array, plus `children:` arrays for CFO/Admin expandables and special Shows handling. Leaf targets are the `route:` properties.
- **`Header` (`components/Header.jsx`, 56 lines)** — brand + logout only. Navigates to `/` exclusively. NOT a nav surface for features.
- **`CommandPalette` (`components/CommandPalette.jsx`, 183 lines)** — **dynamic entity search, not a feature jump-list.** Queries the backend (`results` from an API call, gated at `q.length >= 2`) and routes by `RESULT_ROUTES[r.result_type]`. Rescues entity-detail routes (a specific episode/show/character) but **cannot surface feature pages** (`/property-manager`, `/template-studio`, etc. are not search-result entities).

**Consequence:** for any feature page (non-entity-detail), **Sidebar is the sole global entry point.** A feature route absent from Sidebar has no global nav — reachable only contextually (a parent screen links it) or by typing the URL.

### Sidebar leaf set (complete global feature nav — ~24 entries)
`/start`, `/universe`, `/show-bible`, `/world-dashboard`, `/world-foundation`, `/social-systems`, `/culture-events`, `/shows` (+`/shows/create`), `/stories`, `/character-registry?view=world`, `/world-studio?tab=relationships`, `/studio/timeline`, `/library`, `/cfo`, `/analytics/decisions`, `/ai-costs`, `/site-organizer`, `/design-agent`, `/search`, `/admin`, `/audit-log`, `/diagnostics`, `/recycle-bin`, `/settings`.

(Note: lines 118–146 of Sidebar carry additional paths inside *active-section-detection* arrays — e.g. `/cultural-calendar`, `/influencer-systems`, `/world-infrastructure`, `/social-timeline`, `/social-personality`, `/character-life-simulation`, `/cultural-memory`, `/character-depth-engine`, `/world-locations`, `/amber`, `/scene-studio`, `/story-engine`, `/scene-proposer`, `/assembler`, `/continuity`, `/narrative-control`. These light up a parent section when active but are **highlight-detection only** — they are NOT confirmed as rendered clickable sidebar leaves. Whether each is a real child link or merely a highlight rule needs a render-path read; flagged, not asserted.)

### Live feature routes with NO Sidebar entry (BURIED — reachable only contextually or by URL)
Cross-referencing live routes against the Sidebar leaf set, excluding tombstones and `:id` entity-details (which CommandPalette can reach). These feature pages have no global nav entry:

- **Episode pipeline (deep-link-by-design, likely legitimate):** `/episodes/:id/plan`, `/episodes/:id/timeline`, `/episodes/:id/review`, `/episodes/:id/beats`, `/episodes/:id/icon-cues`, `/episodes/:id/composer`, `/episodes/:id/export`, `/episodes/:id/evaluate`, `/episodes/:id/todo`, `/episodes/:id/script-writer`, `/episodes/create`. Reached from inside an episode/show — buried is expected here.
- **Book/chapter writing (deep-link-by-design, likely legitimate):** `/books/:id/read`, `/chapter/:bookId/:chapterId`, `/write/:bookId/:chapterId`, `/chapter-structure/:bookId/:chapterId`.
- **Standalone feature pages with NO sidebar entry (the suspicious set — needs contextual-vs-orphaned classification):** `/scene-library`, `/property-manager`, `/world-setup`, `/template-studio`, `/template-studio/designer`, `/press`, `/feed`, `/feed-relationships`, `/pressure`, `/relationships` (note: sidebar has `/world-studio?tab=relationships`, a *different* target), `/continuity`, `/cultural-calendar`, `/influencer-systems`, `/world-infrastructure`, `/social-timeline`, `/social-personality`, `/character-life-simulation`, `/cultural-memory`, `/character-depth-engine`, `/world-locations`, `/scene-studio`, `/scene-proposer`, `/assembler`, `/narrative-control`, `/story-evaluation`, `/story-threads`, `/story-calendar`, `/story-health`, `/texture-review/:n`, `/amber`, `/setup`, `/world-setup`, `/universe/series`, `/universe/tensions`, `/universe/world-state`, `/universe/assets`, `/universe/story-dashboard`, `/universe/writing-rhythm`.

### Honest boundary (what this does NOT yet establish)
The buried list is mechanically derived and accurate. But **"buried" ≠ "orphaned."** Two sub-classes are mixed in the suspicious set above and NOT yet separated:
- **Contextual:** reached from a parent screen that does link it (e.g. `/universe/*` sub-pages reached from `/universe`'s own tabs; many `/world-*` pages possibly reached from `/world-dashboard` or `/world-studio` tabs).
- **Genuinely orphaned:** no sidebar entry AND no parent screen links it — reachable only by typing the URL.

Separating these requires reading each candidate parent screen for outbound links — a larger pass than one section. **Recorded as the immediate Phase 2 continuation.**

### RESOLVED (v0.5): highlight-vs-leaf, + dead render branches found
The full `buildNav()` data structure was read (`Sidebar.jsx` lines 13–94) and cross-referenced against the render logic (lines 223–390).

**Complete nav data = exactly three zones:** FRANCHISE (`/universe`, `/show-bible`, `/world-dashboard`, `/world-foundation`, `/stories`, `/character-registry?view=world`, `/world-studio?tab=relationships`), STUDIO (`/studio/timeline`, `/library`), MANAGE (`/cfo` →children `/analytics/decisions`, `/ai-costs`; `/site-organizer`, `/design-agent`, `/search`, `/admin` →children `/audit-log`, `/diagnostics`; `/recycle-bin`, `/settings`). **The ONLY `children:` arrays are CFO (2) and Admin (2)** — both already counted in the leaf set. Nothing moves out of "buried."

**The ~16 highlight-detection paths (Sidebar 118–146) are CONFIRMED highlight-only, NOT clickable leaves.** No `children:`/`groups:` array contains them; the only renderers producing child NavLinks (`groups`, flat `children`, `expandable`-Shows) either do not fire or do not include them. These pages (`/cultural-calendar`, `/influencer-systems`, `/world-infrastructure`, `/social-timeline`, `/social-personality`, `/character-life-simulation`, `/cultural-memory`, `/character-depth-engine`, `/world-locations`, `/amber`, `/scene-studio`, `/story-engine`, `/scene-proposer`, `/assembler`, `/continuity`, `/narrative-control`) **have no Sidebar entry**. They highlight a section header only when you are already on them, reached by some non-sidebar path. **Buried is confirmed for all of them.**

**NEW FINDING — dead render branches in Sidebar (migration residue):** the render logic (223–390) handles three structures the current `buildNav()` data never produces:
- **`item.groups`** — the entire grouped-children renderer (~40 lines, the "Universe grouped children" block). No nav item has a `groups` key. Dead.
- **`isStories = item.route === '/story-engine'`** + `toggleOnly` Short-Stories logic — no nav item routes to `/story-engine` (the FRANCHISE Stories item routes to `/stories`, and carries no `children`). Dead branch.
- **`isWorld = item.route === '/world-studio'`** children logic — the `/world-studio` item (Relationships) carries no `children` array. Dead branch.

These are render-side handlers for a richer nav that the data layer no longer supplies — the "dead instrumentation / defensive code indicating migration drift" pattern, here in the nav component. Recorded as a structural finding; not proposing removal (the `groups`/children structure may be intended future state, or abandoned — that's a workflow/intent question, not an inventory claim).

**Net effect on the buried list:** UNCHANGED — confirmed, not reduced. The apparent ambiguity ("maybe these are reachable via expansion") is explained: it came from dead render branches + highlight-only arrays creating the *appearance* of richer nav than the data provides. The contextual-vs-orphaned split (above) remains the open Phase 2 task — but it must be answered from *parent-screen* outbound links, since the Sidebar definitively does not link these pages.

### RESOLVED (v0.6): contextual-vs-orphaned split
A who-links-to-me grep was run over all `frontend/src/*.jsx` (excluding `App.jsx`), matching *navigation* patterns (`to="/x"`, `navigate("/x")`, `go("/x")`) — not bare string mentions — for each buried feature route. Results:

**Contextual (a screen links them — reachable in-app):**
- `/continuity` ← `Home.jsx` (landing page — strongest possible linker)
- `/story-evaluation` ← `StoryProposer`, `WorldDashboard`, `WorldStateTensions` (multiple live linkers)
- `/template-studio` ← `TemplateDesigner`, `TemplateStudio` (linked, though self-cluster)
- `/feed` ← `EpisodeOverviewTab`
- `/scene-library` ← `SceneDetail`
- `/scene-studio` ← `StoryEngine` — **DEAD LINKER CAVEAT:** `StoryEngine` is itself bucket-1C (tombstoned, never rendered). A linker that never renders does not make the target reachable. `/scene-studio` therefore stays **effectively orphaned** unless a live screen also links it (none found). Listed here only to record the dead-linker relationship.

**GENUINELY ORPHANED — no statically-detectable nav linker anywhere (URL-only, 22 routes):**
`/property-manager`, `/press`, `/feed-relationships`, `/pressure`, `/world-setup`, `/cultural-calendar`, `/influencer-systems`, `/world-infrastructure`, `/social-timeline`, `/social-personality`, `/character-life-simulation`, `/cultural-memory`, `/character-depth-engine`, `/world-locations`, `/scene-proposer`, `/assembler`, `/narrative-control`, `/story-threads`, `/story-calendar`, `/story-health`, `/amber`, `/setup` (+ `/scene-studio` per the dead-linker caveat = effectively 23).

These pages are live routes with **no Sidebar entry and no in-app link from any screen** — reachable only by typing the URL. This is the headline nav finding: ~23 feature pages exist and function but have no path to them through the UI.

**Two method caveats (do not over-read "orphan"):**
1. The grep matches static nav patterns (`to=`/`navigate()`/`go()`). It **cannot see dynamically-built paths** — a route in a template literal, a variable passed to `<NavLink to={x}>`, or a computed path. "Orphan" here = "no *statically-detectable* linker," high-signal but not absolute proof. Each orphan should get a quick dynamic-path check before any removal/relink decision.
2. The contextual classifications assume the linking screen is itself reachable. Verified only for the `/scene-studio`←`StoryEngine` dead case; the other linkers (`Home`, `WorldDashboard`, etc.) are normal reachable pages and almost certainly fine, but the chain "X links Y ⇒ Y reachable" is only as strong as "X reachable" — noted, not exhaustively re-verified.

**This is a finding, not a fix.** Whether each orphan should get a Sidebar entry, be linked from a parent, or be retired is a cleanup-phase decision requiring product intent — explicitly out of scope here.

---

## Sec 4 — What Phase 1 did NOT do (scope fence)

- Did NOT propose any rename, move, deletion, consolidation, or route change.
- Did NOT classify the Sec 1D grep-pending orphans as dead — that needs a who-imports-me pass.
- Did NOT identify the two dead Continue-Working stages — needs the stage-definition source (Phase 2).
- Did NOT inventory `components/` internals, `hooks`, or `services` beyond top-level counts — pages + routing were the Phase 1 backbone.
- Did NOT touch the box, [3], or any live state.

## Sec 5 — Next-phase entry points (for whoever picks this up)

1. ~~Resolve Sec 1D orphans~~ **DONE (v0.2):** importer-graph pass classified all candidates. Result: most are reachable children; one dead 4-component subtree rooted at `StoryEngine`; one pure orphan (`ProductionOverlaysTab`). Remaining sub-task before any removal: `grep -r` for barrel/re-export files to certify the `StoryEngine` subtree (see 1D confidence note).
2. ~~Continue-Working P0~~ **DONE (v0.3):** derived live from `workflowRouter.js` + route table + `QuickEpisodeCreator` read. Result: filed P0 is STALE — all six stages route live, DRAFT component is edit-aware. Recommend downgrade/close. Residues (SCHEDULED/IN_REVIEW collision; Creator naming) are P2 clarity items. See Sec 3.
3. **Workflow mapping (Phase 2) — Sec 3.5, COMPLETE for nav-reachability (v0.6).** Sidebar is sole global feature nav; Header brand-only; CommandPalette dynamic entity-search; ~16 highlight-only paths confirmed buried; dead Sidebar render branches found; contextual-vs-orphaned split done via who-links-to-me grep. **Result: ~23 feature pages are genuinely orphaned (no Sidebar entry, no in-app linker — URL-only).** Two method caveats recorded (dynamic-path blindness; linker-reachability assumption). Remaining before any action: per-orphan dynamic-path check.
4. **`components/` inventory:** the 131-file component tree (esp. SceneStudio's nested 26) is unaudited.

---
*Frontend IA Audit Phase 1+2 — DRAFT v0.5. HEAD `a0350c83`. ~110 page components, one router (`App.jsx`), ~95 routes. Four reachability buckets: live / redirect-tombstone / imported-not-routed (3 dead imports) / on-disk-not-imported (classified: reachable children vs a dead 4-component subtree rooted at StoryEngine vs one pure orphan ProductionOverlaysTab). Continue-Working P0 resolved STALE. Phase 2 nav-reachability: Sidebar (3 zones) is the sole global feature nav; Header brand-only; CommandPalette dynamic entity-search. ~16 highlight-only paths + a larger feature set are BURIED (no Sidebar entry). Dead Sidebar render branches found (groups/Stories/World children the data never supplies). Remaining: contextual-vs-orphaned split via parent-screen reads. No reorg proposed.*
