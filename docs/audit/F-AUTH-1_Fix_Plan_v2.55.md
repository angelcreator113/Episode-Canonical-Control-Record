| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Closure revision. **DISCHARGES GATE G3.*** |
| --- |

**Document version**

v2.55 — **CLOSURE REVISION. DISCHARGES GATE G3.** Closes the F-Auth-5
remediation (§1), transcribes the before/after pair (§2), records Gate G3
clause 3's closure and **makes the discharge ruling withheld at v2.52 §1.1**
(§3). Discharges all three obligations recorded at
`F-AUTH-1_v2.55_Owed_Index_2026-08-19.md` §1, and Owed Index §2 item 4. FD
tail is **FD-66 — MINTED P0 at `eb3bd70d`**; XK tail remains **XK-3**.
Analysis derived from git against `origin/main` at
`c61a0a9d621cbdf9f0ad00a8fd35e235c0d7c55e`. Local test database contacted at
the cited runs; **no request issued to any deployed host.**

> **CORRECTION BANNER - Sec 3.2's Track G4 precondition finding is WITHDRAWN (added 2026-08-20, after `3569162a`, additive).**
> Sec 3.2 records *"Track G4 - precondition SATISFIED, not entered"*, and the Status field carries the same. **That is false. Track G4's precondition is NOT satisfied and Track G4 is not enterable.** The discharge of Gate G3 at Sec 3.1 is unaffected and stands.
>
> - **Track G3 is not Gate G3, and Track G3 is OPEN.** v2.37 Sec 5.71 defines Track G3 as *"adjudicator-driven audit pass over CP1-CP12 cumulative work; verify G1-G6 still hold post-merge-resolution + cleanup-delete; production-readiness assessment for G4."* Limb 2 was discharged at v2.42 Sec 1.4. **Limbs 1 and 3 have never been attempted** - recorded as not discharged at v2.42 Sec 2.3, v2.42 Sec 5, v2.43 Sec 4.3, and v2.44, and recorded as discharged nowhere.
> - **Limb 3 is the production-readiness assessment for G4.** The clause whose function is to authorize G4 entry is one of the two never attempted. Gate G3's four-clause discharge does not reach it.
> - **This revision dropped Track G3's status rather than closing it.** v2.39 through v2.53 carried Track G3's status in fifteen consecutive revisions - OPEN, then pending re-validation per v2.43 Sec 4.3. v2.54 carries zero mentions. This revision's single occurrence is the Sec 5 glossary line defining the label, not a status. **A reader grepping `Track G3` here gets a hit and no disposition.**
> - **What stands:** Sec 1, Sec 2, Sec 2.1, Sec 2.2, Sec 3, **Sec 3.1 including the Gate G3 discharge ruling**, Sec 4, Sec 4.1, Sec 5, and Sec 6's non-establishments. Only Sec 3.2's precondition finding and the Status field's Track G4 clause are withdrawn.
>
> **The error's shape, recorded because it is a recurrence of this register's own diagnosis.** Sec 3.2 did not misread v2.47 Sec 4.1 - that section's minimum genuinely is Gate G3 clause 2, and clause 2 genuinely is met. **It read one precondition as the precondition.** That is structurally identical to the failure v2.52 Sec 1.1 diagnosed one level down: *"A ruling made against a partial premise does not reach the gate as written."* The register named that shape, wrote it up, and committed it again three revisions later at a higher level. **Documenting a hazard class does not retire it.**
>
> **Namespace note, not a ruling.** *"Gate G3"* appears first at v2.47 and 66 times through v2.55. **It is defined** - v2.47, v2.48, v2.49, v2.51 and v2.52 each disambiguate it from Track G3 explicitly, as *"F-AUTH-1's v1.5 six-gate sequence - Self-review passed, the gate carrying the test minimum"* against *"the deployment track."* **What was never done is binding it into v2.38 Sec 2.2's lock**, which names only `CP12-G<n>` and `Track G<n>`. That formalization belongs to a ratifying revision.
>
> The original prose is preserved verbatim below as the at-filing record. Do not read it as current; read this banner plus Sec 3.1 as the corrected finding.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged.
**FD-65** — **OPEN, P0**, untouched. **FD-63**, **FD-64** — open, untouched.
**FD-66** — MINTED, OPEN; 27 of 28 broken models untouched. **Gate G3 —
DISCHARGED** (§3.1). **Track G4 — precondition SATISFIED, not entered**
(§3.2). Track G5 — **BLOCKED** per v2.43 §4.2. Prod remains FROZEN; confirm
freeze status live before any prod-touching action.*

---

# PART I — THE CLOSURES

