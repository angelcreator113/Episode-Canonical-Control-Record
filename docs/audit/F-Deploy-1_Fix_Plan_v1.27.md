# F-Deploy-1 Fix Plan v1.27

**Register-state correction FD-52 — FD-31/FD-38 closures (v1.20) and FD-42/43/44 closures (v1.21) restated as open by v1.23–v1.26 with no reopening basis; restatements void. Register-integrity finding FD-53 — the derive sequence certifies phase only; a verification's authority does not extend past what it verified. FD-48 refinement recorded per G2 Implementation v1.3 §2.1.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.26 (FD-50/FD-51, workflow-runtime-state + empty-output-authority) |
| **Author start date** | 2026-07-09 |
| **Status** | DRAFT v1.27 |
| **Gate effect** | Advances no gate. Authorizes no prod-box or dev-box action. Corrects register state; reopens nothing; re-closes nothing. |

**Basis (stated in full, per v1.23's convention that a successor should widen, not narrow):** live reads 2026-07-09 against origin/main —

- Fix Plan v1.20 (full body): FD-31/FD-38 close text, six-leg sequence, `[3]` window disposition
- Fix Plan v1.21 (full body): FD-42/43/44 close text, carried items, register topology line
- Fix Plan v1.22 (full body): phase-axis index error (FD-46), basis enumeration
- Fix Plan v1.23 (full body): §2 register restatement, §3 mechanism + self-certifying sequence, basis enumeration
- Fix Plan v1.24 (full body): §2 carried restatement, §3.5 rule, §5 stranded-blob flag
- Fix Plan v1.25, v1.26 (restatement lines: v1.25 §2/§8; v1.26 §7)
- v1.23 §3 self-certifying phase checks re-executed live: branch protection API (3 required checks, strict=true); `auto-merge-to-dev.yml` (opt-out grep, backend `node --check`, `-X ours` steps present); v1.4 §3.1/§7.3 (8-day soak clean; "Phase A | Overall | CLOSED")
- G2 Implementation v1.3 §2.1 (PR #911, merged 2026-07-09): citation disposition map
- §8 item 2 gate-zero run live: Fix Plan v1.13 full body (06-19 precondition snapshot); commit `56564d69` (06-13 credential-drift finding note); `NEW_CHAT_ONBOARDING.md` freeze-state lines + last commit on path (#745, 2026-06-01); v1.20 `[3]` window disposition; Fix Plan v1.21 "REMEDIED, not merely recorded"; `F-Deploy-1_Cold_Entry_Allow_List_NON-PRIMING.md` present on origin/main

## §1 Purpose

v1.27 corrects a register-state defect that entered at v1.23 and was carried by citation through v1.26: findings closed at v1.20/v1.21 were restated as open, with the phase-blocking consequence ("G2 §4.2 BLOCKED on FD-31") attached. It mints FD-52 (the correction) and FD-53 (the mechanism, generalized to a rule and a derive-sequence amendment), and lands the FD-48 refinement owed by G2 Implementation v1.3 §2.1. Performs no first-instance reasoning beyond transcription and live verification.

## §2 Register state (authoritative as of this revision)

Per-claim authority — each finding's state per the revision that last changed it:

- **FD-31 — CLOSED at v1.20 (2026-07-06).** Six legs complete per v1.20's own text. Not reopened by any subsequent revision; no reopening basis exists anywhere in the chain.
- **FD-38 — CLOSED at v1.20 (2026-07-06).**
- **FD-42, FD-43, FD-44 — CLOSED at v1.21 (2026-07-06)** (FD-44 with the len-39 correction landed there).
- **FD-45 — OPEN (tail only)**, unchanged from v1.20/v1.21. Credential-at-rest surface remediation; backup disposition at close.
- **Carried items** — per v1.21's consolidated list, unchanged. P1 restated: canon `db_password` rotation owed at a future gated window (base64 disclosed in the 07-04 transcript; not an emergency per v1.21's assessment; a real P1).
- **Register topology** — per v1.21, stands verbatim: FD-41 (superseded-mechanism) → FD-42/43/44 (CLOSED v1.21) → FD-45 (OPEN, tail) → FD-38 (CLOSED v1.20) → FD-31 (CLOSED v1.20). Subsequent mints: FD-46 (v1.23), FD-47 (v1.24), FD-48/49 (v1.25), FD-50/51 (v1.26). No prior register entry is rewritten.

**The restatements are VOID, not superseded-in-place:** v1.23 §2 ("FD-31 stays OPEN"; "G2 BLOCKED on FD-31"), v1.24 §2 ("FD-31 … is OPEN … per v1.23 §2"), v1.25 §2 and §8 ("remains OPEN … v1.25 does not touch FD-31"), v1.26 §7 (carried). Each restated a closed finding without reading its closing revision. This is correction, not reopening — the closures were effected at v1.20/v1.21 and never lawfully disturbed.

## §3 Phase position (phase axis unchanged; block corrected)

Phase axis per v1.23 §2, re-derived live this session via the v1.23 §3 checks (all three concur):

- **Phase A: CLOSED** (2026-05-26, v1.4).
- **Phase B G1: CLOSED** (FD-26/27/28, v1.4).
- **Phase B G2: live frontier — and its execution is NOT FD-31-blocked.** The block v1.23–v1.26 asserted dissolved at v1.20's close, two days before v1.23 asserted it. Execution contract: G2 Implementation v1.3 (PR #911, merged 2026-07-09), which is complete through FD-48's citation-repair. G2 §4.1 provisioning is executable on maintainer authorization; no register finding blocks it.
- **Phase C: NOT STARTED.**

v1.27 advances no gate: unblocking-by-correction is not authorization. G2 execution starts when the maintainer starts it, per the v1.3 contract's own §4 gates.

## §4 Register-state correction — FD-52

### §4.1 The finding

**Decision FD-52: v1.23 §2 restated FD-31 as OPEN and Phase B G2 as BLOCKED two days after v1.20 closed FD-31, with no reopening basis; v1.24 §2, v1.25 §2/§8, and v1.26 §7 carried the restatement by citation. All five restatements are void. Register state is as §2 above: FD-31/38 closed (v1.20), FD-42/43/44 closed (v1.21), FD-45 tail + carried items open. Phase B G2 execution has been unblocked since 2026-07-06.**

### §4.2 Mechanism and verification trail (all live reads, 2026-07-09)

1. v1.20 body: "FD-31 — CLOSED by this revision … All six legs of the v1.19 close sequence complete." Footer: "*Closed: FD-31, FD-38.*"
2. v1.21 body: closes FD-42/43/44; topology line "FD-38 (v1.19; CLOSED v1.20) → FD-31 (CLOSED v1.20). No prior register entry is rewritten."
3. v1.23's **declared** basis shows it touched v1.21 **for exactly one scoped fact** — "Register tail confirmed: FD-45 last minted (v1.21)" — a mint-tail check, not a closure-state read. Its FD-31 characterization ("prod three-axis split-brain, P0, v1.6") cites v1.6, the *minting* revision, not v1.20, the *closing* one. The declared basis read the register's tail and the finding's birth; never its death. (Declared: the basis statement is v1.23's self-report of its reading — the strongest available evidence, and itself the class of signal this revision rules on.)
4. v1.24 §2 inherited by citation ("per v1.23 §2") under a "re-derived live" banner — while §3.5 of the same document rules that verification "terminates at `git show <ref>:<path>` on the blob, never at … a downstream document's citation." FD-31-OPEN entered v1.24 as exactly the thing §3.5 forbids, four paragraphs above the rule.
5. v1.25 §2/§8 and v1.26 §7 carried it with explicit non-touch disclaimers ("v1.25 does not touch FD-31") — accurate about their own conduct, and precisely how a void claim rides untouched through two more revisions.

## §5 Register-integrity finding — FD-53

### §5.1 The finding

**Decision FD-53: the v1.23 §3 self-certifying derive sequence certifies PHASE POSITION only — its three legs (phase table, branch protection API, workflow file) contain no register read. A session executing it verbatim is entitled to phase conclusions and to no conclusion whatever about any FD's state. A verification's authority does not extend past what it verified. Remediation: a revision's basis must include the closing revision of every finding it restates; a retention block that restates a finding without naming that finding's closing revision is a reconstruction, not a carry.**

### §5.2 Derive-sequence amendment

The cold-session derive sequence (v1.25 §6.1 steps 1–5, v1.26 §5 steps 6–7) gains a register leg:

> **Step 8 (register leg):** for each finding whose state a session restates or relies on, `git show` the revision that last changed that finding's state — the closing (or reopening) revision itself, not the minting revision, not a later revision's characterization. If no revision closing the finding is found by enumerating the chain forward from its mint, the finding is open; otherwise its state is what the last state-changing revision says. **The enumeration must be exhibited, not asserted:** the basis must name every revision between mint and tail that was read. A gap in the enumeration is a gap in the claim — the finding's state is not established across an unread revision. (A two-point read of mint and tail is exactly the read v1.23 performed; a rule that permits it by self-attestation would be subject to FD-53.)

### §5.3 Family placement

FD-46 (partial basis), FD-47 (commit message ≠ blob), FD-49 (prose about documents ≠ authority), FD-50 (file contents ≠ runtime state), FD-51 (empty output ≠ authority unless the read exited clean) — one family: a signal shaped like state that is not state. FD-52/53 add the member that produced today's chain: **a real verification, correctly executed on one axis, whose authority bled onto an axis it never touched.** The phase re-derive was sound; the register claim in the same paragraph was never tested by it.

## §6 FD-48 refinement (register pickup owed by G2 Implementation v1.3)

FD-48 (v1.25) stated that every Planning-doc section cited by the G2 implementation doc either does not exist or contains unrelated content. G2 Implementation v1.3 §2.1's live-read disposition map (PR #911) refines this: **Planning §6.1 resolves as cited** — the billing-console cost-decomposition method is present in its text. FD-48's finding stands with this refinement recorded; its remediation stands executed (v1.3 merged 2026-07-09). v1.3's named scope extension — generalizing five stale "Fix Plan v1.6" G2-close forward-references — is acknowledged as within the repair's defect class and properly disclosed in the PR record.

## §7 Retained (explicitly not superseded)

- **FD-46 and its flags on v1.22 / PR #906 evidence note: retained in full.** FD-52 corrects v1.23's register axis; v1.23's phase-axis correction of v1.22 stands and was re-verified live this session (all three §3 checks concur).
- **FD-47, FD-48 (as refined §6), FD-49, FD-50, FD-51: retained.**
- **v1.24 §2 procedural ruling** (doc authoring not execution-gated): retained as principle; its FD-31 predicate is corrected by §2.
- **v1.25 §5 ruling** (Phase B G1 does not reopen): retained.
- **Derive sequence** v1.25 §6.1 steps 1–5 + v1.26 §5 steps 6–7: retained, amended by §5.2's step 8.
- **v1.21 carried items** including P1 rotation: restated §2, unchanged.

## §8 Deferred (flag only, no action)

1. **Stranded Fix Plan v1.8 draft, dangling blob `d53e22a3`** (v1.24 §5): one `git cat-file -p d53e22a3` comparison against v1.8 on main during a future hygiene pass. Noted without adjudication: `NEW_CHAT_ONBOARDING.md` names v1.8 as the current Fix Plan (verified live 2026-07-09) — the onboarding document's staleness is a separate correction thread (drafts parked outside the working tree, 2026-07-09) and is not resolved by this revision.
2. **Onboarding staleness — re-scoped; gate-zero run live this session; no live hazard.** Gate-zero for the previously flagged "restart-safety divergence" — live reads of Fix Plan v1.13 §3 and finding `56564d69` — was executed 2026-07-09, both reads exiting clean. Result: `NEW_CHAT_ONBOARDING.md` is frozen at 2026-06-01 (last commit on the path, PR #745) — it names Fix Plan v1.8, register through FD-37, Handoff v12, and the combined restart window as *pending*. v1.13 §3 is a 06-19 precondition snapshot; `56564d69` files a 06-13 finding note — both predate the close by weeks, and v1.21 records the credential precondition "REMEDIED, not merely recorded." The `[3]` combined window **completed 2026-07-04→06** (v1.20: restart-to-align thread COMPLETE). The cold-entry discipline and `F-Deploy-1_Cold_Entry_Allow_List_NON-PRIMING.md` attached to that window and are now historical. Freeze posture for prod actions outside ratified gates is unchanged (v1.20, verbatim). There is no restart-safety divergence: the onboarding document describes a completed operation as pending. **Correction owed; no live hazard.**

3. **Workflow runtime state: three workflows disabled; flag only.** Live read 2026-07-09 via `gh workflow list --all` (the FD-50 read; this state is invisible to file reads): `Auto-merge to Dev` and both `Deploy` workflows are runtime-DISABLED; `Validate` is active. Stated plainly: the A-1/A-2/A-3 hardening in `auto-merge-to-dev.yml` exists on main but is not currently exercising. Phase A closure evidence is therefore the historical G4 soak plus live branch protection (re-verified this session), not ongoing workflow operation. Re-enablement of any of the three is a gated decision per the AllStopped disposition, not a maintenance toggle. No action this revision.

## §9 Register hygiene

- Register tail at v1.27 open: FD-51 (v1.26). Minted here: FD-52, FD-53. Tail at close: FD-53.
- FD numbers minted only by Fix Plan revisions — conforms.
- Closes no findings: FD-31/38/42/43/44 closures were effected at v1.20/v1.21; v1.27 voids later restatements, it does not re-close.
- Doc-only revision. No code, config, box, or canon contact.
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #906, #911 — are historical; no `close/fix/resolve #N` adjacent forms).
- Ships with `[skip-automerge]`.
- Session note (FD-49 species): prior-session prose carried "parked copy current at 13313b", the draft's byte count (13,313) masquerading as a commit hash. Resolved this session: the draft was untracked on main, never committed; secured by out-of-repo backup and SHA-256 fingerprint prior to this revision's edits.

---

*End of F-Deploy-1 Fix Plan v1.27 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-09.*
*Predecessor: v1.26 (404740f6).*
*Closed: none. Minted: FD-52, FD-53. Advances no gate; authorizes no prod-box action. [skip-automerge]*
