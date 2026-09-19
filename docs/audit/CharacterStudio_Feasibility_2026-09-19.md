# Character Studio Feasibility Read

Date: 2026-09-19
Issue: #1547
Origin basis: `origin/main` at `34b3da26fcab7ea740631e3109eb1ab702856435`

## Scope and status

This is a read-only code investigation. It measures the current WorldStudio and
character-registry surfaces so a later Character Studio restructure can be
scoped from facts. This note recommends no design, writes no code, rules
nothing, and tails unminted.

No application, host, cloud, or database was contacted for this read.

## Navigation ruling and Mislabels

`docs/navigation-architecture.md:3-5` identifies the Navigation Census as the
measured basis, including section 4.3 (Mislabel). Its Mislabels section says:

> Sidebar Relationships points to `/relationships`, not
> `/world-studio?tab=relationships`.

> WorldStudio becomes Character Studio, opened from Characters -> a selected
> character; it is no longer a global sidebar destination. Its per-character
> relationship view may remain inside it; app-wide Relationships is
> `/relationships`.

Those are stated navigation rulings in the architecture document, not findings
invented by this note. The current code measurements below record the state to
which that ruling would apply.

## Current routing and sidebar

The React route table currently mounts `/character-registry` to
`CharacterRegistryPage`, `/character/:id` to `CharacterProfile`, and
`/world-studio` to `WorldStudio` (`frontend/src/App.jsx:428-429`,
`frontend/src/App.jsx:504`).

The current sidebar WRITE entries are:

```text
Stories       -> /stories
Characters    -> /character-registry?view=world
Relationships -> /relationships
```

These entries are literal in `frontend/src/components/layout/Sidebar.jsx:43-52`.
WorldStudio is not a current sidebar item in that navigation map. The sidebar
does, however, auto-expand its World group when the pathname starts with
`/world-studio` or `/character-registry` (`frontend/src/components/layout/Sidebar.jsx:129-133`).

## WorldStudio measurement

### Global route/query keys

WorldStudio reads the URL query key `tab` once to initialize `studioTab`, with
`characters` as the default (`frontend/src/pages/WorldStudio.jsx:645-649`). The
top-level studio tabs are exactly:

| Key | Visible tab | Behavior |
|---|---|---|
| `characters` | Characters | The selected-character workspace and ecosystem dashboard |
| `feed` | Feed | Embeds `SocialProfileGenerator` with `embedded={true}` |
| `relationships` | Relationships | Embeds the global `RelationshipEngine` |

The three buttons and the two embeds are in
`frontend/src/pages/WorldStudio.jsx:1154-1189`.

World selection is a separate state key, `worldTag`, initialized to
`lalaverse` (`frontend/src/pages/WorldStudio.jsx:651-654`). The declared options
are `lalaverse` (LalaVerse) and `book-1` (Book 1 / Before Lala), with a separate
`all` control rendered in the switcher (`frontend/src/pages/WorldStudio.jsx:31-35`,
`frontend/src/pages/WorldStudio.jsx:1060-1079`). Selecting a world clears
`selectedChar`, `charDetail`, and `charFilter` (`frontend/src/pages/WorldStudio.jsx:1067-1077`).

### Per-character keys and tabs

The character selection state is `selectedChar`; the detail record is
`charDetail` (`frontend/src/pages/WorldStudio.jsx:659-661`). The detail tab
configuration has eleven keys:

```text
overview, essence, aesthetic, voice, desire, relationships, scenes,
follows, depth, demographics, evolution
```

They are declared in `DETAIL_TAB_GROUPS` and flattened into `DETAIL_TABS` at
`frontend/src/pages/WorldStudio.jsx:52-73`. A click on a WorldStudio character
list item assigns `c.id` to `selectedChar` and resets the detail tab to
`overview` (`frontend/src/pages/WorldStudio.jsx:1256-1260`).

### Data loading and ownership

`loadCharacters(tag)` requests `/api/v1/world/characters` for `all`, otherwise
requests `/api/v1/world/characters?world_tag=<tag>`; it stores the response's
`characters` array (`frontend/src/pages/WorldStudio.jsx:716-730`). The world
change effect reloads that list and clears the selected character and related
state (`frontend/src/pages/WorldStudio.jsx:732-737`). This is world-scoped
list behavior, not registry-scoped loading.

