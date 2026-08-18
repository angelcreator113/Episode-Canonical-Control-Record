| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Withholds the Gate G3 discharge. Changes no gate.* |
| --- |

**Document version**

v2.52 — **WITHHOLDS THE GATE G3 DISCHARGE. CHANGES NO GATE. MINTS NOTHING. SHIPS NO CODE.** FD tail remains **FD-65 (F-AUTH-1)**; XK tail remains **XK-3**. **Gate G3 has four clauses; two are met, one is evidenced, and one is unmet and presently unmeetable** (§1). A discharge ruling was given against v2.47 §4.1's single-clause quotation of the gate; **a ruling on a partial premise does not reach the gate as written**, and this revision therefore records no discharge (§1.1). **Clause 3's blocker is a live defect**: `req.user` carries no `sub` key in any of the three middlewares, and five sites read `req.user?.sub` and persist `undefined` (§1.2). **Track G4's precondition is NOT satisfied** (§2). **Records that F-Auth-5 alone blocks clause 3** — CZ-5 is done, Step 6b is deferred by name and separable (§1.3). Records the fifth and sixth instances of v2.51 §4's pattern, and **corrects v2.49 §2.4's gate count forward: 36 is a floor, not a total** (§4.1). Derived from git against `origin/main` at `148698cb`. No live database contact and no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** — **OPEN, P0**, privilege half remediated and tested, issuance half untouched. **FD-63** and **FD-64** remain open. **Gate G3 — NOT DISCHARGED** (§1). Track G4 — **precondition NOT satisfied**; not entered (§2). Track G3 — OPEN. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. **Step 6 (CZ-5 + F-Auth-4 + F-Auth-5) is unexecuted** (§1.2). Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# PART I — THE GATE

# §1. Gate G3, read in full

**G3's defining text is `F-AUTH-1_Fix_Plan_v1.5.md:398`. It has four clauses.** No revision in this series has previously quoted more than one of them.

> **G3 — Self-review passed.** Every commit in the PR read end-to-end. Test coverage minimum: one authenticated + one unauthenticated test per sub-form. F-Auth-5 has its specific test (decisionLogs write persists matching `user_id`). Frontend interceptor handles `AUTH_REQUIRED` and `AUTH_INVALID_TOKEN` as distinct paths.

| # | Clause | State | Evidence |
|---:|---|---|---|
| 1 | Every commit in the PR read end-to-end | **Evidenced** | v2.47 §3 — all eleven CP diffs read line by line before staging; `compositions.js`'s 29 declarations enumerated individually |
| 2 | One authenticated + one unauthenticated test per sub-form | **MET** | `436a8772` — both halves, four sub-forms, with a negative control asserting 401 `AUTH_INVALID_TOKEN`; completed by `148698cb` |
| 3 | F-Auth-5's specific test — decisionLogs write persists matching `user_id` | **NOT MET, AND PRESENTLY UNMEETABLE** | §1.2 |
| 4 | Frontend interceptor handles `AUTH_REQUIRED` / `AUTH_INVALID_TOKEN` as distinct paths | **MET** | `frontend/src/services/api.js:82` (wipe + redirect) and `:98` (refresh once), covered by `api.test.js` Cases A and B |

**Clause 3 binds this gate, and the scoping was checked rather than assumed.** `v1.5:31` folds F-Auth-5 in as *"a sub-step of Step 6"* of this plan; `v1.5:64` gives Step 6's file list as `BookEditor.jsx:173–186` + `middleware/auth.js:256–293` + **`decisionLogs.js:22`**. F-Auth-5 is F-AUTH-1's own scope, not another finding's requirement borrowed into a shared table.

## §1.1 The ruling, and why it does not reach the gate

**A discharge ruling was given by JAWIHP / Evoni**, on the evidence reported at v2.51 §5 and completed at `148698cb`. **It is recorded here so the register is not silent about it.**

**It was given against v2.47 §4.1's quotation of G3** — *"Test coverage minimum: one authenticated + one unauthenticated test per sub-form"* — which is clause 2, accurately quoted, and one of four. Every revision since inherited that quotation as though it were the gate.

**A ruling made against a partial premise does not reach the gate as written.** This is not a reversal and there is nothing to reverse: the ruling disposes of clause 2, which is met. **It does not reach clauses 1, 3 and 4, because those were not before the ruler.** Clauses 1 and 4 turn out to be satisfied; clause 3 does not.

