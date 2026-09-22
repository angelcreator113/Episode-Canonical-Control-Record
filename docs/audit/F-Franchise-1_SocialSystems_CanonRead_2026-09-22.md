# F-Franchise-1 read — Social Systems canon and its readers — 2026-09-22

**Type:** Repository read. NOT a ruling, NOT a fix, NOT a Fix Plan item, NOT a design
proposal. Mints no FD, XK, or PE number.

**Standing:** **MEASURED** throughout — every claim below is a repository read at the
basis SHA on this document's face, re-derivable by the command shown. Nothing here is
ATTESTED, RULED, or INFERRED; where a claim could not be settled by a repo read, this
document says so instead of guessing.

**Basis:** `origin/main` at `8e078addf12fb244f2fd15db9d347faa7a837e3b`, 2026-09-22.

**Task:** #1662.

---

## 0. Prior F-Franchise-1 presence, re-checked

The Audit Handoff's own instrument for F-Franchise-1 is a filename-prefix grep:

```
$ ls docs/audit/ | grep -iE '^F-Franchise-1_'
(no output, exit 1)
```

That instrument re-derives clean — no file with an `F-Franchise-1_` prefix existed
before this one. But a related file **is** on file, under a different name, and
`PROJECT_CONTEXT.md` §6.1's own F-Franchise-1 row already points at it:

```
$ ls docs/audit/ | grep -i "franchise\|directorbrain"
DirectorBrain_FrontendLeg_ScopingNote_2026-07-03.md
```

`DirectorBrain_FrontendLeg_ScopingNote_2026-07-03.md` scoped one slice — the frontend
leg of the write-only pattern (`canonicalRoles.js`, `dreamCities.js`,
`worldStudio.js:3296`'s `DREAM_INFRA`) — and explicitly declined the rest ("Authorizes
no code and no migration," §"What this note explicitly does NOT do"). It already
recorded that `dreamCities.js` carries 5 cities + `UNIVERSITIES`(4) + `CORPORATIONS`(5)
+ `WORLD_LAYERS`(5) as frontend literals, consumed by 8+ files, and that the DREAM
city-name unification migration did not reach them. This document does not re-walk
that ground; §3 below cites it and adds what it didn't cover (the seeder-level legacy
city names) and social-systems-specific material (archetypes, legends, trends, rules)
entirely outside its scope. So: the filename-prefix instrument is accurate as measured,
and this is the first file to carry that prefix — but it is not the first writing on
F-Franchise-1's territory, and this document builds on the scoping note rather than
duplicating it.

---

## 1. Storage: where Social Systems' data lives, and whether edits reach a generator

The page is `frontend/src/pages/SocialSystems.jsx` (`SocialSystems`, four tabs:
Archetypes, Legends & Society, Social Rules, Trends — `TABS`, `:85-90`).

**Two storage layers, merged at render:**

- **Frontend literal defaults.** `frontend/src/data/influencerData.js`
  (`INFLUENCER_DEFAULTS`, `:84-88`: `ARCHETYPES`, `RELATIONSHIP_TYPES`,
  `ECONOMY_STREAMS`, `FASHION_TREND_STAGES`, `BEAUTY_TREND_STAGES`, `MOMENTUM_WAVES`,
  `INFLUENCE_FORCES`, `LEGACY_SIGNALS`) and `frontend/src/data/calendarData.js`
  (`CALENDAR_DEFAULTS`, `:102-106`: `CELEBRITY_HIERARCHY`, `FASHION_TIERS`,
  `BEAUTY_TIERS`, `ALGORITHM_FORCES`, `DRAMA_MECHANICS`, `AWARD_SHOWS`, `GOSSIP_MEDIA`,
  `FAMOUS_CHARACTERS`, `BIRTHDAY_TEMPLATES`).
- **Database overrides.** `usePageData(pageName, defaultsMap)`
  (`frontend/src/hooks/usePageData.js:25-109`) loads saved rows on mount via
  `GET /api/v1/page-content/:pageName` (`:4-7`, handler `src/routes/pageContent.js:13-26`,
  reads the `PageContent` model — table `page_content`, columns
  `page_name`/`constant_key`/`data` JSONB, unique on the pair —
  `src/models/PageContent.js:1-34`) and merges DB values over the defaults key by key
  (`usePageData.js:46-50`: `data[key] = overrides[key] || defaultsRef.current[key]`).
  Saves go through `PUT /api/v1/page-content/:pageName/:constantKey`
  (`usePageData.js:8-12`, handler `pageContent.js:28-48`, an upsert keyed on
  `(page_name, constant_key)`); resets go through the matching `DELETE`
  (`usePageData.js:13-16`, handler `pageContent.js:50-65`). `SocialSystems.jsx:99-100`
  calls this once per source page (`'influencer_systems'` and `'cultural_calendar'`).

