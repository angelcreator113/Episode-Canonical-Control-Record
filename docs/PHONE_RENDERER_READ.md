# Phone renderer read — PhoneHub/PhoneFrame vs PhonePreviewMode

**Basis:** `origin/main` at `baa69a2d945d88c41b745320509aca97e82e52ba` (2026-09-26), this task's `/wake-up` SHA. Task #1967.

**Standing:** every claim is MEASURED — a repo read at the basis, cited `file:line` — unless marked **INFERRED**. Nothing here is ATTESTED or RULED. No host, AWS, database or Cognito contact.

**The requirement this serves:** `docs/DESIGN_DOCTRINE.md` rule 10, *One Lala's Phone* — the Episode's Lala's Phone "must render the same canonical phone shell, apps, navigation and visual language as Producer Mode's Lala's Phone. It is not a separate phone implementation." Today there are two renderers. This read lays out what each draws, takes and writes, so Evoni can pick which becomes the single device before the two-pane Episode tab is built.

Paths below are under `frontend/src/` unless they start with `src/`.

---

## 1. The two renderers

### 1.1 Producer Mode's device — `PhoneHub` with `PhoneFrame`, `ScreenContentRenderer`, `PhoneMapView`

**`components/PhoneHub.jsx`** is the whole Producer Mode phone surface: the device on the left, the Screens / Icons / Placements grid on the right.

- **Props** (`PhoneHub.jsx:296-325`): `screens`, `activeScreen`, `onSelectScreen`, `onEditScreen`, `onDelete`, `onHideScreen`, `hiddenScreens`, `showHidden`, `onToggleShowHidden`, `onNavigate`, `navigationHistory`, `onBack`, `skin`, `onChangeSkin`, `customFrameUrl`, `globalFit`, `gridFilter`, `onEditZones`, `activeTab`, `onChangeTab`, `suppressSectionTabs`. The header comment's `deviceFrame` prop (`:15`) does not exist; the prop is `customFrameUrl` (`:311`).
- **It draws the device through three children:**
  - `PhoneFrame` for the chrome (`:438-443`, `:522`);
  - `PhoneMapView` for a screen named Map (`:450-456`), or the screen image otherwise (`:458-462`);
  - `ScreenContentRenderer` for the screen's content zones (`:464-469`), with `interactive={false}` and no `episodeId`.
- **Tap zones** (`ScreenLinkOverlay`, `:75-112`, mounted `:470`) and **persistent home icons** (`PersistentOverlay`, `:115-152`, mounted `:474-476`) call `onNavigate(link.target)` (`:84`, `:124`). `PhoneHub` owns no navigation state: `navigationHistory` and `onBack` come from the parent (`:497-507`).
- **Owns no data:** no `api.` call, no `phoneRuntime` import, no missions, no playthrough (grep of `PhoneHub.jsx` for `api\.`, `phoneRuntime`, `missions`, `playthrough`, `episode_id`: no match).
- **Exports** `PHONE_SKINS` (`:28-36`) and `getScreenImageStyle` (`:50-72`), which `PhoneFrame` (`phone/PhoneFrame.jsx:1`) and `PhonePreviewMode` (`PhonePreviewMode.jsx:7`) import.

**`components/phone/PhoneFrame.jsx`** is the shared chrome.

- **Props** (`:16-23`): `skin`, `customFrameUrl`, `onCustomFrameLoad`, `onCustomFrameError`, `className`, `children`.
- **Custom frame** (`:28-62`): children inset 6%, the uploaded frame image on top.
- **Built-in skin** (`:65-146`): body tinted by `PHONE_SKINS[skin]`, side buttons, a Dynamic Island, a home indicator, screen area `aspectRatio: '9/19.5'` (`:87`).
- Its header says it "replaces chrome previously duplicated across … `PhonePreviewMode.jsx:416-432`" (`:13-14`). At this basis `PhonePreviewMode` still draws its own chrome (§1.2), so that comment is not true of `PhonePreviewMode`.

**`components/ScreenContentRenderer.jsx`** draws a screen's content zones.

