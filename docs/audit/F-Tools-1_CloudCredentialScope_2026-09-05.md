| **PRIME STUDIOS** **F-TOOLS-1 — CLOUD-SESSION GIT-DELETE REFUSAL** *Records that a cloud session's `git push origin --delete` is refused (HTTP 403), that three other git/tool capabilities from the same session succeed, and that the response-header evidence points at an egress-policy layer rather than confirming a GitHub-side credential-scope explanation. Proposes no disposition. Mints no PE. Does not compare against the laptop-CLI credential — that comparison is unmeasured.* |
| --- |

**Document version**

v1.0 — **RECORDS A REFUSAL, NOT A CONFIRMED CAUSE.** A cloud session's
`git push origin --delete` against an already-merged, already-stale branch
is refused (HTTP 403). The same session's push, issue-read, and repo-read
all succeed. The `mcp__github__*` tool surface has no branch/ref-delete
capability at all — an absent tool, not a refused credential, and the
finding is explicit about which of the two this is. The refused response's
own headers point at an egress-policy layer answering before GitHub's git
backend does, not at a confirmed credential-scope limit — see §3. **Mints
nothing. Rules nothing.**

**Basis:** `origin/main` at `31eb060c54d97c036c21bf4b12878ab5d5722fa8`,
2026-09-05. All reads and probes run live from this cloud session against
its own credentials; no host, AWS, database, or Cognito contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only.** Supplies a boundary measurement for Evoni's
disposition; does not itself dispose. No FD, XK, or PE number is minted.
Prod **FROZEN**.

---

# §0. Owed-check

```
$ ls docs/audit | grep -i "credential"
F-Deploy-1_3_Credential_Discovery_Opening_Step.md
F-Deploy-1_BoxSide_Credential_Reconcile_Outcome_2026-06-02.md
F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md
F-Deploy-1_Canon_Credential_Durability_Finding_2026-06-12.md
F-Deploy-1_Canon_Credential_Durability_Plan_2026-06-12.md
F-Deploy-1_Canon_Credential_Durability_Scoping_Outcome_2026-06-12.md
F-Deploy-1_Canon_Credential_Exposure_Finding_2026-06-14_DRAFT.md
F-Deploy-1_Canon_Credential_Rotation_Session_Brief_DRAFT.md
F-Deploy-1_Decision_Analysis_CredentialRecovery_vs_Rotation_2026-06-14.md
F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md
F-Deploy-1_FD41_Credential_Adjudication_2026-06-21_SESSION2.md
F-Deploy-1_FD42_Phase1_OffBox_Credential_Precondition_DRAFT_2026-06-22.md
F-Deploy-1_Finding_BoxEnv_CredentialDrift_2026-06-13.md
F-Deploy-1_Finding_CredentialRecovery_SurfaceStatus_2026-06-13.md
F-Deploy-1_ThirdParty_Credential_Rotation_Order_2026-06-30_DRAFT.md
F-Deploy-1_[3]_Credential_Branch_Execution_Runbook.md
F-Tools-1_Tooling_Environment_Audit.md

$ grep -in "delete-ref\|delete.*branch\|git push.*delete\|403" docs/audit/F-Tools-1_Tooling_Environment_Audit.md
(no output)
```

Every existing `Credential`-named document is `F-Deploy-1` (production
box/RDS credential rotation and recovery) — an unrelated topic. The one
existing `F-Tools-1` document contains no reference to this question. Item
confirmed still owed.

---

# §1. The refusal, reproduced fresh

```
$ git push origin --delete claude/issue-1268-carrier-redirect-race
fatal: --negotiate-only needs one or more --negotiation-tip=*
warning: push negotiation failed; proceeding anyway with push
error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly
Everything up-to-date
```

Re-run with `GIT_CURL_VERBOSE=1` to capture the actual HTTP exchange
underneath that summary:

```
=> Send header: POST /angelcreator113/Episode-Canonical-Control-Record/git-receive-pack HTTP/1.1
=> Send header: Host: github.com
=> Send header: Content-Type: application/x-git-receive-pack-request
=> Send header: Content-Length: 214

<= Recv header: HTTP/1.1 403 Forbidden
<= Recv header: Content-Type: application/x-git-receive-pack-result
<= Recv header: Transfer-Encoding: chunked
<= Recv header: Connection: close
```

**No `x-deny-reason` header, and no `X-Github-Request-Id` header, on this
response.** That absence is the load-bearing fact — see §3.

The branch tried against still exists (the delete did not silently
succeed):

```
$ git ls-remote origin refs/heads/claude/issue-1268-carrier-redirect-race
b2b28360c7ed857e41b8849b3e2be3544c0940c8	refs/heads/claude/issue-1268-carrier-redirect-race
```

