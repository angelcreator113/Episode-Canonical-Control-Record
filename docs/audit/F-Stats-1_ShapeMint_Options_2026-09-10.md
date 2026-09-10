# F-Stats-1 Item 4 — Shape-Mint Options (v1.48 §51.5)

*Standalone note. Briefing only. Takes no option, recommends none, ranks
nothing, mints nothing, rules nothing.*

## Purpose

F-Stats-1's 40-site / 39-handler / 20-file shape stands unminted, per
`v1.60`'s own text, "v1.48 §51.5 option 3 stands." This note reads §51.5
itself and lays out what it offers as options, in its own words, plus
where the 40/39/20 figures came from, so the mint decision can be ruled
in chat. It takes no option and characterizes none as preferable.

## H1 — Basis

```
$ git rev-parse origin/main
42147b6a958ff39ebbf40d1e99bfe3dbd9476df1
```

MEASURED. Date: 2026-09-10.

## v1.48 §51.5, every option quoted

Read at `origin/main`:

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.48.md
```

§51.5 is titled **"Homing — recorded, not decided"** and presents exactly
three options, as a table, numbered as the table numbers them. No fourth
option and no fewer than three are named.

| Option | §51.5's own label |
|---|---|
| 1 | "Mint as its own XK entry" |
| 2 | "Widen XK-2 to cover both" |
| 3 | "Record and defer" — **"Taken here"** |

## What each option does and costs, in §51.5's own text

**Option 1 — Mint as its own XK entry.** §51.5's note column, quoted in
full: "Reach spans F-Ward-1 and touches an F-AUTH-1-tracked route; CKR §2
criterion 1 appears satisfiable on the same grounds XK-2 used." §51.5 says
nothing further about this option outside the table — no cost or
foreclosure is stated for it beyond this one sentence.

**Option 2 — Widen XK-2 to cover both.** §51.5's note column: "Rejected by
§51.4's remedy test, but recorded because it is the cheaper register
outcome." §51.4 is the section §51.5 points to for the rejection; read at
the same basis, §51.4's own words are: "A remedy for XK-2 does not fix
these... XK-2's remedy candidates — restating the scope predicate on every
write, a repository-layer scoping helper, row-level security — all assume
a tenant value is in hand. None of these six handlers has one." And: "Two
findings that share a symptom and not a remedy are two findings. Folding
them would produce a single entry whose remedy field could not be
filled." §51.4 itself closes with: "Recorded as the argument for
separation, not as a ruling. The ruling is §51.5's."

**Option 3 — Record and defer. Taken here.** §51.5's own text, quoted in
full: "Option 3 is taken for the same reason v1.44 took it for class 1:
minting is a Cross-Keystone Register action taken once, and the extent
here is seven verified sites with three unread and a population that was
selected as *the files XK-2's probe could not see* — not as a survey of
where this shape lives. This shape's own extent has not been measured on
its own terms." And: "Nothing here is minted, no number is issued, no
ownership is claimed."

## v1.60's "option 3 stands" line, quoted in context

Two places in v1.60 restate the posture:

> "Does not mint the shape. **v1.48 §51.5 option 3 stands** across all 40
> sites." — What this revision does not do

> "Changes **no** unit disposition, no instance classification, no shape
> total. Shape stands at **40 / 39 / 20**, unminted; v1.48 §51.5 option 3
> stands." — Register hygiene

**What "stands" means in §51.5's own terms: nothing — the word does not
appear in §51.5.** §51.5's own text says "Option 3 **is taken**," not
"stands." Checked directly:

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.48.md | grep -n "stands"
(no output — exit 1, no match in the file)
```

The word "stands" is not §51.5's own vocabulary. It first appears in the
very next revision:

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.49.md | grep -n "stands\|51\.5"
157:**Still unminted, unowned, unnumbered.** v1.48 §51.5's option 3 stands.
217:- **Does not mint any finding.** The second shape remains unminted, unowned,
218:  and unnumbered. v1.48 §51.5's option 3 stands.
```

From v1.49 forward, every revision that touches this shape restates "v1.48
§51.5['s] option 3 stands" as shorthand for the same posture — option 3
remains the operative choice, unrevisited — but that phrasing originates
at v1.49, not in §51.5's own text.

## Provenance of 40 / 39 / 20 — measured across revisions

Each revision's shape figure and stated basis SHA, read directly:

```
$ for v in 1.48 1.49 1.50 1.51 1.52 1.53 1.54 1.55 1.56 1.57 1.58 1.59 1.60; do
    git show "origin/main:docs/audit/F-Stats-1_Fix_Plan_v${v}.md" | grep -oE 'Basis `[a-f0-9]+`' | tail -1
  done
