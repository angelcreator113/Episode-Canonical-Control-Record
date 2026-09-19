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

## Citation correction, disclosed on the face

**Every file:line citation in this note was re-verified against the code.** Each
was judged by one test: **does the cited range contain the code the claim is
about?** Of the first filing's **thirty-four citations**:

- **Nineteen failed that test and were corrected.** The cited range did not
  contain the claim's target, wholly or partly.
- **Eleven passed and were left alone.** They are wider than the exact span but
  do contain their target. **They are deliberately not tightened**: a citation
  that correctly covers its target is not an error, and narrowing it would put
  cosmetic churn in the same diff as real fixes, where a reviewer cannot tell
  them apart.
- **Four were already exact** (`App.jsx:428-429`, `App.jsx:504`,
  `navigation-architecture.md:3-5`, `Sidebar.jsx:129-133`).

**So a changed line number in this document's history means the old one was
wrong — never that it was merely narrowed.**

The errors were concentrated in "Data loading and ownership" — the section a
Character Studio restructure leans on hardest. Two examples: `loadCharDetail`
was cited at `WorldStudio.jsx:732-741` when it is at `721-728`, and `732-741` is
in fact the world-change effect, which the same filing cited separately at
`732-737`; and the depth fetch was cited at `:218-236` when the fetch is at
`:238`, outside the cited range.

**No conclusion changed.** The identity-mismatch finding, the mixed-scope
finding, and every substantive claim were re-checked and all hold. Only
pointers moved, plus the additions at "Standing of claims", "Tails" and the
footer.

**Basis versus verification HEAD, stated precisely.** The **Basis line above is
unchanged at `34b3da26`** — that is the commit the reads were taken at, and this
correction does not re-date them. The corrected citations were verified at a
later HEAD, after `origin/main` was merged into this branch. **That is safe
here, and measured, not assumed:** only two files changed on `main` between
`34b3da26` and the verification HEAD —

```
$ git diff --stat 34b3da26 origin/main
 .../EpisodeDetail_OverviewTest_Read_2026-09-20.md  | 793 +++++++++++++++++++++
 frontend/src/pages/EpisodeDetail.test.jsx          |  12 +-
 2 files changed, 804 insertions(+), 1 deletion(-)
```

— and **neither is cited by this note**. `WorldStudio.jsx`, the file carrying
most of the corrections, is byte-identical across the two commits:

```
$ git rev-parse 34b3da26:frontend/src/pages/WorldStudio.jsx
$ git rev-parse origin/main:frontend/src/pages/WorldStudio.jsx
  → identical
```

**A successor should read every line number below as valid at both `34b3da26`
and the verification HEAD.**

---

## Standing of claims

**The test applied: lookup or judgment, not the number of reads.** A claim is
**MEASURED** when anyone tracing the same lines lands on the same answer with no
judgment entering — including a claim that follows a constant from one file to
its declaration in another, which is deterministic lookup however many files it
crosses. A claim is **INFERRED** when several reads are combined into a
characterisation, because **the combining is the judgment**. A synthesis is not
upgraded by being obviously correct.

