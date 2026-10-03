# Brain Ownership

**Status: proposal, awaiting Evoni's rulings (§7).** Written 2026-10-03 as step 1 of the
Brain Update redesign. Step 1 (§8) follows the proposal for one page, Social Systems.
Step 2 (§9) adds the other seven world-building sources and retires Push to Brain.

This takes up the open ruling recorded in `docs/DIRECTOR_BRAIN_DESIGN_INPUT.md` ("The open
ruling: which store is canon?") and its proposal that authoring pages own structured
truth while the Franchise Brain becomes a derived index. It is a living doc: code is cited
by stable name (route, function, component), with line numbers only as a convenience.

---

## 1. The rule (proposed)

> **Authoritative pages and models own facts. The Brain indexes and interprets those facts
> for AI consumption. The Brain does not become a second authoring database.**

What that means in practice:

1. Every Brain entry has exactly one owner: a source page, an event (an episode
   completion), or the Brain itself (a law written directly in the Show Bible).
2. A source can update the knowledge it owns. It never adds a second copy. A sync
   compares by **source key**: new, changed (supersede), unchanged (nothing written),
   retired (archive).
3. An entry a source owns is edited on that source, not in the Brain. The Brain shows
   "Managed by Social Systems" and refuses an edit to its words.
4. A person reviews every change before it lands. What they review is exactly what is
   written (the preview's fingerprint).
5. Presentation never enters the Brain: icons, colors, display numbering, layout, filters,
   editor state.

---

## 2. The three stores today

| Store | What it holds | Who edits it | What the AI reads from it |
|---|---|---|---|
| Page content (`page_content` + page defaults) | The world-building pages' structured data: archetypes, relationship types, calendars, infrastructure, and so on. Defaults live in frontend code (`frontend/src/data/influencerData.js`, `calendarData.js`, and literals inside some pages); saved edits are `page_content` rows that replace a whole key (`usePageData`). | The pages, through `usePageData` → `/api/v1/page-content` | Almost nothing directly. Amber's `push_page_to_brain` and `develop_world` tools read it. |
| The Brain (`franchise_knowledge`) | Laws, decisions, world facts and character truths as text entries | Ten seeders (about 101 entries), Show Bible create/edit, document and PDF ingestion, Push to Brain, Amber tools, Learn Location, episode completion (§3) | Nearly every generator (§4) |
| `Universe` | Name, description, core themes, world rules, PNOS beliefs, narrative economy | `routes/universe.js` POST/PUT (no frontend caller found), `scripts/seed-lalaverse.js` | Three shallow routes, no generator (audit handoff v8 §6.15) |

The audit handoff v8 (§6.15.4) already says it: "Two parallel franchise-tier knowledge
stores. They are unrelated. Editing the Universe page does not change what the AI sees,
because the AI reads `franchise_knowledge` and `franchise_knowledge` has no FK to Universe."

**The drift this proposal is about:** the Social Systems page's eight domains also exist as
eight seeded Brain laws (`20260312100000-influencer-systems-franchise-laws`, `critical`,
`always_inject`, prose). Those eight are what the AI sees. Editing the page has never
changed them.

---

## 3. Who writes the Brain today

| Writer | Owner it should have | How it writes |
|---|---|---|
| Seeders `*-franchise-laws` (10 files, about 101 entries) | The page each one copies (cultural system, influencer systems, world infrastructure, …) or the Show Brain | `bulkInsert` prose; `critical` + `always_inject`. Run by POST `/franchise-brain/seed` (the Show Bible "Seed" button). Seven of the ten don't delete before inserting, so running one twice duplicates it. |
| POST `/franchise-brain/entries` (Show Bible create) | The Brain | `direct_entry`, `pending_review` |
| PATCH `/franchise-brain/entries/:id` (Show Bible edit) | (edit) | Title, content, category, severity, always_inject. Step 1 refuses edits to a source-keyed entry's words (409). |
| POST `/franchise-brain/ingest-document`, POST `/franchise-brain/ingest-pdf` | The document | AI extraction, `pending_review` |
| ~~POST `/franchise-brain/push-from-page`~~ (`PushToBrain`, 8 page names), retired in step 2 (§9) | The page | The whole page as JSON, cut at 50,000 characters, AI extraction, one `create` per fact, `pending_review`. Never compared with what existed. |
| Amber `push_page_to_brain`, `develop_world` (`memories/assistant.js`, `executeAssistantAction`) | The page / Amber | AI extraction or AI generation, raw INSERT |
| POST `/scene-sets/:id/learn-location` | The scene set | Finds by title, else creates; `active` with no review |
| `completeEpisode` step 16 (`episodeCompletionService`) | The episode | Two rows per completion; the character-state one is `always_inject` and supersedes the last (without setting `superseded_by`) |
| `generateEpisodeScript` | (counters only) | `injection_count`, `last_injected_at` |

### Defects found while mapping this

Verified on a database migrated from `src/migrations` (the canon tree):

- **Push to Brain cannot save anything in canon.** It writes `extracted_by: 'page_push'`,
  which is not a value of `enum_franchise_knowledge_extracted_by` (`document_ingestion`,
  `conversation_extraction`, `direct_entry`, `system`). A create with it fails:
  `invalid input value for enum enum_franchise_knowledge_extracted_by: "page_push"`. That
  failure comes after the AI extraction has already run and been paid for. Production may
  have the value added outside the migrations; that is unverified from here. Retired in
  step 2 (§9), so this no longer applies.

Found by reading, not yet run:

- Three more writers use values that are not in that enum: Amber's `amber_push` and
  `amber_worlddev`, and episode completion's `episode_completion_pipeline`. The schema says
  those inserts fail too. Episode completion's per-row fallback only logs a warning.
- Amber's two inserts put `gen_random_uuid()` into `id`, which is an integer.
- The Show Bible's Ingest sends `{ text, source }` but `ingest-document` requires
  `document_text`. The Show Bible's Guard sends `{ scene_text }` but `/guard` requires
  `scene_brief`. Both return 400.
- **Four sources have two editors with different defaults.** Each pair saves to one
  `page_content` record, but each page carries its own defaults, and they disagree.
  Measured in step 2 by comparing each page's defaults:

  | Source (`page_content`) | Editor in the Sidebar | Older editor (routed, not in the Sidebar) | Defaults that differ |
  |---|---|---|---|
  | `influencer_systems` | Social Systems (`data/influencerData.js`) | `InfluencerSystems.jsx` | 4 of 8 keys |
  | `cultural_calendar` | Culture & Events (`data/calendarData.js`) | `CulturalCalendar.jsx` | 2 of 9 keys |
  | `cultural_memory` | Culture & Events (`data/memoryData.js`) | `CulturalMemory.jsx` | 9 of 10 keys |
  | `world_infrastructure` | World Foundation (`data/dreamCities.js`) | `WorldInfrastructure.jsx` | Different keys: `CITIES` (Velvet City, Glow District, Pulse City, Creator Harbor, Horizon City) and `LEGENDARY_GROUPS`, where World Foundation has `DREAM_CITIES` (Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor). Universities and corporations differ too. |

  Where a key has no saved edit, each page shows its own defaults. If both editors could
  sync, the Brain would change back and forth depending on which page synced last. So
  only the Sidebar editor syncs (§9).
- `CharacterLifeSimulation.jsx`'s defaults still name the old cities ("Velvet City" in
  `CAREER_PATHS`). The sync sends what the page says; that disagreement is a conflict,
  for redesign step 7.
- `components/FranchiseBrain.jsx` is imported only by its test, so `PdfIngestZone`
  (`/ingest-pdf`) is unreachable from the UI.

---

## 4. Who reads the Brain, and through which filter

There is no routing today. A reader gets entries by status and a severity / always-inject
filter, never by what the entry is about:

| Reader | Filter |
|---|---|
| Amber (`buildKnowledgeInjection`), franchise guard | active AND (critical OR always_inject), no limit |
| Episode script writer (`loadScriptContext`), grounded script generator, rewrite line | active AND always_inject (limit 50 / 50 / 30) |
| Event generator (`buildEventPrompt`) | active AND always_inject, limit 10 |
| Memories engine (`loadFranchiseKnowledge`) | any active, by severity, limit 15 (the critical laws fill it) |
| Story evaluation (`loadFranchiseConstraints`) | active AND (critical OR always_inject), limit 20, then `applies_to` against the scene's characters. This is the only reader of `applies_to`. |
| Tier franchise guard | active AND category in (franchise_law, locked_decision, character, narrative) |
| Post-generation review | active AND critical |

So "Used By" (step 6 of the redesign) is new backend work: each reader would select by the
entry's declared consumers instead of by `critical OR always_inject`. Until then, a synced
card that is `important` and not `always_inject` (§8) is stored and reviewed, but no
generator reads it.

---

## 5. Ownership, proposed

| Knowledge | Owner | The Brain's role |
|---|---|---|
| Structured world data on a page with a Brain Manifest (Social Systems first) | The page | Index: one card per source item, keyed, synced by review |
| Laws and locked decisions written in the Show Bible | The Brain | Authoring home. These are Brain-native, edited in the Show Bible. |
| Episode outcomes and character state | The episode record (`completeEpisode`) | Index, superseded by the next completion |
| A scene set's learned location | The scene set | Index (Learn Location already finds by title and updates in place) |
| Ingested documents | The document (`brain_documents`) | Index, reviewed |
| `Universe` | Undecided (§7, R6) | — |

---

## 6. What "sync" means

Implemented for Social Systems (§8). Each page with a Brain Manifest gets the same thing.

- **Brain Manifest:** a pure function from the page's data to cards. It names the domains
  that matter and drops everything else. Each card has a `source_key`, stable across
  edits and reordering because it comes from the item's name
  (`social_systems:archetype:the-connector`), plus a title and a content block with the
  item's meaningful fields as labeled lines. One card per item, so there is one Connector
  card, not five Connector facts.
- **Fingerprint:** `source_hash` is sha256 of the card's title and content. Same key and
  same hash means Unchanged, so nothing is written and no AI is called.
- **Apply:** new cards become active entries. A changed card supersedes its entry (old row
  `superseded`, `superseded_by` the new id). An item gone from the page retires its entry
  (`archived`, with a review note). One active entry per key is enforced by a partial
  unique index. Apply re-reads inside a transaction and refuses (409) when the page or
  the Brain changed since the review.
- **Legacy:** entries for the same source document that were never keyed (seeders, the
  old Push to Brain) are counted and shown, and never touched. Whether a sync retires
  them is R2.

---

## 7. Rulings needed

| # | Question | Proposed answer |
|---|---|---|
| R1 | Adopt the rule in §1? | Yes |
| R2 | Social Systems' eight seeded laws (`influencer-systems-v1.0`, critical, always_inject) describe the same eight domains as the synced cards, in older prose. Once the page is connected, should its first sync retire them? | Not until "Used By" routing exists. Today those eight are what the AI reads, and the synced cards are read by no one (§4). Retiring them first would remove Social Systems from every prompt. Retire them in the step that routes the cards. |
| R3 | A page's truth is its frontend defaults plus its `page_content` overrides, and only the browser has both. Accept the browser sending the page to the sync (as Push to Brain did), or move the defaults server-side first? | Accept it for now. Sync requires login, and the reviewed fingerprint ties what is written to what was shown. Moving defaults server-side is its own step. |
| R4 | Four older editors (`InfluencerSystems`, `CulturalCalendar`, `CulturalMemory`, `WorldInfrastructure`) duplicate a Sidebar page with their own, different defaults (§3). | Redirect each route to its Sidebar page and delete the copy. Until then they don't sync; they show "Brain updates on <page> →" (§9). **Done 2026-10-03** (audit IA-04): the four routes, and `/world-locations`, redirect per `docs/WORLD_ROUTE_OWNERSHIP.md`; the copies are deleted. |
| R5 | ~~The old Push to Brain on the other pages fails in canon (§3) and, where it works, creates piles.~~ | Done in step 2: every page has a manifest and Push to Brain is retired (§9). |
| R6 | What is `Universe` for? | Undecided here, as in `DIRECTOR_BRAIN_DESIGN_INPUT.md` |
| R7 | Episode completion and Amber write values the schema rejects (§3). | Fix as their own tasks, outside the Brain redesign. They are bugs either way. |
| R8 | Amber's `push_page_to_brain` and `develop_world` | `push_page_to_brain` should call the page's sync preview instead of extracting. `develop_world` creates new content, so it should write to the page, not the Brain. |

---

## 8. Step 1: Social Systems (implemented)

- `src/services/brainManifests/socialSystems.js` (`buildCards`): eight domains (social
  archetypes, relationship types, economy streams, fashion and beauty trend stages,
  momentum waves, influence forces, legacy signals). Never sends icon, color or `num`.
- `src/services/brainSyncService.js` (`previewSync`, `applySync`) and
  `src/routes/brainSyncRoutes.js`: POST `/api/v1/franchise-brain/sync/:source/preview`
  and `/apply`, both requireAuth, no AI.
- Migration `20261003120000-franchise-knowledge-source-key`: `source_key`, `source_hash`,
  the partial unique index.
- Synced cards: category `world`, severity `important`, `always_inject` false,
  `extracted_by` `system`, `source_document` `influencer-systems-v1.0`, status `active`
  (the drawer review is the approval).
- PATCH `/franchise-brain/entries/:id` refuses (409, "Managed by Social Systems") an edit
  to a keyed entry's title, content, category or severity.
- `frontend/src/components/BrainUpdate.jsx` on `SocialSystems`: the button reads
  Connect to Brain / N Brain Updates / Brain Up to Date ✓. The Review Brain Update drawer
  shows new, changed (Current Brain vs Page now says), retiring, unchanged and legacy.
  Update Brain → applies. It waits for the saved page content (`usePageData`'s `loaded`)
  so it never syncs bare defaults over saved edits.

Not in step 1: conflicts (they need the AI), Law / Rule / Fact / Guidance, Used By, the
Brain landing page, and the other pages.

---

## 9. Step 2: every world-building source (implemented)

- `src/services/brainManifests/makeManifest.js` (`makeManifest`): the shared builder. A
  manifest is a table of domains: the page data key, what one item is, and the field
  that names it. The builder handles:
  - lists (joined) and lists of records (one line each);
  - whole values (a core rule, a list of questions, JustAWoman's social profile), which
    become one card;
  - presentation, dropped even inside a field (icon, color, `num`, accent, plus a
    manifest's own list).

  Social Systems moved onto it with byte-identical output.
- Seven new manifests:

  | Source | Synced on | Cards from the defaults | Legacy source document |
  |---|---|---|---|
  | `cultural_calendar` | Culture & Events ("Calendar") | 64 | `cultural-system-v2.0` |
  | `cultural_memory` | Culture & Events ("Memory") | 44 | `cultural-memory-v1.0` |
  | `world_foundation` (page content `world_infrastructure`) | World Foundation | 19 | `world-infrastructure-v1.0` |
  | `social_timeline` | Social Timeline | 59 | `social-timeline-v1.0` |
  | `social_personality` | Social Personality | 53 | `social-personality-v1.0` |
  | `character_life_simulation` | Character Life Simulation | 52 | `character-life-simulation-v1.0` |
  | `character_depth_engine` | Character Depth Engine | 63 | `character-depth-engine-v1.0` |

  Social Systems makes 48 cards, so 402 in all.
- One editor per source. The four older editors in §3 show `BrainUpdateElsewhere`, a link
  to the page that syncs, instead of a Brain button.
- Push to Brain is retired: the `PushToBrain` component, and POST
  `/franchise-brain/push-from-page` with its AI extraction. Amber's own copy
  (`push_page_to_brain`) is untouched (R8).
- Unchanged from step 1: synced cards are `important` and not `always_inject`, so no
  generator reads them yet. The seeded laws for each source are counted as legacy and
  left alone (R2).
