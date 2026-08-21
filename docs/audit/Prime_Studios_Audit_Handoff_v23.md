# Prime Studios Audit Handoff v23

| | |
|---|---|
| **Predecessor** | Audit Handoff v22. v22 is not withdrawn; Sec 5 corrects one of its items and Sec 1 corrects one of its rows. |
| **Basis** | `origin/main` at `540b6d963a6b9cffdd4dad2c153ffb1d59ed3600`, derived live. |
| **Author date** | 2026-08-20 |
| **Type** | Handoff. Rules nothing. Mints nothing. Changes no gate, no status, no disposition. |

---

## Sec 0 — Why v23 exists

v22 merged 2026-08-09 and its checklist worked. Three of its ten items caught
real state this session: the numeric-sort instruction found F-AUTH-1 seventeen
revisions past v22's pointer and F-Stats-1 twenty-nine past; the PE #14 / Track
G4 question opened the thread that produced v2.56; the trio caught an open PR
that memory had wrong.

**One item failed, and it failed by handing the reader an answer instead of a
procedure.** That distinction is Sec 5, and it is the organising idea of this
document.

v23 also records **four instances of a hazard recurring after the artifact
describing it had landed** (Sec 4.1), **three instances of one premise standing
for a whole** (Sec 4.2), and **one defect appearing at three scales** (Sec 4.3).
None of these are new findings about the code. All are findings about how this
register loses things.

---

## Sec 1 — Current authorities

Derive from these. Do not derive from this document, and do not derive from memory.

**Derived at `540b6d96` by numeric sort. This table is a snapshot of a
derivation, not a source. Sec 6 item 2 requires you to reproduce it — reading it
is not running it.** Where v22 carried a figure, this table carries a pointer and
the instruction to produce the figure.

