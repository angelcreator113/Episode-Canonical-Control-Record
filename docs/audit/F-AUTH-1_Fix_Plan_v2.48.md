| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Mint revision — correctness defect on the held file.* |
| --- |

**Document version**

v2.48 — **MINTS FD-64 (F-AUTH-1). SHIPS NO CODE.** FD tail advances **FD-63 → FD-64**; XK tail remains **XK-3**. Records a **live production correctness defect in `src/routes/roles.js` and `src/services/AssetRoleService.js`**: the service exports `getRolesForShow`, and **both** of its consumers call `getRolesForshow` — lowercase `show`. Records a **second, independent defect** at `AssetRoleService.js:152`, a `Model.update()` with no `where`. **Three of `roles.js`'s nine handlers are dead on `origin/main`.** Corrects v2.45 §3.1's handler enumeration from eight to nine. **FD-64 is a correctness defect surfaced by F-AUTH-1 work, not an F-AUTH-1 sub-form** — see §6. Does not close FD-63. Changes no gate. Derived from git against `origin/main` at `ffe91c3d`, plus one offline Sequelize behaviour probe (§2.3). No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-63 (F-AUTH-1)** remains open per v2.47 §5. **FD-64 (F-AUTH-1)** opens here, unremediated. Track G3 — OPEN; the owed test deliverable is **half supplied** and remains undischarged (§5.1). Track G4 — **not entered, still blocked on §5.1**. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. What this mints

**FD-64 (F-AUTH-1) — `roles.js` / `AssetRoleService` method-name and query-scope defects. Three of nine handlers non-functional on `origin/main`.**

**Statement.** `src/services/AssetRoleService.js:11` defines `async getRolesForShow(showId)`. It has **no correctly-cased caller anywhere in the repository**. Its two consumers — `src/routes/roles.js:19` and `src/services/AssetRoleService.js:124` — both call `getRolesForshow`, lowercase `show`, which is `undefined`. Independently, `AssetRoleService.js:152` calls `models.Asset.update({ role_key: roleKey })` with no options object and therefore no `where` clause.

**`getRolesForShow` is dead code with two miscased consumers.** That is the sharp form of the finding, and it is the explanation for the defect's survival: no route, no service path, no frontend call and no test has ever executed the correctly-named method, so nothing was ever positioned to fail.

**FD-64 is a correctness defect, not an authentication defect.** It is minted under F-AUTH-1 because F-AUTH-1's revision series is the instrument that surfaced it and because FD numbers are minted only by Fix Plan revisions (§6). **It must not be counted toward F-AUTH-1's authentication surface**, toward the 95 handlers promoted at `8ba2b95c`, or toward FD-63's remediation. It is not a fifth miss shape and it is not a sub-form of anything at v2.44 §2.

---

# §2. The evidence

## §2.1 The casing defect

`git grep -n "getRolesFor" origin/main -- src/services/ src/routes/roles.js`:

```
origin/main:src/routes/roles.js:19          await AssetRoleService.getRolesForshow(showId);
origin/main:src/services/AssetRoleService.js:11    async getRolesForShow(showId) {
origin/main:src/services/AssetRoleService.js:124   const roles = await this.getRolesForshow(showId);
```

Definition at `:11`, capital `S`. Both call sites lowercase. **Both are on `origin/main`** — this is shipped state, not a working-tree artifact.

The second site is the one that widens the defect. It sits **inside the service**, in `getRoleUsageStats` (`:123`), which means the same typo reaches a second route without passing through `roles.js:19`.

`git grep -n "getRolesFor" -- src/ frontend/src/ tests/` returns no correctly-cased call. The only occurrences of the string in `tests/` are the two explanatory comment lines in the FD-63 integration test (§5).

## §2.2 The missing `where`

`AssetRoleService.js:145-154`:

```js
async assignRoleToAsset(assetId, roleKey) {
  const asset = await models.Asset.findByPk(assetId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  await models.Asset.update({ role_key: roleKey });   // ← no options, no where
  console.log(`✅ Assigned role ${roleKey} to asset ${assetId}`);
  return asset;
}
```

