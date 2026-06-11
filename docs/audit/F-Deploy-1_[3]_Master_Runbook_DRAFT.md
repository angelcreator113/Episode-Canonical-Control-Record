# F-Deploy-1 — [3] Combined-Restart Window: MASTER RUNBOOK (DRAFT v0.1)

> **ORCHESTRATION / PREP DOCUMENT. AUTHORIZES NO PROD-BOX ACTION BY ITSELF.**
> This sequences the existing canonical procedures into one execution-ordered runbook
> for [3]. It does not replace them and it invents no steps — every action traces to a
> source doc, cited inline. The dangerous prod commands (restart, credential rotation)
> are deliberately left un-templated here, exactly as the source docs require — assemble
> them at session time against live state, do not paste a mutation line out of any doc.
> [3] remains gated and is its own deliberate session, opened only after Phase 0 and
> Phase 1 below are GREEN. Reading this changes nothing on `episode-backend`
> (`54.163.229.144`, `i-02ae7608c531db485`).

| | |
|---|---|
| **Purpose** | Single execution-ordered map for [3] — the combined prod-restart window — assembling the four canonical procedures into phases, with one consolidated abort/rollback frame. |
| **Sources assembled** | (1) `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` (#750) — Phase 0. (2) `F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md` v1.4 (§3.1, §6.3, §7) — Phase 1 + Phase 2 credential steps. (3) `Track_B_PM2_Topology_Formalization_Plan.md` v0.2 — Phase 2 restart-to-align. (4) `F-Deploy-1_PROD_SplitBrain_HAZARD.md` — abort/restore frame + the do-not list. Plus `F-Deploy-1_PreFlight_Reverify_2026-06-02.md` — the gate-2.5 finding. |
| **Decision (a) — restart vehicle** | **A2: direct pm2/ecosystem; `Deploy to Production` stays disabled (AK path a).** This is what FD-31 v1.4 §6.3 + Track B v0.2 already specify — recorded here as ratified, not newly decided. See Sec 2. |
| **Status** | DRAFT v0.1 — orchestration only, no execution. The actual next executable step is Phase 0 (box-side credential reconcile), itself read-only-plus-one-gated-edit, NO restart. |
| **Standing constraint** | Box is one-keystroke-from-disaster. SSH discipline (HAZARD Sec 3 + #750 Sec 1) applies to every box-touching step: single read-only commands, NO `pm2 restart/reload/delete/stop/save/start/kill` outside the deliberate Phase 2 restart. |

> **Additive supersession (2026-06-10) — Strategy B code-reconcile folded in.**
> This runbook is extended to fold Strategy B's code reconciliation into the [3] window
> as **Phase 2A** (plus a pre-window off-box build). Prior revisions scoped the window as
> credential + topology + security only; that scope is now incomplete — the code
> reconciliation carries the window's newest risk-bearing mechanics (disk thin-margin,
> zero-swap operating caveat, parity gate) and belongs on the master phase map, not in a
> parallel "authoritative" sequence. The B track's method, gating, and constraints are
> bound into the Phase 2A gates from three 2026-06-10 artifacts:
> - `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md` — method, C1/C2 extract controls, abort posture.
> - `F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md` — disk/memory headroom; **disk is the binding axis** (thin-but-fits), zero-swap operating caveat.
> - `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md` — **B is the selected lean; C parked-not-killed.** Phase 2A assumes B; if the call ever reverts to C, this phase is replaced, not edited.
>
> No box action authorized; [3] not primed.

---

## Sec 0 — One-line + the headline this assembly surfaced

[3] is the combined prod-restart window that un-freezes prod properly. Reading the four
source docs together resolves one contradiction that must not be papered over:

**Gate 2.5 (durable credential on the box) is NOT currently green — it is UNVERIFIED.**
FD-31 v1.4 marks gate 2.5 GREEN on a 2026-06-01 live check ("the on-disk `.env` holds a
working canon `DB_PASSWORD`… a plain restart is a data-wise no-op by construction").
The **2026-06-02 re-verify** then found the *workstation* `.env` password FAILS canon
auth, and flagged that the **box's** `.env` — the file a restart actually reads — was
**never inspected** since 06-01. So FD-31 v1.4's "green" rests on a verification the
06-02 re-verify called into question. **This runbook treats gate 2.5 as unverified and
makes the #750 box-side reconcile a hard Phase-0 gate** — it does NOT inherit the
"no-op by construction" optimism.

Consequence (the useful one): **the real next executable step is not [3]. It is Phase 0
— the #750 box-side credential reconcile** — which is read-only except one gated `.env`
edit, with NO restart. Far lower stakes than the cutover, and it is what re-establishes
whether [3] can proceed at all.

## Sec 1 — The two restart-breaking landmines (read before any phase)

A prod restart reads `/home/ubuntu/episode-metadata/.env`. Two independent conditions in
that file can break the restart, and both are read from the box `.env` — which is the
current unverified unknown:

1. **Wrong DB host (split-brain).** HAZARD doc: historically the box `.env` pointed at
   the verified-EMPTY `episode-control-prod`; a restart would silently serve nothing.
   FD-31 v1.4 §6.1 reports this was corrected 2026-06-01 (`DB_HOST=episode-control-dev`,
   canon; FD-36). **But that was the same 06-01 read the 06-02 re-verify questioned** —
   so re-confirm `DB_HOST` live in Phase 0, do not trust it from a prior session.
2. **Stale credential (gate 2.5).** Even pointed at canon, if the box `.env` password is
   not the one canon accepts, the restart fails auth and comes up DB-disconnected — a
   fresh outage, the exact one [3] exists to prevent (PreFlight Sec 3.2).

Phase 0 inspects BOTH from the box `.env` in one read-only pass. Either landmine present
= correct it (gated, no restart) before [3] proceeds, or ABORT.

## Sec 2 — Decision (a): restart vehicle = A2 (recorded, doc-backed)

**Decision (a) ratified: A2 — direct pm2/ecosystem cutover. "Deploy to Production" stays DISABLED through [3]. AK path (b) is post-[3] cleanup.**

**Decision register (durable lock, 2026-06-03):** *(a) = A2, ratified 2026-06-03, user. Direct pm2/ecosystem; prod-deploy workflow disabled through [3]; AK (b) deferred post-[3].*

### FD-31 — Health counts are soft-delete-filtered; integrity gate uses unfiltered counts. Phase 1 baseline certified unfiltered across all 7 fingerprint tables.

Discovered during [3] Phase 2 confirm-live, 2026-06-03.

Context: `/health` (`app.js:313-316`) reports `showCount`/`episodeCount` as
`COUNT(*) ... WHERE deleted_at IS NULL` (live catalog). The Phase 1 integrity
baseline uses unfiltered `count(*)` (physical rows). All 7 fingerprint tables
carry `deleted_at`, so all are subject to the filtered/unfiltered distinction.

Certified figures (canon `episode_metadata`, server 10.0.20.224, 2026-06-03) -
total (unfiltered) / live (deleted_at IS NULL):
- shows 10 / 1
- episodes 72 / 18
- assets 64 / 24
- world_events 53 / 53
- wardrobe 40 / 40
- social_profiles 444 / 444
- franchise_knowledge 605 / 597

All `total` values match the Phase 1 handoff baseline -> baseline confirmed
unfiltered and internally consistent.

Decisions:
(a) Live catalog of 1 show / 18 episodes is INTENTIONAL. Sole active show is SAL
    (id 9bd0655f-0426-4da4-95b8-44cdfd608b2b, name "Styling Adventures with Lala",
    status active), verified 06-03. Other 9 shows / 54 episodes / 40 assets are
    intentionally soft-deleted scratch/test data.
(b) Integrity baseline remains UNFILTERED count(*): shows 10, episodes 72,
    assets 64, world_events 53, wardrobe 40, social_profiles 444,
    franchise_knowledge 605.
(c) Step-5 AG count-check is corrected to compare unfiltered count(*) against
    canon via direct read-only psql - NOT /health. /health is reclassified as a
    LIVENESS signal only (200 + database:connected); its filtered counts are
    explicitly NOT the integrity comparator.
(d) Step-5 gate query also asserts current_database() + inet_server_addr() so
    identity and integrity are verified in one read.
(e) ai_usage_logs is a volatile append-only counter: TRACKED but EXCLUDED from the
    hard data gate (weak as an abort fingerprint). Informational baseline only;
    see PreFlight Plan Sec 3.1.

Open backlog (non-blocking):
- franchise_knowledge has 8 soft-deleted entries - review before Director Brain /
  franchise_brain consolidation.
- SAL show row has placeholder description ("ffff...") and stale denormalized
  episode_count=0 - fix before user-facing launch.

**A2 — direct pm2/ecosystem restart; `Deploy to Production` workflow stays DISABLED
through [3].** Rationale, all from the source docs:

- FD-31 v1.4 §6.3 hands the restart (steps 5–6) to **Track B's restart-to-align**, which
  re-launches against the corrected #746 `ecosystem.config.js` via `--env production`
  (Track B v0.2 Sec 3–5). That is a direct pm2/ecosystem action, not a workflow dispatch.
- The AK finding's gate is satisfied for the window by **path (a)** — `Deploy to
  Production` disabled (taken 2026-06-02). AK-1/AK-2 (the workflow's `.env`/secret
  hazards) resolve only *at* cutover anyway, so routing [3] through the workflow buys
  nothing and re-arms FD-36. Direct pm2 sidesteps AK-1/AK-2 for the window entirely.
- The #746 ecosystem prod block is already corrected and live-verified (Track B v0.2;
  DB-3 confirmed the `.env`-load path comes up DB-connected).

So A2 = follow what FD-31 v1.4 + Track B already specify. The AK five-point path (b)
correction (incl. the open #752) becomes **post-[3] cleanup**, not an [3] prerequisite.

## Sec 3 — Phase map (execution order)

| Phase | What | Touches box? | Restart? | Source | Session |
|---|---|---|---|---|---|
| **pre-2A** | Off-box build to parity target (arch/libc HIGH, Node/npm best-known) | NO — workstation/build-host | NO | Parity Sequencing #767 Sec 3 | Pre-window prep; no box session |
| **0** | Box-side credential reconcile → re-establish gate 2.5 | Read-only SSH + at most one gated `.env` edit | **NO** | #750 runbook | **Next executable session** (low stakes) |
| **1** | Live abort re-verify (counts, snapshot, dump) | Read-only (workstation→canon RDS) | NO | FD-31 §3.1/§7 + PreFlight Sec 5 | At [3]'s own session start (fresh, untrusted from prior) |
| **AK** | Five-point gate satisfied via path (a) | n/a | NO | AK gate-status; this doc Sec 2 | Already in force (workflow disabled) |
| **2A** | Strategy B code reconcile: parity confirm gate → stream-extract built tree to a PARALLEL path → stand up parallel process; serving tree/process untouched | YES — additive only (parallel tree + process) | NO (additive; the flip is in 2B) | B Install-Method (C1/C2); Parity #767 (gate); Headroom (disk/swap); Selection-Lean (lean) | The [3] window — opens the box-mutating window, before cutover |
| **2** | Cutover (Phase 2B): cred rotation + restart-to-align + route fix + security sweep | YES — the one irreversible restart | **YES (once)** | FD-31 §6.3 steps 2–3 + Track B steps 5–8 | The [3] window itself — deliberate, backup-first |

**Phases 0 and 1 are GREEN-gates for Phase 2.** Phase 2 does not begin until Phase 0 has
re-marked gate 2.5 green AND Phase 1's live abort checks pass at the [3] session's own
start. Phase 0 can (and should) run as its own earlier, low-stakes session.

---

## Sec 4 — PHASE 0: Box-side credential reconcile (gate 2.5) — the next executable step

**Run the existing `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` (#750) verbatim.**
This runbook does not restate its commands — it points at #750 as the authority and
records the gate logic. Summary of what #750 does (its Sec 2–5):

1. **Confirm live state (read-only, workstation).** `git log` HEAD, `curl` prod `/health`
   = 200. If prod is not 200, that becomes the priority — STOP the reconcile (#750 Sec 2).
2. **Read the box credential state (read-only SSH, two one-shot commands) — #750 Sec 3:**
   - **3a** = `pm2 env 3 | grep -i db_password` → the WORKING in-memory credential prod
     is currently authenticating with (the known-good reference). Confirm id 3 is still
     the prod hotfix first (`pm2 list`, read-only) if unsure.
   - **3b** = `grep '^DB_PASSWORD=' /home/ubuntu/episode-metadata/.env` → what a restart
     would read.
   - **Also re-confirm landmine 1** while connected (read-only): `grep '^DB_HOST='
     /home/ubuntu/episode-metadata/.env` should show `episode-control-dev` (canon). This
     extends #750 to cover BOTH landmines per Sec 1 — the box `.env` host has not been
     re-confirmed since 06-01 either.
   - Optional canon triangulation (#750 Sec 3, file-based `PGPASSWORD`, never interactive
     prompt): the 3a value authenticates against canon; the workstation `.env` value
     (and 3b if different) does not.
3. **Compare (#750 Sec 3):**
   - **3a == 3b AND host == canon** → box `.env` is restart-safe. **Gate 2.5 GREEN.** No
     write. Skip to Sec 4 step 5.
   - **3a != 3b (stale credential)** → gated `.env` correction, #750 Sec 4.
   - **host != canon** → split-brain still live; this is HAZARD territory — STOP, do not
     proceed without re-reading the HAZARD doc.
4. **(ONLY IF stale) Correct the box `.env` — GATED MUTATION, #750 Sec 4.** Back up
   `.env` first (`cp .env .env.bak-YYYYMMDD`, read-only copy); replace only the
   `DB_PASSWORD=` line with the working value via a temp-file/here-doc method (password
   may contain `!!` etc. — never inline `sed` with the raw value, never echo to history);
   verify with `grep` + `diff` (only DB_PASSWORD changed). **Do NOT restart** — the
   corrected `.env` takes effect at Phase 2's deliberate restart. Rule 7: draft, confirm
   target (`/home/ubuntu/episode-metadata/.env`) + value twice, then execute.
5. **Record outcome + update gate 2.5 (#750 Sec 5).** Re-mark FD-31 gate 2.5 GREEN in a
   short doc/PR citing this reconcile; note whether a correction was made or `.env` was
   already good. **This is the content that fills the currently-empty #751 stub.** Record
   the CAUSE if the triangulation reveals it (PreFlight Sec 3.4 left open: canon pw
   rotated post-06-01 and `.env` not updated, vs `.env` edited wrong).

**Phase 0 output:** gate 2.5 re-marked GREEN for real (box `.env` holds a working canon
credential AND host = canon), or a precise red reason. No restart, no pm2 mutation.

## Sec 5 — PHASE 1: Live abort re-verify (at [3]'s own session start)

Per FD-31 §7 + PreFlight Sec 5 — **fresh, never trusted from a prior session, including
Phase 0's.** Read-only, workstation→canon RDS (the PreFlight Sec 1 method:
`PGOPTIONS=-c default_transaction_read_only=on`, never the on-box psql path).

| Check | Expected | Abort if |
|---|---|---|
| Content table counts | episodes 72, shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444, franchise_knowledge 605 | any mismatch → STOP |
| Table total | 143 | mismatch → STOP |
| `ai_usage_logs` | ~765+ (re-baselined; climbs with live traffic — NOT a fingerprint) | not an abort by itself |
| Snapshot `episode-control-dev-prefreeze-insurance-20260530` | `available` | absent → STOP |
| Verified dump `episode-control-dev-verified-20260530.dump` | present (~2.83 MB, off-repo `Documents\PrimeStudios-Backups\`) | absent → STOP |

Mismatch on the content counts or total = something changed since the catalog; understand
it before touching anything (FD-31 §7). This is itself an abort condition.

## Sec 6 — AK five-point gate (satisfied via path a)

Per this doc Sec 2 + the AK gate-status addendum: `Deploy to Production` is DISABLED
(path a, taken 2026-06-02) — the gate is satisfied for the [3] window. AK-1/AK-2 resolve
at cutover (they are the workflow's hazards; A2 doesn't use the workflow). AK-3/AK-4
corrections sit in OPEN PR #752 (not on main; not required for A2). AK-5 (orphaned
`scripts/deploy/`) is parallel-safe cleanup, not [3]-blocking. **No AK action is a Phase 2
prerequisite under A2.** The path (b) five-point correction is post-[3] cleanup.

## Sec 7A — PHASE 2A: Strategy B code reconciliation (the additive half of the window)

**Begins only after Phase 0 GREEN + Phase 1 GREEN — the same gates as 2B.** Phase 2A is
the opening of the box-mutating window: it stands up a PARALLEL checkout and a PARALLEL
process and does **not** touch the live-serving tree (id 3) or its process until the 2B
flip. That additivity is Strategy B's defining safety property — a free standing rollback —
and the reason B is the selected lean over Strategy C's destructive reset
(`F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md`). This phase assumes B.

**Pre-window (no box touch).** The off-box build is finalized before the window per the
parity sequencing note (`F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md` Sec 3): pin
build-host arch from AWS control-plane (HIGH), libc from recorded prod OS (HIGH), Node/npm
to best-known prior record (MEDIUM); `npm ci` against the committed lockfile; verify the
tree starts off-box. No prod box is touched to build. The only prod-directed pre-window
read is control-plane (arch), strictly weaker than the read-only SSH already taken.

Steps (the read-only probe is fenced; both mutations are left un-templated by design —
assemble at session time against live state, do not paste a mutation line from any doc):

1. **Parity confirm gate (read-only, at window open).** Inside the abort envelope, under
  the same SSH discipline as Phase 1, run the four-tuple probe:
   ```
   uname -m; ldd --version | head -1; node --version; npm --version
   ```
  Match all four against the build-host pins → proceed. **Mismatch any → CLEAN PRE-WRITE
  ABORT:** discard the off-box artifact, re-pin the drifted dimension (in practice Node/npm,
  the MEDIUM tier), rebuild off-box, re-attempt at a later window. **No box bytes are
  written on this abort** — it is the cheapest abort in the runbook. (Parity note Sec 4.)
2. **Disk precheck (read-only).** Confirm the writable volume still admits the ~1.1 GB
  second tree with margin. Per the headroom note (Sec 2), residual is ~1.4 GB on a single
  68%-used volume — **disk is the binding axis.** `df -h /` read; if residual will not hold
  the tree plus transient install/build peak → **ABORT before extract.** No partial extract.
3. **Stream-extract the built tree to a PARALLEL path — GATED MUTATION (un-templated).**
  Per the Install-Method note's C1/C2 controls. The transfer must be **piped straight into
  extraction with no intermediate tar persisted on the constrained volume** — this is
  load-bearing: a persisted-then-unpacked tar would make old-tar + extracting-tree coexist on
  disk and reintroduce the very transient peak the off-box method exists to remove (note Sec 0,
  Sec 2 step 3). Because there is no on-box `npm install` and no persisted tar, **the only bytes
  landing on the volume are the finished ~1.1 GB steady-state tree — peak collapses to steady
  state** against the ~1.4 GB residual (~0.3 GB slack, headroom Sec 2). The tree lands BESIDE
  the serving tree at a fresh parallel path (C1); it does **not** overwrite
  `/home/ubuntu/episode-metadata`. **Rule 7 — confirm the target is the fresh PARALLEL path and
  NOT the serving tree, twice.** (Method authority: `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`.)
4. **Stand up the parallel process — GATED MUTATION (un-templated).** A second process
  against the new tree, mirroring the existing id 0 second-app slot class (~159 MiB; fits
  with margin per headroom). **Zero-swap operating caveat:** there is no paging soft-landing
  — an overshoot past available is a hard OOM. Watch standup memory. This does **not** touch
  id 3 (live-serving). **Rule 7.**
5. **Verify the parallel process against canon (read-only).** Same identity + unfiltered
  integrity discipline as the 2B integrity gate (`current_database()` + `inet_server_addr()`
  + the seven-table unfiltered fingerprint), run against the parallel process's connection.
  id 3 is still the serving process; this proves the new process is canon-correct **before**
  any flip. Mismatch → ABORT before 2B; serving process untouched.

**Phase 2A output:** a reconciled parallel tree + a healthy parallel process running against
canon, with the live-serving tree and process untouched and retained as the standing
rollback. The flip onto the reconciled tree happens in Phase 2B step 5.

## Sec 7 — PHASE 2: The combined cutover window (the one irreversible restart)

**Begins only after Phase 0 GREEN + Phase 1 GREEN.** One prod restart for all of it, not
several (FD-31 §6.3 note; Track B v0.2 Sec 4 recommendation). Every step a Rule 7 boundary.
The restart and rotation commands are **left un-templated** — assemble at session time
against the live ecosystem config; do not copy a mutation line out of any doc (FD-31 §6.3
step 5 standing rule).

Execution order (FD-31 §6.3 steps 2–3 = credential; Track B steps 5–6 = restart; then 7–8):

1. **Confirm rollback in hand** (FD-31 §6.3 step 1): verified dump present + snapshot
   `available`; re-confirm live counts match Sec 5. Mismatch → ABORT.
2. **[FD-31] (Optional, hygiene) Rotate canon `-dev` password** (§6.3 step 2): generate
   locally; `aws rds modify-db-instance --region us-east-1 --db-instance-identifier
   episode-control-dev --master-user-password <NEW> --apply-immediately`; poll
   `PendingModifiedValues` empty. **Rule 7 — write to LIVE CANON; confirm the identifier
   is `episode-control-dev`, NOT `-prod`, twice.** (Skippable; if skipped, `.env` needs
   no change in step 3.)
3. **[FD-31] Write the new `DB_PASSWORD` into the box `.env`** (§6.3 step 3) if step 2 ran.
   `DB_HOST` is already canon (Phase 0 confirmed). Edit-without-restart is safe.
4. **(NO-OP) Schema port** (§6.3 step 4): nothing ports — all 37 prod-only tables NOT
   ported (FD-31 §4/§5.2). Migration-framework decision deferred to the post-audit
   rebuild; does NOT gate the cutover.
5. **[TRACK B] The controlled restart-to-align** (FD-31 §6.3 step 5 → Track B v0.2 Sec 3-5):
  the ONE irreversible action. Re-launch prod against the corrected #746
  `ecosystem.config.js` with `--env production` so PM2 reads the prod block (port 3000,
  not 3002 - F-Deploy-G1-H). **Hard Rule 7 stop even when self-initiated.** Assemble the
  command at session time from the live ecosystem config - do NOT paste a restart line
  from any doc.

  #### Step 5 — Post-restart integrity gate (AG gate)

  Run on the box, read-only, against canon. Do NOT use /health for this gate.

     export PGPASSWORD="$(grep '^DB_PASSWORD=' /home/ubuntu/episode-metadata/.env | cut -d= -f2-)"; PGOPTIONS='-c default_transaction_read_only=on' psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata -c "SELECT current_database() AS db, inet_server_addr() AS server, (SELECT count(*) FROM shows) shows, (SELECT count(*) FROM episodes) episodes, (SELECT count(*) FROM assets) assets, (SELECT count(*) FROM world_events) world_events, (SELECT count(*) FROM wardrobe) wardrobe, (SELECT count(*) FROM social_profiles) social_profiles, (SELECT count(*) FROM franchise_knowledge) franchise_knowledge;"; unset PGPASSWORD

  PASS iff ALL of:
  db = episode_metadata
  server = 10.0.20.224
  shows = 10, episodes = 72, assets = 64, world_events = 53,
  wardrobe = 40, social_profiles = 444, franchise_knowledge = 605

  Any deviation = ABORT + restore from snapshot. Do NOT fix forward.

  Separately, /health must return 200 + database:connected (LIVENESS check only).
  Its showCount/episodeCount are soft-delete-filtered (live catalog) and are NOT
  the integrity comparator - see FD-31.

  (ai_usage_logs is tracked informationally, not part of this hard gate - FD-31(e).)
  Under Strategy B, this "restart-to-align" is the additive **flip**: point serving onto
  the Phase 2A reconciled tree/process, not a re-launch of the old tree. The old tree +
  old process are **RETAINED** as the standing rollback — do NOT delete until 2B is
  confirmed green (Sec 8 gate passes). Assemble the flip at session time; un-templated.
6. **[TRACK B] Degraded-state cleanup / topology** (FD-31 §6.3 step 6 → Track B): confirm
   port 3000 (already correct via hotfix), the Template Studio route-loading bug
   (code/port-level — `template_studio` table exists on canon, FD-31 §5.3, so not a
   missing-table problem), and correct `pm2 save` / `dump.pm2` so resurrect reproduces the
   right topology (DB-1 keeps the `episode-api-prod-hotfix` name; DB-2 one shared worker).
7. **Re-enable + gate the disabled workflows** (FD-31 §6.3 step 7): `Deploy to Development`
   + `Auto-merge to Dev` (DISABLED 2026-05-30) — reconciliation-gated decision (HAZARD
   Sec 3 item 9). For `Deploy to Production`: re-enabling requires the AK five-point path
   (b) complete first (incl. merging #752 and finishing AK-1/AK-2/AK-5) — this is the
   post-[3] cleanup, NOT done in the [3] window itself.
8. **Post-cutover security sweep** (FD-31 §6.3 step 8): close `0.0.0.0/0` on the RDS SGs
   (F-Deploy-G1-AF, top priority — incl. canon `-dev`; confirm dev/staging SGs too);
   encrypt the insurance snapshot (currently unencrypted); migrate the box off static
   `AWS_ACCESS_KEY_ID`/`SECRET` in `.env` to an instance profile (F-Deploy-G1-AD/AE).

## Sec 8 — Consolidated abort conditions (hard stops — no judgment, just stop)

From FD-31 §7 + HAZARD + PreFlight, gathered:

- Phase 0: box `.env` `DB_HOST` != canon → split-brain live → STOP, re-read HAZARD.
- Phase 1: live content counts/total don't match the catalog → STOP, understand first.
- Verified dump counts don't match → backup untrustworthy → STOP.
- Live diff surfaces tables not in the matrix → STOP, classify.
- Phase 2A: parity four-tuple mismatch → CLEAN PRE-WRITE ABORT (discard off-box artifact,
  re-pin Node/npm, rebuild, retry a later window). Not a box-state abort — nothing written.
- Phase 2A: disk residual will not hold the ~1.1 GB second tree + extract margin at the
  precheck → ABORT before extract. **C2 cleanup mechanic:** any aborted or failed transfer must
  **remove its fresh target path before any retry** — a partial tree left in place strands up to
  ~1.1 GB and eats the ~0.3 GB slack, breaking peak==steady-state on the failure path (note Sec 3, C2).
- Phase 2A: OOM / memory pressure during parallel-process standup (zero swap = hard OOM,
  not paging) → ABORT standup, tear down the parallel process; live-serving id 3 unaffected.
- Phase 2A: parallel process fails the canon identity/integrity verify → ABORT before any
  2B flip; serving process untouched.
- Phase 2 post-restart: AG gate mismatch (`db`/`server` identity or any unfiltered
  fingerprint count) → ABORT IMMEDIATELY, restore from snapshot, do not "fix forward."
- Phase 2 post-restart: `/health` is non-200 or `database` is not `connected` → ABORT.
- Gate 2.5 not green when the restart is reached → STOP (do not restart with a `.env`
  that can't authenticate against canon).
- ANY uncertainty about which instance/host a command targets → STOP. The whole incident
  class is "the reach was implicit."

## Sec 9 — Rollback (two-deep, FD-31 §6.4)

At every mutable step, rollback = restore `episode-control-dev-prefreeze-insurance-20260530`
to a new instance and repoint, OR restore the verified logical dump
`episode-control-dev-verified-20260530.dump`. **Do not begin Phase 2 step 5 (the restart)
without BOTH confirmed.** Additionally, the additive-hotfix re-launch the 06-01 incident
used is recoverable exactly (the incident doc records the command) as an immediate
service-restore bridge if the restart-to-align misbehaves.

**Code-layer rollback (Strategy B's standing-rollback advantage).** Distinct from the DB
snapshot/dump rollback above, which covers the DATA layer. Under B, the old serving tree +
old process are retained through Phase 2A and the 2B flip; if the flip misbehaves, revert
serving to the retained old process (mechanics per the Install-Method note; un-templated,
assemble at session time). This is why B was preferred over C: C's `git reset --hard`
destroys the serving tree and has no equivalent in-window code-layer revert. Do not delete
the retained old tree/process until the 2B post-restart integrity gate passes green.

## Sec 10 — What this runbook does NOT do

- Does NOT authorize, schedule, or begin [3] or Phase 0. Each phase is its own gated step.
- Does NOT touch, restart, reboot, deploy to, or edit `.env` on the prod box.
- Does NOT provide paste-runnable restart or rotation commands (un-templated by design).
- Does NOT re-enable any disabled workflow.
- Does NOT rewrite the source procedures — it sequences and cites them; #750 / FD-31 v1.4
  / Track B v0.2 / the HAZARD doc remain the authorities for their respective steps.
- Does NOT finalize the AI-video-editing rebuild approach (FD-31 §4 — preserved, deferred).

## Sec 11 — Session boundaries (which work is which sitting)

- **Pre-Session-B prep (off-box, no box touch):** Off-box Strategy B build per the
  P1 parity sequencing note (`F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md` Sec 3).
  Build host pinned to best-known parity: arch HIGH (AWS control-plane), libc HIGH
  (recorded prod OS), Node/npm MEDIUM (best-known prior record). `npm ci` against the
  committed lockfile; verify the tree starts off-box BEFORE the window. The P1 parity
  four-tuple is *confirmed-or-aborted* at the Phase 2A parity gate (Sec 7A step 1) —
  a MEDIUM-tier mismatch aborts cleanly pre-write and the build is re-pinned + rebuilt.
  This ordering dependency (build provisioned before parity is confirmed) is recorded so
  a future session does not trip over it. [3]-spec item; authorizes nothing.
- **Session A (next, low stakes):** Phase 0 — box-side credential reconcile (#750).
  Read-only + at most one gated `.env` edit. No restart. Output: gate 2.5 green-for-real,
  #751 stub filled.
- **Session B (the [3] window, deliberate, backup-first):** Phase 1 live re-verify at its
  own start → Phase 2 combined cutover. The one irreversible restart. Opens ONLY with
  Phase 0 green and a fresh Phase 1 pass. Not a momentum-continuation of Session A.
- **Post-[3] cleanup (separate):** AK path (b) completion (merge #752, finish
  AK-1/AK-2/AK-5), `Deploy to Production` re-enable decision, `-prod` teardown, G2 §4.2
  memory gate, S4.2-B/S4.2-C.

---
*Master orchestration runbook for [3]. Assembles #750 (box-side credential reconcile,
Phase 0), FD-31 v1.4 §3.1/§6.3/§7 (abort re-verify + credential cutover), Track B v0.2
(restart-to-align), and the split-brain HAZARD doc (abort/restore frame) into one
execution-ordered map. Resolves the gate-2.5 contradiction: FD-31 v1.4 marks it green on a
06-01 check, the 06-02 re-verify questioned it and found the box `.env` uninspected — this
runbook treats it as UNVERIFIED and makes the #750 reconcile a hard Phase-0 gate. Records
decision (a) = A2 (direct pm2; workflow disabled), which is what FD-31 v1.4 + Track B
already specify. The next executable step is Phase 0 (read-only + one gated `.env` edit, no
restart) — NOT [3] itself. No invented prod steps; dangerous commands left un-templated.
Prep only; authorizes no action; [3] remains its own deliberate session.*
