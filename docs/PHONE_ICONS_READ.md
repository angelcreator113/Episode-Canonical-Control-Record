# Phone Hub icons — how they are stored, placed, replaced and selected

*A read of the code, with proposed fixes. No code is changed. Task #2001.*

**Basis:** `origin/main` at `542ec9618386a7edc7788afc83ae25f4bb6a1190`
(2026-09-26). Every claim cites `file:line` at that SHA, with the function or
component name beside it. **MEASURED** means read in the code. **INFERRED**
means a reading of how the code explains what Evoni saw, not observed.

## What Evoni saw

1. After **Change image** on an icon, the placement on Homepage still showed
   the old image (the blue phone).
2. An icon that was placed on Homepage was marked **"Unplaced"**.
3. Placing it again made a **second placement** (the pink one near the page
   dots) instead of updating the first.
4. **Background removal** didn't show as active; the icon kept its white
   square.
5. **Clicking an icon** blanked the phone to "Select a screen".

## The short version

Placements store a **copy of the icon's image address** (`icon_url`), not a
reference to the icon. Changing the image, and removing its background, both
give the icon a **new address**. Nothing updates the placements, and
"placed" is worked out by matching addresses. Symptoms 1–3, and the phone half
of 4, all come from that one fact. Symptom 5 is a deliberate rule in
`PhoneHub`.

## 1. How it works today

### 1.1 How an icon is stored — MEASURED

- **Each icon is an overlay type** (a row in `ui_overlay_types`, identified by
  its type key) **plus an asset row** in `assets` (`asset_type = 'UI_OVERLAY'`)
  holding the image. The asset's `metadata.overlay_type` names the type.
- **The list route** `GET /api/v1/ui-overlays/:showId`
  (`src/routes/uiOverlayRoutes.js`, handler at `:24`) matches assets to types
  and returns, per type, its **primary** asset's fields:
  - `url: primary?.url` (`:132`), where each asset's `url` is
    `s3_url_processed || s3_url_raw` (`:64`);
  - `asset_id: primary?.id` (`:133`);
  - `bg_removed: primary?.bg_removed` (`:134`), from `metadata.bg_removed` (`:65`).
- An icon is a type whose category is `phone_icon` or `icon`
  (`isIcon`, `frontend/src/lib/overlayUtils.js:19`).

### 1.2 How a placement stores an icon — MEASURED

A placement is a zone in the **screen's** `metadata.screen_links` array, saved
with `PUT /api/v1/ui-overlays/:showId/screen-links/:assetId`
(`uiOverlayRoutes.js:655`). Three code paths create icon zones, and all three
store the icon's address at that moment:

| Path | Where | Stores |
| --- | --- | --- |
| **Automatic place-on-Homepage** (`autoPlaceIconOnHome`) | `frontend/src/pages/UIOverlaysTab.jsx:565–596` | `icon_url: icon.url`, `icon_urls: [icon.url]` (`:586–587`). **No reference to the icon.** |
| **Manual placement** on the phone (`IconPlacementMode`, `handlePickIcon`) | `frontend/src/components/IconPlacementMode.jsx:173–193` | `icon_url: ico.url` (`:184`) **and** `icon_overlay_id: ico.id` (`:185`), the icon's type key. |
| **Placements tab** "add to screen" (`addToScreen`, icon detail) | `UIOverlaysTab.jsx:2396–2415` | `icon_url: iconUrl` (`:2404`) **and** `icon_overlay_id: activeScreen.id` (`:2405`). |

A fourth, separate path uploads a **custom icon for one zone** in the zone
editor (`handleUploadIcon`, `UIOverlaysTab.jsx:1025`, via
`POST …/screen-links/:assetId/icon`, `uiOverlayRoutes.js:716`). It appends to
that zone's `icon_urls` and is not tied to any icon overlay.

**Drawing uses only the stored address.** `PhoneDevice`'s `ScreenLinkOverlay`
and `PersistentOverlay` draw `link.icon_url`
(`frontend/src/components/phone/PhoneDevice.jsx:53–55`, `:93–95`), and the
Preview's tap layer does the same (`PhonePreviewMode.jsx:348–349`). Nothing
reads `icon_overlay_id` when drawing.

### 1.3 Where a new placement's position comes from — MEASURED

