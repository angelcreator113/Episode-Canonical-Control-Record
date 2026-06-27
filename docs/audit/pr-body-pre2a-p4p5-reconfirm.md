## docs(audit): file Pre-2A P-4/P-5 reconfirm note [skip-automerge]

### What
- Files one additive audit note:
  - `docs/audit/F-Deploy-1_Pre2A_P4P5_Reconfirm_2026-06-16_DRAFT.md`

### Why
- Records the combined off-box rerun at pinned commit `6b0c097a` that:
  - reconfirmed P-4 PASS (`npm ci`, 946 packages, no native-ABI crash), and
  - closed P-5 PASS by start-verify reachability under the pre-committed rule.
- Preserves rebuild-at-priming posture (no artifact persisted).
- Logs two non-gating anomalies with bounded framing:
  - Template Studio route load `url` undefined
  - CORS allow-list string includes `3.94.166.174` (config signal only, no SG inference)

### Scope and boundaries
- Doc-only PR.
- No box touch, no secret mutation, no runtime mutation.
- No changes to runbooks, routes, models, or deployment logic.

### Operator gate checklist (single-purpose)
- Use explicit-path stage only:
  - `git add docs/audit/F-Deploy-1_Pre2A_P4P5_Reconfirm_2026-06-16_DRAFT.md`
- Validate staged diff before commit:
  - `git diff --cached -- docs/audit/F-Deploy-1_Pre2A_P4P5_Reconfirm_2026-06-16_DRAFT.md`
- Keep other untracked files out of this PR.
- Use `[skip-automerge]` in commit/PR text.
- Push from branch and create PR with explicit head:
  - `gh pr create --head <branch-name>`

### Notes
- FD-21 hygiene: no closing-keyword-adjacent issue linkage in this body.
- Put-parameter chain-step verification and untracked-file provenance triage remain separate threads.
