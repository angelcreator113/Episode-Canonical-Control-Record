# v25 Draft Material — Publication-Surface Findings

| | |
|---|---|
| **Purpose** | Four findings produced while opening a draft pull request for the other four draft-material files. All concern the publication and review surface rather than the register's contents. |
| **Created** | 2026-08-24 |
| **Basis** | `origin/main` at `7c508189c369a5a384d55cc2bea371d9ebec56f3`. Branch head at filing: `e5eaed1f`. |
| **Absorption condition** | **Draft material, not a chain link.** v25 absorbs this; on v25 landing it is VOID and should be deleted or marked superseded in the same commit that lands v25. |
| **Companions** | The four other `v25_Draft_Material_*` files, same branch. **None points here.** A forward pointer would require editing a filed document in place — the defect several of these documents record. Absent by decision. |
| **Note on this document's own notation** | Every `#NNN` reference below is wrapped in inline code. §2 is the reason. A finding about a rendering hazard that fires in the document reporting it would be self-refuting. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Closes nothing, reopens nothing, changes no gate, disposition, owner or severity. No live database contact. |

---

## §1 What this carries

Four findings. None is about register content; all four are about the surface on
which register content is published, reviewed, and approved. They were produced
in the course of opening pull request `#1118` and would otherwise be
transcript-only.

---

## §2 FINDING — `#NNN` register notation autolinks in any GitHub comment field

**The register uses `#NNN` for at least three distinct namespaces:** PE numbers
(`PE #63`, `PE #67`), FD numbers where written in that form, and genuine pull
request numbers. **GitHub cannot distinguish them.** Any bare `#NNN` in a comment
body, pull request body, issue body, or review comment is autolinked to the
issue or pull request bearing that number in the same repository.

**The consequence is an outward-facing write.** GitHub records a cross-reference
on the target, so citing `PE #63` in a pull request body posts a backlink onto
issue or pull request `#63` — an unrelated artifact belonging to unrelated work.
The register's own notation causes writes to items it never meant to touch.

**Caught before it fired.** Three occurrences — one `PE #67`, two `PE #63` —
were wrapped in inline code before pull request `#1118` was opened. Inline code
spans are not autolinked under GitHub Flavored Markdown.

**This is not a pull-request-body problem.** It fires on every register document
that reaches a GitHub comment field by any route: a body, an issue, a review
comment, a pasted excerpt. The register's documents are written for the tree,
where `#NNN` is inert, and rendered on a surface where it is not.

**Remedy:** wrap `#NNN` in inline code whenever register notation crosses into a
GitHub field. **Scope not established** — no audit was performed of how many
existing register documents contain bare `#NNN`, nor of how many have already
been rendered on such a surface. That is unread.

---

## §3 FINDING — a detector that could not distinguish the outcomes it existed to distinguish

After wrapping the three references, their absence was checked with:

```
grep -nEo '(^|[^`])#[0-9]+' pr-body.md
```

**It reported all three still bare.** The wrap had succeeded; the detector was
wrong. It tests the character immediately preceding `#`, which in `` `PE #63` ``
is a space, not a backtick. **It would have reported identical failure whether or
not the fix had worked** — it could not distinguish success from failure, which
is the only thing it was built to do. A correction was nearly made on its output.

Re-verified with a test that can actually fail: count `#NNN` occurrences against
`#NNN`-inside-code-span occurrences. Three and three.

### §3.1 Contrast with the same day's positive case

Two instrument premises went unstated in one sitting, by the same party, with
opposite outcomes:

| | Squash-only premise | This detector |
|---|---|---|
| Premise | `main` is squash-merged, so >1 commit means later amendment | the character before `#` indicates code-span membership |
| Fate | **stated, then tested** — 1295 merges of 5204 proved it false | **built and trusted** — ran, reported, nearly acted on |
| Caught by | testing before using the output | the result contradicting a known-true fact |

**The difference is not care. It is whether the premise surfaced.** The first was
written down as a sentence that visibly needed a warrant. The second was compiled
into a regex where no sentence existed to inspect. Whether an implicit premise
would be caught remains **untested** — both instances here surfaced by accident
of form.

---

## §4 FINDING — post-submission mutation of a gated artifact