- **Automatic:** the next slot in a 4-column grid counted from the bottom:
  `x: 8 + col * 22`, `y: Math.max(8, 75 - row * 14)`
  (`UIOverlaysTab.jsx:577–583`). The first automatic icon sits at `y = 75`,
  three quarters of the way down the screen.
- **Manual:** where Evoni taps, snapped to `IconPlacementMode`'s `HOME_GRID`
  (origin `8, 14`, step `21 × 14`) when grid snap is on
  (`IconPlacementMode.jsx:20–28`, `:176–187`).
- **Placements tab:** always `x: 8, y: 14` (`UIOverlaysTab.jsx:2401`).

### 1.4 What "Change image" does — MEASURED

`handleUpload` (`UIOverlaysTab.jsx:626`) posts the file to
`POST /api/v1/ui-overlays/:showId/upload/:overlayType` (`:639`), handled at
`uiOverlayRoutes.js:364`:

1. The file goes to a **new S3 key**, `…-custom-<timestamp>.<ext>`
   (`uploadOverlayToS3`, `src/services/uiOverlayService.js:253–261`).
2. In one transaction, the previous asset row is **soft-deleted**
   (`uiOverlayRoutes.js:390–400`) and a **new asset row** is inserted with a
   **new id** and the new address (`:402–417`). Its metadata has no
   `bg_removed` (`:410–415`).
3. **No `screen_links` are touched.** Nothing looks for zones holding the old
   address.
4. **The old image stays in S3.** Neither `uiOverlayRoutes.js` nor
   `uiOverlayService.js` sends a `DeleteObjectCommand`, so the old address
   keeps loading.
5. Back in `handleUpload`, if the icon has an `opens_screen` target,
   `autoPlaceIconOnHome` runs again (`:650`).

"Generate" (`POST …/generate/:overlayType`, `uiOverlayRoutes.js:293`) does the
same soft-delete and insert (`:307`, `:319`), so regenerating an icon has the
same effect as changing its image.

### 1.5 How "placed" / "Unplaced" is computed — MEASURED

- `PhoneHub` builds `iconLinkByUrl` (`frontend/src/components/PhoneHub.jsx:282–305`):
  for every screen's zones, every address in `getIconUrls(link)`
  (`overlayUtils.js:72–76`: `icon_urls` if present, else `icon_url`) maps to
  the screens it appears on.
- Each icon card looks itself up by **its current address**:
  `linkCount={s.url && iconLinkByUrl.get(s.url)?.screenCount || 0}`
  (`PhoneHub.jsx:409`).
- `ScreenCard` then shows "✓ N screens", "⚠ No target" or **"○ Unplaced"**
  (`PhoneHub.jsx:126–132`).
- The icon detail's **Placements** tab matches the same way:
  `links.filter(l => l.icon_url === iconUrl)` (`UIOverlaysTab.jsx:2374`).

### 1.6 How background removal works — MEASURED

- **Manual:** the **Remove BG** button (`UIOverlaysTab.jsx:2324`) calls
  `handleRemoveBg` (`:686–699`), which posts to
  `POST …/remove-bg/:assetId` (`uiOverlayRoutes.js:346`), then reloads the list.
- **The service** `removeBackgroundFromAsset`
  (`uiOverlayService.js:208–249`) sends the image to remove.bg, writes the
  result to **a new S3 key** `…-nobg-<timestamp>.png` (`:233`), and updates the
  asset's `s3_url_processed` to that **new address** and sets
  `metadata.bg_removed = true` (`:240–245`). The asset id stays the same.
- **Automatic:** `autoRemoveBgIfIcon` (`UIOverlaysTab.jsx:545–559`) skips an
  asset already marked `bg_removed` (`:550`). Automatic removal after an
  upload is **switched off**; the comment at `:645–649` says why.
- **How the state is shown:** it isn't. `bg_removed` is used only as the skip
  check at `:550`; no component displays it. The Remove BG button looks the
  same whether or not it has run (`:2324`).
- **How it is reset:** by "Change image" or "Generate", which create a new asset
  row without `bg_removed` (§1.4).

### 1.7 Why selecting an icon blanks the phone — MEASURED

`PhoneHub.jsx:220–222`:

