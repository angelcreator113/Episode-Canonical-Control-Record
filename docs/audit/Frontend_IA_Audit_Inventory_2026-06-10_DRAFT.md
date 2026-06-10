# Frontend IA Audit — Route Inventory + Severity-Ranked Findings (DRAFT v0.1)

> **INVENTORY ARTIFACT. PATH A DISCIPLINE: CATALOGUE FIRST, NO REDESIGN.**
> This is the inventory step of the Frontend IA audit (inventory → workflow → mismatches
> → cleanup plan). It catalogues the route surface from code and ranks what the catalogue
> surfaces by severity. It proposes NO redesign, renames nothing, and deletes nothing — it
> records findings and where they sit. Cleanup planning is a separate later step.

| | |
|---|---|
| **Scope** | The authenticated + public route surface as declared in `frontend/src/App.jsx`, cross-referenced against the intended episode workflow in `frontend/src/utils/workflowRouter.js`. |
| **Inputs (have)** | `App.jsx` (canonical React Router map); `workflowRouter.js` (status→route intent). |
| **Inputs (missing — reachability gap)** | `Sidebar.jsx`, `UniversePage.jsx`, `ShowDetail.jsx`, `EpisodeOverviewTab.jsx` — the nav surfaces. Without them, a route can be confirmed to EXIST and to be a redirect/orphan, but NOT confirmed LINKED-from-nav vs URL-only-reachable. Every reachability claim below is marked with this boundary. |
| **Method** | Static read of the two files. Route→component mapping, redirect classification, import-vs-route diff, workflow-target existence check. No runtime, no box, no nav-trace. |
| **Status** | DRAFT v0.1 — inventory + ranked findings. Not canon. No cleanup actions. Counts derived by hand from `App.jsx`; verify against the live file. |

---

## Sec 0 — Headline + the severity spine

The route surface is large (110+ `<Route>` declarations) and bears the accretion pattern the audit already named elsewhere: surfaces added over time, consolidated repeatedly, with the old entry points left as redirects or dead imports rather than removed. The single most severe item is not IA debt at all — it is a **functional break in the core production workflow**, found by cross-referencing the two files rather than reading either alone.

Spine, ranked by severity (the framing you chose):

1. **P0 — Broken "Continue Working" transitions** (Sec 2.1). Two of six workflow stages route to non-existent routes → silent fallback to home.
2. **P1 — Double-redirect chains** (Sec 2.2). Redirects that target other redirects.
3. **P1 — Orphaned imports** (Sec 2.3). Five components lazy-imported (code-split chunks built) but never routed.
4. **P1 — Wardrobe redirect graveyard + stale AI-assistant references** (Sec 2.4). Six dead wardrobe routes; the assistant context map still names two as live pages.
5. **P2 — "Studio" / "composer" label overload** (Sec 2.5). The structural face of the audit's flagged "Producer Mode" overload.
6. **P2 — "World-*" surface sprawl** (Sec 2.6). Seven "world-" surfaces among ~24 overlapping world/social/character routes.

---

## Sec 1 — Route inventory (the catalogue)

**Shape (by hand from `App.jsx` — verify against live):**

- **Public (unauthenticated):** `/` (LandingPage), `/login` (Login), `*` → `/`.
- **Authenticated component-rendering routes:** ~90, spanning Dashboard, Universe, Pre-Production, Animatic, Production, Post-Production, Management/World/Social/Story, Analytics, Admin, Diagnostics, Settings.
- **Redirect-only routes** (render `<Navigate>`, no component): ~19 — enumerated in Sec 2.2/2.4.
- **Logic-redirect component:** `/book/:id` → `BookToWriteRedirect` (fetches chapters, forwards to first chapter or `/storyteller`).
- **Dual-routed components** (one component, two paths): `TemplateStudio` (`/template-studio` + `/episodes/:episodeId/composer`); `QuickEpisodeCreator` (`/episodes/:episodeId/edit` + `/shows/:showId/quick-episode`); `SceneStudioPage` (`/studio/scene/:sceneId` + `/studio/scene-set/:sceneSetId`); `TemplateDesigner` (`/template-studio/designer` + `/.../:templateId`).
- **Route-name vs component-name drift** (cosmetic, noted not flagged): `/phone-hub` → `UIOverlaysTab`; `/scene-proposer` → `StoryProposer`; `/feed` → `SocialProfileGenerator`.

The full per-route table is mechanical; the findings below are where the catalogue earns attention.

---

## Sec 2 — Findings, ranked

### Sec 2.1 — P0: "Continue Working" breaks at two of six stages

`workflowRouter.js` is the intelligence behind the "Continue Working" button: it maps episode `status` → the route to resume at. Cross-checked against `App.jsx`, two of the six targets do not exist as routes:

