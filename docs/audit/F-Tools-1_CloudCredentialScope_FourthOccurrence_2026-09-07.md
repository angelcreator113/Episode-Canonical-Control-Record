| **PRIME STUDIOS** **F-TOOLS-1 — CLOUD-SESSION GIT-DELETE REFUSAL, FOURTH OCCURRENCE** *Records a fourth cloud-session `git push origin --delete` HTTP 403 refusal, reproduced against three branches on 2026-09-07, paired in the same session with two plain pushes that succeeded without error. The refusal is specific to `--delete`; write access otherwise works. The open question from all three predecessors — credential-scope limit or policy-layer effect — is not settled here. Proposes no disposition. Mints no PE.* |
| --- |

**Document version**

v1.0 — **A FOURTH DATA POINT, NOT A NEW CLAIM.** This document does not
re-derive any predecessor's reasoning; it records a fourth, independently-run
occurrence of the same refusal, one day after `..._LaptopContrast_2026-09-06.md`,
against three specific already-merged branches, confirmed not transient by a
same-target verbose retry against one of the three and reproduced
independently (three separate single-ref attempts, not one batched request)
against all three. **Mints nothing. Rules nothing.**

**Basis:** `origin/main` at `ec8ad0f3e6c3dd4e9206ee977127d6000f5e5428`,
2026-09-07. All reads and probes run live from this cloud session against its
own credentials; no host, AWS, database, or Cognito contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only**, same posture as its three predecessors
(`F-Tools-1_CloudCredentialScope_2026-09-05.md`,
`..._SecondOccurrence_2026-09-06.md`, `..._LaptopContrast_2026-09-06.md`).
Supplies a fourth boundary measurement for Evoni's disposition; does not
itself dispose. No FD, XK, or PE number is minted. Prod **FROZEN**.

---

# §1–§6

**1.** A cloud session attempted `git push origin --delete
claude/issue-1273-project-context-refresh` on 2026-09-07 and received HTTP
403:

```
$ git push origin --delete claude/issue-1273-project-context-refresh
[pre-push validation, all clean]
fatal: --negotiate-only needs one or more --negotiation-tip=*
warning: push negotiation failed; proceeding anyway with push
error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly
Everything up-to-date
```

The `fatal: --negotiate-only needs one or more --negotiation-tip=*` line
above is unexplained by this document and not relied on for any claim here.

Retried with `GIT_CURL_VERBOSE=1` against the same target to establish it was
not transient:

```
=> Send header: POST /angelcreator113/Episode-Canonical-Control-Record/git-receive-pack HTTP/1.1
<= Recv header: HTTP/1.1 403 Forbidden
<= Recv header: Content-Type: application/x-git-receive-pack-result
<= Recv header: Transfer-Encoding: chunked
<= Recv header: Connection: close
```

The refusal reproduced against this single ref — a clean 403 on the
`git-receive-pack` POST itself, before any pack negotiation, not a network
fault. **Separately, later in the same session** (after `#1296` and `#1297`
had been pushed and merged), a `for` loop ran three independent, sequential
plain `git push origin --delete` commands — one per branch, not one request
naming multiple refs — against `claude/issue-1273-project-context-refresh`,
`claude/issue-1296-loopback-probe`, and `claude/issue-1297-route-health-env-leak`
in turn. **Each of the three individual attempts reproduced the identical
pre-push-validation-then-403 shape**, matching §1's first block above. This
later round did not use `GIT_CURL_VERBOSE` — the header-level evidence
above is specific to the single-ref retry against
`claude/issue-1273-project-context-refresh`, not re-captured for `#1296` or
`#1297`'s refusals.

**2.** Minutes later, the same three refs were deleted from Evoni's laptop
and verified absent from this cloud session by `git ls-remote origin
claude/issue-1273-project-context-refresh claude/issue-1296-loopback-probe
claude/issue-1297-route-health-env-leak`, which returned no output (exit 0)
against all three. ATTESTED as to Evoni's running of the laptop-side delete
commands (this document does not hold their raw output); the resulting
absence from `origin` is MEASURED directly by this session's own
`ls-remote` read.

**3.** This is a sharper contrast than `..._LaptopContrast_2026-09-06.md`.
That document paired a cloud refusal with a laptop success on a *comparable*
branch (`claude/issue-1279-shared-sequelize`, refused by a cloud session,
deleted successfully from the laptop). Here the laptop deleted the *same
three refs* a cloud session had just been refused on, on the same day,
against the same repository.

**4.** Same session, same credential, plain pushes succeeded:
`claude/issue-1296-loopback-probe` and `claude/issue-1297-route-health-env-leak`
pushed to `origin` without error. The refusal is specific to `--delete`, not
to write access generally. **This pairing is not new.**
`F-Tools-1_CloudCredentialScope_2026-09-05.md` records it in its own title
line and compares the refused delete's `git-receive-pack` response against a
successful push's (403 without `X-Github-Request-Id`, 200 with) at lines
166–170; `..._SecondOccurrence_2026-09-06.md` states the successful-push
shape reproduced there too, citing its issue-#1289 push. This is at least
the third reproduction of the same pairing, and it is recorded here as
reproduction, not as a finding.

**5.** The open question from all three predecessors is unchanged and not
settled here: whether the 403 is a credential-scope limit or a policy-layer
effect on the cloud session's egress path. §4 narrows it — a scope that
permits push but forbids delete is consistent with both readings — but does
not decide it.

**6.** Provenance: the cloud-side facts in §1 and §4 come from the session
that experienced them, which is also the session that reported this
document's subject matter. Not independently verified by any party outside
that session. §2's laptop-side act (running the delete commands) is
ATTESTED to Evoni; this document's own verification of the resulting
absence is a direct, reproducible read any session with repository access
could re-run. Session-proposed wording; Evoni-approved.

**Mints nothing. Rules nothing. Proposes no disposition.**

---

# What this document does not do

- **Does not decide** whether the 403 is a credential-scope limit or a
  policy-layer effect. Open across all four documents in this chain.
- **Does not mint** a PE, FD, or XK number.
- **Does not edit** `F-Tools-1_CloudCredentialScope_2026-09-05.md`,
  `..._SecondOccurrence_2026-09-06.md`, or `..._LaptopContrast_2026-09-06.md`.
  All stay on `main`, unedited, as filed. This is a new, standalone file
  only, per the register's immutability rule.
- **Does not hold or assert raw output for the laptop-side delete
  commands.** §2's actor-level claim is ATTESTED, not MEASURED; only the
  resulting absence from `origin` is MEASURED by this document's own read.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-07. Basis `origin/main` at `ec8ad0f3e`. Records a fourth
occurrence; proposes no disposition; mints no PE. No AWS call issued. No
deployed host contacted. No workflow dispatched. Prod FROZEN.*
