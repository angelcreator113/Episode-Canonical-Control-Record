| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Rules the four unwired-model patterns. Mints nothing. Limb 1 remains DISCHARGED.* |
| --- |

**Document version**

**v2.71 — FIX PLAN REVISION. Mints nothing. Rules on the four patterns
recorded across the models-subset enumeration and the unwired-models
history trace.** This document lands Evoni's ruling, given directly in
session and filed at issue #1250, transcribed verbatim below — see §3.
**The register tail moves from `v2.70` to `v2.71` as of this filing.**

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.70.md`. **v2.70's ruling on the
three itemization deltas stands and is not re-ruled here** — this
document rules a separate matter: disposition of the four unwired-model
patterns that `v2.69` §7 item 2 (carried forward at `v2.70` §4 item 1)
left as an unevaluated question. **What v2.71 supersedes:** the framing
of `src/models/index.js`'s hand-maintained subset gap as unevaluated —
the enumeration (PR #1241) and the history trace (PR #1245, correction
banner PR #1247) have since supplied that evaluation, and this document
is the first Fix Plan revision to rule on what it means. **What stands
unchanged:** limb 1's discharge (`v2.69` §6 Ruling 1), FD-64's closure
(Ruling 2, `v2.70` §4 item 1's own carry-forward unaffected), the three
itemization deltas' disposition (`v2.70` §3), FD-67's open status
(Ruling 3), and FD-70's unminted status (Ruling 5) — none of these is
re-ruled or touched here.

**Basis:** `origin/main` at `9c7d4df0b9d79c94c2df613208ed6b83b50967b9`,
2026-09-04.

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.69.md
F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md
F-AUTH-1_Fix_Plan_v2.70.md
```

No `F-AUTH-1_Fix_Plan_v2.71.md` existed on `main` before this document.
`v2.70` was the newest Fix Plan revision; this document supersedes it as
tail.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Ruling by Evoni**, given directly in session and filed at issue #1250,
transcribed verbatim below — see §3.

**Status**

**Revision. Rules one matter, on Evoni's word.** Four unwired-model
patterns — `ShowArc`, `UiOverlayType`, `SocialProfileTemplate` (choice,
not constraint), and the three `Script*` models as one pattern
(constraint, not preference) — recorded; **none minted, no action
follows from any**. Limb 1 remains **DISCHARGED**, unchanged from
`v2.70`. FD tail remains **FD-69** (retired; FD-70 next-available,
unminted); XK tail **XK-3**; PE tail **PE #68**. Prod **FROZEN**.

---

# §1. Register tails, re-derived with both instruments

**Onboarding §4 rule 4, both instruments, re-run at this basis:**

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ for f in v2.68 v2.69 v2.70; do
    echo "$f: $(grep -oE 'FD-[0-9]+' docs/audit/F-AUTH-1_Fix_Plan_$f.md | sort -t- -k2 -n -u | tail -1)"
  done
v2.68: FD-69
v2.69: FD-70
v2.70: FD-70

$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
56:### XK-1 — `paranoid` exposure
207:### XK-2 — row-scope not enforced in SQL
288:### XK-3 — no authorization substrate for the tenancy root

$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -3
66
67
68
```

**The cross-revision instrument's raw output names `FD-70` for `v2.69`
and `v2.70`; this is not a mint.** Both revisions' own text state their
`FD-70` mentions are "next-available, unminted" citations — the same
distinction `v2.70` §1 and `PROJECT_CONTEXT.md` §6.3 already draw. Both
instruments agree the tail is **FD-69**, retired; **FD-70 remains
next-available and unminted**, unchanged by this document. XK tail
**XK-3**. PE tail **PE #68**. All three unchanged from `v2.70`'s own
re-derivation.

---

# §2. Evidence this ruling cites

**Verified present at this basis; cited, not restated as this
document's own findings.**

```
$ git show origin/main:docs/audit/F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md | head -3
| **PRIME STUDIOS** **F-AUTH-1 — MODELS SUBSET ENUMERATION** *Enumerates every Sequelize model defined under `src/models/` against `src/models/index.js`'s registration mechanisms. Does not judge, rule, or fix. Does not reopen FD-64.* |
| --- |

$ git show origin/main:docs/audit/F-AUTH-1_Unwired_Models_History_2026-09-04.md | sed -n '26,27p'
| **PRIME STUDIOS** **F-AUTH-1 — UNWIRED MODELS HISTORY** *Traces the git history of the six models `F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md` found unwired or guard-referenced. Records history. Does not judge, rule, or fix.* |
| --- |

