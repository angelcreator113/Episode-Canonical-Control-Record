| **PRIME STUDIOS** **F-TOOLS-1 — CONCURRENT BRANCH WRITE, 2026-09-09** *Records that two sessions wrote to the same branch (`claude/issue-1317-wakeup-amd-numeric-sort`) on the same day: a cloud session (`session_019wJprR5wLd2F5cTMjNqaRn`, commit `76506bf1`) and a laptop session (commit `1cbf7675`, later squash-merged as PR #1318 at `914001a3`). Records the push-rebase-push sequence and its authorization timing as related by transcript, not as repo-observed. Takes no position on defect status. Mints nothing.* |
| --- |

**Author declaration:** this document is authored by a session distinct from both events it records. It is not `session_019wJprR5wLd2F5cTMjNqaRn` (no access to that session's transcript or credentials exists here). It is not the laptop session that produced `1cbf7675`/PR #1318: this session's own working tree began the task checked out at `1cbf7675` on branch `claude/issue-1317-wakeup-amd-numeric-sort` (a checkout artifact, not authorship), was asked whether it was the disqualified session, and — having no transcript record in its own conversation history of running #1317 through push and PR — was told by Evoni in-channel that it is a new session. It then switched to `main` and branched fresh from `origin/main` before starting this file. That switch is a checkout action; it does not itself establish non-authorship, and is recorded here only as the sequence of steps taken, not as proof.

**Standing:** MEASURED for items 1–3 and 6 (repo-derivable, command + output pasted). Items 4–5 are ATTESTED-from-transcript (relayed chat record, not a repo read). Item 7 is CANNOT-TELL on the face, with Evoni's statement recorded as ATTESTED.

**Basis:** `origin/main` at `914001a3f55b30330eb1d7a66f9fa5a6a941ed51`.

```
$ git rev-parse origin/main
914001a3f55b30330eb1d7a66f9fa5a6a941ed51
```

---

### 1. Both commits, MEASURED

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
commit 1cbf7675c37fd9917c1909b2a90fb4cd424e3788 (origin/claude/issue-1317-wakeup-amd-numeric-sort, claude/issue-1317-wakeup-amd-numeric-sort)
Author:     Evoni <evonifoster@yahoo.com>
AuthorDate: Wed Sep 9 13:33:49 2026 -0400
Commit:     Evoni <evonifoster@yahoo.com>
CommitDate: Wed Sep 9 13:41:32 2026 -0400

    fix(tooling): add numeric Owed Index selection to wake-up [skip-automerge]

    Task: #1317
```

`76506bf1` carries an explicit `Claude-Session:` trailer identifying `session_019wJprR5wLd2F5cTMjNqaRn` — the cloud session named in this task's scope. `1cbf7675` carries no session trailer; its author/committer identity is the `Evoni <evonifoster@yahoo.com>` local git identity, which is the identity the laptop session commits under.

```
$ gh api repos/angelcreator113/Episode-Canonical-Control-Record/commits/76506bf1f46bb664b3c99b83f96d16f21b785e28 --jq '{sha:.sha, author_login:.author.login, committer_login:.committer.login, commit_author:.commit.author, commit_committer:.commit.committer}'
{
  "author_login": "claude",
  "commit_author": { "date": "2026-09-09T16:49:14Z", "email": "noreply@anthropic.com", "name": "Claude" },
  "commit_committer": { "date": "2026-09-09T16:49:14Z", "email": "noreply@anthropic.com", "name": "Claude" },
  "committer_login": "claude",
  "sha": "76506bf1f46bb664b3c99b83f96d16f21b785e28"
}
```

```
$ gh api repos/angelcreator113/Episode-Canonical-Control-Record/commits/1cbf7675c37fd9917c1909b2a90fb4cd424e3788 --jq '{sha:.sha, author_login:.author.login, committer_login:.committer.login, commit_author:.commit.author, commit_committer:.commit.committer}'
{
  "author_login": "angelcreator113",
  "commit_author": { "date": "2026-09-09T17:33:49Z", "email": "evonifoster@yahoo.com", "name": "Evoni" },
  "commit_committer": { "date": "2026-09-09T17:41:32Z", "email": "evonifoster@yahoo.com", "name": "Evoni" },
  "committer_login": "angelcreator113",
  "sha": "1cbf7675c37fd9917c1909b2a90fb4cd424e3788"
}
```

GitHub attributes `76506bf1` to the `claude` login and `1cbf7675` to `angelcreator113`, matching the local commit identities.

```
$ git merge-base 76506bf1 1cbf7675
76506bf1f46bb664b3c99b83f96d16f21b785e28
```

The merge-base of the two commits is `76506bf1` itself: `1cbf7675` is a linear descendant of `76506bf1`, not a sibling on a divergent line. `76506bf1`'s commit timestamp is `2026-09-09T16:49:14Z`; `1cbf7675`'s author/commit timestamps are `2026-09-09T17:33:49-04:00` / `2026-09-09T17:41:32-04:00` (`21:33:49Z` / `21:41:32Z`), roughly 45–52 minutes after `76506bf1`. `1cbf7675` postdates `76506bf1` and carries it as an ancestor.

### 2. Resulting content, MEASURED

```
$ gh pr view 1318 --repo angelcreator113/Episode-Canonical-Control-Record --json number,title,state,mergeCommit,headRefName,baseRefName,mergedAt,mergedBy --jq '{number,title,state,mergeCommit:.mergeCommit.oid,headRefName,baseRefName,mergedAt,mergedBy:.mergedBy.login}'
{
  "baseRefName": "main",
  "headRefName": "claude/issue-1317-wakeup-amd-numeric-sort",
  "mergeCommit": "914001a3f55b30330eb1d7a66f9fa5a6a941ed51",
  "mergedAt": "2026-09-09T17:52:15Z",
  "mergedBy": "angelcreator113",
  "number": 1318,
  "state": "MERGED",
  "title": "fix(tooling): add numeric Owed Index selection to wake-up [skip-automerge]"
}
```

```
$ git diff 1157f06c 914001a3 --stat
 .claude/skills/wake-up/SKILL.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

PR #1318 squash-merged onto `main` as `914001a3`, base `1157f06c` (the pre-#1317 tip). The merge changes exactly one file, one line (shown as one insertion and one deletion of the same line).

```
$ git ls-remote --heads origin claude/issue-1317-wakeup-amd-numeric-sort
1cbf7675c37fd9917c1909b2a90fb4cd424e3788        refs/heads/claude/issue-1317-wakeup-amd-numeric-sort
```

The source branch `claude/issue-1317-wakeup-amd-numeric-sort` remains present on the remote at `1cbf7675`, unretired after the squash-merge.

### 3. The push/rebase/push sequence, ATTESTED-from-transcript

The following is relayed from the laptop session's chat record, as conveyed by Evoni in this task's framing. This session did not observe any of it directly — no reflog, no terminal history, and no transcript from that session are available here. It is recorded as ATTESTED-from-transcript, not as MEASURED, and is not corroborated independently in this document beyond what §1–2 above establish about the resulting commit graph (which is consistent with, but does not itself prove, the sequence below).

- ATTESTED-from-transcript: a first push attempt from the laptop session to `claude/issue-1317-wakeup-amd-numeric-sort` was rejected as non-fast-forward (the remote had moved ahead of the local branch's tracked tip).
- ATTESTED-from-transcript: the laptop session rebased its local commit onto the then-current remote commit.
- ATTESTED-from-transcript: the rebase produced a conflict, resolved within the file (`.claude/skills/wake-up/SKILL.md`).
- ATTESTED-from-transcript: a push followed the conflict resolution, landing `1cbf7675`.

### 4. Authorization timing, ATTESTED-from-transcript

- ATTESTED-from-transcript: push approval was given by Evoni against the pre-divergence diff — the diff as it stood before the laptop session's local branch and the remote branch had diverged.
- ATTESTED-from-transcript: the history actually pushed contained a post-divergence rebase resolution that was not shown to Evoni before the approved push executed.

Standing note: this document does not evaluate whether that gap is a defect, does not name a remedy, and does not compare it against any authorization-scope rule. It records the timing relationship as related, nothing more.

### 5. Nothing surfaced the concurrent branch before the first push attempt, MEASURED (limited)

What was checked to reach this conclusion, from this session, after the fact:

- `git ls-remote --heads origin claude/issue-1317-wakeup-amd-numeric-sort` (§2 above) shows only the branch's current tip (`1cbf7675`); git does not retain a log of what a remote branch's tip was at an earlier moment unless something recorded it at the time (a local reflog entry, a CI log, a chat transcript). No such artifact from before the first push attempt exists in this repository or was made available to this session.
- The wake-up skill's own procedure (`.claude/skills/wake-up/SKILL.md`, read at the start of this task) enumerates open pull requests and compares `HEAD` to `origin/main` as its position check; it does not enumerate other branches, open or otherwise, and would not by itself surface a second branch's write unless that branch had already opened a PR against `main`.
- This session has no access to the laptop session's terminal history, reflog, or transcript, so it cannot independently confirm what commands that session ran, or what their output showed, before its first push attempt.

What this does and does not cover: it establishes that no artifact retrievable by this session records the concurrent branch being surfaced before the first push, and that the standard wake-up procedure as currently written would not have surfaced it either. It does not establish that the laptop session ran no check capable of surfacing it, nor that no such check existed — an unlogged check that returned "nothing new" is indistinguishable, from this vantage, from no check having been run at all.

### 6. Dispatch of `session_019wJprR5wLd2F5cTMjNqaRn`, CANNOT-TELL

CANNOT-TELL, on the face: what dispatched `session_019wJprR5wLd2F5cTMjNqaRn`. A session ID is an opaque identifier; it carries no record, in this repository or in the commit trailer that names it (`Claude-Session: https://claude.ai/code/session_019wJprR5wLd2F5cTMjNqaRn`), of what initiated it. This is not repo-derivable from any check available to this session.

ATTESTED: Evoni's statement, as conveyed in this task's framing, is that she initiated no session outside the Desktop chat. This is recorded as her statement about her own actions, standing on her attestation alone. It is not treated here as proof that no such session was started by some other path — an unattested alternative origin (a second device, a scheduled dispatch, a third party with access) is not ruled out by her statement about her own conduct; it is simply not evidenced either.

### 7. What this document does not do

This document takes no position on whether the concurrent write, the authorization-timing gap in §4, or the unestablished dispatch path in §6 constitutes a defect. It mints no FD, no PE, no XK, and names no remedy. It does not compare this event against `F-Tools-1_CloudCredentialScope_2026-09-05.md` and its successors, which record a different mechanism (cloud-session `git push --delete` refusals) under the same family.

---

**Type:** Standalone tooling finding. Rules nothing. Mints no FD, no XK, no PE. No host, AWS, database, or Cognito contact. Prod **FROZEN**.
