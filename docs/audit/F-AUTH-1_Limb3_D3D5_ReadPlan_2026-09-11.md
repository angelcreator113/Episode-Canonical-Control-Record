# PRIME STUDIOS — F-AUTH-1 LIMB 3 D3/D5 READ PLAN

**Evidence label:** `Limb3_D3D5_ReadPlan`

**Basis:** `origin/main` at `1028f88f25e7c245643ee4b75ac23f53c5003f1d`,
2026-09-11. Basis established by `/wake-up`. This document is a read plan
only. It performs no host, AWS, database, or Cognito read.

**Scope:** Dimension 3 and Dimension 5 of F-AUTH-1 limb 3. The source
selection rule is the one in the task: read the named current source first;
do not walk back to find a better statement. Where the named source is absent,
use the supplier named by v25 Owed Index Amd8 §H4. Do not reconstruct a
definition when neither source carries one.

## 1. Dimension 3

### 1.1 Named current source: v2.68

The standing row names `F-AUTH-1_Fix_Plan_v2.68.md` as the current source for
Dimension 3. The required source read was:

```text
COMMAND
git show origin/main:docs/audit/F-AUTH-1_Fix_Plan_v2.68.md
```

The relevant raw output from that command was:

```text
**PE #67**. Dimension 3 remains **NOT PERFORMED**; limb 3 open; G4 not
...
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the
freeze.
```

The source contains the standing and non-advancement language, but not a
definition of what Dimension 3 asks. The focused absence check was:

```text
COMMAND
git show origin/main:docs/audit/F-AUTH-1_Fix_Plan_v2.68.md | Select-String -Pattern 'Dimension 3 asks|Dimension 3 —|Dimension 5 asks|Dimension 5 —'

RAW OUTPUT
GIT_SHOW_EXIT=0
MATCH_OUTPUT_BEGIN
MATCH_OUTPUT_END
SELECT_MATCH_EXIT=1
```

`git show` exited zero; the empty match output is therefore evidence of no
matching definition under FD-51. The status hits found by the broader grep do
not supply a definition and are not treated as one.

**Result for the named source:** `MEASURED-ABSENT` for a D3 definition.

### 1.2 Supplier source: v2.61

v25 Owed Index Amd8 §H4 names `v2.61` as the supplier for Dimension 3 and
`v2.68` as its last restatement. The required supplier read was:

```text
COMMAND
git show origin/main:docs/audit/F-AUTH-1_Fix_Plan_v2.61.md
```

The definition appears at §1.1. Raw output:

```text
## §1.1 Why this is a procedure revision, not a readiness reassessment

Dimension 3 asks whether every G4 operation can be performed and observed. A
procedure whose expected result contradicts authorized current architecture
cannot be made executable by deploying a healthier candidate. The procedure
must first be corrected or the architecture changed under its own authority.
```

This is the definition carried by the supplier source. It is quoted without
re-deriving or expanding it.

### 1.3 D3 read plan derived from the definition

**Target class, by role:** the deployed application runtime that would execute
G4 operations, plus the process and observability surfaces that show whether
those operations can be performed and observed. No host, process, account, or
other infrastructure identifier is part of this plan.

**Read sequence, operator-run only:**

```text
nginx -T
ss -ltnp
ps -fp <listener-pid>
pm2 id <listener-pid>
pm2 describe <process-id>
uptime
free -m
```

The listener PID must be derived from `nginx -T` and `ss`; the process identity
must then be followed to the PM2 id. Process names are not identity evidence.
The G4 operation checks themselves must be run only under separately recorded
authority and must not create, mutate, or refresh identity records.

**Expected well-formed output:** each command exits zero; the output is
non-empty; the nginx route, listening socket, PID, and PM2 id agree by
function; runtime age and resource readings are timestamped; and each G4
operation has an explicit observed result rather than a merely non-error
response. H1 requires the command and raw output to be pasted together.

**Outcome mapping:** a complete, internally consistent, raw read would supply
the live evidence needed for a later Dimension 3 assessment. Empty output,
non-zero exit, an identity mismatch, or an unobserved G4 operation leaves the
corresponding fact unestablished. This plan does not assign Dimension 3 a
readiness disposition and does not advance it.

## 2. Dimension 5

### 2.1 Named current source: v2.61