# §1. F-Auth-5 remediation — CLOSED

**Discharges Owed Index §1 item 2.**

**The authorization.** `F-AUTH-1_Fix_Plan_v2.53.md` §1: *"Authorizes F-Auth-5
only. Not Step 6, not Step 6b."* Restated at v2.53 §5: *"This revision
authorizes F-Auth-5 and nothing else — not Step 6, not Step 6b."*

**This discharges v2.52 §6 item 2's blocker, and it discharged it at v2.53 —
not here, and not at `ed3461c5`.** That blocker reads *"an authorizing
revision naming F-Auth-5, not Step 6."* v2.53 is a revision and names F-Auth-5
by name. **`ed3461c5` is the commit executing under that authorization; it is
not the authorization.** A commit's subject line naming F-Auth-5 is an artifact
self-attributing, which the standing discipline excludes from register
authority. **v2.55 records this as already-discharged history. It does not
claim the discharge.**

**The condition.** `ed3461c5` reconciles `req.user?.sub` to `req.user?.id` at
all six sites v2.53 §1 authorized, `thumbnails.js:81` included as site 6.
v2.54 §2.2 states it directly: *"Item 2 — F-Auth-5 — closed at `ed3461c5`."*

**The ruling, made here.** The authorization exists, the condition is met, and
nothing between `ed3461c5` and this revision's basis re-opens either.
**F-Auth-5 remediation is CLOSED.** This is the ruling v2.54 §5 bullet 2 and
§6 bullet 3 assigned to v2.55, and it is what *available to make is not made*
was reserving.

## §1.1 What §1 does not close

- **`POST /api/v1/thumbnails/:id/publish` remains broken** — Axis A, eight
  absent columns per v2.54 §2.3. **Same file as site 6, different finding.**
  One route carries an actor-attribution site now reconciled and a schema
  defect not touched. They are not one thing.
- **Three threads `ed3461c5` leaves open**, per the Owed Index correction
  banner: the third blind spot at v2.53 §1.1 — call sites outside `src/` —
  searched once, returning a stale comment at
  `tests/unit/middleware/auth.test.js:83` asserting `req.user.sub`, left
  unchanged as outside the authorization; and the commit's explicit exclusion
  of Step 6b, CZ-5, and any `src/middleware/` change. **Recorded here, resolved
  nowhere. F-Auth-5's closure does not reach them.**

---

# §2. The before/after pair — transcribed

**Discharges Owed Index §1 item 1.** v2.54 §2 item 4 requires both records *in
the closure revision*; the work landed at `956697c0` (migration) and
`16c47a5f` (test), and transcription — not re-derivation — was the outstanding
act.

**Run-time basis.** `origin/main` at
`8a537c9c401c63dc5698fc1df94ad79f2e8d5daf`, read at run time per v2.54 §2 step
1, not quoted from v2.54.

**BEFORE** — no migration applied, `deleted_at` confirmed ABSENT via
`information_schema`; 2 of 2 test cases failed:
```
- "error": undefined,       + "error": "column \"deleted_at\" does not exist",
- "status": 201,            + "status": 500,
```
The second test case failed at its `DecisionLog.findOne`, **after** its 401 and
`AUTH_REQUIRED` assertions had passed — anonymous refusal already worked; what
was broken was the instrument verifying absence.

**AFTER** — migration applied, test unchanged: **2 of 2 passed.**

## §2.1 The count, reconciled against v2.54 §2.1's three assertions

**The figure counts test cases, not assertions. All three assertions were
exercised on both sides; none was skipped.**

- **Test case 1** — authenticated POST, bundling assertion 1 (persisted
  `user_id` non-null and not the string `'undefined'`) and assertion 2 (equals
  `req.user.id` as the middleware sets it).
- **Test case 2** — anonymous POST, carrying assertion 3 (no row persisted).

**Recorded because the mismatch is readable as a gap and is not one.** A
closure record reporting *2 of 2* against a three-assertion specification
invites the reading that assertion 3 went unexercised. `16c47a5f`'s body
forecloses it: test case 2 ran pre-migration and failed **at its absence-check,
not at its 401/`AUTH_REQUIRED` assertions**, which had already passed.

## §2.2 The `down` verification — already discharged, not re-litigated

**Owed Index §1 item 3 is WITHDRAWN by that index's own correction banner
(added 2026-08-19, after `65c8f6d4`).** `956697c0`'s body records step 2b as a
gate: `information_schema` read after each phase gave PRESENT (timestamptz,
nullable, default NONE) → ABSENT after `db:migrate:undo` → PRESENT with
identical shape after re-apply, no residue, exit code explicitly disclaimed as
the method.