**One array bypasses both layers entirely.** `LEGENDARY_GROUPS` — the ten legendary-
influencer role groups shown on the Legends & Society tab — is a plain hardcoded
`const` local to `SocialSystems.jsx` itself (`:12-83`), not a member of either
`INFLUENCER_DEFAULTS` or `CALENDAR_DEFAULTS` (confirmed by reading both maps in full,
above). The render always reads the literal `LEGENDARY_GROUPS.map(...)`
(`SocialSystems.jsx:158`), never `isData.LEGENDARY_GROUPS`. It is folded into the
`PageEditContext` value on the legends tab (`:107`: `{ ...isData, ...ccData,
LEGENDARY_GROUPS }`) but nothing in the file writes it back through `usePageData` —
there is no persistence path for this one array, unlike every other constant on the
page.

**Can an edit reach a backend generator? Yes, but only through a manual, multi-step,
human-gated pipeline — never automatically.** `PageContent` rows are read only by the
route that serves them back to the page (`pageContent.js`) and, elsewhere in the repo,
by `src/routes/worldStudio.js` and `src/routes/uiOverlayRoutes.js` for their own
unrelated page keys — no generator reads the `page_content` table directly (confirmed:
repo-wide grep for `PageContent` returns only those two routes, the route/model files
themselves, and `src/models/index.js`'s registration). The only route out is the
**"🧠 Push to Brain"** button (`frontend/src/components/PushToBrain.jsx:13-59`), which
POSTs the page's current merged data to `POST /franchise-brain/push-from-page`
(`:6-7`; handler `src/routes/franchiseBrainRoutes.js:565-673`, gated on
`PAGE_SOURCE_MAP` — `influencer_systems`/`cultural_calendar` are both mapped,
`:554-563`). That handler serializes the data, sends it through an AI extraction call,
and creates `FranchiseKnowledge` rows with **`status: 'pending_review'`**
(`franchiseBrainRoutes.js:659`) — never `'active'` on creation. A pending entry reaches
`buildKnowledgeInjection()` (§4 below) only after a second, separate, human action:
`PATCH /franchise-brain/entries/:id/activate` (`:168-179`) or the bulk
`POST /franchise-brain/activate-all` (`:184-194`). So the chain is: edit on the page →
save to `page_content` → click "Push to Brain" → AI-extracted entries land
`pending_review` in `franchise_knowledge` → a human activates them → only then can
`buildKnowledgeInjection()` (§4) ever inject them into a prompt. No step in that chain
is automatic; any one of the last three can simply never happen.

---

## 2. Archetype vocabularies

Two genuinely independent vocabularies exist under the name "archetype," never cross-
referenced in code, plus a third, unrelated field often confused with the first:

| Vocabulary | Values | Defined | Read by |
|---|---|---|---|
| **Page archetypes** (`ARCHETYPES`) | 15 narrative types: "The Main Character," "The Trendsetter," "The Beauty Oracle," … (`frontend/src/data/influencerData.js:12-83`, each with `num`/`name`/`icon`/`color`/`content`/`audience`/`narrative`) | `influencerData.js:12` | Only `SocialSystems.jsx:129` (Archetypes tab). Part of `INFLUENCER_DEFAULTS`, DB-overridable via `page_content` (§1). No backend file references `ARCHETYPES` or matching content (grepped `src/` for the 15 names; no hits). |
| **`SocialProfile.archetype`** (DB ENUM) | 10 psychological/behavioral types: `polished_curator`, `messy_transparent`, `soft_life`, `explicitly_paid`, `overnight_rise`, `cautionary`, `the_peer`, `the_watcher`, `chaos_creator`, `community_builder` | `src/models/SocialProfile.js:37` (the ENUM) | Generated onto every new `SocialProfile` row by the AI-profile generator's own prompt, which lists the same 10 values verbatim as the model's only valid answers (`src/routes/socialProfileRoutes.js:160`). Re-copied as a private literal in three more files, none importing a shared constant: `CHARACTER_FOLLOW_PROFILES[*].archetype_affinity` (`socialProfileRoutes.js:531-619`, JustAWoman's and Lala's per-archetype follow-weight tables); `eventAutomationService.js`'s `ARCHETYPE_EVENT_FIT` (`:80-91`, which event types each archetype can host); `feedProfileUtils.js`'s `ROLE_TO_ARCHETYPE` (`:8-12`, maps a character-relationship role to one of these 10). |
| **`content_persona`** (free text, not a vocabulary) | Prose, "2-3 sentences: what they show the world. The curated version." | Generated per-profile by the same AI call (`socialProfileRoutes.js:167`) | Display only, alongside the sibling free-text field `real_signal` (`:168`, "what is actually leaking through"). Neither is a fixed list; neither is read by any other service (grepped `content_persona` and `real_signal` across `src/`: only this generator's prompt and the `SocialProfile` model column definitions). |

A closely related, separately-fixed vocabulary sits under `CHARACTER_FOLLOW_PROFILES`
too: `category_affinity` (`socialProfileRoutes.js:538-548`), ~27 content-category
weights (`fashion`, `beauty`, `lifestyle`, `motherhood`, …) that the free-text
`content_category` field (`SocialProfile.js:36`, `STRING(100)`, no ENUM) is presumably
matched against at follow-score time — this document read the weight table but did not
trace the matching code past `computeFollowProbability`'s signature
(`socialProfileRoutes.js:622-627`); left unresolved rather than guessed.

**No code anywhere maps the page's 15 `ARCHETYPES` to the 10 `SocialProfile.archetype`
ENUM values, or vice versa.** They are disjoint vocabularies about different things —
narrative role-in-the-story (page) versus psychological/behavioral pattern (DB field)
— that happen to share the English word "archetype." See §6.

---

## 3. City vocabularies

Three generations of city names exist, only the newest two-thirds migrated:

| Generation | Names | Where |
|---|---|---|
| **Oldest** (`SocialProfile.city`, still-valid ENUM values) | `nova_prime`, `velour_city`, `the_drift`, `solenne`, `cascade_row` | `src/models/SocialProfile.js:129-132`, commented `// legacy` in the model itself, alongside the current values in the same `ENUM(...)` call — never dropped from the type. |
| **Middle** ("Infrastructure-style" names) | `Velvet City`, `Glow District`, `Pulse City`, `Creator Harbor`, `Horizon City` | Still literal today in five files, none updated by the rename migration below: `src/seeders/20260312200000-world-infrastructure-franchise-laws.js:27-107,188-201` (writes `franchise_knowledge`, `category: 'franchise_law'`, `severity: 'critical'`, **`always_inject: true`** — see §4); `src/seeders/20260312500000-character-life-simulation-franchise-laws.js:54-58,108,198-202`; `src/seeders/20260312600000-cultural-memory-franchise-laws.js:78-80,214`; `src/seeders/20260312300000-social-timeline-franchise-laws.js:196`; `src/seeders/lalaverse-cultural-calendar.js:193`. |
| **Current (DREAM)** | `Dazzle District`, `Radiance Row`, `Echo Park`, `Ascent Tower`, `Maverick Harbor` (`snake_case` DB values: `dazzle_district`, etc.) | `src/routes/worldStudio.js:3296-3335` (`DREAM_INFRA`, the one-time seed payload for `POST /world/locations/seed-infrastructure`, writes real `WorldLocation` rows); `src/routes/calendarRoutes.js:48-56` (category→city map); `frontend/src/data/dreamCities.js:9-69` (`DREAM_CITIES`, 5 entries, plus a 4-item academy list — already catalogued by the scoping note, §0); `frontend/src/pages/feed/feedConstants.js:78-82` (a second, independent 5-entry list for Feed filtering UI, `value`/`label`/`desc`/`letter`/`color` — not the same object shape as `dreamCities.js`'s, not imported from it). |

The rename migration, `src/migrations/20260725000000-unify-dream-cities.js:1-70`,
`UPDATE`s live rows only — `social_profiles.city` (old↔new map, `:29-41`) and
`world_locations.city`/`.name` (two separate old-name maps: the oldest generation at
`:44-50`, the middle "Infrastructure-style" generation at `:53-69`). It never touches
seeder *source files* — so the five seeder files above still emit the middle
generation's names verbatim, and would reintroduce them into `franchise_knowledge` if
re-run (`POST /franchise-brain/seed`, `franchiseBrainRoutes.js:100-106`, actually
executes these seeder files' `.up()` against the live DB — not a hypothetical
re-run path).

**`PROJECT_CONTEXT.md` §3's own claim, checked precisely:** it names "legacy city
names still in the feed scheduler." Grepped for all five middle-generation names and
all five oldest-generation names in `src/services/feedScheduler.js` and
`src/routes/feedSchedulerRoutes.js`: **no hits in either file.** Also checked
`src/services/feedEventPipelineService.js` and `src/services/seasonalEventService.js`:
no hits. The legacy names this document found are all in the seeder files listed
above, which feed `franchise_knowledge`, not in anything literally named "feed
scheduler." This document does not resolve why `PROJECT_CONTEXT.md` locates the drift
there — it may describe a different code state than this basis, or use "feed
scheduler" loosely for the wider automated-event-generation surface the seeders feed
into. Recorded as a discrepancy between that document's prose and this read, not
resolved either way.

---

## 4. Trends, legends, and social rules: generator-read or display-only?

**Display-only, with one exception that is itself unreachable.** Every constant name
from `INFLUENCER_DEFAULTS` and `CALENDAR_DEFAULTS` (§1's two lists — all of the Social
Rules and Trends tab content, plus `CELEBRITY_HIERARCHY`/`FAMOUS_CHARACTERS`/
`GOSSIP_MEDIA` on the Legends tab) was grepped by name across `src/`: **zero hits** —
no backend file imports or duplicates any of `MOMENTUM_WAVES`, `ALGORITHM_FORCES`,
`DRAMA_MECHANICS`, `FASHION_TREND_STAGES`, `BEAUTY_TREND_STAGES`, `RELATIONSHIP_TYPES`,
`ECONOMY_STREAMS`, `INFLUENCE_FORCES`, `LEGACY_SIGNALS`, `CELEBRITY_HIERARCHY`,
`GOSSIP_MEDIA`, or `FAMOUS_CHARACTERS` by name or matching content. `src/services/
feedEngagementService.js` computes its own, independently-implemented trend/momentum
concept (`:9-10,69-136`: hashtag-based `trendingTopics` extraction, a normalized
`momentum` score "that feeds into event pipeline") — a real generator-side mechanism
under the same English words, but it does not read this page's `MOMENTUM_WAVES` list
or anything shaped like it.

The one exception: `LEGENDARY_GROUPS` (§1's un-persisted array) has a near-duplicate on
the backend — `src/seeders/20260312200000-world-infrastructure-franchise-laws.js:176-
230`+ ("The 50 Legendary Influencers," same ten group names, near-identical role/
function/signature text) seeds `franchise_knowledge` with `category: 'franchise_law'`,
`severity: 'critical'`, **`always_inject: true`** (`:198-200`) — the two flags
`buildKnowledgeInjection()` (`franchiseBrainRoutes.js:694-714`) selects on
unconditionally (`where: { status: 'active', [Op.or]: [{ severity: 'critical' },
{ always_inject: true }] }`). If this seeder is ever run and its resulting entries
reach `'active'` status (§1's activation step), **this is the copy a generator would
actually receive** — not the frontend page's. The two copies have already drifted:
the seeder's text still reads "Velvet Muse," "Velvet City's aesthetic," and "Velvet
Season" (`:188`) and "Velvet Academy" (`:201`) — the middle-generation city names
(§3) — while the frontend's `LEGENDARY_GROUPS` already reads "Dazzle Muse," "Dazzle
District's aesthetic," and "Dazzle Season" (`SocialSystems.jsx:15`). Whichever one a
generator sees depends entirely on whether `POST /franchise-brain/seed` has been run
and activated at all — this document did not query the live database to check, per its
own no-database-contact standing (see Guardrails).

---

## 5. Relation to `PROJECT_CONTEXT.md`'s F-Franchise-1 description (citation only)

`PROJECT_CONTEXT.md:64` states the keystone's premise: *"the franchise tier is
currently write-only: `Universe` is read by three shallow routes and no generator;
every generator carries its own canon literal (`WORLD_CONFIGS`, `DREAM_INFRA`,
`CHARACTER_FOLLOW_PROFILES`, `SEED_GOALS`, `JAWIHP_VOICE_DNA`, frontend `data/*.js`),
and those copies disagree (three different 'Book 1 casts', two Lala origin stories,
legacy city names still in the feed scheduler)."*

This document relates to that sentence by citation only — it does not re-derive the
`Universe`/three-shallow-routes claim, the "Book 1 casts" claim, or the "two Lala
origin stories" claim; those are outside Social Systems' scope (§ the issue's own Do
list, items 1-4) and untouched here. What this document *does* independently confirm,
for the two literals the sentence names that intersect Social Systems: `DREAM_INFRA`
is real and exactly where the sentence says (§3); `CHARACTER_FOLLOW_PROFILES` is real,
and its `archetype_affinity` vocabulary is one of the (at least) four independent
copies of the 10-value `SocialProfile.archetype` ENUM this document found (§2) — a
finding the cited sentence does not itself make, since it names `CHARACTER_FOLLOW_
PROFILES` only as one literal among several, not as part of a specific vocabulary
that recurs elsewhere. The "legacy city names still in the feed scheduler" clause is
addressed, and not confirmed as written, in §3.

---

## 6. Observation: social archetypes and content personas may be two different dimensions

Recorded as an observation this document's own reads support, not a ruling — Evoni has
not ruled on this. §2 found two vocabularies sharing the word "archetype" with no code
path between them: the page's 15 narrative role-types (`ARCHETYPES`, editable, DB-
backed) and the 10-value psychological/behavioral `SocialProfile.archetype` ENUM
(generated, read by follow-psychology and event-fit logic). A third field,
`content_persona`, is free prose, not a vocabulary at all, and does not obviously map
onto either. Whether the product intends one profile to eventually carry a value from
*each* dimension (a narrative archetype *and* a behavioral archetype, describing
different things about the same creator), whether one of the three is meant to
supersede another, or whether this is simply organic drift from being built at
different times for different purposes, is not something this read settles.

---

## 7. What this read does not do

- Rules nothing. Every "should"-shaped sentence above is either a direct quote of
  another document (§5) or absent — this document states what is, not what ought to
  be.
- Fixes nothing. No code, seeder, migration, or frontend file was changed.
- Files no Fix Plan item and mints no FD, XK, or PE number — this is a standalone
  MEASURED note, exactly as its own header states.
- Does not change the locked sequence (`F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1
  Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= Director Brain) →
  F-Sec-3`, re-confirmed unchanged at `Prime_Studios_Audit_Handoff_v26.md` Sec 2 at
  this session's `/wake-up`). F-Franchise-1 remains queued, last but one; this is a
  prep read ahead of its fixes, not a start of the fixes themselves — see Guardrails.
- Does not resolve §3's `PROJECT_CONTEXT.md` discrepancy, §4's "which copy would a
  generator actually see" question (no database contact was made to check
  `franchise_knowledge`'s live `status` values), or §6's two-dimension observation.
  All three are left open, precisely because settling them would be design or ruling
  work, not a read.
- Does not touch `dreamCities.js`'s frontend-consumer list (8+ files), `canonicalRoles.js`'s
  triple-homing, or either "Book 1 cast"/Lala-origin-story claim — all already scoped
  or explicitly out of scope by `DirectorBrain_FrontendLeg_ScopingNote_2026-07-03.md`
  (§0) or by this task's own Do list.

---

## Footer

**Type:** Standalone MEASURED note. Not a Fix Plan revision, not a Cross-Keystone
Register ratification, not a Session PE Roster entry.

**Rules:** Nothing.

**Mints:** Nothing — no FD, XK, or PE number.

**Host / AWS / database / Cognito contact:** None. Every claim above is a static
repository read (`grep`, `ls`, `git`, `Read`) against the working tree at this
document's basis SHA. No `franchise_knowledge` row's live `status` was queried, per
this task's own no-database-contact scope (§4, §7).

**Locked sequence:** Unchanged. F-Franchise-1 (= Director Brain) remains queued,
gated behind F-Stats-1 Phase B, F-Ward-1, F-Reg-2, and F-Ward-3, per
`Prime_Studios_Audit_Handoff_v26.md` Sec 2, re-confirmed at this session's `/wake-up`
and not altered by this document.

**Prod FROZEN** status: not applicable to this document's own actions (no host/AWS/DB
contact was made, per above); the repository's own current standing per `CLAUDE.md`'s
Non-negotiables is that the production freeze was lifted by Evoni's ruling in
`docs/audit/F-Deploy-1_Fix_Plan_v1.53.md` (2026-09-20) — agent sessions still never
contact production directly regardless. This document made no such contact.