| Status | `workflowRouter` target | Exists in `App.jsx`? | Actual behaviour |
|---|---|---|---|
| DRAFT | `/episodes/:id/edit` | YES (`QuickEpisodeCreator`) | OK |
| **SCRIPTED** | **`/episodes/:id/scene-composer`** | **NO** | falls through `*` → `/` (home) |
| IN_BUILD | `/episodes/:id/timeline` | YES (`TimelineEditor`) | OK |
| **IN_REVIEW** | **`/episodes/:id/animatic-preview`** | **NO** | falls through `*` → `/` (home) |
| SCHEDULED | `/episodes/:id/review` | YES (`EpisodeReview`) | OK |
| PUBLISHED | `/episodes/:id` | YES (`EpisodeDetail`) | OK |

React Router v6 matches `/episodes/:episodeId` exactly, so `/episodes/<id>/scene-composer` and `/episodes/<id>/animatic-preview` match nothing and hit the `*` fallback (`Navigate to="/"`). A user clicking "Continue Working" on a **Scripted** or **In-Review** episode is silently returned to the dashboard with no error — the two middle stages of the production pipeline. Adjacent naming clue: `/episodes/:episodeId/composer` DOES exist but renders `TemplateStudio` (thumbnail/template composer), a different surface than the intended "scene-composer"; the nearest scene surface is `/episodes/:episodeId/plan` (`ScenePlannerPage`). So the break is likely a route-rename drift the workflow map never followed.

**This is a functional bug, not IA debt** — flagged here because the IA audit is what surfaced it. It belongs in the fix queue independent of any IA cleanup; whether it's a `workflowRouter` correction or a missing route is a fix-design question, not an inventory call.

### Sec 2.2 — P1: Double-redirect chains

Two routes redirect to a target that is itself a redirect:

- `/show-brain` → `/intelligence/show-brain` → `/show-bible?tab=knowledge`
- `/franchise-brain` → `/intelligence/franchise-brain` → `/show-bible?tab=decisions`

Each resolves eventually, but a redirect-to-a-redirect is a reliability smell and a sign of layered consolidation (Show Brain and Franchise Brain were folded into `ShowBiblePage` tabs in two separate passes). Single-hop them in cleanup.

### Sec 2.3 — P1: Orphaned imports (dead code-split chunks)

Five components are `lazy()`-imported at the top of `App.jsx` — so Vite builds a code-split chunk for each — but no `<Route>` renders them; their would-be routes redirect elsewhere:

| Imported component | Its route | Route actually renders |
|---|---|---|
| `ShowBrain` | `/show-brain` | `<Navigate>` (Sec 2.2) |
| `FranchiseBrainPage` | `/franchise-brain`, `/intelligence/franchise-brain` | `<Navigate>` |
| `CharacterGenerator` | `/character-generator` | `<Navigate to="/world-studio">` |
| `StoryEngine` | `/story-engine` | `<Navigate to="/stories">` |
| `StorytellerPage` | `/storyteller` | `<Navigate to="/stories">` |

These are unreachable chunks shipped in the build. Confirm they aren't rendered from another file before any removal (the import diff only proves they're unrouted *here*), then drop the imports in cleanup.

### Sec 2.4 — P1: Wardrobe redirect graveyard + stale AI-assistant references

Seven wardrobe routes exist; six redirect to `/` (dead) and only `/wardrobe/calendar` (`OutfitCalendar`) renders:

- dead → `/`: `/wardrobe`, `/wardrobe/analytics`, `/wardrobe/outfits`, `/wardrobe-library`, `/wardrobe-library/upload`, `/wardrobe-library/:id`, plus `/universe/wardrobe`.
- live: `/wardrobe/calendar`.

The `App.jsx` comment confirms wardrobe authoring was consolidated into WorldAdmin's wardrobe tab (`/shows/:id`). The IA issue: a bookmark or stale link to e.g. `/wardrobe-library/:id` silently lands the user at home with no explanation. Compounding it, the **AppAssistant `pageNames` map still lists `/universe/wardrobe` and `/wardrobe-library` as "Wardrobe Library"** — so the in-app AI assistant believes those are live pages while the router sends them to home. That is a concrete inventory→reality mismatch (the kind this audit step exists to catch), and it intersects the F-Ward keystone territory.

### Sec 2.5 — P2: "Studio" / "composer" label overload (the "Producer Mode" structural face)

The audit flagged "Producer Mode" as overloaded across surfaces. The literal "Producer Mode" string lives in component/tab files I don't have (the audit cites `SceneSetsTab.jsx` — a tab, not a route), so I can't confirm the label from the route map alone. But the route map shows the **structural** version of the same overload: "Studio" denotes five unrelated surfaces, and "composer" two —