- **Props** (`:58`): `zones`, `showId`, `episodeId`, `interactive`, `runtimeContext`, `screenMeta`, `mapEditable`.
- **Zone types** (`:109-176`): feed posts, profile header and stats, DM thread, notifications, story ring, wardrobe (grid, outfit, shoes, accessories, perfume, price, brand), outfit card, comments, event invite, world map, engagement stats, finance (balance, sparkline, bars, goal progress, goal ladder, KPIs), closet net worth and wishlist, custom text.
- **DM thread and notifications need an episode.** Their URL is `null` unless both `showId` and `episodeId` are set (`:317-319`, `:359-361`), so with no `episodeId` they render empty ("No DMs", `:326`). **INFERRED:** in Producer Mode, where `PhoneHub` passes no `episodeId` (`PhoneHub.jsx:464-469`), DM and notification zones always show their empty state.
- **Condition gating:** it can filter zones by condition when given `runtimeContext` (`:65-67`, `evaluateZoneConditions` `:100`, via `lib/phoneRuntime.js`'s `evaluate`, imported `:16`). No caller passes `runtimeContext` (grep of `frontend/src` for `runtimeContext=`: no match).

**`components/phone/PhoneMapView.jsx`** draws the World Foundation map with city pins.

- **Props** (`:29-35`): `showId`, `episodeId`, `config`, `showBackground`, `fallbackImageUrl`.
- `isMapScreen` (`:354-357`) treats a screen named `map`, `world map`, `world-map` or `the map` as a map screen.

### 1.2 The Preview simulator — `PhonePreviewMode`

**`components/PhonePreviewMode.jsx`** is a full-screen interactive simulator.

- **Props** (`:30`): `screens`, `initialScreen`, `onClose`, `globalFit`, `phoneSkin`, `playthrough`, `missions`.
- **It draws its own device** (`:414-532`): a 320px-wide body tinted from `PHONE_SKINS` (`:31`, `:415-419`), a notch bar (`:421-424`), a status bar with a fixed "9:41" (`:433-444`), the screen image (`:465-471`), tap zones (`:495-516`) and a home bar (`:521-531`). It imports only `getScreenImageStyle` and `PHONE_SKINS` from `PhoneHub` (`:7`).
- **It does not use** `PhoneFrame`, `ScreenContentRenderer`, `PhoneMapView`, `content_zones`, a custom frame, or hidden screens (grep of `PhonePreviewMode.jsx` for each: no match).
- **It owns its navigation:**
  - `activeScreen` (`:32`), `history` (`:33`) and slide transitions (`:34-35`, `:106-125`);
  - back (`:210-221`) and home (`:223-234`);
  - breadcrumbs (`:244-248`, `:545-558`);
  - ESC to close (`:237-241`).
- **It runs the frontend phone runtime** (`lib/phoneRuntime.js`, imported `:8`):
  - `filterZones` hides zones whose conditions fail (`:265`);
  - `applyActions` runs a tapped zone's actions in author mode (`:176`);
  - `evaluateMissions` computes mission progress (`:65`);
  - `applyMissionRewards` fires rewards (`:179-184`).
- **Two modes** (`:22-28`):
  - **Author mode:** in-memory state (`:163-198`).
  - **Player mode:** taps go to `playthrough.tap()` on the server (`:134-161`) and state hydrates from `playthrough.state` (`:54-60`).
- **Extra UI:** a missions chip and panel (`:303-353`), toasts (`:356-368`), mission celebrations (`:372-401`) and an "Episode complete" banner (`:404-412`).
- The same file exports `ScreenFlowMap` (`:567` onward), which `UIOverlaysTab` imports (`pages/UIOverlaysTab.jsx:24`) and mounts (`:2547`). It is a diagram, not a device.

---

## 2. Mount sites

| Component | Mounted at | Context |
|---|---|---|
| `PhoneHub` | `pages/UIOverlaysTab.jsx:1439` | Producer Mode's Phone Hub. The only mount (grep for `<PhoneHub`). Unmounted while the inline link or content editor is open (`:1437`). |
| `PhonePreviewMode` | `pages/UIOverlaysTab.jsx:2536` | Producer Mode's Preview. Author mode: no `playthrough`, no `missions`; `screens={overlays}` (`:2537`). |
| `PhonePreviewMode` | `pages/EpisodeDetail.jsx:1002` | The Episode's Preview Phone, lazy-loaded under `Suspense` (`:1001`). Player mode: `playthrough`, `missions`, `initialScreen` from `playthrough.state.last_screen_id` (`:1004-1012`). Opened by `EpisodeLalasPhoneTab`'s Preview Phone button (`onPreview={phone.start}`, `:841`). |
| `PhoneFrame` | `components/PhoneHub.jsx:438` | Producer Mode device. |
| `PhoneFrame` | `components/IconPlacementMode.jsx:381` | Icon placement editor, mounted in `UIOverlaysTab.jsx:1687`. |
| `PhoneFrame` | `components/ContentZoneEditor.jsx:167` | Content zone editor, mounted in `UIOverlaysTab.jsx:2039`. |
| `PhoneFrame` | — | Imported by `UIOverlaysTab.jsx:27` but not mounted there (grep of that file for `<PhoneFrame`: no match). |
| `ScreenContentRenderer` | `components/PhoneHub.jsx:464`, `IconPlacementMode.jsx:420`, `ContentZoneEditor.jsx:240`, `ScreenLinkEditor.jsx:737` | Producer Mode device and the three editors. Never inside `PhonePreviewMode`. |
| `PhoneMapView` | `components/PhoneHub.jsx:452`, `ScreenContentRenderer.jsx:1053` | Map screens, and the `world_map` content zone. |

Every `PhoneFrame` and `ScreenContentRenderer` mount is inside Producer Mode. The Episode page reaches a device only through `PhonePreviewMode`.

## 3. Layout

- **`PhoneHub`:** inline, not an overlay.
  - `.phone-hub-inner` is a flex row, device left and grid right (`PhoneHub.jsx:661`). The device column is `position: sticky` (`:662`).
  - Frame width: 280px (`components/phone/ZonesTab.css:12-15`, imported only by `UIOverlaysTab.jsx:28`), then 240px at ≤1024px (`PhoneHub.jsx:750`), 220px at ≤768px (`:756`), 180px at ≤480px (`:762`) and 160px at ≤375px (`:769`).
  - At ≤768px the row stacks, device above grid (`:754-755`). At ≤375px the screen grid drops to 2 columns (`:770`).
- **`PhonePreviewMode`:** a full-screen fixed overlay, `position: 'fixed', inset: 0, zIndex: 9999` (`PhonePreviewMode.jsx:273`).
  - The device is a fixed 320px wide (`:416`), with no media query in the file.
  - The close, Reset and missions controls are absolutely positioned at the top corners (`:278-298`, `:304`), and the missions panel is 280px wide (`:321`).
  - **INFERRED:** at 375px the 320px device fits the viewport width, but the top-corner controls and the 280px missions panel overlap the device area. Not measured in a browser.
  - It cannot sit inside a pane as it stands. An embedded mode would need a non-fixed container and a width that follows its parent.

## 4. Comparison

| Capability | Producer Mode (`PhoneHub` + children) | Preview (`PhonePreviewMode`) |
|---|---|---|
| **Skin** | **Present.** `PhoneFrame` body, side buttons, Dynamic Island, home indicator, tinted by `skin` (`PhoneFrame.jsx:25-26`, `:65-146`); picker via `onChangeSkin` (`PhoneHub.jsx:530-560`). | **Partial.** Same `PHONE_SKINS` colours (`:31`) on a different body: a notch bar instead of a Dynamic Island, a 320px width, a fixed status bar (`:414-444`). The same skin key looks different in each. |
| **Custom frame image** | **Present.** `customFrameUrl` passed to `PhoneFrame` (`PhoneHub.jsx:311`, `:344`, `:440`). | **Absent.** No prop, no use (grep for `customFrame`, `frame_url`: no match). |
| **Per-screen and global image fit** | **Present.** `getScreenImageStyle(screen, globalFit)` (`PhoneHub.jsx:461`; cascade `:40-72`). | **Present.** Same function (`PhonePreviewMode.jsx:469`). |
| **Content zones** (DMs, notifications, lists, wardrobe, finance…) | **Partial.** `ScreenContentRenderer` mounted with `content_zones` (`PhoneHub.jsx:464-469`), but without `episodeId`, so DM and notification zones fetch nothing (`ScreenContentRenderer.jsx:317-319`, `:359-361`; INFERRED effect, §1.1). | **Absent.** No `ScreenContentRenderer` and no `content_zones` (grep: no match). |
| **Map screens** | **Present.** `isMapScreen` then `PhoneMapView` (`PhoneHub.jsx:444-456`); `world_map` zone via `ScreenContentRenderer` (`:157`, `:1053`). | **Absent.** A map screen shows its uploaded image only (`:465-471`). |
| **Screen links and navigation history** | **Partial.** Zones and persistent icons render and call `onNavigate` (`PhoneHub.jsx:75-152`, `:470-476`). History and back belong to the parent (`navigationHistory`, `onBack`, `:497-507`; `UIOverlaysTab.jsx:892`, `:909`). No condition gating. | **Present.** Own history, back, home, breadcrumbs and slide transitions (`:32-35`, `:106-125`, `:210-248`). Zones gated by `filterZones` (`:265`). Home screen's persistent links merged (`:256-264`). |
| **Icons** | **Present.** Icon-type screens are kept off the device (`PhoneHub.jsx:347-348`) and shown in their own grid (`:605-606`); zone and persistent icons drawn from `icon_url` (`:100-107`, `:140-147`). | **Partial.** Zone icons drawn from `icon_url` (`:511-514`); no icon grid; no icon/screen split before choosing the start screen (`initialScreen` is chosen by the caller). |
| **Hidden screens** | **Present.** Grid filters by `hiddenScreens` / `showHidden` (`PhoneHub.jsx:597`, `:605`). | **Absent.** Gets the full list: `screens={overlays}` from Producer Mode (`UIOverlaysTab.jsx:2537`); the Episode passes only generated screens with a URL (`hooks/usePhonePlayback.js:50`). No hidden logic in the file. |
| **Missions and the frontend phone runtime** (`lib/phoneRuntime.js`: `filterZones`, `applyActions`, `evaluateMissions`) | **Absent.** No `phoneRuntime` import, no missions (§1.1). | **Present.** `filterZones` `:265`, `applyActions` `:176`, `evaluateMissions` `:65`, `applyMissionRewards` `:179`; missions panel `:303-353`. |
| **Playthrough state** | **Absent.** | **Present in player mode.** `playthrough` prop hydrates state (`:54-60`); taps go to `playthrough.tap()` (`:134-161`); Reset calls `playthrough.reset()` (`:70-72`). |
| **Starting screen (`initialScreen`)** | **Absent** as a prop. The parent controls `activeScreen` (`PhoneHub.jsx:298`). | **Present.** `initialScreen` prop (`:30`, `:32`), used by Reset and Home (`:82`, `:224`). |
| **Episode scoping** (`episode_id`, `is_episode_override`) | **Absent.** No episode prop. Producer Mode lists show-level screens (`UIOverlaysTab.jsx` list fetches pass no `episode_id`). `ScreenContentRenderer` would accept `episodeId` (`:58`) but `PhoneHub` does not pass one. | **Partial.** Scoped only by what the caller passes: the Episode's hook fetches with `?episode_id=` (`usePhonePlayback.js:48`). The component ignores `is_episode_override` (grep: no match). |

In short: Producer Mode's device has the look (custom frame, content zones, map) and no behaviour. The Preview has the behaviour (runtime, missions, playthrough, its own navigation) on a simpler body without the look. Neither has everything rule 10 asks for.

## 5. Reads and writes

**Producer Mode's device makes no API call of its own.** Its children read only:

- **`ScreenContentRenderer`**, all `GET`, one per zone type through `useContentData` (`:190-205`):
  - `feed-posts/episode/:episodeId` or `feed-posts/:showId/timeline` (`:216-217`)
  - `social-profiles/:id` (`:259`, `:289`) and `social-profiles?show_id=` (`:396`)
  - `feed-enhanced/:showId/moments/:episodeId` (`:317`, `:359`)
  - `wardrobe?…` (`:449`) and `outfit-sets?show_id=` (`:574`)
  - `shows/:showId/financial-config`, `-summary` and `-breakdowns` (`:652-877`)
  - `feed-posts/:showId/timeline` (`:902`)
  - `calendar/events?series_id=` (`:944`)
  - `feed-enhanced/:showId/momentum` (`:1064`)
- **`PhoneMapView`**, all `GET` (`:53-60`): `world/map`, `world/map/positions`, `world/locations`, `social-profiles?show_id=`, `calendar/events?series_id=`.
- **Writes happen in the parent, `UIOverlaysTab`,** through callbacks such as `onChangeSkin` (`PUT /ui-overlays/:showId/phone-skin`, `UIOverlaysTab.jsx:185-192`), not in the device.

**The Preview makes no API call of its own** (grep of `PhonePreviewMode.jsx` for `api\.`: no match). Its callers' hooks do.

- **Producer Mode's Preview** (`UIOverlaysTab.jsx:2536`): nothing extra. Author mode is in-memory; the screens come from the tab's own list.
- **The Episode's Preview**, through `hooks/usePhonePlayback.js` and `hooks/usePhonePlaythrough.js`:

| Call | Read or write | Where |
|---|---|---|
| `GET /ui-overlays/:showId?episode_id=` | read | `usePhonePlayback.js:48` |
| `GET /ui-overlays/:showId/frame` | read | `usePhonePlayback.js:54` |
| `GET /ui-overlays/:showId/missions?episode_id=` | read | `usePhonePlayback.js:59` |
| `GET /episodes/:id/phone-state` | **write on first read** — creates a `PhonePlaythroughState` row when none exists (`src/routes/phonePlaythroughRoutes.js:100-107` → `loadOrCreateState`, create at `:45`) | `usePhonePlaythrough.js:22` |
| `POST /episodes/:id/phone-state/tap` | write — saves `state_flags`, `visited_screens`, `last_screen_id`, `completed_at` (`phonePlaythroughRoutes.js:209-211`) | `usePhonePlaythrough.js:35` |
| `POST /episodes/:id/phone-state/reset` | write — clears the row's state (`phonePlaythroughRoutes.js:232-235`) | `usePhonePlaythrough.js:49` |

**Does anything call `GET /episodes/:id/phone-state`?** Yes, the Episode's Preview Phone.

- `EpisodeLalasPhoneTab` itself never fetches it (`components/Episodes/EpisodeLalasPhoneTab.jsx:19`).
- But its Preview Phone button calls `phone.start` (`pages/EpisodeDetail.jsx:841`). That sets `isPlaying` (`usePhonePlayback.js:61`), which passes the episode id to `usePhonePlaythrough` (`:39`), whose effect calls `GET …/phone-state` (`usePhonePlaythrough.js:18-27`).
- So opening the Episode's Preview Phone for the first time creates a playthrough row for that user and episode. Producer Mode's Preview never passes `playthrough`, so it never calls the route.

**A `complete_episode` action in player mode** sets only the playthrough row's `completed_at` (`phonePlaythroughRoutes.js:147`, `:181`, `:210`). The route file imports no episode-completion service (its `require`s at `:19-22`, `:102`, `:121`, `:223`, `:246` are express, auth, `../services/phoneRuntime` and `../models`). Whether the tap path ever reaches `completeEpisode` is `PROJECT_CONTEXT.md` §10 item 24's question; this read notes only that this route does not import it.

## 6. Options

Evoni asked for options, not a recommendation. Each option lists what moves, what each mount site would need, and its largest risk.

### (A) `PhonePreviewMode` adopts `PhoneFrame`, `ScreenContentRenderer` and `PhoneMapView`

- **What moves:**
  - `PhonePreviewMode` drops its own body, notch and status bar (`:414-444`, `:520-531`) and wraps its screen in `PhoneFrame`, taking `customFrameUrl`.
  - It mounts `ScreenContentRenderer` with `episodeId` and a `runtimeContext` built from its runtime state, and `PhoneMapView` for map screens.
  - It gains an embedded (non-fixed) layout alongside the overlay.
  - `PhoneHub` is unchanged.
- **Mount sites:**
  - `EpisodeDetail.jsx:1002` passes the custom frame URL, which `usePhonePlayback` already fetches with `/frame` but does not keep. It could also mount the embedded variant in the Episode tab.
  - `UIOverlaysTab.jsx:2536` passes `customFrameUrl`.
  - `PhoneHub` and the three editors are untouched.
- **Largest risk:** two device components remain. `PhoneHub`'s device and `PhonePreviewMode` would share chrome and content, but navigation, zones and runtime would still be written twice (`ScreenLinkOverlay` vs `PhonePreviewMode`'s zone layer). Rule 10's "not a separate phone implementation" would be met for the look, not for the behaviour.

