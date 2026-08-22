# Prime Studios Audit Handoff v24

| | |
|---|---|
| **Predecessor** | Audit Handoff v23. v24 supersedes v23 Sec 1, Sec 2, Sec 6, and the tail/status portions of Sec 7. v23's analysis and correction banners stand. |
| **Basis** | `origin/main` at `fec15be68e887d6c8395f13454ae00917df3a173`, derived live 2026-08-22. |
| **Author date** | 2026-08-22 |
| **Type** | Handoff. Rules nothing. Mints nothing. Changes no gate, finding, severity, or disposition. |

---

## Sec 0 — Why v24 exists

Twelve documentation-only PRs landed after v23:

| Range | Merged PRs | Additions | Deletions | Changed-file occurrences |
|---|---:|---:|---:|---:|
| #1070–#1081 | **12** | **2,703** | **0** | **18** |

**That is documentation velocity, not remediation.** The register is more
accurate, more explicit, and better scoped than it was at v23. The runtime
system is unchanged by all twelve PRs. FD-67 and FD-68 are now visible; neither
is fixed. Dimension 2 is correctly scored; Dimensions 3 and 5 remain
unperformed. PE #65 has a decision specification; no topology was chosen.

A successor reading PR history sees sustained momentum. **The momentum is in
the map.** v24 exists because the map has grown faster than a cold successor can
reconstruct safely from filenames, and because the session produced several
method findings that would otherwise remain only in conversation.

---

## Sec 1 — Current authorities

**Derived at `fec15be6` by numeric sort and live reads. This table is a
snapshot of a derivation, not authority. Sec 6 requires reproducing it.**

