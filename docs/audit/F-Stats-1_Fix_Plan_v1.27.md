# F-Stats-1 Fix Plan v1.27

| | |
|---|---|
| **Predecessor** | v1.26 (`65f1db8f`, #992). |
| **Basis** | `65f1db8f` (#992 squash-merged). |
| **Author date** | 2026-08-08 |
| **Gate effect** | Open item 32 RESOLVED. Open item 36 CARRIED to v1.28 on derivation-only grounds. §27's rotation-gate obligation DISSOLVED — no rotation was required or performed. §23.1 clarified and **not** satisfied; open item 6 remains blocked. A new local-to-canon write hazard is recorded. `worldEvents.js` remains the next executable surface, unblocked. |

## What changed in v1.27

- **§29 (new):** item 32 resolution record, §27 dissolution, §23.1 clarification, and the local-to-canon write hazard.
- **Open item 32 RESOLVED.** The blocker was a stale local `.env` credential. The maintainer restored the working value from their password manager; canon now authenticates. No rotation was performed.
- **§27's rotation-gate obligation DISSOLVED**, not met. It was written against a world in which the working value was unknown. It is not unknown.
- **Open item 36 CARRIED to v1.28.** The exposed value appears to have been non-authenticating already, but the record still relies on derivation from the earlier local `.env` failure rather than a fresh read of the same transcript value.
- **§23.1 CLARIFIED and NOT satisfied.** Its "or the credential recovered" clause is now literally true and materially misleading. **Open item 6 remains blocked.**
- **New hazard recorded:** local `.env` now authenticates against canon. Any integration suite run locally writes to live canon data.
- **Prod-side CI credential finding forward-pointed to F-Deploy-1.** Not absorbed into F-Stats-1.
- **No execution state changes.** PR 4 remains CLOSED at 6 of 6. Unit 19 disposition is addressed below.
- Basis `65f1db8f`. Mints no FD. Tail: FD-61.

---

## §29 — open item 32 resolution and §27 dissolution (NEW — derived live at `65f1db8f`)

### What resolved it

v1.18 defined resolution as *"reading the credential from Secrets Manager or rotating it via `modify-db-instance` against canon."* Neither path was taken, and neither was available or necessary.

F-Deploy-1 v1.35 records that the canon `db_password` rotation **closed as executed at v1.34 step 8**, confirmed by independent fire on 2026-07-12: the prior value was pulled from SSM, fired at canon as `postgres`, and rejected. The same revision records the SSM parameter **retired by maintainer ruling — deleted, `ParameterNotFound` proven** — with the master credential's sole home the maintainer's password manager, single-point-of-failure accepted deliberately.

So the Secrets Manager path was gone, and the rotation had already happened. What remained was purely local: the workstation `.env` still held the pre-rotation value.

The maintainer restored the working value from their password manager and corrected the `.env` entry. Canon authenticates.

### Identity confirmation — §27 precondition 4 satisfied

v1.18 recorded that **no identity confirmation was possible**: no connection was established, so `current_database()` and `inet_server_addr()` were never read. Canon was aimed at, never reached.

Confirmed live this session, read-only, single query:

| Field | Value |
|---|---|
| `current_database()` | `episode_metadata` |
| `inet_server_addr()` | `10.0.20.224` |
| `information_schema.tables` (public) | 143 |
| `shows` | 10 |
| `world_events` | 53 |

Populated. This is **canon** (`episode-control-dev`), not the empty fork (`episode-control-prod`). Identity established by live read, not by instance name.

### The `#` ambiguity — still undetermined in the register

v1.18 recorded that the delivered value was 33 characters where the file held 39, and that **whether the true password is 33 characters followed by a comment or 39 characters containing a `#` is undetermined**. The correct value is now in the `.env` and authenticates. The register does not record its shape, and this revision does not record it either — it is a secret's structure, not a fact the plan needs.

What the register **does** need, and what stands: `DB_PASSWORD` in `.env` must be single-quoted if it contains a `#`. dotenv 17 strips inline comments from unquoted values and reproduces `password authentication failed` against a *correct* credential. That trap is unchanged and remains elevated.

### §27's rotation gate — DISSOLVED

§27 recorded four preconditions before any rotation action: its own session; blast radius mapped first; freeze-respecting; live identity confirmation.

**No rotation was performed, so no precondition was tested.** The gate does not close as *met*. It closes as **dissolved** — the obligation it guarded no longer exists, because the rotation it anticipated was already executed by F-Deploy-1 on 2026-07-12 and the working value was in the maintainer's hands the whole time.

This is the same closure shape as FD-56 in F-Deploy-1 v1.33: closed by dissolution when the condition that created it ceased to apply.

The blast-radius requirement (precondition 2) was partially discharged anyway and its findings are recorded below, because they outlive the gate.

### Consumer inventory — repo-side

Derived by `git grep -n "DB_PASSWORD" origin/main`. Recorded because it was produced under precondition 2 and is durable regardless of the gate's dissolution.

| Class | Sites |
|---|---|
| Runtime config | `src/config/sequelize.js` (5 sites), `src/config/database.js:34`, `src/db.js:7` |
| PM2 | `ecosystem.config.js:16`, `ecosystem.dev.config.js:20` |
| CI injection | `.github/workflows/deploy-production.yml:301` (`PROD_DB_PASSWORD` → `DB_PASSWORD`) |
| Deploy gate | `.github/scripts/deploy-production.sh:12` (required-key check) |
| Route/service | `src/routes/scriptAnalysis.js:27`, `src/services/scriptsService.js:35` |
| Scripts | ~30 files under `scripts/migrations/`, `scripts/tests/`, `scripts/deploy/` |

A recurring pattern in the scripts class: hardcoded fallbacks (`|| 'postgres'`, `|| 'password'`, `|| 'Ayanna123'`, `|| '1234'`). These are not credentials in use, but they mean a script run with no `DB_PASSWORD` set does not fail loudly — it attempts a connection with a guess. Not remedied here; recorded.

### CI secret state — forward-pointed, not absorbed

GitHub Actions secret values are write-only via API and uninspectable by construction (F-Deploy-1 v1.29 §4.1). Only names and update times are readable.

| Secret | Last updated | Relative to 2026-07-12 rotation |
|---|---|---|
| `DEV_DB_PASSWORD` | ~2026-07-12 | at the rotation window — consistent with F-Deploy-1 v1.34 step 5 |
| `PROD_DB_PASSWORD` | ~2026-06-08 | **predates** |
| `PRODUCTION_DATABASE_URL` | ~2026-06-08 | **predates** |
| `DATABASE_URL` | ~2026-02 | **predates** |

`deploy-production.yml` last ran approximately two months ago, all runs `workflow_dispatch`. It has **not run since the rotation**, consistent with the prod freeze holding.

**The hazard:** `deploy-production.yml:301` injects `PROD_DB_PASSWORD` as `DB_PASSWORD` onto the prod box. If that secret holds a pre-rotation master value, the first prod deploy after the freeze lifts will write a non-authenticating credential onto the box, and the failure will present as `password authentication failed` — the same string that sent item 32 in circles for four revisions.

**This may be a non-issue.** F-Deploy-1 v1.33 records the new-app-user path: dev consumers moved onto a dedicated non-master application user, with the master rotation deliberately last so it would touch nothing app-facing. If `PROD_DB_PASSWORD` holds an app-user credential, a June date is correct and nothing is wrong. The register does not settle which, and F-Stats-1 is not the track that should settle it.

**Disposition: forward-pointed to F-Deploy-1.** F-Stats-1 records the observation and claims no ownership, per the §27 precedent for item 40.

### §23.1 — clarified, and NOT satisfied

§23.1 (v1.21) states:

> Until a local test database is provisioned **or the credential recovered**, CI is the only environment in which these suites can be verified.

The credential is recovered. The clause is now literally true. **It should not be read as satisfying §23.1.**

§23.1 also records that `.env` contains no `localhost` reference and its `DB_*` entries point at the canon host. Recovering the credential therefore did not provision a test database — it **aimed the local suite at production canon**.

Item 6's outstanding assertions are wardrobe money-path coverage: `POST /select` and `POST /purchase`. Those are writes. Running them locally now would write to canon: 143 tables, 10 shows, 53 world_events, live franchise data.

§23.1's disjunction was written when the credential was a dead end. It weighed "recover the credential" as an alternative route to a *working test environment* without weighing what recovery would point the suite at. That is a defect in §23.1's framing, corrected here rather than left standing.

**Open item 6 remains blocked.** Its §23.1 precondition is unmet: no test database exists. Its item-40 precondition is also unmet — owner still unassigned in `Paranoid_Exposure_Inventory_2026-08-07.md`. **CI remains the only environment in which these suites can be verified.**

### New hazard — local `.env` authenticates against canon

Recorded prominently because it did not exist before this session.

The workstation `.env` now holds a working canon credential and points at the canon host. **Any database-touching local run — integration suite, migration script, ad-hoc `scripts/` file — now reaches live canon and can write to it.** Before today those runs failed at authentication, which was an accidental safety net. That net is gone.

The `scripts/migrations/` class is the acute surface: those files execute DDL and DML, several with hardcoded password fallbacks, and none of them ask which database they are addressing.

**No mitigation is applied by this revision.** Provisioning a local test database and repointing `.env` for test runs is the correct remedy and is the same work §23.1 has wanted since v1.21.

### Open item 36 — CARRIED to v1.28 (derivation-only)

v1.21 minted open item 36: the canon `DB_PASSWORD` was printed in full to a session transcript on 2026-08-05, and it *"folds into open item 32's rotation scope."*

The exposed value was read from the local `.env`. v1.18 established on 2026-08-04 — the day before — that the local `.env` value **does not authenticate against canon**, tested in both truncated and single-quoted forms, both rejected with `password authentication failed for user "postgres"`.

That makes the closure argument plausible, but it remains a derivation from the record rather than a fresh re-read of the same value. This revision therefore carries item 36 forward rather than closing it on a weaker evidentiary chain.

### Unit 19

v1.25 §27 recorded unit 19 as *"withdrawn and unconvertible until the rotation is done."* The rotation was done on 2026-07-12 and the local credential is now working. Whether unit 19's withdrawal lifts is a **conversion disposition**, not a credential question, and this revision performs no dispositions. **Unit 19's withdrawal stands unchanged**, now with its stated blocker removed and available for re-disposition by whoever takes it.

---

## §11 Plan Version History (UPDATED)

| v1.27 | 2026-08-08 | Open item 32 RESOLVED — stale local `.env` credential restored from maintainer's password manager; canon authenticates; identity confirmed live (`episode_metadata` @ `10.0.20.224`, 143 tables). §27 rotation-gate obligation DISSOLVED, not met — no rotation required or performed. Open item 36 CARRIED to v1.28 on derivation-only grounds. §23.1 clarified and NOT satisfied; open item 6 remains blocked. New local-to-canon write hazard recorded. Prod CI credential state forward-pointed to F-Deploy-1. §29 minted. Basis `65f1db8f`. |

v1.27 supersedes v1.25 **on open item 32, open item 36, and §27's gate obligation**, and corrects §23.1's disjunction. All other v1.25 and v1.26 forward direction stands unchanged, including the item 40 re-homing, §16's statement counts, v1.26's handler corrections, and the §16.1/§16.2 dispositions.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.26. Tail: FD-61.
- Mints: §29.
- Closes: **open item 32** (resolved).
- Carries: **open item 36** (derivation-only; leave to v1.28).
- Dissolves: §27's rotation-gate obligation.
- Corrects: §23.1's "or the credential recovered" disjunction. v1.21's body is not modified; the correction lives here, per additive-supersede.
- Carries: open item 6 (blocked on §23.1 and item 40), and all other items carried from v1.25.
- Forward-points: prod-side CI credential state to F-Deploy-1. No ownership claimed.
- Changes no unit disposition, no PR state. Unit 19's withdrawal stands.
- Additive-supersede on v1.26; no destructive rewrite.
- **LIVE DATABASE CONTACT — one read-only identity query.** This is the first live DB read in the v1.18–v1.27 chain and is recorded explicitly. The revision makes a single `SELECT` reading `current_database()`, `inet_server_addr()`, and three counts. No writes, no DDL, no transaction. **No prod-box contact. No dev-box contact.** The prod freeze was not touched and this revision confers no authority to touch it.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.27 is the plan-of-record.

**`worldEvents.js` remains the next executable surface**, unblocked, at 112 statements across 50 handlers in 9 groups per §16 as corrected by v1.26.

**Open item 23 stands** and is now the largest remaining F-Stats-1 work: seven groups undispositioned, plus two Overlays handlers. Their totals are re-derived at basis and reliable. Their dispositions do not exist.

**Open item 6 remains blocked** on two independent preconditions: item 40's owner, still unassigned; and §23.1's test database, still absent. The credential recovery did not discharge the second, and this revision records why it might have appeared to.

Two things this revision establishes:

**A blocker can be discharged by another track without either track noticing.** Item 32 carried a rotation obligation across v1.17, v1.18, v1.24, and v1.25 — the last of these authored 2026-08-07, twenty-six days after F-Deploy-1 confirmed the rotation executed and dead. Each F-Stats-1 revision restated the obligation faithfully from its own predecessor. None read the other keystone's register. **Cross-keystone dependencies need a live read of the other track, not a carry-forward of one's own prior statement.**

**A satisfied precondition is not always a met one.** §23.1's disjunction became literally true this session and materially more dangerous — the escape clause it offered turns out to point the money-path write suites at live canon. Preconditions should be re-read at the moment they appear satisfied, not assumed discharged by the event that appears to satisfy them.

After F-Stats-1 closes: **F-Ward-1 next** — which inherits two tables from the §26 inventory.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-08. Main at `65f1db8f` (#992). Predecessor: v1.26.*
*Minted: §29. Closed: open item 32. Carried: open item 36 to v1.28. Dissolved: §27 rotation-gate obligation. Corrected: §23.1. Mints no FD. Tail: FD-61. [skip-automerge]*
