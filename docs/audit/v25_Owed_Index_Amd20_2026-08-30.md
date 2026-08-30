| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 20** *Two method rules, filed now because their only alternative was being lost. Carries no finding and closes nothing.* |
| --- |

***Provenance:*** *route ruled by Evoni on 2026-08-30 — **chain amendment, method-only**. Filed **now** rather than folded into the amendment that will carry the two outstanding reads, for two reasons stated rather than assumed: those reads are Evoni-gated with no scheduled date, so "wait for that amendment" and "lose these" were plausibly the same option; and query results and method rules are different themes that would blur each other. **Push and merge are NOT ruled and are not assumed.** Rule 7 gates the push, the PR create and the merge separately, for doc-only changes explicitly (`F-Deploy-1_Fix_Plan_v1.5.md:165`; `Fix_Plan_v1.2.md:106`; `Session_PE_Roster.md:2208-2209, 2309-2310`).*

# v25 Owed Index — Amendment 20

**FILED 2026-08-30 on Evoni's authorization.** **Route ruled: chain amendment,
method-only.** **Merge to `main` UNRULED.**

**AMENDMENT 20 to `v25_Owed_Index_2026-08-22.md`.** Adds §V1–§V3.

**Basis:** `origin/main` at `0d1b407cfa5c623510b62fa63c9a334920938685`, 2026-08-30.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**This amendment carries two rules and nothing else.** It records no finding,
corrects no predecessor, and closes no item. Ships no code. Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     39
grep -r  'XK-4'  docs/audit/ | wc -l     17
grep -r  'PE #69' docs/audit/ | wc -l    17
Session_PE_Roster.md highest entry       PE #68
Owed Index chain tail (pre-Amd20)        v25_Owed_Index_Amd19_2026-08-30.md
```

**Movement since Amd19's basis (`86880c2`, which read 37 / 15 / 15) attributed
rather than asserted: `+2 / +2 / +2` = Amd19 itself, exactly as Amd19
predicted.** **Amd18's §T1 prediction has now held across four subsequent
merges**, on a document that falsified its own tally twice before it landed.
**It is the one figure in this chain that was fixed before the fact and stayed
true.**

**Note on the two instruments, carried because it is still live.** `FD-70` is
counted with `grep -o` (occurrences); `XK-4` and `PE #69` with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**This amendment's own contribution, measured after the text was final: +2 to
each of the three instruments** — from the block above and this note, its only
mentions. **A successor re-deriving once this lands should read 41 / 19 / 19.**
**The three tokens must appear in this file exactly twice each, in those two
places and nowhere else, prose or quoted;** refer to them collectively, as this
paragraph does, and **re-measure after writing rather than before.**

---

# §V1. The git-metadata gap — `docs/` and `git log` disagree about authorship

**`docs/` is correct. `git log` on `main` is not.** Every amendment and finding
in this chain carries an **Author** block naming *"Claude, with
JustAWomanInHerPrime (JAWIHP) / Evoni."* **The git metadata on `main` names
neither.**

**Measured, both sides, at this basis:**

```
branch-side commits (pre-merge)   author Claude <…>          Co-Authored-By: 1 each
squash commits on main            author angelcreator113 <…> Co-Authored-By: 0 each
```

**Two independent mechanisms, and the trailer one is the load-bearing
distinction.** GitHub's squash sets the commit author to the **PR-opening
account**, and the squash **discards the `Co-Authored-By` trailer that was
present on every branch commit**. This is not "attribution was never written."
It was written every time and dropped at the merge — **the route silently
discarding correct metadata**, which is a different fact with a different
remedy.

**It predates this session.** `7a788f3c` — Amd17, filed before any of this work
— carries the same shape, as does the bulk of recent history. **Nothing here was
introduced by this session, and nothing here is proposed to be changed.**
Rewriting merged history is not on the table.

**Why it is worth a rule rather than a footnote.** This register uses
`git show`, `git log` and blob SHAs as primary sources throughout. **A reader
careful enough to check authorship in the metadata will get a wrong answer, and
a reader careless enough not to check will get the right one from the document.**
**The gap penalises exactly the diligence the register otherwise rewards.**

**Rule.** *Authorship of any document in `docs/audit/` is what its **Author**
block says. `git log` on `main` is not evidence of authorship for this
repository and must not be cited as such.*