**The discharge is therefore not recorded.** The ruling stands available to be re-made against G3's full text once clause 3 is met, and the evidence for clauses 1, 2 and 4 carries forward unchanged.

## §1.2 Clause 3's blocker — the mechanism

**Clause 3 is not a missing test for working behaviour. The behaviour it names does not work.**

**`req.user` has no `sub` key.** All three middlewares in `src/middleware/auth.js` build it identically — `authenticateToken:235`, `optionalAuth:339`, `requireAuth:510` — each assigning `id: decoded.sub` and no `sub`. **`git log -S "sub:" -- src/middleware/` returns no commit**, at any indentation, that ever added or removed such a key.

**Five sites read `req.user?.sub` and persist the resulting `undefined`:**

| Site | Written value |
|---|---|
| `src/routes/decisionLogs.js:22` | `user_id: req.user?.sub` |
| `src/controllers/cursorPathController.js:22` | `userId: req.user?.sub` |
| `src/controllers/iconCueController.js:22` | `userId: req.user?.sub` |
| `src/controllers/musicCueController.js:20` | `userId: req.user?.sub` |
| `src/controllers/productionPackageController.js:22` | `userId: req.user?.sub` |

A sixth site, `src/routes/thumbnails.js:81`, reads `req.user?.sub || req.user?.id || 'system'` and is unaffected — **the only one that hedges across both spellings is the only one that works.**

**This is not a regression.** `req.user?.sub` entered `decisionLogs.js:22` at **`7ae309f2` (2026-02-08)**, the file's original commit, written exactly as it stands. **The site has read an unpopulated key since that commit.**

**What is established:** the mechanism, from source and history. **What is not established:** the state of any `decision_logs` row. No database was contacted, prod is FROZEN, and **the age figure is a claim about code, not about rows.** How many writes occurred, and what the `user_id` column holds for them, is **unmeasured**.

**The drift is live and dominant.** `req.user?.sub` appears in 6 files; `req.user?.id` in 26. **Clause 3 cannot be met by writing a test; the test would fail.** It is blocked on the sub-step `v1.5:31` schedules to close exactly this drift — **F-Auth-5, and F-Auth-5 alone** (§1.3).

**This revision records the defect because it is clause 3's blocker and therefore the reason the discharge is withheld. It does not mint it.** The mint — an FD number, the five-site enumeration as a finding, the remedy question, and the relationship to F-Auth-5's scheduled fix — belongs to its own revision, on the split v2.49 §5 used for the credential-custody finding.

## §1.3 Step 6's actual status — F-Auth-5 is the only blocker

**"Blocked on Step 6" would be too wide, and the distinction matters to whoever authorizes the fix.** `v1.5:64` gives Step 6 as three sub-steps. They are in three different states.

| Sub-step | State | Evidence |
|---|---|---|
| **CZ-5** — `sendBeacon` → `fetch` + `keepalive` | **DONE** | `frontend/src/components/BookEditor.jsx:58` carries `keepalive: true`, with the explanatory comment at `:45`. **`sendBeacon` appears nowhere in `frontend/src/`.** |
| **F-Auth-4** — reconcile `requireAuth` / `authenticateToken` with the frontend interceptor | **PARTIAL** | Frontend half done — that is clause 4 at §1, met. **Backend half deferred by name:** `src/middleware/auth.js:484` states *"The duplicate `authenticateToken` implementation is removed in a later **Step 6b**."* `authenticateToken` remains live in `activityController`, `notificationController`, `presenceController` and `socketController`. |
| **F-Auth-5** — close the `req.user.sub` / `req.user.id` drift | **NOT DONE** | §1.2 |

**Only F-Auth-5 blocks clause 3.** Step 6b — removing the duplicate `authenticateToken` — gates nothing currently open and is separable.

**An authorization aimed at clause 3 should name F-Auth-5, not Step 6.** Naming Step 6 would sweep in a deferred sub-step that no open item requires, and turn a bounded reconciliation across six files into a three-part project.

---

# PART II — CONSEQUENCE

# §2. Track G4 — precondition not satisfied

**Track G4's stated precondition at v2.47 §4.1 is *"the minimum is met."*** Clause 3 is unmet. **The precondition is not satisfied and Track G4 must not be entered.**

This is a stronger bar than v2.51 §5's posture, which held G4 pending a ruling. **It is now pending a defect fix**, and no ruling can supply what clause 3 asks for while the behaviour is broken.

## §2.1 Prospective — what a G4 soak would and would not establish

**Retained from this revision's earlier draft and unchanged in substance, because it will apply whenever G4 is eventually entered, and recording it before the run is the point.**

