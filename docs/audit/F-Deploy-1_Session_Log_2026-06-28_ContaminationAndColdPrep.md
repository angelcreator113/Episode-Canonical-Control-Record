> SAFE-TO-READ FORWARD-POINTER LAYER below the line in Section A is safe in
> isolation, including for a session preparing to prime or close `[3]`.
>
> Section C is a CONTAMINATION POINTER ONLY (names a file, does not restate its
> contents). Do not open the file it points to if you are priming or closing
> `[3]`.
>
> This note deliberately does NOT restate `episode-api-prod-hotfix` identity,
> port, or config-block disposition. Those facts are cold-session-contaminating
> and live in the TrapScope note (2026-06-28) and on the live box. A cold `[3]`
> session must derive them from its own live reads.

---

## F-Deploy-1 Session Log - [3] Cold-Prep + Contamination Record - 2026-06-28

**Not an FD number.** Session log + forward-pointers. FD numbers mint via Fix
Plan revision only.

**Session intent at open:** cold session to prime `[3]` (combined restart window:
credential rotation + PM2 restart-to-align + security sweep).

**Session outcome:** did NOT prime `[3]`. This session is CONTAMINATED and is
disqualified from priming OR closing `[3]`. Reason in Section A. Work done was
warm cold-prep for the next session.

---

### Section A - SAFE-TO-READ (next cold `[3]` session: read this, then start fresh)

1. **Why this session cannot prime/close `[3]`.**
   During trap-fix validation, the full `F-Deploy-1_Finding_TrapScope_PM2Discipline_2026-06-28.md`
   note was read - not just its Section 4 forward-pointer. That note's header
   warns that reading its body disqualifies a session from priming or closing
   `[3]`, because it states facts the cold `[3]` session must derive
   independently from live reads. Disqualification is therefore in force for
   this session. The next `[3]` session must open cold: fresh wake-up trio,
   re-derive all state live, inherit nothing from this log beyond the
   forward-pointers below.

2. **P0 deploy-containment state (re-verify with your own trio + `gh workflow list --all`):**
   At this session's reads, all three of Deploy to Development, Deploy to
   Production, and Auto-merge to Dev were `disabled_manually`. `Validate` and
   the Copilot agent were `active` (expected, harmless). Containment intact.
   This is current-state, not stale-by-design - but re-derive it live anyway.

3. **Trap-fix (#872, commit `fd402b8d`) validation status - does NOT gate `[3]`:**
   The deploy-trap scope fix landed on main. Both gated behaviors were validated
   to land-standard in a parity-matched sandbox (discovery risk retired). One
   residual remains: on-box confirm-in-passing on the first gated dev deploy.
   Per the finding's own severity note, the residual's failure mode is dev-only
   (dev does not auto-restore on a failed dev deploy) - NOT prod outage. So the
   residual does not block `[3]`. It blocks re-enabling `deploy-dev.yml`, which
   is a separate decision.

4. **STALE MEMORY FLAG - DO NOT ACT ON IT (this is the key correction):**
   A memory-level instruction exists telling a future combined-restart cutover
   to "remove the `episode-api-prod-hotfix` block or the deploy trap will
   resurrect it." That instruction predates the 2026-06-28 correction and is
   RETRACTED. Acting on it is dangerous. Do NOT remove or delete any process
   block from `ecosystem.config.js` on the basis of memory. Derive the block's
   true disposition from your own live reads (`pm2 list` on the box + the config
   file on the box). Prod safety in the dev-deploy path comes from EXCLUSION in
   `deploy-dev.yml`, not from removing anything. Your live derivation will show
   you the correct disposition without you needing to read any contaminating
   note.

---

### Section B - Verification this session did NOT do (owned by the cold `[3]` session)

- Live prod process identity / port / restart-count / uptime, and whether the
  running process matches the committed config. This session read the EXPECTED
  values from a contaminating note, so it cannot be the session that confirms
  them independently. Cold session derives live.
- Abort-precondition re-verify (Phase 1).
- Credential-rotation + PM2 restart-to-align cutover steps.
- Security sweep items (RDS SG lockdown / AF class, instance profile / AD,
  PubliclyAccessible flag on canon RDS).

---

### Section C - CONTAMINATION POINTER (warm sessions only - do NOT open if priming/closing `[3]`)

The corrected disposition of `ecosystem.config.js` (the retraction referenced in
Section A.4, with full identity/port/role detail) is recorded in:
`docs/audit/F-Deploy-1_Finding_TrapScope_PM2Discipline_2026-06-28.md`, Sections 1
and 2. That file is cold-session-contaminating. It is the correct reference for
warm doc/prep work and the wrong thing to read if you are about to prime or
close `[3]`.

---

### Commit-hygiene note (FD-21)

When committing this log: no GitHub closing-keywords adjacent to any `#N` in the
commit message (auto-close hazard). PR references in this body are plain text and
do not auto-close from a doc body, but keep the commit subject clean.
