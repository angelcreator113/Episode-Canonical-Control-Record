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