**A green soak would establish:** that `requireAuth` executes across the 95 handlers promoted at `8ba2b95c` under sustained real traffic; that the promotion introduced no runtime break, ordering fault, or middleware-resolution failure of the kind the FD-63 static tests cannot catch; and that the four edit shapes behave identically in a deployed environment.

**A green soak would NOT establish that the authentication surface is closed.** It exercises the *mechanism* by which credentials are checked, not the *scarcity* of credentials. While the issuance half of FD-65 is open, any party may obtain a valid token and pass every check the soak observes passing. **A soak in which every request is authenticated and every authenticated request is anonymous is a green soak.**

**It would also not establish clause 3.** A soak observes that requests succeed; it does not inspect what they persist. The five sites at §1.2 would write `undefined` throughout a green soak without producing a single error.

---

# PART III — DISCIPLINE

# §3. Register scope, and entailment as its exception

> **An authorization's enumeration governs the artifact under audit. A ledger of owed items governs the register's own obligations. Discharging a ledger obligation is not an artifact change and requires no authorizing revision.**

**Proof.** Gate G3's own tests discharged the minimum owed at v2.47 §4.1, and **no revision authorized writing them.** If authorization were required to discharge a ledger obligation, that obligation would have been unfulfillable from the moment it was recorded. The tests were written, merged at `436a8772`, and no revision has suggested they were unauthorized.

**Scope.** v2.50 §1's *"anything not listed here is not authorized"* binds changes to `src/`. It does not reach `tests/` work discharging an item the register already accepts.

**The exception, where discharge touches behaviour:**

> **An edit outside an authorization's enumeration rides with the authorized change if executing that enumeration exactly and nothing else would leave the build red. If the authorized change merely enables or suggests the further edit, it is creep and stays out.**

**Worked instance.** v2.50 §1 authorized deleting `/test-token` and listed no test edit, because v2.50 §5 wrongly held the route had no caller. `auth.integration.test.js` asserted it returned 200. Executing §1 alone left the build red — `Expected: 200 / Received: 404` — and the replacement 404 guard shipped with the change at `75ac05f0` as footprint, not creep.

**The two rules are ordered, not parallel.** Register scope is the general case. Entailment is the narrow exception, and applies only where discharging an obligation changes what the system does.

---

# §4. The discipline extends to prose — and the fifth instance

> **v2.51 §4's rule governs any claim that could be read as answering a broader question than it does. A summary sentence is an instrument.**

v2.51 §4 records four instruments and is written in the vocabulary of probes. **That framing is too narrow.** The failure is a property of claims, not of greps.

**Proof.** A summary of this program's work stated that the sweep at `8ba2b95c` left *"95 handlers genuinely authenticated."* Defensible word by word; **false in effect**, because `/login` issues a token to anyone who asks, so requiring a token is not requiring authentication. Nothing in §4 as written would catch it, because the claim was not the output of a search.

## §4.1 The fifth and sixth instances

**v2.47 §4.1 quoted G3 as *"Test coverage minimum: one authenticated + one unauthenticated test per sub-form."* The quotation is accurate. It is one clause of four.** v2.48, v2.49, v2.51 and this revision's own earlier draft each inherited it as though it were the gate, and the earlier draft discharged a four-clause gate citing one clause.

**This instance differs from the other four in kind, and the difference is the point.**

The first four were failures of record: a probe or a claim answered a narrower question than it was read as answering, and the correction was a correction to a document. **This one closed the last remaining check on a live defect.**

**The loop, stated in full:**

1. `v1.5:31` and `:64` **scheduled** the fix for the `req.user.sub` / `req.user.id` drift as Step 6, naming `decisionLogs.js:22`.
2. **Step 6 was never executed.**
3. **G3 clause 3 asked for the test** that would have exposed the consequence — *decisionLogs write persists matching `user_id`*.
4. **v2.47 §4.1's quotation dropped clause 3**, and four documents inherited the quotation.
5. **The test was never written**, so nothing surfaced the defect.
6. **The site has read an unpopulated key since `7ae309f2` (2026-02-08).**

**That is not four failures. It is one failure with four points at which it could have been caught, and the quotation closed the last of them.** Every prior instance of this pattern cost a correction. **This one cost the only mechanism that would have surfaced a live defect**, and it was caught by reading the gate rather than by anything the system did.

### The sixth instance — v2.49 §2.4's gate count, corrected forward