| Claim | Standing |
| --- | --- |
| Every file:line citation below | **MEASURED** — one read of the cited range confirms each |
| The navigation rulings quoted from `docs/navigation-architecture.md` | **RULED** by Evoni (that document states it is a design ruling); quoted, not derived here |
| WorldStudio has no sidebar entry: no map entry carries `route: '/world-studio'` | **MEASURED** — one read, enumerating every `route:` entry in the map |
| `RelationshipEngine` is mounted with no selected-character prop | **MEASURED** — one read of `WorldStudio.jsx:1165` |
| Depth data is keyed by the registry character ID | **MEASURED** — one read of `WorldStudio.jsx:238` |
| The detail tab configuration has eleven keys | **MEASURED** — one read of `WorldStudio.jsx:58-78` |
| `WorldCharacter.id` and `RegistryCharacter.id` are separate UUID primary keys | **MEASURED** — one read of each model |
| Registry cards navigate by registry-character UUID | **MEASURED** — one read of `CharacterRegistryPage.jsx:124-127` |
| **"The current surface mixes scopes"** | **INFERRED.** The individual fetches and tabs are each MEASURED, but "these are two concerns combined" is a characterisation laid over them. The code states where it fetches; it does not state that this is a mixing. |
| **"The backend sync is bidirectional in operation but not identical in identity"** | **INFERRED.** Each of the INSERT, the cross-link UPDATE and the UI's selection key is MEASURED separately; the conclusion drawn across all three is a judgment. |
| **"The canonical profile route is per registry-character UUID, not a WorldStudio `world_characters.id` route"** | **MEASURED** — two reads (`CharacterRegistryPage.jsx:124-127` → `App.jsx:428-429`), but pure lookup: the second is the declaration of the constant the first navigates to, and anyone tracing them lands on the same answer. **RULED MEASURED by Evoni, 2026-09-19**, on the lookup-versus-judgment test above. |
| The cross-reference file count at "Registry-to-WorldStudio cross-references" | **MEASURED** at the verification HEAD, instrument pasted — and **the first filing's figure did not reproduce; see that section** |
| Any statement about what a Character Studio restructure *should* do | **NOT MADE.** This note recommends nothing. |

No claim in this note is ATTESTED. Nothing here is RULED by this note; only
Evoni rules.

---

## Navigation ruling and Mislabels

`docs/navigation-architecture.md:3-5` identifies the Navigation Census as the
measured basis, including section 4.3 (Mislabel). Its Mislabels section
(`docs/navigation-architecture.md:27-28`) says:

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
`frontend/src/App.jsx:504`). `CharacterProfile` is the lazy import of
`frontend/src/pages/CharacterProfilePage.jsx` (`frontend/src/App.jsx:123`).

The current sidebar WRITE entries are:

```text
Stories       -> /stories
Characters    -> /character-registry?view=world
Relationships -> /relationships
```

These entries are literal in `frontend/src/components/layout/Sidebar.jsx:42`,
`:49` and `:50`. WorldStudio is not a current sidebar item in that navigation
map: no entry in the map carries `route: '/world-studio'`. The sidebar does,
however, auto-expand its World group when the pathname starts with
`/world-studio` or `/character-registry`
(`frontend/src/components/layout/Sidebar.jsx:129-133`).

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

The three buttons are in `frontend/src/pages/WorldStudio.jsx:1137-1150`
(`setStudioTab` at `:1140`, `:1144`, `:1148`); the two embeds are at
`frontend/src/pages/WorldStudio.jsx:1156` and `:1165`.

World selection is a separate state key, `worldTag`, initialized to
`lalaverse` (`frontend/src/pages/WorldStudio.jsx:649`). The declared options
are `lalaverse` (LalaVerse) and `book-1` (Book 1 / Before Lala), with a separate
`all` control rendered in the switcher (`frontend/src/pages/WorldStudio.jsx:31-35`,
`frontend/src/pages/WorldStudio.jsx:1060-1079`). Selecting a world clears
`selectedChar`, `charDetail`, and `charFilter`
(`frontend/src/pages/WorldStudio.jsx:1062` for a named world,
`frontend/src/pages/WorldStudio.jsx:1069` for `all`).

### Per-character keys and tabs

The character selection state is `selectedChar`; the detail record is
`charDetail` (`frontend/src/pages/WorldStudio.jsx:654-655`). The detail tab
configuration has eleven keys:

```text
overview, essence, aesthetic, voice, desire, relationships, scenes,
follows, depth, demographics, evolution
```