Pull request `#1118`'s body was drafted, reviewed, and explicitly approved before
submission. **The stored body is not the approved body.** It carries two
attribution footers the approved text did not.

Two mechanisms, and they are not the same finding:

| | Origin | Preventable | Recurs |
|---|---|---|---|
| Footer 1 | appended by the executing party per harness convention | **yes** — by disclosing it during review | only if not disclosed |
| Footer 2 | appended server-side after submission | **no** | **on every pull request this register ever opens** |

**The second is the finding.** A party to neither gate mutates the artifact after
the approval that gated it, with no signal to the approver. That is the carriage
shape — content changes, the thing identifying it does not, the approver has no
route to the difference — relocated from the document chain to the review
surface.

**It is aggravated by the reviewing party having no independent read.** In this
workflow the approver's only view of the submitted artifact is the executing
party's report of it. A silent post-submission edit is therefore invisible
unless the executing party reads the artifact back and compares — which is not
a step anything in the workflow requires.

**Neither footer violates a stated constraint.** Neither contains a closing
keyword adjacent to a reference, nor a bare `#NNN`. **That is what makes it worth
recording rather than fixing:** the divergence is benign here and the mechanism
is not.

**Ruled: the executing party's footer is not to be stripped.** Removing it would
edit the artifact under review after its approval — performing the defect as its
own remedy — and would not remove the server's footer in any case. Recorded and
left in place.

---

## §5 FINDING — specification-plus-source is not render-time verification

Pull request `#1118`'s body was checked for autolinking. What was established:

- the body **as stored** preserves all three references inside inline code spans,
  read back from the API rather than from the local file; and
- GitHub Flavored Markdown does not autolink inside inline code spans.

**What was not established:** that the rendered output contains no autolink. The
API returns raw markdown, not rendered HTML. The observable proxy — a
cross-reference timeline event on items `#63` and `#67` — is also unreachable:
`issue_read` returns issue details and comments, and cross-references are
timeline events it does not expose.

**The two are different claims.** A specification-plus-source argument says the
render *should* hold. A render-time observation says it *did*. Substituting the
first for the second would be the §3 defect performed deliberately rather than
by accident — a check reported as answering a question it cannot reach.

**Recorded as unverified**, resolvable in seconds by a human opening the pull
request: plain monospace means it held; blue links mean it fired.

---

## §6 Open, carried

| Item | Status |
|---|---|
| Scope of bare `#NNN` across existing register documents | Unread. No audit performed. §2. |
| Whether any register document has already been rendered on a GitHub surface with bare `#NNN` | Unread. §2. |
| Whether an implicit premise would be caught | Untested. Both same-day instances surfaced by accident of form. §3.1. |
| Render-time confirmation for pull request `#1118` | Unverified; requires a human view. §5. |
| Server-appended footer | Not preventable from here. Will recur. §4. |

---

## §7 What this document does not do

- Does not mint. No FD, no XK, no PE.
- Does not audit the register for bare `#NNN` occurrences.
- Does not edit pull request `#1118`'s body, or any filed document.
- Does not edit its companions to point here.
- Does not claim render-time verification. §5.
- Does not rule on whether the server-appended footer should be suppressed, which
  is not resolvable from this side.
- Does not confer authority on itself. Draft material, void on v25 landing.
- No live database contact. Prod untouched.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 scope: four publication-surface findings from opening pull request `#1118`. §2 `#NNN` register notation autolinks in GitHub comment fields and writes cross-references onto unrelated items; caught before firing; repo-wide scope unread. §3 a detector that could not distinguish the outcomes it existed to distinguish; re-verified with a test that can fail. §3.1 contrast with the same day's squash-only premise — stated and tested versus built and trusted; whether an implicit premise would be caught is untested. §4 post-submission mutation of a gated artifact by a party to neither gate; two mechanisms separated; ruled not to strip. §5 specification-plus-source named as insufficient for render-time verification; recorded unverified. §6 five carried items. §7 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-24. `origin/main` at `7c508189`. Branch head at filing `e5eaed1f`.*
*v25 draft material. Void on v25 landing. Mints nothing. Evaluates no fix. No live database contact.*
