# Frontend IA Audit — Inventory & Findings (DRAFT v1)

> **INVENTORY + FINDINGS ONLY. NO CLEANUP PLAN.**
> Per Path A discipline (inventory → findings → *then* remediation), this doc stops
> at findings. The cleanup/redesign plan is a separate later phase, not authored
> here. This audit is pure read-only frontend analysis — it touches no backend, no
> database, and no prod box; it is unrelated to and unaffected by the F-Deploy-1
> freeze.

| | |
|---|---|
| **Audit** | Frontend IA (information architecture), flagged 2026-05-22, post-soak |
| **Scope** | Episode-work surfaces. Original flag named four entry points; widened (scope decision 2026-05-31) to the full episode-work IA including sub-routes, redirects, and duplications. |
| **Method** | Read-only `Select-String`/`Get-ChildItem` greps against `frontend/src`, collaborative (analyst guides, operator runs). No source mounted to the analyst. |
| **Status** | DRAFT v1 — findings IA-1 through IA-6 recorded. Stops at findings. |
| **Date** | 2026-05-31 |
| **Freeze relevance** | None. Frontend-only analysis. |

---

## Sec 1 — Scope and method

The 2026-05-22 flag named four overlapping episode-work surfaces and an overloaded
"Producer Mode" name. On inspection the surface area is larger, so scope was widened
(decision 2026-05-31) to the full episode-work IA. The four named entry points
remain the spine:

- `/universe/production`
- `/shows/:id` (with `?tab=episodes`)
- `/shows/:id/world`
- `/episodes/:episodeId`

Method: route map from `App.jsx`, then descend into each component for what it
renders and what data it touches. Three overlap hypotheses were tested explicitly
(Sec 4). All evidence is file:line; nothing is asserted from assumption.

---

## Sec 2 — Inventory (surface → route → component → data → access pattern)

| Surface (entry point) | Route (`App.jsx`) | Component | File | Data / endpoints | Access pattern |
|---|---|---|---|---|---|
| Universe production | `/universe/production` (310); `/episodes` redirects here (325) | `UniverseProductionPage` → `ProductionTab` | `pages/UniverseProductionPage.jsx`, `pages/ProductionTab.jsx` | `episodes?show_id`, `world/:showId/events`, `world/:showId/goals`, `characters/lala/state?show_id` | raw `api.get` (ProductionTab); file-local `listShowsApi` (wrapper) |
| Show detail | `/shows/:id` (338); tabs via `?tab=` | `ShowDetail` (6 tabs) | `pages/ShowDetail.jsx` | via `showService` + `episodeService` wrappers | service layer |
| Producer Mode / world | `/shows/:id/world` (340) | `WorldAdmin` | `pages/WorldAdmin.jsx` | `world/:showId/*` (events, etc.) | (not fully mapped this pass) |
| Episode detail | `/episodes/:episodeId` (330) | `EpisodeDetail` | `pages/EpisodeDetail.jsx` | (not fully mapped this pass) |

**Supporting components encountered:**
`ProductionTab` (`pages/`), `StudioTab` / `ShowAssetsTab` / `ShowWardrobeTab` /
`ShowDistributionTab` / `ShowInsightsTab` (`components/Show/`), `EpisodeCard`
(`components/`), `EpisodeKanbanBoard` (`components/Episodes/`), `QuickEpisodeCreator`
(`components/`).

**Episode sub-route sprawl** (off `/episodes/:episodeId`, all in `App.jsx`):
`/edit` (327, QuickEpisodeCreator), `/evaluate` (328), `/todo` (329), `/plan` (353,
ScenePlanner), `/script-writer` (354), `/beats` (362), `/timeline` (365),
`/icon-cues` (366), `/composer` (380, TemplateStudio), `/export` (398), `/review`
(401). Eleven sub-surfaces plus `EpisodeDetail` itself. Most are distinct tools, not
overlapping entry points — recorded as sprawl-to-note, not overlap-to-resolve.

---

## Sec 3 — Findings

### IA-1 — "Production"/"Producer" naming attaches to three distinct surfaces (severity: MED-HIGH)

The naming stem `Produc*` names at least three different surfaces that are not the
same thing and are not signposted as different:

1. **`/universe/production`** → `ProductionTab`, self-described "Franchise OS / Game
   Director Dashboard" (`ProductionTab.jsx:5`).
