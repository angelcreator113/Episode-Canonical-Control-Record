# v25 Draft Material — `#NNN` Notation Sweep

| | |
|---|---|
| **Purpose** | Converts the register-wide `#NNN` autolink hazard from a named hazard into a measurement, and records a notation defect the register carries independently of GitHub. |
| **Created** | 2026-08-24 |
| **Basis** | `origin/main` at `7c508189c369a5a384d55cc2bea371d9ebec56f3`. |
| **Absorption condition** | **Draft material, not a chain link.** v25 absorbs this; on v25 landing it is VOID and should be deleted or marked superseded in the same commit that lands v25. |
| **Companion** | `docs/audit/v25_Draft_Material_Publication_Surface_2026-08-24.md` §2, which names the hazard this document measures. That file does not point here. |
| **Notation** | Every `#NNN` below is wrapped in inline code, verified by the detector described at §3. A document measuring this hazard while committing it would be self-refuting. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Closes nothing, reopens nothing, changes no gate, disposition, owner or severity. No live database contact. One live GitHub read was performed — see §4.2. |

---

## §1 Result

| | |
|---|---|
| `.md` documents in `docs/audit/` at basis | 344 |
| **Containing at least one bare `#NNN`** | **279 — 81%** |
| Total bare occurrences | 3419 |
| **Distinct target numbers, live range `#1`–`#1118`** | **394** |
| Sum of distinct targets across all documents | 1232 |
| **Worst single document** | **`Session_PE_Roster.md` — 60 distinct live targets** |

"Bare" means outside inline code spans and outside fenced blocks — the two
constructions under which GitHub Flavored Markdown suppresses autolinking.

---

## §2 THE NUMBER THAT MATTERS IS SMALLER THAN THE COUNT

**3419 occurrences is not the blast radius, and reporting it as such would
overstate the finding.**

GitHub records **one cross-reference per (source, target) pair.** A comment
mentioning `#9` one hundred and twenty-five times produces **one** backlink on
item `#9`, not one hundred and twenty-five.

**The correct measure is distinct targets per document.** Pasting one register
document into a GitHub comment field writes at most as many backlinks as that
document has distinct live targets.

**`Session_PE_Roster.md` carries 60.**

That document is a **v24 Sec 1 named authority** and the routing target for all
production-environment items — the register directs production observations to
it by name. It is not an obscure file; it is among the most quotable documents
in the corpus, and quoting it into a GitHub field writes onto 60 unrelated
artifacts.

The corrected figure is smaller and worse.

### §2.1 Widest spread, by document

| Distinct live targets | Document |
|---|---|
| 60 | `Session_PE_Roster.md` |
| 48 | `Prime_Studios_Audit_Handoff_v8.md` |
| 30 | `v10_session_brief.md` |
| 26 | `F-Deploy-1_G1_Audit.md` |
| 26 | `F-AUTH-1_Fix_Plan_v2.37.md` |
| 19 | `F-Stats-1_Fix_Plan_v1.12.md` |

---

## §3 Method, and controls in both directions

**Detection:** strip fenced blocks, strip inline code spans, then match `#NNN` in
what remains. A pattern inspecting characters adjacent to `#` cannot see either
construction — that is the defect recorded at the companion document's §3, and
it is why the strip happens first.

**Control 1 — no false positive.** `v25_Draft_Material_Publication_Surface_2026-08-24.md`
contains 16 references, all wrapped. The detector reports **0 bare**. PASS.

**Control 2 — it detects.** Control 1 alone is insufficient: **a detector that
always returned zero would pass it.** The corpus result is non-zero, which
establishes the detector distinguishes the two outcomes it exists to
distinguish. Both halves are required; one is not a control.

**False-positive class, identified and bounded.** Two occurrences of
`#25940612415` — a GitHub Actions run ID in the phrase *"dev deploy run"*, not a
reference, and far outside any issue range. Restricting to the live band moved
distinct targets from 395 to 394.

---

## §4 Five namespaces, one notation

| Namespace | Occurrences | Autolink correctness |
|---|---|---|
| **`Decision #N`** | ~400+ | **wrong** — resolves to an unrelated item |
| `PE #N` | 643 | **wrong** |
| `PR #N` | 594 | **correct and harmless** |
| `FD #N` (in hash form) | 1 | **wrong** |
| Separator-continuation | ~300 | **wrong, and unresolvable — see §4.3** |

`PR #N` is the only form GitHub interprets as the register intends. Every other
namespace collides with issue and pull-request numbering, and GitHub has no way
to tell them apart.

