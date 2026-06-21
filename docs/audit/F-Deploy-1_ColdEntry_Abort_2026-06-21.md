> **[UPDATE 2026-06-21, later same-day session - gating items re-verified against origin/main.]**
> This abort record stands as the at-filing account; its two named gating items have since moved:
> - **Item 1 (retire stale Combined_Restart runbook): CLOSED.** PR #834 (240c6143) renamed it
>   F-Deploy-1_Combined_Restart_Master_Runbook_SUPERSEDED-ARCHIVED.md. The prior title/version
>   collision is removed.
> - **Item 2 (fold #828 env-completeness gate + FD-40 reconciliation edit-set into the runbook,
>   promote past DRAFT): FOLDS LANDED, PROMOTION STILL PENDING.** The FD-40 8-locus reconciliation
>   was applied via #803; the #828 env-completeness abort gate via #828 - both on origin/main.
>   The runbook remains DRAFT v0.1 deliberately: per Fix Plan v1.13, three of four [3] preconditions
>   remain OPEN, so promotion is not yet warranted and is not a warm-session act.
> Net: the cold-entry forward pointer below holds, but its blockers are now reduced to
> precondition-clearing, not runbook reconciliation. Body preserved verbatim.
>
> ---
# F-Deploy-1 - Cold-Entry Ritual Abort, 2026-06-21

**Session type:** attempted cold [3]-primer. **Outcome: ABORTED at Sec 5 step. [3] NOT opened.** This is a finding/correction note, not an FD mint.

**P-4/P-5: PASSED (precondition MET).** Verified live this session against `origin/main`: single-run capture `20260619-124226` in `F-Deploy-1_P4P5_PASS_2026-06-18.md` cures the PR #824 stitched-cross-run withdrawal - build-exported manifest-list `sha256:348719ce...` equals the inspected IMAGE ID in the same continuous log; `/health` literal `HTTP 200`; four-tuple x86_64 / glibc 2.35 / Node v20.20.2 / npm 10.8.2 (engines-range PASS per A5). Both PASS commits (`faac1f42`, `081e9c86`) are ancestors of `origin/main`. Two qualifiers travel: (1) P-5 met under the restore banner's relaxed criterion (up `-d` / UP EXIT 0 / `/health 200` / DB connected); the original body's ">=30s, zero restarts" leg is met by absence-of-restart only, not positively confirmed - a tightening rerun belongs in the P-4/P-5 lane, not [3]. (2) Zero box contact corroborated by health body (`currentDatabase: evidence`, `DB_HOST: NOT SET`).

**Abort cause - runbook ambiguity on `origin/main`:** two files share the title "[3] Combined-Restart Window: MASTER RUNBOOK (DRAFT v0.1)":

- `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` - last `5828cc5a` 2026-06-20 (#828, adds [3] env-completeness abort gate). **Assessed as the operative runbook** (most recent; carries newest abort criteria; has Sec 7A Phase 2A fold).
- `F-Deploy-1_Combined_Restart_Master_Runbook.md` - last `0e86c383` 2026-06-11 (#776). **Assessed as stale leftover.**

Reading either Sec 5 to settle which governs is reconciliation work (warm); doing it would disqualify this session from cold priming. Hence abort.

**Gating items that must close before the next cold [3] attempt (both warm; own session(s)):**

1. Retire/archive the stale `F-Deploy-1_Combined_Restart_Master_Runbook.md` (or rename to remove the title/version collision) so one authoritative runbook remains.
2. Reconcile the 06-20 #828 env-completeness abort gate + the pending FD40 reconciliation edit-set into the operative runbook, and promote it past DRAFT v0.1, so the cold-entry ritual reads a settled Sec 5 + a complete abort surface.

**Forward pointer:** once (1) and (2) close, a fresh cold session runs: wake-up trio -> Sec 5 read of the single operative runbook only -> live FD-31 section 7 (and FD-38 integrity-gate, if folded there) abort re-verify -> proceed.