The `asset` fetched at `:146` is used **only** for the existence check and then returned. It never scopes the update. `assignRoleToAsset` has exactly one caller — `bulkAssignRoles` at `:169` — so the defect is reachable only through `POST /api/v1/roles/bulk-assign`.

## §2.3 What the missing `where` actually does — probed, not assumed

**The reading that this is an unscoped mass-update of every `Asset` row was considered and is wrong.** Sequelize's `Model.update()` asserts on `where` before composing any SQL. Verified offline against the installed version — `sequelize@6.37.8`, declared `^6.37.7` — by calling `Model.update()` with no options against a model bound to an unreachable dialect, so that any assertion would necessarily precede any connection:

```
THREW [AssertionError]: Missing where attribute in the options parameter
```

**No SQL is emitted and no row is modified.** The `AssertionError` propagates out of `assignRoleToAsset`, is caught per-assignment by `bulkAssignRoles`'s `try`/`catch` at `:170`, and is counted into `results.failed`.

**The route therefore returns HTTP 200 with `status: 'SUCCESS'`** and the message `Assigned roles: 0 succeeded, N failed`, having mutated nothing. This is the most deceptive available failure mode: a success status code, a success envelope, and a per-item failure count that a caller must parse the message body to notice.

**This probe is the load-bearing step in §2.2 and is recorded as such.** The severity of the finding turns entirely on it, and the two candidate readings — global data destruction versus a silent no-op — differ by the whole width of the severity scale.

---

# §3. Blast radius

`roles.js` declares **nine** handlers. Three are non-functional:

| Line | Handler | Path | Failure |
|---:|---|---|---|
| `:9` | `router.get('/')` | `GET /api/v1/roles` | **500** — `getRolesForshow` (§2.1) |
| `:39` | `router.get('/stats')` | `GET /api/v1/roles/stats` | **500** — via `getRoleUsageStats` → `:124` (§2.1) |
| `:178` | `router.post('/bulk-assign')` | `POST /api/v1/roles/bulk-assign` | **200 `SUCCESS`, zero mutations** (§2.2–2.3) |

The remaining six are live and functional: `GET /:roleKey` (`:68`), `POST /` (`:98`), `PUT /:roleKey` (`:128`), `DELETE /:roleKey` (`:153`), `GET /:roleKey/assets` (`:208`), `POST /validate-required` (`:239`).

## §3.1 This does not mitigate XK-3

**It was proposed that the breakage might de-fang XK-3's caller-supplied tenancy exposure, on the reasoning that a broken route cannot be exploited. It does not, and the effect runs the other way.**

**Three live writes remain** — `createRole`, `updateRole`, `deleteRole` — each taking `show_id` from the query string or request body, presence-validated and never entitlement-checked, on a file that carries no `requireAuth` at all. The two handlers the casing defect kills are both **reads**. The write surface XK-3 describes is entirely intact.

**And the breakage suppresses the evidence.** The dead handlers are `GET /` and `GET /stats` — the highest-traffic, most-likely-monitored endpoints on the file, and the two whose failure would most plausibly have prompted someone to open `roles.js`. A file whose reads 500 while its unauthenticated writes succeed is a **worse** state than either defect alone, because the visible failure is on the half that does no damage.

**XK-3's hold is unchanged, its remedy remains unevaluated, and FD-64 supplies no argument for relaxing it.**

---

# §4. Correction to v2.45 §3.1

**v2.45 §3.1 enumerated eight `show_id` derivation sites in `roles.js`. That count is correct.** `git grep -n "showId\|show_id" origin/main -- src/routes/roles.js` returns derivations at `:11`, `:41`, `:71`, `:100`, `:131`, `:156`, `:211`, `:242` — five from `req.query.show_id`, three from `req.body.show_id`, each with the `req.user?.show_id` fallback no middleware can populate.

**What is wrong is the inference carried forward from it.** v2.46 §4 and v2.47 §2 both restate the surface as *"eight handlers."* There are **nine**. The ninth is `POST /bulk-assign` at `:178`, which **derives no tenancy at all** — it reads `assignments` straight from the body and passes asset ids through to the service unscoped.

**The enumeration measured derivation sites and was then read as a handler count.** Every handler that derives tenancy was found; the handler that derives none was invisible to the instrument, because the instrument searched for the string `show_id`.