The standing row names `F-AUTH-1_Fix_Plan_v2.61.md` as the current source for
Dimension 5. The required source read was:

```text
COMMAND
git show origin/main:docs/audit/F-AUTH-1_Fix_Plan_v2.61.md
```

The source carries a status face, not a Dimension 5 definition:

```text
Dimension 2 PASS; Dimension 3 NOT PERFORMED; Dimension 4 FAIL; Dimension 5 NOT
PERFORMED. **G4 — not enterable.**
```

The focused absence check was:

```text
COMMAND
git show origin/main:docs/audit/F-AUTH-1_Fix_Plan_v2.61.md | Select-String -Pattern 'Dimension 5 asks|Dimension 5 —|Dimension 5 requires'

RAW OUTPUT
GIT_SHOW_EXIT=0
MATCH_OUTPUT_BEGIN
MATCH_OUTPUT_END
SELECT_MATCH_EXIT=1
```

`git show` exited zero; the empty match output is evidence of no D5
definition under FD-51. The status phrase is not converted into a definition.

**Result for the named source:** `MEASURED-ABSENT` for a D5 definition.

### 2.2 Supplier source and outcome

The fallback supplier read required by step 4 was performed against Amd8 §H4:

```text
COMMAND
git show origin/main:docs/audit/v25_Owed_Index_Amd8_2026-08-27.md | Select-Object -Skip 198 -First 28

RAW OUTPUT
# §H4. `Prime_Studios_Audit_Handoff_v25.md` Sec 3 — supplier and restater in one column

| dim | disposition | supplied at | last restated |
|---|---|---|---|
| 5 | NOT PERFORMED | `v2.61` | `v2.61` |
```

The focused supplier-row read was:

```text
COMMAND
git show origin/main:docs/audit/v25_Owed_Index_Amd8_2026-08-27.md | Select-String -Pattern '^\| 5 \||Dimension 5'

RAW OUTPUT
| 5 | NOT PERFORMED | `v2.61` | `v2.61` |
```

The Amd8 §H4 supplier therefore resolves back to `v2.61`, not to a second
revision. The supplier read was still required and is shown here; it also
contains no D5 definition. No definition may be reconstructed from earlier
revisions or neighboring dimensions.

**Result:** `CANNOT-TELL` as to the definition, target class, read command,
expected output shape, and outcome-to-disposition mapping for Dimension 5.
This is a measured source-boundary result, not a readiness disposition.

**D5 read plan:** none can be derived without inventing the missing
definition. The only well-formed evidence at this stage is the two exit-zero
absence checks above and the raw status phrase. A later authorized revision
must supply the definition before a dimension-specific live read can be
specified. This document does not advance Dimension 5.

## 3. Preconditions and binding disciplines

These conditions bind any later operator-run session. This document does not
authorize that session.

### 3.1 Identity by function

Database identity must be established by a read of the active connection, not
by a name or a document assertion:

```sql
SELECT current_user, current_database(), inet_server_addr(),
inet_server_port();
```

Process identity must be derived in this order: `nginx -T` → `ss` → PID → PM2
id. Never identify the process by name alone.

### 3.2 Freeze and evidence rules

The freeze remains binding: no restart, reload, save, delete, reboot, deploy,
environment-file edit, RDS modification, data copy, security-group change, or
re-enabling of disabled workflows. No agent session contacts a host, AWS, RDS,
or Cognito. Any exception belongs to a separately authorized Evoni-gated
session.

H1 requires every command and its raw output. FD-51 applies: empty stdout is
not absence unless the producing command exits zero. Pipelines must preserve
and report the producing command's exit status separately from a no-match
status.

### 3.3 Named abort condition

Abort before any restart, reload, or redeploy step if the session reaches the
gap recorded by `F-AUTH-1_PE65_CutoverGap_2026-09-05.md`: the PE65 sequence
gates its Phase 2 configuration write but names no step that makes that write
live on the running process. Whether such a restart is safe is not
repository-derivable. No restart or workaround is proposed here.

## 4. Author declaration

This document mints no FD, XK, or PE. It rules nothing. It does not advance
Dimension 3 or Dimension 5, does not enter G4, and does not alter the freeze.
No host, AWS, database, or Cognito was contacted in authoring this document.

*Filed as a read plan only. Evidence label: `Limb3_D3D5_ReadPlan`.*