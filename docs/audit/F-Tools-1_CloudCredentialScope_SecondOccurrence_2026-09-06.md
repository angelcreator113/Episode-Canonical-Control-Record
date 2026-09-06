| **PRIME STUDIOS** **F-TOOLS-1 — CLOUD-SESSION GIT-DELETE REFUSAL, SECOND OCCURRENCE** *Records that a second, independent cloud session, one day after `F-Tools-1_CloudCredentialScope_2026-09-05.md`, reproduced the identical `git push origin --delete` HTTP 403 refusal, with the identical header-level asymmetry, against a different branch and a different session. Strengthens the "standing pattern, not per-session fluke" reading without confirming it — the laptop-CLI comparison this document's predecessor named as open remains open. Proposes no disposition. Mints no PE.* |
| --- |

**Document version**

v1.0 — **A SECOND DATA POINT, NOT A NEW CLAIM.** This document does not
re-derive `F-Tools-1_CloudCredentialScope_2026-09-05.md`'s reasoning; it
supplies a second, independently-run occurrence of the same refusal, one day
later, from a different session, against three different branches, and
records where the two occurrences agree and where the open question from the
first document still stands open. **Mints nothing. Rules nothing.**

**Basis:** `origin/main` at `8642533e07151a3f9991b362e4466a8615b4cc83`,
2026-09-06. All reads and probes run live from this cloud session against
its own credentials; no host, AWS, database, or Cognito contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only**, same posture as its predecessor. Supplies a second
boundary measurement for Evoni's disposition; does not itself dispose. No
FD, XK, or PE number is minted. Prod **FROZEN**.

---

# §0. Why this document exists

A separate task this session (unrelated to credential scope) called for
deleting three already-merged, byte-verified-safe branches
(`claude/issue-1279-shared-sequelize`, `claude/issue-1284-api-docs-stale`,
`claude/issue-1283-neutralize-prod-scripts` — each verified: every file the
branch touched matches `origin/main` exactly, so nothing would be lost).
`git push -u origin claude/issue-1289-template-studio-census` (a plain push,
same session, same credentials, minutes earlier) succeeded. The three
deletes did not. This document exists because that asymmetry — push works,
delete doesn't, same session — is exactly what
`F-Tools-1_CloudCredentialScope_2026-09-05.md` already recorded once, and a
second, unprompted occurrence of the identical pattern is evidence worth
filing rather than re-discovering silently in a future session's own
scratch output.

---

# §1. The refusal, reproduced fresh, this session

```
$ git push origin --delete claude/issue-1279-shared-sequelize claude/issue-1284-api-docs-stale claude/issue-1283-neutralize-prod-scripts
[pre-push] Running full validation suite...
[... /validate output, all clean ...]
[pre-push] All checks passed.
fatal: --negotiate-only needs one or more --negotiation-tip=*
warning: push negotiation failed; proceeding anyway with push
error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly
Everything up-to-date
```

Retried once, single-branch, to rule out a batched-delete-specific behavior:

```
$ git push origin --delete claude/issue-1279-shared-sequelize
[... same pre-push validation, all clean ...]
fatal: --negotiate-only needs one or more --negotiation-tip=*
warning: push negotiation failed; proceeding anyway with push
error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly
Everything up-to-date
```

**Consistent across both a three-branch batch and a single-branch retry, not
a one-shot fluke within this session either.**

## §1.1 Header-level comparison, reproduced with the same method as the predecessor document

`GIT_CURL_VERBOSE=1`, same delete target, this session:

```
=> Send header: GET /angelcreator113/Episode-Canonical-Control-Record/info/refs?service=git-receive-pack HTTP/1.1
<= Recv header: HTTP/1.1 200 OK
<= Recv header: X-Content-Type-Options: nosniff
<= Recv header: Content-Security-Policy: default-src 'none'
<= Recv header: Cache-Control: no-cache, max-age=0, must-revalidate
<= Recv header: Pragma: no-cache
<= Recv header: Expires: Fri, 01 Jan 1980 00:00:00 GMT
<= Recv header: Vary: Accept-Encoding
<= Recv header: X-Github-Request-Id: 4047:1B86F:BA6CB3:1035179:6A9D8AFA
<= Recv header: Content-Type: application/x-git-receive-pack-advertisement
<= Recv header: Transfer-Encoding: chunked
<= Recv header: Connection: close

=> Send header: POST /angelcreator113/Episode-Canonical-Control-Record/git-receive-pack HTTP/1.1
<= Recv header: HTTP/1.1 403 Forbidden
<= Recv header: Content-Type: application/x-git-receive-pack-result
<= Recv header: Transfer-Encoding: chunked
<= Recv header: Connection: close
```

