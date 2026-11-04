# Screen-level navigation and ownership blueprint (2026-11-04)

**Status:** a design proposal only. Nothing here is implemented.
**Basis:** origin/main after #3700 (`1b5e8c70` + #3700), and the platform audit `docs/reads/2026-11-04-platform-architecture-audit.md` (cited as "audit §n").
**What it follows:** Evoni's rulings of 2026-11-04 (audit §11):
- the target workspaces are WORLD, SHOWS, SEASON, EPISODE, LALA, WRITE and an admin-only SYSTEM;
- Producer Mode stays as a transitional hub;
- one Complete workflow is to be designed;
- the Character Registry owns identity;
- brands get authoritative records;
- nothing is hidden or removed without dependency checks.

**How to read it:**
- Each page names one **primary action**, the **essential information** it shows, the **owner record** it reads and writes, and its **links** to other levels.
- **Reuse** names the existing component the page starts from. "New" means no component does that job today.
- **Owner** is the authoritative table or service (audit §2). Other pages show a summary plus a link back to it; they never edit a copy.

**Shared rules on every page:**
- **Breadcrumbs:** Workspace › Record › Tab, for example `SEASON › Season 1 › Event Board`.
- **One state badge vocabulary:** draft · ready · approved · completed. A record shows its owner's state; a summary shows the same badge.
- **Attention first:** the top of each workspace home lists what needs a decision now, with a count in the sidebar.
- **Lists:** search, filters, and paging at 25 rows. Every list row links to its owner page.
- **Context, not copies:** a page shows a few fields from another record plus a "Open in …" link.
- **Phone width:** every page works at 375px.

**The governing principle** (Evoni, 2026-11-04): *Dream Cities creates life, Lala has to afford that life, and JustAWoman decides how she navigates it.* Every screen below answers to one of these three. A page that blurs them is redesigned, not patched.

