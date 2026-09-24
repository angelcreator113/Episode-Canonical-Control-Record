# What Would Be Lost If the Old Event Editor Went: a read, not a ruling

## Status of this document

**Read-only research, not a decision.** It is not filed under `docs/audit/` and rules on
nothing. Evoni has decided the old event editor goes. This document lists, field by field and
action by action, what it still does that nothing else does, so that nothing is lost when it
goes. Nothing here changes code, removes anything, queries a database or contacts a host.

Basis: `origin/main` at `b4624e92db1dc1a085d569954dc8379e2468dda0` (2026-09-24). Code is cited by
stable name (component, function, route, UI label), per `CLAUDE.md`'s living-doc rule. A line
number is added only where a name alone is ambiguous, and it will drift.

This re-derives `docs/EVENT_EDITOR_READ.md` (basis `abd12b28`, 2026-09-23, PR #1746). §1 below
says which of its findings still hold. Prior art cited, not restated:
- `docs/EVENT_EPISODE_FLOW.md`: §8(p) on organizers, and §4 on the status census.
- `docs/GUEST_OWNERSHIP_READ.md`.
- `docs/WARDROBE_OWNERSHIP_READ.md`.
- `docs/EVENT_TAXONOMY_PLAN.md`.

**What "the old editor" means here.** "The old editor" is the two editors in
`frontend/src/pages/WorldAdmin.jsx`, which save differently:

- **The Edit details modal** (`eventDetailModal`, rendered as `md`). Each field saves on blur
  through `updateField`. It also has footer actions: 💾 Save, Mark Ready, Decline Invite,
  Complete Episode and Delete.
- **The event form** (`editingEvent` / `eventForm`). Its `saveEvent` POSTs when
  `editingEvent === 'new'` and PUTs otherwise. **It is still how events get created by hand**,
  so if the form goes, event creation needs a new home.

The rest of WorldAdmin's Events tab stays in scope only where it opens one of the two editors:
- the queue cards and their "⋯" menu,
- the header menu,
- the warnings, drafts and ideas sections.

A shared tool that lives outside both editors, such as the outfit picker portal or the card
menu's `InvitationButton`, is marked "also on the card menu". It is not lost with the editor
unless the card menu goes too.

---

## 0. Short answers

- **How much work is removal?** It is a project, not one more task. §6 lists **22 things the
  old editor does that nothing else in the app does** and that would need a new home first.
  - Eight are **editor-only fields**. The Package has no input for them:
    - `event_type`
    - `dress_code_keywords`
    - `location_hint`
    - the invitation-style set
    - the narrative texts
    - `is_paid` and `payment_amount`
    - `required_ui_overlays`
    - the form-only planning fields
  - Fourteen are **editor-only actions or lifecycle steps**. The heaviest are:
    - **Complete Episode**: the only UI caller of `POST .../episodes/:episodeId/complete`.
    - **Decline Invite**: the only writer of `status: 'declined'`, with its bookkeeping.
    - **Mark Ready**: with its social-checklist and venue generation.
    - The **wardrobe and social overlay approval panels**.
    - **Event creation by hand**.

  Another **seven groups of items can be retired without building anything**, because they are
  already dead, broken or harmful (§6.C).
- **The Package now does much more than the earlier read found.** Since `abd12b28` it has
  gained:
  - Basics: date, time, description and dress code (Task #1755).
  - Organizer: creator or brand (Task #1761).
  - Stakes: prestige, strictness, deadline type and career tier (Task #1771).
  - Readiness by section, with gates and warnings (Task #1775).

  About a third of the earlier read's "old editor only" rows are now "both" (§1, §2).
- **Hazards (§5):** all four named hazards still hold in the client. The server-side fixes
  since then narrow them but close none:
  - The `canon_consequences` merge (PR #1749) protects only keys a save leaves out. The
    modal's 💾 Save sends every key, so a stale copy still overwrites guest work and the
    invitation text.
  - "A sponsor is not an organizer" (PR #1766) changed only `POST .../from-profile`.
  - "Stop saving derived event values at creation" (PR #1758) makes the modal's invented time
    and dress code *more* likely to be saved. More rows now arrive with those columns empty
    for the modal to fill.
- **A gap removal would not close, but the sequence must know about:** Start Episode is gated
  on `category` and `format` (`READINESS_ITEMS` `identity.category` / `identity.format`). No
  one can set either through the old editor or the Package after creation. `format` is written
  only by `QuickEpisodeCreator`. `category` is written only by the Ideas template button and
  `QuickEpisodeCreator`. That is a Package gap, not an editor loss. It is listed in §6.B
  because nothing about removing the editor fixes it.

---

## 1. The earlier read, re-derived

Each numbered finding of `docs/EVENT_EDITOR_READ.md` is checked again at `b4624e9`.

| # | Earlier finding (at `abd12b28`) | Now | Why |
|---|---|---|---|
| 1 | "The old editor" is two editors: the modal and the form | **Holds** | Unchanged. The form's edit mode is still reachable only through a story-logic warning's "✏️ Edit" (`openEditEvent`). |
| 2 | The Event Package writes through five actions (`selectHost`, `saveGuestProfiles`, `saveEventName`, `chooseVenue`, `chooseSceneSet`) | **Superseded** | Now nine write paths: `saveBasicsField`, `saveStakes`, `saveOrganizer` (which replaced `selectHost`), `saveGuestProfiles`, `saveEventName`, `chooseVenue` (plus `createLocation`), `chooseSceneSet` (plus `createSceneSet`), `InvitationButton` and `handleStartEpisode`. |
| 3 | `event_date`, `event_time`, `description`, `dress_code` are old-editor only | **Superseded** | Now **both**, through the Package's Basics (`BASICS_FIELDS`, `saveBasicsField`). |
| 4 | `host_brand` is old-editor only | **Superseded** | Now **both**. The Package writes it through Change Organizer → Brand (`buildBrandOrganizerUpdate`). Only *free text typed as a sponsor* is editor-only, and that is the hazard in §5.4. |
| 5 | `prestige`, `strictness`, `deadline_type`, `career_tier` are old-editor only | **Superseded** | Now **both**, through Edit stakes (`EDITABLE_STAKES`, `buildStakesUpdate`). `cost_coins` is still editor-only, and **deliberately** read-only in the Package (`COST_READ_ONLY_REASON`). |
| 6 | Free-text `host` is old-editor only | **Holds, narrowed** | The Package writes `host` only as the chosen creator's name (`buildCreatorOrganizerUpdate`), or clears it when it mirrors a creator the brand replaces. |
| 7 | `category`/`format`: nobody can edit them after creation | **Holds, and now matters more** | Both are now Start Episode **gates** (`READINESS_ITEMS`). See §0. |
| 8 | The create form's POST throws away venue, date, time and invitation style | **Partly superseded** | POST now stores `event_date` (or a 45-day auto date, `withAutoScheduledDate`) and `event_time` (Task #1755). It still drops `venue_location_id` (used only for a lookup), `venue_name`, `venue_address`, `theme`, `mood`, `color_palette`, `floral_style`, `border_style`, `guest_list`, `invitation_details`, `outfit_*` and `source_profile_id`. |
| 9 | The modal makes up date, time, dress code, cost, strictness and deadline at render | **Holds** | The hydration block (comment "Hydrate missing fields from automation data + derive from context") is unchanged, including today + 14 for the date. |
| 10 | Readiness counts none of the made-up fields | **Superseded** | Readiness now counts date, time and dress code (`identity.date`, `identity.time`, `look.dress_code`). It still reads the stored row, so a made-up value never turns a chip green *until the modal saves it*. After that it counts as **set**. See §5.1. |
| 11 | Mark Ready's required-field check tests `md`, so Date and Dress Code can never be missing | **Holds** | Unchanged. It also demands Host, which a brand-organized event may rightly lack (§5.4). |
| 12 | AI Enhance saves up to 12 fields with no review, replacing longer description and narrative text | **Holds** | Unchanged. Now read as the organizer hazard, §5.3. |
| 13 | Bulk Enhance saves every key the AI returns that is empty on the list row | **Holds** | Unchanged (`handleBulkEnhance`). |
| 14 | The PUT replaces `canon_consequences` wholesale | **Superseded** | Since PR #1749 (`mergeCanonConsequences`, `src/utils/canonConsequencesMerge.js`) the PUT merges two levels deep under `SELECT … FOR UPDATE`. A key sent as `null` is deleted, a key left out is kept, and a key sent **wins whole**. Arrays such as `automation.guest_profiles` are replaced, not merged. `canon_consequences: null` still wipes the whole column. |
| 15 | 💾 Save overwrites the Package's guest work (scenario B) and a fresh invitation text (scenario A) | **Holds** | 💾 Save still sends the *entire* object (`toSave.canon_consequences = { ...md.canon_consequences, automation: updatedAuto }`). Under the merge, every key it sends wins. See §5.2. |
| 16 | P5/P6 (the form's edit save and `applyAiFix`) send the whole list row, including `outfit_pieces` | **Holds** | `outfit_pieces` is still in `allowedFields` but not in `jsonFields`. Re-run locally with Sequelize 6.37.8 (below): `[]` gives malformed SQL, a list of pieces throws, and `NULL` goes through. |
| 17 | `is_free` is not a column. The modal's lone `{ is_free }` PUT gets a 400 | **Holds** | No migration adds it, and it is not in `allowedFields`. The PUT returns 400 "No valid fields to update". |
| 18 | The single-event GET comment about the list is stale | **Holds** | Not re-checked in detail; not relevant to removal. |

Re-run of finding 16 (local library only, no database):

```
$ NODE_PATH=$PWD/node_modules node -e "…injectReplacements(… outfit_pieces …)"
null => UPDATE world_events SET outfit_pieces = NULL, parent_event_id = NULL WHERE id = 'e1'
[] => UPDATE world_events SET outfit_pieces = , parent_event_id = NULL WHERE id = 'e1'
[{"id":"w1","name":"Silk Slip"}] => THROWS: Invalid value { id: 'w1', name: 'Silk Slip' }
EXIT: 0
```

---

## 2. Every field, and who can set it

**Key to the table:**
- **Form** is the event form. **Modal** is the Edit details modal. **Package** is
  `EventPackagePage`.
- The **Mark** column is one of three values:
  - **both**: the Package can set the field too.
  - **editor-only**: only the old editor can set it.
  - **Package-only**: only the Package can set it.
- "Shown" means the Package displays the field but cannot change it. A shown field is still
  **editor-only** for writing.

| Field | Form | Modal | Package | Mark |
|---|---|---|---|---|
| `name` | Event Name * | header input | Suggest names / type your own (`saveEventName`) | both |
| `event_type` | Type select | header icon select | not shown | **editor-only** |
| `category` | no | no | shown (Basics), not editable | neither editor. Set at creation only (Ideas template, `QuickEpisodeCreator`) |
| `format` | no | no | shown (Basics), not editable | neither editor. `QuickEpisodeCreator` only |
| `description` | Description | Description | Basics → Description | both |
| `event_date` | free-text date input | date input | Basics → Date (clears `automation.event_date_auto`) | both |
| `event_time` | free-text time input | time input | Basics → Time | both |
| `dress_code` | Dress Code | Dress Code | Basics → Dress code | both |
| `dress_code_keywords` | keyword chips | Dress Code Keywords | not shown | **editor-only** |
| `host` (free text) | "Host (who's hosting)" | Host | only as the chosen creator's name | **editor-only** (free text) |
| `source_profile_id` | badge only ("🌐 FROM FEED") | no | Change Organizer → Creator | **Package-only** |
| `host_brand` | **"Brand Sponsor (optional)"** | **Brand** | Change Organizer → Brand (listed brand or typed name) | both, but the editor labels it a sponsor (§5.4) |
| automation host copies (`host_profile_id`, `host_handle`, `host_display_name`, `automation.host_brand`) | no | 💾 Save copies `host`/`host_brand` into `automation` | organizer builders keep both homes in step | Package writes them on purpose; the modal writes stale copies (§5.2) |
| `canon_consequences.automation.guest_profiles` (featured, story role, added guests) | no | read-only chips | Featured Attendees, story role, Add from Feed | **Package-only** (but the modal can overwrite it, §5.2) |
| `venue_location_id` | World Location select (any location) | no | Choose venue (`chooseVenue`), or create a location | both. The Package's version is the only one that fits Evoni's #1674 amendment |
| `venue_name`, `venue_address` (typed, no location) | inputs | inputs | only as a side effect of a location | **editor-only** (typed). Readiness now calls a typed name "Needs location link" |
| `location_hint` | Location Hint | Location Hint | not shown | **editor-only** |
| `scene_set_id` | Scene Set select (any EVENT_LOCATION set, or any set with a still) | pick from any show scene set; Clear; ✕ Remove; Generate Venue Images | Choose scene set, limited to the venue's location; + Create Scene Set | both. The editor is not limited to the venue |
| `prestige`, `strictness` | numbers | numbers | Edit stakes | both |
| `deadline_type` | select | select | Edit stakes | both |
| `deadline_minutes` | Deadline minutes | no | no | **editor-only** (form only) |
| `career_tier` | Career Tier | Career Tier | Edit stakes | both |
| `cost_coins` | Cost (coins) | Cost 🪙 | read-only, by ruling (`COST_READ_ONLY_REASON`) | **editor-only** |
| `is_paid` | Event Cost Type | Payment select | shown in Money summary | **editor-only** |
| `payment_amount` | Payment (if paid) | Payment Amount | shown in Money summary | **editor-only** |
| `is_free` | Event Cost Type "free" | Payment "Free entry" | no | not a column. Only `cost_coins: 0` sticks |
| `narrative_stakes` | Narrative Stakes | Narrative Stakes | shown (Stakes summary) | **editor-only** |
| `career_milestone`, `success_unlock` | inputs | inputs | shown (Career opportunity) | **editor-only** |
| `fail_consequence` | On Fail | Fail Consequence | shown (Relationship stakes) | **editor-only** |
| `browse_pool_bias`, `browse_pool_size` | inputs | no | no | **editor-only** (form only) |
| `theme`, `mood`, `color_palette`, `floral_style`, `border_style` | `InvitationStyleFields` (POST drops them on create) | `InvitationStyleFields` → `updateMultipleFields` | no | **editor-only** (modal is the only working writer) |
| `parent_event_id`, `chain_position`, `chain_reason`, `seeds_future_events` | 🔗 Narrative Chain | no | no | **editor-only** (form only) |
| `rewards` | 🏆 Rewards & Requirements | no | no | **editor-only** (form only) |
| `requirements` | 🏆 Rewards & Requirements | no | shown (Style & Deliverables) | **editor-only** (form only) |
| `required_ui_overlays` | overlay chips plus auto-suggest | Episode Overlays toggles (`PUT .../overlay-selections`) | no | **editor-only** |
| `outfit_pieces` / `outfit_score` | no | Pick Outfit → outfit picker (`PUT .../outfit`) | shown ("N pieces chosen") | **editor-only**. Also on the card menu "👗 Outfit" |
| `outfit_set_id` | no | no | no | nobody. Allowlisted, never set |
| invitation asset and text | no | `InvitationButton` | `InvitationButton mode="inline"` | both. Also on the card menu |
| `status` → `ready` | no | Mark Ready | no | **editor-only** as a lifecycle step. The card menu's "Change status…" can set `draft`/`ready` as a bare PUT |
| `status` → `declined` | no | Decline Invite (`POST .../decline`) | no | **editor-only** |
| `status` → `filmed` (with evaluation) | no | 👑 Complete Episode | no | **editor-only** |
| `used_in_episode_id` | via gap "+ Create" (injects) | Link to Episode grid (`injectEvent`) | Start Episode (`generate-episode`) | both, differently: the editor links to an *existing* episode, the Package creates one |
| `automation.social_tasks`, `social_checklist_*` | no | Mark Ready; Social Tasks regenerate; social `OverlayApprovalPanel` | no | **editor-only** |
| `automation.wardrobe_tasks`, `wardrobe_overlay_*` | no | wardrobe `OverlayApprovalPanel` | no | **editor-only** |
| `automation.event_date_auto` | no | no (left behind, see §5.1) | removed on any date save | **Package-only** |

**Count:** 24 field rows are editor-only for writing. 13 are both. Three are Package-only
(`source_profile_id`, guest profiles, `event_date_auto`).

---

## 3. Every action, what it does, and what would be lost

### 3.A The Edit details modal

| Action | What it does | Package equivalent | Lost if removed |
|---|---|---|---|
| Field edits (`updateField` on blur; `updateMultipleFields` for invitation style) | PUT one field, or only the changed invitation-style keys | Only for the "both" fields in §2 | Every editor-only field in §2 that the modal carries |
| **💾 Save** | PUTs every non-null key in its `saveable` list, plus the **whole** `canon_consequences` with 18 hydrated fields copied into `automation`. On failure, a second PUT sends `canon_consequences`, `name`, `host`, `description`, `prestige`, `status` | None needed: the Package saves each field as it goes | Nothing of value; this is the §5.2 hazard. Retire, do not migrate |
| **Mark Ready** | Checks Host, Venue Name, Event Date, Dress Code and Description *on the hydrated copy*. Confirms, then PUTs `status: 'ready'` plus 12 hydrated columns. Then `POST .../generate-social-checklist`, then `POST .../generate-venue` if there is no scene set and no location | None. Readiness (`computeEventPackageReadiness`) is computed and never written; Start Episode does not need `ready` | (a) the `ready` status as a step Evoni takes; (b) **auto-generating the social checklist**; (c) **auto-generating venue images and a scene set**. (b) and (c) have no other trigger. |
| **✨ AI Enhance** | Asks `ai-fix` to fill 12 fields. Fills the empty ones, replaces description and narrative stakes when the AI's text is longer, invents a host if none. Saves at once with no review | None. Package suggestions (Basics) are shown, never saved until accepted | An AI fill for the narrative fields (§6.A). Its save-without-review behaviour and brand writes are §5.3 and should not be carried over as they are |
| **Delete** | `window.confirm`, then `DELETE .../events/:eventId` (soft delete) | None in the Package | Deleting an event from its own page. **Also on the card menu "Delete"**, so not lost unless the card menu goes |
| **Decline Invite** (only when `status === 'ready'`) | Prompts for a reason; `POST .../decline` → `financialPressureService.recordDeclinedInvite` | None | **The only writer of `declined` with its bookkeeping.** The card menu's status override deliberately excludes `declined` (`STATUS_OVERRIDE_OPTIONS`) |
| **👑 Complete Episode** (linked, not draft) | `POST /world/:showId/episodes/:episodeId/complete` → `episodeCompletionService.completeEpisode`: evaluation, stat deltas, social-task bonuses, `finalizeEpisodeFinancials`, event → `filmed` | None | **The only UI caller of the completion route.** `completeEpisode` is also reached from `src/routes/evaluation.js`, and `EpisodeDetail` documents an evaluate/accept path, but no other button calls this route. `StudioTab`'s "Complete your first episode" step sends Evoni to `world?tab=events` for it |
| **Finalize Financials** (linked) | `POST .../episodes/:episodeId/finalize-financials` | None | The only UI caller. `completeEpisode` also finalizes, so this is a standalone re-run |
| **Financial Preview** (read) | `GET .../financial-forecast`: outfit cost, extras, income, next-goal bar | Money summary is words only | **The only UI reader of the forecast route** |
| **Link to Episode** grid | `injectEvent` → `POST .../inject` for any existing episode | Start Episode creates a new episode instead | Linking an event to an episode that **already exists**. Also reachable from the story-logic fixes (swap, AI reassign) and `SeasonTab.applyReorderPlan`, but not per event |
| **Pick Outfit** (Episode Overlays header) | Opens the outfit picker portal (`GET .../wardrobe-options`, `GET/PUT .../outfit`) | Shows the piece count only | Nothing, **if the card menu's "👗 Outfit" stays**. Otherwise the only outfit writer |
| **Episode Overlays toggles** | `PUT .../overlay-selections` → `required_ui_overlays` | None | Choosing which overlays the generator places |
| **🎬 Generate Episode Title** | `POST .../episodes/:episodeId/generate-title-overlay` | None | **The only UI caller** |
| **+ custom overlay type** | `POST /api/v1/ui-overlays/:showId/types` | None here (the Assets → UI Overlays tab has its own) | Nothing unique, provided UI Overlays can still create a type |
| **Wardrobe shopping-list overlay** (`OverlayApprovalPanel overlayType="wardrobe"`) | `generate-overlay`, `approve-overlay`, `reject-overlay`, `re-render-overlay`, `overlay-tasks`, `overlay-history` | None | **The only UI for the whole overlay approval flow** (six routes) |
| **Social tasks overlay** (`OverlayApprovalPanel overlayType="social"` plus regenerate) | Same six routes, plus `POST .../generate-social-checklist { force: true }` | None | Same |
| **Generate Venue Images** (two buttons) | `POST .../generate-venue` → `venueGenerationService.generateVenueImages`: scene set, angles, `scene_set_id` | "+ Create Scene Set" makes an *empty* named set; it generates no images | **AI venue image generation for an event** |
| **🎬 Video** (on a linked scene still) | `POST /api/v1/scene-sets/:id/angles/:angleId/generate-video` | None here | Nothing unique if the Scene Sets tab offers angle video (not re-checked here) |
| Scene set pick, Clear, ✕ Remove | `updateField('scene_set_id', …)`; can pick any show scene set | Choose scene set, limited to the venue's location | Picking a scene set **from another location**, and **unlinking** a scene set. The Package can change a set but has no Clear |
| Invitation (`InvitationButton`) | Generate, approve, reject, edit text, history | Same component, inline | Nothing |
| Invite Preview (`EventInvitePreview`) | Phone mock-up of the invite, **using the made-up values** | Invitation section shows the real asset | Nothing of value |
| Difficulty display, guest chips | Read-only | Stakes (projected difficulty); People | Nothing |

### 3.B The event form

| Action | What it does | Package equivalent | Lost if removed |
|---|---|---|---|
| **✨ Create** (`saveEvent`, new) | `POST .../events` with the whole form. If the form came from an AI gap suggestion, also `POST .../inject` to that episode (`__pendingEpisodeLink`) | None. The Package opens on an existing event | **Creating an event without a host, from a template, as a copy, or from an AI gap suggestion** (see §4). "+ New Event" already goes to `/new-episode` (choose host) |
| **💾 Save** (`saveEvent`, edit) | `PUT` with `{ ...EMPTY_EVENT, ...listRow }`, the full-row spread | Package saves per field | Nothing of value; this is hazard P5 (§5.2) |
| **✨ AI Revise** (`handleAiRevise`) | When the name looks like other events, asks `ai-fix` for a distinct version and fills the form. **Reviewed**: nothing saves until Create/Save | None | The duplicate-name warning and an AI rewrite of a near-duplicate |
| Overlay auto-suggest (`autoSuggest`) | Builds `required_ui_overlays` from prestige, milestone and type | None | Same as Episode Overlays (§6.A) |
| Cancel | Closes | n/a | Nothing |

### 3.C Actions around the editors on the Events tab that feed the form

These live on the Events tab, not in either editor. Each one opens the form, so each dies with
it unless it is rehomed.

| Action | What it does | Lost if the form goes |
|---|---|---|
| Header ⋯ → 📋 Templates (`EVENT_TEMPLATES`, six presets) | Prefills the form | Template-based creation |
| Card ⋯ → Duplicate as New Event (`copyEvent`) | Prefills the form from a row, with name "(Copy)" | Copying an event |
| Story-logic "✨ AI Create" (`handleAiGenerateForGap`) → suggestion "+ Create" | Prefills the form and links it to the gap episode | Filling an episode gap with a new event |
| Story-logic "✏️ Edit" (`openEditEvent`) | Opens the form in edit mode | Nothing of value (hazard P5) |
| AI Fix / Rebalance → "Apply" (`applyAiFix`) | PUTs `{ ...ev, ...updates }`, the full-row spread (hazard P6); or injects | Not tied to the form, but shares its hazard. Needs a narrow PUT whatever happens to the editor |
| ⋯ → ✨ Enhance (`handleBulkEnhance`) | Up to 10 events, AI, saved without review | Not tied to either editor; same hazard class as AI Enhance |

---

## 4. Every entry point into either editor

### Into the Edit details modal (`setEventDetailModal`)

1. **Event Package → "Edit details"** (`EventPackagePage`, `openEditor`). Navigates to
   `/shows/:showId/world?tab=events&event=<id>`. WorldAdmin's deep-link effect opens the modal
   once `worldEvents` has loaded, then strips `event`. It is hidden once the event is used.
   This is the only remaining user of the `event=` deep link (`SocialProfileGenerator` and
   New Episode now land on the Package).
2. **Events card ⋯ → "Edit details"** (WorldAdmin Events queue card menu).
3. **Draft Events section → click a draft row** (the collapsed "Draft Events (N)" section
   below the queue, "Completion % — complete details and mark ready").
4. **Ideas → template card → "Edit Event Details"**, shown after "Create This Event" or when
   an event from that template exists.
5. **Episode → Event Map → click the event** (the coverage map below the queue).

Escape and the backdrop close it. Nothing outside WorldAdmin opens the modal except (1).

### Into the event form (`setEditingEvent`)

6. **Empty state → "+ Create Manually"** (`openNewEvent`). Shown only when a show has no
   events at all.
7. **Header ⋯ → 📋 Templates → a template** (the `showTemplates` panel).
8. **Card ⋯ → "Duplicate as New Event"** (`copyEvent`).
9. **Story-logic warnings → "✨ AI Create" → suggestion "+ Create"** (new, with a pending
   episode link).
10. **Story-logic warnings → "✏️ Edit"** (`openEditEvent`). This is the only edit-mode entry.

### Links that land on the Events tab for something the editor or its tab does

These do not open an editor. They send Evoni to `world?tab=events` for a job that today is
finished in the modal or on the card menu. Each needs re-pointing when the editor goes:

- `StudioTab`: "Complete your first episode" (Complete Episode is in the modal); "Generate an
  episode from an event"; "Create events in Producer Mode".
- `EpisodeProductionChecklist`: "Add venue", "Pick outfit", "Events".
- `EpisodeAssetsTab`: "Generate", "Event Panel", "Pick Outfit".
- `EpisodeWardrobeTab`, `EpisodeOverviewTab`, `ShowAssetsTab` (Invitations), `ProductionTab`
  (Events Library), `StoriesPage`, `ShowDetail`: generic "Events" links.

---

## 5. The known hazards, re-derived

Each hazard is checked in the **client** (what the editor sends) and at the **route** (what
`PUT` or `POST /world/:showId/events…` accepts), separately.

### 5.1 Values made up at render, then saved

- **Client: holds.**
  - The modal's hydration still invents values:
    - **date:** today + 14;
    - **time:** chosen from prestige;
    - **dress code:** from `automation.content_category`, else `'chic'`;
    - **cost, strictness and deadline:** from prestige when null.
  - Mark Ready and 💾 Save still write them. 💾 Save also writes them into `automation`.
  - Mark Ready's required-field check still runs on the invented copy.
- **Route: holds.** The PUT writes whatever it is sent; nothing marks a value as derived.
- **What changed around it:**
  - **Date.** Creation now stores a date on most new rows: `POST .../events`, `bulk-seed`, `from-profile`, the calendar
    spawn route, `eventGeneratorRoute` and `careerPipelineService` write a 45-day date through
    `withAutoScheduledDate` or `autoScheduledEventDate`, with `automation.event_date_auto`. So the
    today + 14 date now fires mainly on older rows and raw-insert paths. When it does fire,
    💾 Save and Mark Ready leave `event_date_auto` behind. The Package then shows the saved
    date as **set** and no longer "Auto-scheduled", because the two values differ.
  - **Time and dress code.** PR #1758 stopped the creation paths deriving `event_time` and
    `dress_code`. More rows now arrive with them empty, so **the modal invents them more
    often**. The Package's Basics rule is that a suggestion is never saved until Evoni accepts
    it (Task #1755). A modal 💾 Save or Mark Ready breaks that rule silently: an invented
    `'chic'` or `19:00` becomes a **set** value and satisfies the `look.dress_code` and
    `identity.time` readiness items.

### 5.2 Save and Mark Ready re-sending a whole stale copy

- **Client: holds.**
  - **💾 Save** sends:
    - every non-null key in its list, including `name`, `host`, `host_brand`, `venue_name`,
      `venue_address`, `scene_set_id` when non-null, `event_date` and `event_time`;
    - the whole `canon_consequences`: every top-level key of the modal's copy, and every
      `automation` key with 18 hydrated fields laid over them.
  - **Mark Ready** sends 12 hydrated columns, not `canon_consequences`.
  - **The form's edit Save (P5)** and **`applyAiFix` (P6)** still spread the whole list row.
- **Route: narrowed, not closed.** `mergeCanonConsequences` protects only keys a save
  *leaves out*. 💾 Save leaves nothing out, so with a stale copy it still overwrites:
  - **`automation.guest_profiles`**: the Package's featured flags, story roles and
    feed-added guests. The array is replaced whole. This is scenario B of the earlier read,
    and it still holds.
  - **`invitation_text`**: scenario A still holds. In one tab, generate an invitation from the
    modal and then click 💾 Save. The modal's `onGenerated` patches only
    `invitation_url`/`invitation_asset_id` into its copy, so Save sends the old
    `invitation_text` back.
  - **The organizer.** This is new since the earlier read. Suppose the Package's Change
    Organizer picks a creator, which sends `host_brand: null` and deletes
    `automation.host_brand`. A stale modal then 💾 Saves. It sends the old `host_brand` back
    into the column *and* into `automation`. The brand always wins
    (`resolveEventOrganizer`), so **the organizer silently reverts to the brand**. The
    reverse, a brand choice undone by a stale `host`, is milder. The brand still wins, but
    `host` and `source_profile_id` then disagree.
  - `venue_name`/`venue_address`, `name` and `scene_set_id` go back to the stale values, as
    before.

  A fresh copy (one tab, having just come from the Package) loses nothing of the Package's
  work, as the earlier read found. It still writes the §5.1 invented values.
- **P5 and P6 at the route: holds.** `outfit_pieces` is still not in `jsonFields`. A row with
  `[]` or picked pieces fails the whole save (§1, finding 16). A row with `NULL` succeeds, and
  P5 then also blanks `theme`/`mood`/`floral_style`/`border_style` and sets `color_palette`
  to `[]`.
- **The Package's own guest save** (`saveGuestProfiles`) still sends the full
  `canon_consequences` too. Its copy is fresh from its own `load`, so the risk is small.
  Its comment ("a plain JSONB column overwrite … not a JSONB merge") is **stale** since
  PR #1749.

### 5.3 AI Enhance writing a sponsor or an invented brand as organizer

- **Client: holds.**
  - **Modal ✨ AI Enhance:**
    - lists `host_brand` among the fields to fill when it is empty;
    - puts `Brand:` and `host_brand=` in the prompt and asks for "ALL fields listed above";
    - saves the answer at once (`saveable` includes `host_brand`);
    - with no host, falls back to `` `${host_brand} Events` ``, which writes a brand into
      `host`.

    §8(p) ruling 2 makes the brand the organizer, so an AI-invented brand becomes the
    organizer with no review.
  - **Bulk ✨ Enhance** saves any key the AI returns that is empty on the row. Its prompt
    asks for `host` but not `host_brand`, though nothing stops the model returning one.
  - **The form's AI Revise** asks for `host` and `host_brand`, but the result is reviewed
    before saving.
- **Route: holds.**
  - `POST .../events/ai-fix` writes nothing and returns what the model says.
  - The PUT accepts `host_brand` (and `automation.host_brand`) from any client.
  - PR #1766 changed only `POST .../from-profile`, which no longer puts a sponsor in
    `host_brand`. PR #1774 fixed the calendar spawn path.
  - Other server writers still copy a brand into `host_brand` unexamined: `calendarRoutes`
    spawn-world-event (`req.body.host_brand`), `feedEventPipelineService` and
    `careerPipelineService` (`opp.brand_or_company`), and `eventGeneratorRoute` (AI). These
    are outside the editor. They are listed so removal is not mistaken for a fix.
- **Aside, not an editor loss:** `ai-fix` has no `aiRateLimiter`, which `CLAUDE.md` requires
  for AI handlers.

### 5.4 The create form's "Brand Sponsor (optional)" field writing the organizer

- **Client: holds.**
  - The form's field is still labelled "Brand Sponsor (optional)", with placeholder "Velour,
    Chanel (leave empty if none)", and is still bound to `host_brand`.
  - The modal's "Brand" input writes the same column.
  - A sponsor typed there becomes the organizer, and **outranks a host typed beside it**.
  - Mark Ready adds a knock-on. It demands a Host even when a brand organizes the event,
    which §8(p) ruling 2 says is complete. The toast then says "use AI Enhance first", and
    AI Enhance invents `` `${brand} Events` `` as host.
- **Route: holds.** `POST .../events` stores `host_brand` as sent, and so does the PUT.

---

## 6. What would need building before removal

### 6.A Things the old editor does that nothing else does

Each needs a home, in the Package or elsewhere, or an explicit "retire it" from Evoni, before
removal. The order follows §2 and §3, not priority.

**Fields with no other writer**
1. **`event_type`**. Every event has one; the story-logic warnings and the AI prompts read it.
2. **`dress_code_keywords`**. Read by the wardrobe-conflict check and the AI prompts.
3. **`location_hint`**. Also written by creation from the venue address.
4. **Invitation style**: `theme`, `mood`, `color_palette`, `floral_style`, `border_style`.
   `InvitationStyleFields` can be reused. POST drops them, so the modal is the only working
   writer.
5. **Narrative texts**: `narrative_stakes`, `career_milestone`, `success_unlock`,
   `fail_consequence`. The Package *shows* them, and `stakes.story_stakes` is a readiness
   warning the Package cannot clear.
6. **Money**: `is_paid` and `payment_amount`, plus `cost_coins` if Evoni wants cost editable
   anywhere. The Package holds cost read-only by ruling, so removing the editor removes the
   last cost input. `stakes.money` is a readiness warning the Package cannot clear.
7. **`required_ui_overlays`**: the Episode Overlays toggles (`PUT .../overlay-selections`) or
   the form's chips and auto-suggest. It decides which overlays the episode generator places.
8. **Form-only planning fields**: `deadline_minutes`; `browse_pool_bias` and
   `browse_pool_size`; `rewards` and `requirements` (the next-event suggester reads
   `requirements`); the narrative chain (`parent_event_id`, `chain_position`, `chain_reason`,
   `seeds_future_events`), which the next-event suggester scores on.

**Actions and lifecycle steps with no other caller**
9. **Event creation by hand.** This covers no-host creation, 📋 Templates, Duplicate as New
   Event, and the AI gap "+ Create" with its episode link. "+ New Event" (choose host) and the
   Ideas "Create This Event" button do not cover these.
10. **Decline Invite** (`POST .../decline`, `recordDeclinedInvite`). The only way to decline
    with bookkeeping.
11. **👑 Complete Episode** (`POST .../episodes/:episodeId/complete`). The only UI caller.
    Needs a home on the episode side or the Package's used state before removal. This is the
    single heaviest loss.
12. **Finalize Financials** (`POST .../finalize-financials`) and the **Financial Preview**
    (`GET .../financial-forecast`). The only UI for both.
13. **Mark Ready's side effects**: the social checklist (`generate-social-checklist`) and the
    auto venue generation. The `ready` status itself may not be needed, because readiness is
    computed. Evoni's call.
14. **Social tasks overlay**: `OverlayApprovalPanel overlayType="social"` plus Regenerate.
15. **Wardrobe shopping-list overlay**: `OverlayApprovalPanel overlayType="wardrobe"`. Items
    14 and 15 are the only UI for six overlay routes (`generate-overlay`, `approve-overlay`,
    `reject-overlay`, `re-render-overlay`, `overlay-tasks`, `overlay-history`).
16. **🎬 Generate Episode Title** (`generate-title-overlay`). The only UI caller.
17. **Generate Venue Images** (`generate-venue`). The Package's "+ Create Scene Set" makes an
    empty set.
18. **Link to an existing episode** (`injectEvent` for one event). The Package only creates a
    new episode.
19. **Scene set: unlink, and pick from another location.** The Package can change a set but
    not clear one, and it limits choices to the venue's location. Keeping the limit may be
    intended (#1674 amendment). The missing Clear is not.
20. **Typed venue with no location.** The Package allows only a World Location. The venue
    gate now needs the link anyway, so this may be "retire, by ruling" rather than "build".
21. **Free-text `host`.** The Package sets `host` only from a chosen creator. Whether a
    free-text host survives is the open question the earlier read raised (§8(p)).
22. **AI fill for the narrative fields.** AI Enhance is the only AI writer for §6.A item 5. If
    it is kept, it needs the Package's suggestion model (show, accept, then save) and no brand
    or host writes (§5.3).

**Server routes that removal would leave with no caller.** From the route map at this basis
(`src/routes/worldEvents.js`), these are called only from the two editors or their modal
panels:
- `decline`
- `financial-forecast`
- `generate-venue`
- `generate-social-checklist`
- `overlay-selections`
- the six overlay-approval routes
- `generate-title-overlay`
- `episodes/:episodeId/complete`
- `finalize-financials`

These are also called from WorldAdmin, but outside the two editors. They stay live only while
the card menu, header menu and warnings stay:
- `outfit` (GET/PUT) and `wardrobe-options`: the card menu's "👗 Outfit".
- `DELETE .../events/:eventId`: the card menu, and merge duplicates.
- `ai-fix`: warnings, Bulk Enhance, AI Revise.
- `generate-script`: the Episodes tab "Generate Script from Event", and the card menu.
- `bulk-delete`: header menu "Delete Drafts" / "Delete All".

Each orphaned route needs a new caller, or a separate decision to retire it. Services behind
them that have no other caller: `recordDeclinedInvite`, `generateVenueImages` and
`generateSocialChecklist`. `completeEpisode` keeps a caller in `src/routes/evaluation.js`, and
`finalizeEpisodeFinancials` keeps one inside `completeEpisode`.

### 6.B Package gaps that removal does not cause, but that the sequence must account for

- **`category` and `format`** are Start Episode gates with no editor anywhere (§0).
- **`outfit_set_id`** is allowlisted and read by readiness, but nothing sets it.

### 6.C Retire without building: already dead, broken or harmful

- **💾 Save** (modal). Its only unique effect is the §5.2 overwrite and the §5.1 invented
  values.
- **The form's edit mode** (P5) and **`applyAiFix`'s full-row PUT** (P6). The latter lives
  outside the editor but needs a narrow body whatever happens.
- **`is_free` writes** (form, modal, AI Enhance `saveable`). There is no such column.
- **Bulk-select UI**: Compare, "🎬 Generate from N events" and bulk "Link to:". `bulkMode` is
  never set to `true` anywhere in WorldAdmin, so the bar never renders.
- **`seedEvents`** (`POST /memories/generate-events`), **`generateScript`** and
  **`handleExportCSV`**: defined, never called.
- **Goals tab "💉 Inject into Episode" / "📝 Generate Script"**: they set `injectTarget` /
  `generateTarget`, which nothing renders, so they only switch tabs.
- **Invite Preview** in the modal, which renders the invented values.

---

## 7. A proposed sequence (not a recommendation on whether)

Evoni has decided the editor goes. This is only the order that loses nothing on the way. Each
step is one task and removes a dependency the next step would otherwise hit.

**Step 1. Stop the harm while both surfaces exist (retire, small)**
- Remove the modal's 💾 Save, or make it send only changed columns and no
  `canon_consequences`.
- Remove the hydration's invented date, time, dress code, cost, strictness and deadline. Show
  "Not set" instead.
- Give `applyAiFix` a narrow body (only `updates`).
- Relabel "Brand Sponsor (optional)" and stop AI Enhance writing `host_brand`/`host`.

This closes §5.1 to §5.4 in the client before any migration, so every later step starts from
clean rows.

**Step 2. Identity gaps the gates need (build)**
- `category` and `format` inputs in the Package (§6.B).
- `event_type` and `dress_code_keywords` alongside them.

This comes first among the builds because Start Episode is blocked without the first two.

**Step 3. Story and money fields (build)**
- The narrative texts: `narrative_stakes`, `career_milestone`, `success_unlock`,
  `fail_consequence`.
- `is_paid` and `payment_amount`, plus a ruling on whether `cost_coins` stays editable
  anywhere.
- `location_hint`.

These clear the Package's own `stakes.*` warnings.

**Step 4. Invitation style and overlays (build, mostly reuse)**
- `InvitationStyleFields` in the Invitation section.
- The `required_ui_overlays` toggles.
- The wardrobe and social `OverlayApprovalPanel`s.
- Generate Episode Title.

All of these are existing components or routes that need a new caller.

**Step 5. Place and look leftovers (build, small)**
- Scene set Clear.
- Generate Venue Images.
- An outfit entry point in the Package (link to or extract the picker portal).
- Rulings on typed venues and on picking scene sets outside the venue's location.

**Step 6. Lifecycle (build, the heavy step)**
- Decline Invite.
- Complete Episode and Finalize Financials, with the Financial Preview.
- Link to an existing episode.
- A decision on whether `ready` survives as a status and what replaces Mark Ready's
  checklist and venue side effects.
- Re-point the §4 links that promise these jobs on the Events tab.

**Step 7. Creation (build)**
- A creation path for no-host events, templates, duplicates and the AI gap fill.
- Re-point entry points 6 to 9 in §4.

**Step 8. Remove the editors (remove)**
- Delete the modal and the form.
- Delete the Package's "Edit details" button and WorldAdmin's `event=` deep-link effect.
- Delete entry points 2 to 10.
- Delete the §6.C dead code.
- Retire or keep, by ruling, the routes left with no caller (§6.A).

Removing a narrative field's modal input before step 3 lands would be the "feature that
vanishes" case. Keep that ordering.

Some steps could merge or split:
- Steps 2 and 3 could be one task if the Package grows a general field dialog, as Basics
  already has.
- Step 6 could split in two: Complete Episode and Finalize, then Decline and linking.

At least **seven build tasks, one harm-reduction task and one removal task** are the minimum.

---

## 8. What this document does not do

- It does not change code, remove anything, or choose where any field or action moves.
- It does not recommend whether to remove the editor. Evoni has decided that. It proposes only
  an order.
- It does not query the database. Still unmeasured:
  - how many rows have `outfit_pieces IS NULL` (which decides how often P5 and P6 succeed);
  - how many rows already carry an invented date, time or dress code;
  - whether any row has already lost guest, invitation or organizer data to 💾 Save.
- It does not run the app, Postgres or any route. The Sequelize behaviour in §1 was checked
  with the local library only. The route-to-caller map came from reading the code; nothing was
  exercised.
- It does not re-derive the guest stores, the wardrobe stores or the taxonomy (see the prior
  art above).
- Seen in passing, outside this task: `GET /world/:showId/events/next-suggestions` is
  registered after `GET /world/:showId/events/:eventId`. Express will therefore route
  "next-suggestions" to the `:eventId` handler (inferred from registration order, not run).
  Its only caller is `NextEventSuggestionsOverlay`.
