# F-Stats-1 Item 5 — StorytellerMemory `references` Declarations

*Standalone note. Measurement only. Mints nothing, rules nothing, changes no
code. Does not close Item 5.*

## Purpose

`F-Stats-1_Fix_Plan_v1.60.md` §63.1 records `StorytellerMemory`'s two
foreign keys as nullable and their `references` declarations as "not
read." This note performs that read, by the same method §63.1 applied to
`StorytellerMemory`'s four sibling models, and re-derives those four
independently rather than carrying §63.1's summary of them.

## H1 — Basis

```
$ git rev-parse origin/main
5cf6ef4ed5fa92c674f2e8b06706b4230a92c7c6
```

MEASURED. Date: 2026-09-10.

## §63.1, quoted

Read at `origin/main`:

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.60.md
```

**What §63.1 says it did not read**, StorytellerMemory's own table row:

> "`StorytellerMemory` | `line_id` | **true** | not read"
> "`StorytellerMemory` | `character_id` | **true** | not read"

**Its own framing of the question:**

> "Two models declare `references` and two do not... Recorded, not
> assessed."

**§63.1's four-model comparison table, quoted in full:**

| Model | Foreign key | `allowNull` | `references` declared |
|---|---|---|---|
| `Layer` | `episode_id` | **false** | yes |
| `LayerAsset` | `layer_id` | **false** | yes |
| `Scene` | `episode_id` | **false** | no |
| `SceneFootageLink` | `scene_id` | **false** | no |
| `StorytellerMemory` | `line_id` | **true** | not read |
| `StorytellerMemory` | `character_id` | **true** | not read |

## Method §63.1 used, in its own text's terms

For each of the four sibling models, §63.1 read the model's source file at
the named foreign key's attribute definition and recorded two things found
directly in that definition: the `allowNull` value, and whether a
`references` key is present as part of the same Sequelize attribute object
(and, implicitly, what it points to when present). It drew no conclusion
beyond what each file's attribute block shows — the table stops at
"Recorded, not assessed." For `StorytellerMemory`, §63.1 performed the
`allowNull` half of this same read (both keys nullable, per §63.1's main
text) but explicitly did not perform the `references` half, marking both
rows "not read." This note performs the missing half, by the same read.

## Applying the method to StorytellerMemory

**Locating the model file** — not assumed, found by search:

```
$ git grep -ln "StorytellerMemory" origin/main -- 'src/models/'
src/models/StorytellerLine.js
src/models/StorytellerMemory.js
src/models/index.js
```

The model's own definition is in `src/models/StorytellerMemory.js`.

**Reading the file:**

```
$ git show origin/main:src/models/StorytellerMemory.js
```

**Field names verified from source, not carried from §63.1**: the file
declares exactly two foreign-key-shaped attributes on this model,
`line_id` and `character_id` — matching §63.1's citation. No third
candidate field and no differently-named field were found.

**`line_id`, lines 16–19:**

```
      line_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
```

`allowNull: true` (line 18). No `references` key present in the block.

**`character_id`, lines 21–25** (a comment precedes the field at line 21):

```
      // Nullable — may be unassigned when first extracted
      character_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
```

`allowNull: true` (line 24). No `references` key present in the block.

**Whole-file confirmation:**

```
$ git show origin/main:src/models/StorytellerMemory.js | grep -n "references"
(no output — exit 1, no match)
```

The string `references` occurs zero times anywhere in
`StorytellerMemory.js`, across all 178 lines and all of its attributes, not
only the two foreign keys. Neither `line_id` nor `character_id` declares a
`references` key.

**No divergence from §63.1 found on this model**: field names, field
count, and both `allowNull` values match §63.1's table exactly. The one
new fact is the `references` read itself, which §63.1 named as not
performed.

## Re-deriving the four siblings independently

Each read at `origin/main`, in full, without assuming §63.1's summary is
correct — done so the comparison below rests on this note's own reads.

**`Layer`** (`src/models/Layer.js`, located by direct listing, confirmed
present at `src/models/Layer.js`):

```
      episode_id: {                     (line 10)
        type: DataTypes.UUID,
        allowNull: false,               (line 12)
        references: {                   (line 13)
          model: 'episodes',            (line 14)
          key: 'id'                     (line 15)
        },
        onDelete: 'CASCADE'
      },
