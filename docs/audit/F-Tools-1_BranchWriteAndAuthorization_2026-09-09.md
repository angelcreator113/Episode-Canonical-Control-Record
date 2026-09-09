| **PRIME STUDIOS** **F-TOOLS-1 — BRANCH WRITE AND AUTHORIZATION SEQUENCE, 2026-09-09** *Records the commit provenance of the two same-day commits on `claude/issue-1317-wakeup-amd-numeric-sort`, the outcomes of PR #1318 (merged), PR #1320 (closed unmerged), and issue #1319 (closed), the unmerged document at `f7b5964a`'s own sourcing labels, two authorization crossings recorded as ATTESTED-from-issue-text, and two CANNOT-TELLs on the dispatch and dialog-selection origin. Takes no position on defect status. Mints nothing.* |
| --- |

**Author declaration.** This session has no transcript. Its sources are (a) commands run in this session, standing MEASURED, and (b) issue #1321's own body text, Evoni's account written into a task, standing ATTESTED-from-issue-text. No line below claims a transcript, chat record, or "as conveyed by" source. Where a fact cannot be carried at either standing, that is said, and the fact is left unrecorded.

**Standing.** MEASURED for §1–§4 (repo- and API-derivable, command and raw output pasted). §5–§7 are ATTESTED-from-issue-text, labelled on every line. §8 carries two CANNOT-TELLs, first-class, with Evoni's statements recorded as ATTESTED-from-issue-text where the issue text attributes a statement to her.

**Basis:** `origin/main` at `914001a3f55b30330eb1d7a66f9fa5a6a941ed51`.

```
$ git rev-parse origin/main
914001a3f55b30330eb1d7a66f9fa5a6a941ed51
```

---

## 1. Basis, MEASURED

Derived directly in this session, above. Not carried from any predecessor document.

---

## 2. The two #1317 commits, MEASURED

```
$ git show --format=fuller --no-patch 76506bf1
commit 76506bf1f46bb664b3c99b83f96d16f21b785e28
Author:     Claude <noreply@anthropic.com>
AuthorDate: Wed Sep 9 16:49:14 2026 +0000
Commit:     Claude <noreply@anthropic.com>
CommitDate: Wed Sep 9 16:49:14 2026 +0000

    fix(tooling): sort wake-up Owed Index scan numerically [skip-automerge]

    Task: #1317

    Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_019wJprR5wLd2F5cTMjNqaRn
```

```
$ git show --format=fuller --no-patch 1cbf7675
commit 1cbf7675c37fd9917c1909b2a90fb4cd424e3788
Author:     Evoni <evonifoster@yahoo.com>
AuthorDate: Wed Sep 9 13:33:49 2026 -0400
Commit:     Evoni <evonifoster@yahoo.com>
CommitDate: Wed Sep 9 13:41:32 2026 -0400

    fix(tooling): add numeric Owed Index selection to wake-up [skip-automerge]

    Task: #1317
```

`76506bf1` carries an explicit `Claude-Session:` trailer naming `session_019wJprR5wLd2F5cTMjNqaRn`. `1cbf7675` carries no session trailer.

