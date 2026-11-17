# Episode workflow and navigation audit (2026-11-17)

**Status.** A dated, point-in-time read, preserved as returned to Evoni on 2026-11-17. It rules nothing and nothing in it is implemented. **The authoritative plan is `docs/design/2026-11-studio-home-episode-command-center.md`;** where this audit's recommendations (Part 7, especially D, E, F, I and J) differ from that plan, the plan governs.

**Basis.** `origin/main` at `8ca49577f544b3e593ae47ff88b7df64068239ab`. `file:line` citations are against that SHA and are paired with the component or function name. Read-only: no code, branch, PR, database write, migration, deploy or AI call was made to produce it.

**Corrections made after this audit was returned** (the text below is otherwise as returned):

1. **Episode Overview requests.** The audit says "about 20 requests" on a default open. A later exact count from source is about 28–33, with seven URLs fetched two or three times.
2. **Release Board.** Later tracing confirmed the Release Board never writes `status`. Only the episode header dropdown and the Episodes board (drag, and "Move to Released") can set `published`. See `docs/design/2026-11-publication-confirmation-safeguard.md`.
3. **Moving an episode between slots.** The accepted Season Planning specification (`docs/design/2026-11-season-planning.md`) already specifies Move/Swap; it is not built. Where this audit implies that needs a new design, read "Move/Swap as specified there".
4. **Earlier blueprint.** `docs/reads/2026-11-04-navigation-ownership-blueprint.md` predates this audit and was not consulted while writing it. The plan reconciles the two (its §3.1). In particular, this audit's consolidation list (Part 7 I) is not authoritative: Evoni's ruling 3 of 2026-11-04 (one Complete workflow) governs completion.
5. **Row-level production values removed.** The copy first returned in the session listed field values of the live episode read from the daily database snapshot. Under F-Tools-2 Amendment 1 §5.4, sample values are not copied into a commit, so this file keeps only counts and schema facts. Removed text is marked "[row values omitted]".

## How to read the evidence

- **Code claims** come from six parallel read-only traces of the source. Paths are relative to the repo; `F/` means `frontend/src/`. Nothing was run in a browser.
- **Re-checked by me** after the traces: Home's `continueEpisode` and its link target, `nextStep`, `primaryAction`, the slot query in `assignOnStart`, the `working-episode-id` write, the disabled render buttons, and the Roadmap's "+ Add Episode" link. All matched.
- **Production facts** come from today's database snapshot in `prime-diagnostics` (taken 2026-11-17 06:27 UTC) and the season-integrity report of 2026-11-11. I ran no command against production.
- **ASSUMPTION** marks anything not read directly.

## Summary

1. The app already has most of what both target experiences need. A "Now producing" card with a computed next action exists in Producer Mode's Overview; the Episode Overview already has a next-step banner, brief, event, season position and checklist progress. Neither target needs a new page, table or service.
2. The biggest workflow problem is creation: there is no way to make an episode for a chosen season slot. "+ Add Episode" on the Roadmap carries no slot, and Start Episode silently takes the earliest open slot unless the event was pencilled in first.
3. The biggest navigation problem is resume: Home's "Continue" always opens the static Overview, nothing remembers the last tab, and three different rules pick "the current episode".
4. An episode is planned almost entirely on the Event Package, before the episode exists. The episode page is where production happens.
5. The sidebar has no show or episode context at all, and several production destinations are only reachable through Producer Mode or the Season page.

## Live state (production snapshot)

| Fact | Value |
|---|---|
| Live shows | 1 (*Styling Adventures with Lala*) |
| Live episodes | 1; the `episodes` table holds 76 rows, the rest soft-deleted |
| The live episode's own fields | [row values omitted] |
| Season 1 | 24 slots; 20 empty pencilled slots; 0 integrity violations (2026-11-11) |
| Integrity report B1 | 1 placed episode counted as filmed |
| `shows.episode_count` | does not match the live episode count (stale counter) |
| Unique index on show + episode number | none |

---

## Part 1 — Login and homepage

