| **PRIME STUDIOS** **F-AUTH-1 — PE #65 EXECUTION SEQUENCE: CUTOVER GAP** *Records that the sequence gates who may write the Cognito config and names no step making that write live. Class-matched to FD-31's hazard. Does not reopen FD-31. Mints nothing. Rules nothing.* |
| --- |

**Document version**

v1.0 — **RECORDS A GAP IN `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`.**
The sequence orders and gates every step Branch B's ruling and costing named,
except the one that would make its own Phase 2 config write take effect on
the running production process. No step restarts, reloads, or redeploys
that process. Whether such a restart is currently safe is not
repository-derivable. **Mints nothing. Rules nothing. Closes no finding,
reopens no finding.**

**Basis:** `origin/main` at `13c467c657ba3aba38f6f1ac23bfa4a15330e4d9`,
2026-09-05. All reads local git against that commit; no host, AWS, database,
or Cognito contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only.** Supplies an observation for Evoni's disposition; does not
itself dispose. No FD, XK, or PE number is minted. Prod **FROZEN**.

---

# §1. The gap, quoted from its source

`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` §4, Phase 2 step 4, quoted
in full:

> Update the four config variables — `COGNITO_USER_POOL_ID`,
> `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_REGION`... on the
> **prod manifest's** `env_production` block only (`ecosystem.config.js`)...
> **This is a server `.env`/PM2 manifest edit on the frozen box and is
> explicitly barred to any agent session by `CLAUDE.md`'s non-negotiables
> regardless of this document.**

That is the sequence's last word on the config write. No step after it
exists — its own step list ends at step 7 (Gate G3), and §5 explains step
ordering through step 6 without naming any step between 4 and 6 that makes
step 4's write take effect.

```
$ git show origin/main:docs/audit/F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md | grep -in "restart\|reload\|redeploy"
(no output)
```

# §2. What the write requires that no step supplies

A PM2-managed Node process reads `ecosystem.config.js`'s `env_production`
block at process start, not on file change. `src/middleware/auth.js`'s
Cognito verifiers are constructed once and cached, not read live per
request:

```
$ git grep -n "getIdTokenVerifier\|getAccessTokenVerifier\|_idTokenVerifier\|_accessTokenVerifier" origin/main -- src/middleware/auth.js
origin/main:src/middleware/auth.js:79:let _idTokenVerifier = null;
origin/main:src/middleware/auth.js:80:let _accessTokenVerifier = null;
origin/main:src/middleware/auth.js:110:const getIdTokenVerifier = () => {
origin/main:src/middleware/auth.js:111:  if (_idTokenVerifier) return _idTokenVerifier;
origin/main:src/middleware/auth.js:113:  _idTokenVerifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'id', clientId });
origin/main:src/middleware/auth.js:114:  return _idTokenVerifier;
origin/main:src/middleware/auth.js:117:const getAccessTokenVerifier = () => {
origin/main:src/middleware/auth.js:118:  if (_accessTokenVerifier) return _accessTokenVerifier;
origin/main:src/middleware/auth.js:120:  _accessTokenVerifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId });
origin/main:src/middleware/auth.js:121:  return _accessTokenVerifier;
origin/main:src/middleware/auth.js:180:      const payload = await getIdTokenVerifier().verify(token);
origin/main:src/middleware/auth.js:184:        const payload = await getAccessTokenVerifier().verify(token);
```

Module-scope `let` declarations hold the verifier once constructed; each
getter returns the cached instance if one exists and constructs it,
reading `process.env` at that moment, only on first call. The request path
calls the getter, not the constructor, on every subsequent request.
**Editing the manifest file, by itself, changes nothing this cache holds.**
For step 4's write to reach the process that authenticates production
traffic, that process must reread its environment and rebuild these
verifiers — by restart, reload, or a fresh deploy.

**No such step exists in the sequence, and the one path capable of
performing it is recorded elsewhere as disabled.**
`Prime_Studios_Audit_Handoff_v26.md` Sec 3.2 records, from a live GitHub
Actions read: *"Deploy to Production ... disabled_manually."* The sequence
does not cite this fact and does not propose an alternative mechanism.

# §3. Whether a restart is safe is not repository-derivable

This is not a claim that a restart is unsafe. It is a claim that the
sequence proceeds as if the question does not need answering, when the
register's own standing rule says it cannot be answered from the
repository at all.

