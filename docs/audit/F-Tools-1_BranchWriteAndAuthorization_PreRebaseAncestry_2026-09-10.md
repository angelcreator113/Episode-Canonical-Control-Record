| **PRIME STUDIOS** **F-TOOLS-1 — PRE-REBASE ANCESTRY, 2026-09-10** *Records that `1cbf7675`'s linear ancestry from `76506bf1` is the post-rebase shape, and that the two commits now preserved as `pre-rebase/1317-b878ab9` and `pre-rebase/1317-fd87694f` sat on a different base. Amends `F-Tools-1_BranchWriteAndAuthorization_2026-09-09.md` by addition. Mints nothing.* |
| --- |

**Author declaration.** This session has no transcript. Its sources are (a) commands run in this session, standing MEASURED; (b) `F-Tools-1_BranchWriteAndAuthorization_2026-09-09.md`, a filed register document, cited as such; and (c) issue #1341's own body text, Evoni's account written into a task, standing ATTESTED-from-issue-text. No line below claims a transcript or chat record.

**Standing:** MEASURED for §1–§5. §6 is ATTESTED-from-issue-text, labelled.

**Basis:** `origin/main` at `0d578f868acf6d83814e08ccb44338f01dc22803`.

```
$ git rev-parse origin/main
0d578f868acf6d83814e08ccb44338f01dc22803
```

---

### 1. The two tags, MEASURED

```
$ git show --format=fuller --no-patch pre-rebase/1317-b878ab9
commit b878ab9592969574e38c89614d42a3ccdbb997c4 (tag: pre-rebase/1317-b878ab9)
Author:     Evoni <evonifoster@yahoo.com>
AuthorDate: Wed Sep 9 13:33:49 2026 -0400
Commit:     Evoni <evonifoster@yahoo.com>
CommitDate: Wed Sep 9 13:40:20 2026 -0400

    fix(tooling): add numeric Owed Index selection to wake-up [skip-automerge]

    Task: #1317
```

```
$ git show --format=fuller --no-patch pre-rebase/1317-fd87694f
commit fd87694f22c2309d68302dd51724f89f739cd083 (tag: pre-rebase/1317-fd87694f)
Author:     Evoni <evonifoster@yahoo.com>
AuthorDate: Wed Sep 9 13:33:49 2026 -0400
Commit:     Evoni <evonifoster@yahoo.com>
CommitDate: Wed Sep 9 13:33:49 2026 -0400

    fix(tooling): sort wake-up Owed Index scan numerically [skip-automerge]

    Task: #1317
```

```
$ git ls-remote --tags origin | Select-String "1317"
b878ab9592969574e38c89614d42a3ccdbb997c4        refs/tags/pre-rebase/1317-b878ab9
fd87694f22c2309d68302dd51724f89f739cd083        refs/tags/pre-rebase/1317-fd87694f
```

Both tags target the SHAs named in their own tag names and are present on `origin`.

---

### 2. Ancestry, both shapes, MEASURED

**Post-rebase shape** — `76506bf1` to `1cbf7675`:

```
$ git merge-base 76506bf1 1cbf7675
76506bf1f46bb664b3c99b83f96d16f21b785e28

$ git merge-base --is-ancestor 76506bf1 1cbf7675
exit=0
```

The merge-base is `76506bf1` itself; the `--is-ancestor` check exits `0`.

**Pre-rebase shape** — `76506bf1` against each tag:

```
$ git merge-base 76506bf1 pre-rebase/1317-b878ab9
1157f06c82f5f12589f54069d231a384b33f0957

$ git merge-base 76506bf1 pre-rebase/1317-fd87694f
1157f06c82f5f12589f54069d231a384b33f0957
```

Both report `1157f06c82f5f12589f54069d231a384b33f0957`, not `76506bf1`, as the merge-base.

---

### 3. What the filed document records, cited

`F-Tools-1_BranchWriteAndAuthorization_2026-09-09.md`, read at `origin/main`, §2, quoted verbatim:

> The merge-base is `76506bf1` itself, reported exactly as the command shows it: `1cbf7675` has `76506bf1` as an ancestor. This is a linear relationship, not a divergence between two independent tips — the command does not report two commits with a common ancestor other than one of themselves.

This document adds the pre-rebase reading (§2 above) and does not contradict or withdraw that statement. Both describe the same repository at different points: the filed document's §2 measured `76506bf1`↔`1cbf7675` ancestry as it stands on `origin/main` today; §2 of this document measures, in addition, what base the now-tagged pre-rebase commits sat on before that shape existed.

---

### 4. Subject-line difference, MEASURED, no characterization

`fd87694f`'s subject, verbatim:

> fix(tooling): sort wake-up Owed Index scan numerically [skip-automerge]

The subject of `914001a3` (PR #1318's squash-merge commit onto `main`), verbatim:

> fix(tooling): add numeric Owed Index selection to wake-up [skip-automerge]

No position is taken on why these differ.

---

### 5. What this document takes no position on

No position is taken on whether the pre-rebase ancestry recorded above, or the subject-line difference in §4, is a defect. No FD, PE, or XK is minted. No remedy is named. No ruling is made on whether `F-Tools-1_BranchWriteAndAuthorization_2026-09-09.md` needs correction — this document adds to it, it does not correct it.

---

### 6. Preservation, ATTESTED-from-issue-text

ATTESTED-from-issue-text: `b878ab9` and `fd87694f` existed only in a local reflog until 2026-09-10, when Evoni tagged and pushed them; the tags were created for the purpose of preserving them.

---

*Type: standalone tooling record, additive to `F-Tools-1_BranchWriteAndAuthorization_2026-09-09.md`. Rules nothing. Mints no FD, XK, or PE. No host, AWS, database, or Cognito contact. Prod FROZEN.*
