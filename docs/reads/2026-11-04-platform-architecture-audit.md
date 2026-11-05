# Platform architecture, navigation and UX audit (2026-11-04)

**Basis:** origin/main `1b5e8c70`, plus the production snapshot of 2026-11-04 and Evoni's read-only exports from the same day.
**Scope:** read only. Nothing was built, moved, deleted or migrated.
**How it was made:** six read-only code audits (navigation A and B, unreachable pages, data ownership, brands, workflows) and three earlier audits (world systems, money/season/deals, producer workflows). The highest-impact claims were spot-checked by hand.

**Evidence labels:**
- **V**: verified in code at the basis SHA.
- **P**: verified in production data (snapshot or export).
- **I**: inferred, not proven.
- **Proposal**: a recommendation, not a fact.

Living-doc rule: code is cited by stable name, with `file:line` where it helps.

The open P0 PRs #3701, #3702 and #3703 are **not** merged. Findings they fix are marked *(fixed in #370x, unmerged)*.

**Status as of 2026-11-04 (later the same day):**
- **Merged:** #3700 (season story order, bonus episodes canonical by default).
- **Unmerged:**
  - #3701 is on hold (CI, plus a measured source for portfolio and follower goals).
  - #3702 and #3703 are waiting for a final CI and diff review on their current heads.
  - #3704 (this read) is documentation only.
- **Evoni's rulings on §10** are recorded in §11. The screen-level blueprint is in `docs/reads/2026-11-04-navigation-ownership-blueprint.md`.

---

## 0. Summary

**What exists.** The platform is very capable and very spread out:
- 138 page files, of which 93 are routed;
- about 29 routed pages with no way in from the UI;
- 22 components never imported;
- 212 backend route files, all mounted;
- five big tabbed hubs (LalaVerse, Producer Mode, Season, The Pulse, Admin) plus EpisodeDetail;
- no role guards on any route.

**The core problem is ownership, not missing features.** The same concept has several homes:
- events are created in six or more places and edited in three;
- Lala's money is shown on about eight screens;
- "goals" means four different things;
- characters live in three identity tables;
- the DREAM city list exists in about 15 copies;
- brands are free-text names almost everywhere.

**The risks that matter most now:**
1. destructive or stale-data paths (§4);
2. two competing completion and acceptance paths;
3. edits that silently overwrite other records (World Studio → Character Registry) or are silently dropped (episode Air Date);
4. no role guards on admin tools.

**The direction.** Separate the levels (World · Show · Season · Episode · Lala) and give each concept one owner page. Other pages show *context plus a link* instead of copies. One place per action. Most of this reuses existing components.

---

## 1. Current Platform Map (as built)

### 1.1 How navigation actually works (V)

**Auth and permissions:**
- One sign-in gate (`App.jsx`, `AppContent`).
- `ProtectedRoute` is defined but **never used**.
- No route has a role guard. Admin is checked inside a few pages (`isAdmin`, `utils/authGroups.js`): AdminPanel, AuditLog and TemplateManagement refuse non-admins; EpisodeEditor and the Voice pill are admin-only for some actions.
- `/cfo`, `/ai-costs`, `/site-organizer`, `/design-agent`, `/analytics/decisions` and `/recycle-bin` have **no** admin check.

**The sidebar** (`components/layout/Sidebar.jsx`) has four zones:

| Zone | Entries |
|---|---|
| WORLD | LalaVerse, Characters, Relationships, The Pulse |
| PRODUCE | Shows (one row per show), Editor, Teleprompter |
| LIBRARY | Assets, Templates |
| WRITE | Stories, with Threads, Story Calendar and Story Evaluation |

- The footer has Search, Settings and Admin.
- **FRANCHISE / STUDIO / SYSTEM no longer exist as zones.** They survive only in a stale comment, a badge and the SiteOrganizer.
- There are no sidebar rows for Season, Daily Update, the Phone Hub or a Lala page.

**Hubs** (tabbed pages, `?tab=&sub=`):
- `/universe` (LalaVerse)
- `/shows/:id/world` (Producer Mode, which the breadcrumbs call "world")
- `/shows/:showId/season`
- `/pulse`
- `/admin`

**Other navigation pieces:**
- **Active show:** URL, else localStorage, else the only show, else a chooser (`utils/activeShow.js`).
- **Breadcrumbs:** built automatically from URL segments plus labels.
- **CommandPalette and AppAssistant:** both carry stale links. The assistant's prompt lists routes that don't exist (`/library`, `/wardrobe`, `/audit-log`, …).

### 1.2 Pages by level

The page-by-page recommendations are in §7. This is the inventory.

**L1 — Dream Cities / World**

| Page | Route | Notes |
|---|---|---|
| LalaVerse hub | `/universe` | tabs: overview · bible · world (map, locations) · society · brands · culture (cultural calendar) · state (snapshots, tensions) |
| Character Registry | `/character-registry` | |
| Character profile | `/character/:id` | 3,818 lines |
| Relationships | `/relationships` | |
| Feed relationship map | `/feed-relationships` | |
| World Studio | `/world-studio` | world characters, feed profiles, relationships. No sidebar row |
| The Pulse | `/pulse` | posts, events, people, profile, messages, cities |
| Property Manager | `/property-manager` | |
| Static lore | `/social-timeline`, `/social-personality` | |
| Unreachable | `/world-setup`, `/pressure`, `/scene-studio`, `/shows/:id/feed-timeline`, `/shows/:id/feed-dashboard` | `/feed-timeline` is reachable only from ReleaseBoard |

**L2 — Franchise and Show**

| Page | Route | Notes |
|---|---|---|
| Shows list | `/shows` | |
| Create show | `/shows/create` | |
| Edit show | `/shows/:id/edit` | **duplicates** Admin › Show settings |
| `/shows/:id` | — | a redirect only |
| Producer Mode | `/shows/:id/world` | 2,883 lines; 6 tabs and 13 sub-tabs; still holds an inline wardrobe tool and a finance editor |
| Show Bible | hub tab `bible` | knowledge, decisions, documents, guard |
| Orphans | `/universe/series`, `/universe/social-import`, `/universe/production`, `/universe/writing-rhythm` | |

**L3 — Season and Producer**