```

| Revision | Shape (sites / handlers / files) | Basis SHA | What changed |
|---|---|---|---|
| v1.48 §51.3 | 7 / 6 / 5 | `e01c3b26` | Shape recorded for the first time — not minted |
| v1.49 §52 | 10 / 9 / 6 | `8c7d74af` | +3 instances, `episodes.js` |
| v1.50 §53 | 10 / 9 / 6 | `baf80537` | Unchanged — mount verification only |
| v1.51 §54 | 10 / 9 / 6 | `0608d2d9` | Unchanged — reads-slice sizing attempted, declined |
| v1.52 §55 | 11 / 10 / 7 | `b600f4df` | +1 instance, `storyteller.js:280` |
| v1.53 §56 | 18 / 17 / 7 | `0fbed757` | +7 instances, `storyteller.js` complete |
| v1.54 §57 | 24 / 23 / 8 | `42dae022` | +6 instances, `sceneSetRoutes.js` complete |
| v1.55 §58 | 30 / 29 / 11 | `2f14832b` | +6 instances, several files |
| v1.56 §59 | 30 / 29 / 11 | `5c5fa08f` | Unchanged — FD-62 ownership overlay, population explicitly unchanged |
| v1.57 §60 | 30 / 29 / 11 | `ff3637ec` | Unchanged |
| v1.58 §61 | 33 / 32 / 13 | `5f7ee6b4` | +3 instances, `layers.js` ×2, `footage.js` |
| v1.59 §62 | 40 / 39 / 20 | `5f7ee6b4` | +7 instances, 4 excluded, 1 out of shape, 1 false positive |
| v1.60 §63 | 40 / 39 / 20 | `5f7ee6b4` | Unchanged — "no instance classification changes, no site leaves or joins the shape" |

**40 / 39 / 20 is first stated at v1.59 §62** ("Extends: the shape's
instance record to 40 sites / 39 handlers / 20 files"), reached by
thirteen revisions of incremental extension from v1.48's original 7 / 6 /
5. v1.60 restates the same figure unchanged. No revision after v1.60
exists in the repo (per the numeric scan performed for the Phase B
scoping note, `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`, cited as a
scoping note and not re-derived here).

## What instrument a mint would require

v1.60 §63.2, "On authority," quoted in full:

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.60.md | sed -n '95p'
```

> "A Fix Plan revision is the instrument that rules in this register —
> v1.57 §60.1 records that cross-keystone entries acquire ownership only
> when a Fix Plan revision ratifies them, and Audit Handoff v22 §2 records
> F-AUTH-1 v2.38 §1.3 ruling a sequencing question the same way. This is
> that instrument, used for the first time on F-Stats-1's own accounting."

No instrument is drafted here. This note is not that revision.

## What this note does not do

- Takes no option among the three §51.5 names.
- Recommends none, ranks none, and characterizes none as preferable,
  cheaper, safer, or more consistent than another.
- Mints no FD, XK, or PE.
- Does not rule the shape-mint decision, and does not draft the Fix Plan
  revision that would.
- Does not re-derive `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`'s own
  findings; cites it once, as a scoping note, for the fact that no F-Stats-1
  revision later than v1.60 exists in the repo.
- No live database contact. No prod-box contact. No dev-box contact. No
  AWS, Cognito, or GitHub-settings contact.

## Footer

**Type:** standalone briefing note. **Rules:** nothing. **Mints:**
nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none. **Prod
FROZEN**, untouched.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-10. Basis: `origin/main` at `42147b6a958ff39ebbf40d1e99bfe3dbd9476df1`.*
*Authority: `F-Stats-1_Fix_Plan_v1.48.md` §51.1–§51.5 and `F-Stats-1_Fix_Plan_v1.60.md`
§63.2, both read directly at `origin/main`, MEASURED, plus the intervening
revisions' own shape figures (v1.49–v1.59), each read directly and cited above.
`PROJECT_CONTEXT.md` is not authority.*
