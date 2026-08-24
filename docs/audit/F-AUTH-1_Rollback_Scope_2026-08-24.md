# F-AUTH-1 — Rollback scope under P6 — 2026-08-24

| | |
|---|---|
| **Purpose** | Takes the `Rollback procedure` item from `F-AUTH-1_BranchA_Costing_2026-08-24.md` section 7. Establishes what P6 of the prerequisite sequence requires rollback to cover. |
| **Basis** | `main` at `3b04d821606e175ee61a75da876cdfc95df5eec2`, confirmed by `git ls-remote --heads origin main`. Clone asserted non-shallow before any read. |
| **Standing** | **Does not close the rollback item.** It reopens it on corrected ground and states the one decision P6 cannot make for itself. |
| **Discipline** | By-role throughout. **No pool ID, client ID, or environment value appears in this document.** `#NNN` references wrapped in inline code. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Changes no gate, severity, owner or disposition. No AWS call issued. No deployed host contacted. No workflow dispatched. No Cognito operation. No revert, reset, or history rewrite performed. Prod **FROZEN**. |

---

## §1 Read basis

`.github/workflows/deploy-dev.yml` is blob `84586e041d4880e6224bd51fc1e7924ba0c31116` at **all three** of `f6a6933f` (the costing's basis), `c30b5d9c` (the addendum's basis), and `3b04d821` (this document's basis). Every line citation carried by either predecessor transfers to this basis unchanged. Verified by `git rev-parse <ref>:<path>`, not by inspection.

The workflow was **read, not run**. Nothing dispatches.

---

## §2 What P6 gates

From `F-AUTH-1_BranchA_Prerequisite_Addendum_2026-08-24.md` section 4:

| Step | Text |
|---|---|
| P6 | *Complete and approve the rollback and verification procedures* — **Both must exist before the first repointing dispatch.** |
| P8 | *Dispatch the dev workflow once* — **this is the repoint.** |
| P9 | *Execute the approved verification procedure* — **Failure invokes the approved rollback; no partial-credit success.** |

Section 4 closes: *"The app-client set, rollback, execution authorization, and verification remain separate section 7 items. This sequence orders them; it does not resolve them."*

So the sequence establishes rollback's **position** and its **trigger**, and disclaims resolving its **content**. This document supplies the content constraint; it does not supply the choice.

---

## §3 The item's filed ground is discharged — the item is not

### §3.1 The ground as filed

Costing section 7 states the item in full:

> | Rollback procedure | **Owed.** Branch A says the new dev pool is *"trivially disposable"*; nothing covers a partial repoint. |

The named gap is **partial repoint**.

### §3.2 What discharged it

Addendum section 3 item 5 eliminates the value-level partial repoint by construction:

> In `.github/workflows/deploy-dev.yml`, evaluate the loader after DB config is resolved and before the PM2 recovery trap is armed. The existing `startOrRestart ... --update-env` call then receives **the complete pair or is never reached**.

A loader failure therefore aborts before any restart. The half-applied pair that section 7 was written against is not reachable under the specified design.

**Bound:** this holds **for the design as specified**. Section 3 item 5 is unimplemented — P2 is *"prepared but not merged."* The discharge is of the specified design's hazard, not of shipped behaviour.

### §3.3 The item survives, on different ground

**The obligation is not discharged. Only its stated reason is.**

P9's trigger is **verification failure after a clean repoint**: the loader supplied both values, the restart completed, the system is up, internally consistent, and wrong. That is a different object from a half-applied repoint, and a procedure written for one does not cover the other. *"No partial-credit success"* makes the trigger binary — any verification shortfall invokes it.

A reader who stops at section 3.2 closes this item. **It does not close.** It is owed for a reason it was not originally opened for.

### §3.4 Register defect — an obligation whose stated reason dies while the obligation lives

The rollback item stayed open on wording that had stopped describing its own object. The discharge was performed by an addendum resolving a **different** section 7 item, which therefore had no occasion to say so. Nothing was wrong; nothing reported.

Named as a class: **`obligation-outlives-its-reason`** — *an obligation whose stated ground is discharged elsewhere while the obligation itself survives on ground the record does not state.*

Distinct from the two classes already on the register:

- **stale-basis** produces a wrong value from a real measurement — remedy is re-derivation at the current basis;
- **check-cannot-fail** produces a right-looking value from a measurement that never occurred — remedy is a positive control;
- **this** leaves a correctly-open obligation carrying a reason that is no longer true — remedy is re-stating the ground whenever a document discharges a hazard it was not scoped to.

The failure mode is bidirectional and that is what makes it dangerous: read one way it closes an obligation that should stand; read the other it defends an obligation with an argument that no longer holds. Both readings are available from the filed text.

**Filing note.** `Finding_Check_Cannot_Fail_Class_2026-08-24.md` establishes that failure classes are filed as standalone cross-cutting `Finding_*` documents belonging to no keystone. This class is named here because it was found here, and is **awaiting standalone filing on that precedent**. It is not filed as a class by this document.

---

## §4 Pre-repoint state is destroyed, not merely uncaptured

The workflow contains exactly one restore-shaped mechanism. It is not a restore.

```
restore_pm2() {
  cd "$APP_DIR" 2>/dev/null || return
  pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker --update-env
  pm2 save
}
```

Three established reads, `deploy-dev.yml` at `3b04d821`:

1. **`restore_pm2` re-applies the current shell environment.** The comment at the arming site (`:332-334`) states: *"From this point, any exit path restarts the two dev processes with a complete environment."* Under addendum section 3 item 5 the Cognito pair is in that environment **before** the trap arms. On Branch A the trap is therefore a **forward re-apply of the repoint**, not a reversal of it.
2. **`pm2 resurrect` is banned** (`:260`) — *"pm2 resurrect remains banned (stale-env rotation trap, `SESSION_HANDOFF.md`)."* The one primitive that could reinstate a previously saved environment is excluded by standing design, not by omission.
3. **`pm2 save` overwrites the dump** (`:270`), inside `restore_pm2` itself. At the first successful restart under P8, the saved PM2 state carries the new values.

Taken together: **the pre-repoint state is not merely uncaptured — it is overwritten at P8.** There is no moment after the repoint at which a prior state exists to be returned to.

---

## §5 Consequence — rollback can only be a second repoint

Since no restore target survives P8, rollback under Branch A cannot be a restore. Its only available form is **a second repoint**: rewrite the dedicated dev configuration object at `episode-metadata/dev/cognito` and dispatch again.

The addendum corroborates that this is the anticipated domain. Section 3 closes:

> The dedicated Cognito object is separate from `episode-metadata/dev/database`. Reusing the database object would couple auth **rollback** and IAM scope to database credential rotation, creating a dependency the current five-key `print-db-env.js` contract deliberately does not have.

The separation exists **so that auth rollback is its own domain**. The mechanism the design anticipates is rewriting that object.

**Bounds, and they travel:**

- Holds **for the design as specified**; section 3 item 5 is unimplemented.
- *"Only a second repoint"* exhausts **the deployment path**, not the universe. A mechanism outside that path — direct host contact — is **barred under the freeze, not proven impossible.** The bound is on what is permitted here, not on what exists.

---

## §6 The sequence produces no rollback target

A second repoint requires values to repoint **to**. The sequence contains no step that yields any:

| Source | Disposition |
|---|---|
| Pre-repoint process values | **Ambient.** Addendum section 2: *"a dispatch can preserve, replace, or empty it according to pre-existing process or host state rather than a named deployment input."* Host-side; host contact barred under the freeze. |
| P5 preflight | Reads **the new object**, explicitly *"Infrastructure preflight only; no PM2 restart and no repoint."* Never observes the running process environment. |
| Any other P-row | **None captures pre-state.** P6 produces procedures, not observations. |
| The shared-pool identifiers | **Closed by standing instruction.** Not read, not paraphrased, not obtained by any route. |

**Therefore P6 cannot be completed as *"restore the prior values."*** No permitted source yields them, and no step in the sequence was ever scoped to capture them.

Two open items are recorded here and **not reasoned out**: whether the ambient pair is currently populated at all (section 2 admits *preserve*, *replace*, and *empty* equally), and whether any permitted source carries the prior identifiers. Neither is resolved by inference.

---

## §7 Residual — process-level partial

Section 3 item 5 eliminates the **value-level** partial. It does not address the **process-level** one.

`--only episode-api,episode-worker` (`:269`, `:352`) applies one identical environment to two processes in a single command. Either can fail to boot. `:342` shows a migration failure proceeding to restart regardless: *"Migration failed — trap will still restart PM2 so the site stays up."*

The resulting state is **configuration-consistent and availability-partial**. Adjacent to costing section 8.3, which recorded the shared process name and deliberately did not re-scope it. **Recorded here, not resolved here.**

---

## §8 What P6 must decide

The constraint is established. The choice is not this document's.

**Established:** rollback is a second repoint; it acts on `episode-metadata/dev/cognito`; it is triggered by P9 verification failure against a running, internally consistent system; and it cannot name the prior values as its target.

**Owed to P6:** a rollback target that is *sourceable* under the freeze. The candidates are visible and are not ranked here — repoint to a sourced prior-pool configuration, revert the held code PR and re-dispatch, or forward-fix without reversal. Each carries a different cost and one of them requires a merge to `main`, which is not a step a pre-approved procedure can take autonomously.

**This is Evoni's decision. It is not resolved by this document, and it is not deferred silently: it is stated as the open term.**

---

## §9 What this document does not do

- Does not close the section 7 rollback item.
- Does not choose the rollback target.
- Does not file `obligation-outlives-its-reason` as a class.
- Does not edit `F-AUTH-1_BranchA_Costing_2026-08-24.md` or the addendum. Neither body is touched.
- Does not implement, dispatch, revert, or contact anything.

---

## Version block

| Field | Value |
|---|---|
| Document | `docs/audit/F-AUTH-1_Rollback_Scope_2026-08-24.md` |
| Date | 2026-08-24 |
| Basis | `main` at `3b04d821606e175ee61a75da876cdfc95df5eec2` |
| Reads | `F-AUTH-1_BranchA_Costing_2026-08-24.md` sections 7, 8; `F-AUTH-1_BranchA_Prerequisite_Addendum_2026-08-24.md` sections 2, 3, 4; `.github/workflows/deploy-dev.yml` at blob `84586e04`, lines 10-30, 255-272, 327-358 |
| Blob-identity check | `deploy-dev.yml` identical at `f6a6933f`, `c30b5d9c`, `3b04d821` |
| Mints | Nothing |
| Names | One failure class, `obligation-outlives-its-reason`, awaiting standalone filing |
| Closes | Nothing |
| Operations performed | None |