| Page | Route | Notes |
|---|---|---|
| Season page | `/shows/:showId/season` | 10 tabs: Overview, Roadmap, Episodes, Events, Opportunities, Story, Cast, Plants, Goals, Results; plus setup mode and Print plan |
| Event Package | `/shows/:showId/events/:eventId` | 8 sections; its "Edit details" opens a second editor |
| New Episode starter | `/shows/:showId/new-episode` | 6 paths; "personal" is not built |
| Daily Update | `/today` | reachable from Home only |

**L4 — Episode and Prime Studios**

**EpisodeDetail** (`/episodes/:id`; 1,386 lines; 4 tabs and 15 sub-keys):

| Tab | Contents |
|---|---|
| Overview | |
| Script | 3,528 lines |
| Production | Wardrobe, Style Page, Phone, Overlays, Money, Checklist, Scenes/Plan, Files, Voice (admin), Edit |
| Results | Summary/Evaluation, Story, Distribution |

**Standalone pages that duplicate those tabs:**
- `/edit` (legacy QuickEpisodeCreator)
- `/evaluate`
- `/todo`
- `/script-writer`
- `/plan`

**Unreachable:** `/beats`, `/icon-cues`, `/review` → `/export`.

**Studio tools:**
- Editor hub `/studio/editor`, and the Episode Editor (full screen).
- Teleprompter.
- Phone Hub `/phone-hub`: 3,643 lines, the same component as Producer Mode › Lala's Phone.
- Scene Studio compositor `/studio/scene/:id`: 2,264 lines. **It shares its name with** `/scene-studio` (world scenes).
- SceneSetsTab: 4,464 lines.

**L5 — Character Life / Player (Lala).** There is **no Lala page** (V). Her data is spread out:

| Data | Where it appears |
|---|---|
| Stats | 7 or more places; editable in two (Producer › Cast and Admin › Show settings) |
| Finances | about 8 surfaces |
| Goals | 4 kinds in 5 places |
| Closet | 6 places |
| Phone players | 3 (one saves a playthrough, two preview) |

**L6 — Shared systems**

| Page | Route | Notes |
|---|---|---|
| Brands list | hub tab `brands` | |
| Brand profile | `/brands/:slug` | |
| Admin › The Pulse | | 11 sub-tabs, including review and brands |
| Asset Library | `/assets` | separate from the Producer Mode asset store |
| Templates | `/template-studio` | |
| Settings | `/settings` | localStorage only |
| Admin | `/admin` | pulse, website, show settings, tools |
| Admin tools | CFO, AI Costs, Site Organizer, Design Agent, Decision analytics, Recycle bin | no admin gate |
| Unreachable | Amber, AuditLog, TemplateManagement, SetupWizard | |
| Search | `/search` | |

**There is no "Prime Bank" page** (V). The bank view is Producer Mode › Lala's Finances.

### 1.3 Unused, unreachable and legacy (listed, not deleted)

**Orphan page files:**
- AuditLogViewer (a duplicate of AuditLog)
- CreateEpisode (1,570 lines)
- NewBookModal (707)
- UniverseAssetsPage

**About 29 routed pages with no way in:**

| Group | Routes |
|---|---|
| Admin and setup | `/admin/audit`, `/admin/templates`, `/setup`, `/world-setup` |
| Novel and story tools | `/texture-review/:n`, `/story-health`, `/narrative-control`, `/scene-proposer`, `/assembler`, `/continuity`, `/press`, `/chapter-structure/…` |
| World and lore | `/amber`, `/pressure`, `/scene-studio`, `/social-timeline`, `/social-personality`, `/character-life-simulation`, `/character-depth-engine` |
| Universe | `/universe/series`, `/universe/writing-rhythm`, `/universe/social-import`, `/universe/production`, `/universe/story-dashboard` |
| Episode | `/episodes/:id/icon-cues`, `/beats`, `/review`, `/export` |
| Studio | `/studio/scene-set/:id` |

Caveat: the AI assistant can navigate to any of them.

**22 components never imported:**
- BookEditor (1,573 lines) and about 9 components only it uses
- FranchiseBrain (1,066)
- CharacterProfile (700)
- SceneLinking (620), the only user of the legacy `scriptsService`
- StoryPlanner, CharacterDepthPanel, EpisodeKanbanBoard, PhoneHubSteps, …

**Backend:**
- The `/api/v1/character-generator` router (7 endpoints) has no frontend caller.
- About 24 of characterRegistry's 41 endpoints have no frontend caller, including the deprecated deep-profile ones.
- Sync `batch-generate` and `pipeline-generate` were superseded by background versions.

**Dead migration trees:** `migrations/`, `migrations/sequelize-migrations/`, `migrations-node-pg-migrate/` and `scripts/migrations/`. The last one includes an unguarded `DROP TABLE shows CASCADE`. `src/migrations/` now holds 396 files.

---

## 2. Data Ownership and Relationship Map

**Proposed** owner per concept; the evidence is in §4 and the earlier audits. "Read by" says how other pages should get it.

