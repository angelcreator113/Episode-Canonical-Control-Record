# F-Deploy-1 Fix Plan v1.33

**FD-56 DECIDED 2026-07-10, maintainer call under Rule 7: the FD-45 remediation window takes the NEW-APP-USER path — a non-master application user is created on `episode-control-dev` and the dev app moves onto it; FD-56 closes by dissolution when the window executes. The window is SCHEDULED BY READINESS GATE, not by date: it opens at the first fresh session AFTER the pre-window app-user gate (§4.1) verifies clean (form and rationale in §4.4). The v1.29 §5 dev leg is amended to the decided shape: a pre-window grant-verification gate is staged ahead of the window, step 7's IAM mismatch is restated as a planned policy write per FD-58, and master rotation lands as the window's final step, touching nothing app-facing by then. This revision schedules and decides; it EXECUTES NOTHING — the pre-window gate and the window each carry their own draft→confirm cycle, and the freeze amendment ratifies inside the window's, not here. Two corrections to the scheduling argument's record are logged (§3). One parked candidate is retired by a recorded read (§5.1); the other is explicitly deferred to v1.34 (§5.2). Mints no FD — v1.29 §3 assigns the follow-on mint to the window's execution revision. Register tail unchanged: FD-58.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.32 (P1 executed/closed; merged #918, ab3db94a) |
| **Author start date** | 2026-07-10 |
| **Status** | DRAFT v1.33 |
| **Gate effect** | Decides FD-56's path (maintainer confirm recorded §2). Schedules the FD-45 remediation window (§4). Advances no execution gate; fires no write; authorizes no prod-box action; ratifies no freeze amendment — ratification remains a step inside the window's own confirm cycle (v1.29 §5, retained). Re-enablement of `deploy-dev.yml` remains untaken, unproposed, unaffected. |