- `/studio/timeline` (`StudioTimelinePage`), `/studio/scene/:id` + `/studio/scene-set/:id` (`SceneStudioPage`, "Canva-like editor"), `/scene-studio` (`SceneStudio`, "Book Scene Studio"), `/world-studio` (`WorldStudio`), `/template-studio` (`TemplateStudio`).
- "composer": `/episodes/:id/composer` (`TemplateStudio`, thumbnail) vs the intended-but-missing `scene-composer` (Sec 2.1).

Note `SceneStudio` (book scene) and `SceneStudioPage` (visual editor) are different components with near-identical names under the "scene/studio" umbrella. The naming carries no consistent meaning — a user cannot predict what a "Studio" link does. Catalogued as IA debt; the consolidation call is a later step and needs the nav files to see how these are actually presented.

### Sec 2.6 — P2: "World-*" surface sprawl

Seven world-prefixed top-level surfaces — `/world-setup`, `/world-locations`, `/world-dashboard`, `/world-foundation`, `/world-infrastructure`, `/world-studio`, `/shows/:id/world` (WorldAdmin) — sit among ~24 overlapping world/social/character/culture routes (also `/social-timeline`, `/social-personality`, `/social-systems`, `/influencer-systems`, `/cultural-calendar`, `/cultural-memory`, `/culture-events`, `/character-life-simulation`, `/character-depth-engine`, `/character-registry`, `/relationships`, `/continuity`, `/feed`, `/feed-relationships`, `/pressure`, `/property-manager`, …). The audit already flagged several of these as decorative (e.g. `/social-systems` UI, triple-archetype drift). The IA observation is narrower and inventory-level: this is the largest single cluster of top-level routes, with prefix collisions ("world-", "social-", "character-") that obscure which surface owns what. Whether any consolidate is a cleanup-step decision, not an inventory one — and one that genuinely needs the nav files plus per-surface "is this live or decorative" confirmation.

---

## Sec 3 — The reachability boundary (what the missing nav files close)

This inventory proves, for each route: whether it exists, whether it renders a component or a redirect, and whether its component is imported-but-unrouted. It does **not** prove reachability-from-UI. Specifically, the four un-attached files would close:

- **`Sidebar.jsx`** — which routes are in primary nav vs URL-only. A live route absent from the sidebar is a candidate orphan; a dead/redirect route still in the sidebar is a worse smell than one that isn't.
- **`UniversePage.jsx` / `ShowDetail.jsx`** — the hub entry points; many `/universe/*` and `/shows/:id/*` routes are presumably reached via tabs/cards here, not the sidebar.
- **`EpisodeOverviewTab.jsx`** — the episode-level entry points, and likely where the "Continue Working" button (Sec 2.1) is actually wired, which would confirm the P0's blast radius.

Until those land, Sec 2.5 and 2.6 stay catalogued-not-diagnosed (I can see the sprawl, not how it's presented), and the P0 (Sec 2.1) is confirmed at the routing layer but its UI trigger point is inferred.

---

## Sec 4 — What this inventory does NOT do

- Does NOT propose a redesign, consolidation, or rename — Path A: catalogue first.
- Does NOT delete or modify any route, import, or file.
- Does NOT confirm UI reachability (Sec 3 boundary) — that needs the four nav files.
- Does NOT fix the P0 workflow break — it records it; the fix (router vs map) is a separate design+execution step, and it sits outside IA cleanup.
- Does NOT confirm orphaned imports are dead globally — only that they are unrouted in `App.jsx`; check other render sites before removal.
- Does NOT count routes authoritatively — counts are hand-derived from a pasted file; verify against live `App.jsx`.

---
*Frontend IA audit inventory step, built from `App.jsx` (route map) + `workflowRouter.js`
(workflow intent). Severity-ranked spine: P0 — "Continue Working" routes SCRIPTED→scene-composer
and IN_REVIEW→animatic-preview to non-existent routes, silently dropping users at home at two
of six pipeline stages (a functional bug the IA pass surfaced, not IA debt); P1 — two
double-redirect chains, five orphaned lazy-imports (dead code-split chunks), and a six-route
wardrobe redirect graveyard whose dead pages the AI-assistant context map still names as live;
P2 — "Studio"/"composer" label overload (the structural face of the audit's "Producer Mode"
finding) and a ~24-route world/social/character sprawl with prefix collisions. Reachability-from-UI
is unproven pending the four nav files (Sidebar, UniversePage, ShowDetail, EpisodeOverviewTab);
every reachability claim is marked. Path A: catalogues and ranks; proposes no redesign, changes
nothing. Counts hand-derived — verify against live.*