**v2.49 §2.4 records *"36 `authorize([...])` gates across 11 route files."*** That enumeration was produced by a search **scoped to `src/routes/` and matching the spelling `authorize(`**. `src/middleware/auth.js:466` aliases `authorizeRole = authorize`, and controllers gate with the alias — `activityController`, `notificationController`, `presenceController` and `socketController` each do. **Those gates were not counted.**

**Corrected forward: 36 is a floor, not a total. The true number is unmeasured, and none is offered here.** The four controllers above surfaced while reading `authenticateToken` usage for §1.3, not from a search for the alias — so there may be gates using `authorizeRole` in files that never mention `authenticateToken`. **Producing a count from that incidental evidence would repeat the error being recorded**, and v2.51 §4's rule forbids it: the search that found these cannot see the ones it was not looking for.

**What this does not change.** The remediation at `75ac05f0` closed caller-supplied `groups`, which closes escalation to **any** such gate regardless of how many exist. **The correction is to the enumeration, not to the remedy.** v2.49 §2.4's substantive point — that the audit trail sat behind the credential an intrusion would supply — is unaffected, since `auditLogs.js` is inside the counted set either way.

### On where these two came from

**Both are this series' own.** The fifth was a quotation inherited from v2.47 §4.1; the sixth an enumeration written at v2.49 §2.4. **Four of the six recorded instances now originate inside the documents that state the discipline.**

That is the discipline working — none of these was found by an external check — and it is simultaneously a measure of how readily the pattern reproduces, including in documents whose explicit subject is the pattern. **Both readings are correct and neither should be used to dismiss the other.**

**Scope.** The rule applies to revision text, PR bodies, commit messages and summaries — every place a claim is recorded. **It applies with particular force to quotations of normative text**, where the excerpt becomes the operative rule for everyone downstream who does not re-read the source, and to **enumerations presented without their scope**, where the count becomes the population.

---

# PART IV — LEDGER

# §5. Discharged since v2.51