**v2.55 records the discharge and does not re-run it.** The index's own
reasoning governs: a fresh green `down` would test the artifact and leave the
process question untouched. **The precedent-setting migration's gate was
exercised and recorded. Nothing about v2.54 §1.2's precedent is open.**

---

# §3. Gate G3 — clause 3 closed, gate DISCHARGED

**Discharges Owed Index §2 item 4** (FD-66 §5.1: *"The closure record belongs
to v2.55"*).

**Clause 3 is met on `main` at `19b31b1d`.** `decision_logs` persists actor
attribution matching the middleware-mapped principal, and anonymous callers
persist nothing. The enabling migration is `956697c0`; the demonstration is
`16c47a5f`, transcribed at §2.

**The relationship, cited rather than inferred.** `16c47a5f`'s body states it:
*"clause 3 becoming met is a consequence, the discharge is a ruling, and it is
v2.52 section 6 item 4, whose last blocker this clears without making it."*

## §3.1 v2.52 §6 item 4 — the discharge ruling, MADE

**The four clauses, re-read against v2.52 §1's full text and verified on
current `main`:**

| # | Clause | State | Basis |
|---|---|---|---|
| 1 | Every commit in the PR read end-to-end | **Evidenced** | v2.47 §3 — all eleven CP diffs read line by line. Historical, non-decaying. |
| 2 | One authenticated + one unauthenticated test per sub-form | **MET** | `436a8772`, completed `148698cb`. Both verified reachable in history. |
| 3 | F-Auth-5's specific test — decisionLogs `user_id` | **MET** | `956697c0` + `16c47a5f`, on `main` at `19b31b1d`. §2 above. |
| 4 | Frontend interceptor — distinct `AUTH_REQUIRED` / `AUTH_INVALID_TOKEN` paths | **MET** | `api.js:82`, `:98` — **re-verified unchanged in location and content on current `main` this session**, not inherited from v2.52's read. |

**The governing citation is v2.53 §4, not an inference.** v2.53 §4 names this
exact combination as the sufficient premise: *"G3's four clauses become 1
evidenced, 2 met, 3 met, 4 met — at which point the discharge ruling withheld
at v2.52 §1.1 can be re-made against the full text."* **Clause 1 remaining at
*evidenced* rather than escalating to *met* is the specified state**, not a
shortfall. v2.53 declined to make the ruling itself: *"It does not discharge
G3. That is a ruling, not a consequence."*

**v2.53 held that premise as a forward-looking consequence of §1 landing.
Clause 3 is now independently confirmed met, not predicted. Nothing regressed
on clauses 1, 2, or 4 between `148698cb` and this revision's basis.**

**Ruling: GATE G3 IS DISCHARGED.**

**One clause's evidence is live, not historical.** Clauses 1 and 2 are facts
about commits and cannot decay. **Clause 4 is a property of a file that can
change.** Its evidence is this session's re-verification of `api.js:82`, `:98`,
which is what the discharge rests on. **A later regression at those lines does
not reopen a discharged gate of its own force** — it would be a new finding,
requiring its own instrument. Recorded so neither error is available: treating
the gate as self-healing, or treating a discharged gate as a permanent warranty
about a live file.

## §3.2 Track G4 — precondition satisfied, NOT entered

**Per v2.52 §2, the minimum for Track G4 is met.** **Satisfied is not
entered.** Entering G4 is a separate act with its own authorization, and this
revision does not perform it, authorize it, or schedule it.

**PE #14 remains the owner of the `origin/main..origin/dev` gap** — 81 commits
divergent as of `baa2f10d`, content divergence on the swept route files **not
established** by hash comparison. Per FD-66 §1.2 lineage, per-file inspection
against `origin/dev` is owed **at** Track G4. **This revision does not
discharge it and does not begin it.**

---

# PART II — CARRIED

# §4. What v2.55 carries rather than closes

- **Owed Index §2 item 5 — the infrastructure read** at FD-66 §6.4.1.
  **Requires contacting a deployed host. Prod is FROZEN. Not attempted, not
  authorized here.** Carries forward unchanged.
- **FD-65 — OPEN, P0.** `POST /api/v1/auth/login` still issues signed tokens to
  unauthenticated callers. **The discharge of G3 does not touch it.**
- **FD-63, FD-64** — open, untouched.
- **FD-66 — OPEN.** 27 of its 28 broken models untouched, all 38 unclassified
  ones untouched. `decision_logs` left the Axis P set when `956697c0` landed.
- **`GET /api/v1/audit-logs` remains broken.** The control v2.49 §2.4 named as
  the one that would evidence an intrusion still returns 500.
- **Owed Index §5's parked questions** — FD-66 B5 first question (scope or
  absorb; a register decision, XK-1 owned by F-Stats-1), B5 second question
  (void), B4 (raised, not resolved). **Not obligations on this revision.**
