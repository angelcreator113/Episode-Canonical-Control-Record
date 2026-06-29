# F-Deploy-1 — Defect 3(b) Verification: Hard-Abort Text Clean at HEAD — 2026-06-28

**Not an FD number. Not register authority.** Evidence note + forward-pointer only.
FD status changes mint via Fix Plan revision. This note records a verification
result; it does NOT ratify, retire, or amend the banner it references.

## What 3(b) claims

The AG-gate correction banner on the Master Runbook (commit `001481e0`, file
`docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`) lists, as defect 3(b), that
"typographic corruption in the hard-abort rules" — quoted forms "any deltaon shows",
"is alegitimate application write", "does not changethe gate" — "must be corrected"
before any FD mint. The banner states garbled hard-abort text protecting an
irreversible op is not cosmetic.

## What was verified this session (2026-06-28)

Method: `git show <ref>:docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`
piped to `Select-String` for the corrupted (space-removed) forms
`deltaon shows | alegitimate | changethe gate`, against the runbook content as it
stands at the ag-gate-annotation branch tip (`001481e0`, now also merged to main).

Result: the only match was inside the banner's own clause-3(b) excerpt, where the
corrupted forms are quoted deliberately to describe the alleged defect. The
operative hard-abort text in clause (c) returned NO hits — it reads with correct
spacing: "is a legitimate application write", "any delta on `shows`", and the
gate-mechanism line reads "does not change the gate mechanism".

**Extent of the proof:** the file, at this ref, does not contain the corruption
that 3(b) asserts must be fixed. The operative abort logic is clean as it stands.

## What was NOT determined

This note does not establish whether the corruption ever existed. Two explanations
are equally consistent with the observation and neither was verified:
(a) corruption existed, was fixed, and the banner was not retired; or
(b) the banner author filed against a console encoding artifact (the file carries
`ΓÇö` mojibake throughout when read via `git show | Select-String`, and the
project's own hazard notes warn that such display artifacts are frequently NOT
file corruption) that was never in the file bytes.

Explanation (b) is offered as a *possible* cause only. It is NOT verified and must
not be inherited as fact.

## Open question for Fix Plan ratification

Because the operative text is clean at HEAD but the banner still states the
corruption "MUST be corrected before any mint," the banner's 3(b) language is now
either stale (defect resolved, banner not updated) or discrepant (banner author saw
something not in the file). The next Fix-Plan-revision session that ratifies this
finding must reconcile banner-vs-file before relying on 3(b) as a live gate, and
either retire 3(b) or record what corruption it refers to that is not present at
HEAD.

This note does NOT itself retire 3(b). It records that 3(b), as written, does not
match current file state, and defers reconciliation to ratification.

## Scope note

Defect 3(a) (identity values in clause (c) unconfirmed against live main) is
SEPARATE and untouched by this note — it is a live-confirmation step owned by the
cold [3] session and is not addressed here.

*Verification note. Hard-abort text confirmed clean at ref `001481e0` (ag-gate-annotation tip, now merged to main) 2026-06-28.
Cause of 3(b) undetermined. Banner reconciliation deferred to Fix Plan ratification.*