### §4.1 `Decision #N` was the largest namespace and was initially miscounted

The first pass binned ~2181 occurrences as `UNMARKED`. Inspecting the left
context showed the bulk of that bucket is `Decision #N` in its various
punctuations — `**Decision`, `. Decision`, `(Decision`, `; Decision`,
`— Decision`, `# Decision`. **The largest single namespace was hidden inside a
residual category by a classifier that only looked for four prefixes.**

Recorded because the same error shape recurs: a category named for what the
instrument failed to match, read as though it named a property of the data.

### §4.2 The targets resolve — established by live read, not inferred

GitHub renders `#N` as plain text when no such item exists, so the entire hazard
depends on the referenced numbers existing. **That was not assumed.**

`#9` was read live. It exists: a closed pull request created 2026-01-15, titled
*"Merge pull request `#8` from angelcreator113/main-clean"*.

**The register references `Decision #9` 125 times.** Every one of them points at
a January merge pull request unrelated to any decision.

Issue and pull-request numbering is shared and sequential, and this repository
has reached `#1118`, so the full live band `#1`–`#1118` is allocated. The 394
distinct targets all fall inside it.

### §4.3 The separator-continuation pattern is a notation defect, not a rendering one

Roughly 300 occurrences follow a separator rather than a namespace marker:
`Decision #9, #14, #51` · `#3 / #4` · `#58 – #62` · table cells beginning `| #67`.

**Only the first reference in such a list carries its namespace.** Everything
after it is a bare number whose meaning depends on backtracking to the start of
the enumeration.

**This is independent of GitHub.** A human reading the register on disk has the
same problem: `#51` in a list cannot be resolved without finding the prefix that
governs the list. Wrapping references in inline code fixes the autolink and
**does nothing for this**. It is a defect in how the register writes numbers,
surfaced by an investigation into how GitHub renders them.

---

## §5 Bounds — measured hazard, unmeasured incidence

**Neither of these is weakened by the 81% figure and neither should be read as
implied by it.**

- **No register document is established to have been pasted into a GitHub
  field.** The hazard is live and measured; **the number of times it has fired is
  unknown and is not derivable from the tree.** The only case known to this
  session is pull request `#1118`'s body, caught before submission.
- **Whether the 394 targets already carry accumulated cross-references from
  prior pastes is unread.** Establishing it requires issue-timeline reads, which
  the available issue-read method does not expose — recorded at the companion
  document's §5.

**81% is a measure of exposure, not of occurrence.**

---

## §6 Open, carried

| Item | Status |
|---|---|
| How many times the hazard has fired | Unknown; not derivable from the tree. §5. |
| Accumulated cross-references on the 394 targets | Unread; timeline not reachable. §5. |
| Remediation of bare `#NNN` across 279 documents | Not attempted. Would mean editing 279 filed documents in place — the carriage defect at scale. Not this document's business. |
| The separator-continuation notation defect | Named, unremediated. §4.3. Distinct from the autolink hazard and not fixed by wrapping. |
| Whether `.docx` register documents carry the same notation | Out of scope; this sweep covers `.md` only. |

---

## §7 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not remediate any document's notation.
- Does not claim any document has been pasted, or that any backlink exists.
- Does not read or modify any issue or pull request. One issue was read at §4.2,
  read-only, to establish that targets resolve.
- Does not edit its companions to point here.
- Does not confer authority on itself. Draft material, void on v25 landing.
- No live database contact. Prod untouched.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 result: 279 of 344 documents, 81%, 3419 bare occurrences, 394 distinct live targets. §2 occurrence count is not blast radius — one cross-reference per source-target pair; corrected measure is distinct targets per document; `Session_PE_Roster.md` at 60, a v24 Sec 1 named authority. §2.1 widest-spread documents. §3 method: strip fences and code spans before matching; control 1 no-false-positive; control 2 detection, required because a stub returning zero passes control 1; false-positive class bounded to a GitHub Actions run ID. §4 five namespaces share one notation; only `PR #N` autolinks correctly. §4.1 `Decision #N` was the largest namespace and hid inside a residual category named for the classifier's failure. §4.2 targets resolve, established by live read of `#9`, a January merge pull request that 125 `Decision #9` references point at. §4.3 separator-continuation is a notation defect independent of GitHub and unfixed by wrapping. §5 two bounds: incidence unknown, accumulated cross-references unread; 81% measures exposure not occurrence. §6 five carried items. §7 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-24. `origin/main` at `7c508189`.*
*v25 draft material. Void on v25 landing. Mints nothing. Evaluates no fix. No live database contact.*