1. **Route after login:** always `/`. `Login.handleLogin` does not navigate; `AppContent` sends an authenticated user from `/login` to `/` (`F/App.jsx:254-261`). A signed-out deep link is discarded, so there is no return-to-where-I-was after login.
2. **Homepage component:** `Home` (`F/pages/Home.jsx`). In order: hero (greeting, show name, Continue), eight tiles, Continue Episode + Upcoming Event, Numbers (AI budget, the show's money, Storytelling), Trending in LalaVerse, Lala's Journey + To-Do + Shop the Look, footer links.
3. **Current show:** no context and no backend flag. `activeShowId` (`F/utils/activeShow.js`) resolves: show in the URL → localStorage `primeStudios.activeShowId` → the only show → null. `useActiveShow` wraps it and offers `ShowChooser`. Home deviates: `homeShow` falls back to the show with the most episodes and never remembers its choice.
4. **Active episode:** `continueEpisode` picks the unreleased episode with the latest `updated_at`. It is not "last opened".
5. **"Continue S1 · E1" opens** `/episodes/:id` with no tab, which is the Overview tab (`DEFAULT_EP_TAB = 'overview'`).
6. **Shortcuts:** Episodes → Season page Episodes tab; Closet → Producer Mode wardrobe; Style Page → episode `?tab=lookbook`; The Cast → `/character-registry`; Map → `/universe?tab=world&sub=map`; Lala's Bank → Producer Mode finances; Shop → `/shop-the-look`; The Pulse → `/pulse`; To-Do → `/today`.
7. **Home vs Shows vs Producer Mode vs Episode Overview:**
   - Home: cross-domain dashboard for one show (production, money, audience, novel).
   - Shows (`/shows`): poster cards, each with its own Continue. `/shows/:id` is only a redirect into Producer Mode.
   - Producer Mode (`/shows/:id/world`, `WorldAdmin`): show-level tools — Overview, Assets (Scene Sets, Wardrobe, Lala's Phone, Overlays), Cast & Continuity, World, Release. Its Overview already has "Now producing" with a checklist and next action.
   - Season page (`/shows/:showId/season`): where the season is run — Overview, Roadmap, Episodes board, Events, Opportunities, Story, Cast, Goals, Results.
   - Episode (`/episodes/:id`): Overview, Script, Production, Results.
8. **Existing resume / progress / next-action logic:** `primaryAction` and `checklistSummary` (`F/components/Show/ShowOverview.jsx`), `nextStep` (`F/lib/episodeOverview.js`), `pipelineSteps` (`F/lib/episodePipeline.js`), `productionSteps` (`F/lib/productionSteps.js`), `loadProductionChecks` + `checklistFixTarget` (`EpisodeProductionChecklist.jsx`), `attentionItems` / `useSeasonAttention` (`F/lib/seasonAttention*.js`), and the localStorage key `working-episode-id`. Nothing stores the last tab per episode.
9. **Audience/game-oriented Home parts:** Trending in LalaVerse, Lala's Journey (coins, reputation, brand trust), Shop the Look, the show's money card, and the tiles Lala's Bank, Shop, The Pulse, Map, The Cast.
10. **Empty states:** no show and a failed shows fetch look identical ("Your studio", tiles fall back to `/shows`, no error, no "create a show" button). No season is not handled at all; Home never reads the roadmap. No episode hides Continue and shows "No episode yet. Start one". Failed reads are indistinguishable from empty ones.

**Also found:** Home fetches the newest 100 episodes across all shows and filters client-side, though the API supports `show_id`.

---

## Part 2 — New episode creation

There is one real creation path in the UI: **Event → Event Package → Start Episode**.

### Entry points

| Entry point | Goes to |
|---|---|
| Roadmap "+ Add Episode", Episodes board, Producer Mode Overview, Event Library "New event", `/episodes/create`, `/shows/:id/quick-episode`, Editor hub | `/shows/:showId/new-episode` (`NewEpisodeStarter`, ADMIN only) |
| Event Package "Start Episode" | the creation call itself |
| Event Library "Generate from N events", What's-next overlay | same service, skipping the package steps |
| Roadmap slot ⋯ "Start Part 2" | a thin copy of Part 1 |
| Regenerate (Event Library, Episode Overview) | new episode replaces the old one in the same slot |
| `POST /api/v1/episodes` | blank episode; no reachable UI uses it |

### Step A — the starter creates an event, never an episode

Five working doors: Creator Invitation (pick a Pulse profile), Brand (brand + name), World Event (pick a calendar event), Career Opportunity (pick an open opportunity), Surprise Me (one paid Haiku call per click). "Personal Story" is disabled. The server requires only the event `name`. The starter reads no slot. There is no "use an existing event" door. Leaving the starter after choosing a door leaves a draft event behind.

### Step B — Start Episode on the Event Package

- **Screens:** Start Episode → warnings dialog → Episode Locations → "Who's new" → create → lands on `/episodes/:id?tab=overview`.
- **Required in the UI (8 gates):** organizer, name, category, format, date, venue, invitation, deal prices.
- **Required by the server (3 blockers):** the event has no live episode, deal prices complete, not frozen (plus an offer decision when an opportunity is open).
- **Not required by the server:** characters, The Pulse, locations, opportunities, assets.
- **Auto-generated:** episode number (max + 1), and title, synopsis, teaser, tags, beat outline and forward hook from one paid Haiku call on every Start.
- **One transaction:** episode, brief, spending draft, event marked used, price snapshot, offer decision.
- **After commit, each on its own and non-fatal:** season slot, 14 scene-plan rows, locations, overlays, feed moments, to-do list, wardrobe links, asset relinks. Only three of these report failure to the user.
- **Slot linkage:** the slot pencilled with this event wins; otherwise the earliest open un-pencilled slot; with no active season the episode sits in no slot.
- **Duplicates:** well protected per event (row lock, unique index, idempotency key). Episode numbers are not protected: the number is computed before the transaction and there is no unique index.
- **Cancel:** nothing is created until the last step, except guests added in "Who's new", which persist if creation then fails.

### The three cases

- **(a) New episode in an existing slot:** there is no "create here". An open slot only offers a dropdown to pencil in an existing draft/ready event, then "Open the event package". An open slot with no event shows no action at all.
- **(b) Episode with no slot:** only when the show has no active season or slot assignment fails.
- **(c) New season:** the Season page with no season shows a setup form (title + three part names) and creates the season and its 24 slots in one transaction. A second season is blocked until the current one is complete.

### Enforced vs suggested

Most readiness is suggested only. The side doors (bulk generate, What's-next overlay) call the same service with none of the eight UI gates and none of the Locations / Who's New steps. The creation routes require sign-in, not ADMIN, while the starter page is ADMIN-only. Draft PR #3840 (ADMIN-by-default write guard) is the existing work that would close that; I did not read it.

---

## Part 3 — Existing episode experience

- **Landing:** `/episodes/:id`, tab from `?tab=` only, default Overview.
- **Overview shows:** next-step banner, three tiles (prestige, coins after, Lala's look), brief (saves on blur), "From the event" readiness (event, place, stakes, cast, look), teaser, linked events, season position, stakes, money, style board.
- **Script:** in-page editor with per-beat approval. Teleprompter is a link out.
- **Production:** Wardrobe, Style Page, Phone, Overlays, Money, Checklist, Scenes (Workspace / Plan), Files (Photos / Footage), Voice, Edit.
- **Results:** Summary (with Complete), Story, Distribution.
- **Files and footage:** Production › Files. The Photos/Footage choice is not in the URL.
- **Event Package:** the header chip carries `from=episode:<id>` and returns to the episode. The two Overview cards link to the same package without `from`, so Back goes to the Season's Events tab.
- **Progress indicators:** Production tab "N left", Checklist `done/total`, a seven-step bar that shows only on Production tabs, not on Overview.
- **Returning to a task:** not supported. No last tab, sub-tab or scroll is stored.
- **Unsaved work:** the Script tab is thorough (dirty flag, confirm, local draft, unload guard). Footage uploads and the teleprompter reader guard unload. The Overview inline Edit form, `/episodes/:id/edit` and the scene planner have no guard.
- **Inconsistent entry points:** Home, Shows, the board and the Roadmap open the Overview. Producer Mode's "Now producing" opens the actual next step. Thirteen other links open specific tabs.
- **Context loss:** sidebar Teleprompter opens with no episode and does not preselect the show; sidebar Editor lists all episodes and only badges "Last opened".
- **Load cost:** about 20 requests on a default open, some duplicated. No server endpoint aggregates episode progress.

**Episode 1 today:** Home's Continue opens its Overview. For an episode that already has a script, the banner reads "Work through production · N checks left" and sends her to the Checklist. It cannot say which item, although `primaryAction` already can. [row values omitted]

---

## Part 4 — Production journey

| # | System | Needed when | Enforced? | Scope | How the episode references it | Reuse existing? | Leave the episode? | Way back |
|---|---|---|---|---|---|---|---|---|
| 1 | Show / season | Show to start; season optional | Show: service throws. Season: no | Show | `episodes.show_id`; `season_slots.episode_id`; `season_context` snapshot | Slots reused | Yes | Breadcrumb only |
| 2 | Premise / brief | Not required; AI-drafted at Start | No | Episode | `episode_briefs.episode_id` | No | No | — |
| 3 | Continuity / state | Automatic | No | Show (stats), universe (world) | `character_state.last_applied_episode_id`; follow-ups | Derived | Yes | None |
| 4 | Characters / relationships | Organizer at Start | UI only | Universe; registry per show | Via the event (`source_profile_id`; guests in JSON) | Yes | Inline on package | None from registry |
| 5 | Dream Cities / locations | Venue at Start | UI gate; server warning | Universe; scene sets per show | Event `venue_location_id`, `scene_set_id`; `scene_set_episodes` | Yes | Inline on package | Scene Sets: yes |
| 6 | Event Package | To start | UI: 8 gates; server: 3 | Show; one event, one episode | `episode_briefs.event_id`, `world_events.used_in_episode_id`, slot | Until used | Yes | `from=` on some links |
| 7 | Opportunities / brands | Optional | No | Show; brands universe | `opportunities.event_id`, `episode_id` | Yes | Yes | None |
| 8 | The Pulse / interruptions | Optional; templated at Start | No | Posts per show; moments per episode | `scene_plans.feed_moment`, `feed_moments` | Link live posts | Partly | None |
| 9 | 14 beats | Automatic at Start | — | Global structure; rows per episode | `scene_plans.episode_id` | No | No | — |
| 10 | Script / commentary | Required in practice | Brief needed to generate; "done" is display only | Episode | `episodes.script_content`, versions | Versions | No | — |
| 11 | Wardrobe / gameplay | Later | Lock checks reach and coins | Closet per show; look per episode | `episode_wardrobe` | Yes | Only to manage the closet | None |
| 12 | Scene sets / angles | Later | Display only | Shared | `scene_set_episodes`, `scene_plans` | Yes | Yes | `from` handoff bar |
| 13 | Readiness | Advisory | Gates nothing | Episode | Computed client-side | — | No | — |
| 14 | Teleprompter | Optional | ADMIN to save | Global tool | `?episode=`; `episode_raw_clips` | Takes | Yes | None |
| 15 | Voice Studio | Optional, flag-gated | Server approvals | Episode | `line_voice_*` | Legacy import | No | — |
| 16 | Edit / render | Edit optional; render not built | Flag + revision | Episode | edit tables, `edit_versions` | Versions | Yes | Back link |
| 17 | Results / distribution | Complete needed for carry-over | Server gates Complete only | Episode | `evaluation_*`, `distribution_metadata` | Show defaults | Evaluate, Thumbnail | Back links |
| 18 | Carry-overs | Automatic at Complete | One transaction | Show | `character_state`, ledger, `franchise_knowledge`, story record, follow-ups | — | — | — |

**Notes that matter for the redesign**

- No new Pulse post, character, location or event is required per episode by the server. Phone moments are templated; guests and places are picked from existing records.
- **Three lifecycles run side by side:** `status` (a free string with no transition rules), `evaluation_status`, and per-platform distribution status. Completing an episode does not change `status`, yet the story clock and Pulse fits read `status = 'published'`.
- **Editing does not reach video.** "Preview Render" and "Export Video" are permanently disabled pending the render host. The only working export reads legacy tables and is reachable only through a stub page.
- **Publishing is manual.** No platform upload code exists; URLs and statuses are typed in.
- **An episode can be completed with no script, footage or edit.**
- **Story carry-forward needs a separate approval** of the story record on Results › Story; without it the next episode gets stats but no "what happened".
- `episode_briefs.lala_state_snapshot` is never filled at Start, so the brief does not record the state the episode was planned against.
- **Five readiness computations** exist with different definitions (checklist, seven-step bar, per-beat coverage, edit findings, season attention / release board).
- **Name collisions:** "Continuity" (Lala's state vs an unrelated timeline tool), "beats" (14-beat plan, brief outline, animatic beats), "Scene Studio" (novel tool vs episode canvas), "Edit" (details form, launcher tab, timeline), "Lock" (five meanings), "Todo / Run Sheet / On-screen to-do lists".

---

## Part 5 — Sidebar and information architecture

### A. Current navigation map (ADMIN)

```
[brand mark] → /start (novel writing desk)
Home → /
WORLD
  LalaVerse → /universe        (Bible, world, society, brands, culture, state)
  Characters → /character-registry      (ADMIN only on arrival)
  Relationships → /relationships         (ADMIN only on arrival)
  The Pulse → /pulse
PRODUCE
  Shows → /shows
     <show> → /shows/:id → redirects to Producer Mode
     + New Show
  Editor → /studio/editor
  Teleprompter → /teleprompter
LIBRARY
  Assets → /assets
  Templates → /template-studio
WRITE
  Stories → /stories
     Threads · Story Calendar · Story Evaluation
footer: Search · Settings · Admin (ADMIN only)
top bar: static "Prime Studios", email, Logout, breadcrumbs
```

Second level, not in the sidebar: Producer Mode tabs, Season page tabs, Episode tabs, LalaVerse hub tabs, Admin tabs.

### Findings

- **Role visibility:** only the Admin row is hidden for non-admins. Characters and Relationships are shown to everyone and refuse on arrival. Producer Mode, the Season page, every episode route, Editor, Teleprompter and Assets have no frontend gate.
- **Context:** the sidebar has no show-scoped link and no notion of a current episode. The active show only sorts the Shows sub-list.
- **Missing from the sidebar:** Season Roadmap, Episodes board, Events, Opportunities, Scene Sets, Wardrobe, Lala's Phone — all reached through Producer Mode or the Season page.
- **Duplicates:** two "home" surfaces (`/` and `/start`); Settings twice; "The Pulse" in the sidebar and as an Admin tab; "Assets" in the sidebar (Asset Library) and as a Producer Mode tab (different content); four "Open Editor" entry points.
- **Misleading names:** "LalaVerse" is `/universe` and breadcrumbs say "Universe"; "Characters" opens "The Cast"; a show opens "Producer Mode"; Producer Mode's "World" tab is Lala's posts, not the world; the user footer always says "Creator".
- **Orphaned routes (no inbound link found):** `/narrative-control`, `/scene-proposer`, `/assembler`, `/scene-studio`, `/continuity`, `/world-setup`, `/admin/templates`, `/this-week`, `/episodes/:id/script-writer`, `/review`, `/beats`, `/export`, `/icon-cues`.
- **Mobile:** off-canvas drawer below 1280px; no bottom nav; full-screen routes (editor, write mode, scene canvas) drop the sidebar entirely.
- **Small bug:** landing directly on `/story-threads` does not expand the Stories group.

### Evaluation of the proposed structure

| Proposed | Verdict |
|---|---|
| STUDIO HOME | Fits `/`. `/start` needs a home under WRITE. |
| FRANCHISE › Shows & Seasons | Works. Show rows currently open Producer Mode, which is production; point them at the Season page or keep the label honest. |
| FRANCHISE › Characters & Relationships | Two existing pages; keep as two rows or one row with an in-page switch. |
| FRANCHISE › Dream Cities | No page of that name. Alias to `/universe?tab=world&sub=map`. **The LalaVerse hub (Bible, society, brands, culture, state) has no home in the proposal and must keep a row.** |
| FRANCHISE › The Pulse | Direct. |
| PRODUCE › Episode Planning | Alias to the Season page (Roadmap / Episodes). Needs the active show; `/universe/production` already does this redirect. |
| PRODUCE › Events & Opportunities | Two Season page tabs; same show dependency. |
| PRODUCE › Production & Editor | Editor is direct. "Production" is the current episode's Production tab or Producer Mode. |
| WRITE › Stories & Scripts | "Scripts" is ambiguous: episode scripts live on the episode. Call it "Stories" and keep its three children. |
| STUDIO › Assets & Scene Sets | Two destinations (`/assets`, Producer Mode Scene Sets). Templates, Wardrobe and Lala's Phone have no home. |
| STUDIO › Voice & Teleprompter | Teleprompter is direct. Voice has no standalone page; it is an episode tab behind a feature flag. |
| SYSTEM › Settings & ADMIN | Direct; Admin stays admin-filtered. Search has no home. |

A persistent **Current Episode** shortcut would help, and can be driven from state that already exists (see F below).

---

## Part 6 — Walkthroughs

### Scenario A — plan Episode 2 in an existing Season 1 slot

**Today**

1. Home → tile "Episodes" → Season page, Episodes tab.
2. Switch to Roadmap. Slot 2 is open. Its panel offers only "pencil in an existing event".
3. If no suitable event exists: "+ Add Episode" → `/shows/:id/new-episode`. The slot is forgotten here.
4. Pick a door (for example Brand) → a new draft event → Event Package.
5. Fill the eight gates on the package.
6. To be sure it lands in slot 2: go back to the Season page, open slot 2, pencil the new event in, reopen the package.
7. Start Episode → warnings → Locations → Who's new → `/episodes/:id?tab=overview`.

**Points of confusion**

- "Add Episode" creates an event, and the Event Library's "New event" opens a page titled New Episode.
- Skipping step 6 still works only by accident: Start takes the earliest open slot.
- Nothing on the starter shows what the season intends for this slot (story purpose, pressure, phase), although the slot holds it.
- Abandoning at step 4 leaves a stray draft event.
- Every Start makes a paid AI call with no opt-out.

**Recommended**

1. Studio Home → "Plan next episode: S1 · E2" (the next open slot, with its story purpose).
2. Opens the Roadmap with slot 2's panel open. The panel offers: use the pencilled event, pick another existing event, or create a new event for this slot.
3. "Create new event" opens the existing starter with the slot in the URL; the new event is pencilled into that slot on creation.
4. Event Package shows a slot banner ("For S1 · E2 — Foundation") and the existing readiness list.
5. Start Episode → same steps → Episode Command Center.

- **Visible at each stage:** the slot's intention, what the previous episode left open (follow-ups, forward hook), Lala's current coins and reputation, and which existing events, places and cast are available.
- **Remembered automatically:** the show, the slot, and the event being prepared (so Studio Home can say "Continue preparing: <event>" before an episode exists).
- **Avoiding duplicates:** offer existing draft/ready events first; pass the slot to Start so the server places it deliberately; reuse the idempotency key that already exists.

### Scenario B — return after several days to Episode 1

**Today**

1. Log in → Home → "Continue S1 · E1" → Episode Overview.
2. Banner: "Work through production · N checks left" → Checklist.
3. Read the checklist to find what is missing; click through to that tool.
4. If the tool is the Teleprompter, the closet, Thumbnail Studio or the run sheet, the way back returns to Overview or nowhere.

**Points of confusion**

- Continue does not go where she left off, and the banner names a list, not a task.
- Producer Mode's "Now producing" card gives a better answer than Home does, for the same episode.
- The hand-set `status` can lag behind real progress [row values omitted]; the seven-step bar that would show real progress is hidden on Overview.
- Sidebar Editor and Teleprompter ignore that E1 is the working episode.

**Recommended**

1. Log in → Studio Home shows E1 with its stage, "N of M checks done", the next action by name, and **Resume where I left off**.
2. Resume opens the last tab and sub-tab she used on E1. The secondary button opens the Episode Command Center.
3. Command Center shows the seven steps, what exists / is missing / optional / blocked, and "Continue: <first open section>".
4. Every tool opened from the episode returns to the tab it was opened from.

- **Remembered automatically:** last episode per show, last tab and sub-tab per episode, unsaved script draft (already exists), in-flight uploads (already exists).
- **Avoiding re-entry:** nothing new to enter; all of it is derived from records that exist.

---

## Part 7 — Recommendations

### B. Current creation flowchart

```
[+ Add Episode | New Episode | New event | /episodes/create]
   └─> /shows/:id/new-episode   (starter, ADMIN)   — slot not carried
         Creator | Brand | World Event | Career Opportunity | Surprise Me (paid)
   └─> draft world_events row
   └─> /shows/:id/events/:eventId   (Event Package)
         fill 8 UI gates   [optional detour: Season › slot › pencil this event]
         Start Episode → warnings → Locations → Who's new → create
           one transaction: episode + brief + spending + event used + prices + offer
           then best-effort: slot (pencilled, else earliest open) → 14 scene plans
             → locations → overlays → feed moments → to-do list → wardrobe / assets
   └─> /episodes/:id?tab=overview

Side doors: bulk generate / What's-next overlay → same service, no gates → /episodes/:id
            slot ⋯ → Start Part 2 → episode + brief + slot only
            Regenerate → new episode replaces old
Season:     Season page (no season) → setup form → season + 24 slots
```

### C. Current existing-episode flowchart

```
Home / Shows "Continue", board, Roadmap ──► /episodes/:id ──► Overview
Producer Mode "Now producing" ───────────► ?tab=<actual next step>
Overview ─► Script ──► Teleprompter (no way back)
        ─► Production: Wardrobe · Style Page · Phone · Overlays · Money · Checklist
                       · Scenes (Workspace / Plan) · Files · Voice · Edit
              ├─► Editor (returns to Edit)        ├─► Scene Sets (returns)
              ├─► Thumbnail Studio (returns to Overview or Scenes)
              └─► Run Sheet, Evaluate (return to Overview, not Checklist)
        ─► Results: Summary · Story · Distribution ─► Event Package (returns)
        ─► Event Package: header chip returns; Overview cards do not
```

### D. Proposed Studio Home — REORGANIZE `Home.jsx`

No new page, no new API. Order top to bottom:

1. **Show header** — show name, season and position ("Season 1 · 1 of 24 episodes"), show switcher when more than one. REUSE `useActiveShow`, `ShowChooser`, `seasonStats`. FIX: Home should use the same show rule as every other page.
2. **Now producing** — the current episode: code, title, stage, seven-step bar, "N of M checks", next action by name, **Resume** and **Open episode**. REUSE the "Now producing" block and `primaryAction` / `checklistSummary` from `ShowOverview.jsx`, and `pipelineSteps`.
3. **Plan next episode** — the next open slot with its story purpose and pencilled event, linking to the Roadmap with that slot open. REUSE the roadmap data the Season page already loads. Also **Season Roadmap** as a plain link.
4. **Needs attention** — blockers and waiting decisions. REUSE `useSeasonAttention` / `SeasonAttentionDigest` and the existing To-Do card (`/daily-update`).
5. **Coming up** — the upcoming event card (exists).
6. **Studio numbers** — AI budget (exists).
7. **In the LalaVerse** (collapsed or moved to the LalaVerse hub) — Trending, Lala's Journey, Shop the Look, the show's money. Nothing is removed.

Empty states — FIX: no show → "Create your first show"; no season → "Set up Season 1"; no episode → "Plan your first episode"; a failed read says it failed.

### E. Proposed Episode Command Center — ENHANCE the Overview tab

No new route: `/episodes/:id?tab=overview` stays the Command Center.

1. **Identity** — code, title, season position, status, air date (exists in the header).
2. **Resume where I left off** — NEW, small: remember the last tab and sub-tab per episode in localStorage. No table, no API.
3. **Recommended next action** — FIX: replace the banner's coarse third state with the `primaryAction` result ("Continue: Wardrobe"), so Home, Producer Mode and the episode agree.
4. **Progress** — REORGANIZE: show the existing seven-step bar on Overview, not only on Production tabs.
5. **What exists** — REUSE `CHECKLIST_SECTIONS` grouped as complete / missing / optional / blocked. "Blocked" covers what really is blocked today: setup steps that did not finish, feature flags that are off, and render not being built.
6. **Connected** — event package, place, cast, look, opportunities, season slot. REUSE `FromEventCard`, the Events card and Season position. FIX: add `from` to both event links.
7. **From earlier episodes** — follow-ups and the last approved story record. REUSE `storyCarryForward` (server-side today; whether a read endpoint already exposes it to the page is an ASSUMPTION to check). For E1 this section is empty.
8. **Reference** — brief, teaser, stakes, money, style board (exist; move below the fold).

### F. Proposed ADMIN sidebar — REORGANIZE

```
STUDIO HOME                      → /
▸ CURRENT EPISODE  S1 · E1       → resume (pinned; hidden when there is none)
PRODUCE
  Season Roadmap                 → Season page, Roadmap      (alias, active show)
  Episodes                       → Season page, Episodes
  Events & Opportunities         → Season page, Events
  Editor                         → /studio/editor
  Teleprompter                   → /teleprompter (opens on the current episode)
FRANCHISE
  Shows                          → /shows
  LalaVerse                      → /universe
     Dream Cities                → /universe?tab=world&sub=map   (alias)
  Characters                     → /character-registry      (hide for non-admins)
  Relationships                  → /relationships            (hide for non-admins)
  The Pulse                      → /pulse
WRITE
  Stories  (Threads · Story Calendar · Story Evaluation)
  Writing desk                   → /start
STUDIO
  Assets                         → /assets
  Scene Sets                     → Producer Mode, Scene Sets  (alias, active show)
  Wardrobe                       → Producer Mode, Wardrobe    (alias, active show)
  Templates                      → /template-studio
SYSTEM
  Search · Settings · Admin
```

Differences from the proposal as given, and why:

- PRODUCE sits above FRANCHISE because production is the daily work.
- LalaVerse keeps a row; the proposal had no place for the Bible, society, brands, culture and state.
- "Stories & Scripts" becomes "Stories"; episode scripts stay on the episode.
- "Voice" gets no row; it has no standalone page and belongs to the current episode.
- Templates, Wardrobe and Search keep a home.
- Every alias is a link built from the active show, falling back to the show chooser as `/universe/production` already does. No authorization changes: Admin stays filtered, and every `AdminOnly` wrapper stays.

**Current Episode** is driven from `working-episode-id`, which is already written on every episode open, with Home's `continueEpisode` as the fallback. Three fixes it needs first: scope it per show, clear it when the episode is deleted, and make it update without a reload.

### G. What to reuse

| Need | Existing piece |
|---|---|
| Current show | `useActiveShow`, `activeShowId`, `rememberShow`, `ShowChooser` |
| Current episode | `continueEpisode` (Home), `working-episode-id` (EpisodeDetail), `defaultEpisode` (ShowOverview) — collapse to one rule |
| Next action | `primaryAction`, `checklistFixTarget`, `nextStep` |
| Progress | `pipelineSteps`, `productionSteps`, `loadProductionChecks`, `checklistProgress` |
| Attention / blockers | `useSeasonAttention`, `attentionItems`, `SeasonAttentionDigest`, `/daily-update` |
| Season and slots | `season_slots`, `show_arcs`, `seasonPageHref`, `SlotPanel`, pencil-in route |
| Event readiness | `eventReadinessSections.js`, `startReadinessService.js` |
| Return paths | `packageHref` / `returnLink` (`F/lib/eventFlow.js`), `sceneSetPath` with `from` / `fromLabel` |
| Episode tabs | `EP_TABS`, `resolveEpisodeTab` |
| Carry-over | `completeEpisode`, `storyCarryForward`, `show_follow_ups`, `character_state` |
| Relationships in data | slot → event + episode; brief → event; event → episode; `scene_set_episodes`; `episode_wardrobe`; `opportunities.event_id / episode_id` |

### H. Gaps and bugs, ranked

**High**

1. No slot-targeted creation; Start silently takes the earliest open slot. FIX.
2. No resume; Continue opens the static Overview; three rules pick the current episode. FIX.
3. Readiness is enforced only in the UI; side doors skip it; creation routes are sign-in only; the blank-episode API is still open. FIX (see draft PR #3840).
4. Three unsynchronised lifecycles; `status` is a free string; completing does not publish. [row values omitted] FIX, needs your ruling on what `status` should mean.
5. No path from edit to video, and publishing is manual. Known pending work (render host), not a regression. The Command Center should show it as blocked.

**Medium**

6. Return paths drop the origin: Teleprompter (none), Run Sheet and Evaluate (Overview, not Checklist), Thumbnail Studio, Overview event cards, closet, registry, Season page. FIX.
7. Episode numbers can duplicate (no unique index; number computed outside the transaction). FIX.
8. Setup after Start is best-effort; only three of about twelve steps report failure. FIX.
9. Home fetches 100 episodes across all shows; failed reads look empty; no-show and no-season states have no call to action. FIX.
10. Five readiness computations with different definitions; about 20 requests per episode open. REORGANIZE.
11. Story carry-forward depends on an unprompted separate approval; `lala_state_snapshot` is never filled at Start. FIX.
12. "Start Part 2" episodes get no scene plan, to-do list, locations or spending rows. FIX.
13. Sidebar Teleprompter and Editor ignore the working episode. FIX.
14. Unsaved-work guards are missing on the Overview Edit form, `/edit` and the scene planner. FIX.

**Low**

15. Dead code: `CreateEpisode.jsx` (unrouted), the create branch of `QuickEpisodeCreator`, old next-action helpers in `EpisodeDetail.jsx`, `workflowRouter.js`.
16. Orphaned routes listed in Part 5.
17. Label problems listed in Parts 4 and 5; stale copy on the starter ("Producer Mode's Events → Ideas"); stale "Working Episode" tooltip; footer role always "Creator".
18. Ctrl/Cmd+S jumps to Scenes outside the Script tab.
19. `shows.episode_count` is stale (0 with one live episode).
20. Stories group does not auto-expand on its own children.
21. Feature flags hide the Voice and Edit pills silently.

### I. Consolidate or remove without losing function

| Item | Action |
|---|---|
| `/episodes/:id/evaluate` vs Results › Summary | Keep Results; redirect the route. Both call the same completion. |
| `/episodes/:id/script-writer` vs Script tab | Redirect to the Script tab after confirming nothing unique remains (brain rules are only visible there). |
| `/episodes/:id/edit` vs Overview inline Edit | Keep one details form. |
| `/episodes/:id/plan` vs Scenes › Plan | Keep the tab; make re-plan an action inside it. |
| `/review`, `/export`, `/beats`, `/icon-cues` | Retire or redirect once the render path is decided. |
| `CreateEpisode.jsx`, `QuickEpisodeCreator` create branch | Delete (unreachable). |
| `/this-week`, `/start` vs Home | `/this-week` redirect can go; `/start` moves under WRITE. |
| Run Sheet / Todo List / On-screen to-do lists | One name. |
| Two opportunity-to-event server routes | Keep the one the UI calls. |
| Three "current episode" rules, four progress models | One of each, shared by Home, Producer Mode, sidebar and episode. |

Each removal needs a check that no saved link or test depends on it; I did not verify that.

### J. Phased proposal

| Phase | Work | Depends on | Risk | Acceptance |
|---|---|---|---|---|
| **0. Return paths and one "current episode"** (FIX) | Add `from` to the Overview event links; Run Sheet and Evaluate return to their origin tab; Teleprompter gets a back link; one shared current-episode rule, per show. | — | Low; link-only changes. | From every tool opened on E1, one click returns to the tab it was opened from. Home, Shows and Producer Mode name the same episode. |
| **1. Studio Home** (REORGANIZE) | Reorder `Home.jsx` per D; reuse Now-producing and attention; show-scoped episode fetch; real empty and failure states. | 0 | Medium; many Home tests pin the current layout. | ADMIN sees show, current episode, next action, next open slot and attention items without scrolling at 375px. Game cards still reachable. |
| **2. Episode Command Center** (ENHANCE) | Overview per E: seven-step bar, named next action, exists/missing/optional/blocked, Resume memory. | 0 | Medium; Overview already costs ~20 requests, so add no new reads. | Opening E1 shows its true stage and one named next action; Resume returns to the last tab used. |
| **3. Sidebar** (REORGANIZE) | Regroup per F; Current Episode pin; show-scoped aliases; hide admin-only rows from non-admins. | 0, 2 | Low to medium; sidebar tests pin rows. | Every production destination is one click from the sidebar; no row leads to a refusal; drawer works at 375px. |
| **4. Slot-aware planning** (FIX + ENHANCE) | Carry the slot from Roadmap → starter → package → Start; offer existing events on an open slot; Start places into the named slot. | 1 | Medium; touches the Start service and its lock ordering. Needs backend change but no new table. | Planning from slot N always produces the episode in slot N. No stray draft events from an abandoned start. |
| **5. Enforcement and lifecycle** (FIX) | Server-side parity for Start gates; close or guard the blank-episode API; episode-number uniqueness; decide what `status` means next to `evaluation_status`. | Your rulings; draft PR #3840 | Higher; changes behaviour and needs a migration for the index. | The side doors cannot bypass what the package enforces; one lifecycle is authoritative. |
| **6. Consolidation** (REORGANIZE) | Section I. | 2, 5 | Low per item. | No orphaned episode route; one name per concept. |

Phases 0–3 need no schema change, no new endpoint and no AI call.

## Decisions for you

1. **What should `status` mean?** Either derive the stage from what exists (script, footage, completion) or keep it hand-set. Recommendation: derive it, and keep the hand-set dropdown only for scheduled / published.
2. **Should Start Episode be blocked server-side by the same eight gates as the package?** Recommendation: yes for organizer, name, date and venue; leave the rest as warnings.
3. **Where should a show row in the sidebar open?** Recommendation: the Season page, with Producer Mode's tools reached through the STUDIO group.
4. **Should the game-facing cards stay on Studio Home (collapsed) or move to the LalaVerse hub?** Recommendation: collapsed at the bottom of Home first; move later if unused.

## Not verified

- Nothing was exercised in a browser; behaviour is read from source.
- Whether the server dedupes repeated calendar auto-spawn or opportunity scheduling.
- Whether a read endpoint exposes carry-forward to the episode page.
- Whether the voice-footage worker is deployed and running.
- Whether completion has an undo path.
- Draft PR #3840's contents.
- Backend authorization in general was out of scope beyond the creation routes.
