| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 6** *POSITION separates two states it reports as one. Ahead is not behind, and neither is `origin/main`.* |
| --- |

# v25 Owed Index — Amendment 6

**Document version**

**AMENDMENT 6 to `v25_Owed_Index_2026-08-22.md`.** Two items, refining **§1 as
amended by Amendment 1 (§A1) and Amendment 2 (§B1)**. Adds §F1–§F5.

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 5 receives a pointer banner that carries nothing.

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**. **Gate states carried as
face reads; not re-derived here.**

**Basis:** `origin/main` at `4862d4cb`, 2026-08-23. **The derivation and its
demonstration were made at `4187f78d`, before #1116 merged** — see §F3.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Derivation. Two items, two clauses, one demonstration.

---

# §F0. Why this amendment exists

**Derived in the course of running the wake-up trio, correct, and transcript-
only at the moment of derivation.** That is §B3's condition. Amendment 5 §E0
counts the seventh occurrence; **this would be the eighth if it sat.**

**Filed immediately, alone**, which is what §B3 requires and what Amendment 4
§D4 did with the same reasoning. **No occasion was available later** — "it goes
into v25" is a deferral with no occasion attached, the defect §B3 names and §C5
found recurring.

**What surfaced it is recorded, not credited.** The executing party read
POSITION's FAIL and questioned the check rather than the branch; the drafting
party supplied clause 2. Nothing routed either. **§D2.1's class**, and §D3
governs: recorded, no procedure proposed.

**Internal attribution is stated here and is a departure.** No prior amendment
attributes between parties. **§E1.1 established that unmarked provenance is the
failure a provenance instrument is structurally unable to see**, and this is the
first document written after that. **If the chain later rules internal
attribution to be noise, it can; omitting it silently now would be the drift.**

---

# §F1. The derivation