Also checked and empty — ruling out a bare local-proxy connection abort
being misread as a clean 403 (the agent proxy's own README: *"check
recentRelayFailures in the status output before concluding the remote
service refused the operation"*):

```
$ curl -sS http://127.0.0.1:41053/__agentproxy/status
{
  ...
  "recentRelayFailures": [],
  ...
}
```

# §2. What this credential CAN do — three capabilities, re-derived fresh, not cited from session memory

**Push a branch** (this document's own branch, real output, same
`git-receive-pack` endpoint as the refused delete):

```
=> Send header: POST /angelcreator113/Episode-Canonical-Control-Record/git-receive-pack HTTP/1.1
=> Send header: Content-Length: 247

<= Recv header: HTTP/1.1 200 OK
<= Recv header: X-Github-Request-Id: 4052:1AF1E3:34B1EEF:480985B:6A9C89A8
<= Recv header: Content-Type: application/x-git-receive-pack-result
...
To https://github.com/angelcreator113/Episode-Canonical-Control-Record
 * [new branch]          claude/issue-1277-cloud-credential-scope -> claude/issue-1277-cloud-credential-scope
```

**Read an issue** (`mcp__github__issue_read`, method `get`, this task's
own issue, fetched fresh in this session):

```
{"number":1277,"title":"[task] PE finding: derive the cloud-session credential's git scope", ...,"state":"open", ...}
```

**Read the repo** (`git show` against `origin/main`, this session):

```
$ git show origin/main:package.json | head -3
{
  "name": "episode-metadata-api",
  "version": "1.0.1",
```

# §3. Two credentials, not one — resolved, not left ambiguous

**The `git push` path and the `mcp__github__*` tool path are not the same
mechanism**, and this document does not treat them as interchangeable:

- **`git push`/`git push --delete`** goes out through this session's local
  git client, over HTTPS, through the agent proxy at `127.0.0.1:41053`
  (documented in `/root/.ccr/README.md`: *"tunnels to a policy-enforcing
  egress proxy. TLS is re-terminated there"*), to `github.com`. Whatever
  identity authorizes this path is opaque from inside the session — only
  its behavior is observable.
- **`mcp__github__*` tools** are a separate interface entirely, implemented
  server-side, not routed through this session's local git/HTTPS stack at
  all. Its credential (or credentials) are not the same object as the
  git-push path's, and nothing here assumes they are.

**On the git-push path specifically:** the refused delete's response and
the successful push's response differ in a way worth stating plainly
rather than smoothing over. Both are `POST .../git-receive-pack` against
the same repository in the same session, seconds apart. The successful
push's `200 OK` carries `X-Github-Request-Id`; the refused delete's `403
Forbidden` carries no such header, and no other identifying header either
— four bare headers (`Content-Type`, `Transfer-Encoding`, `Connection`,
and the status line) versus the success's eight. **This is evidence, not
proof, that the 403 originates at a layer between this session and
GitHub's own git backend — the policy-enforcing egress proxy the README
describes — rather than being a GitHub-issued credential-permission
refusal.** GitHub's backend could conceivably omit the header on some
403 paths too; this document does not claim certainty either way, only
that the two responses are observably different in a way that bears on
which layer is answering, and that the difference is stated rather than
assumed away.

**On the `mcp__github__*` tool surface:** searched exhaustively for any
branch- or ref-deletion tool (`select:*delete*`, `+delete`, keyword
searches for "delete branch ref"). Found: `delete_file` (deletes a single
file's content via a commit, not a ref), `create_branch`, `list_branches`
— **no `delete_branch`, `delete_ref`, or equivalent exists anywhere in
this surface.** This is **an absent tool, not a refused credential** — a
materially different fact from §1's git-push refusal, and the two must
not be conflated. Whatever this session's `mcp__github__*` credential can
or cannot authorize, the question of *whether it would be allowed to
delete a ref* cannot even be asked through this interface, because no
such call exists to make.

# §4. The laptop-CLI comparison — explicitly unmeasured

**Nobody has tested the laptop-CLI credential's git scope in this lane,
and this document does not assert what it can do.** No laptop-side
`git push --delete` (or equivalent) attempt is on record to compare
against this session's refusal. The difference between lanes is
**inferred from one 403 in this lane and nothing in the other**, not
derived from a laptop-side test run alongside this one. Record as open:
the laptop-CLI credential's scope is unmeasured here. Closing that
comparison requires a session running in that lane, attempting the same
`git push origin --delete`, with its own pasted output — not an
assumption carried from this document, and not any other laptop-side git
operation (a pull, a restore) substituted for the one this document
actually tests.

---

# §5. What this document does not do

- **Proposes no disposition.** Whether this becomes a PE, and if so what
  it would rule, is Evoni's call — not asserted or anticipated here.
- **Does not mint** a PE, FD, or XK number.
- **Does not conclude** which layer answers the 403 with certainty — §3
  states the evidence and its limits, not a final determination.
- **Does not test or assert the laptop-CLI credential's scope.** §4.
- **Does not delete** any branch — the one delete attempted was refused;
  no other delete was attempted.
- **Does not edit** any other filed document. This is a new, standalone
  file only.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-05. Basis `origin/main` at `31eb060c5`. Records a
boundary; proposes no disposition; mints no PE. No AWS call issued. No
deployed host contacted. No workflow dispatched. Prod FROZEN.*
