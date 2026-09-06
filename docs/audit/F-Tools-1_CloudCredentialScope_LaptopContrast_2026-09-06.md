| **PRIME STUDIOS** **F-TOOLS-1 — CLOUD-SESSION GIT-DELETE REFUSAL, THE LAPTOP-SIDE CONTRAST** *Records the one measurement `F-Tools-1_CloudCredentialScope_2026-09-05.md` §4 named as open and unmeasured: a laptop-side `git push origin --delete` against a branch a cloud session could not delete. Attested by Evoni's direct report, not by a pasted terminal transcript from that machine. The branch's absence from origin is independently re-verified by this session. Strengthens, does not prove, the reading that the asymmetry is credential-scope rather than a universal GitHub-side block. Proposes no disposition. Mints no PE.* |
| --- |

**Document version**

v1.0 — **CLOSES THE MEASUREMENT GAP §4 NAMED, AT THE STANDING THAT GAP ACTUALLY
SUPPORTS.** `F-Tools-1_CloudCredentialScope_2026-09-05.md` §4 stated plainly:
*"nobody has tested the laptop-CLI credential's git scope in this lane... no
laptop-side `git push --delete` (or equivalent) attempt is on record."* That
attempt has now been made, on the exact branch this session's own predecessor
documents recorded a cloud-session refusal against
(`claude/issue-1279-shared-sequelize`), and it succeeded. **This document
records that result at the standing the evidence actually supports — Evoni's
direct report of the action, independently corroborated only as to the
branch's resulting absence, not as to the commands she ran or their raw
output.** Mints nothing. Rules nothing.

**Basis:** `origin/main` at `c487b723ea50d016dded477183e6d235e1a69ec3`,
2026-09-06. All reads and probes in this document run live from this cloud
session against its own credentials; no host, AWS, database, or Cognito
contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only**, same posture as its two predecessors
(`F-Tools-1_CloudCredentialScope_2026-09-05.md`,
`F-Tools-1_CloudCredentialScope_SecondOccurrence_2026-09-06.md`). Supplies the
laptop-side half of a comparison those two documents could only state as
missing. No FD, XK, or PE number is minted. Prod **FROZEN**.

---

# §1. The prior refusals, cited not re-derived

Two documents already on `main` record the cloud-session side of this
comparison directly, with pasted `GIT_CURL_VERBOSE=1` output and header-level
detail:

- `F-Tools-1_CloudCredentialScope_2026-09-05.md` — first occurrence, one
  branch, filed via issue #1277/PR #1278.
- `F-Tools-1_CloudCredentialScope_SecondOccurrence_2026-09-06.md` — second
  occurrence, three branches attempted (batch and single-branch retry), filed
  via issue #1294/PR #1293. `claude/issue-1279-shared-sequelize` was one of the
  three branches refused in that occurrence.

Both establish, independently and consistently: cloud-session
`git push origin --delete` against this repository returns HTTP 403, with a
header asymmetry (no `X-Github-Request-Id` on the refusal, present on a
same-session successful push) pointing at a policy layer rather than
confirming a GitHub-issued credential-scope denial with certainty. Neither is
re-derived here — see those documents for the raw evidence.

---

# §2. The laptop-side result — ATTESTED, not MEASURED

**Evoni's direct report, this conversation, 2026-09-06:** she ran the
deletion herself, from her own machine, against `claude/issue-1279-shared-sequelize`
— the same branch named in §1's second occurrence — and it succeeded. Her
own words: *"Confirmed. `claude/issue-1279-shared-sequelize` was deleted from
the remote and verified absent. PR #1288 remains the durable record of the
work."*

**This session did not observe the command run, the credential used, or any
raw terminal output from that machine.** Per this register's standing-label
convention, that makes the *action* ATTESTED — a direct human report, not a
repo-derivable measurement — and this document does not upgrade it to
MEASURED. This is a narrower evidentiary bar than either predecessor
document met for the cloud-session refusals, which pasted raw command output
directly. The gap is named, not hidden: a future document with a pasted
laptop-side transcript (command, and the actual HTTP exchange if captured)
would close this the rest of the way, the same way §4's original naming of
this gap asked for.

## §2.1 What this session independently re-verified

**The branch's absence from origin — MEASURED, by this session, live:**

