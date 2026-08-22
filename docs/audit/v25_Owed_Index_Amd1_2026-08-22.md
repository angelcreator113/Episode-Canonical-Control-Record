> **CORRECTION BANNER — §A3.1 HAS A FIFTH INSTANCE, RECORDED ELSEWHERE (added
> 2026-08-22, additive; nothing below is removed or edited).**
>
> **Banners on this document are read newest-first.**
>
> **§A3.1's table lists four instances. A fifth was found** while applying §A1's
> preconditions during the limb 1 measurement: **`Tier` is overloaded across
> three unrelated taxonomies** in the F-AUTH-1 fix plans — finding priority
> (`Tier 0`), Track 6 frontend file batching by site count, and the auth
> disposition taxonomy. An instrument enumerating `Tier N` collects all three
> and returns a large, confident, wrong number.
>
> **It is recorded at `F-AUTH-1_Limb1_Measurement_2026-08-22.md` §7**, which
> governs it. **This banner points and carries nothing.**
>
> **It is the first instance found while applying §A3's rule rather than before
> it**, which is the part worth noting: the shape recurs, and it recurs inside
> work already disciplined against it.
>
> §A1, §A2 and §A3's general form are unaffected. Mints nothing. Prod FROZEN.

| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 1** *§1 is a paired precondition. Position and completeness are two properties of one readiness question.* |
| --- |

# v25 Owed Index — Amendment 1

**Document version**

**AMENDMENT 1 to `v25_Owed_Index_2026-08-22.md`.** Extends **§1** and governs it.
**§1 as filed checks position and does not check completeness**, and the case
below defeats it.

**Minted rather than carried in place**, per the rule at `F-Deploy-1_Fix_Plan_v1.49.md`:
a substantive amendment to a merged document mints; a banner may point but may
not carry. **A pointer banner is added to the index and carries nothing.**

**Rules nothing new. Mints nothing.** Ships no code. Changes no gate, finding,
severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not enterable;
ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

**Basis:** `origin/main` at `16c3a36e`, 2026-08-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Amendment. Extends one section of a document filed at `d2a0bd9f`.

---

# §A1. The amended precondition

**§1 as filed reads:** after `git fetch`, assert `git rev-parse HEAD` equals
`git rev-parse origin/main` before any local read.

**That check passes on a shallow clone.** It is a test of *position* — is the
worktree where it should be — and says nothing about whether the local object
graph is deep enough to answer the question being asked.

**§1 is therefore a paired precondition, not one check:**

> **Before any local read, assert POSITION:**
> `git rev-parse HEAD` equals `git rev-parse origin/main`.
>
> **Before any ancestry, range, or history read, additionally assert
> COMPLETENESS:**
> `git rev-parse --is-shallow-repository` is `false`.

**Stated as one item because they are two properties of one readiness
question**, and splitting them invites running the first and treating the tree
as cleared.

---

# §A2. The case

A CP1–CP12 ancestry derivation was run **immediately after §1's position check
passed.** The container held a **shallow clone**, boundary at 2026-08-18.

**`git merge-base --is-ancestor` returned `false` for all thirteen CP commits.**
Not an error. Not a warning. **A clean negative**, because the connecting
history was not present locally to traverse.

**The finding this would have produced:**

> *The entire CP1–CP12 sweep is absent from `main`'s history. The keystone
> closure commit is not on `main`. The merge that landed the program is not on
> `main`.*

**Every sentence false.** After `git fetch --unshallow`, **all thirteen are
ancestors of `main`**, including `f8744ecd` and `1265d8c3`.

**It would have impugned the provenance of the entire F-AUTH-1 program**, and
it is the more dangerous kind of false finding for a specific reason:

> **All four checks were reproducible.** Anyone re-running them in the same
> container gets the same answer. **This is a manufactured finding with
> built-in corroboration** — verification by repetition confirms it, because
> the defect is in the instrument and travels with it.

---

# §A3. The general form

**This is broader than git, and it is the part to carry.**

> **An instrument that cannot see far enough returns absence, not error.**

**A blind spot renders as a definite negative.** The instrument does not report
that it could not reach the answer; it reports that the answer is *no*. Nothing
downstream distinguishes the two, and a negative result invites no further
inquiry.

## §A3.1 Four instances, one shape

| # | instrument | what it could not reach | what it returned |
|---|---|---|---|
| 1 | `asyncHandler` opacity | routes it never reached | *"does not reference `req.user`"* |
| 2 | identity-matching walk | a factory closure it could not resolve | `anon` |
| 3 | route cross-checker | `router.use()` presets | **39** |
| 4 | `git merge-base --is-ancestor` | commits beyond a shallow boundary | `false` |

**In every case the instrument's blind spot rendered as a definite negative,
and in none did it signal insufficiency.**

**Provenance, stated.** Instances 1–3 are **carried as ruled** and were **not
re-derived at this basis.** Instance 4 is derived here and its checks are
reproducible against `16c3a36e`. **Recorded so that a later author knows which
rest on this document's own work and which do not** — the distinction §A2 is
about.

## §A3.2 Relation to the session's other through-line

The register has been carrying *"a floor confirmed only by the instrument that
produced it."* **This is the wider statement, and the floor problem is one of
its consequences:** a floor is what you get when an instrument's blind spots all
resolve downward. **Where the two are in tension as an organizing frame, this
one governs.**

**Not a supersession.** The floor formulation is correct about what it
describes. This states the mechanism underneath it.

---

# §A4. What this amendment does not do

- **Does not amend §2 or §3** of the index, or any revision either names.
- **Does not re-derive instances 1–3** (§A3.1), and does not adopt them as
  established by this document.
- **Does not generalize beyond the four instances**, and sets no procedure for
  detecting blind spots in instruments generally.
- Does not perform limb 1, size it, or derive the CP1–CP12 population.
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the freeze.
- **Mints nothing.** Closes and reopens nothing.

---

*Type: amendment, carriage and derivation only. Rules nothing new, mints
nothing. No host, AWS, database, or Cognito contact. Prod FROZEN. Not merged —
v24 Sec 4.6.*