2. **`/shows/:id/world`** → `WorldAdmin`, labeled **"Producer Mode"** everywhere
   (`WorldAdmin.jsx:2` header comment, `:1317` `<h1>🎭 Producer Mode</h1>`; plus ~10
   inbound links calling it "Producer Mode" — `Sidebar.jsx:34`, `UniversePage.jsx:110,212`,
   `StudioTab.jsx:56,173`, `ShowDetail.jsx:223,343`, `EpisodeOverviewTab.jsx:947`,
   `StoriesPage.jsx:259`, `WorldSetupGuide.jsx:97`).
3. **`/shows/:id?tab=production`** → ShowDetail's tab **labeled "Production"**
   (`ShowDetail.jsx:257,260`) — see IA-6 (it is internally keyed `assets`).

Reinforced by data overlap (see IA-1a): #1 and #2 read the same backend world state
through different framings. A user told "go to Producer Mode" lands on WorldAdmin; a
user looking for "production" could reasonably land on any of the three.

**IA-1a — the collision is over shared data, not just labels.** `ProductionTab`
fetches `/api/v1/world/:showId/events` and `/goals` (`ProductionTab.jsx:137-138`) —
the same world/event/goal state `WorldAdmin` ("Producer Mode") is built around. Two
surfaces, two names, one dataset, two lenses.

### IA-2 — "Universe Admin" is a ghost destination (severity: LOW-MED)

`ShowSettings.jsx` claims a migration to a place that does not exist as a surface:
`:6` "After Producer Mode moved to Universe Admin, Settings has one job"; `:13`
"Universe Admin → Shows → ShowWorldView"; `:216` a link label "Universe Admin →".
But a full grep finds "Universe Admin" only in prose — `AmberPromptLibrary.jsx:78`
(voice command string), `LandingPage.jsx:118,341,444` (marketing copy),
`ShowSettings.jsx`. **There is no `/universe/admin` route and no `UniverseAdmin`
component.** "Universe Admin" is a conceptual name for the `/universe/*` page cluster,
not a real destination. The ShowSettings "moved to" comment is stale/aspirational:
live "Producer Mode" links all point to `/shows/:id/world` (WorldAdmin), at the
*show* level, not under `/universe/*`.

### IA-3 — `UniverseProductionPage` is a thin wrapper; `/episodes` is a silent alias (severity: LOW-MED)

`UniverseProductionPage` is a 64-line "standalone page wrapper for ProductionTab"
(`UniverseProductionPage.jsx:2-4,64`) — it loads the show list and renders
`<ProductionTab>`, no production logic of its own. Separately, `/episodes` is a
`<Navigate to="/universe/production" replace />` redirect (`App.jsx:325`). So "the
episode list" resolves to a thin wrapper around `ProductionTab`, reached via a silent
redirect from `/episodes`. Compounds IA-4 (what that wrapper actually shows).

**Disposition (2026-05-31):** Alias stands; substance routed to IA-4. The `/episodes`
redirect (`<Navigate to="/universe/production" replace />`, `App.jsx:325`) is consistent with the file's established
redirect-alias convention — a sound pattern, not a defect. The real issue is the
redirect's *destination* (the single-show scoping of `ProductionTab`), tracked as
IA-4 (HIGH). No source change proposed here.

### IA-4 — Universe-level page silently scoped to one arbitrary show (severity: HIGH)