They are declared in `DETAIL_TAB_GROUPS` (`frontend/src/pages/WorldStudio.jsx:58-78`)
and flattened into `DETAIL_TABS` at `frontend/src/pages/WorldStudio.jsx:79`. A
click on a WorldStudio character list item assigns `c.id` to `selectedChar` and
resets the detail tab to `overview` (`frontend/src/pages/WorldStudio.jsx:1246`).

### Data loading and ownership

`loadCharacters(tag)` requests `/api/v1/world/characters` for `all`, otherwise
requests `/api/v1/world/characters?world_tag=<tag>`; it stores the response's
`characters` array (`frontend/src/pages/WorldStudio.jsx:709-719`). The world
change effect reloads that list and clears the selected character and related
state (`frontend/src/pages/WorldStudio.jsx:730-734`). This is world-scoped
list behavior, not registry-scoped loading.

`loadCharDetail(id)` requests `/api/v1/world/characters/:id` and stores
`d.character` as `charDetail` (`frontend/src/pages/WorldStudio.jsx:721-728`).
Selecting a character invokes that loader (`frontend/src/pages/WorldStudio.jsx:737`).
Scenes are separately loaded from `/api/v1/world/scenes?character_id=<charId>`
when the selected detail tab is `scenes` or `evolution`
(`frontend/src/pages/WorldStudio.jsx:876-885`). Depth data is keyed by the
registry character ID, not the WorldCharacter ID, through
`/api/v1/character-depth/:registryCharId`
(`frontend/src/pages/WorldStudio.jsx:238`).

Therefore the current surface mixes scopes: the world switcher, ecosystem
counts, Feed tab, and Relationship tab are global or world-level; character
detail, relationships, scenes, follows, demographics, evolution, and depth are
selected-character views. The RelationshipEngine is mounted without a selected
character prop (`frontend/src/pages/WorldStudio.jsx:1165` — the element is
`<RelationshipEngine />`, with no props), so that tab is not
currently constrained by `selectedChar`.

## Character registry representation and click behavior

The registry page loads `/api/v1/character-registry/registries?limit=50`, then
flattens each registry's `characters` association into one `characters` array,
adding `registry_id` and `registry_name`
(`frontend/src/pages/CharacterRegistryPage.jsx:42-50`; the request is at `:47`
and the flatten at `:50`). The registry API includes character `id`,
`character_key`, status, role, display name, icon, and sort order in its
registry list projection (`src/routes/characterRegistry.js:53-54`; the
`attributes` array is on `:54`).

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
(`src/models/WorldCharacter.js:22-25`), while `RegistryCharacter` carries the
string `character_key` and `registry_id` (`src/models/RegistryCharacter.js:23-32`).

## Registry-to-WorldStudio cross-references

A targeted repository grep for `world-studio`, `world/characters`,
`registry_character_id`, `WorldStudio`, and `character-registry` finds the
direct cross-references relevant to the two surfaces. **The first filing of
this note reported 58 matching files without pasting an instrument, and that
figure does not reproduce.** Re-derived at the verification HEAD, instrument
pasted per H1:

```
$ grep -rlE 'world-studio|world/characters|registry_character_id|WorldStudio|character-registry' frontend/src src | wc -l
83
```

**The discrepancy is disclosed, not attributed** — the first filing's exact
instrument was not recorded, so it cannot be said whether the flags, the paths
or the file set differed. **The count is not load-bearing**: it only frames the
table below, which is the measured product. A successor should use the
instrument above, not the number.

The table narrows that result to the direct registry/WorldStudio links:

| Cross-reference | Evidence |
|---|---|
| WorldStudio list reads the world-character endpoint | `frontend/src/pages/WorldStudio.jsx:709-719` |
| WorldStudio detail loader uses world-character IDs | `frontend/src/pages/WorldStudio.jsx:721-728` |
| WorldStudio scene loader uses world-character IDs | `frontend/src/pages/WorldStudio.jsx:876-885` |
| WorldStudio exposes an explicit Sync to Registry action | `frontend/src/pages/WorldStudio.jsx:1093-1110` |
| WorldStudio depth switches to a registry-character ID | `frontend/src/pages/WorldStudio.jsx:238` |
| WorldStudio backend creates `registry_characters` rows from world characters and writes the cross-link | `src/routes/worldStudio.js:481-621` (the `syncToRegistry` function; `INSERT INTO registry_characters` at `:486-487`, cross-link `UPDATE` at `:611-615`) |
| WorldStudio backend list joins `world_characters` to `registry_characters` to return `character_key` | `src/routes/worldStudio.js:1079-1085` |
| WorldStudio update path re-syncs a linked registry row | `src/routes/worldStudio.js:1130-1165` |
| Registry cards navigate to the registry profile route, not WorldStudio | `frontend/src/pages/CharacterRegistryPage.jsx:124-127` |
| App exposes both route surfaces independently | `frontend/src/App.jsx:428-429`, `frontend/src/App.jsx:504` |

The backend sync is bidirectional in operation but not identical in identity:
WorldStudio creates or updates a `registry_characters` row and stores its UUID
on `world_characters.registry_character_id`; the WorldStudio UI still selects
and edits by `world_characters.id`, while registry navigation selects by
`registry_characters.id`. The relevant insertion and update SQL is visible in
`src/routes/worldStudio.js:486-487` (insert), `src/routes/worldStudio.js:611-615`
(cross-link) and `src/routes/worldStudio.js:1130-1165` (update path).

## Tails, re-derived at the verification HEAD

Instruments and their raw output, per H1 — re-derived, not carried:

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
182
$ grep -r 'XK-4' docs/audit/ | wc -l
82
$ grep -r 'PE #69' docs/audit/ | wc -l
80
```

**Note on the three instruments.** The first is counted with `grep -o`
(occurrences); the second and third with `grep -r | wc -l` (matching lines).
They are not the same unit.

**This document's own contribution to those counts, MEASURED after its text was
final rather than asserted:**

```
$ grep -o 'FD-70' docs/audit/CharacterStudio_Feasibility_2026-09-19.md | wc -l
2
$ grep -c 'XK-4' docs/audit/CharacterStudio_Feasibility_2026-09-19.md
2
$ grep -c 'PE #69' docs/audit/CharacterStudio_Feasibility_2026-09-19.md
2
```

**Two, not one — and the second is this very block.** Each token appears once in
the tails instrument above and once in the self-measurement command beside it.
**A document that measures its own tails increments them by the act of
measuring.**

**Measuring the contribution rather than asserting it is deliberate, and the
difference is not academic.** A note that states in prose that it contains no
occurrence of a token thereby contains an occurrence of that token; the
assertion falsifies itself. The numbers above were taken from the final text,
and a first pass at this section asserted a contribution of one and was wrong by
exactly the recursion described here. **A successor re-deriving after this lands
should read 182 / 82 / 80.**

**This note mints nothing.** FD numbers are minted only by a Fix Plan revision;
XK by the Cross-Keystone Register via a ratifying revision; PE by
`Session_PE_Roster.md`.

## Boundary statement

This note is evidence only. It recommends no design, writes no code, rules
nothing, and tails unminted.

---

# Footer

| Field | Value |
| --- | --- |
| **Type** | Evidence note — feasibility read, standalone |
| **Rules** | **NOTHING.** Only Evoni rules. |
| **Mints** | **NOTHING.** No FD, no XK, no PE. |
| **Closes** | **NOTHING.** No keystone, no finding, no item. |
| **Ships** | **NO CODE.** `docs/audit/` only. |
| **Host / AWS / DB / Cognito contact** | **NONE.** |
| **Application started** | **NO.** |
| **Basis** | `origin/main` at `34b3da26fcab7ea740631e3109eb1ab702856435` (citations re-verified at a later HEAD; see "Citation correction") |
| **Task** | #1547 |
| **Prod** | **FROZEN.** |