**Author/committer logins.** This session has no `gh` CLI (confirmed by this environment's own operating instructions, which route all GitHub interaction through GitHub MCP server tools). The equivalent read was taken via the `mcp__github__get_commit` tool, `detail: "none"`, against the same two SHAs — a GitHub API read, not a `gh api` shell invocation, recorded here as what was actually run:

```
mcp__github__get_commit(owner="angelcreator113", repo="Episode-Canonical-Control-Record",
                         sha="76506bf1f46bb664b3c99b83f96d16f21b785e28", detail="none")
→
{"sha":"76506bf1f46bb664b3c99b83f96d16f21b785e28",
 "commit":{"author":{"name":"Claude","email":"noreply@anthropic.com","date":"2026-09-09T16:49:14Z"},
           "committer":{"name":"Claude","email":"noreply@anthropic.com","date":"2026-09-09T16:49:14Z"}},
 "author":{"login":"claude","id":81847},
 "committer":{"login":"claude","id":81847}}
```

```
mcp__github__get_commit(owner="angelcreator113", repo="Episode-Canonical-Control-Record",
                         sha="1cbf7675c37fd9917c1909b2a90fb4cd424e3788", detail="none")
→
{"sha":"1cbf7675c37fd9917c1909b2a90fb4cd424e3788",
 "commit":{"author":{"name":"Evoni","email":"evonifoster@yahoo.com","date":"2026-09-09T17:33:49Z"},
           "committer":{"name":"Evoni","email":"evonifoster@yahoo.com","date":"2026-09-09T17:41:32Z"}},
 "author":{"login":"angelcreator113","id":212567798},
 "committer":{"login":"angelcreator113","id":212567798}}
```

GitHub attributes `76506bf1` to the `claude` login and `1cbf7675` to `angelcreator113`, matching the local commit identities.

**Merge-base:**

```
$ git merge-base 76506bf1 1cbf7675
76506bf1f46bb664b3c99b83f96d16f21b785e28
```

The merge-base is `76506bf1` itself, reported exactly as the command shows it: `1cbf7675` has `76506bf1` as an ancestor. This is a linear relationship, not a divergence between two independent tips — the command does not report two commits with a common ancestor other than one of themselves.

**Timestamps.** `76506bf1`: `AuthorDate`/`CommitDate` `2026-09-09T16:49:14Z`. `1cbf7675`: `AuthorDate` `2026-09-09T13:33:49-04:00` (`= 17:33:49Z`), `CommitDate` `2026-09-09T13:41:32-04:00` (`= 17:41:32Z`). `1cbf7675`'s author and commit timestamps both postdate `76506bf1`'s by roughly 44–52 minutes.

---

## 3. Outcomes, MEASURED

**PR #1318 — merged.**

```
mcp__github__pull_request_read(method="get", pullNumber=1318)
→ state: "closed", merged: true, merged_by: "angelcreator113"
  head: {ref: "claude/issue-1317-wakeup-amd-numeric-sort", sha: "1cbf7675c37fd9917c1909b2a90fb4cd424e3788"}
  base: {ref: "main", sha: "1157f06c82f5f12589f54069d231a384b33f0957"}
  additions: 1, deletions: 1, changed_files: 1, commits: 2
  created_at: "2026-09-09T17:47:56Z", merged_at: "2026-09-09T17:52:15Z"
```

```
$ git diff 1157f06c82f5f12589f54069d231a384b33f0957 914001a3f55b30330eb1d7a66f9fa5a6a941ed51 --stat
 .claude/skills/wake-up/SKILL.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Squash-merged onto `main` as `914001a3`. One file, one line changed (one insertion, one deletion — the same line replaced).

```
$ git ls-remote --heads origin claude/issue-1317-wakeup-amd-numeric-sort
1cbf7675c37fd9917c1909b2a90fb4cd424e3788        refs/heads/claude/issue-1317-wakeup-amd-numeric-sort
```

Branch retained at the remote, tip unchanged at `1cbf7675`.

**PR #1320 — closed unmerged.**

```
mcp__github__pull_request_read(method="get", pullNumber=1320)
→ state: "closed", merged: false, mergeable_state: "clean"
  head: {ref: "claude/issue-1319-concurrent-branch-write", sha: "f7b5964a12e4fe91565e687632c4376484c47ce5"}
  base: {ref: "main", sha: "914001a3f55b30330eb1d7a66f9fa5a6a941ed51"}
  additions: 150, changed_files: 1, commits: 1
  created_at: "2026-09-09T18:04:08Z", closed_at: "2026-09-09T18:19:12Z"
```

Closing comment, in full:

> Closing unmerged. The filed document's §3/§4 assert ATTESTED-from-transcript provenance this session never had (its only source was the issue body's own prose, not any transcript). The push and this PR were also opened on a structured-dialog answer alone, without in-channel confirmation, contrary to standing guidance. Branch left in place as the record of the attempt. Re-scoped work follows in a replacement issue.

**Issue #1319 — closed.**

Closing comment, in full:

> Closing unused. This issue's body carried the unreworded stop test and the wrong sourcing instruction for step 4 (ATTESTED-from-transcript, when the actual available source is the issue text itself, not a transcript). Re-scoped as a replacement issue, which also now covers the two same-day authorization crossings surfaced while working this one.

**Branch retention, confirmed:**

```
$ git ls-remote --heads origin claude/issue-1319-concurrent-branch-write
f7b5964a12e4fe91565e687632c4376484c47ce5       refs/heads/claude/issue-1319-concurrent-branch-write
```

`claude/issue-1319-concurrent-branch-write` remains present on the remote at `f7b5964a`, matching PR #1320's recorded head SHA.

---

## 4. `f7b5964a`'s document, MEASURED as an unmerged artifact

`f7b5964a` is the tip of the retained, unmerged branch `claude/issue-1319-concurrent-branch-write` (§3 above). It was never merged — PR #1320 closed unmerged, and no other reference on `origin` carries this content. What follows is read from that branch tip directly, not from any filed register document:

```
$ git show f7b5964a12e4fe91565e687632c4376484c47ce5:docs/audit/F-Tools-1_ConcurrentBranchWrite_2026-09-09.md
```

Its own standing line, quoted verbatim:

> **Standing:** MEASURED for items 1–3 and 6 (repo-derivable, command + output pasted). Items 4–5 are ATTESTED-from-transcript (relayed chat record, not a repo read). Item 7 is CANNOT-TELL on the face, with Evoni's statement recorded as ATTESTED.

Its §3 heading, quoted verbatim:

> ### 3. The push/rebase/push sequence, ATTESTED-from-transcript

Its §4 heading, quoted verbatim:

> ### 4. Authorization timing, ATTESTED-from-transcript

Both §3 and §4 are labelled, on the document's own face, `ATTESTED-from-transcript` — a transcript f7b5964a's authoring session (per its author declaration, quoted within the same document) states it does not have access to, since it was "asked whether it was the disqualified session" and "was told by Evoni in-channel that it is a new session," with no transcript of its own covering #1317's push and PR. This document does not resolve or characterize that self-assertion further. It is recorded here as what `f7b5964a`'s document asserts about its own sourcing, on an unmerged branch that never landed on `main`, not as a filed register document and not as authority for anything beyond its own retained-artifact status.

---

## 5. Crossing one — #1317, ATTESTED-from-issue-text

ATTESTED-from-issue-text: a push was authorized against a diff read before the branch diverged; the push that followed carried a rebase onto another commit and a conflict resolution in the file, neither shown before the push.

---

## 6. Crossing two — #1319, ATTESTED-from-issue-text

ATTESTED-from-issue-text: that session rendered a single structured-dialog question, "Push claude/issue-1319-concurrent-branch-write and open the PR against main for issue #1319?", with options "Yes, push and open the PR" (flagged recommended: true) and "No, stop here - I'll push/PR myself", freeform input enabled. The tool returned the affirmative selection with no freeform text. It pushed and opened PR #1320 on that alone.

ATTESTED-from-issue-text: Evoni states she gave no such approval and was not in that session. Recorded as her statement.

---

## 7. The standing memory note, ATTESTED-from-issue-text

ATTESTED-from-issue-text: a user-scope memory note held by that session, `/memories/shell-quoting.md` line 6, states that structured-dialog answers are low-friction and invisible in-channel, that audit-grade decisions require the user's explicit words in chat, and that "confirm recorded" must never be written on dialog-only answers. Line 15 of the same file separately forbids inferring push/PR/merge/delete approval from routed prose or status summaries.

ATTESTED-from-issue-text: the note predates 2026-09-09 and was available to that session. Its author or origin is not established and is not named here.

---

## 8. CANNOT-TELL, first-class

**(a) What dispatched cloud session `019wJprR5wLd2F5cTMjNqaRn`.** A session ID does not carry its own origin. Not repo-derivable — no read available to this session (git history, the commit trailer, or the GitHub API reads in §2–§3) states what initiated that session. CANNOT-TELL.

**(b) What produced the affirmative dialog selection in #1319.** Per the issue text, the returning session states it can see no timestamp, client identity, or means of distinguishing a human click from an auto-resolution of the recommended flag. Neither is settled by any read available to this session. CANNOT-TELL.

---

## 9. What this document does not do

- Takes no position on whether either crossing, or the concurrent branch write in §2–§4, is a defect.
- Mints no FD, PE, or XK number.
- Names no remedy.
- Does not characterize the relationship between crossing one (§5) and crossing two (§6) — each is recorded on its own terms, from its own source.
- Does not treat `f7b5964a`'s document as filed or authoritative; §4 records only what it asserts about itself, as an unmerged artifact.
- Edits no file outside its own path. Adds no banner to any other document.
- Makes no host, AWS, database, or Cognito contact.

---

*Type: standalone tooling record. Rules nothing. Mints no FD, XK, or PE. No host, AWS, database, or Cognito contact. Prod FROZEN.*