| Layer | Authority on `main` | Current face |
|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.61.md` | REOPENED-QUALIFIED. G3 PARTIALLY DISCHARGED, OPEN. Limb 1 open; limb 3 assessment NOT COMPLETED. Dimensions: 1 PASS (prior basis), 2 PASS, 3 NOT PERFORMED, 4 FAIL, 5 NOT PERFORMED. G4 not enterable. FD-67 OPEN/P2; FD-68 OPEN/P1. |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.48.md` | **KEYSTONE CLOSED.** Manual SSM dev dispatch remains authorized/active; push trigger remains separately gated. |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.60.md` | Phase B live. FD tail on its face FD-62; XK tail XK-3. Rule 2 complement exhausted; PE #62 overlap advanced, not closed. |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | SHIPPED 2026-05-14, out of sequence; non-gating. Pattern 40 residue tracked at PE #62. |
| Cross-keystone | `Cross_Keystone_Register.md` | XK-1, XK-2, XK-3 admitted/owned; XK tail XK-3. |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | Banner-governed; read newest-first and re-derive before using any count. |
| Production-environment items | `Session_PE_Roster.md` | Tail PE #67. PE #64 OPEN/P1, partially evaluated; PE #65 OPEN/P2, decision-blocked; PE #66 CLOSED; PE #67 OPEN/P2. |
| Cognito topology choice | `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md` | Complete decision specification; chooses no branch. |
| Handoff | `Prime_Studios_Audit_Handoff_v24.md` | This snapshot and executable checklist. |

**Register tails at this basis: FD-68, XK-3, PE #67.** F-AUTH-1 minted FD-67
and FD-68 after v23; the global FD tail is therefore no longer FD-66.

### Sec 1.1 Cross-Keystone integrity check

The v23 Sec 6 check was run correctly only on the second attempt:

- local Git blob: `d277588c81cf9bedea52aa015f79311e769a57f9`;
- `origin/main` blob: same;
- file non-zero; and
- `git diff --quiet origin/main -- docs/audit/Cross_Keystone_Register.md`
  exited 0.

**The first attempt was invalid.** `git show ... > file` under PowerShell
re-encoded the output, then `Get-FileHash` reported a clean-looking mismatch.
The result measured PowerShell's output encoding, not repository divergence.
Use Git blob identity or `git diff --quiet`; do not round-trip text through the
shell to compare repository bytes.

---

## Sec 2 — Keystone standing

| Keystone | Standing |
|---|---|
| F-AUTH-1 | Backend sweep REOPENED-QUALIFIED. **G3 PARTIALLY DISCHARGED, OPEN.** Limb 1 unattempted. Limb 3 assessment NOT COMPLETED. Dimension 2 PASS; Dimension 3 NOT PERFORMED; Dimension 4 FAIL; Dimension 5 NOT PERFORMED. G4 not enterable; G5 blocked; G6 not reached. |
| F-Deploy-1 | **CLOSED** at v1.48. Recognizing its manual SSM path does not reopen it. |
| F-App-1 | SHIPPED; non-gating. PE #62 owns surviving Pattern 40 residue. |
| F-Stats-1 | Phase B live. **Open items 23 and 36 are CLOSED** — item 23 at v1.43, item 36 by ruling at v1.35. v23's “open” row is superseded. |
| F-Ward-1 | Queued. No `F-Ward-*` artifact exists in `docs/audit/` at this basis. |
| F-Reg-2 | Queued. |
| F-Ward-3 | Queued. No F-Ward artifact exists to carry the reciprocal XK-1 reference yet. |
| F-Franchise-1 | Queued; Director Brain remains this keystone's resolution. |
| F-Sec-3 | Queued last in the locked sequence. |

**Namespace question resolved.** v2.57 rules `Gate G<n>` and `Track G<n>`
co-referential for n=3–6. G3's earlier discharge is incomplete, not void.

**No track has been entered.** v2.58 specifies limb 3; v2.59 attempts it;
v2.60 re-scores Dimension 2 only; v2.61 dispositions procedure findings.
None enters G4.

---

## Sec 3 — F-AUTH-1 state since v23

### Sec 3.1 G3 and limb 3

v23 handed off G3 with two open limbs and no assessment definition. Since then:

1. **v2.57** rules one G3 with two complementary specifications. Limb 1 and
   limb 3 remain open.
2. **v2.58** defines limb 3 as five dimensions and pre-commits four outcomes:
   GO, NO-GO, INCONCLUSIVE, ASSESSMENT NOT COMPLETED.
3. **v2.59** performs the assessment to authorized evidence. Dimensions 3 and 5
   are not performed; Dimension 4 fails. The fourth outcome fires and prevents
   a tempting but false NO-GO completion.
4. **v2.59 banner** withdraws Dimension 2's initial FAIL because the owning
   F-Deploy authority was a known non-read.
5. **v2.60** reads v1.30→v1.48 plus live workflow state and scores Dimension 2
   PASS. No other dimension moves.
6. **v2.61** files the procedure defects blocking Dimension 3 and corrects the
   false Step 6b blocker.

Current dimension record:

| Dimension | Latest disposition | Basis / authority |
|---|---|---|
| 1. Candidate integrity | **PASS** | v2.59 at `ce305d34`; historical, not re-stamped into a new combined basis |
| 2. Delivery-path viability | **PASS** | v2.60 at `4318a984` |
| 3. G4 procedure executability | **NOT PERFORMED** | v2.59; FD-67/FD-68 now block any future PASS |
| 4. Evidence validity | **FAIL** | v2.59 |
| 5. Authority/external blockers | **NOT PERFORMED** | v2.59 |

**There is no combined five-cell assessment on one current basis.** The
controlling top-level outcome remains ASSESSMENT NOT COMPLETED.

### Sec 3.2 FD-67 and FD-68

**FD-67 — OPEN/P2.** v1.5 §7.7 requires removal of global `optionalAuth`;
later architecture retains it for legitimate consumers and relies on effective
route disposition. The historical G4 checkbox is unexecutable. Remedy selection
must account for FD-63 and limb 1.

**FD-68 — OPEN/P1.** CP1 deliberately replaced boot-fail with lazy
`AUTH_CONFIG_MISSING`, but missing config is classified at the HTTP boundary as
`401 AUTH_INVALID_TOKEN`; explicit placeholders are not rejected. A corrected
local no-network request probe observed the response, not merely the source
shape.

**Severity rider for future adjudication, not a reclassification:** FD-68's
observability consequence may exceed its P1 framing. A server misconfiguration
looks like ordinary caller token failure. In combination with FD-65's open
issuance half, the surface can both issue tokens to anonymous callers and
attribute server configuration failure to caller tokens. A later severity
ruling must consider the interaction rather than each finding in isolation.

**Step 6b correction.** v2.61 withdraws v2.59's claim that §7.6 requires Step
6b deletion. §7.6 checks observable behavior already implemented through
`requireAuth` and the frontend. Step 6b remains open/separable and is not a
Dimension 3 blocker on current evidence.

### Sec 3.3 Cognito cluster

- **PE #64:** OPEN/P1, trigger PARTIALLY EVALUATED. Enumeration is closed.
- **PE #65:** OPEN/P2. The decision is specified; Evoni must choose topology.
- **PE #66:** CLOSED by retiring tracked stale ID authority surfaces.
- **Decision branches:** existing pool→prod/new dev; new prod/existing pool→dev;
  or future non-split isolation. No branch selected.

The ignored local `docs/infrastructure-ids.txt` still carries stale values
outside Git. PE #66's closure is bounded to tracked authority surfaces; the
local hazard is observed, not filed or fixed.

### Sec 3.4 Branch-base hazard

**PE #67 — OPEN/P2.** Original v2.57 head produced a 749-line PR-style diff;
corrected head produced 417 lines; predecessor inflation was 332 lines. Squash
preserved content and replaced ancestry.

Proven manual control:

1. `git fetch origin main`;
2. create branch explicitly from `origin/main`;
3. before PR, fetch again and require `git merge-base HEAD origin/main` to equal
   `origin/main`; and
4. inspect `git diff --stat origin/main...HEAD` plus name-status.

The practice works and remains unenforced; PE #67 stays open.

---

## Sec 4 — Method findings to carry

### Sec 4.1 Pre-commitment worked once and failed once

The Cognito liveness criterion pre-committed `>=2` identities as proof of more
than one person. It encoded an unexamined proxy and failed. The limb 3 criterion
separated **assessed-and-blocked** from **not assessed**; when Dimensions 2 and 4
failed but Dimensions 3 and 5 were not performed, it correctly selected
ASSESSMENT NOT COMPLETED instead of the tempting NO-GO.

**The difference is not drafting ceremony.** A useful criterion distinguishes
states. A bad criterion measures a quantity and assumes the quantity represents
the decision axis.

### Sec 4.2 Runnable obligations must live in the executable checklist

v23 supplies a controlled comparison:

- **PE #63** appeared in Sec 8 and was duplicated into Sec 6. It remained
  runnable.
- **F-Deploy-1 v1.30** appeared only in Sec 8. It did not fire, even though it
  named the exact document and read later needed by v2.59 Dimension 2.

Same document, author, and session; placement is the variable. **Any obligation
that names a specific read must appear in the executable checklist, not only in
a “what this does not do” section.** Sec 6 applies this rule.

### Sec 4.3 A claim about a document requires opening the document

Twice in three turns, a claim about text was carried without reading the text:

- v2.59 ruled delivery-path failure while F-Deploy authority remained unread;
- v2.59 and the next-session premise said §7.6 required Step 6b deletion, but
  §7.6 asserts behavior and v2.52 makes deletion separable.

A citation-shaped statement is not a read. Open the governing section before
using a claim about what it requires.

### Sec 4.4 Well-formed output can answer the wrong question

Observed instances in this work window:

- Cognito criterion counted identities while asking about persons.
- First FD-68 probe reloaded `.env` and used a malformed token, returning a
  valid token-rejection result rather than missing-config behavior.
- First Cross-Keystone hash comparison measured PowerShell re-encoding rather
  than repository bytes.
- DOCX `[xml].InnerText` returned empty despite 7,878 `<w:t>` runs.
- An edit to ignored `infrastructure-ids.txt` produced no Git status/diff signal.
- `gh` alternate-screen watchers swallowed subsequent command output until the
  TUI was exited/redirected.

**Success-shaped output is not evidence until the instrument's delivery path is
checked.** For repository content, prefer Git-native identity. For probes,
state the discriminator and confirm the setup reaches it.

### Sec 4.5 Do not round-trip commit messages through PowerShell

The original Cognito topology commit message carried intact UTF-8. Amending its
subject by reading `%B` into PowerShell produced two separate failures:

1. native multiline output became an array and `WriteAllText` flattened it;
2. restore-from-object recovered structure but re-encoded `§` as `┬º`.

**Rule:** compose the entire replacement message fresh as an ASCII single-
quoted here-string. Do not read a commit message back through PowerShell to
change one line.

### Sec 4.6 No unattended merge at the gate

Repository auto-merge is disabled. An attempted `gh pr merge --auto` failed
without queuing anything; manual green-only merges followed. Do not reach for
`--auto` even where available in this audit program: standing authorization to
“merge on green” does not transfer the moment-of-merge gate to an unattended
repository setting.

---

## Sec 5 — Live carries and docket

### Sec 5.1 Highest-priority specific reads

These came from the 48-section non-actions sweep. Each names a specific read and
therefore appears again in Sec 6.

1. **FD-66 deployed-schema/provenance read** — establishes actual deployed
   column state and which provisioning path produced it. Evoni-owned,
   prod-gated. Bears on Dimensions 4/5.
2. **`JWT_SECRET` dev/prod environment-state read** — owed at F-AUTH v2.49
   §5/§7 and v2.52 §6 item 8. Evoni-owned, prod-gated. Bears on Dimension 5 and
   FD-65.
3. **`compositions.js` route-order runtime verification** — whether `/:id`
   captures `/search` and `/search/filters/options`. Local/runtime-capable;
   belongs to limb 1/checklist applicability.

None was performed by this handoff.

### Sec 5.2 Active work, in order

1. **PE #63 — re-derive or retire.** Its 2-of-40 method measures merged `main`
   commits while the token acts on `claude/**` push heads.
2. **FD-67/FD-68 remedies.** Code/procedure work requires an authorizing
   revision and focused tests before implementation. FD-68 severity interaction
   with FD-65 must be adjudicated.
3. **Limb 1.** Approximately 700 disposition judgments; its own program, not a
   grep or a ride-along.
4. **PE #65.** Awaiting Evoni's topology choice; no code should infer one.
5. **Dimension 3/5 completion.** Requires corrected procedure plus explicit
   host/shared-identity/freeze authorization.

### Sec 5.3 Other live debt from the non-actions sweep

- G6 data-strand assessment — G6 only.
- FD-63 global-mount/probe disposition — tied to FD-67 and limb 1.
- G4 §7 runtime assertions — Dimension 3 after procedure correction.
- Prod enumeration generally — deliberate freeze boundary, not silently owed
  by this handoff.

---

## Sec 6 — Executable checklist for the v25 author

**Rule: if Sec 7 or any other non-action section names a specific read, that
same read must appear here or be explicitly classified as a bounded exclusion.
A runnable obligation parked only as a non-action is dropped in practice.**

- [ ] `git fetch origin --prune`; read `git log -1 origin/main`; run
      `gh pr list`. Do not carry `fec15be6` as an expected answer.
- [ ] Numeric-sort F-AUTH, F-Deploy, F-Stats, F-App, and Handoff revisions.
      Produce the authority table; do not copy Sec 1.
- [ ] Compare `Cross_Keystone_Register.md` with `origin/main` using
      `git hash-object` vs `git rev-parse origin/main:path` or `git diff
      --quiet`. **Do not redirect `git show` through PowerShell and hash the
      rewritten file.** Assert non-zero independently.
- [ ] Read the newest correction banners before body sections in v2.59, v23,
      XK-1, and FD-66.
- [ ] Re-derive G3: limb 1 status, limb 3 outcome, all five dimension
      dispositions, and whether any revision entered G4.
- [ ] **PE #63:** re-measure against the population where the token acts
      (`claude/**` push heads), or land an explicit retirement/supersession.
- [ ] Read workflow API state before YAML. Keep `Deploy to Development`,
      `Deploy to Production`, and `Auto-merge to Dev` as three separate states.
- [ ] **FD-66 infrastructure read:** has Evoni authorized/performed deployed
      schema + provenance? If not, record NOT PERFORMED; do not infer from
      migrations.
- [ ] **`JWT_SECRET` environment read:** has Evoni authorized/performed the
      dev/prod state read? If not, record NOT PERFORMED; do not search for
      credentials.
- [ ] **`compositions.js` route order:** has a runtime discriminator been run?
      If not, keep it open under limb 1; do not infer from declaration order
      alone.
- [ ] **FD-67/FD-68:** has a remedy been authorized, implemented, and tested?
      Check HTTP classification and explicit placeholder behavior separately.
- [ ] **PE #65:** has Evoni selected a topology branch? A decision specification
      is not a decision.
- [ ] Confirm prod-freeze status live through the appropriate authority before
      any prod/shared-Cognito/host action. **v24 did not perform this check.**
- [ ] Re-read F-Stats items 23/36 from their closure revisions if they become
      load-bearing; both are closed at this basis.

Fourteen items is longer than v23's target ten because three specific reads and
two new findings now require durable carriage. **Do not shorten by moving
runnable items into Sec 7.** Shorten only by closing, superseding, or explicitly
classifying an item as bounded exclusion.

---

## Sec 7 — Housekeeping and bounded non-actions

- **Documentation velocity:** 12 PRs / +2,703 / −0 since v23 changed no runtime
  code. Do not report merged-document count as remediation progress.
- **F-Deploy-1 remains closed.** Manual dev dispatch is active; push trigger is
  separately gated; auto-merge and prod deploy are API-disabled at this basis.
- **PE #66 closure is tracked-only.** Ignored local `infrastructure-ids.txt`
  remains outside the register and may still mislead a local reader.
- **F-Ward reciprocal reference:** no F-Ward artifact exists, so there is no
  artifact to amend yet. When one appears, Sec 6 must test the XK-1 reference.
- **F-App-1 v1.1 remains the numeric tail.** Its historical G6-in-progress text
  is not re-adjudicated here; PE #62 owns surviving Pattern 40 residue.
- **Prod freeze live confirmation:** NOT PERFORMED by v24. The API-disabled prod
  workflow is one control, not a complete freeze attestation.
- **SAL Episode 1 / parked local files:** unchanged housekeeping from v23; not
  promoted into Sec 6 because no current executable decision depends on them.

---

## Sec 8 — What v24 does not do

- **Does not perform PE #63 re-derivation, limb 1, or any parked read in Sec 5.**
- **Does not choose PE #65's topology branch or reclassify FD-68.**
- **Does not authorize or implement FD-67/FD-68 remedies.**
- **Does not re-run limb 3 or score Dimensions 3/5.**
- **Does not contact a deployed host, prod database, AWS, or shared Cognito.**
- **Does not confirm prod freeze live.** It records that omission in Sec 6 and
  Sec 7 so placement cannot make it disappear.
- **Does not supersede v23's analysis sections or correction banners.** It
  supersedes v23's state snapshot and checklist only.
- **Changes no gate, finding, severity, owner, or disposition. Mints nothing.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-22. Basis `fec15be68e887d6c8395f13454ae00917df3a173`, derived
live. Type: handoff. Rules nothing. Mints nothing. Changes no gate. FD tail
FD-68; XK tail XK-3; PE tail PE #67. No deployed host, AWS, database, or shared
Cognito contact. Prod freeze not live-confirmed. [skip-automerge]*
