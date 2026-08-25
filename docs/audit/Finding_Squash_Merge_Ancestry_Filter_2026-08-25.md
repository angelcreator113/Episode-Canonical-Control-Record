# Finding instance - squash-integrated branches fail ancestry merge classification

| | |
|---|---|
| **Purpose** | Records an instance of `Finding_Check_Cannot_Fail_Class_2026-08-24.md`: Git ancestry filters cannot answer whether branch work reached `main` through a squash merge. |
| **Basis** | `main` at `2deaa48513bf1dbfd8c4641db986b3b5208501dc`, confirmed by `git ls-remote origin refs/heads/main`. Remote refs fetched at that authority before measurement. |
| **Standing** | Observation. **Mints nothing.** No FD, XK, or PE. Changes no gate, disposition, owner, severity, branch-retention rule, or deletion authorization. |
| **Scope** | Nine named surviving remote branches only. This is not a sweep or classification of the repository's other heads. |
| **Authority note** | Local Git reads and GitHub PR metadata reads only. No branch deleted. No host contacted. No workflow dispatched. Prod **FROZEN**. |

---

## 1. The class and this instance

`Finding_Check_Cannot_Fail_Class_2026-08-24.md` names the class:

> A check that cannot fail reports success, and success from a check with no
> coverage is indistinguishable from success from a check that passed.

Its remedy is a positive control: prove that the instrument can return the
answer being relied on for the same mechanism under examination.

This is an instance, not a new class. The instrument is Git's ancestry test:

```text
git branch -r --merged origin/main
git branch -r --no-merged origin/main
```

Git's own help defines these as branches whose tips are, or are not, reachable
from the named commit. That is a valid ancestry question. It is not the
repository's operational question, **whether the branch's work was integrated
through a squash merge**.

Squash merge creates a new commit on `main`; it does not make the source branch
tip an ancestor. The ancestry instrument therefore has no path by which to
recognize a squash integration.

---

## 2. The nine-branch measurement

At this basis all nine branch tips are absent from `--merged origin/main` and
present in `--no-merged origin/main`:

| Remote branch | Ancestry result | Integration evidence |
|---|---|---|
| `claude/branch-a-costing` | not merged | merged PR `#1121` |
| `claude/branch-a-selection-record` | not merged | merged PR `#1120` |
| `claude/pe65-topology-pointer-banner` | not merged | merged PR `#1119` |
| `docs/f-auth-branch-a-prerequisite` | not merged | merged PR `#1123` |
| `claude/check-cannot-fail-class` | not merged | merged PR `#1124` |
| `claude/dim3-token-acquisition` | not merged | merged PR `#1125` |
| `claude/rollback-scope-p6` | not merged | merged PR `#1126` |
| `claude/v25-sec6-prep-1cu9c0` | not merged | its sole document blob is byte-identical on `main`; merged PR `#1118` carried it under a different head branch |
| `docs/f-auth-pe64-ownership-resolution` | not merged | merged PR `#1129` |

For the first seven and ninth rows, GitHub records the named head branch's
merged PR. For the v25 row, the source branch itself was not the PR head; the
positive integration evidence is blob identity for
`docs/audit/v25_Draft_Material_2026-08-24.md`, corroborated by merged PR `#1118`.

**Established for these nine:** their work is integrated on `main`, while their
tips are not ancestors of `main`. The ancestry filters classify all nine
consistently and cannot report the integration fact.

---

## 3. The output is confident, but the error is one-directional

The two switches partition ancestry cleanly:

- `--merged` excludes all nine;
- `--no-merged` includes all nine.

Those are not two independent wrong answers. They are complementary expressions
of one correct ancestry fact: the tips are not reachable from `main`. The error
occurs only when that fact is promoted to **the work was not integrated**.

This differs from the first instances in the class document in presentation.
Several returned nothing or a false negative that prompted another look. Here,
both complementary commands return clean, internally consistent sets. Nothing
in their output says that squash integration lies outside the measurement.

**Correction to the proposed hazard:** `--no-merged` does not mean safe to
delete. It means not merged by ancestry. A standard cleanup that deletes only
the output of `--merged` would retain all nine branches. The ancestry false
negative is therefore conservative for that specific cleanup; it does not, by
itself, threaten these nine with deletion.

---

## 4. Relationship to the authorship-preservation finding

`Finding_Authorship_Record_Preservation_2026-08-24.md` establishes that these
surviving branches carry authorship signal removed from `main` by squash merge,
and that branch deletion would remove that signal.

This document establishes a narrower adjacent fact: `--merged` cannot identify
these squash-integrated branches as integrated. **Together the documents do not
establish that the standard ancestry-filtered cleanup would delete them.** The
opposite is true at this basis: that filter retains them.

The preservation hazard remains conditional on some other deletion authority
or oracle classifying the branches as safe to delete. No such replacement
oracle is selected or evaluated here.

---

## 5. Remedy - a mechanism-matched positive control

The filed class's remedy governs: **before an oracle is used as a deletion
safety filter, show that it can return the answer being relied on.**

An ordinary merged branch is not a sufficient positive control for squash
integration. It proves only that the ancestry oracle can detect ancestry. A
mechanism-matched control must include work known to have reached `main` by
squash while the source tip remains outside `main`'s ancestry. On that control,
`--merged` necessarily fails to report the operational integration fact.

That result disqualifies ancestry alone from answering the squash-integration
question. **This document does not specify the correct replacement oracle.** It
names the defect and the capability the eventual deletion check must
demonstrate.

---

## 6. Bounds

- **Established for these nine branches at `2deaa485` only.** The remaining
  remote heads were not evaluated for integration status, retention value, or
  deletion safety.
- The finding is about the mismatch between ancestry and squash integration.
  Git's ancestry output is correct on its own terms.
- The standard `--merged` deletion filter retains these nine. No live deletion
  hazard from that filter is claimed.
- The correct integration or deletion-safety oracle is not specified here.
- The v25 branch's evidence is content identity, not a same-head merged PR. No
  broader claim about all commits on differently headed PRs is made.

---

## 7. What this document does not do

- Does not create a fourth failure class; it cites the filed class.
- Does not classify any branch outside the named nine.
- Does not authorize, recommend, retain, or delete a branch.
- Does not choose a replacement merge-status oracle.
- Does not amend the authorship-preservation finding.
- Does not make or imply a `PE #65` decision.
- Does not mint an FD, XK, or PE number.

---

## Version block

| Field | Value |
|---|---|
| Document | `docs/audit/Finding_Squash_Merge_Ancestry_Filter_2026-08-25.md` |
| Date | 2026-08-25 |
| Basis | `main` at `2deaa48513bf1dbfd8c4641db986b3b5208501dc` |
| Class | `Finding_Check_Cannot_Fail_Class_2026-08-24.md` |
| Related finding | `Finding_Authorship_Record_Preservation_2026-08-24.md` |
| Population | Nine named surviving remote branches |
| Mints | Nothing |
| Operations performed | Read-only Git and GitHub metadata reads |

---

*Recorded 2026-08-25. Basis `main` at `2deaa485`. Observation only. No branch operation beyond creating this documentation branch. No live infrastructure contact.*