### (B) The Episode tab embeds `PhoneHub` in a read-only mode

- **What moves:**
  - `PhoneHub` gains a read-only mode: device only, with no grid, cards, skin picker or section tabs. It also gains an `episodeId` passed through to `ScreenContentRenderer`.
  - The Episode tab supplies navigation state, since `PhoneHub` keeps none (`onNavigate`, `navigationHistory`, `onBack`).
  - `PhonePreviewMode` stays for walkthroughs.
- **Mount sites:**
  - `UIOverlaysTab.jsx:1439` is unchanged (edit mode stays the default).
  - `EpisodeLalasPhoneTab` gains a `PhoneHub` mount and its own nav state.
  - `EpisodeDetail.jsx:1002` and `UIOverlaysTab.jsx:2536` keep `PhonePreviewMode` as is.
- **Largest risk:** the Episode tab gets Producer Mode's look but none of the runtime. Conditions, missions and playthrough stay only in `PhonePreviewMode`, so "click Beat 5, the phone opens the invitation" works as navigation but zones never gate. It also adds a second consumer to a 782-line editor component whose layout CSS lives partly in `ZonesTab.css`, a file only `UIOverlaysTab` imports (§3). **INFERRED:** an embedded `PhoneHub` outside `UIOverlaysTab` would lose the 280px base frame width unless that CSS moves.

