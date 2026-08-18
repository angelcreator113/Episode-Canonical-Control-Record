| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Gate ruling. Changes Gate G3.* |
| --- |

**Document version**

v2.52 — **RECORDS GATE G3 DISCHARGED. CHANGES A GATE. MINTS NOTHING. SHIPS NO CODE.** FD tail remains **FD-65 (F-AUTH-1)**; XK tail remains **XK-3**. **Gate G3 is discharged**, on the ruling of JAWIHP / Evoni, on the evidence reported at v2.51 §5 and completed at `148698cb`. **Track G4's precondition is thereby satisfied. Track G4 is not entered** (§2). States two disciplines — register scope with entailment as its exception, and the extension of v2.51 §4 to prose (Part II). Carries the ledger forward, **five of six open items unowned** (Part III). **FD-65 remains OPEN and P0; the issuance half is untouched.** Derived from git against `origin/main` at `148698cb`. No live database contact and no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** — **OPEN, P0**, privilege half remediated and tested, issuance half untouched. **FD-63** and **FD-64** remain open. **Gate G3 — DISCHARGED** (§1). Track G4 — precondition satisfied, **not entered** (§2). Track G3 — OPEN. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# PART I — THE RULING

# §1. Gate G3 — discharged

**Gate G3 is discharged.** The ruling was made by **JAWIHP / Evoni**. **This revision is where it enters the register**, and its provenance is stated at §7 so that no reader has to look for a citable record elsewhere: there is none, and this document is the ruling's durable form.

**The evidence it rests on**, reported at v2.51 §5 and unchanged:

- **Both halves for all four miss shapes**, on `main` at `436a8772`.
- **A negative control** on the authenticated half — a structurally valid HS256 token signed with the wrong secret returns 401 `AUTH_INVALID_TOKEN`, the verifier-rejection code, distinct from `AUTH_REQUIRED` and `AUTH_INVALID_FORMAT`, which never reach the verifier. Without it, four assertions of *"not 401"* would prove nothing.