```
$ git fetch origin --prune
 - [deleted]             (none)     -> origin/claude/issue-1279-shared-sequelize
$ git ls-remote origin refs/heads/claude/issue-1279-shared-sequelize
(no output — exit code 0, zero matching refs)
```

The branch is gone. This confirms the *outcome* Evoni reported — that a
deletion happened, from some credential, at some point before this fetch —
but confirms neither which credential performed it nor that it was performed
in the specific way described (a `git push origin --delete` from a laptop
CLI, as opposed to, say, GitHub's web UI or another tool). **MEASURED as to
absence. ATTESTED as to mechanism and actor.** Both labels are carried
together deliberately, not merged into one.

## §2.2 The durable record, re-confirmed

**PR #1288, cited by Evoni as "the durable record of the work," is
independently confirmed still on `main`, re-derived fresh for this document
rather than carried from an earlier claim:**

```
$ git log --oneline --all --grep="(#1288)"
8642533e0 fix(db): reuse shared Sequelize connection in Template Studio paths [skip-automerge] (#1288)
```

`8642533e07151a3f9991b362e4466a8615b4cc83` is PR #1288's actual squash-merge
commit on `main`. `claude/issue-1279-shared-sequelize`'s own pre-merge tip
(`7dc11f82de630ae45b9e255e0de5865f91e28e31`) is a different commit — the
branch's last commit before GitHub squashed it into the one above. An
earlier draft of this document named the latter as "PR #1288's squash-merge
commit," which conflates the two; corrected here before this document's own
first merge, not carried forward as an error and banner-corrected after.

The branch-tip-to-`main` comparison itself was re-run fresh for this
document, not carried from memory of an earlier claim in this conversation:

```
$ git diff --name-only 364bda1ad4cf3c6e09b1c28f7f44a09cd4e83f7e 7dc11f82de630ae45b9e255e0de5865f91e28e31
src/routes/compositions.js
src/services/ThumbnailGeneratorService.js
$ git diff --quiet origin/main:src/routes/compositions.js 7dc11f82de630ae45b9e255e0de5865f91e28e31:src/routes/compositions.js && echo MATCH
MATCH
$ git diff --quiet origin/main:src/services/ThumbnailGeneratorService.js 7dc11f82de630ae45b9e255e0de5865f91e28e31:src/services/ThumbnailGeneratorService.js && echo MATCH
MATCH
```

Both files the branch touched are byte-identical to their current `main`
content. Deleting the branch after its content is durably merged loses
nothing.

---

# §3. What this document does and does not establish

**Establishes, at the ATTESTED/MEASURED split stated above:** a credential
distinct from this session's cloud credential — Evoni's own, from her own
machine — was able to delete a branch this session's cloud credential could
not, on the identical branch, within the same short window. That is the
laptop-side data point both predecessor documents named as missing.

**Does not establish:**

- **That the cloud-session 403 is definitively a credential-scope limit
  rather than some other cause.** §3 of the 2026-09-05 document already
  weighed a policy-layer reading against a GitHub-issued-refusal reading and
  left both open; this document adds a laptop-side success but does not by
  itself adjudicate between those two readings, since a policy-layer
  explanation (the egress proxy this session's git traffic is routed through)
  is equally consistent with "the laptop's traffic never goes through that
  proxy at all" as a credential-scope explanation is.
- **That every future laptop-side delete will succeed**, or that every future
  cloud-session delete will be refused. One data point each, not a
  statistical claim.
- **A disposition.** Whether this comparison, now partially closed, warrants
  a PE, a change to how cloud sessions are provisioned, or no action at all
  remains Evoni's call, same as both predecessor documents state of
  themselves.

---

# §4. What this document does not do

- **Proposes no disposition.** Same as its predecessors.
- **Does not mint** a PE, FD, or XK number.
- **Does not conclude** which layer causes the cloud-session 403.
- **Does not claim a pasted laptop-side transcript exists.** None does, as of
  this filing. A future document supplying one would close this fully.
- **Does not audit** the remaining branch backlog named in the second
  occurrence document's §2 — that stays a separate, scoped task if wanted.
- **Does not edit** either predecessor document. New, standalone file only,
  per the register's immutability rule.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-06. Basis `origin/main` at `c487b723e`. Records a
laptop-side contrast, ATTESTED as to action, MEASURED as to outcome;
proposes no disposition; mints no PE. No AWS call issued. No deployed host
contacted. No workflow dispatched. Prod FROZEN.*
