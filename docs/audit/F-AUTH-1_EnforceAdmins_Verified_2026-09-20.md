| **PRIME STUDIOS** — **`enforce_admins` VERIFIED** *`main`'s "Do not allow bypassing the above settings" reads **enabled** on 2026-09-20. **ATTESTED by Evoni**, from the GitHub settings page, outside any agent session. **A reading of the current state only** — it says nothing about when the setting was enabled, and nothing about its value during the `--admin` merges already on the record.* |
| --- |

***Provenance:*** *filed under Task #1557 (register hygiene; waived from the locked sequence by Evoni 2026-09-18). **Rules nothing. Mints nothing. Edits no filed document.** Push, PR create and merge are NOT ruled and are not assumed — Rule 7 gates each separately.*

# `enforce_admins` — Verified Reading, 2026-09-20

**Basis:** `origin/main` at `a7fe6206f838a25d4846f56b7d31d7ce8f2842a9`.

**Date:** 2026-09-20.

**Author:** Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

---

## §1. The reading. ATTESTED.

**`main`'s branch protection has "Do not allow bypassing the above settings"
(`enforce_admins`) ENABLED.**

**Evoni read it as `true` on 2026-09-20**, in the repository's **Settings →
Branches → `main` rule**, in the GitHub web UI. **She found it already enabled
and did not change it.** This note records a verification, not a configuration
change.

**Standing: ATTESTED, and it cannot be otherwise here.**

**No agent session performed, witnessed, or confirmed this reading.** The
drafting session has **no tool that reads or writes branch protection** — its
GitHub tool set covers branches, pull requests, issues and merges, and nothing
in it touches protection rules; there is no `gh` CLI in its environment either.
**That was itself checked, not assumed**, by searching the available tools
before the claim was made.

**A successor cannot verify this line from a clone.** Branch protection leaves
no artifact in the repository. **It must not be upgraded to MEASURED** by anyone
who finds it plausible. Re-reading it requires the settings page or an
authenticated `gh api repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection --jq .enforce_admins`,
run by someone who holds that access.

---

## §2. Scope of the claim

**This is a reading of the current state only.**

- **It does not establish when the setting was enabled.** The settings page
  shows a value, not a history. Nothing here dates it.
- **It is not evidence about the setting's value during the `--admin` bypass
  merges recorded in `F-AUTH-1_SessionConduct_2026-09-19.md`.** Those stand
  exactly as recorded. A reading taken on 2026-09-20 reaches backward to
  nothing.
- **§5's open item is discharged FORWARD, not retroactively.**

**The wording above is deliberate.** "Verified, therefore it was always so" is
the same move as "a successor re-deriving after this lands should read
178 / 78 / 76 unchanged" — a claim reaching past what was actually measured,
which is the construction the correction banner on
`EpisodeDetail_OverviewTest_Read_2026-09-20.md` exists to correct. **A setting
reading is true of the moment it was taken.**

---

## §3. Discharge

`F-AUTH-1_SessionConduct_2026-09-19.md` §6 states, on its own face:

> **Does not discharge `enforce_admins`.** That debt **remains open and
> unverified**: the register cannot show its setting, and nothing on 2026-09-19
> checked GitHub branch protection directly.

**That line was true when filed and remains true of its own basis
(`23887d44a`).** Someone looked on 2026-09-20; nobody had on 2026-09-19.

**This note discharges that item forward, as of 2026-09-20.**

**The conduct note is not edited.** It is a merged register document and is
immutable (CLAUDE.md; `/audit-file` rule 2). **This is a forward discharge, not
an amendment and not a banner** — the conduct note's §6 keeps its wording, and a
reader following the item from there arrives here.

---

## §4. What this note does not do

- **Rules nothing.** Only Evoni rules.
- **Mints nothing.** No FD, no XK, no PE number.
- **Edits no filed document**, including the 2026-09-19 conduct note.
- **Makes no retroactive claim** about branch protection at any earlier date.
- **Closes no keystone and no finding.** It discharges one open item, forward.
- **Ships no code.** `docs/audit/` only.
- **Makes no host, AWS, database or Cognito contact**, starts no application,
  and dispatches no workflow.

---

## §5. Tails, re-derived at this basis

Instruments and raw output, per H1 — re-derived, not carried. **Measured after
this note's text was final:**

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
188
$ grep -r 'XK-4' docs/audit/ | wc -l
88
$ grep -r 'PE #69' docs/audit/ | wc -l
86
```

**Note on units.** The first counts occurrences (`grep -o`); the second and
third count matching lines (`grep -r | wc -l`). They are not the same unit.

**This note's own contribution: 1 of each. MEASURED after the text was final,
not predicted.**

**The task that commissioned this note predicted a contribution of ZERO**, on
the reasoning that a note about branch protection has no occasion to name a
finding number. **That prediction was wrong, and it was wrong for a structural
reason worth recording:** `/audit-file` rule 5 requires that a filed note
re-derive the tails and **paste the instruments**. The instruments *are* the
tokens. **A note that re-derives the tails cannot have a zero contribution.**

**A first draft of this section asserted ZERO and said so in a paragraph
contrasting itself favourably with the false ZERO in
`EpisodeDetail_OverviewTest_Read_2026-09-20.md` §10.** It was committing that
error while explaining it, six lines below the instrument block that falsified
it. **Caught by measuring after the text was final** — the same check that
caught the two predictions before it, and the same check that #1550 §10 skipped.

**At this basis, `docs/audit/` reads 188 / 88 / 86.** A later re-derive will
differ as the register grows; that drift is not this note's error.

**Owed Index chain tail is unchanged at `Amd30`.** This note is not an amendment
to the chain and does not continue it.

---

# Footer

| Field | Value |
| --- | --- |
| **Type** | Evidence note — one-item verification, standalone |
| **Rules** | **NOTHING.** |
| **Mints** | **NOTHING.** |
| **Closes** | **NOTHING.** Discharges one open item, forward. |
| **Ships** | **NO CODE.** |
| **Host / AWS / DB / Cognito contact** | **NONE.** |
| **Standing of §1** | **ATTESTED by Evoni.** Not measurable from a clone. Do not upgrade. |
| **Basis** | `origin/main` at `a7fe6206f838a25d4846f56b7d31d7ce8f2842a9` |
| **Date** | 2026-09-20 |
| **Task** | #1557 |
| **Prod** | **FROZEN.** |