`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` §2, Gate G0, quoting
`v25` Sec 6 item 13 in full:

> "The Actions path is derivable from the repository and the API… The
> remainder is not. SSM, SSH, and console access reach production by paths
> no repository read observes. Confirm the residue live through the
> appropriate authority before any prod / shared-Cognito / host action."

Gate G0 is stated as the precondition for *every* Phase 2 step, including
step 4's config write. It is not stated as a precondition for whatever
step would make that write live, because the sequence names no such step
for the gate to attach to. The gap this document records is exactly that
omission: a sequence can gate a write it names, but it cannot gate a step
it never wrote down.

# §4. Class-matched to FD-31's hazard — not FD-31 reopened

**This document does not reopen FD-31, and the distinction is load-bearing,
not decorative.**

`F-Deploy-1_PROD_SplitBrain_HAZARD.md` recorded a specific, confirmed
condition: the production process ran against a live database while its
on-disk `.env` pointed at a verified-empty one, such that any restart
"silently swaps prod onto the empty DB — boots clean, serves nothing,
throws no error." That condition was closed by deliberate action, quoted
from `F-Deploy-1_Fix_Plan_v1.20.md`: *"FD-31 — CLOSED by this revision.
Restart-to-align + save. All six [legs complete]."* `F-Deploy-1_Fix_Plan_v1.27.md`
reaffirms this against five later documents that had restated it open by
citation without reading its closing revision: *"FD-31 — CLOSED at v1.20
(2026-07-06)... Not reopened by any subsequent revision; no reopening basis
exists anywhere in the chain."* `F-Deploy-1_Fix_Plan_v1.49.md` carries
forward: *"F-Deploy-1 remains CLOSED... Prod FROZEN."*

**FD-31's specific mismatch is recorded reconciled. This document does not
assert or imply that it is not.** What it asserts is narrower and does not
depend on FD-31's current state either way: a config edit to a process
that is not restarted has no effect, restarting a frozen production
process is barred to any agent session, and whether that restart would be
safe *today* is a question the register's own Gate G0 says cannot be
answered from the repository — not a question this document answers, and
not one FD-31's closure answers either, since FD-31 was closed by a
specific, executed, verified realignment, not by a standing guarantee that
no future mismatch can occur. **The hazard class — a process/config
mismatch a restart would expose — is the same one FD-31 named. The
instance is not FD-31 recurring; no evidence establishes recurrence, and
none was sought here.**

# §5. No rollback path exists for this sequence

`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` names no rollback or abort
path anywhere in its text:

```
$ git show origin/main:docs/audit/F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md | grep -in "rollback\|abort\|revert"
(no output)
```

Gate G0 is binary (confirmed or not confirmed; nothing proceeds either
way) and Gate G3 names a rebase requirement for a conflict, not a failure
recovery.

**The only rollback analysis on file addresses a different branch's
mechanism and is not cited by this sequence.** `F-AUTH-1_Rollback_Scope_2026-08-24.md`
was written against Branch A (new dev pool, existing pool retained as
prod) and concludes rollback under that design *"can only be a second
repoint,"* with the target itself named as *"Evoni's decision... not
resolved by this document."* Branch B's mechanism is the reverse — new prod
pool, existing pool retained as dev — and no document establishes that
Branch A's rollback analysis transfers, partially or at all. **The
execution sequence does not raise the question, and this document does not
answer it.**

# §6. What this document does not do

- **Does not reopen FD-31.** §4. FD-31 is CLOSED at `v1.20` and unreopened
  through the current chain; nothing here disturbs that.
- **Does not claim a restart is unsafe**, or that FD-31's specific
  mismatch currently exists. §3, §4.
- **Does not resolve Gate G0, G1, G2, or G3.** Each remains as
  `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` left it.
- **Does not propose a restart mechanism, a rollback procedure, or any
  addition to the sequence.** Recording a gap is not filling it.
- **Does not mint** an FD, XK, or PE number, and does not characterize the
  gap as a defect, dead code, or missing wiring beyond what is quoted.
- **Does not edit** `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`,
  `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`, `F-Deploy-1_PROD_SplitBrain_HAZARD.md`,
  or any other filed document. All stay on `main`, unedited, as filed.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-05. Basis `origin/main` at `13c467c65`.
Records a gap; resolves nothing. Mints nothing. No AWS call issued. No
deployed host contacted. No workflow dispatched. Prod FROZEN.*
