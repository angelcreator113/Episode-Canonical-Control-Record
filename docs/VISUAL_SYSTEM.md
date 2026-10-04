# Visual system — the studio theme

**Living doc** (outside `docs/audit/`, edited in place; cites code by stable name).
Audit VISUAL-01/02 and LAYOUT-01–04 (2026-10-03), batch 4, with Evoni's ruling that
the site's colors are **soft pink and teal**. This is the map of the one theme, where
its tokens live, what has been migrated and in what order the rest follows.

## 1. The theme, in one sentence

A warm neutral page (parchment), white surfaces, dark ink, **teal** for every primary
action, **soft pink** for accents, selection and attention, **gold** reserved for Lala's
own marks, and separate semantic colors (success, warning, danger, info) so an ordinary
button never competes with a warning. Lora for prose, DM Mono for UI chrome.

## 2. Where the tokens live

`frontend/src/styles/design-tokens.css` is the **single source**. `frontend/src/index.css`
used to redeclare `--primary`, `--text-primary` and the status colors in its own `:root`
*after* importing the tokens, so its values won and a token edit changed nothing
(VISUAL-01's "competing visual systems"); it now only aliases legacy names
(`--primary-color`, `--light-gray`, …) to the tokens.

| Token | Value | Use |
|---|---|---|
| `--primary` / `--primary-dark` / `--primary-light` / `--primary-subtle` / `--primary-text` | `#2F7F76` / `#276B63` / `#4C9A91` / `#EAF5F3` / `#276B63` | every primary action, hover, selected surface, teal text |
| `--accent` / `--accent-dark` / `--accent-light` / `--accent-subtle` | `#C06E87` / `#9E4E68` / `#E8A0B4` / `#FBEFF3` | pink borders, badges, attention surfaces; pink **text** is `--accent-dark`; `--accent-light` is a border or fill under ink, never text (2.07:1 on white) |
| `--lala-teal*`, `--lala-pink*` | aliases of the two above | for pages written in those words |
| `--surface-bg` / `--surface-card` | `#FAF7F0` (= `--lala-parchment`) / `#FFFFFF` | page / cards |
| `--text-primary` / `--text-secondary` / `--text-muted` / `--text-faint` / `--text-inverse` | `#2C2C2C` / `#6B6557` / `#6B6557` / `#A09889` / `#FFFFFF` | ink; `--text-faint` is placeholders and disabled controls only, never information |
| `--secondary` / `--secondary-dark` | `#6B6557` / `#4B463D` | secondary **text** (what every consumer of it already meant) |
| `--lala-gold` / `--lala-gold-text` | `#B8962E` / `#7A6314` | Lala's mark: a fill under ink text, or gold text on white; never white on gold |
| `--danger` / `--danger-bg` / `--danger-text` | `#B84D2E` / `#F7E4DC` / `#9A3F24` | on-brand red; red **text** is `--danger-text` (`--danger` itself is 4.13:1 on its surface) |
| `--success-text` / `--info-text` | `#166534` / `#1e40af` | green and blue as text on their `-bg` surfaces and on white |
| `--focus-ring` | teal double ring | `:focus-visible` on buttons |

## 3. Measured contrast (sRGB, WCAG formula)

`frontend/src/styles/designTokens.test.js` reads the token file and fails the build
when any of these drops under **4.5:1** (ordinary text). The old pairs the audit measured
are listed for the record.

| Pair | Ratio | |
|---|---|---|
| `--text-inverse` on `--primary` | 4.75 | primary buttons |
| `--text-inverse` on `--primary-dark` | 6.23 | hover |
| `--text-primary` on `--primary-subtle` | 12.54 | selected surfaces |
| `--primary-text` on `--surface-card` | 6.23 | teal text |
| `--accent-dark` on `--surface-card` | 5.61 | pink text |
| `--accent-dark` on `--accent-subtle` | 5.01 | pink text on the blush |
| `--text-primary` on `--accent-subtle` | 12.46 | notes on pink |
| `--text-secondary` on `--surface-card` | 5.79 | meta text |
| `--text-secondary` on `--surface-bg` | 5.42 | meta text on parchment |
| `--lala-gold-text` on `--surface-card` | 5.80 | gold text |
| `--text-primary` on `--lala-gold` | 4.95 | ink on a gold fill |
| `--text-inverse` on `--danger` | 5.07 | danger buttons |
| `--danger-text` on `--danger-bg` | 5.49 | Needs Organizer chip, wardrobe-conflict chip |
| `--success-text` on `--success-bg` | 6.29 | Ready chip, templates panel |
| `--info-text` on `--info-bg` | 7.15 | creator-economy template category |
| `--primary-text` on `--primary-subtle` | 5.60 | Used chip, bulk bar |
| `--text-secondary` on `--lala-parchment-2` | 5.05 | Archived chip |
| `--lala-gold-text` on `--lala-gold-soft` | 5.48 | fashion template category |
| *`--danger` on `--danger-bg`* | **4.13** | failed; red text is `--danger-text` |
| *white on `#B8962E`* (the old Events pager current page, Auto-Fill and the Ideas buttons) | **2.82** | failed; replaced by `--primary` |
| *`--lala-gold` as text on white* (the Event Package's links, labels and section marks) | **2.82** | failed; gold text is `--lala-gold-text` |
| *`--lala-gold-hover` as text on white* | **3.56** | failed; the hover keeps `--lala-gold-text` |
| *`#C06E87` as text* (the Event Package's Continue count, look prices) | **3.61** | failed; pink text is `--accent-dark` |
| *white on `#B8962E`* (the old "+ New Entry") | **2.82** | failed; replaced |
| *`#A09889` as text* (the old `--text-muted`) | **2.86** | failed; now `--text-faint`, decorative only |
| *`#C06E87` as text* | **3.61** | failed; pink text is `--accent-dark` |

## 4. What is migrated

| Surface | State |
|---|---|
| Token layer (`design-tokens.css`, `index.css` aliases) | done |
| Shell: `App.css` page background, scrollbars | done |
| Shared buttons: `.btn-primary` is one solid `--primary` with a hover and a focus ring | done |
| `ShowBiblePage` "+ New Entry" (VISUAL-02's cited control) and its six-column stats grid (LAYOUT-02's) | done |
| Sidebar (`Sidebar.css`) | done: its `--ps-*` palette is scoped to `.ps-sidebar` and mapped to the tokens (the old `:root` block lost to whichever page stylesheet loaded last; `RelationshipEngine.css` and `SocialProfileGenerator.css` still carry their own `:root` `--ps-*` blocks until their own migration). The old palette failed on its own: rose-deep on cream 4.11:1, on blush 3.40:1, tan-soft 2.82:1. Fonts (Jost / Cormorant via Google Fonts) are a later pass. |
| Producer Overview (`WorldAdmin`'s shared style object `S`, its tabs and sub-tabs, `ShowOverview`'s `.sov-*` rules) | done: every color in `S` is a token, the primary action and the active tab are `--primary`, the active tab carries `aria-current`. |
| Events queue (`WorldAdmin`'s Events tab: header, bulk bar, filter bar, templates panel, generate-options toolbar, cards, empty state, pager, Ideas drawer; the `.wa-ev-*` rules; `EVENT_QUEUE_STATES` in `eventReadinessSections.js`) | done: no color literal in the queue JSX, the pager's current page and the Auto-Fill / Generate / Ideas buttons are `--primary` (they were white on gold or green), the five queue states read `--*-text` on `--*-bg` pairs, template categories map to the gold, pink, info, teal, warning and success families. The inline event editor and the "Edit details" modal in the same tab are the Event Package's and migrate with it. |
| Event Package page (`EventPackagePage.css`, `EventLookImage.css`; `/shows/:showId/events/:eventId`) | done: the 208 `var(--lala-*, #hex)` fallbacks are gone so the tokens reach the page; `.epp-btn-primary`, the Continue button and "Use this look" are `--primary` (they were gold under white, 2.82:1); the 19 rules that drew gold or its hover as text read `--lala-gold-text`; the Continue bar's own `--epp-pink` / `--epp-teal` alias `--accent-light`, `--accent-subtle`, `--primary-light`, `--primary-subtle`, `--primary`; statuses, the used banner, invitation states, readiness sections, money warnings and the look cards read the token families. |
| Events tab editors (`WorldAdmin`'s inline event editor, "Edit details" modal and compare modal) | done: no color literal in either slice; the AI revise action is `--primary` (it was an indigo gradient); the editor's frame, keyword chips, overlay picks and scene-set links are the teal family; the financial preview reads `--success-text` / `--danger-text` on their surfaces (it drew `--danger` on `--danger-bg`, 4.13:1, and alpha-suffixed hex); the goal, warning and custom-overlay notes are the warning family; the gold outline buttons (Finalize Financials, Generate Episode Title, Complete Episode) are a gold border with `--lala-gold-text` on parchment. |
| Episode shell (`EpisodeDetail.css`, `EpisodeDetail.jsx`: the page frame, header, tab bar, sub-tab bar, buttons, badges, stories and results sections, the planning card and title chips) | done: the page's own `--ed-*` palette (Tailwind blue, `#3b82f6`) aliases the tokens; the page gradient is `--surface-bg`; the active tab is `--primary-text` on `--primary-subtle` and the segmented tab's active state `--primary` (they were pink `#ec4899`, 3.6:1 as text and white on it 3.4:1); the thumbnail, show-link and primary-action buttons are `--primary` (they were purple and blue gradients, white on `#3b82f6` 3.7:1); the sub-tab bar is teal and carries `aria-current`; evaluation verdicts read `--*-text` on `--*-bg`; the code box and layers container are `--gray-900` / `--gray-800` with `--primary-subtle` and parchment text; brand-tinted shadows are teal or pink rgba. 188 raw hex rules and 8 fallbacks, none left. |
| Episode Overview tab (`EpisodeOverviewTab.jsx` / `.css`, `EpisodeTeaserSection`, `EpisodeMoneyCard`, `episode/SceneSuggestionReview`, `episode/TimelinePlacementsSection`) | done: no color literal in the six files; Save, Script Writer, the teaser's generate button and Accept are `--primary` (they were gold under white); the edit hover and the progress fill are teal (they were `#667eea` purple); the intent section is the warning family; verdicts (SLAY was `#FFD700` on cream, 1.3:1), reward states and the money tone read `--*-text` on `--*-bg`; the source badge is ink on gold; gold labels, links and chips are `--lala-gold-text` with gold borders. |
| Episode Script tab (`EpisodeScriptTab.jsx` / `.css`) | done: no color literal or gradient in either file; the fourteen beats' act colors and the four speakers read `--primary-text` (acts 1–3, Prime), `--lala-gold-text` (4–7), `--accent-dark` (8–9, Lala), `--info-text` (10–12, Kelli) and `--success-text` (13–14, Guest) instead of five hand-picked purples, golds, pinks, blues and greens (`#B8960C` as text was 3.4:1); Save, Approve Beat, Regenerate's generate, Raw Editor's active state, Save Final Script and the stylesheet's save and add-block buttons are `--primary` (they were purple `#2D1B69→#5C3D8F`, gold `#C9A83A→#B8962E` and green gradients under white); the APPROVED badge is ink on gold; the toast, guard result, generate error and unsaved banner read the danger, success and pink families; the DREAM Map modal is `--gray-900` with gold and parchment text. |
| Episode Scenes tab (`EpisodeScenesTab.css`; the JSX already carried no color) | done: 112 hex rules gone; `.est-btn-primary` and the picker check are `--primary` (they were indigo `#6366f1`, white on it 4.1:1), the accent button is `--primary-text` on `--primary-subtle` (it was `#1d4ed8` on `#dbeafe`), focus rings are `--primary`; the warning box, issues box and attention beat are the warning family; the locked, chosen, dressed and linked badges read `--lala-gold-text`, `--surface-bg` on ink and white on `--text-secondary`; parchment and ink tokens replace the slate greys and the hand-mixed creams. |
| Episode Assets tab (`EpisodeAssetsTab.jsx` / `.css`) | done: no color literal or gradient; the link, upload and promote buttons are `--primary` (they were purple `#667eea→#764ba2` and amber `#f59e0b→#d97706` under white, 2.2:1); the Thumbnails link is the teal tint; the four asset statuses, the readiness ring, its percentage and the bar read the success, warning, danger and teal families; the thumbnail backdrop is `--gray-800`. |
| Episode Distribution tab (`EpisodeDistributionTab.jsx` / `.css`) | done: no color literal outside the four platforms' brand marks (YouTube, TikTok, Instagram, Facebook keep their own colors as selection borders and icons) and none in the stylesheet; Save, the primary and the tag chips are `--primary` (they were green `#10b981→#059669` and purple `#667eea→#764ba2` gradients under white, 2.5:1 / 3.3:1); the remove-thumbnail button is `--danger` with a `--danger-text` hover; the four publish statuses read `--text-secondary`, `--warning-text` and `--success-text`; the enabled toggle is `--success`; focus rings are `--primary`; the Generate Thumbnail button is a gold border with `--lala-gold-text` on parchment; purple and green rgba shadows are teal. |
| Episode Money tab (`EpisodeMoneyTab.css`; the tab and `EpisodeSpendingSection` already carried no color) | done: the 46 `var(--lala-*, #hex)` fallbacks are gone; `.em-button` is `--primary` (it was gold under white); the three gold-text rules read `--lala-gold-text`; `--em-positive` is `--success-text`; the pending and outstanding chips and the warning box are the warning family, the posted and earned chips the success family, instead of hand-mixed ambers and greens. |
| Episode Phone tab (`EpisodeLalasPhoneTab.css`, `EpisodePhoneMissionsTab.jsx`; the tab's own JSX already carried no color) | done: the 32 `var(--lala-*, #hex)` fallbacks are gone; the Lala's Phone button and the missions' primary are `--primary` (they were gold under white), the hover `--primary-dark`; the gold-text rule reads `--lala-gold-text`; the phone badge is ink on gold; the show-wide / this-episode scope pills and the active, inactive and error states read the teal, pink, success, ink and danger families. The phone skins in `PhonePreviewMode` are show art, kept distinct from producer controls per VISUAL-01, and are untouched. |
| Episode Overlays tab (`EpisodeOverlaysTab.css`; the JSX already carried no color) | done: 17 hex rules and 4 fallbacks gone; the approved, outdated and not-made title statuses read the success, warning and ink families; the cost reads `--lala-gold-text` (it was `--lala-gold-hover` as text, 3.56:1); the error is `--danger-text`; the transparency checkerboard is parchment on white; borders and muted text are the parchment and ink tokens. |
| Episode Production Checklist (`EpisodeProductionChecklist.jsx`, `ProductionCoveragePanel.jsx`) | done: no color literal or gradient in either file; the two components' `PINK` / `TEAL` constants are `--accent` / `--primary` for fills and borders with `PINK_TEXT` / `TEAL_TEXT` (`--accent-dark` / `--primary-text`) for text (the fills as text were 3.61:1 and 4.75:1 only on white); Generate Episode (it was a gold gradient under white), Resume setup, the section fix button, the start button (indigo gradient) and the coverage actions are `--primary`, Remove is `--danger`; the unavailable badge is ink on gold; the four section statuses, the toast and the setup banner read the teal, warning, ink, danger, success and pink families. |
| Episode Todo list (`EpisodeTodoList.jsx`, rendered in the Assets tab) | done: no color literal or gradient (the modal scrim `rgba(0,0,0,0.7)` is the one rgba); the wardrobe list wears the gold family and the career list the teal family through a `LISTS` map (`edge` for borders and check squares, `soft` for surfaces, `line` for dividers, `text` for labels, `check` for the tick: ink on gold, white on teal); gold and teal as text (2.82:1 and the indigo 4.5:1 short on white) are gone, labels read `--lala-gold-text` / `--primary-text`; Generate, Lock and Done are `--primary` (they were gold and indigo under white); LOCKED, Ready to go, the done check square and the progress bar read the success family; errors read danger. |
| Next Event Suggestions overlay (`NextEventSuggestionsOverlay.jsx`, opened from the Episode page) | done: no color literal or gradient (the backdrop scrim and two shadows are the only rgba); the pick button is `--primary` (it was gold under white); the top rank is a gold border, a gold fill under ink and gold text, never gold as text (2.82:1); the score badge, the boost/warn/block reasons, the payment, cost and type chips read the success, warning, danger and teal families; the slate greys (`#1a1a2e`, `#64748b`, `#94a3b8`, `#e2e8f0`) are `--text-primary`, `--text-secondary` and `--lala-parchment-3`. |
| Scene Sets stylesheets (`SceneSetsTab.css`, `components/SceneSets/DressedAngles.css`) | done, part one of two: no color literal or hex fallback in either stylesheet (387 and 9 literals); the local `--ss-*` palette aliases the tokens (`--ss-gold-text` added so the local gold is never text); the four color gradients are gone (skeleton shimmer is parchment tokens, the hero scrim stays rgba); Generate, the active filter pill, the active scope button and the promote hover are `--primary` (they were indigo gradients and gold under white); the franchise badge is ink on gold; the ready badge is white on `--success-text` (it was white on translucent green, under 4.5:1); the lightbox and prompt preview's light text is `--lala-parchment-3` / `-2` on their dark surfaces; placeholders read `--text-faint`; the indigo scene-set identity (`#5C3D8F`, `#2D1B69`, `#E0D5F0`, `#F5F0FF`…) is the teal family. |
| Scene Sets page component (`SceneSetsTab.jsx`, 125 inline literals) → the screenshot pass at 375/768/1024/1280/1440 | next, part two: the inline `STATUS` / `ROOM_TYPE` maps and step panels become tokens |
| Remaining screens | after |

Rules for a migrated screen: no new hex literals in JSX for colors the tokens have;
primary actions are `.btn-primary` or `var(--primary)`; small type (`--text-xs`,
`--text-2xs`) only for non-essential metadata; grids reflow at 375px (`auto-fit` with a
`minmax`, or a named class with a container query); tested at 375px and 200% zoom
before merge.

## 5. Layout rules still owed (LAYOUT-01, -03, -04)

- One container owner: `PageLayout` (`default`, `wide`, `narrow`, `prose`) is the shell's
  content box; `App.css`'s blanket `.app-content > *` padding goes once pages opt in.
- One vertical scroll owner on ordinary pages; bounded horizontal scroll only on boards,
  canvases and tables; widths fixed with `min-width: 0`, flexible tracks and wrapping, not
  `overflow: hidden`.
- `touch-action: pan-y` on the mobile root blocks pinch-zoom on ordinary content; scope
  gesture limits to canvases and keep every gesture action as a visible button.
