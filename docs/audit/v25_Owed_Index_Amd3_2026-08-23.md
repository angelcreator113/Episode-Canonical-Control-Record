| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 3** *Negative existence claims require their method. Three observations. The only check that has worked is a second party.* |
| --- |

# v25 Owed Index — Amendment 3

**Document version**

**AMENDMENT 3 to `v25_Owed_Index_2026-08-22.md`.** Adds one derivation (§C1)
and three observations (§C2–§C4). **Extends §B3 with a finding about §B3's own
enforcement.**

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 2 receives a pointer banner that carries nothing.

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

**Basis:** `origin/main` at `b4961674`, 2026-08-23.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Amendment. One derivation, three observations, one finding about enforcement.

---

# §C1. Negative existence claims require their method

> **A negative existence claim about the register — "no revision states X", "no
> document records Y", "X is absent from the tree" — must be stated together
> with the read that produced it, and that read must be wrap-tolerant and
> against full history.**

**The reason it is a derivation and not an exhortation: a negative existence
claim is unfalsifiable without its method.**

*"No revision restates X"* tells a reader **nothing about whether the search
could have found it.** *"No revision restates X, per a wrap-tolerant read across
full history at basis N"* is **checkable** — a reader can re-run it, or identify
the blind spot that defeated it.

**Without the method, a reader cannot distinguish a searched absence from an
unsearchable one**, and those are the two states §A3 says every failing
instrument collapses into one.

## §C1.1 The same false claim, twice, through different blind spots

**"No revision restates the FD tail" was nearly filed on two consecutive
mornings, from two unrelated instrument failures.**

| morning | instrument | why it failed | what it returned |
|---|---|---|---|
| 2026-08-22 | `git merge-base --is-ancestor`, `ls` on the worktree | **shallow clone**; worktree seven commits behind | v2.67 unreadable → *"no revision restates the FD tail"* |
| 2026-08-23 | line-oriented `grep -oP` | the statement **wraps across lines 13–14** of v2.68 | zero matches → *"no revision restates the FD tail"* |

**Both false.** v2.67 restates it. v2.68 restates it. A wrap-tolerant read
returns it immediately.

**The recurrence says something stronger than either instance.** It is not that
two instruments happened to be blind. It is that **the claim "no revision states
X" is structurally easy to manufacture, because every retrieval failure produces
exactly it.** A stale tree, a shallow clone, a deleted document, a wrapped line
and an overloaded term all terminate in the same sentence.

**Negative existence claims are therefore the highest-risk output class in this
register**, and the only defense that does not depend on the instrument being
sound is publishing the method beside the claim.

---

# §C2. A completeness pass in a reused container is not evidence about how
sessions begin

§B1's COMPLETENESS check passed at the start of 2026-08-23. **It passed because
the previous session's `git fetch --unshallow` persisted in the same container
— not because the clone arrived complete.**

**A fresh container would very likely fail it**, as 2026-08-22's did.

**Consequence:** a session that *opens* with a COMPLETENESS PASS should
establish **why** it passed before treating it as routine. **The pass is a
property of container continuity, not of how the repository is provisioned**,
and reading it as the latter is an inference the check does not support.

**This is why §B1 says assert rather than inherit.** It also means the assertion
is owed at the start of every session, including — especially — the ones where
it passes.

---

# §C3. Sec 6 item 2 does not cover the owed index

v24 Sec 6 item 2 derives document authority by **numeric sort over named
families** — `F-AUTH-1_Fix_Plan_vN.M` and its siblings.

**`v25_Owed_Index_*` sits outside every sorted family.** An author deriving
authority through item 2 **never encounters this document or its amendments.**

They sort adjacently by filename, so the chain is discoverable — **but only by
someone already looking for it.**

**A gap in item 2's coverage, not a carriage violation.** Owed to v25's Sec 6 as
a line: the sort must enumerate families, and a document outside all of them is
invisible to it.

---

# §C4. Citations by PR number are service-dependent

`F-AUTH-1_Fix_Plan_v2.68.md` §4.1 cites **`#1106 §5`** for the
clean-versus-empty standing rule.

**That rule now lives in the tree as `Attribution_Gap_2026-08-22_DRAFT.md`**
(merged at `b4961674`). **v2.68's citation points at a PR number, which a reader
holding only the repository cannot follow.**

**This is the retrievability property (§B1) applied to citation.** The
register's own standard is that a claim should be checkable from the tree; a
PR-number reference resolves only through GitHub.

**Not urgent and not corrected here** — v2.68 is merged, and amending it to
change a citation would be a substantive edit for a non-substantive reason,
which §2 of the index warns against. **Recorded so that future citations prefer
the document path**, with the PR number as supplement rather than as the
reference.

---

# §C5. The finding about §B3's enforcement

**§B3 was ruled on 2026-08-22 and did not prevent its own failure mode on
2026-08-23.** Three derivations were given in the course of other work and
deferred with the words *"when it's next touched"* — **a deferral with no
occasion attached**, which is precisely what §B3 describes.

**Fifth occurrence across two sessions.**

**What caught it was not the rule.** It was **a second party noticing the
deferral and naming it at the moment it was made.**

> **The only mechanism that has actually arrested this failure is a second
> party. There is no check at the moment of ruling-in-passing, and a
> better-worded rule does not supply one.**

**This is §B3's own claim turned on §B3:** naming a failure does not arrest it;
only a check placed where the failure occurs does. **§B3 named it and did not
place a check.** The remedy is therefore **not a sharper rule** — it is an
occasion, and the only occasion demonstrated to work so far is another party
asking.

**Recorded as a finding about the failure mode, not as a procedure.** No
procedure is proposed here, because none has been demonstrated.

---

# §C6. What this amendment does not do

- **Does not amend §1, §2, §3, §A1–§A3, or §B1–§B3.** All stand.
- **Does not correct v2.68's `#1106 §5` citation** (§C4), and states why.
- **Does not propose a procedure for §C5**, because none has been demonstrated.
- **Does not add a command for retrievability**, still a property (§B1).
- Does not perform or size limb 1, rule on first-half auditability, advance
  Dimension 3, discharge limb 3, enter G4, or alter the freeze.
- **Mints nothing.**

---

*Type: amendment, derivation and observations only. No host, AWS, database, or
Cognito contact. Prod FROZEN. Not merged — v24 Sec 4.6.*