**This is the same class of error as FD-63 itself** — a grep that cannot see the shape it was not written for, whose zero or whose count is then read as coverage. It is recorded here for that reason and not only for the arithmetic.

**Corrected statement, for use by successor revisions:** *`roles.js` — nine handlers. Eight derive tenancy from caller-supplied `show_id`, presence-validated, never entitlement-checked. The ninth derives no tenancy. None carries `requireAuth`. Held under XK-3.*

---

# §5. The instrument

**FD-64 was surfaced by the Gate G3 test work that v2.47 §4.1 recorded as owed.** Five test files were authored against the CP's four edit shapes — four static tier-locks under `tests/unit/routes/`, one runtime suite under `tests/integration/`. 61 tests, all passing.

The integration suite asserts that `roles.js` stays unpromoted, by requiring that an anonymous `GET /api/v1/roles` does **not** return `401`/`AUTH_REQUIRED`. It passes. **It passes on a 500.** Reading why produced §2.1.

**Two properties of that test are recorded so a successor does not mistake them.** It is still load-bearing: promoting `roles.js` would produce `401` and trip it regardless of the 500. And once FD-64 is remediated it should begin passing on a `200` — **that is the expected transition and is not a reason to relax the assertion.** Both facts are written into the test file's own comment at `tests/integration/f-auth-1-fd63.test.js:126-136`.

**The only test in the suite that names `AssetRoleService` or `/api/v1/roles` is that file.** `git grep -ln "AssetRoleService\|/api/v1/roles" -- tests/` returns it alone. This is the direct corroboration of v2.47 §4's argument: the surface had no coverage, and the first coverage written against it surfaced a shipped defect within the hour.

## §5.1 Gate G3 remains undischarged

**Gate G3's minimum is *"one authenticated + one unauthenticated test per sub-form."*** The five files supply the **unauthenticated half for all four sub-forms** — anonymous `401`/`AUTH_REQUIRED` assertions on a representative route per shape, plus malformed-header discrimination and static promotion locks.

**The authenticated half is supplied for none of them.** It requires a mocked Cognito verifier the suite does not have; `tests/integration/auth.integration.test.js` uses `TokenService`, which is the `jwtAuth.js` path per D20 and does not authenticate `requireAuth` routes.

**Gate G3 is half discharged and therefore not discharged. Track G4 remains blocked on it per v2.47 §4.1.**

---

# §6. Why FD-64 is minted under F-AUTH-1

`Cross_Keystone_Register.md` states the governing rule: **FD numbers are minted only by Fix Plan revisions.** F-AUTH-1's revision series is the instrument that surfaced this defect, and no other open series can receive it — F-Stats-1's series concerns ORM conversion, F-Sec-3 addresses a different surface, and **the program has no correctness-defect keystone.**

**Referring FD-64 out would land it nowhere. An unowned finding is the precise failure mode the register exists to prevent**, and is a worse outcome than a keystone carrying one finding outside its nominal subject.

**Precedent.** v2.43 minted FD-63 as the first FD in the F-AUTH-1 series and recorded that departure explicitly. Minting a second FD, of a different kind, against a file this series already holds under XK-3, is a **smaller** step than that one was.

**The cost of the departure is the reading risk, and §1 is written to absorb it:** FD-64 is a correctness defect surfaced by F-AUTH-1 work, is not an F-AUTH-1 sub-form, and is not to be counted toward the authentication surface.

---

# §7. Recorded, not addressed

- **`assignRoleToAsset`'s existence check is load-bearing for nothing.** Even with `where` supplied, `findByPk` at `:146` and the update would be two unscoped statements against a caller-supplied id. Remediating §2.2 by adding `where: { id: assetId }` fixes the no-op and **leaves the tenancy question untouched** — the asset is still never checked against a show.
- **`bulk-assign` reports partial failure through a 200 and a message string.** `results.errors` is populated and returned in `data`, but the status code and `status: 'SUCCESS'` envelope are identical for 0-of-500 and 500-of-500. Independent of FD-64.
- **`getRoleUsageStats` has no test and one caller.** Its defect at `:124` is invisible until `GET /stats` is requested.
- **v2.46 §4 and v2.47 §2 both carry the "eight handlers" phrasing** corrected at §4. Neither is amended by this revision; successors should cite §4.
- **The six live handlers' unbounded and unscoped behaviour** is XK-3's subject, not FD-64's, and is not re-litigated here.

