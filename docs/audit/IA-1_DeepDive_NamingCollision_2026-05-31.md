# IA-1 Deep-Dive & Naming Direction — The `Produc*` Three-Surface Collision

> **CLEANUP-PLAN PHASE. NO CODE CHANGED.** Per Path A, this analyses one finding and
> recommends a naming *direction with blast-radius costs*. It renames nothing, edits
> no label, touches no route. Frontend analysis — no backend, no DB, no frozen box.

| | |
|---|---|
| **Parent** | `Frontend_IA_Audit_Findings_v1.md`, finding **IA-1** (severity MED-HIGH — the original 2026-05-22 flag) + **IA-1a** (shared-data collision) |
| **Scope** | IA-1 naming only. Folds in confirmed interactions with IA-4, IA-6, IA-2 (see §5). |
| **Direction chosen** | **Universe = franchise roll-up (per IA-4); rename "Producer Mode" → "World"; rename ShowDetail "Production" tab → "Assets"** — selected 2026-05-31 |
| **Status** | Deep-dive + recommended direction. Implementation NOT started. |
| **Grounding** | Three surfaces confirmed from source this session (lines below). Inbound-link list per findings IA-1; an exhaustive grep is a rename prerequisite (§6). |

---

## Sec 1 — The collision, mechanized

One naming stem (`Produc*` / "Game Director") names **three distinct surfaces on
three distinct routes**, with no signposting that they differ:

| Concept (as named today) | Surface / component | Route | Confirmed |
|---|---|---|---|
| **"Producer Mode"** | `WorldAdmin` | `/shows/:id/world` | `WorldAdmin.jsx:1317` (`<h1>`), header comment "WorldAdmin v2 — Producer Mode Dashboard" |
| **"Production"** (tab) | ShowDetail tab → `ShowAssetsTab` | `/shows/:id?tab=…` (key `assets`) | `ShowDetail.jsx:260` (label); IA-6 proved it renders `ShowAssetsTab` ("Production Assets"), key `assets` |
| **"Game Director Dashboard"** | `ProductionTab` | `/universe/production` | `ProductionTab.jsx:5` |

**Inbound-link spread for "Producer Mode"** (per findings IA-1; subset confirmed this
session): `ShowDetail.jsx:223`, `UniversePage.jsx:110,212` (confirmed); plus
`Sidebar.jsx:34`, `StudioTab.jsx:56,173`, `ShowDetail.jsx:343`,
`EpisodeOverviewTab.jsx:947`, `StoriesPage.jsx:259`, `WorldSetupGuide.jsx:97` (per
findings). ~10 occurrences across ~8 files.

**IA-1a (the collision is over data, not just labels):** `ProductionTab` and
`WorldAdmin` both read `/api/v1/world/:showId/*` (events, goals) — two surfaces, two
names, one dataset, two lenses. Naming alone won't fully separate them; that's a
consolidation concern (§5), but the naming fix is the prerequisite.

---

## Sec 2 — The key insight: the code already says "World"

The component is **`WorldAdmin`**, the route is **`/shows/:id/world`**, and there's an
existing **`World*` family** (`WorldSetupGuide`, `ShowWorldView`, `WorldInsights`).
So the codebase *already* calls this surface "World" everywhere internally — **only
the user-facing label says "Producer Mode."** Renaming the label to "World" does not
impose a new concept; it aligns the display with what the code already is. This makes
the rename lower-risk conceptually than a fresh renaming would be, and it's the
strongest argument for the chosen direction.

---

## Sec 3 — Chosen canonical naming scheme

| Concept | New canonical name | Route (unchanged) | Was |
|---|---|---|---|
| Per-show world/event/goal tool | **"World"** (align label to route + `World*` family) | `/shows/:id/world` | "Producer Mode" |
| ShowDetail asset dashboard tab | **"Assets"** (align label to key + component) | `?tab=assets` | "Production" |
| Franchise-level roll-up | **"Game Director" / franchise framing kept** (now *honest* per IA-4 roll-up) | `/universe/production` | already this; IA-4 makes it true |

Net effect: each name maps to exactly one concept and one route. "Production" stops
being a third synonym; the franchise surface keeps its chrome *because IA-4 makes that
chrome accurate*; the per-show tool's label finally matches its own code.

