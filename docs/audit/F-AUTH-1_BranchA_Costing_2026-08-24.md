> **CORRECTION BANNER - CENTRAL TOPOLOGY PREMISE WAS INVALID AT THIS
> DOCUMENT'S OWN BASIS (added 2026-08-24, additive).**
>
> Sections 1 and 3, section 4's second term, section 5's prod-touching
> conclusion, section 6's claim that environment separation did not exist,
> and section 2 row 7's single-shared-worker inference are superseded by
> `F-AUTH-1_BranchA_Prerequisite_Addendum_2026-08-24.md`. At the stated basis
> `f6a6933f`, the SSM dev path already targeted the dedicated
> `episode-dev-backend` instance and the dev/prod PM2 manifests were already
> split. The addendum carries the evidence and corrected prerequisite; this
> banner points to it and does not reproduce the correction. Section 7 remains
> historical; use the merged addenda for current item dispositions.

# F-AUTH-1 — Branch A costed against real config and sequencing — 2026-08-24

| | |
|---|---|
| **Purpose** | Costs the selected branch against the actual deployment configuration. `PE #65` closes *"when a branch is chosen and costed against real config/sequencing"* — a branch is chosen; **this is the costing, and it is not complete.** |
| **Basis** | `main` at `f6a6933f`. All reads local git against that commit. |
| **Subject** | Branch A of `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`, selected 2026-08-24 and recorded at `F-AUTH-1_BranchA_Selection_2026-08-24.md`. |
| **Standing** | **Does not re-decide the branch.** Branch A stands as selected. What changed is its price, not its structure. **Does not close `PE #65`** — §7 states what remains owed. |
| **Discipline** | By-role throughout. **No pool ID, client ID, or env file value appears in this document.** Same no-new-disclosure-surface rule the topology document states for itself. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Changes no gate, severity, owner or disposition. No AWS call issued. No deployed host contacted. No workflow dispatched. Prod **FROZEN**. |

---

## §1 The central finding

**There is one Cognito configuration surface, not two.**

Branch A's mechanism is *"A new, empty pool is created for dev; dev's env config repoints to it."* **That operation has no target which is not also prod's.**

---

## §2 ESTABLISHED — five independent surfaces, with anchors

Every row below is a direct read at `f6a6933f`. None is inference.

| # | Established fact | Anchor |
|---|---|---|
| 1 | Both PM2 manifests resolve **identical variable names** for pool and client | `ecosystem.config.js:33-34` · `ecosystem.dev.config.js:31-32` |
| 2 | Both manifests run the **same script from the same working directory** | `ecosystem.config.js:72-73` · `ecosystem.dev.config.js:52-53` |
| 3 | The dev deploy **writes no `.env`** and carries **zero application secrets** — its own header | `.github/workflows/deploy-dev.yml:18-19` |
| 4 | The dev deploy **sets no Cognito variable at all** — zero matches across 462 lines | `.github/workflows/deploy-dev.yml`, exhaustive match |
| 5 | The prod deploy reads **both** Cognito values from a **single `ENV_FILE`** | `.github/scripts/deploy-production.sh:11-16` |
| 6 | Absence of that file yields **empty defaults**, not failure | `.github/scripts/deploy-production.sh:29` |
| 7 | The worker process is **shared between prod and dev** — the script says so | `.github/scripts/deploy-production.sh:226` |

### §2.1 The pair relationship, in all six config surfaces

Pool ID and client ID appear **together, never separately**:

| Surface | Anchor |
|---|---|
| `.env.example` | `:38-39` |
| `.env.production.template` | `:52-53` |
| `ecosystem.config.js` (prod) | `:33-34` |
| `ecosystem.dev.config.js` (dev) | `:31-32` |
| `src/config/environment.js` | `:33-34` |
| `deploy-production.sh` REQUIRED_KEYS | `:12` |

**Six surfaces. Twelve values. Branch A specifies one of the two halves.**

---

## §3 INFERRED — marked as inference, from the facts at §2

**From rows 1–7 jointly:** one process environment serves both applications. Dev's Cognito configuration is not established by the dev deploy path, so it is inherited from the box environment — the same environment the single `ENV_FILE` populates for prod.

**This is inference, not a read.** It follows from seven established facts and no contrary evidence was found, but no single anchor states it. What would convert it to established is a live read of the running process environments, which is freeze-gated and was not attempted.

---

## §4 Branch A's cost line is wrong on both terms

> **Cost.** Low. One new pool, one config change per environment. No Cognito user migration of any kind.

**Term 1 — "one new pool" prices half the surface.** §2.1: the shared thing §9.10 names has two halves — *"dev and prod share the same Cognito User Pool **and Client ID**"* — and every config surface carries both. A new empty pool requires its own app client; callback URLs, logout URLs and domain settings attach to the client, not the pool. **None of that is in Branch A's specification.**

**Term 2 — "one config change per environment" describes an operation the topology does not support.** Branch A's *mechanism* names one environment (*"dev's env config"*); its *cost* prices two (*"per environment"*). Those are not the same operation. §2 resolves which is achievable: **neither, as written**, because there is one surface and no per-environment variable to repoint.

### §4.1 This is Defect 1's shape, recurring inside the branch written to remedy it