**§1's POSITION check is `git rev-parse HEAD` equals `git rev-parse
origin/main`. It reports one bit and collapses three states into it.**

> **Clause 1 — what FAIL means.** Nonzero `behind` is the stale-worktree hazard
> §1 was minted for. **Nonzero `ahead` with zero `behind` is not that hazard**;
> it is the ordinary state of any branch carrying unmerged work. POSITION
> reports both as FAIL and distinguishes neither. **The discriminator is
> `git rev-list --left-right --count origin/main...HEAD`.**
>
> **Clause 2 — what PASS does not buy.** `behind 0` guarantees you are not
> reading content **older** than `origin/main`. **It does not guarantee you are
> reading `origin/main`.** Ahead-commits shadow it: any path they touch returns
> the local version, with `behind 0` and a clean tree throughout. **A read that
> must reflect `origin/main` uses `git show origin/main:path`, regardless of
> branch position.**

**Clause 2 is the load-bearing half.** Clause 1 prevents a wrong action; clause
2 prevents a wrong read, and a wrong read is what §1 exists to prevent.

---

# §F2. The prescribed response to an undistinguished FAIL is destructive

**Distinct from §F1 clause 1, and about a different object.** Clause 1 concerns
what the instrument can resolve. **This concerns the procedure downstream of
it.**

**§1.1 separates two error kinds: a stale read that hides work (omission), and
a stale read that manufactures work that was not owed.** It rules the second
worse, because **it produces a task, and the task gets acted on before anyone
re-derives its premise.**

**A literal POSITION FAIL on a branch that is ahead is the second kind.** The
prescribed response to FAIL is to bring the worktree to `origin/main`. Executed
literally on a branch carrying unmerged work, **that discards the work** — a
destructive action, produced by a correct check reporting a true fact about a
state it cannot name.

**This is §A3's shape at the level of a check's output vocabulary**: an
instrument that cannot distinguish two states reports the one it knows, and the
procedure written against that vocabulary inherits the collapse.

**A second instrument exhibits the same collapse.** A repository stop hook
reported an unpushed commit on a branch restarted from `origin/main` after a
squash merge — correct, in that `4862d4cb` is absent from the stale remote
branch, and its prescribed response would have force-overwritten the remote to
carry nothing. **Two independent instruments, one shape: the check is right
about what it measures and the procedure downstream of it is written against a
vocabulary that cannot name the state.**

**Standing: verified — output seen by both parties.**

---

# §F3. The demonstration, at the basis where it was observed

**Observed at `4187f78d`, on a branch at `967a4222`, one commit ahead, tree
clean, `behind 0 / ahead 1` throughout.**

| read | path | result |
|---|---|---|
| worktree | `docs/audit/v25_Owed_Index_Amd4_2026-08-23.md` | **171 lines**, opens with the pointer banner |
| `git show origin/main:` | same path | **143 lines**, opens with the title table |
| worktree | `docs/audit/v25_Owed_Index_Amd5_2026-08-23.md` | present, 380 lines |
| `git show origin/main:` | same path | **absent — path does not exist at that ref** |

**Standing: verified — output seen by both parties** (§E1's vocabulary).

**No staleness is present anywhere in that table.** The divergence is entirely
the ahead-commit's, and POSITION has nothing to say about it in either
direction.

## §F3.1 It no longer reproduces, and the record must say so

**PR #1116 merged at `4862d4cb`, landing both files on `main`.** At the current
basis the two paths return identical content from worktree and `origin/main`,
and Amd5 is present at both. **Re-running the table today returns no
divergence.**

**Stamped rather than restated, because a reader who re-runs it and finds
nothing would conclude the derivation was wrong.** It was not; the condition it
demonstrated was transient and was ended by an unrelated action taken in the
same sitting. **§C1 requires a claim's method; for a claim about a transient
state, the method includes when.**

**The general form is what transfers.** A demonstration of a transient
condition is invalidated by any action that ends the condition — including one
taken for unrelated reasons in the same sitting, and including one the parties
sequenced first on purpose. **Here the invalidating action was the merge, chosen
as step 1 minutes earlier.** The Amd4/Amd5 specifics are the illustration; the
rule is that a transient demonstration must be stamped at its basis at the
moment it is made, because the occasion to notice it has lapsed will not
announce itself.

---

# §F4. What stands

- **§1 stands.** Its case — a worktree seven commits behind, manufacturing a
  finding — is a `behind`-nonzero case and is untouched by this.
- **§A1's pairing stands.** POSITION and COMPLETENESS remain two properties of
  one readiness question.
- **§B1's triple stands.** This refines POSITION's first property; it adds no
  fourth and supplies no command for RETRIEVABILITY.
- **This refines what POSITION's result means, not the check.** The check is
  cheap and correct about what it measures.

**Practical form, for v25's Sec 6:** assert POSITION; on FAIL, read the
left-right count before acting; and **use `git show origin/main:path` for any
read that must reflect `origin/main`, whatever POSITION returned.**

**The prior session's reads satisfied this before it was stated.** Every
verbatim read went through `git show origin/main:`, which is why they held
while POSITION would have FAILed under the literal check.

---

# §F5. What this amendment does not do

- **Does not amend §1, §A1, or §B1.** All stand; this refines POSITION's
  reading.
- **Does not supply a command for RETRIEVABILITY**, still a property.
- **Does not propose a procedure** for §F0's unrouted catch, per §D3 and §D5.
- **Does not re-derive any item in §E1**, and adds no standing to its five.
- **Does not rule on FD-67 Class A, FD-69's retirement, or any §E9 defect.**
- **Does not rule on PE #67**, whose condition this branch entered on #1116's
  squash merge. Recorded as encountered, not adjudicated.
- Does not perform or size limb 1, advance Dimension 3, discharge limb 3, enter
  G4, or alter the freeze.
- **Mints nothing.**

**On this amendment's filename.** `v25_Owed_Index_Amd6_*` inherits §C3's
defect, deliberately, for the reason §E10 gives: consistency with the chain
beats discoverability through a sort that does not reach it.

---

*Type: amendment, derivation only. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN. Not merged — v24 Sec 4.6.*