- **PE #62** — lives in `Session_PE_Roster.md`, session-scoped, explicitly
  distinct from the Track 8 roster. **Not an F-AUTH-1 obligation.**

## §4.1 Figures this revision must not inherit

**Axis P is not 19.** FD-66 CORRECTION BANNER B1 (added after `79f9bab1`)
supersedes that figure three ways: 19 as filed by the wrong method, 13
corrected at the same basis, **12 corrected on `main` at 2026-08-18**.
`956697c0`'s own body predates B1 and carries the superseded phrasing.
**Where this revision cites Axis P, it cites 12 per FD-66 B1 row 3, naming the
banner. FD-66 §6.3.1's body still reads 19 and is not governed by its own
text.**

**The exposed-set figure moved 48 → 37 → 13** across `f3b1f3d9`, `afe13438`,
`2a744a92`, `1a00e947`. **Any inherited count in that family needs its basis
re-read**, not quoted forward.

**Rule applied, per Owed Index §3.1:** a pointer into a banner-carrying
document resolves to the banner first. Citations here take the form *"document
§N, as corrected by banner B"* or point at the banner.

---

# §5. Numeral disambiguation

**Five collisions live in this revision's own text.**

- **"Item 1" and "item 2" each denote two different obligations.**
  **v2.52 §6 item 1** = the Gate G3 clause 3 decisionLogs `user_id` test.
  **Owed Index §1 item 1** = the before/after transcription.
  **v2.52 §6 item 2** = F-Auth-5, condition closed at `ed3461c5`.
  **Owed Index §1 item 2** = the F-Auth-5 closure ruling, made at §1.
  **First reference must carry the list label in full.**
- **"Item 4" likewise.** **v2.52 §6 item 4** = the withheld discharge ruling
  (§3.1). **Owed Index §2 item 4** = the clause 3 closure record (§3).
  Different lists, adjacent sections.
- **v2.52 §6 item 2's blocker-discharge site is v2.53** — a third label,
  distinct from both the blocker and the commit. **The blocker, its discharging
  revision, and the commit executing under it are three things.**
- **v2.53 §1 and v2.53 §5** state the same authorization with different force:
  **§1 is the authorizing act; §5 is its restatement in v2.53's own ledger.**
  A citation to one is not a citation to the other.
- **Clause states are not interchangeable.** **Clause 1 is *evidenced*;
  clauses 2, 3, 4 are *met*.** v2.53 §4 specifies that asymmetry. Restating
  clause 1 as *met* would misdescribe the premise the discharge rests on.

Standing: **`CP12-G1`…`CP12-G6`** are CP12's retrospective verification greps;
**`Track G3`…`Track G6`** are forward deployment stages. Bare `G<n>` is
prohibited per v2.38 §2.2. **Numeric sort on all `v1.n` / `v2.n` filenames**;
`F-Deploy-1` and `F-Stats-1` both number `v1.n` and collide across most of the
range.

---

# §6. What this revision does not establish

- **Not that Track G4 is entered.** Its precondition is satisfied (§3.2).
  Entry is a separate act.
- **Not that the audit surface functions.** One route now works. Reading a
  green clause 3 alongside an open FD-66 as evidence of a working audit surface
  is the same shape as reading a green soak as security evidence.
- **Not that F-AUTH-1 is closed.** Backend Step 3 remains REOPENED-QUALIFIED;
  FD-63, FD-64, FD-65, FD-66 are open; Track G5 is BLOCKED and structurally
  gated on prod freeze.
- **Not that clause 4 is permanently true.** §3.1 records its live-evidence
  status.
- **Not any disputed figure.** §4.1 records bases; it picks Axis P = 12 on the
  banner's authority and picks nothing else.
- **No FD minted, closed, or reprioritized. No schema changed. No deployed host
  contacted. Prod FROZEN.**

---

*Type: Closure revision. **Discharges Gate G3** (§3.1). Closes the F-Auth-5
remediation (§1). Transcribes the before/after pair and reconciles its count
(§2). Records Owed Index §1 item 3 as discharged by that index's correction
banner (§2.2). Notes Track G4's precondition satisfied but not entered (§3.2).
Carries the infrastructure read, FD-63/64/65/66, and the parked questions (§4).
Ships no code. Mints nothing. FD tail: FD-66, MINTED. FD-65 remains OPEN, P0.
Local test database contacted at the cited runs; no deployed host contacted.
Prod FROZEN. [skip-automerge]*