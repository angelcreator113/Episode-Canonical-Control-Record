# Event colours today, for the Event palette

Date: 2026-10-14. Basis: `c4524727d8dca19e5722a4ab2cc541d741e5bbec` (origin/main, #3173). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code or migrations) or **INFERRED**.

This is Task #3127, the read for the Style Templates spec §7, "Palettes" (`docs/design/2026-10-style-templates.md:48-53`). The spec says the Event palette:
- lives on the event (one owner), with the roles Background, Surface, Accent and Text, Text chosen for contrast;
- is proposed from the invitation's design, the venue's décor and colours, the dress code and vibe, and the Dream City's colours;
- is accepted or adjusted by Evoni, and once approved it is canon;
- is used by the invitation, brand agreement, style templates, overlays and The Pulse's event card;
- falls back: approved palette → venue and city colours → the show's blush and lavender.

## 1. Summary

1. **The only structured event colour today is `world_events.color_palette`** (MEASURED). It is a JSONB **list of colour names**, such as `["lavender", "champagne", "cloud white"]`. It has no hex values, roles, approval or source.
2. **The invitation's colours are baked into pixels** (MEASURED):
   - The name list goes into the image prompt as "Color palette emphasis" text.
   - Nothing reads colours back from the generated image.
   - The text on the invitation is fixed ink and gold.
3. **Some of the inputs the spec names already exist as data**, though none is in the four roles (MEASURED):
   - the venue look's "Décor and colours" (free text);
   - a scene set's 5-hex palette extracted from its image;
   - each Dream City's hex palette;
   - eight theme presets (prose).
4. **None of the spec's consumers reads an event colour today** (MEASURED):
   - The brand agreement isn't built.
   - Event document overlays, The Pulse's event card and the style sheet use fixed show colours.
   - The title overlay is the one partial exception: the event's first palette name becomes its accent.
5. **The show's blush and lavender exist only as CSS tokens and two hard-coded server constants** (MEASURED). `shows.color` defaults to `#667eea`.
6. **Recommendation (§7):**
   - a new `world_events.event_palette` JSONB column, with four roles, each `{hex, source}`, plus a status;
   - proposed on the server from the sources in §3, using `episode_lookbooks.palette`'s `{hex, source}` shape;
   - one migration.

## 2. The invitation's colour path

**The event's fields** (MEASURED). Migration `src/migrations/20260703000000-add-invitation-fields-to-world-events.js` adds to `world_events` (model `src/models/WorldEvent.js:151-158`; `CURRENT_ATTRIBUTES` `:469-470`):
- `theme` STRING(100)
- `color_palette` JSONB (`[]`; the migration's comment: `e.g. ["blush", "champagne", "honey gold"]`)
- `mood` STRING(100)
- `floral_style` STRING(50)
- `border_style` STRING(50)
- `invitation_asset_id` UUID

**How they are filled** (MEASURED):
- **From a Feed profile:** `POST /world/:showId/events/from-profile` (`src/routes/worldEvents.js:2932`).
  - `ARCHETYPE_STYLES` (`:3015-3026`) gives each archetype a theme, a mood, a `color_palette` of names, a floral style and a border style. For example, `soft_life` gets `['lavender', 'champagne', 'cloud white']`.
  - `CATEGORY_STYLE_TWEAKS` (`:3027-3034`) can swap colours.
  - The profile's `aesthetic_dna.color_palette` and `visual_style` win (`:3041-3049`).
  - The result is written to the columns (`:3133-3138`) and copied to `canon_consequences.automation` (`:3155-3160`).
- **By Evoni:** Producer Mode's event editor shows `InvitationStyleFields` (`frontend/src/pages/WorldAdmin.jsx:3836-3846`; component `frontend/src/pages/InvitationGenerator.jsx:545-603`).
  - The theme is picked from `THEME_OPTIONS` (`:7-16`).
  - The palette is a comma-separated text box, split into names (`:551`, `:589-603`).
  - The save allowlist is `WorldAdmin.jsx:217`. The PUT accepts the fields and parses `color_palette` as JSON (`worldEvents.js:886`, `:946-950`).
- **No other creation path sets them.** The plain `POST /events` (`worldEvents.js:530`) and the automation paths (`eventAutomationService`, `feedEventPipelineService`, `careerPipelineService`, `calendarRoutes`, `eventGeneratorRoute`) have no `color_palette` (MEASURED by grep; INFERRED for the column lists not opened).
- **The Event Package page has no editor for theme, mood or palette** (MEASURED: no match in `frontend/src/pages/EventPackagePage.jsx`).

**The theme** (MEASURED):
- `detectTheme` (`src/services/invitationCompositingService.js:190-209`) uses `event.theme` when it is set (lowercased).
- Otherwise it votes over `dress_code_keywords`, `dress_code` and `mood` using `KEYWORD_THEME_MAP` (`:155-188`).

**The visual direction** (MEASURED). `deriveEventVisualDirection` (`src/services/eventVisualDirection.js:91-105`):
- returns `{ theme, background, border, florals, atmosphere, richness, palette }`;
- the prose comes from `THEME_PRESETS`: honey luxe, avant-garde, soft glam, romantic garden, luxury intimate, formal glamour, chic minimal, power fashion (`:22-71`), else `DEFAULT_THEME` (`:73-78`);
- `richness` comes from prestige (`:80-84`);
- `palette` is `ev.color_palette` when it is an array (`:95`).

**A gap** (MEASURED by reading the two paths):
- The from-profile themes ("refined editorial", "raw authentic", "dreamy luxury", …; `worldEvents.js:3016-3025`) are not `THEME_PRESETS` keys.
- `detectTheme` returns them as they are, the lookup misses (`eventVisualDirection.js:94`), and the event gets `DEFAULT_THEME` with `theme: 'default'` (`:97`).
- `floral_style` and `border_style` are stored but never read: no service references them (MEASURED by grep of `src/services`). The preset's florals and border are used instead.

**The prompt and the image** (MEASURED):
- `buildBackgroundPrompt` (`src/services/invitationGeneratorService.js:63-97`) writes the preset's prose. With a palette it adds `Color palette emphasis: ${palette.join(', ')}.` (`:67-69`, `:83`).
- It asks for a background with no text and an empty cream centre.
- `generateImageUrl(prompt, { size: 'portrait', quality: 'hd', useCase: 'invitation' })` (`:103-105`) routes `invitation` to Flux (`src/services/imageGenerationService.js:41-44`). The model returns a URL only.
- **No colour is read back from the image.**

**The text on it** (MEASURED):
- Claude writes the words (`buildInvitationContent`, `invitationGeneratorService.js:282`). They are stored as `canon_consequences.invitation_text` (`:352-364`) and carry no colour.
- The canvas draws them in fixed colours: a cream panel `rgba(255,253,245,0.93)` and inks `#2C1810`, `#4A3728`, `#8B6914`, `#B8962E` (`invitationCompositingService.js:604`, `:642-732`).
- A `_COLORS` object (`:142-151`) is declared and, by its underscore, unused (INFERRED).

**What is stored** (MEASURED). `createInvitationAsset` (`invitationGeneratorService.js:172-245`) writes an `assets` row (INVITATION_LETTER, role `UI.OVERLAY.INVITATION`) with:
- `color_palette: event.color_palette || []` (`:194`): the event's names, copied, not read from the image;
- `mood_tags` (`:189-193`);
- `metadata.theme` and `metadata.theme_source` (`'manual' | 'auto-detected'`, `:200-201`).

`assets.color_palette` is JSONB, described as "Extracted color palette from asset" (`src/models/Asset.js:209-212`). The approved invitation is `world_events.invitation_asset_id`.

**Structured, or in the pixels?** Only the list of names is structured: on the event, with a copy on the asset. The invitation's actual colours exist only in its image, both the background and the composite (`:340`, `:349`).

**The title overlay reads the same direction** (MEASURED). `src/services/episodeTitleOverlayService.js`:
- the theme picks a finish through `THEME_FINISH` (`:75-85`), with hex stops in `FINISHES` (`:69-74`);
- `NAMED_COLOURS` maps 23 colour words to hex (`:88-93`);
- `overlayLook` takes the first palette entry that resolves as the **accent** (`:111-116`), used only on foil finishes (`:258`).

The framed title card's prompt also carries `Color palette emphasis` (`src/services/episodeTitleCardService.js:95-110`).

## 3. Every colour field, and how each is filled

| Where | Field | Type and shape | How it is filled | Read by |
|---|---|---|---|---|
| Event | `world_events.color_palette` | JSONB, colour **names** | The from-profile route's archetype styles or the profile's `aesthetic_dna`; Evoni's comma box in Producer Mode (§2) | Invitation prompt; title overlay accent; Scene Brief "Décor colours", first 4, only with no venue look (`src/services/sceneBriefService.js:286-296`; rule `:272-279`); script writer "Look and feel" (`src/services/episodeScriptWriterService.js:477-479`; already takes `{name, hex}`) |
| Event | `theme`, `mood` | STRING(100) | As above | `detectTheme`, the visual direction |
| Event | `floral_style`, `border_style` | STRING(50) | As above | Nothing |
| Event | `venue_look.decor` | Free text, ≤600 characters, labelled **"Décor and colours"** (`src/services/venueLookService.js:13-19`, `:38`, `:45`) | Haiku "Draft from event details", whose prompt asks for "Décor and colours: florals, linens, props, palette." (`:249-280`, call `:297-319`), or Evoni's edit (`normaliseLookInput`, `:106-147`); each part is `auto-drafted` or `edited` | Scene Brief and the venue's set (the look replaces the event's colours when present) |
| Event | `canon_consequences.automation.color_palette` | Copy of the names | The from-profile route | INFERRED unused beyond the record |
| Event | `dress_code`, `dress_code_keywords` | Text, JSONB | Event creation and editing | The theme vote |
| Venue | `world_locations.style_guide.palette` | Hex list (`src/models/WorldLocation.js:94-99`) | `STYLE_PRESETS` (`src/services/propertyService.js:117,134,151,168`) or the property routes (`src/routes/propertyRoutes.js:86-110`, `:152-167`, `:253`) | Room wall colours for **properties** (`propertyService.js:234-236`, `:256-266`); most venues have none (INFERRED) |
| Venue | `venue_details.vibe_tags`, `sensory_details.sight`/`atmosphere` | JSONB (`WorldLocation.js:87-92`, `:37-41`) | Location editing and AI enrichment | Venue prompts (INFERRED) |
| Venue | `city` | Free text (`WorldLocation.js:66-69`) | Location editing | Normalised to a Dream City by `dreamCityName` (`src/utils/lalaHome.js:112-119`) |
| Scene set | `visual_language.color_palette` | 5 hex, `locked: true` (`src/models/SceneSet.js:79`) | Claude vision "Extract the visual style DNA": on upload (`src/routes/sceneSetRoutes.js:888-920`), on style lock (`:2653`, `:2669`), after generation (`src/services/sceneGenerationService.js:923-951`) | Fed back into set prompts as `Colors:` (`sceneGenerationService.js:350-353`, `:1888-1901`); swatches in `SceneSetsTab.jsx:1594`, `:2249-2252`, `:2420` |
| Scene set | `visual_language.image_analysis.color_palette_hex`, `wall_color`; `scene_spec.room.color_palette` | Hex (with names in the spec) | Blueprint analysis (`sceneGenerationService.js:1019-1024`, `:1076-1079`); `src/services/sceneSpecService.js:248` | Set generation |
| Dream City | `palette`, `color` | Hex list; `color` follows `palette[0]` (`frontend/src/lib/pulseCities.js:1-12`) | Saved by Evoni on The Pulse's cities (`saveCity`/`mergeCity`, `:40-51`, `:75-79`) into `page_content` › `world_infrastructure` › `DREAM_CITIES`, which is **global, with no show** (`src/models/PageContent.js:11-30`; `src/routes/pageContent.js:28-58`); else `SPEC_PALETTES` (`pulseCities.js:20-27`); else the built-in `color` (`frontend/src/data/dreamCities.js:9-55`) | The Pulse's city tints (`--city-a/b/c`, `frontend/src/components/Pulse/PulseSides.jsx:33-37`; `PulseStories.jsx:73`); no server code reads it (INFERRED by grep) |
| Event Package › Place | "Décor and colours" | The textarea for `venue_look.decor` (`frontend/src/components/EventPackage/EventVenueLook.jsx:28-34`, `:59`, `:132-142`; section `frontend/src/pages/EventPackagePage.jsx:1714-1777`) | As `venue_look.decor` above; routes GET, PUT and POST `/draft`, `worldEvents.js:2598-2624` | The only colour on the page |
| Look | `episode_lookbooks.palette` | Up to 5 `{hex, source: 'auto'\|'edited'}` (`src/services/episodeLookbookService.js:34`, `:284-294`) | k-means over the look's piece images in the browser (`frontend/src/lib/stylePalette.js:1-30`), then edited | The style sheet's swatches (spec §7's **Look** palette, not the Event palette) |
| Show | `shows.color` | STRING(7), default `#667eea` (`src/models/Show.js:133-137`) | Show creation | Not blush or lavender; not used for events (INFERRED) |

## 4. Where the spec's consumers get colours today

- **The invitation:** the name list in the prompt, and fixed ink and gold text (§2).
- **The brand agreement: not built** (MEASURED).
  - Only `shopping_list` and `career_plan` are event documents (`src/services/eventDocumentsService.js:30-33`).
  - It is specified in `docs/design/2026-10-lalas-phone.md:82-83`, "designed in the event's (or brand's) colours".
- **Event document overlays:** fixed pink and lavender `COLORS`, mirroring the design tokens (`src/services/eventDocumentOverlayService.js:43-54`, drawn `:153-238`). These do not depend on the event (MEASURED).
- **The invitation overlay:** places the approved invitation image and draws no colour (`src/services/episodeInvitationOverlayService.js:3-30`; MEASURED).
- **The title overlay:** the theme's finish, with the first palette name as the accent (§2).
- **The Pulse's event card:** `UpcomingRow` (`frontend/src/components/Pulse/PulseSides.jsx:142-165`) uses fixed `--pulse-*` tokens (`frontend/src/pages/SocialMediaPage.css:101`, `:130-135`). Only cities are tinted (MEASURED).
- **The style sheet:**
  - The frame is fixed show colours: blush `#E9C4D5`, lilac `#D9CBEB`, ivory, gold, champagne, pink, plum (`src/services/styleSheetRenderService.js:29-33`; gradient `:209-213`). The browser template mirrors them as `--ss-*` (`frontend/src/components/Episodes/StyleSheetTemplate.css:7-14`, `:26`).
  - The event gives only text (`StyleSheetTemplate.jsx:111`, `:160`).
  - The Look palette fills the swatches (`styleSheetRenderService.js:350-358`).

**The show's blush and lavender** (MEASURED) live in `frontend/src/styles/design-tokens.css`:
- the `--accent` pink family (`:33-36`);
- `--lala-lavender*` (`:52-57`);
- `--pulse-blush` and `--pulse-lilac` (`:292-293`).

The server has only the two hard-coded copies above. Note that `EventPackagePage.theme.test.js:24-29` forbids hex literals in that page's CSS and JSX, so event colours must reach it as data, through CSS variables or a style set from data.

## 5. What a palette could reuse

- **The shape:** `episode_lookbooks.palette`'s `{hex, source: 'auto' | 'edited'}` with server validation (`episodeLookbookService.js:284-294`). It is the project's one palette with an edited/auto source and a check.
- **Names to hex:** `NAMED_COLOURS` (`episodeTitleOverlayService.js:88-93`) already turns 23 colour words into hex. The event's `color_palette` names need exactly that to feed a hex proposal.
- **Sources with an `auto-drafted | edited` label per part:** `venue_look` (the venue look's precedent for a JSON column on the event, ruling Q1).
- **Text contrast:** the design tokens record contrast notes, e.g. `--accent-light` "never text (2.07:1 on white)" (`design-tokens.css:36`). No contrast helper exists on the server (INFERRED by grep).

## 6. Where the Event palette could live

| Option | For | Against |
|---|---|---|
| **A. A new column, `world_events.event_palette` JSONB** (recommended) | One owner on the event, the same precedent as `venue_look` (a JSON column on the event, Q1). Room for roles, a source per role, a status and what it was drafted from. Leaves `color_palette` as it is: the invitation's input names. | One migration, plus the model, `CURRENT_ATTRIBUTES` and a route. |
| B. Reuse `color_palette` as role objects | No migration; already reaches the invitation, title overlay, Scene Brief and script writer. | It is a list of names today. `InvitationGenerator.jsx:551` (`.join`), `sceneBriefService.js:294` (`listText`) and `eventVisualDirection.js:95` → the prompt's `join` would print `[object Object]`. It has no roles or approval, and it mixes the invitation's inputs with approved canon. |
| C. `canon_consequences.event_palette` | No migration; precedent in `invitation_text` and `documents.<type>`. | Not queryable, and part of a large shared column. The generic PUT accepts `canon_consequences` whole (`worldEvents.js:946`), so a client save could overwrite it. |
| D. `venue_look.palette` | No migration; sits beside "Décor and colours". | The wrong owner: the look is how the venue is dressed, while the palette dresses the invitation, documents and Pulse. `normaliseLookInput` drops unknown keys (`venueLookService.js:106-147`), and the look locks when the episode is accepted (Q9). |

## 7. Proposal (plan only; nothing is built here)

### 7.1 Storage: option A

`world_events.event_palette` JSONB, null until a palette is proposed:

```
{
  status: 'proposed' | 'approved',
  roles: {
    background: { hex: '#RRGGBB', source: 'auto' | 'edited' },
    surface:    { hex, source },
    accent:     { hex, source },
    text:       { hex, source: 'auto' }   // chosen for contrast (spec §7)
  },
  drafted_from: ['invitation_palette', 'venue_decor', 'scene_set', 'dream_city', 'dress_code'],
  proposed_at, approved_at, approved_by
}
```

- **Text** is computed from Background and Surface for contrast: whichever of the show's ink (`--lala-ink`, #2C2C2C) or ivory reads at ≥4.5:1 on both. It is stored so every consumer agrees, and it is re-chosen when Background or Surface change. Evoni may override it (`source: 'edited'`) only if it still meets 4.5:1.
- **Approved** means canon (spec §7). A later change to the sources does not overwrite it; it shows an "out of date: re-propose?" note, as the style sheet does.

### 7.2 Drafting the proposal (server, no image model)

A new `src/services/eventPaletteService.js`, `proposePalette(models, eventId)`. It gathers candidate colours in this order, each converted to hex:

1. **The invitation's design:** `color_palette` names through `NAMED_COLOURS` (§5), plus the theme preset's finish (`FINISHES`). INFERRED improvement: colours extracted from the approved invitation image with the same k-means as the Look palette (`stylePalette.js`), run on the server or in the browser on accept.
2. **The venue's décor and colours:** colour words in `venue_look.decor`, through `NAMED_COLOURS`. Then the event's scene set `visual_language.color_palette` (already hex, from its image).
3. **The dress code and vibe:** `dress_code_keywords` and `mood` through `KEYWORD_THEME_MAP` → a theme → its finish. This is a tie-breaker only.
4. **The Dream City:** the venue's `city` → `dreamCityName` → the city's `palette`, read from `page_content` (server-side, new).

Assignment:
- **Background** is the lightest candidate, lightened toward ivory.
- **Surface** is the next lightest, kept distinct from Background (ΔE ≥ 10, INFERRED threshold).
- **Accent** is the most saturated.
- **Text** is computed (§7.1).
- With no candidates, the fallback chain applies (spec §7): venue and city colours, then the show's default blush and lavender.

**One server source for the show default.** Today blush and lavender exist only as CSS tokens and two server constants (§4). The plan adds a single server constant module, e.g. `src/utils/showPalette.js`, mirroring the tokens, with a test pinning it to `design-tokens.css`, as `wardrobeBackdrop.test.js` does for the backdrops. `styleSheetRenderService` and `eventDocumentOverlayService` can later read it.

### 7.3 Routes and screens (for the build issue)

- **Routes:**
  - `GET /api/v1/world/:showId/events/:eventId/palette`;
  - `POST …/palette/propose` (drafts, `status: 'proposed'`);
  - `PUT …/palette` (edit roles, `source: 'edited'`; checks hex and Text contrast);
  - `POST …/palette/approve`.
  - All `requireAuth`. Approval may be `authorize(['ADMIN'])` if Evoni wants it hers alone (a question below).
- **The Event Package › Place section:** a "Palette" card beside "Décor and colours" showing four swatches, Propose, Adjust and Accept. Colours are applied through CSS variables set from data, as the page's theme test requires.

### 7.4 Migration plan (one file)

- `src/migrations/<timestamp>-add-world-events-event-palette.js`: `ADD COLUMN IF NOT EXISTS event_palette JSONB` (nullable, no default), guarded like `20261002110000-add-world-events-venue-look.js`.
- The down migration drops the column.
- No backfill: every event starts unproposed.
- The model declares `event_palette` and adds it to `CURRENT_ATTRIBUTES` (`WorldEvent.js:465-479`; its comment at `:458-464` warns that model reads fail before the migration runs, so the build PR must deploy through the Deploy workflow before the code reads it).
- The generic event PUT does **not** accept `event_palette` (`worldEvents.js:886`); only the palette routes write it.

### 7.5 The consumers (later issues, in the spec's build order)

| Consumer | Uses |
|---|---|
| Invitation | Background and Accent as the prompt's "Color palette emphasis", in hex; the text inks from Text and Accent |
| Brand agreement (new document) | All four roles |
| Style templates | The frame, labels and titles (spec §7); the Look palette keeps the swatches |
| Overlays | The title overlay's accent from Accent; event document overlays dressed from the palette instead of fixed pink and lavender |
| The Pulse's event card | Background and Accent as CSS variables on `UpcomingRow` |

Each reads the **approved** palette, else the fallback chain. A shared reader, `eventPaletteFor(event)`, returns roles plus `{ approved: true|false }`.

## 8. Side findings

- **The theme mismatch (§2):** from-profile events get the default invitation look because their themes aren't preset keys. Fixing it is separate from the palette, but the proposal's theme input has the same gap.
- **`floral_style` and `border_style` are stored and never read** (§2).
- **Dream City palettes are global, with no show** (`PageContent`): every show shares them. That is fine for one show, and it matters if a second show has different cities.
- **`shows.color` defaults to `#667eea`**, a purple that is not the brand. Nothing reads it for events (INFERRED).

## 9. Questions for Evoni

1. **Storage:** a new `event_palette` column on the event (recommended, one migration), or no migration (`canon_consequences`, with the risks in §6)?
2. **Who approves:** Evoni only (ADMIN), or any editor?
3. **The invitation's colours:** extract colours from the approved invitation image (k-means, like the Look palette), or use only its name list and theme?
4. **After approval:** when the venue look or invitation changes, show "out of date: re-propose?" (recommended), or leave the approved palette silently as it is?