`loadCharDetail(id)` requests `/api/v1/world/characters/:id` and stores
`d.character` as `charDetail` (`frontend/src/pages/WorldStudio.jsx:732-741`).
Selecting a character invokes that loader (`frontend/src/pages/WorldStudio.jsx:739-741`).
Scenes are separately loaded from `/api/v1/world/scenes?character_id=<charId>`
when the selected detail tab is `scenes` or `evolution`
(`frontend/src/pages/WorldStudio.jsx:876-885`). Depth data is keyed by the
registry character ID, not the WorldCharacter ID, through
`/api/v1/character-depth/:registryCharId`
(`frontend/src/pages/WorldStudio.jsx:218-236`).

Therefore the current surface mixes scopes: the world switcher, ecosystem
counts, Feed tab, and Relationship tab are global or world-level; character
detail, relationships, scenes, follows, demographics, evolution, and depth are
selected-character views. The RelationshipEngine is mounted without a selected
character prop (`frontend/src/pages/WorldStudio.jsx:1181-1189`), so that tab is
not currently constrained by `selectedChar`.

## Character registry representation and click behavior

The registry page loads `/api/v1/character-registry/registries?limit=50`, then
flattens each registry's `characters` association into one `characters` array,
adding `registry_id` and `registry_name` (`frontend/src/pages/CharacterRegistryPage.jsx:42-50`).
The registry API includes character `id`, `character_key`, status, role,
display name, icon, and sort order in its registry list projection
(`src/routes/characterRegistry.js:34-43`).

Each registry card is keyed by `char.id` and clicking it navigates to
`/character/${char.id}` (`frontend/src/pages/CharacterRegistryPage.jsx:124-127`).
The canonical profile route is therefore per registry-character UUID, not a
WorldStudio `world_characters.id` route (`frontend/src/App.jsx:428-429`). The
profile page's API helpers also use that registry-character ID for
`/character-registry/characters/:id` and its relationships
(`frontend/src/pages/CharacterProfilePage.jsx:17-25`).

The underlying model confirms two separate primary-keyed records: both
`WorldCharacter.id` and `RegistryCharacter.id` are UUID primary keys
(`src/models/WorldCharacter.js:13-22`, `src/models/RegistryCharacter.js:17-27`).
`WorldCharacter` also has nullable `registry_character_id`
(`src/models/WorldCharacter.js:23-27`), while `RegistryCharacter` carries the
string `character_key` and `registry_id` (`src/models/RegistryCharacter.js:23-32`).

## Registry-to-WorldStudio cross-references

A targeted repository grep for `world-studio`, `world/characters`,
`registry_character_id`, `WorldStudio`, and `character-registry` found these
direct cross-references relevant to the two surfaces. The targeted grep matched
58 files across `frontend/src` and `src`; the table below narrows that result to
the direct registry/WorldStudio links:

| Cross-reference | Evidence |
|---|---|
| WorldStudio list reads the world-character endpoint | `frontend/src/pages/WorldStudio.jsx:716-730` |
| WorldStudio detail and scene loaders use world-character IDs | `frontend/src/pages/WorldStudio.jsx:732-741`, `frontend/src/pages/WorldStudio.jsx:876-885` |
| WorldStudio exposes an explicit Sync to Registry action | `frontend/src/pages/WorldStudio.jsx:1088-1105` |
| WorldStudio depth switches to a registry-character ID | `frontend/src/pages/WorldStudio.jsx:218-236` |
| WorldStudio backend creates `registry_characters` rows from world characters and writes the cross-link | `src/routes/worldStudio.js:291-319`, `src/routes/worldStudio.js:516-520` |
| WorldStudio backend list joins `world_characters` to `registry_characters` to return `character_key` | `src/routes/worldStudio.js:1180-1197` |
| WorldStudio update path re-syncs a linked registry row | `src/routes/worldStudio.js:1130-1165` |
| Registry cards navigate to the registry profile route, not WorldStudio | `frontend/src/pages/CharacterRegistryPage.jsx:124-127` |
| App exposes both route surfaces independently | `frontend/src/App.jsx:428-429`, `frontend/src/App.jsx:504` |

The backend sync is bidirectional in operation but not identical in identity:
WorldStudio creates or updates a `registry_characters` row and stores its UUID
on `world_characters.registry_character_id`; the WorldStudio UI still selects
and edits by `world_characters.id`, while registry navigation selects by
`registry_characters.id`. The relevant insertion and update SQL is visible in
`src/routes/worldStudio.js:291-319` and `src/routes/worldStudio.js:1130-1165`.

## Boundary statement

This note is evidence only. It recommends no design, writes no code, rules
nothing, and tails unminted.