---

# §V2. The boundary rule — measure both sides before claiming a boundary

**This is the more valuable of the two, because it generalises to the failure
that produced Amd19.**

**Three instances, all in this session, all from correct measurements:**

| Claim made | Measured | Not measured | Truth |
| --- | --- | --- | --- |
| *"The `Co-Authored-By` trailer was never written"* | the squash side, which genuinely shows zero | the branch side | Written every time, dropped at merge |
| *"The auto-repair literal is unverifiable — the commit is unreachable"* | this clone's object store, which genuinely could not resolve it | whether the clone was shallow | An ancestor of `origin/main`; one `--unshallow` away |
| *"The five tables are Path B artefacts"* (Amd19 §U2) | §147's list of the five, which genuinely lists them | §11.2 of the same file, and `G1_Audit_Report` | Migration-canonical; falsified |

**In every case the check that was run was correct for what it measured.** The
error was **inferring a two-sided claim from a one-sided measurement**. That
distinguishes it from carelessness and points at a different remedy: **not "look
harder" — each of these was looked at carefully — but a rule that names the
missing step.**

**Rule.** *Before asserting that something is absent, unreachable, never
recorded, or complete, measure the other side. An absence observed at one end
of a boundary is evidence about that end only.*

**Scope, stated so it is checkable.** The rule bites wherever a claim is
**negative or exhaustive** — "was never written", "does not exist", "is
unreachable", "is the complete list". It does not bite on positive claims about
what was directly observed.

**Relation to the existing rule.** `v25_Sec6_Item8_Route_Finding_2026-08-29.md`
§R3.6 extends to *tallies and cross-references* — a claim must be re-checked
against the corrected body rather than assumed to have followed it. **§V2 is the
same discipline for boundaries, which §R3.6 does not reach.** Amd18 §T4 and
Amd19 §U3 are both instances §R3.6 caught; the three above are instances it does
not cover.

**Recorded with its own counterexample.** §V2 was itself derived from a
one-sided reading — the first framing of these three called them "reporting
where you looked as a property of the thing," which reads as carelessness and
would have produced the useless remedy. **The correction came from a second
reader, not from the author re-checking.** That is the same structural point
Amd18 §T6.2 makes and Amd19 §U3 demonstrates.

---

# §V3. What this amendment does not do

- **Records no finding and corrects no predecessor.** Amd18 and Amd19 stand
  exactly as filed. **Nothing in §V1 or §V2 amends either.**
- **Mints nothing.** No FD, XK, or PE number. **§V1 and §V2 were deliberately
  not filed to `Session_PE_Roster.md`:** that roster's scope is operational and
  infrastructure findings, its entry format requires a severity and a
  resolution path that neither rule has, and a new entry there would mint
  **the next roster number — which this chain currently tracks as one of its
  three live H1 instruments.** Filing there would have moved that instrument in
  the same act. **It is named in the block above and deliberately not repeated
  here**, for the reason §V2's sibling constraint gives.
- **Does not close `v25` Sec 6 item 8**, whose **disposition remains OPEN and
  Evoni-gated**, nor items 9, 11 or 13, nor the 8-A/8-B split, nor the
  `100.50.2.212` / `10.0.20.224` identity question.
- **Does not perform either outstanding read.** `SequelizeMeta`'s rows (§T2.2)
  and the five tables' row counts with newest rows (§T2.4 severity) remain
  Evoni-gated. **Neither is inferred, and this amendment is not a substitute for
  them.**
- **Does not reopen §H4**, CLOSED unperformed and, per §T6.3, permanently so for
  this authorship line.
- **Does not propose changing any git history, merge method, or attribution
  mechanism.** §V1 records a property and a reading rule, nothing operational.
- **Does not amend `v25` Sec 6's item count.** Fifteen entries stand.
- **Does not rule its own push or merge.**
- **Does not authorize a host session, an AWS call, a VPN, a bastion, an SSH
  tunnel, or SSM port forwarding.**

---

*Type: method amendment. Carries two reading rules and nothing else. Records no
finding, no closure, and no mint. Edits no file outside `docs/audit/`. No host,
AWS, database, or Cognito contact by any agent session. Prod FROZEN.*