| Item | Origin | Discharged by | Where |
|---|---|---|---|
| The `/login` privilege-half test | v2.51 §2 obligation 6; §6 item 1 | `tests/integration/f-auth-1-fd65.test.js` | `148698cb` (PR #1046) |

**v2.51 §6 item 7 — the Gate G3 discharge ruling — is NOT discharged.** A ruling was given (§1.1) and does not reach the gate. The item remains open and is carried at §6.

# §6. Open and carried forward

| # | Item | Origin | Blocked on | Owner |
|---:|---|---|---|---|
| 1 | **Gate G3 clause 3** — decisionLogs `user_id` test | v1.5:398; §1.2 | Item 2 — the test would fail today | — |
| 2 | **F-Auth-5 alone** — the `sub`/`id` reconciliation. The only Step 6 sub-step blocking clause 3; CZ-5 is done and Step 6b is separable | v1.5:31, :64; §1.3 | An authorizing revision naming **F-Auth-5**, not Step 6 | — |
| 2b | **Step 6b** — remove the duplicate `authenticateToken`, live in four controllers | `auth.js:484`; §1.3 | Nothing currently open; separable | — |
| 3 | **The `req.user?.sub` defect** — five sites persisting `undefined`; recorded, unminted | §1.2 | Its own minting revision | — |
| 4 | The Gate G3 discharge ruling, re-made against the full text | v2.51 §6 item 7; §1.1 | Items 1 and 2 | — |
| 5 | The issuance decision — FD-65 cannot close without it | v2.50 §3 | Item 8; all three options are projects | — |
| 6 | Credential-custody finding — XK-shaped, recorded, unadmitted | v2.49 §5 | A ratifying revision | — |
| 7 | `JWT_SECRET` rotation | v2.49 §7 | Item 8 | — |
| 8 | The environment read — what `JWT_SECRET` dev and prod hold | v2.49 §5, §7 | Infrastructure access; prod FROZEN | **JAWIHP / Evoni** (v2.50 §7) |
| 9 | FD-63's probe half — §21's G1 detects one of four miss shapes | v2.43 §2.3; v2.47 §5 | — | — |
| 10 | FD-64 — `getRolesForshow` casing; `Model.update()` without `where` | v2.48 §2 | An authorizing revision | — |

**Ten of eleven open items carry no owner.** The column is left blank rather than filled with a plausible name, **because the blanks are the finding.** The ledger grew from six items to eleven in the course of reading one gate's full text and then scoping what it blocks.

---

# PART V — CLOSING

# §7. Numeral disambiguation

- **Gate G3 is NOT discharged.** **Track G3** is the deployment track and remains OPEN. **Track G4's precondition is not satisfied.**
- **The ruling at §1.1 was given and is recorded.** It disposes of clause 2. It does not discharge the gate, because clauses 1, 3 and 4 were not before it. **This is not a reversal**; nothing in it is withdrawn.
- **"Changes no gate" is restored to the footer.** This revision's earlier draft dropped that line because it recorded a discharge. **It records none, and the line returns.** A reader comparing drafts should note the line tracks the act, not the topic.
- **The gate sequence's own count is unresolved.** `v1.5.md` §6.1 is headed **"The Seven Gates"** and its table lists **six** (G1–G6). Every revision in this series, including this one, has cited *"v1.5's six-gate sequence."* **The heading and the table disagree**, and this revision does not settle which is correct — whether the heading is wrong or a gate is absent from the table is its own investigation. **Recorded as an observation, unresolved.**
- **FD tail remains FD-65**; **XK tail remains XK-3.** Nothing is minted.

# §8. What this revision establishes

- **Gate G3 has four clauses. Two are met, one is evidenced, one is unmet** (§1).
- **The discharge ruling was given against a one-clause quotation and does not reach the gate as written; no discharge is recorded** (§1.1).
- **Clause 3 is unmeetable, not merely unmet: `req.user` has no `sub` key, and five sites persist `undefined`** (§1.2).
- **The site at `decisionLogs.js:22` has read an unpopulated key since `7ae309f2` (2026-02-08). This is a claim about code age; the rows are unmeasured** (§1.2).
- **The drift is live in 6 files against 26. Of Step 6's three sub-steps, CZ-5 is done, F-Auth-4 is partial with Step 6b deferred by name at `auth.js:484`, and F-Auth-5 alone blocks clause 3** (§1.2, §1.3).
- **v2.49 §2.4's "36 gates" was scoped to `src/routes/` and the `authorize(` spelling; controllers gating via the `authorizeRole` alias were uncounted. 36 is a floor; the true count is unmeasured and none is offered. The remedy at `75ac05f0` is unaffected** (§4.1).
- **Track G4's precondition is not satisfied** (§2).
- **A soak would establish neither that the surface is closed nor clause 3** (§2.1).
- **The fifth instance of v2.51 §4's pattern closed the last check on a live defect, rather than costing a correction. A sixth is recorded alongside it. Four of the six now originate inside the documents that state the discipline** (§4.1).
- **v1.5 §6.1's heading and table disagree on the number of gates. Unresolved** (§7).
- **Ten of eleven open items are unowned** (§6).

# §9. What this revision does not do

- **Ships no code. Mints nothing** — no FD, no XK, no PE. **Changes no gate.**
- **Does not discharge Gate G3**, and does not reverse or withdraw the ruling at §1.1.
- **Does not mint the `req.user?.sub` defect** (§1.2, §6 item 3), authorize Step 6, or propose a remedy for either.
- **Does not enter Track G4**, whose precondition is not satisfied. **Track G5 remains BLOCKED.**
- Does not close FD-63, FD-64 or FD-65. **FD-65 remains OPEN and P0.**
- Does not settle v1.5 §6.1's six-versus-seven discrepancy (§7).
- Does not select an issuance option, assign an owner to any item at §6, or authorize the environment read.
- **Does not offer a corrected gate count.** §4.1 establishes that v2.49 §2.4's 36 is a floor and declines to name a total, because the evidence that surfaced the omission cannot bound it.
- **Does not authorize F-Auth-5, Step 6b, or any part of Step 6** (§1.3, §6 items 2 and 2b).
- Does not edit any prior revision's body. §1.1 supersedes v2.47 §4.1's quotation **forward**; §4.1 extends v2.51 §4 and corrects v2.49 §2.4 **forward**.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact and no request issued to any deployed host.** Derived from git against `origin/main` at `148698cb`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-18. Main at `148698cb`. Predecessor: v2.51.*
*Type: Gate reading. **Withholds the Gate G3 discharge** — the gate has four clauses, one unmet and presently unmeetable, and the ruling given reached only the clause that was quoted. Records clause 3's blocker as a live defect without minting it. Track G4's precondition not satisfied. Records the fifth instance of the v2.51 §4 pattern, the first with a cost rather than a correction. Ships no code. Changes no gate. Mints no FD, no XK, no PE. Tail: FD-65, OPEN, P0. XK tail: XK-3. No live database contact. [skip-automerge]*