```js
// Don't show icons in the phone device — only screens
const isIconType = activeScreen?.type === 'icon' || activeScreen?.category === 'phone_icon';
const phoneScreen = isIconType ? null : activeScreen;
```

With `phoneScreen` null, `PhoneDevice` draws its placeholder, "Select a screen"
(`PhoneDevice.jsx:182`; `:171` with a custom frame). Selecting an icon replaces the active screen, so
there is nothing else to draw. A side note: this check covers category
`phone_icon` but not `icon`, which `isIcon` counts as an icon too.

## 2. The five symptoms — causes

| # | Symptom | Cause | Standing |
| --- | --- | --- | --- |
| 1 | Placement kept the old image | The zone holds a copy of the old address (§1.2). "Change image" writes a new address and a new asset row, touches no zones, and leaves the old S3 object in place (§1.4), so the old address still loads and is what `PhoneDevice` draws (`PhoneDevice.jsx:53–55`). | MEASURED |
| 2 | Placed icon marked "Unplaced" | The card looks up placements by the icon's **current** address (`PhoneHub.jsx:409`). After a change, no zone holds that address, so the count is 0 and the label is "○ Unplaced" (`:126–132`). **Remove BG alone does the same**, because it also changes the address (`uiOverlayService.js:240–245`). | MEASURED |
| 3 | Re-placing made a second placement | Two routes, both of which add rather than update. **(a)** "Change image" runs `autoPlaceIconOnHome` (`UIOverlaysTab.jsx:650`) when the icon has an `opens_screen` target (`:570`). Its duplicate check compares addresses (`:575`), so the new address passes and a new zone is added at the automatic grid's first slot, `y = 75` (`:577–583`). **(b)** Placing by hand, on the phone or from the Placements tab, always appends a zone (`IconPlacementMode.jsx:188`; `UIOverlaysTab.jsx:2407`). | MEASURED (both paths). **INFERRED** that the pink icon came from (a): its low position matches the automatic slot at `y = 75`, near the page dots, not the manual grid's `y = 14`. Which one ran isn't known from the code. |
| 4 | Background removal didn't show as active | Three things. **(a)** The state is never displayed (§1.6). **(b)** "Change image" makes a new asset without `bg_removed`, so a replaced image starts un-removed, and automatic removal on upload is off (`:645–649`). Yet for an icon that isn't auto-placed, the upload flashes **"Uploaded + bg removed"** (`:654`), which is not true. **(c)** Even when removal runs, it writes a new address (`uiOverlayService.js:233–245`) and the placements keep the old one, so the phone keeps showing the white square. | MEASURED. **INFERRED** which of (a)–(c) Evoni hit: the white squares on the phone fit (b) or (c). |
| 5 | Clicking an icon blanked the phone | Deliberate: `PhoneHub.jsx:220–222` sets the device's screen to none for an icon, and `PhoneDevice` then shows "Select a screen" (`PhoneDevice.jsx:182`). | MEASURED |

## 3. Proposed fixes

One line each, with the files each would touch. Where there is more than one
option, they are listed without a recommendation.

**A reference, not a copy (symptoms 1, 2, 3, 4c).** Two options:

- **Option A — resolve at draw time.** Every icon zone carries a reference,
  and drawing and "placed" look up the icon's **current** image, falling back
  to `icon_url` for zones without a reference. **The reference has to be the
  icon's type key (`icon_overlay_id`), not its asset id**: "Change image" and
  "Generate" insert a new asset row with a new id (`uiOverlayRoutes.js:402`,
  `:319`), while the type key stays the same. Two of the three placement paths
  already store it (`IconPlacementMode.jsx:185`, `UIOverlaysTab.jsx:2405`).
  Files: `lib/overlayUtils.js` (a resolver), `phone/PhoneDevice.jsx`,
  `PhonePreviewMode.jsx`, `PhoneHub.jsx` (status), `UIOverlaysTab.jsx`
  (`autoPlaceIconOnHome` stores `icon_overlay_id`; the Placements tab matches
  on it).