**Same asymmetry as the predecessor document, reproduced exactly:** the
negotiation `GET` (discovery) succeeds with a full header set including
`X-Github-Request-Id`; the delete `POST` fails with 403 and only four bare
headers — no `X-Github-Request-Id`, no `x-deny-reason`, no other identifying
header. This session's earlier plain `git push` (issue #1289's branch,
minutes before this probe) returned `200 OK` carrying `X-Github-Request-Id`
on the same `git-receive-pack` endpoint — the successful-push shape from the
predecessor document's §2 also reproduces here, unprompted, from ordinary
task work rather than a dedicated probe.

**Proxy relay ruled out again**, same check as the predecessor document:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status" | python3 -c "import json,sys; d=json.load(sys.stdin); print('recentRelayFailures:', d.get('recentRelayFailures'))"
recentRelayFailures: []
```

## §1.2 The MCP tool surface, re-checked

Same absence as the predecessor document. `ToolSearch` for `"delete branch
github"` and `"git ref delete reference"` against this session's
`mcp__github__*` surface returns `create_branch`, `list_branches`,
`delete_file` (deletes one file's content via a commit, not a ref) — **no
`delete_branch`, `delete_ref`, or equivalent.** Confirmed independently,
same absent-tool finding as §3 of the predecessor document.

---

# §2. What is now two occurrences, not one — stated at the strength the evidence supports, no further

**Two independent cloud sessions, one day apart, both cite the identical
403 with the identical header asymmetry, against different branches, with
the local-proxy-relay explanation ruled out identically both times.** That
is stronger evidence for "this is how this credential's git-delete path
behaves, consistently, across sessions" than either occurrence alone. **It
is not yet proof of a standing, permanent scope limit** — two data points
one day apart do not establish permanence, and neither occurrence rules out
a shared cause upstream of both sessions (the same proxy policy, the same
GitHub App installation, provisioned once and inherited by every cloud
session since) versus two coincidentally identical per-session
misconfigurations. Both readings remain consistent with the evidence; this
document does not choose between them.

**What this second occurrence adds beyond corroboration:** the predecessor
document's §4 named the laptop-CLI comparison as the one measurement that
would close the ambiguity, and flagged that "nobody has tested" it. This
document does not close that gap either — no laptop-side attempt is on
record here — **but it does add a fact the predecessor document could not
have stated: this repository's own branch list, fetched fresh at this
session's wake-up, carries dozens of already-merged `claude/*` branches
dating back weeks, none deleted.** That standing backlog is consistent with
— though not proof of — every prior cloud session having hit the same
refusal this document and its predecessor both measured directly. Filed as
an observation, not a count: no systematic audit of which of those branches
were ever attempted for deletion by a prior session was performed here.

---

# §3. What this document does not do

- **Proposes no disposition.** Whether this becomes a PE, and if so what it
  would rule, is Evoni's call — not asserted or anticipated here, same as
  its predecessor.
- **Does not mint** a PE, FD, or XK number.
- **Does not conclude** which layer answers the 403, and does not upgrade
  the predecessor document's "evidence, not proof" framing to a certainty.
- **Does not test or assert the laptop-CLI credential's scope.** Still open,
  same as the predecessor document's §4.
- **Does not delete** any branch. The three branches named in §0 remain
  undeleted; Evoni or a differently-scoped session would need to delete
  them.
- **Does not edit** `F-Tools-1_CloudCredentialScope_2026-09-05.md` or any
  other filed document. This is a new, standalone file only, per the
  register's immutability rule.
- **Does not audit** the full branch backlog named in §2's closing
  paragraph — that would be a separate, scoped task.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-06. Basis `origin/main` at `8642533e0`. Records a second
occurrence; proposes no disposition; mints no PE. No AWS call issued. No
deployed host contacted. No workflow dispatched. Prod FROZEN.*