### (C) Extract a shared device component both use

- **What moves:**
  - A new device component owns `PhoneFrame`, the screen image or `PhoneMapView`, `ScreenContentRenderer` (with `episodeId` and optional `runtimeContext`), tap zones and persistent icons.
  - Navigation (history, back, home) is either internal, or controlled when a parent passes it.
  - Runtime and playthrough are optional props, so it runs inert in the editor and live in the player.
  - `PhoneHub` renders it for its device column (`:437-522`). `PhonePreviewMode` renders it inside its overlay, keeping only the overlay chrome, missions panel, toasts and celebrations. The Episode tab renders it embedded.
- **Mount sites:**
  - `PhoneHub.jsx:438` swaps its device block for the new component.
  - `PhonePreviewMode` swaps `:414-532`.
  - `EpisodeLalasPhoneTab` adds an embedded mount.
  - `IconPlacementMode.jsx:381` and `ContentZoneEditor.jsx:167` can keep `PhoneFrame` directly, or move later.
  - `UIOverlaysTab.jsx:1439` and `:2536` and `EpisodeDetail.jsx:1002` keep their props.
- **Largest risk:** the widest change. Two tap layers (`PhoneHub`'s `ScreenLinkOverlay` and `PhonePreviewMode`'s runtime-gated zones) and two navigation models (parent-controlled vs internal) must merge into one without changing Producer Mode's editor behaviour. The editor relies on zones not being gated (`ScreenContentRenderer.jsx:60-67`).

---

Evoni rules which option; this document rules nothing.

*Living document outside `docs/audit/`: cites code by component and function name with line numbers at the basis above; line numbers will drift, the names will not. Mints no FD, XK or PE. No host, AWS, database or Cognito contact by the filing session.*