| Concept | Owner today (V) | Competing homes (V/P) | Recommended owner · read by |
|---|---|---|---|
| Universe, world rules | `universes` + `franchise_knowledge` | both hold rules; `shows.universe_id` has no writer and is not in the Show model | universe = identity; `franchise_knowledge` = rules · Show Bible |
| Show | `shows` | `show_configs` (a separate config store used by one route); `shows.metadata` written by about 15 services | `shows` + typed metadata keys · show settings in one place |
| DREAM cities | page_content `DREAM_CITIES` | about 15 hard-coded copies, names vs keys, a `social_profiles.city` ENUM | `world_locations` (type=city) with ids · `dreamCityList` |
| Locations, venues | `world_locations` (parent chain) | event `location_hint`/venue copies; a character's city in 3 fields; Lala's home as text | `world_locations` id everywhere · venue picker |
| World events | `world_events` | brief copies (terms, chain, seeds); `automation.*` copies of host, date and venue | `world_events` · Event Package; the brief keeps a labelled snapshot |
| Cultural calendar | `story_calendar_events` | `shows.metadata.world_moments`; Pulse calendar; release schedule (4 calendars) | three clocks (world, story, publication) per the world-clock proposal |
| Seasons, slots | `show_arcs`, `season_slots`, `season_specials` | `episodes.season_context` snapshot; brief `arc_id` copied from the event | slots · Season Roadmap |
| Attendance | `canon_consequences.automation.guest_profiles` | dead `guest_list`; `calendar_event_attendees` (novel) | guests on the event · Event Package › People |
| Character identity | `registry_characters` | `world_characters` (two-way link; **World Studio edits overwrite the registry**); legacy `characters` (read by the phone prompt, written by nothing) | registry · Character Registry; World Studio becomes a draft that commits once |
| Social persona, followers | `social_profiles` + `pulse_followers` | 5 copies of follower counts; ~18 fields copied into the registry | profile + follower ledger · read by join |
| Lala | registry key `lala` | two "which Lala" rules (`whichLala` vs `lalaFeedProfile`) | `shows.lala_registry_character_id` (proposal) |
| Relationships | `character_relationships` | `social_profile_relationships`, `pulse_closeness`, `lala_relationship` enum; 80 Lala edges seeded "known" before Episode 1 (P) | registry relationships · Relationships page |
| Brands | `lalaverse_brands` | `host_brand` strings, `brand_or_company`, brand Pulse account in JSON, wardrobe brand text | `lalaverse_brands` + typed links · Brand Profile (§5) |
| Opportunities, deals | `opportunities` + event deal fields + `event_deliverables` | Schedule as Event forced `booked` *(fixed in #3703)*; `payment_status` not tied to the ledger | opportunity = offer and decision; event = terms; ledger = money |
| Goals | `career_goals` | finance milestones in `shows.metadata.financial_goals`; goal pins; four writers *(Advance writer fixed in #3701)* | `career_goals` measured from ledger and state · Season › Goals |
| Bills, savings | **none** | — | new (P6 Bills & Lifestyle spec) |
| Money | ledger `financial_transactions` | `character_state.coins` (synced copy); `episodes.total_income` leaves out deal payouts | ledger · one Money view |
| Pulse posts | `feed_posts` | poster names copied and never refreshed; about 12 inserting services | `feed_posts` via `social_profile_id` · The Pulse |
| Wardrobe | `wardrobe`, `episode_wardrobe` | `episode_outfits` (no migration in `src/migrations`); `times_worn` inflates | `episode_wardrobe` · computed counts |
| Assets | `assets` (upload) + `media_assets` (library) | two libraries, join tables, name strings | `media_assets` library · Asset Library |
| Scripts | `episodes.script_content` via `scriptSave` | `episode_scripts` (two conflicting create migrations; the legacy writer is used by an orphan); `episode_script_versions` | `script_content` = canon; `episode_scripts` = generation log |
| Footage, voice | `episode_raw_clips`, `line_voice_*` | dead `raw_footage`, `scene_footage_links` | as is |
| Evaluation | `episodes.evaluation_*` | two accept writers (`episodeCompletionService`, `seasonSpecials`); deprecated `/accept` still used | `completeEpisode` only |
| Continuity | `episode_story_records` (history) → relationship tables, `show_follow_ups` | approval doesn't require a completed episode; carry-forward orders by `episode_number` | records approved only after completion; carry-forward on season story order |

---

## 3. Duplicate and Overlapping Features

| Area | Duplicates (V) | Proposal |
|---|---|---|
| Event creation | EventLibrary, Roadmap placement, NewEpisodeStarter, QuickEpisodeCreator, Episode Wardrobe picker, follow-up events, calendar auto-spawn, world moments, feed from-profile, opportunity schedule | one **Create event** flow; others call it |
| Event editing | Event Package inline, EventLibrary editor, EventDetailsModal | the Event Package is the only editor |
| Event picking / ranking | event-fit, suggest-events, next-suggestions, goal events | one ranker (the Event Opportunity Board) |
| Completion | EventDetailsModal Complete; `/evaluate` → deprecated `/accept`; Finalize Financials button | **Complete** on the episode page |
| Script | Script tab vs the Script Writer page (different tables); 4 generate entry points | the Script tab |
| Plan, todo, evaluate | EpisodeDetail pills vs standalone `/plan`, `/todo`, `/evaluate` | keep the tabs; retire the standalone pages |
| Lala stats | 7+ views, 2 editors | one Lala page |
| Money | about 8 views (Finances ×5, Home, Season card, Insights, Episode Overview, Episode Money, Results ledger, forecasts) | one Money view; others show a figure plus a link |
| Goals | CareerGoals, the finance goal ladder, GoalCoverage, EventGoalPins, seeding in Show settings | Season › Goals |
| Closet | Producer Wardrobe (inline), Episode Wardrobe, Event Package Look, OutfitCalendar, Finances › Closet, Home tile | a Wardrobe library page; contextual pickers |
| Phone | Phone Hub ×2 mounts; 3 players | Phone Hub (build) + one player |
| Pulse | The Pulse, Producer › Lala's posts, Admin › Pulse review, Daily Update "Waiting for you", feed-timeline | The Pulse + a review queue |
| Show settings | EditShow vs Admin › Show settings | one Show settings |
| Characters | Character Registry, World Studio, Pulse people, the `/world/characters` store | Registry; World Studio as a generator |
| Relationships | `/relationships`, `/feed-relationships`, World Studio tab | one Relationships page with layers |
| Brands | two create paths (`/companies` admin vs `/wardrobe-brands/brands` any user); two Pulse drafting UIs with different deal matching | Brand Registry (§5) |
| Calendars | story calendar, world moments, Pulse calendar, release schedule | three clocks |
| Scene Studio | two pages with the same name | rename one |

---

## 4. Broken Workflow and Data Integrity Report

**P0: data safety, broken workflows and integrity risks**

| # | Finding | Evidence | Status |
|---|---|---|---|
| 1 | Bulk delete and replace hard-deleted used and linked events | `eventGeneratorRoute`, `episodeBatch` | *fixed in #3702, unmerged* |
| 2 | Schedule as Event forced `booked` | `feedEventPipelineService` | *fixed in #3703, unmerged* |
| 3 | Opportunity Advance wrote goals with no ledger row, twice | `careerPipelineService` | *fixed in #3701, unmerged* (portfolio and follower goals then need a measured source) |
| 4 | **Episode "Air Date" edit is silently dropped** (the form sends `publish_date`; the whitelist has `air_date`) | `EpisodeOverviewTab`, `episodeController` | V, open |
| 5 | **World Studio edits overwrite registry identity fields** | `worldStudio.js` auto re-sync | V, open |
| 6 | No role guards; admin tools (CFO, AI Costs, Recycle bin, …) open to any signed-in user | `App.jsx` | V, open |
| 7 | `/api/v1/debug/routes` is exposed whenever `NODE_ENV` is unset; `/api/v1/seed` mounts outside production | `src/app.js` | V, open |
| 8 | Two episode-accept writers; the deprecated `/accept` is still used | `episodeCompletionService`, `seasonSpecials`, `evaluation.js` | V |
| 9 | Brand regenerate replaces `full_profile` and silently detaches the brand account; `lalaverse_brands` model is not paranoid (soft-deleted brands are returned) | `socialProfileRoutes`, `LalaverseBrand` | V |
| 10 | Server enforces almost no Start readiness; `generate-episode-from-many` and `regenerate` skip the browser gates; slot assignment failure is only logged | `startReadinessService`, `episodeGeneratorService` | V |
| 11 | Story record approval doesn't require completion; carry-forward feeds unapproved canon | `episodeStoryRecord`, `storyCarryForward` | V |
| 12 | Linking an event from Episode Overview bypasses Start (no brief, slot or terms) | `EpisodeOverviewTab` | V |
| 13 | `episode_scripts` has two incompatible create migrations | migrations | V |
| 14 | Affordability and decline handlers look up the event by id only (no show or deleted filter) | `affordability.js` | V |
| 15 | Dead migration tree includes an unguarded `DROP TABLE shows CASCADE` | `scripts/migrations` | V (not run by deploys) |
| 16 | Production data inconsistencies | Episode 1 report and world audit | P: event dates out of slot order; bonuses outside their cultural windows; Lala's stats left over from deleted test episodes; 80 pre-seeded relationships; Spring Capsule booked; three wardrobe pieces with no purchase record |

**Broken or confusing workflows (V):**
- **Complete is hidden** in a legacy modal behind an event card menu. The episode Results tab only says "complete it in Producer Mode".
- **BrandProfilePage "Open Opportunities"** goes to a missing Admin tab.
- **The Event Package can't pencil a slot** and has no Decline.
- **Footage and the script don't affect evaluation**; the score comes from the look, social tasks, self-talk, event and money.
- **Story time advances only** when someone sets an episode to "published" by hand.
- **Guests without a registry link** produce no relationship consequences (`not_linked`).

---

## 5. Brand System Audit

**How it works today (V):**
- **Registry:** `lalaverse_brands` is the de facto registry: 6 brands and 4 outlets, kinds brand, outlet, agency and venue. Founder and contact are text. It is not paranoid.
- **Created** in two ways: `/companies` (admin, duplicate check) and `/wardrobe-brands/brands` (any user, no duplicate check, plus a seed route).
- **Brand profile:** `/brands/:slug`, with tabs by kind: identity, people, pulse, business, pictures, wardrobe, press, relationships.
- **Brand Pulse account:** a `social_profiles` row tagged inside JSON (`full_profile.account='brand'`). There's no typed link and no uniqueness, and Regenerate can detach it.
- **Founders and reps:** the founder is text. The reps are draft registry characters linked through `extra_fields.brand_id`, plus a constant, plus `opportunities.contact_name`: three homes. A character can also be marked as being the company.
- **STUDIO BY SABLE:** not in the brand registry (P/V). It is very likely a single creator profile acting as both Sable and her brand (I). This is the merged-identity case.
- **Events:** a brand hosts only through the free-text `host_brand`. `convertOpportunityToEvent` sets the host to the brand, against the ruling.
- **Payments:** the payer is the `host_brand` *name* (`dealPayoutService.payerFor`). Payouts become ledger rows with no brand id.
- **Documents:** the offer letter and agreement name the brand from `host_brand || host`, with no logo and no signature record.
- **Matching is inconsistent:** the brand's deals are found by `ILIKE name` on one page and by exact name on another, so the lists differ.

**Not built (V):**
- per-brand trust (0–100)
- sponsored-post disclosure (#ad / Paid partnership)
- the `[OFFER: id]` cue
- rivalry consequences: rivalries have two homes and do nothing
- exclusivity enforcement: exclusivity is text only

**Proposed Brand Registry and Brand Profile (reuse `BrandProfilePage` and `brandProfile` service):**
- **The owner record:** `lalaverse_brands`, made paranoid, with typed links:
  - `social_profiles.brand_id`, unique, replacing the JSON;
  - `world_events.host_company_id` (`host_brand` stays as display text);
  - `founder_character_id`.
- **Per-brand trust:** a new `brand_trust_ledger` table, starting at 50.
- **Brand creation:** one path, `brandProfile.createCompany`; retire `/wardrobe-brands/brands` creation. Brand pickers read `/companies?kind=brand`.
- **Profile tabs:**

| Tab | Contents |
|---|---|
| Identity | logo, which also feeds the agreement letterhead |
| People | founder link; reps with a role; a merge warning with a "split person and brand" action for the Sable case |
| Events | by `host_company_id` |
| Deals & Payments | `businessOf` + deliverables + payouts from the ledger, with `company_id` in payout metadata |
| Pulse | the per-brand card moved from Admin; #ad flag on deliverable posts |
| Relationships & Trust | one rivalry list, the trust ledger, structured exclusivity checked when an offer is accepted |

- **Name lookups:** replace the five name-based resolvers with one `companyForEvent(event)`.

---

## 6. Proposed Simplified Platform Map (Proposal)

**Sidebar:** five workspaces, each with an "attention" count, consistent breadcrumbs, and one place per action.

| Workspace | Purpose | Pages (built from existing components) |
|---|---|---|
| **WORLD** (Dream Cities) | what exists, independent of Lala | World (map, cities, locations, venues) · World Calendar (cultural and world events by world date) · Characters (Registry, with World Studio as its generator) · Relationships (layers) · Brands (Registry + Profile) · The Pulse |
| **SHOWS** (Franchise) | what the show is | Show home (overview + settings, merging EditShow and Admin › Show settings) · Show Bible · Assets & Wardrobe library · Phone Hub (build) · Release & Distribution |
| **SEASON** (Producer) | what I'm making next | Season home (attention, roadmap, health) · Event Opportunity Board (pick and pencil) · Event Package (the only event editor; Start Episode with the readiness gates enforced on the server; Decline) · Opportunities & Deals · Goals · Story (threads, plants) · Results |
| **EPISODE** (Prime Studios) | making one episode | Episode page tabs: Overview · Script (the only script editor) · Production (wardrobe, style, phone, overlays, scenes/plan, files, voice) · Edit (Editor) · **Complete** (evaluation + accept, one button) · Story record · Distribution |
| **LALA** (Character Life) | her life as of now | Lala page: stats, Money (the only full money view: ledger, pending, later bills and savings), Closet, Goals summary, Phone playthrough, relationships to Lala |
| WRITE | the novel | unchanged for now |
| SYSTEM (Admin) | operators only | Admin (role-guarded): Pulse review queue, costs, diagnostics, audit log, recycle bin, website |

**States everywhere:** draft → ready → approved → completed, with one badge style.

**Lists:** pagination, filters and search on events, characters, posts and assets.

**Context, not copies:** a page shows the few fields it needs, plus a link to the owner record.

---

## 7. Page-by-Page Recommendations (condensed)

**Legend:** K keep · S simplify · M merge · Mv move · R redesign · X retire. Retiring means hiding, then removing after review; nothing gets deleted here.

| Page / tab | Rec. | Why |
|---|---|---|
| LalaVerse hub (overview, world, society, culture, state) | S | keep the tabs; make Culture the World Calendar; State stays |
| Show Bible | K | owner of canon rules |
| Brands list + profile; Admin › Pulse › Brands | R + M | §5 |
| Character Registry; World Studio; `/world/characters` | K; Mv into Registry as "Generate"; M | one identity owner |
| Character profile (3,818 lines) | S | split by tab |
| Relationships, `/feed-relationships` | M | one page with layers |
| The Pulse; Producer › Lala's posts; Admin › Pulse review; `/today` "Waiting for you" | K; M; K (as the queue); link | one review queue |
| Shows list, Create show | K | |
| EditShow + Admin › Show settings | M | one Show settings |
| Producer Mode (WorldAdmin) | R | dissolve into Show, Season and Lala: the wardrobe tool → Assets & Wardrobe; Finances → Lala › Money; Cast → Lala; World moments → World Calendar; Rate card → Opportunities & Deals; Release → Show › Release |
| Season page (10 tabs) | S | Overview, Roadmap + Board, Opportunities, Goals, Story (with Plants and Cast), Results |
| Event Package | K (owner) | add pencil-to-slot, Decline, server-side readiness |
| EventLibrary editor, EventDetailsModal | M → Event Package | one editor |
| NewEpisodeStarter | S | becomes "Create event" + the Board |
| QuickEpisodeCreator `/edit`, CreateEpisode | X | legacy |
| `/today` Daily Update | Mv | becomes the global "Attention" home |
| EpisodeDetail | S | as in §6; Production pills grouped |
| `/script-writer`, `/plan`, `/todo`, `/evaluate` | M into tabs | duplicates |
| `/beats`, `/icon-cues`, `/review`, `/export` | X or decide | unreachable |
| Phone Hub (two mounts) | K one | |
| Scene Studio (two pages) | rename | name collision |
| SceneSetsTab (4,464 lines), EpisodeScriptTab (3,528), UIOverlaysTab (3,643) | S | split by component; no behaviour change |
| Asset Library vs Producer assets | M | one library |
| Settings | K | |
| Admin + tools | K + guard | role guard |
| Orphans and unreachable (§1.3) | X after review | |

---

## 8. End-to-End User Journeys

**Current, with the main breaks:**

```
A. Event → Episode → Consequences
World event (6+ creators) → [Season › Roadmap] pencil → [Event Package] fill, invitation
→ Start (browser-only gates; 2 other start paths skip them) → Episode created; slot assigned after commit (may fail)
→ Script (Script tab | Script Writer, different tables) → Footage (not used in scoring)
→ Complete (hidden modal | /evaluate→deprecated /accept) → stats, ledger, payouts
→ Story record (approvable before completion) → carry-forward (by episode_number)

B. Brand → Payment
Brand (2 create paths) → Opportunity → status steps → Schedule as Event (forced booked; fixed #3703)
→ terms on the event → agreement (no signature) → deliverable submit → approve (fee posted)
→ Complete (other payouts) ; opportunity "paid" (status only, not ledger; goals double-count fixed #3701)

C. Character → Consequence
Registry ⇄ World Studio (overwrites) ; Feed profile (separate) → guests on event (profiles)
→ script/Pulse → story record → relationships only if both sides registry-linked

D. Lala's money
[no bills] → ledger balance (8 views) → [no savings] → affordability warning (never blocks) → decline only in a legacy modal

E. Season → Evaluation
Arc → slot intention → pencil (Roadmap only) → Event Package (can't pencil) → Start → brief snapshot → script → footage → evaluation (ignores script/footage)

F. Time
Story calendar | world moments | Pulse calendar | release schedule — none reads another; story clock advances only on a manual "published"
```

**Proposed:**

```
A'. WORLD event (world date) → SEASON Board (fit, money, friends, dates) → pencil (logged)
    → Event Package (server-enforced readiness; offer decision) → EPISODE Start (pencilled slot)
    → Script tab → Production → Complete (one button: evaluate + accept)
    → Story record (after Complete) → carry-forward (season story order)
B'. Brand Profile → Opportunity (decision recorded) → Event terms → Agreement (signed state)
    → Deliverable approve → ledger (pending → executed) → Brand Profile › Deals & Payments
D'. LALA › Money: bills (P6) → available / pending / committed / discretionary → Board uses it
F'. World clock (world date) ⟂ story chronology (warnings) ⟂ publication (release schedule)
```

---

## 9. Prioritised Redesign Roadmap (Proposal)

| P | Work | Depends on | Reuses | Migration | Do not touch yet |
|---|---|---|---|---|---|
| **P0** | Merge reviewed #3701 (after portfolio/follower sources), #3702, #3703. Fix the Air Date drop. Guard admin tools (role guard). Make the debug route production-safe. Pause the World Studio → registry auto-overwrite. Paranoid brand model plus a brand regenerate guard. Story record only after Complete. Affordability lookups scoped by show | — | existing routes | no | the redesign |
| **P1** | One owner per concept (§2): one completion path; one event↔episode rule; carry-forward on story order; `companyForEvent`; one "which Lala"; follower count derived; `times_worn` computed; `episode_scripts` reconciled; `shows.universe_id` in the model | P0 | services listed | some (typed brand links, `lala_registry_character_id`) | data moves without approval |
| **P2** | Navigation: five workspaces, breadcrumbs, attention counts, role guards, stale palette/assistant links fixed | P1 partly | Sidebar, Breadcrumbs, `useActiveShow` | no | visual polish |
| **P3** | Simplification: dissolve Producer Mode; fold the standalone episode pages into tabs; one Event editor; one Show settings; split giant components without behaviour change | P2 | existing components | no | — |
| **P4** | Missing workflows: Event Opportunity Board; pencil from the Event Package; server readiness; Complete button; Decline; Restore Event; Brand Profile tabs; signature state | P1–P3 | rankers → `scoreForSeason` | small | — |
| **P5** | Visual and UX polish: states, badges, pagination, filters, empty states, 375px checks | P3 | `--lala-*` tokens | no | — |
| **P6** | New: world clock, Bills & Lifestyle, savings, per-brand trust, sponsored-post flag | P1, P4 | ledger | yes | — |

**Migration risks:**
- moving or merging tables that services still read;
- changing `world_events` links;
- the brand typed-link backfill;
- any production data correction (event dates, stats rebaseline, Spring Capsule status, Phone Hub wiring).

Each one needs its own approval and a rollback.

---

## 10. Decisions for Evoni

1. **Workspaces:** approve WORLD · SHOWS · SEASON · EPISODE · LALA (+ WRITE, SYSTEM) as the target, or keep the current WORLD/PRODUCE/LIBRARY/WRITE zones.
2. **Producer Mode:** dissolve it into Show, Season and Lala pages (recommended), or keep it as a hub.
3. **One completion path:** a Complete button on the episode page; retire EventDetailsModal Complete and `/evaluate` → `/accept`.
4. **Characters:** the Registry is the only identity owner, and World Studio becomes a generator that commits once.
5. **Brands:** `lalaverse_brands` is the owner, with typed links and per-brand trust; split merged person/brand profiles (Sable).
6. **#3701:** define portfolio strength's measured source. Followers come from the Pulse follower ledger.
7. **Retire or hide** the orphan and unreachable pages in §1.3, after one review pass.
8. **Order:** approve P0 items 4–7 of §9 as small focused PRs before any redesign work.

---

## 11. Evoni's rulings on §10 (2026-11-04)

Recorded as given. **They approve a direction, not a rebuild or a migration.**

1. **Target workspaces:** WORLD, SHOWS, SEASON, EPISODE, LALA, WRITE and an admin-only SYSTEM.
2. **Producer Mode stays for now as a transitional hub.** It is not dissolved until the replacement workflows are verified.
3. **One authoritative episode Complete workflow is to be designed.** It must preserve accepted history, financial integrity and explicit approval. Completion behaviour is not consolidated yet; a read-only comparison of the two paths comes first.
4. **The Character Registry owns character identity.** World Studio must not overwrite Registry fields through broad saves.
5. **Brands get authoritative records** with explicit relationships to characters, Pulse profiles, events, opportunities and contracts. Studio by Sable is investigated as a representative case. No automatic splitting, post reassignment or changes to historical relationships.
6. **Portfolio strength derives from approved qualifying creative work.** Follower growth stays a separate metric. Scoring rules and source records are to be proposed before implementation.
7. **No page is deleted or hidden** until dependency and usage checks are complete.
8. **Focused P0 fixes may be prepared,** each with its own review and merge approval:
   - A: server-side admin authorisation;
   - B: debug route exposure;
   - C: World Studio → Registry overwrites;
   - D: the Episode Air Date edit.

---

## 12. Episode completion: the two paths compared (read only, 2026-11-04)

Requested by ruling 3. **Nothing about completion was changed.**

### Both paths run the same pipeline (V)

- **Path 1:** the event card's EventDetailsModal **Complete** → `POST /world/:showId/episodes/:episodeId/complete` (`routes/worldEvents/ledger.js`) → `episodeCompletionService.completeEpisode`.
- **Path 2:** `/episodes/:id/evaluate` → `/override` → `/accept` (`routes/evaluation.js`). **`/accept` only calls `completeEpisode`.**

So money, stats, goals and continuity are applied by **`completeEpisode` alone**.

**What `completeEpisode` does, in one transaction:**
- locks the episode and re-checks for `accepted` (this is the guard against running twice);
- locks the ledger;
- finalizes financials: entry, wardrobe, deal cost, spending lines, event payment, content revenue, totals;
- books deal payouts, deduplicated;
- syncs coins from the ledger, and refuses if the balance would go below zero;
- applies financial-mood stress and the stat changes;
- writes two history rows;
- sets the evaluation to `accepted`;
- sets the event to `filmed`.

**After the commit:**
- franchise knowledge;
- career goals measured (step 17) with unlocks;
- slot outcome and the next-slot draft;
- the story record **draft** (it counts only after approval);
- thread seeds;
- the opportunity completed (accepted offers only);
- host and guest outcomes, and beat 14;
- a follower change **proposal**;
- Pulse posts, once.

**Touched by neither path:** `event_deliverables` (content fees are booked when a deliverable is approved) and `episodes.status`.

### Differences and risks (V unless marked)

| # | Finding | Effect |
|---|---|---|
| C1 | **Finalize Financials, then Complete, corrupts the results.** Finalize returns `already_finalized` with no summary or balance, so Complete writes **0** to `total_income`/`total_expenses` and computes stress from a 0 balance: **+2 "going broke"**, possibly +2 more from the threshold rule. The ledger itself is not double-booked. `financialTransactionService` ~428-436; `episodeCompletionService` 489-524, 602-609 | Wrong episode totals, stress and slot money. **Do not press Finalize Financials before Complete on Episode 1** until this is fixed |
| C2 | Finalize Financials is shown whenever the event has an episode, with no completion-state check | Path to C1 |
| C3 | Path 2's `/evaluate` uses a different scoring (outfit ×0.25 vs ×0.35; no self-talk, social, wardrobe or money effects). `/accept` **ignores** the stored preview and any `/override` | The tier shown or overridden may not be the tier accepted |
| C4 | Path 2 blocks a repeat call with 400 before the beat 14 held-offer retry; Path 1 retries | Beat 14 recovery only works from Path 1 |
| C5 | **Admin reset** (`evaluation.js` ~139-198, admin only) resets evaluation and status for **every episode of a show**, and the four stats. With no `showId` it falls back to a **hard-coded production show id**. It doesn't reverse ledger rows, slots, goals, opportunities, story records or the Pulse; completing again re-applies stats, goals and outcomes, and hits C1 | Partial, irreversible state loss |
| C6 | Two-parters: Part 2 is set accepted from Part 1 outside a transaction; post-commit steps run for Part 1's id only (I: safe to retry) | Continuity is recorded on Part 1 |

### Recommendation (ruling 3; not implemented)

**One authoritative workflow:** `POST …/episodes/:episodeId/complete` → `completeEpisode`, shown as the **Complete** tab on the episode page, with the existing confirm and money warning.

**Before consolidating, fix in the service, each as its own reviewed PR:**
- **C1:** when finalize returns `already_finalized`, rebuild the summary and balances from the existing ledger rows.
- **C2:** hide Finalize Financials once the episode is accepted, or remove it.
- **C5:** replace the show-wide reset with a per-episode reversal that books reversing ledger rows, or restrict it, and remove the hard-coded fallback.

**Then Path 2 becomes:**
- `/evaluate` → a read-only **preview** using the same scoring code (a dry run);
- `/override` → removed, or an explicit input that `completeEpisode` honours;
- `/accept` → a thin alias that returns `already_completed` (with the beat 14 retry), then removed.

**Must be preserved:** the single transaction; the episode lock; ledger-derived coins; payout deduplication; the below-zero and reopened-terms refusals; accepted history never overwritten; drafts (story record, follower change) needing Evoni's approval.

---

## 13. Correction (2026-11-04, from P0 fix A, #3706)

§1.1 and §4 row 6 said that CFO, AI Costs, Site Organizer, Design Agent, Decision analytics and the Recycle bin have "no admin check". **For the server, that was partly wrong.**

- **Already admin-only on the server** (only their *pages* lacked a check): CFO, AI Costs, Decision Analytics, Site Organizer, Design Agent, Audit Logs and the Website admin writes.
- **The real server gaps** were the **Recycle Bin** (list, restore, permanent delete) and the **Amber diagnostic engine** (scan, approve, execute Claude Code, queue). #3706 makes both admin-only and adds an "Admins only" page wrapper.
- **The debug and seed routes** are handled in #3705.

## 14. Studio by Sable: the representative brand case (read only, 2026-11-04)

Evoni ran the read-only query on production (`SET default_transaction_read_only = on`, exit 0, 9 sections) and pasted the output. Nothing was changed: no split, no post reassignment and no relationship edit.

### What exists

| Record | Rows | What it says |
|---|---|---|
| Pulse profile `social_profiles` | 447 live, 446 deleted 2026-09-25 | Both are `@studiobysable`. Live 447 is "STUDIO BY SABLE", creator Sable Okonkwo-Reyes, `crossed`, home Echo Park, Los Angeles. Deleted 446 was creator Sable Orin Voss in the Dazzle District. Neither has `account` or `lalaverse_brand_id` in `full_profile`, and `public_persona` is empty. |
| Registry character | c4931651 (`studiobysable`, accepted, LalaVerse registry, feed_profile_id 447) | `display_name` is the studio ("STUDIO BY SABLE"); `selected_name` is the person ("Sable Okonkwo-Reyes"). No `company_id` or `brand_id`. The description calls her an Instagram creator and designer. |
| Brand registry `lalaverse_brands` | none | The studio has no brand record. |
| World character `world_characters` | none | Sable is not a Dream Cities resident. |
| Locations | showroom cccb4abe live (city "Echo Park", boutique); studio cc428e69 deleted 2026-10-04 (Dazzle District) | |
| Scene sets | 7 rows, 2 live | One live "STUDIO BY SABLE's Studio" is linked to the showroom. One live "Sable Okonkwo-Reyes's Place of work" is linked to no location. Its 4 deleted duplicates were all deleted on 2026-10-23 within 80 seconds. |
| Events | 9 rows, 5 live | See below. |
| Opportunities | 1 | "Spring Capsule Campaign Model", booked, offered in Episode 1 (8b9301a6). |
| Pulse posts | 5, all on 2026-10-17 | 2 other posts mention Sable. |
| Relationships | 6 Pulse rows, 10 registry rows | See below. |

### Events

| Event | Status | Date | Host text | source_profile_id | Note |
|---|---|---|---|---|---|
| Wearable Experiments Studio Session | used, Episode 1 | 11-12 | STUDIO BY SABLE | 447 | |
| Fabric and Form | draft | 11-12 | STUDIO BY SABLE | 447 | Same day as the used event. |
| Fit Check with Stable | draft | 11-09 | STUDIO BY SABLE | none | "Stable" is a typo. |
| Spring Capsule Campaign Model | ready | 12-09 | @studiobysable | none | Linked to the booked opportunity. |
| STUDIO BY SABLE — follow-up | draft | 12-10 | STUDIO BY SABLE | 447 | |
| Wearable Visions Preview | used, deleted | 11-12 | STUDIO BY SABLE | 447 | Used in a since-deleted episode. |
| Studio Sable Style Sessions | used, deleted | 11-09 | velvetcore | 448 | Hosted by Marisol Vega's account. |
| Event with studio by sable ×2 | draft, deleted | 11-09 | none | none | |

No event uses `host_brand`. The host is free text in three spellings, and two live events have no profile link.

### Relationships

**Pulse** (`social_profile_relationships`, all mutual, all "From the story"):
- rival: firstlightstudio, @showroom.lux, @thriftveil (Declan Ferris);
- mentor: oribeauty;
- couple: @slowsift **and** @velvetcore (Marisol Vega).

**Registry** (`character_relationships`, all Active):
- rival_brand: First Light Studio;
- client_partner: Velour Atelier;
- rival: SHOWROOM.LUX, thriftveil;
- love_interest: slowsift and velvetcore;
- friend: velvetcore;
- represents: Ori Beauty, **and also** rival_brand: Ori Beauty;
- collaborator: Lala.

### Findings

- **S1. Person and studio are one record.**
  - The registry character carries the studio's name and the person's name in two fields.
  - Company relationships (`rival_brand`, `client_partner`, `represents`) and personal ones (`love_interest`, `friend`) hang off the same row.
  - There is no brand record to own the studio's events, opportunity, showroom or rivals. This is the merged-identity case named in §5.
- **S2. Contradictory relationships.**
  - Ori Beauty is a mentor (Pulse), a client she represents, and a rival brand (registry), all at once.
  - velvetcore is couple, love_interest and friend.
  - Two partners are both marked romantic and active.
  - The Pulse side says Lala is only `aware`; the registry says `collaborator`.
- **S3. Two Sables in history.**
  - Orin Voss in the Dazzle District was deleted and replaced by Okonkwo-Reyes in Echo Park, LA, with the same handle.
  - The live home and showroom are a real-world neighbourhood, not a Dream Cities district.
- **S4. Event hosting is text, not a link.**
  - There are three host spellings, `host_brand` is never used, and 2 of 5 live events have no `source_profile_id`.
  - A brand page could not list "her events" reliably today.
- **S5. The booked opportunity has no company and pays 0.00.**
  - `brand_or_company` and `company_id` are empty, and the contact is the person.
  - Whether 0.00 is intended (gifted, or exposure only) is not recorded.
- **S6. Scene-set clutter.** One live "Place of work" is unlinked to any location, and 4 duplicates were deleted.

### Proposed target shape (not implemented)

- **Person:** registry character Sable Okonkwo-Reyes, keeping c4931651 so history stays attached. Its `display_name` would become the person's name, but only on Evoni's word.
- **Brand:** a new `lalaverse_brands` row for "Studio by Sable", with `founder` linked to the person, the showroom and studio as its locations, and `host_brand` set on its events going forward.
- **Pulse 447:** recorded as either the studio's account or her personal account (Evoni decides). If it is the studio's account, the posts stay where they are; only the account kind is recorded.
- **Relationships:** company relationships would be re-pointed to the brand, and personal ones stay on the person. Each move is listed and approved one by one; historical rows are kept, not rewritten.

### Questions for Evoni

1. Is `@studiobysable` the studio's account or Sable's own?
2. Which romance is canon: slowsift, velvetcore, both, or neither?
3. What is Ori Beauty to her: mentor, client or rival?
4. Is her home Echo Park, LA (as live) or the Dazzle District (as first written)?
5. Is the Spring Capsule booking meant to pay 0.00?
6. Should "Fit Check with Stable" read "Sable", and should Fabric and Form stay a draft on the same day as the used Episode 1 event?

## 15. Sensitive routes still without a role check (read only, PR #3706 head 9d389bbd, 2026-11-04)

**Method.**
- Every `router|app.(get|post|put|patch|delete)` call (2017 routes) was parsed with its middleware chain, including file-level `router.use` and mount-level guards.
- Of these, 319 are role-guarded, 1503 need sign-in only, 64 use optionalAuth, and 131 had no recognised guard. All 131 were then read by hand: 113 use a spread `admin` array, 10 use other guard forms, and 8 are public by design.
- Handler bodies were scanned for `DELETE FROM`, `TRUNCATE`, `force`, ledger writes, scheduler, budget and queue calls.
- The six High rows were re-read against the #3706 head.

**Already correct** (not findings):
- the evaluation admin reset;
- CFO, budget and scheduler start/stop/run;
- `admin.js`, `seed.js`, audit logs, AI usage and queue monitor;
- `/search/reindex` (group check in the handler);
- after #3706, the Recycle Bin and Amber.
- No unauthenticated route writes data or calls paid AI, apart from login/refresh, the rate-limited poll vote and the token-checked teleprompter remote.

**High** (destructive, ledger or paid AI; only sign-in required):

| Route | File | What it can do | Proposed |
|---|---|---|---|
| POST `/api/v1/franchise-brain/seed` | `franchiseBrainRoutes.js` | `force` runs an unscoped hard `DELETE FROM franchise_knowledge` (all canon) and re-seeds | ADMIN |
| POST `/api/v1/world/:showId/events/bulk-delete` | `worldEvents/episodeBatch.js` | hard-deletes a show's events | **Already ADMIN in #3702** |
| POST `/api/v1/memories/generate-events` | `eventGeneratorRoute.js` | `replace_existing` replaces every world event of the show, plus a paid AI call | #3702 makes the replace link-safe; ADMIN for `replace_existing` is proposed |
| PUT `/api/v1/feed-scheduler/config` | `feedSchedulerRoutes.js` | sets the interval and batch size unchecked and restarts the paid-AI scheduler (start/stop are already ADMIN) | ADMIN + bounds |
| POST `/api/v1/characters/:key/state/update` | `evaluation.js` | manual coin adjustment written to the ledger | ADMIN |
| POST `/api/v1/shows/:id/seed-balance` | `shows.js` | `force` replaces the seed transactions and starting balance | ADMIN |

**Medium:**
- PUT `/shows/:id/financial-config`: starting balance and goal rewards.
- POST `/franchise-brain/activate-all`: activates every pending canon entry without review; these feed AI prompts.
- GET `/jobs`, POST `/jobs/:id/retry`, POST `/jobs/:id/cancel`: every user's jobs, unscoped.
- POST `/wardrobe/bulk/sync-coin-costs`: every show when `show_id` is absent.
- POST `/ui-overlays/:showId/generate-all`: bulk paid image generation, and no `aiRateLimiter`.
- POST `/memories/batch-generate` and `/batch-generate-background`: no cap on the number of briefs.
- POST `/wardrobe/seed`: `clear_existing` hard-deletes.

**Low:**
- Soft bulk deletes: `/assets/bulk/delete`, `/scripts/bulk-delete`.
- Per-domain restore-from-trash routes (feed posts, arc twists, event documents), running in parallel with the now-ADMIN Recycle Bin. Evoni decides whether they follow it.
- GET `/scene-sets/generation-check`: provider-key presence, booleans only.
- GET `/api/v1/debug/routes`: **#3705 already closes it** (off by default, ADMIN).

None of these files is touched by #3706. Each fix would be a separate, reviewable PR on Evoni's approval.
