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
| Episode tabs (Overview and its children, Script, Scenes, Assets, Distribution, Money, Phone, Overlays, Checklist, Todo: `components/Episodes/*`) → Scene Sets (the audit's order) | next, one tab per PR: inline hex colors become tokens, fixed-column grids become `auto-fit` or named classes |
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