```

`allowNull: false`; `references: { model: 'episodes', key: 'id' }`
present. **Matches §63.1**: `false` / `yes`.

**`LayerAsset`** (`src/models/LayerAsset.js`):

```
      layer_id: {                       (line 10)
        type: DataTypes.UUID,
        allowNull: false,               (line 12)
        references: {                   (line 13)
          model: 'layers',              (line 14)
          key: 'id'                     (line 15)
        },
        onDelete: 'CASCADE'
      },
```

`allowNull: false`; `references: { model: 'layers', key: 'id' }` present.
**Matches §63.1**: `false` / `yes`. (The same file's second foreign key,
`asset_id`, also carries a `references` block pointing at `assets`/`id` —
outside §63.1's table, which names only `layer_id` for this model; recorded
here because it was read, not because it changes the comparison.)

**`Scene`** (`src/models/Scene.js`):

```
      episode_id: {                     (line 16)
        type: DataTypes.UUID,
        allowNull: false,               (line 18)
        field: 'episode_id',
      },
```

`allowNull: false`; no `references` key in the block. **Matches §63.1**:
`false` / `no`. (The same file's `thumbnail_id` field, elsewhere, does
carry a `references` block — so the idiom exists in this file; it is
simply not used on `episode_id`. Recorded, not assessed.)

**`SceneFootageLink`** (`src/models/SceneFootageLink.js`):

```
      scene_id: {                       (line 33)
        type: DataTypes.UUID,
        allowNull: false,               (line 35)
      },
```

`allowNull: false`; no `references` key in the block. **Matches §63.1**:
`false` / `no`.

## Comparison

| Model | Foreign key | `allowNull` (re-derived) | `references` (re-derived) | Matches §63.1? |
|---|---|---|---|---|
| `Layer` | `episode_id` | false | yes (`episodes`/`id`) | Yes |
| `LayerAsset` | `layer_id` | false | yes (`layers`/`id`) | Yes |
| `Scene` | `episode_id` | false | no | Yes |
| `SceneFootageLink` | `scene_id` | false | no | Yes |
| `StorytellerMemory` | `line_id` | true | **no** (now read) | New — §63.1 marked "not read" |
| `StorytellerMemory` | `character_id` | true | **no** (now read) | New — §63.1 marked "not read" |

**No disagreement found** between this note's independent re-reads of the
four siblings and §63.1's table — all four match exactly, on both
`allowNull` and `references`. `StorytellerMemory`'s two keys are not a
disagreement with §63.1 either; §63.1 named them unread, and this note
supplies the read: **neither foreign key declares a `references` key.**

## What this note does not do

- Takes no position on whether a missing or present `references`
  declaration on any of the six foreign keys is correct, a defect, or in
  need of a fix.
- Proposes no remedy.
- Mints no FD, XK, or PE.
- Does not close Item 5, or declare it closed. §63.1's read is now
  performed; whether that closes the item, and what if anything follows
  from the result, is not decided here.
- Does not assess `LayerAsset.asset_id`'s or `Scene.thumbnail_id`'s
  `references` declarations beyond recording that they exist.
- No live database contact. No prod-box contact. No dev-box contact. No
  AWS, Cognito, or GitHub-settings contact.

## Footer

**Type:** standalone measurement note. **Rules:** nothing. **Mints:**
nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none. **Prod
FROZEN**, untouched.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-10. Basis: `origin/main` at `5cf6ef4ed5fa92c674f2e8b06706b4230a92c7c6`.*
*Authority: `F-Stats-1_Fix_Plan_v1.60.md` §63.1 and the five model source files
(`StorytellerMemory.js`, `Layer.js`, `LayerAsset.js`, `Scene.js`,
`SceneFootageLink.js`), all read directly at `origin/main`, MEASURED.
`PROJECT_CONTEXT.md` is prose about other documents and is not authority.*