`PE #65` Defect 1 is that §9.10's plan clause and trigger clause describe different operations and no revision noticed. **Branch A's mechanism clause and cost clause do the same thing, one section apart, in the document that files Defect 1.**

Recorded as a pattern observation, not a new defect number. **This document mints nothing.**

---

## §5 Freeze consequence

Because the config change reaches the surface prod reads, **Branch A's execution is prod-touching by construction.**

`F-AUTH-1_Fix_Plan_v2.58.md` §2.5 governs the consequence:

> If the required read or operation is **freeze-gated and authorization is not given, the corresponding dimension is NOT PERFORMED, not INCONCLUSIVE.**

**Execution authorization has not been given.** The topology document's Branch A entry says the branch *"can be chosen without"* knowing the identities — which remains true, and is a separate question from whether it can be **executed** under the freeze. It cannot, as specified, without authorization.

---

## §6 The unstated prerequisite

**Separating the two environments' configuration surfaces must precede the repoint.** Concretely, one of: distinct variable names per environment, distinct env files with distinct load paths, or distinct process environments on the shared box.

**None exists today. Branch A does not mention it, does not sequence it, and does not price it.**

This is the single largest omission in the branch specification, and it is upstream of every other cost.

---

## §7 What remains owed before `PE #65` closes

| Item | Status |
|---|---|
| The prerequisite's own scope and sequence | **Owed.** §6. Upstream of everything else. |
| App-client creation set — client, callbacks, logout URLs, domain | **Owed.** Unspecified by Branch A. |
| Rollback procedure | **Owed.** Branch A says the new dev pool is *"trivially disposable"*; nothing covers a partial repoint. |
| Execution authorization under the freeze | **Not given.** §5. |
| Verification step | **Owed.** Unspecified. |
| `COGNITO_CLIENT_SECRET` handling | **Open.** Read at `src/config/environment.js:35`; forwarded by **neither** manifest. |

**`PE #65` does not close on this document.** It closes when the above is complete.

---

## §8 UNRESOLVED — recorded, not reasoned out

**§8.1 The dev workflow's `--update-env` valence.** Its header states *"no `--update-env` clobber"* (`deploy-dev.yml:19`); its body invokes `--update-env` (`deploy-dev.yml:269`, inside the `restore_pm2` trap armed at `:334`). Same flag, opposite valence, same file. **Not resolved by reasoning about intent.**

**§8.2 Placeholder-policy coverage.** Absence of the env file yields empty defaults rather than failure (`deploy-production.sh:29`). `src/middleware/auth.js:82` defines a `COGNITO_CONFIG_PLACEHOLDERS` block and `tests/unit/middleware/fd68-placeholder-policy.test.js` exists, so the register knows this territory. **Whether that policy covers the repoint path or only the deploy path is unread**, and it matters: a botched repoint degrades silently rather than failing loudly.

**§8.3 A shared name with a live path.** `episode-worker` is the app name in **both** manifests, and the dev deploy restarts it by name (`deploy-dev.yml:269`, `--only episode-api,episode-worker`). `deploy-production.sh:226` documents the sharing as designed. Recorded because a costing that finds adjacent defects and drops them is doing half its job. **Out of Branch A's scope; not re-scoped here.**

---

## §9 One failure signature, two mechanisms

Branch A's headline consequence is that *"nothing fails… no log line marks the promotion, no test turns red, no step requires anyone to look."*

§8.2's empty-default path has the same signature from a different mechanism: a botched repoint yields empty configuration rather than an error.

**Two independent routes to a silent failure in the same operation.** Recorded so that any execution plan treats verification as load-bearing rather than ceremonial — neither route produces a signal on its own.

---

## §10 What this document does not do

- **Does not re-decide the branch.** Branch A stands as selected.
- **Does not close `PE #65`.** §7.
- **Does not mint.** No FD, no XK, no PE. §4.1's pattern observation is not a defect number.
- **Does not amend the topology decision document.** The cost correction is substantive, not a pointer, and under `F-AUTH-1_Fix_Plan_v2.68.md` §7 a banner *"may point but may not carry."* A pointer from that document to this one is a separate decision.
- **Does not dispatch, execute, or authorize anything.** No workflow run, no AWS call, no deployed host contacted.
- **Does not resolve §8's three open items.**
- **Discloses no identifier.** By role throughout.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 central finding: one Cognito config surface, not two. §2 seven established facts with file-and-line anchors across five surfaces. §2.1 pool and client paired in all six config surfaces, never separately. §3 the single-process-environment conclusion marked as inference from §2, with what would convert it. §4 Branch A's cost line wrong on both terms. §4.1 Defect 1's clause-identity shape recurring inside the remedy branch, recorded as pattern not minted. §5 freeze consequence under v2.58 §2.5 — prod-touching by construction, NOT PERFORMED absent authorization. §6 the unstated prerequisite, upstream of every other cost. §7 six items owed before `PE #65` closes. §8.1 `--update-env` valence contradiction unresolved. §8.2 placeholder-policy coverage unread. §8.3 shared worker name with a live restart path. §9 two mechanisms, one silent-failure signature. §10 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-08-24. Basis `main` at `f6a6933f`. Costs a branch; decides nothing. Mints nothing. Closes no finding. No AWS call issued. No deployed host contacted. No workflow dispatched. Prod FROZEN.*
