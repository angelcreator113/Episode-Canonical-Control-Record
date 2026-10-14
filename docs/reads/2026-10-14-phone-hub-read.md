# Read: Phone Hub data today, for the eight-icon home screen

Date: 2026-10-14. Basis: `80150857cc8cb353c069299467b0e919587807a6` (origin/main, #3161). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code, migrations or git history) or **INFERRED**. Task #3121, the read for Lala's Phone spec (`docs/design/2026-10-lalas-phone.md`) §15 build order step 1, "Home screen and navigation". It precedes #3162 (back button), #3163 (eight-icon home screen), #3164 (stats panel) and #3165 (Closet sections).

## Summary

1. **The phone is per-show data, with no fixed screen list (MEASURED).**
   - Every screen and icon is a row in `ui_overlay_types`, and its picture, tap zones and content areas live on an `assets` row (§1).
   - The service says so: "No hardcoded type lists — each show builds its own phone from scratch" (`src/services/uiOverlayService.js:6-7`).
   - The old hard-coded list (`feed`, `wardrobe`, `map`, `calls`, `voice_icon` and others) was deleted in `aba32d47` (#550).
   - So **which of Evoni's screens map to the eight icons is in the production database, not the code.** §6 gives the read-only query that lists them.
2. **Back navigation half-exists (MEASURED).**
   - The shared device component (`PhoneDevice`) already draws "← Back", but only when there is history.
   - The Preview runtime draws its own Back button.
   - No tap-zone action means "back".
   - The editor's dead-end tools add a "Back" zone that jumps **home**, not back (§5).
3. **Five of the eight icons have existing content to point at.** The Pulse, Closet (wardrobe grids), To-do (task list), Location (world map) and Bank (finance "wallet" / money balance) do. **Mail** has only the event invitation. **Call** and **Voice** have no phone feature (§3).
4. **There are no Closet sections today, and Hair has no wardrobe category (MEASURED).** Each wardrobe category is its own content type, with jewelry folded into Accessories (§4).
5. **Followers can be read as of a beat today. Coins, reputation and influence can't (MEASURED).** The only "as of" read for coins (`getBalanceBeforeEpisode`) ignores later episodes. No content type on the phone reads stats as of the beat (§7).

## 1. How screens, icons, tap zones and content areas are stored

### Type rows: `ui_overlay_types` (model `UiOverlayType`)

- **Where it's defined:** `src/models/UiOverlayType.js:6-76`; the table is created in `src/migrations/20260721000000-create-ui-overlay-types.js:5-70`. MEASURED.
- **Columns:**
  - `show_id`, and `type_key`, which is unique per show where not deleted (`:75-79`);
  - `name`;
  - `category`: `phone_icon` or `icon` means an icon, `production` means a production overlay, anything else (default `phone`) is a screen. The frontend classifies them with `isIcon`, `isProduction` and `isScreen` (`frontend/src/lib/overlayUtils.js:19-28`);
  - `beat`, `description`, `prompt`, `sort_order`, `deleted_at`;
  - `opens_screen`, added by `20260725000000-add-opens-screen-and-backfill.js:11-16`;
  - `is_home`, added by `20260726000000-add-is-home-and-style-prefix.js:11-16`;
  - `lifecycle`, added by `20260723000002-overlay-lifecycle.js:11-12`. It is not declared in the model and is read only by raw SQL.
- **A screen's id on the frontend is its `type_key`.** `getAllOverlayTypes` (`src/services/uiOverlayService.js:38-65`) maps `id: r.type_key` and `custom_id: r.id` (`:48,59`), ordered `is_home DESC, sort_order, name` (`:44`).

### Pictures, zones and areas: `assets` rows with `asset_type = 'UI_OVERLAY'`

- **Fields:** `s3_url_processed` / `s3_url_raw` hold the picture. `episode_id` (added by `20260723000002…:21-23`) marks a per-episode copy. Everything else is in `metadata`: `overlay_type` (which links to `type_key`), `screen_links` (tap zones), `content_zones`, `image_fit`, `variant_label`. MEASURED.
- **The listing.** `GET /api/v1/ui-overlays/:showId[?episode_id=]` (`src/routes/uiOverlayRoutes.js:44-206`) **builds its list from the type rows** and attaches matching assets. An episode's own asset replaces the show's asset of the same name (`:94-98`).
  - **An asset with no type row is not listed** (MEASURED from the mapping at ~:109).
  - The finance-apps seed (`POST /shows/:id/seed-finance-apps`, `src/routes/shows.js:852`) inserts **only** into `assets`. Its screens would therefore not appear in the Phone Hub. INFERRED from that rule.
  - The wardrobe "Send to phone" path does add a type row, for exactly this reason (`src/controllers/wardrobeController.js:1538-1557`).

### Icons and how they open screens

- **The link:** `ui_overlay_types.opens_screen` holds the target screen's `type_key`. It is validated on POST and PUT (`uiOverlayRoutes.js:960-968`, `:1030-1043`). MEASURED.
- **Placing an icon on a screen:** an icon is placed as a tap zone in the host screen's `screen_links`, with `icon_overlay_id` (the icon's key) and `icon_url`. The zone's `target` is copied from the icon's `opens_screen` (`pickZoneLibraryIcon`, `overlayUtils.js:160-173`).
- **Pinned icons:** a zone with `persistent: true` on the home screen is drawn on every screen (`PhoneDevice.jsx:87-126,191-193`; `PhonePreviewMode.jsx:327-331`), but only when it has an `icon_url`.
- **A home grid exists, for placement only:** `frontend/src/components/phone/homeGrid.js:8-16` (4 columns, icons 12×9).

### Tap zones

- **Storage:** `metadata.screen_links`, a rectangle in percent `{ id, x, y, w, h, label, target }`, with optional `icon_*`, `persistent`, `conditions` and `actions` (`UIOverlaysTab.jsx:1089-1092`; `overlayUtils.js:55-56,176`). Written by `PUT /:showId/screen-links/:assetId` (`uiOverlayRoutes.js:719-756`). MEASURED.
- **Actions:** the allowlist is `navigate`, `set_state`, `show_toast` and `complete_episode` (`src/services/phoneConditionSchema.js:48-69`; mirrored in `frontend/src/lib/phoneRuntime.js:13`). **There is no `back` action.**
- **Runtime:** `applyActions`, `actionsForZone` and `filterZones` (`src/services/phoneRuntime.js:99-163`), and the saved play-through `POST /tap` (`src/routes/phonePlaythroughRoutes.js:189-245`).

### Content areas

- **Storage:** `metadata.content_zones` `{ id, x, y, w, h, content_type, content_config, conditions? }`. Written by `PUT /:showId/content-zones/:assetId` with bounds checks (`uiOverlayRoutes.js:846-896`). MEASURED.
- **Rendering:** `ScreenContentRenderer` (`frontend/src/components/ScreenContentRenderer.jsx:74-113`) dispatches by `switch (zone.content_type)` (`:122-215`). The registry is `CONTENT_TYPES` (`:26-67`).

## 2. How the homepage is defined

- **The flag:** `ui_overlay_types.is_home`, one per show. `POST /types` and `PUT /types` clear the old home first (`uiOverlayRoutes.js:986-992`, `:1044-1053`). In PUT the clear and the update are not in one transaction. MEASURED.
- **The fallback**, repeated in at least five places: the `is_home` screen with a picture, else the first generated screen (`homeScreenOf`, `frontend/src/lib/phoneHubSummary.js:52-55`; `PhonePreviewMode.jsx:44-48`; `PhoneHub.jsx:304-308`; `UIOverlaysTab.jsx:216,534,686,1220,1551`; `EpisodeLalasPhoneTab.jsx:197`). MEASURED.
- **The start screen:**
  - Phone Hub picks the home (`UIOverlaysTab.jsx:532-537`).
  - Episode playback starts on the home (`EpisodeDetail.jsx:1023-1025`), then resumes the play-through's `last_screen_id` (`PhonePreviewMode.jsx:75-88`; `phonePlaythroughRoutes.js:232,248-275`). MEASURED.

## 3. The eight icons against what exists

The content types are code. The screens that use them are per-show data (§1), so whether a show *has* such a screen is a database question (§6).

| Icon (§2) | Existing content (code) | Gap |
|---|---|---|
| **The Pulse** | `pulse_feed` (`ScreenContentRenderer.jsx:28`, `PulseFeedRenderer` :292), which reads The Pulse as of `storyAt`; also `pulse_messages` (:32) and `feed_*` | none in code; a screen must exist |
| **Closet** | `wardrobe_outfit`, `wardrobe_shoes`, `wardrobe_accessories`, `wardrobe_perfume` (:43-46; `WardrobeGridRenderer` :761); `outfit_card` (:47); `closet_net_worth` (:60) | no single Closet screen type; no sections (§4) |
| **To-do** | `task_list` (:65; `TaskListRenderer` :557, the episode's social tasks) | Shopping list, deal checklist and Career list modes (§5 of the spec) have no content type (`frontend/src/components/phone/ContentAreaPicker.jsx:7-8`) |
| **Location** | `world_map` (:52; `WorldMapRenderer` :1379, `PhoneMapView`) | none |
| **Bank** | `money_balance` (:54), `balance_trend_sparkline`, `income_expense_bars`, `finance_kpis` (:55-59); the finance "wallet" app seed (`shows.js:874-894`) | pending and paid deal payouts: no content type |
| **Mail** | `event_invite` (:51; `EventInviteRenderer` :1267) | no inbox list, no brand-deal or opportunity content |
| **Call** | none | **missing**: no content type, model or route. `calls` exists only in test fixtures and the deleted legacy list |
| **Voice** | none on the phone. In scripts: `voice_activate` (`src/utils/scriptBeatParser.js:39`; the `lala_without_voice_activate` warning :237) and `[UI:CLICK VoiceIcon]` (`src/utils/scriptSkeletonGenerator.js:67-68`) | **missing**: no phone action. The spec makes it an action, not a screen |

All MEASURED, except the gap column's "a screen must exist", which is INFERRED from §1.

## 4. The Closet sections

| Section | Existing | Note |
|---|---|---|
| Outfit | `wardrobe_outfit` (`ScreenContentRenderer.jsx:43`, filter :153-157); `outfit_card` (:47) | wardrobe slot `outfit` (`src/utils/wardrobeSlots.js:23`) |
| Shoes | `wardrobe_shoes` (:44, :158-161) | slot `shoes` |
| Accessories | `wardrobe_accessories` (:45, :162-170) | a catch-all that **includes jewelry** |
| Jewelry | none of its own | slot `jewelry` exists (`wardrobeSlots.js:25`) |
| Perfume | `wardrobe_perfume` (:46, :171-172) | the slot is `fragrance` |
| Hair | **none** | no wardrobe slot or category. Hair exists only as a Lookbook or style-sheet spot (`src/services/episodeLookbookService.js:25`; `src/services/styleSheetService.js:34`) |

There is **no sections mechanism**: one screen holds content areas and tap zones, with no tabs. MEASURED. If a show has separate Shoes, Hair and other screens, they are per-show rows (§6).

## 5. Back navigation today

- **In the shared device component:** `PhoneDevice` shows "← Back" when `navigationHistory.length > 0 && onBack` (`frontend/src/components/phone/PhoneDevice.jsx:215-226`; test `PhoneDevice.test.jsx:142-148`). MEASURED.
- **In the Preview runtime and episode playback:**
  - `PhonePreviewMode` keeps a client-side `history` (`PhonePreviewMode.jsx:41`). `navigateTo` pushes onto it (`:176-195`), `goBack` pops (`:280-291`), and `goHome` clears it (`:293-304`).
  - It draws **its own** Back button in its tap layer (`:362-374`), which replaces `PhoneDevice`'s.
  - History is not saved on the server, only `last_screen_id` and `visited_screens` (`phonePlaythroughRoutes.js:151-165`). MEASURED.
- **In the Phone Hub editor:** `navHistory` (`UIOverlaysTab.jsx:253`, `:1012-1039`) is passed to `PhoneDevice` through `PhoneHub` (`PhoneHub.jsx:433-434`). `ScreenLinkEditor` has its own Back button (`ScreenLinkEditor.jsx:1103-1111`).
- **No `back` tap-zone action exists** (§1).
- **The dead-end warnings** that a built-in back button makes obsolete:
  - `phoneFlowMap` `deadEnds`: screens reachable from home with no outgoing target and no pinned home icon (`frontend/src/lib/phoneHubSummary.js:117-167`, `:151`);
  - the header chip "N dead ends" (`UIOverlaysTab.jsx:1511-1514,1527`);
  - the Connect panel's "can't tap back out" and **"Add back buttons to all N"** (`:2292-2305`). That button calls `handleAddBackButtons` (`:1077-1106`), which adds a zone `{ x:4, y:5, w:18, h:6, label:'Back', target: home.id }`, **a jump home, not a back**;
  - `ConnectScreenList`'s "Dead ends" and "No way back" groups (`ConnectScreenList.jsx:6,20,28,36`);
  - `PhoneMapStage`'s dead-end notes and red key (`PhoneMapStage.jsx:21,35,46,118-154`).

  The finance seed also draws a hand-made back link to `home` on each screen (`shows.js:974`). All MEASURED.
- **Where the phone renders:** `PhoneDevice` is the one device and frame component (`PhoneDevice.jsx:128-243`), used by:
  - Phone Hub's Producer view (`PhoneHub.jsx:416-434`);
  - Phone Hub's Preview stage (`UIOverlaysTab.jsx:1812-1830`);
  - the episode's Lala's Phone tab (`EpisodeLalasPhoneTab.jsx:233-246`);
  - episode playback (`EpisodeDetail.jsx:1018-1036`), through `PhonePreviewMode`'s `tapLayer` (`PhonePreviewMode.jsx:346-427, 595-608`).

  MEASURED.

## 6. What the database holds: the query for Evoni

Which screens and icons Lala's show actually has is per-show data. Before #3163 and #3165 wire anything, Evoni runs this **read-only** query on production, in a session started with `default_transaction_read_only=on`, as for #3145:

```sql
SELECT s.name AS show, t.type_key, t.name, t.category, t.opens_screen, t.is_home, t.sort_order,
       EXISTS (SELECT 1 FROM assets a WHERE a.asset_type = 'UI_OVERLAY' AND a.deleted_at IS NULL
                 AND a.show_id = t.show_id AND a.metadata->>'overlay_type' = t.type_key) AS has_picture
  FROM ui_overlay_types t JOIN shows s ON s.id = t.show_id
 WHERE t.deleted_at IS NULL
 ORDER BY s.name, t.is_home DESC, t.category, t.sort_order, t.name;
```

It returns names, keys and flags only: no images, users or secrets. Its rows let #3163 name, for each of the eight icons, the screen it opens. They also let #3165 name the old Shoes, Hair, Jewelry and other screens to keep as sections.

## 7. Lala's stats as of a beat

**How the phone knows "the beat" (MEASURED):**
- Playback passes `storyAt = beatOrder(episode_number)`, which is `episode × 10 + 5`, "during" the episode (`EpisodeDetail.jsx:1033`; `src/services/storyClock.js:44`).
- The Lala's Phone tab can pin a feed moment's phase (`EpisodeLalasPhoneTab.jsx:209-210`; `pinnedBeatOrder`, Task #3111).
- There is no clock within an episode. The play-through state has no beat (`phonePlaythroughRoutes.js:151-165`).
- Only `pulse_feed` and `pulse_messages` read `storyAt`. The stats content types read the present: `money_balance` (`ScreenContentRenderer.jsx:966-1012`); `profile_stats` (`:474-499`), which shows the profile's free-text `follower_count_approx`, not the ledger.

| Stat | Where it lives | As of a beat today |
|---|---|---|
| **Followers** | the `pulse_followers` ledger, with a `story_order` per change (`src/models/PulseFollower.js:12-31`) | **yes.** `countAt` / `countsAt` (`src/services/pulseFollowers.js:100-119`) and `followersOf(…, at)`, which falls back to the estimate, flagged `estimated` (`src/services/lalaFeedProfile.js:89-103`). Routes: `GET /pulse-followers?at=` (`src/routes/pulseFollowers.js:59-93`) and `GET /social-profiles/lala?at=` (`src/routes/socialProfileRoutes.js:2993-3012`) |
| **Coins** | the `financial_transactions` ledger (`getCurrentBalance`, `src/services/financialTransactionService.js:53-101`); `character_state.coins` is a cache | **partly.** `getBalanceBeforeEpisode` (`:111-128`) subtracts only **this** episode's rows from the current balance, so later episodes' rows still count. `GET /shows/:id/financial-summary` (`src/routes/shows.js:707-829`) builds a rolling balance per `episode_number`, the nearest correct source. Ledger rows with no episode (for example a purchase outside an episode) can't be placed in story order; the summary puts them before Episode 1. Within an episode, stats change only at completion; script `[STAT: coins]` tags are summed in the browser (`frontend/src/lib/beatState.js:53-64`) |
| **Reputation, influence** | `character_state` columns (`src/models/CharacterState.js:23-28`); changes at completion (`src/services/episodeCompletionService.js:484-507`) with a `character_state_history` row (`episode_id`, `state_after_json`) | **no read.** `pulseGrowth.influenceOf` (`src/services/pulseGrowth.js:38-59`) gives influence per episode. INFERRED: the same query on `state_after_json` gives both "as of the latest completed episode before N". Manual edits (`src/routes/evaluation.js:~693-712`) have no `episode_id` |

## 8. Side findings (not part of phase 1)

- **A fallback that can't run (MEASURED).** `getCurrentBalance`'s error fallback queries `character_state_history … deleted_at IS NULL` (`financialTransactionService.js:87-89`), but that table has no `deleted_at` (`src/migrations/20260218100000-evaluation-system.js`; no later migration adds it). If the ledger read failed, the fallback would fail too.
- **The Producer view ignores tap-zone rules (MEASURED).** In the Phone Hub's Producer view, `PhoneDevice`'s own tap overlay follows `target` only and ignores `actions` and `conditions` (`PhoneDevice.jsx:45-84`). The Preview and playback honour them (`PhonePreviewMode.jsx:204-269`).
- **Content-area conditions aren't enforced (INFERRED from the props passed).** `PhoneDevice` doesn't pass `runtimeContext` to `ScreenContentRenderer` (`PhoneDevice.jsx:177-184`; gate at `ScreenContentRenderer.jsx:81-83`), so content-area conditions aren't applied in Preview or playback.
- **Finance-seed screens are invisible (INFERRED, §1).** They have no type rows, so they would not be listed.

## 9. Plan for #3162–#3165, file by file

### #3162: automatic back button

- **`frontend/src/components/phone/PhoneDevice.jsx`:** draw the Back button **whenever the shown screen isn't the home**, not only when there is history. It calls `onBack`, which pops history or else goes home. It keeps the same place and look everywhere. Add a `homeId` prop.
- **`frontend/src/components/PhonePreviewMode.jsx`:** pass `onBack={goBack}` (falling back to `goHome` when history is empty) and `homeId`. Remove its own tap-layer Back (`:362-374`), so there is one button.
- **`frontend/src/pages/UIOverlaysTab.jsx` and `frontend/src/components/phone/PhoneHub.jsx`:** the editor passes `onBack` and `homeId` the same way.
- **`ScreenLinkEditor.jsx`:** its own Back stays (it's an editor control); say so.
- **Obsolete dead-end warnings:**
  - `frontend/src/lib/phoneHubSummary.js`: `phoneFlowMap` stops reporting `deadEnds`, because every non-home screen now has a way back.
  - `UIOverlaysTab.jsx`: remove the "N dead ends" chip, the Connect panel's "can't tap back out" and "Add back buttons", and `handleAddBackButtons`.
  - `ConnectScreenList.jsx`: drop the "Dead ends" / "No way back" groups.
  - `PhoneMapStage.jsx`: drop the dead-end notes and key.

  `unreachable` and dead links stay.
- **Kept as they are:** existing hand-drawn back zones, and the finance seed's back link. List them in the PR.
- **Tests:** `PhoneDevice.test.jsx` (shown on non-home screens, absent on home, with or without history); `PhonePreviewMode` (back pops, else home); `phoneHubSummary.test.js` (no `deadEnds`); the Connect panel (no dead-end warnings).
- **No migration.**

### #3163: home screen with the eight icons

- **First, from the §6 query:** which screen opens for each icon.
- **Where the mapping lives (a decision for Evoni, §10):**
  - **(a)** `shows.metadata.phone_home`, `{ pulse, closet, todo, location, bank, mail, call: type_key|null }`, with no migration. `shows.metadata` already holds settings such as `required_slots`. **Recommended.**
  - **(b)** a `home_slot` column on `ui_overlay_types`, which needs a migration.
- **Backend:** read and write the mapping, either through a small route in `src/routes/uiOverlayRoutes.js` (`GET`/`PUT /:showId/home-icons`, validating each key against live screen type_keys, as `opens_screen` is validated) or through the existing show settings PUT.
- **Frontend:**
  - A new `frontend/src/lib/phoneHome.js`: the eight slots in order, with labels and fallback icons.
  - `PhoneDevice.jsx` / `PhonePreviewMode.jsx`: on the home screen, draw the eight icons in the home grid (`homeGrid.js`), each opening its mapped screen.
  - **Voice:** an action, not a screen. A tap fires the Voice cue (a decision, §10); it never navigates.
  - **An unmapped or pictureless slot:** shows "+ Add screen" in the editor (Phone Hub), and is **left out** in playback and Preview.
  - `UIOverlaysTab.jsx`: a "Home icons" panel to pick each slot's screen.
- **Tests:**
  - `phoneHome.test.js`: the order; a missing slot is left out in playback.
  - `PhoneDevice` / `PhonePreviewMode`: each icon opens its screen; Voice doesn't navigate.
  - The editor: "+ Add screen".
  - A route test that the mapping is validated.

### #3164: the stats panel

- **Backend:** a new `src/services/phoneStats.js` with `statsAt(db, showId, { episodeNumber })`:
  - **Coins:** the rolling ledger balance after all episodes numbered below N, plus rows with no episode counted before Episode 1, as `financial-summary` does (`shows.js:757-793`). Not `getBalanceBeforeEpisode` (§7).
  - **Reputation and influence:** `state_after_json` of the latest `computed` history row of a completed episode numbered below N, else the current `character_state`.
  - **Followers:** `followersOf(…, at)`, returned only when **not** `estimated`, else `null`.
  - **Route:** `GET /api/v1/shows/:id/phone-stats?episode_id=` (or `at`, through `resolveAt`, as `pulse-followers` does), with `requireAuth`, in `src/routes/shows.js`.
- **Frontend:** a new content type `home_stats` in `frontend/src/components/ScreenContentRenderer.jsx` (`CONTENT_TYPES` and the dispatch), reading the route with the episode it is shown in, after `PulseFeedRenderer`'s pattern. The followers row is hidden when `null`. Add it to `ContentAreaPicker.jsx` if its kinds list is kept.
- **Tests:**
  - `tests/unit/services/phoneStats.test.js`: coins across episodes, including a later episode's rows, which must not count; reputation and influence from history; followers hidden when estimated.
  - A route test.
  - vitest for `home_stats`.
- **No migration.**

### #3165: Closet sections

- **First, from the §6 query:** the show's Closet, Shoes, Hair, Accessories, Jewelry, Perfume and Outfit screens (keys).
- **Where the section mapping lives:** with the home mapping, `shows.metadata.phone_closet_sections`, `{ outfit, shoes, accessories, jewelry, perfume, hair: type_key|null }`, chosen in the editor.
- **Frontend:**
  - A new `frontend/src/lib/phoneCloset.js`: the sections in order, and `resolveScreen(key)`, which maps an old section screen's key to `{ screen: closetKey, section }`.
  - `PhonePreviewMode.jsx` / `PhoneDevice.jsx`: the Closet screen draws a section switcher; a section shows its old screen's picture, zones and content areas, kept as they are. Navigating to an old section key (a link, a pinned icon, `last_screen_id`) opens Closet at that section.
  - `UIOverlaysTab.jsx`: the Closet sections picker. An unmapped section shows "+ Add screen" in the editor only.
- **Hair** has no wardrobe category (§4), so its section can only show a Hair screen the show already has (a decision, §10).
- **Tests:** `phoneCloset.test.js` (resolving old keys); vitest that Closet shows the sections and an old link lands on its section; Preview and playback alike.
- **No migration. No screen is deleted.**

## 10. Decisions for Evoni before #3163–#3165

1. **Where the home-icon and Closet-section mappings live:** `shows.metadata`, with no migration (recommended), or new columns, which need a migration?
2. **The eight icons on the home screen:** drawn by the phone itself in a fixed grid, the same everywhere (recommended), or kept as icons she places by hand on her home picture, with the eight only checked for presence?
3. **What a Voice tap does in playback for now,** until the script cue language (spec §8) is built: nothing visible, a brief "Lala speaks" toast, or an event the script cue reads later?
4. **The Hair section:** show an existing Hair screen if the show has one, else leave it out of playback (recommended), or add a hair category to the wardrobe (a larger change)?
5. **Coins outside an episode** (for example a purchase from the closet): count them before Episode 1, as the financial summary does (recommended), or leave them out of "as of the beat"?

## 11. Results and rulings (Evoni, 2026-10-14)

**§6, run read-only on production** (session `default_transaction_read_only=on`):
- The show is "Styling Adventures with Lala", with 34 rows: 13 screens, 15 icons and 6 production overlays.
- The home is `homepage`. Every row has a picture.

**The eight icons:**

| Icon | Her icon → opens | |
|---|---|---|
| The Pulse | `the_pulse` → `perfume_page` | **miswired**: `the_pulse_page` exists |
| Closet | `closet_icon` → `closet` | ok |
| To-do | `to_do_list` → `to_do_list_page` | ok |
| Location | `location_icon` → `map_screen` | ok |
| Bank | `wallet` → `homepage` | no Bank screen |
| Mail | none; `messages_icon` → `messages_page` | no Mail screen; the Messages page is pending a ruling |
| Call | `phone` → `homepage` | **miswired**: `phone_call_list` exists |
| Voice | `talking_icon`, opens nothing | ok: an action |

**The Closet sections:**
- `outfit_page` exists, but `outfit_icon` opens `closet`.
- `shoe_page`, `hair_page`, `accessories_page` and `perfume_page` exist and are wired.
- There is **no jewelry page**; `jewelry_icon` opens `closet`.
- `purse_page` (`purse_icon`) is not in the spec's list.

**Rulings** (on §10):
1. **Voice:** a "Lala speaks" toast; no screen.
2. **Hair:** becomes a wardrobe category (its own issue, #3167).
3. **The Closet section list:** stored in show settings (`shows.metadata`), with no migration.
4. **Coins outside an episode:** counted from the start, before Episode 1, as the money summary does. A follow-up: out-of-episode purchases should carry a story-time stamp.

**Change to the §9 plan for #3163:** her homepage and icons stay. Each icon's `opens_screen` already holds the mapping, so no new storage is needed. #3163 checks the eight, flags miswired or missing ones, and offers "+ Add screen" in the editor only.

**Pending Evoni:**
- whether the Messages page serves as Mail;
- whether the Purse page is its own Closet section.
