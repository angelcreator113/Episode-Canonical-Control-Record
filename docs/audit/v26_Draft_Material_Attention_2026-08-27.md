# v26 Draft Material — Attention: One Incident and One Observation About Where Verification Effort Does Not Go

| | |
|---|---|
| **Purpose** | One incident and one observation about which checks get run at all. Draft material for the v26 author. |
| **Created** | 2026-08-27 |
| **Basis** | Session of 2026-08-27, against `origin/main` at `1233791328b7df865c388c6c09661ef82745df36` — the commit at which `v26_Draft_Material_Perennials_2026-08-27.md`, cited below, is on `main`. **This document was held until that was true rather than hedged against it being false.** |
| **Absorption condition** | **Draft material, not a chain link.** Void on v26 landing. Supersedes nothing, superseded by nothing, holds no place in any chain. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Closes no finding, reopens none, changes no gate, disposition, owner, or severity. No host, AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN. |

---

## §1 What this carries, and how it differs from its sibling

**One incident and one observation. The subject is attention, not instruments.**

`v26_Draft_Material_Perennials_2026-08-27.md` records instruments that fail
without signalling. **This document records checks that were never run.** The two
are separate files because the subjects are different: one is about what an
instrument does when you point it at something, the other is about what nobody
points an instrument at.

**§2 is one occurrence and generalises to nothing. §3 has two instances, which
is askable, not answered.** No class is named. Whether either constitutes a
pattern is a judgment and is not made here.

> **THE OBSERVER IS THE SUBJECT. This is the document's principal weakness and
> it is stated first rather than in a bound at the end.**
>
> Every finding in the sibling document is a command. A reader can run
> `git show --name-only --format= 76a7f1ac -- <path>` and watch it return empty.
> **Nothing here is a command.** These are reports about one author's attention,
> written by that author, about a session that author conducted. **There is no
> read that reproduces "did not think to check."**
>
> **This document is not authority and cannot become authority.** It is not
> ground for any ruling, count, disposition, or gate, and **nothing in the
> register may cite it as establishing anything.** It sits in `docs/audit/`
> beside documents that are commands, and **proximity is how prose acquires
> standing it was never given** — so the disclaimer is stated as a prohibition
> rather than as advice about weighting.

---

## §2 Incident 1 — a recommended instrument went unchecked

**What happened.** A draft recorded a hazard in one instrument (call it B) and
identified a second instrument (A) as the read that answers the question asked.
Every verification pass in the session to that point had been aimed at
**claims** — a cited SHA, a quoted passage, a line number, a count. **The draft's
recommendation of A was not checked by either party until it was proposed
directly as a thing to check.** No count of review rounds is given, because none
was recorded at the time and reconstructing one after the fact would be the
document inventing its own evidence.

A was then stress-tested directly, and **failed** — returning empty for a path a
merge commit had changed, the opposite failure direction from B's, and silent in
the same way. The finding is at
`v26_Draft_Material_Perennials_2026-08-27.md` §3.1 and is reproducible.

**The finding is not the point here.** What is recorded is that **nobody looked
there until it was deliberately proposed as a thing to look at**, in a session
whose entire discipline was adversarial verification.

**A candidate mechanism, offered as hypothesis.** A remedy arrives in the
grammatical position of an answer rather than a question. Verification reflexes
fire on assertions; a recommendation is an assertion, but it is *read* as a
resolution, and a resolution reads as the end of the checking rather than a new
thing to check.

**Why this is an incident and not an observation.** A was recommended in exactly
one document, so there was exactly one opportunity to check it.
*"Remedies are systematically under-checked"* and *"this remedy was checked late,
once"* **are not distinguishable at `n = 1`** — which means the second is not a
competing hypothesis, it is **the null**, and it is not rejected.

**So no generalisation is offered and none is available.** An earlier draft
titled this *"the remedy is the part nobody re-derives."* **That title asserted
what the bound withdraws**, and is removed. **One occurrence, no basis to
generalise.**

---

## §3 Observation 1 — an empty result is accepted when it agrees with the conclusion in progress

**An empty search result carries no information about why it is empty.** The
reader supplies that, and in both instances below **the reader supplied the
reading that agreed with the conclusion already in progress.**

> **An earlier draft framed this by role** — authors read an empty as *not yet
> found* and try another pattern; reviewers read it as *confirmed absent* and
> close the question. **Instance (a) falsifies that framing**: an author got an
> empty and accepted it without trying a second pattern, which is the reviewer
> default performed in the author role. **On the role framing the supporting
> sample is one, not two.** The framing below explains both instances; the role
> framing explains one and is contradicted by the other. **It is also the less
> flattering reading, which is some evidence for it.**

**Two instances this session. In each, the empty pointed the way the reader was
already going.**