`ProductionTab` is mounted at a universe-level route (`/universe/production`, also the
`/episodes` redirect target) and wears franchise-level chrome ("Game Director
Dashboard"), but it renders **one show's** data. The wrapper loads *all* shows
(`UniverseProductionPage.jsx:35,47-49`) and passes them down, then ProductionTab does:

```
ProductionTab.jsx:125   const show = linkedShows[0] || null; // primary show
ProductionTab.jsx:126   const showId = show?.id;
```

Every data call is then keyed to that single `showId` — episodes
(`:136,171`), world events (`:137`), goals (`:138`), Lala's character state (`:160`).
**It silently picks the first show in the array.** No dropdown, no picker, no URL
param, no indication to the user. With 10 shows in the DB, nine are invisible from
this page, and the "Game Director Dashboard" framing implies the user is seeing the
whole franchise. This is an accidental single-show view masquerading as a universe
view — a functional defect, not just naming. (Combined with IA-3: `/episodes` lands
users here too.)

### IA-5 — Three data-access patterns for the same show/episode data (severity: MED)

The same show/episode data is reached three different ways across the three surfaces:

- **Service layer** — `ShowDetail` uses `showService` + `episodeService`
  (`ShowDetail.jsx:4-5`).
- **Raw client** — `ProductionTab` calls `api.get('/api/v1/episodes...')` directly
  (`ProductionTab.jsx:136,171`).
- **File-local copy** — `UniverseProductionPage` defines its own `listShowsApi`, with
  a self-documenting comment: `:15` "File-local cross-CP duplicate per v2.12 §9.11 —
  listShowsApi reaches..." `:18-19` the duplicate definition.

The `listShowsApi` comment is an *acknowledged* duplicate citing a spec section
(`v2.12 §9.11`). This is the frontend mirror of the backend audit's recurring
pattern — private/local copies of shared logic, and writers bypassing a common
layer (cf. F-Stats-1's raw-SQL writers around the CharacterState model, and the
franchise tier's six services with private canon copies). Same disease, frontend
tier.

**Disposition (2026-05-31):** Flagged, routed to consolidation. The file-local
`listShowsApi` (`UniverseProductionPage.jsx:18-19`, raw `apiClient.get('/api/v1/shows')`
→ `r.data`) is one of 5 cross-CP copies (6 incl. `WorldSetupGuide`), sanctioned by
**CP15 Decision 2 / v2.12 §9.11**. Unlike IA-3's redirect aliases, this convention is
*not* sound — it is the frontend instance of the private-copy-of-shared-logic
anti-pattern (cf. F-Stats-1 raw-SQL writers around CharacterState; franchise tier's
six services with private canon copies). Concrete cost: each copy returns
un-normalized `r.data`, forcing per-site response-shape guessing
(`UniverseProductionPage.jsx:47-48` `shData.data || shData.shows || shData`). Canonical
replacement exists and is normalized: `showService.getAllShows()` (`showService.js:22-30`,
returns `response.data?.data || []`, covered by `showService.test.js`). **Resolving
IA-5 requires reopening CP15 Decision 2.** Doc-only this session; execution routed to
the **Consolidation Backlog** (`listShowsApi` item).

### IA-6 — ShowDetail tab labels do not match their keys or components (severity: MED-HIGH)

ShowDetail's six visual tabs, their internal keys, and their rendered components do
not align:

| Position | Visual label | Internal key | Keyboard | Component rendered |
|---|---|---|---|---|
| 1 | Dashboard (`:241`) | `studio` (default, `:35`) | Ctrl+1→studio (`:60`) | `StudioTab` (`:294`) |
| 2 | Episodes (`:250`) | `episodes` | Ctrl+2 (`:61`) | `EpisodeKanbanBoard` (`:348`) + `EpisodeCard` (`:400`) |
| 3 | **Production** (`:257,260`) | **`assets`** (`:255`) | Ctrl+3→**assets** (`:62`) | **`ShowAssetsTab`** (`:414`) |
| 4 | Wardrobe | `wardrobe` | Ctrl+4 (`:63`) | `ShowWardrobeTab` |
| 5 | Distribution | `distribution` | Ctrl+5 (`:64`) | `ShowDistributionTab` (`:422`) |
| 6 | Insights | `insights` | Ctrl+6 (`:65`) | `ShowInsightsTab` (`:426`) |

Two mismatches:
- **Position 1:** labeled "Dashboard," keyed `studio`, renders `StudioTab` — three
  different names for one tab. It is also the default landing tab (`:35`
  `searchParams.get('tab') || 'studio'`), so `/shows/:id` with no query opens a tab
  whose label, key, and component all disagree.
- **Position 3 (the sharp one):** labeled **"Production,"** keyed `assets`, renders
  **`ShowAssetsTab`**. A user clicking the "Production" tab is taken to the assets
  component.

**One item to confirm before assigning final direction:** whether `ShowAssetsTab`
actually contains production tooling (→ the `assets` key is stale) or genuine
assets management (→ the "Production" label is wrong). The *mismatch* is confirmed
either way; reading `ShowAssetsTab.jsx` resolves which name is the lie. Recorded as
an open sub-item, not a blocker.

Note: the Episodes tab (position 2) renders **two** episode-list UIs —
`EpisodeKanbanBoard` and `EpisodeCard` (`:348,400`, likely a view toggle). Combined
with `ProductionTab`'s own "segmented episode browser with story cards"
(`ProductionTab.jsx:10`), a show's episode list has at least **three distinct
presentations** across the app.

---

## Sec 4 — Hypotheses tested (forensic record)

Three overlap hypotheses were tested rather than assumed:

1. **"The four surfaces share a component."** FALSIFIED. `ProductionTab` is imported
   only by `UniverseProductionPage` (grep across `frontend/src`); ShowDetail's
   episodes tab uses its own `EpisodeKanbanBoard`/`EpisodeCard`. The surfaces are
   distinct components.
2. **"The surfaces share backend data."** CONFIRMED. `ProductionTab` and `WorldAdmin`
   both read `/api/v1/world/:showId/*`; multiple surfaces read
   `episodes?show_id=`. The overlap is at the data layer, not the component layer.
3. **"Episode-listing is duplicated."** CONFIRMED. At least three distinct episode-list
   UIs (ShowDetail Kanban, ShowDetail Card, ProductionTab story-card browser) over the
   same `episodes?show_id=` data.

Net: the "overlapping surfaces" problem is real but is **data-and-naming overlap, not
component reuse** — distinct components, convergent data, collided names.

---

## Sec 5 — Cross-references to the backend audit

The IA findings rhyme with known backend patterns, suggesting the duplication
discipline gap spans tiers:

- IA-5 (file-local `listShowsApi`, raw vs service access) ↔ backend "private copies
  of shared logic" (franchise tier's six services with private canon copies) and
  "writers bypassing the model" (F-Stats-1).
- IA-1a (multiple surfaces reading the same world/event state through different
  lenses) ↔ backend "multiple parallel systems over one dataset" findings.
- The `v2.12 §9.11` spec reference in IA-5 implies a frontend spec governs these
  duplicates — worth locating, as it may already define the intended single source.

These are observations for the eventual cleanup phase, not findings in themselves.

---

## Sec 6 — What this document does NOT do

- Does **not** propose a cleanup, redesign, or full consolidation *plan* — that
  remains the next phase. (A **Consolidation Backlog** of items surfaced by these
  findings is now recorded below; it is a parking lot, not a plan.)
- Does **not** rename, move, or change any component, route, or label.
- Does **not** fully map `WorldAdmin` or `EpisodeDetail` internals — this pass
  established the entry-point inventory and the overlap structure; deep maps of those
  two are available if the cleanup phase needs them.
- Does **not** resolve the IA-6 sub-item (what `ShowAssetsTab` truly is) — flagged,
  one read away.
- Does **not** touch any backend, database, or the frozen prod box.

---

## Sec 7 — Suggested next phase (not started)

Per Path A, remediation is its own pass. When taken up, the natural order:
1. Resolve the IA-6 sub-item (read `ShowAssetsTab`) and any remaining label/key audit.
2. Locate the `v2.12 §9.11` spec to see what single-source intent already exists.
3. Decide canonical naming: what "Production" vs "Producer Mode" each mean, and pick
   one home for each concept.
4. Decide the fate of `/universe/production`'s single-show scoping (IA-4) — picker,
   true universe view, or honest relabel — the highest-severity functional item.
5. Then, and only then, a consolidation plan.

---

## Consolidation Backlog

### CONSOLIDATION ITEM — collapse file-local `listShowsApi` copies onto `showService.getAllShows()`

Scope: 5-6 sites (confirm exact set + `WorldSetupGuide` via repo-wide grep as step 1).
Per site: replace `listShowsApi()` call with `showService.getAllShows()`, delete the
file-local def + its `v2.12 §9.11` comment, drop the now-redundant response-shape
guard, add the `showService` import. **Precondition:** reopen/supersede CP15 Decision 2.
Risk: contract mismatch — `listShowsApi` returns raw `r.data`,
`getAllShows()` returns a normalized array + re-throws on non-2xx; each site verified
against the normalized contract before swap (watch for `.shows` access or missing
try/catch). Rule 7-gated multi-file change; not a freeze-window op. Frontend-only —
does not touch the prod box.

---

*Frontend IA audit findings, draft v1.1. Inventory + six findings (IA-1…IA-6),
file:line-backed, three overlap hypotheses tested. Stops at findings per Path A.
v1.1 (2026-05-31, committed 2026-06-17): added IA-3/IA-5 dispositions +
Consolidation Backlog; reconciled Sec 6 framing. Freeze-irrelevant (frontend
analysis). Cleanup plan deferred to its own phase.*