**And completed since.** v2.51 §2 obligation 6 recorded a coverage gap: nothing asserted that an anonymous `POST /login` sending `groups: ['ADMIN']` fails to yield an ADMIN token. **That gap is closed at `148698cb`** (PR #1046) by `tests/integration/f-auth-1-fd65.test.js`, which asserts the echoed groups, the *signed* groups, a 403 `AUTH_GROUP_REQUIRED` against `auditLogs.js:18`'s gate, and a control showing that gate still admits a genuine ADMIN.

**93 tests across seven suites pass**, verified against `origin/main` at `148698cb`.

**Why the sequence mattered.** Before `148698cb`, "the minimum is met" was ambiguous between a literal reading — the tests G3's language names exist and pass — and a stronger one, that the escalation FD-65 records is covered by its direct negative before G4 touches a deployed environment. **Landing the privilege test first collapsed the ambiguity: the minimum is now met under both readings, so the ruling does not depend on which is taken.**

**Discharged: v2.51 §6 item 7** (this ruling) and **v2.51 §6 item 1** (the privilege test).

---

# §2. What the discharge does and does not authorize

**Track G4's stated precondition at v2.47 §4.1 — *"the minimum is met"* — is satisfied.**

**Track G4 is not entered by this revision.** A precondition being satisfied is not a decision to proceed, and G4 is dev verification plus a two-hour soak: **the first deployed-environment contact in this program.** Two considerations keep it a separate decision, and neither blocks it:

- **FD-65's issuance half is open.** An anonymous caller still obtains a valid `['USER']` token from `/login`.
- **The environment read has not been taken.** Nobody has established what `JWT_SECRET` dev and prod hold (v2.49 §5). Prod is FROZEN; **dev is not.**

## §2.1 Prospective — what a G4 soak would and would not establish

**Recorded before G4 runs, so that its result cannot later be read for more than it is.**

**A green soak would establish:** that `requireAuth` executes across the 95 handlers promoted at `8ba2b95c` under sustained real traffic; that the promotion introduced no runtime break, ordering fault, or middleware-resolution failure of the kind the FD-63 static tests cannot catch; and that the four edit shapes behave identically in a deployed environment.

**A green soak would NOT establish that the authentication surface is closed.** It exercises the *mechanism* by which credentials are checked, not the *scarcity* of credentials. While the issuance half of FD-65 is open, any party may obtain a valid token and pass every check the soak observes passing. **A soak in which every request is authenticated and every authenticated request is anonymous is a green soak.**

**This is v2.51 §4's pattern with a two-hour runtime attached**, and it is written here rather than after the fact because that is the discipline §4 states — see §4 below for its extension to exactly this kind of claim.

---

# PART II — DISCIPLINE

# §3. Register scope, and entailment as its exception

> **An authorization's enumeration governs the artifact under audit. A ledger of owed items governs the register's own obligations. Discharging a ledger obligation is not an artifact change and requires no authorizing revision.**

**Proof.** Gate G3's own tests discharged the minimum owed at v2.47 §4.1, and **no revision authorized writing them.** If authorization were required to discharge a ledger obligation, that obligation would have been unfulfillable from the moment it was recorded — v2.47 §4.1 owed tests, and no document permitted their creation. The tests were written, merged at `436a8772`, and no revision has ever suggested they were unauthorized.

**Scope.** v2.50 §1's *"anything not listed here is not authorized"* binds changes to `src/`. It does not reach `tests/` work that discharges an item the register already accepts. The privilege test at `148698cb` needed no v2.52-in-advance for the same reason.

**The exception, where discharge touches behaviour:**

> **An edit outside an authorization's enumeration rides with the authorized change if executing that enumeration exactly and nothing else would leave the build red. If the authorized change merely enables or suggests the further edit, it is creep and stays out.**

**Worked instance.** v2.50 §1 authorized deleting `/test-token` and did not list any test edit, because v2.50 §5 wrongly held the route had no caller. `tests/integration/auth.integration.test.js` asserted it returned 200. Executing §1 alone therefore left the build red — `Expected: 200 / Received: 404` — and the replacement 404 guard shipped with the change at `75ac05f0` as footprint, not creep.

**The two rules are ordered, not parallel.** Register scope is the general case and answers most work. Entailment is the narrow exception and applies only where discharging an obligation changes what the system does.

---

# §4. The discipline extends to prose

> **v2.51 §4's rule governs any claim that could be read as answering a broader question than it does. A summary sentence is an instrument.**

v2.51 §4 records four instruments — a grep, an enumeration, an exclusion, and a truncated search — and is written in the vocabulary of probes. **That framing is too narrow.** The failure it describes is not a property of greps; it is a property of claims.

**Proof.** A summary of this program's work stated that the sweep at `8ba2b95c` left *"95 handlers genuinely authenticated."* Every word is defensible: the handlers do carry `requireAuth`, and `requireAuth` does execute. **It is nonetheless false in effect**, because `/login` issues a valid token to anyone who asks, so requiring a token is not requiring authentication. The accurate form is the one v2.49 §3 uses: **95 handlers moved from open to open-to-anyone-who-first-calls `/login`.**

**Nothing in v2.51 §4 as written would catch that**, because the claim was not the output of a search. A reader applying §4 to their own prose would be extending it rather than following it.

**Scope.** The rule applies to revision text, PR bodies, commit messages, and summaries — every place a claim is recorded — and not only to searches. §2.1 above is its first prospective application: the soak's result is described in advance in terms of what it can and cannot establish, rather than summarised afterward in terms that would overstate it.

---

# PART III — LEDGER

# §5. Discharged since v2.51

| Item | Origin | Discharged by | Where |
|---|---|---|---|
| The Gate G3 discharge ruling | v2.51 §6 item 7 | Ruling of JAWIHP / Evoni | §1 of this revision |
| The `/login` privilege-half test | v2.51 §2 obligation 6; §6 item 1 | `tests/integration/f-auth-1-fd65.test.js` | `148698cb` (PR #1046) |

# §6. Open and carried forward

| # | Item | Origin | Blocked on | Owner |
|---:|---|---|---|---|
| 1 | The issuance decision — FD-65 cannot close without it | v2.50 §3; v2.51 §6 item 2 | Item 4; all three options are projects requiring a dependency addition | — |
| 2 | Credential-custody finding — XK-shaped, recorded, unadmitted | v2.49 §5; v2.51 §6 item 3 | A ratifying revision | — |
| 3 | `JWT_SECRET` rotation | v2.49 §7; v2.51 §6 item 4 | Item 4 | — |
| 4 | The environment read — what `JWT_SECRET` dev and prod hold | v2.49 §5, §7 | Infrastructure access; prod FROZEN | **JAWIHP / Evoni** (v2.50 §7, not delegated) |
| 5 | FD-63's probe half — §21's G1 detects one of four miss shapes | v2.43 §2.3; v2.47 §5 | — | — |
| 6 | FD-64 — `getRolesForshow` casing; `Model.update()` without `where` | v2.48 §2; v2.51 §6 item 6 | An authorizing revision under the adjudicate → ship → close cycle | — |

**Five of six open items carry no owner. That column is left blank rather than filled with a plausible name, because the blanks are the finding.** Two of the unowned items — the issuance decision and FD-64's defects — are the only paths by which FD-65 and FD-64 respectively can close. **An item with no owner does not progress, and the register's function is to make that visible rather than to imply motion.**

---

# PART IV — CLOSING

# §7. Numeral disambiguation

- **Gate G3** is **DISCHARGED** by this revision. **Track G3** is the deployment track and remains **OPEN**. They are different objects and both appear above.
- **Provenance of the ruling.** It was made by **JAWIHP / Evoni**, in the course of this work, and **this revision is its only durable record.** That is not the posture of v2.51 §5, which reported evidence and expressly declined to rule for want of authority. **The difference is authority, not evidence:** §5 had the same evidence and no standing; this revision carries a ruling that was given. A reader asking where the ruling lives should stop here.
- **"Discharge" retains two senses**, per v2.51 §7. An **obligation** is discharged by being *answered* (§5's table). A **gate** is discharged by being *ruled* (§1). This revision does both, in different sections.
- **This revision changes a gate.** Every F-AUTH-1 revision from v2.48 through v2.51 carried *"Changes no gate"* in its footer. **This one does not, and the omission is deliberate** — a reader scanning footers for that phrase should notice its absence rather than assume it.
- **FD tail remains FD-65**; **XK tail remains XK-3.** Nothing is minted.

# §8. What this revision establishes

- **Gate G3 is discharged**, on Evoni's ruling, on v2.51 §5's evidence completed by `148698cb` (§1).
- **The ruling does not depend on which reading of "minimum met" is taken**, because the privilege test closed the gap that separated them (§1).
- **Track G4's precondition is satisfied; G4 is not entered** (§2).
- **A green G4 soak would establish that the mechanism works and would not establish that the surface is closed** — recorded prospectively (§2.1).
- **Discharging a ledger obligation requires no authorizing revision; entailment is the narrow exception where it changes behaviour** (§3).
- **v2.51 §4's discipline governs prose, not only probes** (§4).
- **Five of six open items are unowned** (§6).
- **FD-65 remains OPEN and P0. The issuance half is untouched by anything recorded here.**

# §9. What this revision does not do

- **Ships no code.** **Mints nothing** — no FD, no XK, no PE.
- **Closes no finding.** Not FD-63, not FD-64, not FD-65. Discharging Gate G3 is not closing a finding, and §7 distinguishes the two.
- **Does not enter Track G4**, notwithstanding that its precondition is now satisfied (§2). **Track G5 remains BLOCKED.**
- Does not select an issuance option, assign an owner to any item at §6, or authorize the environment read.
- Does not admit v2.49 §5's credential-custody finding or authorize `JWT_SECRET` rotation.
- Does not authorize any change to `src/`. §3 states when authorization is required; it grants none.
- Does not edit any prior revision's body. §4 extends v2.51 §4 **forward**; §3 generalises the rule adopted during the `75ac05f0` remediation **forward**.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact and no request issued to any deployed host.** Derived from git against `origin/main` at `148698cb`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-18. Main at `148698cb`. Predecessor: v2.51.*
*Type: Gate ruling. **Changes Gate G3 — owed → discharged**, on Evoni's ruling, of which this revision is the only durable record. Track G4's precondition satisfied; G4 not entered, with the soak's reach recorded prospectively. States register scope with entailment as its exception, and extends v2.51 §4's discipline to prose. Carries the ledger with five of six items unowned. Ships no code. Closes no finding. Mints no FD, no XK, no PE. Tail: FD-65, OPEN, P0. XK tail: XK-3. No live database contact. [skip-automerge]*
