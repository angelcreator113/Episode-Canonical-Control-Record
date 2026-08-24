# F-AUTH-1 — Branch A selected for the Cognito pool topology — 2026-08-24

| | |
|---|---|
| **Purpose** | Records the branch selection that `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md` was written to obtain. |
| **Selection** | **Branch A** — repurpose the existing pool as canonical prod; stand up a new pool for dev. |
| **Decided by** | Evoni, 2026-08-24. |
| **Basis** | `main` at `94035095` — the commit after the pointer banner merged, so the correction precedes this record rather than following it. |
| **Standing** | Records a decision made by the deciding party. **Mints nothing. Rules nothing.** Not draft material; carries no absorption condition. |
| **Authority note** | No FD, no XK, no PE minted. Closes no finding. Changes no gate, severity, owner or disposition. No AWS call issued. No deployed host contacted. Prod **FROZEN**. |

---

## §1 What was selected

The topology decision document enumerates three branches and explicitly declines to choose among them — *"It ends in a question for Evoni, not an answer."* Its resolution path reads: *"Bring this to Evoni for branch selection."*

**This document records that answer: Branch A.**

Branch A, as that document specifies it: *"The pool that exists today keeps its identities and becomes prod's system of record. A new, empty pool is created for dev; dev's env config repoints to it."*

---

## §2 What was disclosed before the selection stood, stated as it occurred

**This section records the disclosure exactly, and does not claim a formal confirmation that did not take place.**

The selection was stated. The correction now carried on the decision document's banner was then put to Evoni in the same exchange, once and plainly: that the document's references to *"the two non-Evoni identities"* are unsupported, that `PE #64` Amendment 1 establishes a **count only** and rules externality **NOT ESTABLISHED**, and that Branch A's headline consequence is therefore of **unestablished magnitude rather than established-and-small**.

She did not withdraw or amend the selection, and subsequently authorized the pointer banner carrying that same correction to `main`.

**No separate confirmation was given, and none is claimed here.** The record is: disclosure made, selection not withdrawn, correction landed by her authorization.

### §2.1 The specific thing that remains unestablished

`PE #64` Amendment 1, verbatim:

> **ESTABLISHED: at least two identities exist in the shared pool.**
>
> **NOT ESTABLISHED: whether any identity is external.** §9.10's trigger language is *"beta tester or external user"* / *"non-Evoni user."* **Three identities is consistent with one person holding three accounts**, which in a pool named for the dev environment is unremarkable.

The liveness check ran `describe-user-pool` and read `EstimatedNumberOfUsers` only. **No `list-users` was run. No user record was read.** The count is three; the composition is unknown.

**Branch A promotes all three to prod by inheritance rather than by evaluation.** Whether that is unremarkable or consequential depends on a fact nobody has established.

---

## §3 What this selection does NOT do

- **Authorizes no execution.** No pool is created, repurposed, renamed or repointed by this record.
- **Issues no AWS call. Contacts no deployed host. Prod remains FROZEN.**
- **Does not close `PE #65`.** The topology document is explicit: it closes *"when a branch is chosen and costed against real config/sequencing, not before."* **The costing has not been performed.** A branch is chosen; the costing is owed.
- **Does not reopen `PE #64`'s enumeration closure**, which Amendment 2 closed permanently and for stated reasons.
- **Does not resolve `PE #66`** or touch `docs/cognito-ids.txt`.
- **Does not re-rule Branch A's cost.** The pointer banner declines that as substantive, and so does this record.
- **Does not enter G4, discharge any limb, or alter the freeze.**

---

## §4 One consequence for the readiness assessment

`F-AUTH-1_Fix_Plan_v2.58.md` §2.5 requires Dimension 5 to establish, among six items:

> whether `PE #65`'s unresolved target topology changes what G4 is permitted to exercise or what its results mean.

**That input is now answerable as a decision rather than open-ended.** It **advances**; it does **not** close, because the pool state is unchanged — the pool remains shared and nothing has been executed.

The adjacent §2.5 item is untouched and remains as that revision states it:

> A G4 login, token, JWKS, or identity operation against that pool **is not made dev-only by the caller's environment label.**

---

## §5 What is owed next, recorded not scheduled

| Item | Status |
|---|---|
| Costing Branch A against real config and sequencing | **Owed.** `PE #65` does not close until this is done. |
| Externality of the three pool identities | **Unestablished.** Not required to execute Branch A; determines the magnitude of its irreversible consequence. |
| Execution authorization under the prod freeze | **Not given.** Branch A touches a pool shared with prod. |

---

## §6 Provenance of this record

The session's `git push` credential failed partway through the session. Reads continued to work; writes failed on every branch, including the session's designated branch as a control, so it was not a scoping restriction.

**This file was therefore created through the GitHub API rather than pushed from the session**, and is authored under Evoni's GitHub identity. The `Co-Authored-By` trailer on its commit records actual authorship.

---

*Recorded 2026-08-24. Basis `main` at `94035095`. Decision by Evoni. Mints nothing. Rules nothing. Authorizes no execution. No AWS call issued. No deployed host contacted. Prod FROZEN.*