$ git show origin/main:docs/audit/F-AUTH-1_Unwired_Models_History_2026-09-04.md | grep -c "^> \*\*BANNER"
1
```

Three documents: **the models-subset enumeration**
(`F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md`, PR #1241) — found
three registration mechanisms in `index.js`, `db.models` omitting 95 of
151 defined models, six of which are the subject of this ruling. **The
unwired-models history trace** (`F-AUTH-1_Unwired_Models_History_2026-09-04.md`,
PR #1245) — traced each of the six's git history and found four
distinct patterns. **That trace's correction banner** (same file, PR
#1247) — corrects a pasted-output mismatch in the trace's §5; the
trace's own conclusions and this ruling are unaffected by what the
banner corrects.

**The two facts the ruling's constraint clause rests on, re-verified
here:**

```
$ grep -rl "script_edit_history\|script_learning_profiles\|script_suggestions" src/migrations/
(no output)

$ git show --format='%H %ad %s' --date=short --no-patch 0357ee48bf9631d3d496484b69f549e6dd982bf3
0357ee48bf9631d3d496484b69f549e6dd982bf3 2026-03-07 fix: audit model registration — add missing requiredModels, exports, and new sprint models

$ git show --name-only --format='' 0357ee48bf9631d3d496484b69f549e6dd982bf3 | grep -i migration
(no output)

$ git show 0357ee48bf9631d3d496484b69f549e6dd982bf3 -- src/models/index.js | grep -E "^\+.*Script(EditHistory|LearningProfile|Suggestion),"
+  ScriptLearningProfile,
+  ScriptEditHistory,
+  ScriptSuggestion,
```

No migration exists in the running tree for `script_edit_history`,
`script_learning_profiles`, or `script_suggestions`. The March 2026
commit (`0357ee48`) added the three models to `requiredModels` — one of
`index.js`'s three registration mechanisms — while touching zero
migration files. Both facts verify exactly as the ruling's rationale
states them.

---

# §3. The ruling

**Filed by Evoni, transcribed verbatim. No word altered.**

> **Ruling.** All four patterns recorded in
> `F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md` and
> `F-AUTH-1_Unwired_Models_History_2026-09-04.md` are recorded, and no
> action follows from any of them. Nothing is minted.
>
> **Rationale.** No route, table, or running behaviour is affected by
> any of the four. `ShowArc` is registered and has its migration; it is
> simply uncalled. `UiOverlayType`'s table is live and queried directly
> by `uiOverlayService.js`; the model object is inert beside it.
> `SocialProfileTemplate`'s guard is stated in its own adding commit as
> deliberate, and whether its table now exists is a database question
> this ruling does not reach. For those three, recording without action
> is a choice, not a constraint. The three `Script*` models are
> different: they carry no migration in the running tree, so making them
> functional would require creating the missing tables, which the
> freeze does not permit — recording without action is the only
> disposition available to them at this basis, not merely the one
> preferred. Should the freeze lift, that changes for those three and
> for nothing else here. This ruling reaches no question about whether
> any underlying table currently exists, which is not repo-derivable.
>
> *Provenance: this ruling's wording was proposed by the drafting
> session and approved by Evoni, not composed by her. Two substantive
> corrections to the drafted text are hers: the distinction between
> choice and constraint across the four patterns, and the correction
> that the freeze blocks creating the missing tables rather than
> completing the registration — the March 2026 commit having registered
> two mechanisms without touching a migration. Disclosed per the same
> test `F-AUTH-1_Fix_Plan_v2.69.md`'s Ruling 2 note and correction banner
> apply.*

---

# §4. Owed carried forward — none minted here

**`v2.70` §4 item 1 (the hand-maintained `models` subset question) is
complete as of the enumeration and history trace; this document is its
disposition — see §3.** Item 2 continues unchanged, carried forward, not
addressed here:

1. **Per-item Tier adjudication of the 40 declarations touched by
   FD-67's remedy** — unchanged from `v2.70` §4 item 2 (originally
   `v2.69` §7 item 3).

None of the one mints an FD, XK, or PE number. It is not closed by this
revision.

---

# §5. What this revision does not do

- **Does not characterize `ShowArc`, `UiOverlayType`,
  `SocialProfileTemplate`, or the three `Script*` models as dead code, a
  defect, or missing wiring.** The ruling (§3) records dispositions; the
  evidence documents record patterns.
- **Does not rule on whether any underlying table currently exists.**
  Explicitly named in the ruling as not repo-derivable.
- **Does not rule on `SocialProfileTemplate`'s guard beyond what §3
  says** — that it is stated in its own adding commit as deliberate.
- **Does not recommend deletion, registration, or migration work for any
  model.** No action follows from any of the four patterns at this
  basis.
- **Does not mint FD-70 or any number.**
- **Does not reopen FD-64, limb 1, or `v2.70`'s delta ruling.** Limb 1
  remains DISCHARGED per `v2.69` §6 Ruling 1; `v2.70` §3 stands
  unchanged.
- **Does not edit `v2.70`, the two evidence documents, or any other
  filed document.** All stay on `main`, unedited, as filed.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---