---

# §8. Numeral disambiguation

- **FD-64 (F-AUTH-1)** is minted here. **FD-63 (F-AUTH-1)** is v2.43's mint, open, unamended, and unrelated in subject. FD tail: **FD-64**.
- **XK-3 (F-Stats-1 v1.57)** is unchanged, unamended, and is the entry `roles.js` reports against. XK tail: **XK-3**.
- **Gate G3** at §5.1 is F-AUTH-1's v1.5 six-gate sequence — *"Self-review passed,"* the gate carrying the test minimum. **Track G3** at Status is the deployment track. **CP12-G1 … CP12-G6** are the §21 verification greps. **XK-3 Gate 1 … Gate 4** are the Cross-Keystone Register's admission gates.
- **Miss shapes 1–4** (v2.44 §2) and **edit shapes 1–4** (v2.47 §1) are the same partition. **FD-64 is neither** and adds no shape to either.
- **D20** is `authenticateJWT` preservation, cited at §5.1 only for why the existing auth integration suite cannot supply the authenticated half.
- **"Nine handlers, eight derivation sites"** (§4) — the two numbers measure different things and both are correct.

---

# §9. What this revision establishes

- **FD-64 (F-AUTH-1) is minted**: `getRolesForShow` is dead code with two miscased consumers, both on `origin/main` (§1, §2.1).
- **A second, independent defect** — `Model.update()` with no `where` at `AssetRoleService.js:152` (§2.2).
- **The missing `where` is a silent no-op, not a mass update**, established by offline probe against `sequelize@6.37.8`; the route returns **200 `SUCCESS` having mutated nothing** (§2.3).
- **Three of `roles.js`'s nine handlers are non-functional on `origin/main`** (§3).
- **The breakage does not mitigate XK-3 and makes the state worse** — three live unauthenticated writes remain; the dead handlers are the two whose failure would have surfaced the file (§3.1).
- **v2.45 §3.1's eight is a derivation-site count misread as a handler count. There are nine handlers** (§4).
- **FD-64 was surfaced by the owed Gate G3 tests, which corroborates v2.47 §4** (§5).
- **Gate G3 is half discharged — unauthenticated half supplied for four sub-forms, authenticated half for none — and therefore undischarged** (§5.1).

---

# §10. What this revision does not do

- **Ships no code.** Does not fix the casing at `roles.js:19` or `AssetRoleService.js:124`, does not add the missing `where` at `:152`, and does not edit `roles.js`.
- Does not close, amend, or remediate **FD-63 (F-AUTH-1)**. Does not remediate **FD-64**, which opens unremediated.
- Does not amend **XK-3**, the Cross-Keystone Register, **PE #51**, or **D20**. XK tail remains **XK-3**; no XK and no PE is minted.
- Does not convert `roles.js`'s hold into a tier disposition, and supplies no argument for relaxing it (§3.1).
- Does not amend v2.46 §4 or v2.47 §2, whose "eight handlers" phrasing §4 corrects forward.
- Does not supply the authenticated half of Gate G3's minimum (§5.1). **Track G4 is not entered. Track G5 remains BLOCKED.**
- Does not change §21's G1, the pre-flight script, or any probe.
- Does not address anything at §7.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived from git against `origin/main` at `ffe91c3d`. The single probe at §2.3 ran offline against an unreachable dialect and touched no database.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-17. Main at `ffe91c3d`. Predecessor: v2.47.*
*Type: Mint revision. Ships no code. Mints FD-64 (F-AUTH-1) — a correctness defect surfaced by F-AUTH-1 work, expressly not an F-AUTH-1 sub-form. Corrects v2.45 §3.1's handler enumeration to nine. Records Gate G3 half discharged. Mints no XK, no PE. Tail: FD-64. XK tail: XK-3. Changes no gate. No live database contact. [skip-automerge]*