| Layer | Authority on main | Asserts | Moved since v22? |
|---|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.56.md` | Backend CLOSED at CP12, **REOPENED-QUALIFIED** per v2.43 Sec 4.1. **Track G3 OPEN** — Sec 5.71 limbs 1 and 3 unattempted. **Gate G3 DISCHARGED** at v2.55 Sec 3.1, *not placed beyond question* (v2.56 Sec 3). **Track G4 not enterable.** Track G5 BLOCKED. Track G6 not reached. | **v2.38 → v2.56** |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.48.md` | **KEYSTONE CLOSED** (G2, Phase B, items 7/8 at v1.48) | **No — current, verified** |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.60.md` | Phase B live; plan-of-record | **v1.31 → v1.60** |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | SHIPPED 2026-05-14; non-gating | **No — current, verified** |
| Cross-keystone | `Cross_Keystone_Register.md` | XK tail **XK-3**, ratified by F-Stats-1 v1.57. **29,155 bytes at this basis — compare against `origin/main`, do not memorise.** | Ratifier moved v1.31 → v1.57 |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | **Two correction banners, read newest-first; the banner governs the body.** Derived from the banners at this basis, not quoted forward: the exposed set reads **48** in the body, **37** at banner 1 (2026-08-18), **13** at banner 2 (2026-08-19), and banner 2 states **12 as of `main` at `803b0265`**. **Every one of those is basis-stamped and `main` is far past `803b0265`. Re-derive before use.** | Body unchanged, banners added |
| Production-environment items | `Session_PE_Roster.md` | Running PE list, tail **PE #63**. **PE #1–#26, #28–#30, #32–#36 are NOT here** — they are the Track 8 roster in F-AUTH-1 plan history. v22's row implied otherwise, and PE #14 is the case that bit. | Row corrected |

**Register tails at this basis: FD-66, XK-3, PE #63.**

**That two of four Fix Plan pointers were still current is itself the finding.**
v22's item said *"do not assume v2.38 / v1.48 / v1.31 are still current"* — correct,
but it leaves the reader unable to tell a stale pointer from a stable one.
F-Deploy-1 at v1.48 being **genuinely current** is what made PE #63's citation of
v1.26 Sec 3.4 a finding rather than a guess. **Produce the table; don't just
distrust it.**

Numbered registers are additive-supersede: later revisions build on earlier ones,
which remain on main as historical record. Merged documents are never edited in
place; corrections prepend a banner and preserve the body.

---

## Sec 2 — Keystone standing

Status per the Sec 1 authorities, on their own faces. No status is derived here.

| Keystone | Standing |
|---|---|
| F-AUTH-1 | **Backend CLOSED** at CP12, REOPENED-QUALIFIED per v2.43 Sec 4.1. **Deployment OPEN: Track G3 → G4 → G5 → G6.** Track G3 OPEN (limbs 1, 3 unattempted). **Track G4 not enterable.** Track G5 BLOCKED. Track G6 not reached. **No revision has entered any track.** |
| F-Deploy-1 | **CLOSED** (v1.48). |
| F-App-1 | SHIPPED 2026-05-14, out of sequence. Non-gating. Sec 12.11 residue unowned; tracked at PE #62. |
| F-Stats-1 | Phase B live. Items 23 and 36 open. |
| F-Ward-1 | Queued. **No `F-Ward-*` artifact exists in `docs/audit/`** at this basis. Inherits XK-1 exposure on `episode_wardrobe`, `episode_wardrobe_defaults`. |
| F-Reg-2 | Queued. |
| F-Ward-3 | Queued. Inherits XK-1 exposure on `outfit_sets`, `outfit_set_items`. |
| F-Franchise-1 | Queued. Director Brain is this keystone's resolution, not a separate build. |
| F-Sec-3 | Queued. Last in sequence. |

**Correction to v22 Sec 3.** v22 recorded F-AUTH-1's deployment tracks as
G3→G6 open without distinguishing **Gate G3** from **Track G3**. They are
different objects under every reading available (v2.56 Sec 3), and v2.55
discharged the former while the latter went unrecorded. v22 stands otherwise.

**The sequencing ruling is unchanged.** v2.38 Sec 1.3 ratified Option A —
parallel execution. Keystones whose work does not ship mutation routes onto an
unauthenticated surface may proceed in parallel with F-AUTH-1's open deployment
tracks. v21 Sec 4 is closed and does not carry forward.

---

## Sec 3 — Live hazards

Carried from the named authorities. Do not treat as complete; the authorities govern.

- **Boot-path inline DDL — PE #62 / F-Stats-1 Sec 31.** `src/server.js:146–164`
  executes untransacted DDL against `shows` on every non-test boot. `npm start`
  and `npm run dev` are unsafe pending resolution. Admitted to the cross-keystone
  register's criteria; **not yet an entry** — requires its own ratifying revision.
- **XK-1 — `paranoid` exposure.** Owned, fix unevaluated. **The exposed count is
  banner-governed and basis-stamped — see Sec 1.** Any remedy touches a FROZEN
  prod and requires its own gated window.
- **`Deploy to Development` (224506682) is `active` at the API layer.**
  F-Deploy-1 v1.26 Sec 3.5 records it as `disabled_manually`; it is not, and it
  has run successfully via `workflow_dispatch` on `main` (2026-07-14, 2026-07-21).
  The YAML layer carries **no `push:` trigger**, so the posture is
  manual-dispatch-only. The file was rewritten 2026-07-10 under F-Deploy-1 v1.30
  Sec 5 / FD-57, one day after v1.26's reading. **v1.30 has not been read against
  this and the transition is recorded in no document read for v23.** v1.48 Sec 5
  gates only the **push trigger**; it is silent on dispatch.
- **`Auto-merge to Dev` (244372826) is `disabled_manually`**; `Deploy to
  Production` (224506683) likewise. Prod freeze is enforced at the API layer.
- **PE #14 — the `origin/main..origin/dev` gap.** **The route-file content
  question v2.38 Sec 1.2 assigned here is DISCHARGED at v2.56 Sec 4.3**, on a
  measurement basis-stamped to `d68bfda7`. **That is not a standing claim that
  dev and main agree** — 18 `src/routes` files differ, all of it main advancing.
  PE #14's own document-propagation finding is unaffected and remediated.
  `origin/dev` is stale at `dc18b83d` (2026-06-27).
- **Prod.** Treat as FROZEN. Confirm freeze status live before any prod-touching
  action. Prod schema was **not** enumerated by the XK-1 probe; prod exposure is
  unverified and must not be assumed either way.
- **RDS identity.** Never trust instance names. Confirm identity live via
  `current_database()` / `inet_server_addr()` / VPC before any DB-touching action.
- **Working-tree register zeroing — cause unknown, UNEXPLAINED.** On 2026-08-09,
  `Cross_Keystone_Register.md` was found zeroed in the local working tree by a
  session that had not written to it. Repository unaffected. Mechanism not
  established. **Check by comparison against `origin/main`, not against any
  recorded byte count — see Sec 5.**
- **Cost-audit warnings** surfaced by pre-commit and pre-push: high Claude API
  call density in `characterGenerationService.js`, `feedScheduler.js`,
  `promptCacheHelper.js`; pre-push also surfaces 10 route files with async
  handlers possibly missing try/catch. **Unfiled as of this basis.**

---

## Sec 4 — How this register loses things

**Sec 4.1, 4.2 and 4.3 are three different failures. They are grouped because
each was documented correctly before it recurred.**

### Sec 4.1 — Four hazards that recurred after the artifact describing them landed

1. **FD-50** establishes that workflow runtime state is not derivable from
   workflow file contents, and names *"API re-enabled, YAML still commented"* as
   the dangerous direction. `Deploy to Development` then moved
   `disabled_manually` → `active` with no repository-visible change and no
   register entry (Sec 3).
2. **FD-51** establishes that a read is not authority unless it happened, and
   names Git-Bash MSYS path mangling of `git show origin/main:<path>` as the
   mechanism. **v1.48's own Basis cites that exact command form**, dated two
   weeks after FD-51 was minted.
3. **The same trap fired live during v23's preparation.** `git show
   origin/main:.github/workflows/deploy-dev.yml` exited **128** while `ls-tree`
   showed the file present. It was caught only because exit status was checked.
   **Empty output would have read as "push trigger disabled" and been
   accidentally correct.**
4. **Branch-name scope.** `auto-merge-to-dev.yml` triggers on `push` to
   `claude/**` only. PRs #1064 and #1065 landed from `docs/**` branches, so their
   carefully-placed `[skip-automerge]` tokens gated nothing. **`gh pr create`
   accepts either, checks run identically, the merged commit looks the same.**
   The care taken over the token is what makes its inertness invisible.

### Sec 4.2 — One premise standing for the whole, three times

1. **v2.52 Sec 1.1** — a discharge ruling given against v2.47 Sec 4.1's
   single-clause quotation of a four-clause gate. Diagnosed there: *"A ruling
   made against a partial premise does not reach the gate as written."*
2. **v2.55 Sec 3.2** — Gate G3's satisfaction taken for Track G4's whole
   precondition. Withdrawn by banner at `d68bfda7`.
3. **v2.55 Sec 3.1** — G3 discharged against v1.5's four requirements while
   v2.37 Sec 5.71's three limbs, specifying the same G3, went unconsulted.
   Recorded at v2.56 Sec 2.1.

**Each recurrence is at a higher level than the last, and each happened after
the prior one was written up in this same register.** Instance 2 occurred three
revisions after instance 1 was documented, in a document that cites the
documentation.

**"Document it harder" is the one remedy this evidence rules out.** The
documentation existed and was correct both times. **The failure is that a
satisfying result terminates the check.** A gate came back discharged, and
nothing in the author or the process asked what else the gate was made of.

**There is no checklist item for this in Sec 6, deliberately.** A line reading
*"check whether the premise you satisfied is the whole premise"* would be the
fourth instance waiting to happen — it is what the register already wrote, three
times, at increasing volume. **What is handed to the successor instead is this:
treat your own sense of completion as the signal. When a check comes back clean
and the relief is noticeable, that is the moment the prior three failures
occurred.**

### Sec 4.3 — One defect at three scales

Each is a form that asserts a completeness its maintenance stopped guaranteeing.

| Scale | Form | Failure |
|---|---|---|
| Value | v22 Sec 6's *"expect ~6,580"* | File is 29,155 at this basis. Fires on every wake. |
| Enumeration | v2.55's Status field | Carried FD-63…FD-66, Gate G3, Track G4, Track G5. **Dropped Track G3 and Track G6.** Absence from an apparently-exhaustive list is indistinguishable from closure. |
| Definition | v2.38 Sec 2.2's namespace lock | Locked two schemes. **Six are live.** Every author since re-derived the disambiguation locally; none folded it back. |

**Two omissions in one Status field is what makes the middle row a finding
rather than a slip.** A single omission reads as oversight. Two establishes that
the enumeration was not load-bearing for its author — which is why no later
reader can treat it as exhaustive.

---

## Sec 5 — Derivation versus assertion

**v22's Sec 6 had ten items. Score them by form:**

| Item | Form | Outcome |
|---|---|---|
| `git fetch` / `log -1` / `gh pr list` | derivation | worked |
| *"Re-derive every register in Sec 1. Numeric sort. Do not assume v2.38 / v1.48 / v1.31 are still current"* | derivation, with its own staleness anticipated | worked — caught two of four moved |
| *"PE #14 — has per-file inspection happened at Track G4?"* | derivation | worked — opened the thread producing v2.56 |
| *"Check byte length (**expect ~6,580**, not 0)"* | **assertion** | failed |

**The three that worked told the reader what to run and what not to assume. The
one that failed embedded an answer.** The distinction is not
constant-versus-computed — it is whether the item hands over a *procedure* or a
*result*. A result written into a checklist is read instead of run, and stops
being questioned at the moment it stops being true.

**The test to apply to any checklist item: could re-deriving it falsify the
item's own text?** If yes, the text is an assertion and must be converted. v23
Sec 6 item 3 is that conversion — *compare against `origin/main`, expect
identical and non-zero* — and it carries no number for the reader to trust.

**A consequence of an open question is not an assertion.** Sec 6 item 5 states
that Gate G3's discharge is not beyond question until the namespace is ruled.
Re-deriving cannot falsify that; only ruling the namespace can, and the item
asks whether that has happened. Consequences of open questions may stay.

---

## Sec 6 — Checklist for the v24 author

**Every item below is something to run. Nothing below is an answer to compare
against — see Sec 5 on why v22's one such item is the one that failed.**

- [ ] `git fetch origin` / `git log --oneline -1 origin/main` / `gh pr list`.
      Any remembered hash is stale by design.
- [ ] **Produce the Sec 1 table yourself.** For each register, numeric-sort the
      on-disk revisions (`v1.n` / `v2.n`; F-Deploy-1 and F-Stats-1 collide across
      most of the range) and record **which are current and which have
      successors** — not merely that they might. A pointer still current is
      evidence; a pointer that moved is a correction.
- [ ] **`Cross_Keystone_Register.md` — compare against `origin/main`, expect
      identical and non-zero.** Do not compare against any byte count written in
      this document.
- [ ] **Track G3 — have Sec 5.71 limbs 1 or 3 been attempted? Has any revision
      entered Track G4?**
- [ ] **The `Gate G<n>` / `Track G<n>` namespace — has a revision ruled it?**
      v2.56 Sec 3 defers it. **Until ruled, Gate G3's discharge is not beyond
      question** — see v2.56 Sec 3, reading 3.
- [ ] **PE #63 — re-derived against `claude/**` push heads, or retired?** Its
      stated method counts merged `main` commits, a population that excludes the
      branches where the token does anything.
- [ ] **`gh workflow list --all` BEFORE any workflow-file read** (FD-50). Read
      workflow files in PowerShell form or with `MSYS_NO_PATHCONV=1`, and
      **assert on exit status, not on empty output** (FD-51).
- [ ] **Confirm prod freeze status live.** Do not infer it from this document.
- [ ] **Has PE #62 / XK-2 been ratified into the cross-keystone register?** Does
      any `F-Ward-*` artifact exist? If so it must reference the paranoid
      inventory and XK-1 — that reciprocal obligation is recorded at XK-1 and
      discharged only by that reference.
- [ ] **F-Stats-1 items 23 and 36 — disposition.**

**Ten items, deliberately not more.** v22's Sec 6 worked because it was ten
items a reader would actually run. The docket behind v23 is larger than v22's,
and the pull was toward eighteen. **An eighteen-item checklist gets skimmed, and
skimming is how the byte value survived four revisions unexamined.**

**Moved out of Sec 6 rather than dropped silently** — dropping-without-saying is
the vector Sec 4.3 documents:

- **SAL Episode 1 / "The Honey Table" status** → Sec 7. It has not moved in
  months and no author runs it as a check.
- **The stopping-condition finding** → Sec 4.2, deliberately not a checklist
  item, for the reason stated there.
- **The four recurrences, the three scales, the branch-name trap** → Sec 3 and
  Sec 4. All are things to understand; none are things to run.

---

## Sec 7 — Housekeeping carried

- **`deploy-dev.yml` push-trigger re-enablement remains a GATED decision** per
  v1.48 Sec 5. Verify live per Sec 6 item 7 — **and note that the file's API-layer
  state and its YAML-layer trigger are separate questions** (Sec 3).
- **Parked-files note.** v21 Sec 8 superseded v15 Sec 3.16 and established no
  replacement. Both remain untracked-file questions, unresolvable against any commit.
- **SAL Episode 1 status unconfirmed.** "The Honey Table" is deprecated;
  replacement was TBD at last record. Unchanged at this basis.
- **PE roster.** `Session_PE_Roster.md` governs session-scoped
  production-environment items, tail PE #63. **PE #62** is the standing unowned
  entry. **PE #14 is not in this roster** — see Sec 1.
- **`[skip-automerge]` placement.** The token must be in the **commit subject**,
  suffix position. `squash_merge_commit_title = COMMIT_OR_PR_TITLE` resolves to
  the *commit* title for a one-commit PR, so a token placed only in the PR title
  does not reach `main`. PR #1063 is the demonstration.

---

## Sec 8 — What this document does not do

- **Does not rule the `Gate G<n>` / `Track G<n>` namespace.** v2.56 Sec 3 defers
  it and this handoff does not resolve it. **A reader must not infer from a fresh
  handoff that the question was cleared.**
- **Does not attempt Sec 5.71 limb 1** — the adjudicator-driven audit pass over
  CP1–CP12 cumulative work. Not begun, not scheduled.
- **Does not re-derive PE #63.** Its population problem is recorded at Sec 6
  item 6 and is owed to a revision, not to this handoff.
- **Does not read F-Deploy-1 v1.30**, which is where `deploy-dev.yml`'s rewrite
  and its API-layer posture would be authorized if they are authorized anywhere
  (Sec 3).
- **Does not change any gate, status, disposition, or PR state. Mints no FD, XK,
  or PE. Contacts no deployed host. Prod remains FROZEN.**
- **Does not supersede v22.** Sec 1 corrects one row and Sec 5 corrects one
  checklist item; v22 stands otherwise.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-20. Basis `540b6d96`, derived live.*
*Type: handoff. Rules nothing. Mints nothing. Changes no gate.*
*Register tails at basis: FD-66, XK-3, PE #63. Handoff tip: v23.*
*[skip-automerge]*