**(a)** A scan for a formulation in the corpus returned zero files.
The zero was about to ground a recommendation. It was defective — the pattern's
character class made the match structurally impossible — and the response to
zero had been to accept it, not to try a second pattern. Mechanism and
demonstration are at `v26_Draft_Material_Perennials_2026-08-27.md` §5; the
underlying instrument hazard is filed at
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.3.

**(b)** While reviewing a document that cited two sections of the
owed-index chain, a scan for those sections returned nothing. **Reporting that
as absence would have removed a correct clause from a correct document.** The
sections exist; the scan was scoped to the wrong files. The citation was right
and the review was wrong.

**The common form.** In (a) the empty **grounded the recommendation being
written**; in (b) it **confirmed a citation that already looked broken.** Neither
empty was interrogated, and in both the unexamined reading was the one pointing
where the reader was already headed. **An empty result is cheapest to accept
exactly when it agrees with you** — and it agrees silently, because an empty
carries no argument to disagree with.

**Bound.** Both instances are **one person, one session**. This is not evidence
about anyone else, and it is two occurrences in a sample that exists only because
they happened to be caught. **Two is askable, not answered.**

---

## §4 Standing

**One incident and one observation. Askable, not answered. No class named.**

**No corpus search was performed, and none is available.** The sibling's zero was
*reached* — a near-miss found, inspected, and confirmed a correct use. **This
document has no such method and therefore reports no count.** The corpus records
the checks that were run; **an absence of verification leaves no artifact to
search for.** That is simultaneously why this material is thin and why it is
worth writing down — nothing else in the register will surface it.

**No number is asserted, deliberately.** Reporting a zero would invite reading it
as a derived count, and the paragraph would then have to argue its way out of an
implication it created. **A zero you had no method to find is weaker than
claiming nothing.**

**Weaker than the sibling on every axis that matters.** The sibling's claims are
commands with outputs. These are recollections with reasoning attached. They are
recorded because the alternative is that they exist only in a session
transcript, which is the disposal route this register documents at length — not
because they are established.

---

## §5 Reach — every one of these was caught by something other than the check for it

**§2** was caught because a reviewer asked whether the recommended instrument was
sound in both directions. **That question was on no checklist**, and it did not
arise at any point in the document's authoring or review until it was asked
directly.

**§3(a)** was caught because the reviewer independently located the near-miss the
scan should have found. **The grep was not re-examined; it was bypassed.** Had
the reviewer not gone looking, the defective zero would have shipped as the
document's ground.

**§3(b)** was caught because the citation pointed at chain documents whose house
form was already known, making absence implausible. **That is a domain prior, not
a method.** A reviewer without that context would have had no reason to doubt the
empty.

**A fourth, from this document's own audit.** A consistency check on this file —
whether §2's and §5's counts of the same review rounds agreed — returned nothing,
because the phrase it searched for is split across a line break and the pattern
could not span it. **They did not agree.** The disagreement was found only by
searching for the bare word `round` instead. **Same family as §3(a) and as
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.3: a pattern that cannot match,
returning an empty that reads as agreement.**

**A fifth, recorded as reach rather than as an entry.** A shell check in
this session errored (exit 2, an unsupported regex construct) and printed a
**pass** on the `||` branch of an `A && B || C`. It was caught because the
adjacent output was visibly mojibake — **not because the exit code was tested.**
Testing `$?` catches it; reading the numbers does not. **The instrument failure
belongs to the sibling document's family. The way it was caught belongs here,
and it is the same way: incidentally.**

**The common form: in each case the thing that surfaced the gap was not the
procedure written to surface it.** That is also why the sample size is whatever
happened to surface, and why no rate, frequency, or coverage claim is available
from it.

---

## §6 What this does not do

- **Does not name a class.** One incident, one observation, and **two further
  incidents carried only as reach** — the consistency check at §5 and the shell
  check at §5.
- **Does not propose a checklist item, a procedure, or a rule.** Proposing a
  remedy here would be this document committing §2.
- **Does not claim these generalise** beyond one session and one observer. §1's
  banner, §2's null, and §3's bound state the limitation; none is a formality.
- **Does not assert a role-dependent effect.** §3's earlier role framing is
  recorded as falsified by its own instance (a) and is not carried.
- **Does not exclude the conservative reading of §2.** It adopts it: at `n = 1`
  the conservative reading is the null and is not rejected.
- **Does not amend `v26_Draft_Material_Perennials_2026-08-27.md`**, which stands.
- **Does not re-derive** the instrument findings at that document or at
  `Prime_Studios_Audit_Handoff_v25.md` Sec 4.3. Both are pointed at.
- **Mints nothing**, and holds no place in any chain.

---

*Type: draft material, observation only. Void on v26 landing. No host, AWS,
database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