- **Option B — update placements when the image changes.** After an upload,
  a generate, or a background removal, the server rewrites every zone holding
  the old address (or that icon's `icon_overlay_id`) to the new address.
  Storage stays as it is. Files: `src/routes/uiOverlayRoutes.js` (upload
  `:364`, generate `:293`), `src/services/uiOverlayService.js`
  (`removeBackgroundFromAsset`).

Either way, per-zone custom icons (`handleUploadIcon`) aren't tied to an icon
overlay and keep working by address.

**No duplicate on re-place (symptom 3).**
- `autoPlaceIconOnHome` checks for an existing zone by `icon_overlay_id`, not
  by address. Files: `UIOverlaysTab.jsx`.
- And, separately, whether "Change image" should auto-place at all, or only
  when the icon has no placement yet, is a choice. Files: `UIOverlaysTab.jsx`.

**Background-removal state (symptom 4).**
- Show "Background removed" on the icon card and detail, from the `bg_removed`
  the list route already returns (`uiOverlayRoutes.js:134`). Files:
  `PhoneHub.jsx` (`ScreenCard`), `UIOverlaysTab.jsx`.
- Correct the "Uploaded + bg removed" message (`UIOverlaysTab.jsx:654`).
  Files: `UIOverlaysTab.jsx`.
- After "Change image" on an icon, either say that the background removal
  reset, or run removal again. Two options. Files: `UIOverlaysTab.jsx`.

**Selecting an icon (symptom 5).** Two options:
- Keep the last screen in the device and highlight the selected icon's zones
  on it. Files: `PhoneHub.jsx`, `phone/PhoneDevice.jsx` (a highlight prop,
  which would change `PhoneDevice`'s drawing, so its snapshot tests would
  change on purpose).
- Or switch the device to the first screen the icon is placed on, and
  highlight it there. Same files.
- Either way, use `isIcon()` at `PhoneHub.jsx:221` so both icon categories
  are treated alike.

## 4. Existing placements, if storage changes

No database was read for this document. These are questions for Evoni.

- **Under Option A,** zones made by the automatic path carry no
  `icon_overlay_id` (§1.2) and would keep falling back to their stored
  address. Bringing them in line would take a one-time backfill that matches
  each zone's `icon_url` to an icon type, which is only possible where that
  address still belongs to one of the type's assets, live or soft-deleted.
- **Under Option B,** zones that are **already** out of date stay out of date
  until they are fixed once, the same way.
- **How much data is affected** is not known from the code. As of the AQ deploy
  record, production's phone held two screens and one icon (Call, placed
  twice), so today it may be very small. The questions:
  1. How many zones in live screens' `metadata.screen_links` carry an
     `icon_url`?
  2. How many of those carry an `icon_overlay_id`?
  3. How many `icon_url` values no longer match any live asset's address?

  A read-only query for these, for Evoni to run if she wants the numbers, not
  run here:

  ```sql
  -- zones per show, with and without a reference
  SELECT a.show_id,
         count(*) FILTER (WHERE z ? 'icon_url')        AS icon_zones,
         count(*) FILTER (WHERE z ? 'icon_overlay_id') AS with_reference
  FROM assets a,
       jsonb_array_elements(COALESCE(a.metadata->'screen_links', '[]'::jsonb)) z
  WHERE a.asset_type = 'UI_OVERLAY' AND a.deleted_at IS NULL
  GROUP BY a.show_id;

  -- zones whose icon address no longer belongs to a live asset
  SELECT count(*) AS stale_icon_zones
  FROM assets a,
       jsonb_array_elements(COALESCE(a.metadata->'screen_links', '[]'::jsonb)) z
  WHERE a.asset_type = 'UI_OVERLAY' AND a.deleted_at IS NULL
    AND z ? 'icon_url'
    AND z->>'icon_url' NOT IN (
      SELECT COALESCE(s3_url_processed, s3_url_raw) FROM assets
      WHERE asset_type = 'UI_OVERLAY' AND deleted_at IS NULL
        AND COALESCE(s3_url_processed, s3_url_raw) IS NOT NULL);
  ```

## Today's workaround

As the review chat suggested: on Homepage's Zones tab, delete both Call
placements, then place the Call icon once. The placement then holds the
current address. If it still has a white square, run **Remove BG** on the icon
**before** placing it: removal changes the address (§1.6), so a placement made
before it would go stale again.

## What this document does not do

- Changes no code, and picks no option.
- Reads no database; §4's query is not run.
- Does not look at "Generate All": its prompts, cost or placement. That is a
  separate read.
- Makes no host, AWS, database or Cognito contact.
