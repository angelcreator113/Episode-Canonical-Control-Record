| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Authorizes one migration. Changes no gate.* |
| --- |

**Document version**

v2.54 — **AUTHORIZES ONE MIGRATION: `deleted_at` on `decision_logs`. CHANGES NO GATE. MINTS NOTHING.** FD tail is **FD-66 (claimed-not-confirmed, PR #1050)**; XK tail remains **XK-3**. This is the **first schema change under the migrations-only ruling** recorded at FD-66 §7.1, and is authorized as the pilot for that ruling per FD-66 §7.1.1 (§3). Authorizes **one column on one table** with **five explicit exclusions** (§1). Requires a working `down` and states why the first migration under the ruling is where that convention is set (§1.2). **Specifies the before/after demonstration as steps rather than leaving it to practice** (§2), because v2.53 §1.1's specification was written against a route that had never functioned and nobody checked. **Names what a green clause 3 does not establish** (§2.3). **Analysis derived from git against `origin/main` at `77fc5fb0`** — that SHA is this document's analytical basis and is **not** the basis for the demonstration at §2, which reads the SHA at run time (§2, step 1). Local test database contacted; no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** — **OPEN, P0**, untouched by this revision. **FD-66** — **P0, claimed-not-confirmed** pending the vehicle ruling at PR #1050. **FD-63** and **FD-64** remain open. **Gate G3 — NOT DISCHARGED**; clause 3 unmet and, until this migration lands, unmeetable. Track G4 — precondition not satisfied. Track G5 — **BLOCKED** per v2.43 §4.2. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# PART I — THE AUTHORIZATION

# §1. What this authorizes

**This section is the authorization. Anything not listed here is not authorized by this revision.**

**One column, on one table.**

| Item | Value |
|---|---|
| Table | `decision_logs` |
| Column | `deleted_at` |
| Type | `Sequelize.DATE` |
| Nullable | `allowNull: true` |
| Default | none |
| Migration path | `src/migrations/` — **the directory `.sequelizerc` names, not the repo-root `migrations/`** |

**Why the column is required.** `src/config/sequelize.js:63` sets `paranoid: true` as a global `define` default. `src/models/DecisionLog.js:62-68` sets `tableName`, `timestamps`, `createdAt`, `updatedAt: false`, `underscored` and `indexes`, and **does not opt out**, so every query the model issues names `deleted_at`. `src/migrations/20260208110001-create-decision-logs-table.js` creates no such column and no later migration adds one.

**Observed, 2026-08-18:** authenticated `POST /api/v1/decision-logs` returns **500**, `column "deleted_at" does not exist`, on the INSERT's `RETURNING` clause. The route has never persisted a row (FD-66 §3.3).

## §1.1 Explicit exclusions

**Five NOs, in v2.50 §1's shape, because the temptation to fix neighbours while the file is open is precisely what that shape exists to prevent.**

| Not authorized | Why |
|---|---|
| `activity_logs` — the eight camelCase columns | Axis N, a rename, different risk profile. **NO.** |
| The other 26 broken models from FD-66 §6.3 | **NO.** |
| `ProcessingQueue`'s table-name mismatch (`processing_queue` vs `processing_queues`) | **NO.** |
| A baseline migration | FD-66 §7.1 step 2, gated on the infrastructure read. **NO.** |
| The 38 unclassified no-table models | Disposition unestablished. **NO.** |

**Also not authorized:** any change to `src/models/DecisionLog.js`. The remedy chosen is Option A from FD-66 §7 — correct the schema — **not** Option B, opting the model out of `paranoid`.

## §1.1.1 The filename, stated so the next one does not guess

**Authorized filename: `src/migrations/20260818000000-add-deleted-at-to-decision-logs.js`.**

Convention, read off the directory: `YYYYMMDDHHMMSS-kebab-description.js`. The newest existing prefixes are `20260805000000`, `20260806000000`, `20260807000000`, so `20260818000000` sorts after everything present and matches today's date.

**A hazard measured while writing this revision, and it is not from FD-66 — FD-66 never examined it.** `src/migrations/` contains **at least ten duplicated numeric prefixes**: `20260208`, `20260217000001`, `20260219000004`, `20260223100000`, `20260307210000`, and others. `src/seeders/` has none.

**Sequelize orders migrations lexicographically by filename, so colliding prefixes make relative order depend on the remainder of the name.** For migrations that touch unrelated tables this is harmless and has evidently been harmless so far. **For a baseline, or for two migrations altering the same table, it is not.** Recorded here because the first migration under the migrations-only ruling is where the convention gets stated, and because **the count above is a floor from one `uniq -d` over filenames — no assessment of whether any existing collision is order-dependent has been made, and none is claimed.**

**Not authorized here:** renaming any existing migration file. That would rewrite applied-migration bookkeeping and is a separate concern with its own risk.

## §1.2 Reversibility — required, and precedent-setting

**The migration must have a working `down` that drops the column.** `up` adds `deleted_at`; `down` removes it. Nothing else.

**This is trivial here and that is the point.** The baseline at FD-66 §7.1 step 2 will be the largest schema artifact in the repository, and a baseline without a `down` is unrecoverable. **The convention is established or lost on the first migration written under the ruling, which is this one.** A revision authorizing a one-column change is the cheapest possible place to fix the convention in.

## §1.3 Column shape — verified, not assumed

**Read from tables that work, not from convention.** `src/migrations/20240101000001-create-episodes.js:112-115` declares:

```js
deleted_at: {
  type: Sequelize.DATE,
  allowNull: true,
},
```

The same declaration appears at `20240101000006-create-scenes.js:86`, `20240101000007-create-episode-scripts.js:59`, and `20260108200000-create-episode-templates.js:102`. **Materialized shape confirmed against the local test database: `timestamp with time zone`, nullable, no default — consistent across all 70 tables that carry the column.**

## §1.3.1 No `default` — the prohibition, and the mechanism behind it

**No `default` is to be set on `deleted_at`. Not `Sequelize.NOW`, not `Sequelize.literal('NOW()')`, not a constant. The column is nullable with no default, and `NULL` is the meaning of "not deleted".**

**The mechanism, stated because the rule alone will not survive contact with a template.** Sequelize implements `paranoid` by adding `deleted_at IS NULL` to the `WHERE` clause of **every** read the model issues. A defaulted `deleted_at` therefore does not mark rows as deleted in any visible way — **it makes them disappear from every query while remaining physically present in the table.** Row counts in `psql` stay correct; the application sees nothing. No error is raised, no constraint is violated, and nothing in the diff looks wrong: `defaultValue: Sequelize.NOW` beside a timestamp column is the most ordinary line in a migration.

**It would pass review as boilerplate**, and on a table with existing rows it is a silent data-visibility loss affecting all of them at once.

**This is recorded as a mechanism rather than a rule because rules get reinstated.** A future linter, scaffold, or `createTable` template that adds defaults to timestamp columns will propose exactly this change, and a reader who knows only *"no default"* has no grounds to refuse it. A reader who knows *why* does.

---

# PART II — VERIFICATION

# §2. The demonstration, specified as steps

**v2.53 §1.1 specified a test against a route that had never functioned, and the specification went unchecked because verification was described rather than sequenced. This section is sequenced so it cannot quietly not happen.**

**Which SHA governs, stated because two appear in this document.** The version header cites `77fc5fb0` as the commit this revision's **analysis** was derived against; that is fixed and correct. **It does not govern the demonstration below.** Step 1 reads `origin/main` at run time and records what it observes. A reader encountering both should take the header's SHA as provenance for the reasoning and step 1's as provenance for the evidence.

1. **Before.** With **no** migration applied, run the clause 3 test. **Record the failure output verbatim, and record the `main` SHA as read at that moment** — `git rev-parse origin/main`, captured at run time, not quoted from this document. At the time of writing `origin/main` is `77fc5fb0`, but PR #1050 or the closure may land first; **a SHA fixed here would be a citation that drifts, which is this register's most-repeated failure shape.** The recorded SHA is whatever the run observes.
2. **Apply.** Run the migration against the test database.
   **2b. Verify the `down`.** Run `db:migrate:undo`. **Confirm `deleted_at` is absent from `decision_logs` by reading `information_schema`, not by trusting the command's exit code.** Then re-apply. This verifies the claim that matters — *"the `down` works"* — which is not readable from the file, as distinct from *"the file has a `down`"*, which is. It incidentally exercises an up/down/up cycle, worth knowing before the baseline does it across 66 models.
3. **After.** Re-run the same test unchanged. **Record the pass.**
4. **Both records go in the closure revision (v2.55).** A before/after pair that is not written down is an assertion.

**Step 2b is a gate, not a record.** **If `down` fails, or leaves residue, or the re-apply does not restore the column, the migration does not ship.** An unverified `down` on the first migration under the migrations-only ruling would establish that `down` is a formality — the precise opposite of §1.2's intent, and a precedent inherited by a baseline where the `down` is the only recovery path.

**This is the first test in this program with a genuine before/after property.** Everything written to date has been a diff-lock, a guard, or a control — artifacts that pass on the current state and would fail on a regression. **This one fails on the state that exists before the migration and passes after, and that is demonstrable rather than claimed.**

## §2.1 The test — v2.53 §1.1's corrected three-assertion form

**Not v1.5's step 1**, which passes on two nulls. The three assertions, restated here from v2.53 §1.1 rather than inherited by reference:

1. Persisted `user_id` is **non-null and not the string `'undefined'`**.
2. It **equals `req.user.id` as the middleware sets it** — not a sibling route's write, and **not the `sub` claim directly**.
3. An **anonymous** POST to the same `requireAuth`-gated route persists **no row at all**.

**Assertion 2's ground truth, and its known awkwardness.** `req.user` is not reachable from the test boundary. The closest available proxy is `GET /api/v1/auth/me`, which returns the middleware-mapped `req.user` object — **verified working, 2026-08-18: returns 200 with `user.id` set.** The coupling to record: `/me` runs `authenticateJWT` from `src/middleware/jwtAuth.js`, a **different middleware** from the route's `requireAuth`. Both map `id: decoded.sub`, and no `sub` key is set by any of the five assignment sites across the two files. **The proxy is sound today and is not sound by construction**, which is the awkwardness v2.53 §1.1 was written to surface and which this revision records rather than designs around.

**Discriminator for assertion 3.** A per-run unique `entity_id` — a generated UUID, since `decision_logs.entity_id` is `uuid`-typed. Note the test setup mocks the `uuid` module (`tests/setup.js:20`) to return non-UUID strings; use `crypto.randomUUID()`.

## §2.2 What passing establishes

**That `decision_logs` persists actor attribution matching the middleware-mapped principal, and that anonymous callers persist nothing.** That is Gate G3 clause 3, and it discharges **v2.52 §6 item 1** — *"Gate G3 clause 3 — decisionLogs `user_id` test"*, whose recorded blocker is item 2.

**It also clears the last blocker on v2.52 §6 item 4.** Item 4 is the withheld Gate G3 discharge ruling, re-made against the full four-clause text; its recorded blockers are **items 1 and 2**. Item 2 — F-Auth-5 — closed at `ed3461c5`. **Item 1 closes when this test passes, at which point item 4 is blocked on nothing and the ruling withheld at v2.52 §1.1 becomes available to make.**

**Available to make is not made.** This revision does not make it, and §2.3 records that clause 3 becoming met does not discharge the gate.

## §2.3 What passing does NOT establish

**Stated because a green clause 3 read alongside FD-66 will otherwise be read as more than it is.**

- **`GET /api/v1/audit-logs` remains broken.** This migration does not touch `activity_logs`. The control v2.49 §2.4 named as the one that would evidence an intrusion still returns 500 after this change lands.
- **FD-66 remains open.** 27 of its 28 broken models are untouched, as are all 38 unclassified ones.
- **FD-65 remains OPEN and P0.** The issuance half is unaffected; `POST /api/v1/auth/login` still issues signed tokens to unauthenticated callers.
- **Gate G3 is not discharged by this.** Clause 3 becoming met is a consequence; the discharge is a ruling, carried at v2.52 §6 item 4.
- **`POST /api/v1/thumbnails/:id/publish` remains broken** — Axis A, eight absent columns. It is the other F-Auth-5 site on an unreachable route.

**A green clause 3 alongside an open FD-66 means one route now works. Reading it as evidence that the audit surface functions would be the same shape as reading a green soak as security evidence.**

---

# PART III — BASIS

# §3. What authorizes this, and the gap in that basis

**The direction — migrations as the single source of schema truth — is recorded at FD-66 §7.1, and FD-66 is itself DRAFT and unlanded (PR #1050).** The sequencing that puts `decision_logs` first is FD-66 §7.1.1.

**Both are rulings given in the course of the work with no prior written basis in the register.** FD-66 §7.1 requires that a ratifying revision **restate their grounds from the citations rather than inherit them from FD-66**, because inheriting a claim instead of re-reading the source is the v2.47 §4.1 failure this register has recorded five times. **That requirement is discharged here:**

- `src/app.js:70` — `sync()` requires `ENABLE_DB_SYNC === 'true'`. Read directly.
- `src/app.js:82` — `alter` requires a second flag, `DB_SYNC_ALTER === 'true'`. Read directly.
- **Neither flag is set anywhere in the repository** — no env file, template, `ecosystem.config.js`, workflow, or deploy script. Searched directly.
- `.github/workflows/deploy-production.yml:70`, `:267` and `deploy-dev.yml:123`, `:341` — both deploy paths run migrations. Read directly.
- `scripts/fix-missing-tables.js:3` and `src/migrations/20260323100000-add-scene-sets-generation-status.js:7` — **sync has been used historically, to unknown extent.** Read directly.

**The grounds hold. The gap is that FD-66 is not landed**, so this revision authorizes work under a ruling whose own instrument is still in review. **That is recorded, not resolved.** If PR #1050's vehicle question resolves against a standalone finding minting FD-66, this revision's §3 basis needs restating against whatever instrument replaces it — the authorization at §1 does not change, because the defect at §1 is observed independently of how it is filed.

## §3.1 Correction owed, and this revision is where it comes due

**v2.53 §4 states: *"Executing §1 makes Gate G3 clause 3 meetable. The test at §1.1 fails today and passes after."*** That is false and FD-66 §5.1 records it: the specified test fails on **both** sides of `ed3461c5`, because `decision_logs` persists nothing regardless of what `:22` reads.

**This revision is what makes the claim true.** v2.53 §4 stands as written, corrected forward here: **clause 3 becomes meetable when this migration lands, not when `ed3461c5` landed.**

---

# PART IV — LEDGER AND CLOSING

# §4. What this revision establishes

- **One migration is authorized**: `deleted_at`, `Sequelize.DATE`, nullable, no default, on `decision_logs`, in `src/migrations/`, with a working `down` (§1, §1.2, §1.3).
- **Five exclusions are explicit** (§1.1). The remedy is Option A, schema-side; the model is not to be changed.
- **The before/after demonstration is sequenced, and both records are owed to v2.55** (§2).
- **What a green clause 3 does not establish is named** (§2.3) — `audit-logs` stays broken, FD-66 stays open, FD-65 stays OPEN and P0.
- **FD-66 §7.1's restatement requirement is discharged** (§3): every ground re-read from source and cited, not inherited.
- **v2.53 §4 is corrected forward** (§3.1).

# §5. What this revision does not do

- **Does not write the migration or the test.** It authorizes the first and specifies the second.
- **Does not close the F-Auth-5 remediation.** That is v2.55.
- **Does not discharge Gate G3**, and does not mint, close, or reprioritize any FD.
- **Does not touch `activity_logs`, the other 26 broken models, the 38 unclassified models, or `src/middleware/`.**
- **Does not contact any deployed host.** The infrastructure read at FD-66 §6.4.1 remains owed and is not attempted here.

# §6. Numeral disambiguation

- **FD-66** is the finding; **PR #1050** is its filing; **FD-66 §7.1** is the ruling this revision rests on. Three different things.
- **Gate G3 clause 3** is the gate condition. **v2.52 §6 item 1** is its ledger entry. **v2.53 §1.1** is the test specification. **§2 above** is the demonstration sequence. Four different things.
- **v2.54 authorizes a migration. v2.55 closes F-Auth-5.** This revision does not close anything.
- **Axis P** at FD-66 §6.3.1 has 19 members. **This revision addresses one of them.**

---

*Type: Authorization. **Authorizes one migration** — `deleted_at` on `decision_logs`, with `down`, five explicit exclusions, and a sequenced before/after demonstration. First schema change under the FD-66 §7.1 migrations-only ruling. Discharges FD-66 §7.1's restatement requirement. Corrects v2.53 §4 forward. Ships no code. Changes no gate. Mints nothing. FD tail: FD-66, claimed-not-confirmed. FD-65 remains OPEN, P0. Local test database contacted; no request issued to any deployed host. Prod FROZEN. [skip-automerge]*