**Basis (live reads 2026-07-10, third working session of the date; zero writes fired by this revision's authoring):**

- `git show origin/main:docs/audit/F-Deploy-1_Fix_Plan_v1.29.md` — full body. §3 (FD-56 + corollary) and §5 (seven-step dev leg) are the contract this revision decides against; both quoted in-session verbatim before argument.
- `git show origin/main:docs/audit/F-Deploy-1_Fix_Plan_v1.28.md` — §3 (FD-55 + FD-45 rider), §4 (decision (b)), §5 (frontier), read because v1.29 §3 cites them.
- `git show origin/main:docs/audit/F-Deploy-1_Fix_Plan_v1.18.md` — FD-45 mint stanza, read to ground the burn-provenance correction (§3.2): FD-45's minted surface is `~/.pm2/dump.pm2` plaintext-credential-at-rest, not a transcript disclosure.
- `git grep -n -E 'secrets\.(EC2_HOST|EC2_SSH_KEY|DEV_EC2_HOST|EC2_KEY|SSH_KEY)' origin/main -- .github/workflows` — exit 0, 7 hits, ALL in `deploy-production.yml` (decisive `secrets.<NAME>` form per the v1.32 check discipline). Bare-name sweep corroborates: zero consumers outside `deploy-production.yml`; `deploy-dev.yml`'s single bare-name hit is the DEV_EC2_HOST retirement comment.
- `git log --oneline origin/main` — HEAD ab3db94a (#918, v1.32); revision chain enumerated live, v1.33 confirmed next.
- **Maintainer confirms — provenance recorded in two stages (2026-07-10).** Stage one, IDE structured-decision dialog: path = "New-app-user" (selected), window date = "2026-07-10" (freeform), prod-key candidate = "Defer to v1.34" (selected). Stage two, in-channel ratification after the maintainer raised a gate-integrity challenge on the dialog answers' provenance: path RATIFIED as new-app-user; the dialog's date answer SUPERSEDED by the maintainer's own in-channel ruling — no calendar date in the register, schedule by readiness gate (§4.4). The confirm of record is the in-channel ratification; the dialog is its antecedent, kept for provenance. The challenge-and-answer is itself part of this basis: a register whose confirms can be pre-written has decorative gates, and this record shows the confirm was demanded in words, not inferred.

## §1 Purpose

Decides FD-56 (path: new-app-user) and schedules the FD-45 remediation window by readiness gate (§4.4 — no calendar date), amending the v1.29 §5 dev leg to match the decision. Logs two corrections to the scheduling argument's own record. Disposes both v1.32 §4 parked candidates: one retired by recorded read, one deferred explicitly. Scheduling and executing are separate gates; this revision is the scheduling gate only.

## §2 FD-56 decision — new-app-user

**Decision (maintainer, Rule 7, 2026-07-10): the FD-45 remediation window takes the new-app-user path. A dedicated non-master application user is created on `episode-control-dev` with the grants the dev app requires (Sequelize migrations need real DDL privileges); the dev app's consumers — both `.144` trees, the dev-box `.env`, `DEV_DB_PASSWORD`, and the `episode-metadata/dev/database` secret — move onto it inside the window; the master `postgres` password is rotated as the window's final step, by which point rotation touches nothing app-facing. FD-56 closes by dissolution when the window executes: after the move, no dev-credential rotation ever again requires a frozen-box write.** This supersedes v1.29 §5 step 1's "decided at window draft" — the decision is taken here, at the scheduling revision, under the same maintainer confirm; the window draft inherits it.

**The argument, both sides (per v1.29 §3's corollary — "the argument that will decide the window"):**

| Axis | Master-rotation | New-app-user |
|---|---|---|
| FD-56 | Survives — stays open or accepted-risk | **Closes by dissolution** |
| Least-privilege (§3 corollary; AD/AE/AF family) | Violation persists | Retired on this surface |
| Future rotations | Each re-opens the frozen box, re-ratifies the amendment | Never touch `.144` again |
| In-window risk | Lower — one `modify-db-instance` | Grant risk — under-granted user fails migrations mid-window |
| P3 secret contents | Master creds seed `episode-metadata/dev/database` — perpetuates the FD-56 pattern into the new architecture | App-user creds — **the secret is born clean** |

The decisive row is the last: P3 seeds the secret the entire §4.3 SSM/OIDC rewrite reads from (v1.30–v1.31). Seeding it with master credentials bakes the coupling FD-56 names into the architecture built to escape it. The grant-risk row — the master-rotation path's one genuine advantage — is neutralized by the pre-window verification gate (§4.1): the window flips consumers onto a *proven* credential instead of discovering grant gaps mid-atomic-unit.

**Counter-argument, addressed rather than skipped: G2 §4.5 retires the `.144` dev app eventually, dissolving the coupling from the other side — why pay grant-risk now?** Because (a) §4.5 is unscheduled and the rotation is owed now at dev-leg priority (v1.29 §4.1: burned is burned); (b) the least-privilege violation exists independent of `.144` — the dev-box app authenticates as master too, and §4.5 does nothing about that; (c) waiting couples the FD-45 tail's close to an unscheduled contract step, inverting priority. The costs were weighed with the argument's other side on the table, not around it.

FD-56's rotation obligation is NOT blurred by this decision: the master password gets rotated regardless (at-rest exposure per FD-45's mint surface; burned-is-burned discipline). What the path changes is what the rotation *disrupts* — after the move, nothing. Two problems, solved in sequence, by one window.

## §3 Corrections to the scheduling argument's record

Both surfaced by the register read; logged so the decision's record carries its own repair, per FD-53 discipline (a verification's authority does not extend past what it verified; neither does an argument's).

**3.1 — Freeze-amendment symmetry.** The argument as first staged claimed the new-app-user path "needs no freeze amendment." Wrong per v1.29 §5's unconditional "Steps 2–3 require a freeze amendment": the transition that *installs* the app user is itself the `.144` two-tree `.env` write + pm2 restart — the exact action signature the freeze exists because of. The amendment ratifies in-gate on either path. What the paths actually differ on is **recurrence**: master-rotation re-opens the frozen box at every future rotation; new-app-user makes this ratification the last one the dev credential ever requires.

**3.2 — Burn provenance, and a scope exclusion.** The argument as first staged conflated two burns. The 07-04 item is the **canon** db_password rotation (carried since v1.21) — a separate database and a separate obligation, and it is **explicitly excluded from this window**: folding a canon-DB write into a dev-leg gate is scope contamination; it gets its own gate. The dev-side obligation rests on (a) the dev-box transcript disclosure (v1.28 §3 rider; answered v1.29 §4.1 — matches nothing inspectable, plausibly authenticates to nothing, dev-leg priority not incident priority) and (b) the FD-45 at-rest surface (dump.pm2, minted v1.18 — serializes process env in plaintext; contents never digested). The master's exposure is at-rest, not a live transcript burn. §4.2's blast-radius collapse is exactly why scheduling-not-firing was the register-consistent posture at v1.29 — and why the window now fires under a deliberate gate rather than incident pressure.

## §4 FD-45 remediation window — scheduled by readiness gate, dev leg amended

### 4.1 Pre-window gate (its own Rule 7 cycle, ahead of the window)

Create the application user + grants on `episode-control-dev`, then verify. **Honesty note: the creation is a gated RDS WRITE** (CREATE ROLE + GRANTs against a live instance), not a free read — it gets its own draft→confirm. Its risk class is low-and-non-breaking (a new user appearing breaks nothing running; no existing credential changes; no `.144` contact), which is why it can stage ahead of the window rather than inside the atomic unit. The verification leg IS a read: from the dev box, under the new user's credentials, confirm the migration surface (`npx sequelize db:migrate:status` or equivalent) resolves cleanly — proving DDL grants before any consumer flips. Grant shape at that gate's draft: full privileges on the `episode_metadata` database and its schema objects sufficient for Sequelize DDL (CREATE/ALTER/DROP on schema `public`), NOT superuser, NOT `rds_superuser` unless the verification proves it necessary — if it does, that finding is recorded at the gate, not absorbed silently.

### 4.2 The window (atomic unit, amended from v1.29 §5)

1. ~~Rotate master / create app user~~ → **DONE PRE-WINDOW** (§4.1); window opens against a proven credential
2. Update `.144` `.env` in BOTH trees (episode-metadata + episode-metadata-parallel — v1.29 §4.4) to the app-user credentials
3. `pm2 restart` the dev app on `.144`; confirm reconnect under the new user
4. Seed `episode-metadata/dev/database` with the **app-user** credentials (FD-55(b) executes here; the secret is born clean per §2)
5. Overwrite `DEV_DB_PASSWORD` GitHub secret (retires the v1.29 §4.1 residual ambiguity)
6. Rewrite dev-box `/home/ubuntu/.env` to the app-user credentials
7. **IAM policy write (planned step, per FD-58 — restated from v1.29's "flagged follow-up"):** the role policy has NO secretsmanager statement (v1.30, verified live twice); the mismatch is guaranteed, not conditional. Write the scoped secret-read statement (additive-second-policy pattern per v1.32 P1 precedent), then verify: secret readable from the dev box; app reconnects everywhere
8. **Rotate `episode-control-dev` master password** (`modify-db-instance --master-user-password`) — final step; by now no consumer authenticates as master, so the rotation disrupts nothing app-facing. Verify both apps still healthy after. The burned-value obligation and the at-rest exposure both retire here

Steps 2–3 require the freeze amendment — **ratified inside this window's own draft→confirm cycle, with brief dev downtime accepted deliberately at that confirm** (v1.29 §5, unchanged; §3.1 above records that this is path-independent). Amendments carried from the 07-10 aborted draft remain in force: per-char password generation with replacement; temp-file secret-string (no stdin file:// on Windows awscli); hash-only verification (v1.29 §4.3 — raw values never in shell state or transcript, 12-char sha256 prefixes only). Collision-gate analogue for this window: if any consumer inspection at window-open shows an identity other than the §4.1-verified app user in a flipped position, abort and re-gate.

### 4.3 What the execution revision owes

The window's execution revision (v1.34 or numbered at authoring): as-executed record per house pattern; **mints the follow-on FD closing FD-56 by dissolution** (assigned there by v1.29 §3 — "its execution revision mints the follow-on FD; this revision pre-empts nothing"); records the freeze amendment's ratification text; closes FD-55(b) as executed; moves FD-45's dev leg to done, leaving the FD-45 tail's remaining scope (canon rotation, its own gate per §3.2) explicit.

### 4.4 Schedule — readiness-gated, not dated

**The window is scheduled for the first fresh session after the pre-window app-user gate (§4.1) verifies clean.** No calendar date appears in this register, by maintainer ruling: the window's real precondition is not a date but the §4.1 verification landing green — until it passes, whether the window CAN run is unknown (an under-granted user failing Sequelize mid-atomic-unit is the one failure mode inadmissible inside a step that touches the frozen box). A named date would be a guess about the grant's cooperation dressed as a commitment; if the grant needed a second pass, the register would carry a missed date — noise. The readiness-gated form cannot miss: it is true whenever the window runs. It also satisfies "a day you can watch it" by construction — the window does not open until the prerequisite is green AND the maintainer sits down fresh and chooses to start, accepting the dev downtime at that session's confirm. Any date the maintainer wants for personal planning lives in a calendar, not here. (A same-day schedule was answered in the antecedent dialog and superseded in-channel — see basis; the gates were never conflated, and this form removes even the compression.)

## §5 Parked candidates (v1.32 §4) — dispositions

**5.1 — EC2_HOST/EC2_SSH_KEY workflow grep: RETIRED by recorded read.** Decisive-form grep (`secrets.<NAME>`, per the v1.32 secret-retirement discipline) against origin/main workflows: `secrets.EC2_HOST` and `secrets.EC2_SSH_KEY` have live consumers ONLY in `deploy-production.yml` (7 hits — env injection, base64-decoded key file, scp/ssh targets). Zero consumers in `deploy-dev.yml` (its single bare-name hit is the DEV_EC2_HOST retirement comment) or anywhere else. Disposition: prod-scoped, inside a runtime-disabled workflow; no dev-leg contact; action belongs to the eventual prod-workflow review, not this window. Observation noted for that review, not acted on here: `deploy-production.yml` line 351 passes `secrets.PRODUCTION_DATABASE_URL` inline through an ssh command string.

**5.2 — Shared `episode-prod-key` (FD-56-species at transport layer): DEFERRED to v1.34, explicitly.** The candidate is real — one key pair opens both prod and dev boxes — but its disposition (separate dev key pair vs recorded acceptance; mitigant: FD-57's SSM path removes deploy-time SSH, residual is human ad-hoc SSH) is orthogonal to the dev-credential window, and folding a key-pair decision into this revision is the same scope contamination §3.2 bars for canon. Named here so the deferral is a record, not a drop.

## §6 Retained

- Fix Plan v1.29 §5 as amended by §4.2 above; v1.29 §§2–4, §6–§8 in full otherwise. v1.30 (FD-57/FD-58, §4.3 rewrite gate), v1.31 (rewrite-draft record, P1–P5), v1.32 (P1 closed) in full.
- G2 Implementation v1.3 as G2 contract, with all standing corrections (v1.28 FD-54; v1.29 §6; v1.30 §4.3 rewrite gate).
- Freeze posture for prod actions outside ratified gates: unchanged (v1.20, verbatim). The window's amendment, when ratified, amends the freeze for the window's dev-leg steps 2–3 only, inside that gate — nothing here pre-ratifies it.
- FD-45: OPEN (tail item; minted v1.18). This revision schedules its dev-leg remediation; the canon leg is explicitly out of this window's scope (§3.2) and remains carried.
- FD-56: OPEN, path decided (§2). Closes at window execution, minted-by-dissolution at the execution revision.
- FD-55: decision (b) stands; execution = window step 4.
- P2–P5 (v1.31 §4): untouched by this revision; P2 (OIDC role) remains the natural next enablement action on the workflow axis, independent of this window.

## §7 Register hygiene

- Register tail at v1.33 open: FD-58 (v1.30). Minted here: none. Tail at close: FD-58.
- FD numbers minted only by Fix Plan revisions — conforms (the follow-on mint is assigned to the execution revision, per v1.29 §3).
- Closes no findings. FD-56 gains a decided path, not a state change; FD-45 gains a readiness-gated window schedule, not a state change.
- Doc-only revision. No code, config, box, RDS, IAM, or canon contact beyond the read-only basis.
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #911–#918 — are historical; no close/fix/resolve adjacent forms).
- Ships with `[skip-automerge]`.

---

*End of F-Deploy-1 Fix Plan v1.33 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-10.*