| Principle | Where it lives | What it means for a screen | What a screen must never do |
|---|---|---|---|
| **Dream Cities creates life** | WORLD (and the world side of SEASON's Event Board) | Places, people, brands, events, prices and opportunities exist and move on the world's own calendar, whether or not Lala takes part. A WORLD page shows what is out there and what it costs. | Shape the world around Lala's plans, or hide something because she can't afford it. |
| **Lala has to afford that life** | LALA (wallet, obligations, standing, wardrobe, goals), echoed on every offer | Any choice the world offers shows its price next to what she has: balance, obligations due, and what the choice would earn or cost. Money moves only through the ledger. | Make something free that the world prices; change a balance outside the ledger; count money that hasn't been earned. |
| **JustAWoman decides how she navigates it** | The decision points: accept, negotiate or decline an offer; start or skip an event; spend; dress; complete an episode | Each decision is an explicit, named control with its consequence shown first. The system proposes; she chooses. Nothing is accepted, paid, completed or reassigned automatically. | Auto-accept, auto-complete or auto-correct on her behalf; turn a proposal into canon without her yes. |

Each page table below therefore marks its **primary action** as one of three kinds:
- *observe the world*;
- *see what it costs Lala*;
- *JustAWoman decides*.

---

## 1. WORLD (Dream Cities: what exists, independent of Lala)

| Page | Primary action | Essential information | Owner record | Links | Reuse |
|---|---|---|---|---|---|
| **World home** | See what is happening in the Dream Cities this week | world date (once the world clock exists); events this week by city; new characters; Pulse trends; attention (unlinked profiles, orphan events) | `world_events`, `world_locations`, `feed_posts` (read) | event → World Calendar; character → Registry; "Plan for Lala" → SEASON Event Board | `UniversePage` overview tiles |
| **World map & places** | Find or edit a city, district, venue | city → district → venue tree; each venue's scene set and photos; events held there | `world_locations` (parent chain; the city as a location id) | venue → events list; scene set → SHOWS Assets | `WorldFoundation` (map, locations), `DreamCityExplorer`, `PropertyManager` |
| **World Calendar** | See and place world and cultural events by **world date** | month/week grid; cultural windows (`story_calendar_events`); world events with status; who is attending; whether an episode uses it | `world_events` (dates), `story_calendar_events` | event → Event record; "use in a season" → Event Board; attended by Lala → EPISODE | `CultureEvents`, `WorldMomentsTab`, `SeasonCalendar` (one grid) |
| **Event record (world view)** | Read an event as it exists in the world | host, venue, date, guests, cost, deal terms summary; "Lala's status": not invited / invited / pencilled / episode | `world_events` | "Plan for Lala" → SEASON Event Package; host → Brand or Character | `EventPackagePage` read mode (no second editor) |
| **Characters (Registry)** | Find or edit a character's identity | name, role, city, Pulse profile link, brand link, relationships summary | `registry_characters` (identity owner, ruling 4) | Pulse profile → The Pulse; relationships → Relationships; "generate" → World Studio | `CharacterRegistryPage`, `CharacterProfilePage` (split by tab) |
| **World Studio (generator)** | Generate new characters or feed profiles, then commit them to the Registry once | generation drafts; their commit state | drafts in `world_characters`; commit → `registry_characters` | committed → Registry | `WorldStudio` (with fix C: no broad overwrites) |
| **Relationships** | See and edit how characters relate | one graph with layers (story, Pulse, brand); a filter for "with Lala" | `character_relationships`; Pulse layer read from `social_profile_relationships` | person → Registry; event that changed it → EPISODE story record | `RelationshipEngine`, `FeedRelationshipMap` (as a layer) |
| **Brands** (list + profile) | Manage a brand and its people, events, deals and Pulse | identity; founder and reps; events hosted; deals and payments; Pulse account; rivals; trust | `lalaverse_brands` + typed links (audit §5, ruling 5) | deal → SEASON Opportunities; event → Event record; rep → Registry; Pulse → The Pulse | `CompaniesPage`, `BrandProfilePage`, the per-brand card from `PulseBrands` |
| **The Pulse** | Read the feed; draft and approve posts | feed by city and person; profiles; DMs; the review queue count | `feed_posts`, `social_profiles`, `pulse_followers` | post → its episode or event; profile → Registry person | `SocialMediaPage`; Admin › Pulse review as the queue |

## 2. SHOWS (the franchise: what the show is)

| Page | Primary action | Essential information | Owner record | Links | Reuse |
|---|---|---|---|---|---|
| **Shows list** | Open or create a show | cover, status, current season, next release | `shows` | → Show home | `ShowManagement`, `CreateShow` |
| **Show home** | See the show's state and open its current season | current season health; next release; Lala snapshot (money, stats, link to LALA); attention | `shows`, `show_arcs` (read) | → SEASON home; → LALA; → Release | `ShowOverview`; Producer Mode stays reachable as the transitional hub (ruling 2) |
| **Show settings** | Edit show identity and rules | name, cover, logo, Lala's home (as a location link), finance rules, distribution defaults | `shows` (+ typed metadata keys) | — | **merges** `EditShow` + Admin › Show settings (audit §3) |
| **Show Bible** | Keep canon rules | knowledge, decisions, documents, guard | `franchise_knowledge` | rule → where it is used | `ShowBiblePage` |
| **Assets & Wardrobe** | Find, upload or approve a picture, piece, scene set or overlay | one library with filters (type, character, episode, approval) | `media_assets` (library) + `assets` (files); `wardrobe`; `scene_sets` | piece → the episodes that used it; scene set → its venue in WORLD | `AssetLibrary`, `SceneSetsTab`, Producer Mode's inline wardrobe (moved), `ProductionOverlaysTab` |
| **Phone Hub** | Build Lala's phone (screens, icons, wiring) | screens, icons, opens-screen wiring, missing art, path check | `ui_overlay_types` | → EPISODE phone moments | `UIOverlaysTab` (one mount) |
| **Release & Distribution** | Schedule and publish episodes | release schedule, `air_date`, platform defaults, insights | release schedule (computed) + `episodes.air_date` | episode → EPISODE › Distribution | `ReleaseBoard`, `ShowDistributionTab`, `ShowInsightsTab` |

## 3. SEASON (Producer: what I'm making next)

| Page | Primary action | Essential information | Owner record | Links | Reuse |
|---|---|---|---|---|---|
| **Season home** | Decide the next thing to do in this season | attention (needs a decision); health; parts; next open slot; next release | `show_arcs`, `season_slots` | slot → Roadmap; attention item → its owner page | `SeasonPage` Overview |
| **Roadmap** | Plan slots: purpose, pressure, pencilled event | slots by part, with story order and world dates side by side (chronology warnings) | `season_slots`, `season_specials`, `seasonStoryOrder` | slot → Event Board (pick) or Event Package; episode → EPISODE | `SeasonPageRoadmap`, `SeasonPlan` slot panel |
| **Event Board** | Choose an existing world event for a slot | ranked candidates with the reason each fits (money, goals, friends, dates, eligibility, income, continuity); pencil (logged) | read: `world_events`, ledger, goals, relationships; write: `season_slots.event_id` + `decision_log` | candidate → Event record (WORLD); pencilled → Event Package | `rankEventsForSlot` / `scoreForSeason` (one ranker), `SlotNotes` |
| **Event Package** | Make the event ready, then Start the episode | readiness (enforced on the server); people; place; Lala's look; deal & money; documents; offer decision; **Start** | `world_events` (the only editor), its documents, guests, deliverables | Start → EPISODE; host → Brand; guests → Registry; venue → World place; "Back to world" → Event record | `EventPackagePage` + its hooks; `EventLibrary` editor and `EventDetailsModal` fold into it |
| **Opportunities & Deals** | Decide on offers (consider, negotiate, accept, decline) | offers by status; brand; terms; linked event; payment state (pending/paid from the ledger) | `opportunities` (decision), event terms, ledger | brand → Brand profile; event → Event Package; payout → LALA › Money | `OpportunitiesTab`, `RateCardTab` |
| **Goals** | See and adjust Lala's career goals | goals with measured progress and source (ledger, stats, approved work); coverage by slot | `career_goals` (measured) | goal → the event or episode that moved it | `CareerGoals`, `GoalCoverage`; the finance goal ladder moves here |
| **Story** | Keep threads, plants and cast straight | open threads; plants and payoffs; who appears where | `show_story_threads`, plants, story records (read) | thread → the episode that opened it | `SeasonStoryTab`, `SeasonPlants`, `SeasonCast` |
| **Results** | Review completed episodes | episode ledger, outcomes, slot results | episodes (accepted), `season_slots` outcomes | → EPISODE › Complete | `SeasonResultsTab`, `EpisodeLedger` |

## 4. EPISODE (Prime Studios: making one episode)

| Tab / page | Primary action | Essential information | Owner record | Links | Reuse |
|---|---|---|---|---|---|
| **Overview** | See what this episode is and what's missing | brief (labelled snapshot); event summary; slot; readiness; Air Date (fixed by D) | `episodes`, `episode_briefs` (snapshot) | event → Event Package; slot → Roadmap | `EpisodeOverviewTab` |
| **Script** | Write and lock the script | 14 beats; phone cues; health; voice status | `episodes.script_content` via `scriptSave` | cue → Phone Hub; piece → Wardrobe | `EpisodeScriptTab` (the Script Writer page folds in as a generate action) |
| **Production** | Make the pieces | wardrobe and look; style page; phone moments; overlays; scenes and plan; files and footage; voice | `episode_wardrobe`, `episode_raw_clips`, `line_voice_*`, `ui_overlay_types` (read) | piece → Assets & Wardrobe; venue → World place | existing Production pills, grouped; `/plan` and `/todo` fold in |
| **Edit** | Cut the episode | edit status; open the Editor | edit records | → Editor (full screen) | `EpisodeEditTab`, `EpisodeEditor` |
| **Complete** | Evaluate and accept the episode, once, with explicit approval | proposed outcome; money summary (ledger preview); stat changes; goal changes; deliverables state; offers left open; "Accept" | `completeEpisode` (one path, after the read-only comparison) | after accept → LALA (money, stats); → Story record | new tab over `completeEpisode`; `/evaluate` folds in |
| **Story record** | Approve what changed (after Complete) | relationships, follow-ups, threads, secrets | `episode_story_records` → target tables | person → Registry; thread → SEASON › Story | the story record card (one place) |
| **Distribution** | Set the release | release date, thumbnails, platforms | `episodes.air_date`, release schedule | → SHOWS › Release | `EpisodeDistributionTab` |

## 5. LALA (Character Life: her life as of now)

| Page / tab | Primary action | Essential information | Owner record | Links | Reuse |
|---|---|---|---|---|---|
| **Lala home** | See her life right now | world date; available, pending and committed money; stats; next event; open threads; friends' plans | ledger, `character_state`, relationships, `world_events` (read) | money → Money; event → Event Package; friend → Registry | new page assembling existing cards (Home "Lala's journey", Cast & Continuity) |
| **Money** | Understand and manage her money | ledger history; pending income (deliverables awaiting approval); bills and savings (once P6 exists); per-episode results | ledger `financial_transactions` (the only balance) | row → its episode, event or deal | Producer Mode › Lala's Finances (moved), `EpisodeMoneyTab` as a filter |
| **Stats & history** | See how she has changed | reputation, trust, influence, stress, with the reason for each change | `character_state`, `character_state_history` | change → the episode that caused it | `CastContinuity`, the stat ledger |
| **Closet** | See what she owns and wears | owned pieces, value, times worn (computed), wishlist | `wardrobe`, `episode_wardrobe` | piece → episodes; buy → ledger row | Producer wardrobe filters, Finances › Closet |
| **Goals & career** | See where her career is going | career goals (measured), brands worked with, portfolio (once ruling 6 is built) | `career_goals`, brands (read) | goal → Season › Goals | `CareerGoals` summary, `CareerBrands` |
| **Relationships** | See who matters to her | friends, rivals, love interests, with stage and last episode | `character_relationships` (Lala) | person → Registry | Character profile "between them and Lala" |
| **Phone** | Play through her phone as of a beat | phone at a chosen episode beat | phone playthrough state | → EPISODE › Production › Phone | `PhonePreviewMode` (one player) |

## 6. WRITE and SYSTEM

- **WRITE:** unchanged for now. Stories, Threads, Story Calendar, Story Evaluation and the book tools stay where they are. Novel-only tools reached from no link stay untouched until checked (ruling 7).
- **SYSTEM (admin only, enforced on the server by fix A):** Pulse review queue, AI costs, CFO, diagnostics (fix B), audit log, recycle bin, website, templates.

---

## 7. Journey: Dream Cities → event → Season → episode → Lala's life

```
WORLD › World home
  "Rooftop Sunset Soirée, Dazzle District, Dec 3 (world date) — 3 of Lala's people attending"
      │  open event
      ▼
WORLD › Event record (read)          host → WORLD › Brands › <brand>     guests → WORLD › Characters
  Lala's status: not pencilled
      │  "Plan for Lala"
      ▼
SEASON › Event Board (slot 4 selected)
  ranked: fits money (discretionary 412), goal "First Impressions", friend @x attending, date fits slot order
      │  pencil (decision logged)
      ▼
SEASON › Event Package
  readiness ✔ (server-checked) · offer decision (if any) · Lala's look · Start
      │  Start Episode (uses the pencilled slot)
      ▼
EPISODE › Overview → Script → Production → Edit
      │  Complete (one path, explicit approval)
      ▼
EPISODE › Complete: outcome, money, stats, goals, deliverables, open offers → Accept
      │
      ├─► EPISODE › Story record (approve changes) ─► WORLD › Relationships updated
      │
      ▼
LALA › Lala home
  money (ledger), stats with reasons, goals moved, new threads, next suggested event
      │  "Back to the world"
      ▼
WORLD › World home (time moves on; events continue without her)
```

**Way back up from any page:**
- the breadcrumbs (`EPISODE › Ep 2 › Complete`);
- "Open in …" links to the owner record;
- the workspace switcher in the sidebar.

## 8. Transition plan (no implementation yet)

1. **Fixes first.** P0 fixes A–D land, then #3702 and #3703 after review.
2. **Add without removing.** Introduce the five workspace headings in the sidebar, mapping to existing pages; nothing removed (P2).
3. **Build three new pages** over existing data: the LALA home, the SEASON Event Board and the EPISODE Complete tab (P4). Producer Mode keeps its links, so nothing is lost (ruling 2).
4. **Fold duplicates** one at a time, each after a usage check and a redirect: the EventLibrary editor → Event Package; EditShow → Show settings; `/evaluate` → Complete; Finances → LALA › Money (P3).
5. **Retire Producer Mode last,** when every tab has a verified new home (ruling 2).

## 9. Open questions for Evoni

1. **The LALA workspace:** is it per show (Lala in *Styling Adventures*), or one Lala across shows? This blueprint assumes per show.
2. **World home:** should it use the world clock's "this week" before the clock exists? It could fall back to the next 14 days of event dates.
3. **The Pulse:** WORLD (as drawn) or its own workspace?
4. **Assets & Wardrobe:** one SHOWS page (as drawn), or a separate LIBRARY workspace as today?