*(Exact wording for the per-show tool — "World" vs "Show World" vs "World Admin" — is
the one remaining micro-decision; the direction (align to the `World*` family) is
settled. "World" alone may be ambiguous in some nav contexts; "Show World" disambiguates.)*

---

## Sec 4 — Blast radius (the cost, per rename)

The three renames have very different costs:

**4A — "Production" tab → "Assets" (CHEAPEST, do first).** Contained to `ShowDetail`.
The internal key is *already* `assets` (IA-6) and the keyboard shortcut already maps
Ctrl+3→`assets`. So this is a **single label string change** (`ShowDetail.jsx:260`)
that makes label = key = component-purpose all say "Assets." Near-zero risk, no
inbound links (it's a tab label, not a destination name).

**4B — "Producer Mode" → "World" (WIDE, exhaustive-or-inconsistent).** ~10
occurrences across ~8 files (§1). Each is a *display-string* change — low *technical*
risk (text, not logic) — but it must be **exhaustive**: a partial rename leaves some
surfaces saying "Producer Mode" and others "World," which is worse than the status
quo. Requires the prerequisite grep (§6) to enumerate every occurrence, including
non-visual ones (voice commands, comments).

**4C — franchise surface naming: NO rename needed.** IA-4's roll-up direction already
makes "Game Director / Franchise OS" honest. IA-1 just stops "Production" (the tab)
from colliding with it. So 4C is handled by the IA-4 work, not a separate rename here.

---

## Sec 5 — Cross-finding interactions (this is why IA-1 is the spine)

- **IA-4 (universe roll-up):** the chosen scheme *depends on* IA-4 — keeping the
  franchise chrome is only honest if `/universe/production` becomes a true roll-up.
  IA-1 and IA-4 must land together or the naming is still a half-truth.
- **IA-6 (tab label/key mismatch):** the "Production"→"Assets" rename (4A) *is* the
  resolution of IA-6's Position-3 mismatch. One change closes both. (IA-6's Position-1
  "Dashboard/studio/StudioTab" mismatch is separate, still open.)
- **IA-2 ("Universe Admin" ghost):** `ShowSettings.jsx` carries a stale comment "After
  Producer Mode moved to Universe Admin." If "Producer Mode" is being renamed anyway,
  that stale comment should be corrected in the **same pass** — IA-1 and IA-2 cleanup
  fold together naturally.

So IA-1's rename pass should be scoped to also close IA-6 Position-3 and IA-2's stale
comment — three findings, one coordinated naming change.

---

## Sec 6 — Prerequisites before any rename (Path A: not done here)

1. **Exhaustive "Producer Mode" grep** — enumerate *every* occurrence (visual labels,
   button text, **voice-command strings** à la `AmberPromptLibrary`, code comments)
   before renaming, so 4B is complete not partial. A voice command "go to producer
   mode" would break if only visual labels change.
2. **Final word choice** for the per-show tool ("World" / "Show World" / "World Admin")
   — §3 micro-decision.
3. **Sequence with IA-4** — the franchise-chrome honesty depends on the roll-up; don't
   ship the naming as "done" until IA-4 lands, or re-flag the chrome as aspirational
   in the interim.
4. **Confirm no route changes** — this is a *label* pass only; routes (`/world`,
   `?tab=assets`, `/universe/production`) stay. Renaming routes would be a far larger,
   redirect-bearing change, explicitly out of scope.

---

## Sec 7 — What this document does NOT do

- Does **not** rename, edit, or move any label, component, or route.
- Does **not** run the exhaustive grep (§6.1) — that's the implementation's first step.
- Does **not** resolve IA-3 (the `/episodes` alias) or IA-5 (the sanctioned
  `listShowsApi` duplication) — separate findings for the consolidation pass.
- Does **not** address IA-1a's *data* overlap (two surfaces, one dataset) — that's
  consolidation, beyond naming.
- Does **not** touch backend, DB, or the frozen prod box.

---

*IA-1 deep-dive and naming direction. Three surfaces collide on the `Produc*` stem;
chosen scheme = Universe stays franchise (honest via IA-4) / "Producer Mode" → "World"
(aligns label to the route and the existing `World*` family) / "Production" tab →
"Assets" (aligns label to key, closes IA-6 Position-3). Cheapest first (tab label),
widest is the "Producer Mode" rename (~10 sites, must be exhaustive). Folds in IA-6
P3 and IA-2's stale comment. Path A: plan only, no code. Sequence with IA-4.*
