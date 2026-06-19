# F-Deploy-1 Fix Plan v1.13
**Records ONE of the [3] preconditions - P-4/P-5 (runtime + DB-connectivity parity) - as MET, anchored to PR #825 (commit faac1f42). Three other [3] preconditions remain OPEN (see Sec 3). The flip is carried into the Fix Plan register, where P-4/P-5 status previously lived only in the standalone P4P5 evidence artifact. This revision records one precondition-state flip with its two carried qualifiers; it advances no gate, authorizes no box action, and does not prime [3].**
| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.12 (register through FD-40; Gate 2.5 CLOSED) |
| **Gate transition** | NONE. No gate advances in this revision. P-4/P-5 precondition for [3] flips UNMET -> MET on PR #825 evidence; this is a [3]-precondition accounting flip, not a gate close. FD-31 remains OPEN. Box remains FROZEN; "do not reboot" stands. [3] not primed. |
## Sec 1 Purpose
This revision exists to carry the now-settled P-4/P-5 = PASS state into the Fix Plan register. P-4/P-5 status has lived only in the standalone artifact docs/audit/F-Deploy-1_P4P5_PASS_2026-06-18.md, which passed through a flip (#823), a withdrawal for stitched cross-run evidence (#824), and a restore on single-run captured evidence (#825). v1.12 was scoped to FD-40/Gate 2.5 register alignment and made no statement about P-4/P-5; the register has therefore never recorded the P-4/P-5 precondition state. This revision supplies that record. Scope is [3]-precondition accounting only. No new live-state investigation is claimed.
Source anchors:
- F-Deploy-1_P4P5_PASS_2026-06-18.md (2026-06-19 PASS-RESTORED supersede banner + inline single-run capture 20260619-124226 - the evidence of record)
- PR #825 / commit faac1f42 (the merge that cured the stitched-cross-run defect)
- F-Deploy-1_Fix_Plan_v1.12.md (predecessor; register tail FD-40)
## Sec 2 The precondition flip
P-4/P-5 - one of the four [3] preconditions - is **MET.** The other three remain OPEN (Sec 3).
Evidence basis: one coherent captured run (build -> image-ID inspect -> compose up -> health poll -> parity-tuple probe, single invocation, single transcript). Build manifest-list sha256 equals inspect IMAGE ID sha256 (348719ce...) - same image, same run, which is the property the withdrawn #823 evidence lacked. Parity tuple confirmed in-container: x86_64 / glibc 2.35 / Node v20.20.2 / npm 10.8.2. Start-verify: /health polled 000, 000, 200; health body reported database connected against disposable Postgres (currentDatabase "evidence", DB_HOST NOT SET) - independently corroborating zero box/canon-RDS contact. Scope is runtime + DB-connectivity parity, NOT schema state.
Two qualifiers travel with this close (recorded, not waived):
1. **npm ci attested by cache-reference + runtime proof, not fresh stdout.** Capture steps #9 (COPY lock files) and #10 (npm ci) show CACHED. The layer is content-addressed, so the cache hit proves byte-identical lock files and dependency tree; the successful app start + DB connect proves intact deps at runtime. npm ci is therefore attested, but not by freshly captured stdout in this run.
2. **Transcript-on-trust, not re-executed under reviewer observation.** Digest coherence and internal timestamp arithmetic make the capture strongly self-corroborating, but acceptance rests on reading a captured paste, not on re-execution. This is the epistemic ceiling of the record.
## Sec 3 [3] precondition accounting
P-4/P-5 MET does NOT prime [3]. The following [3] preconditions remain OPEN:
- Fresh cold session (the session that produced/reconciled this evidence is WARM and disqualified from priming [3])
- Live FD-31 Sec 7 abort re-verify
- Scoped Master Runbook Sec 5 read ONLY, carrying the A5 cold-entry fold
Inherited unchanged from v1.12: Gate 2.5 CLOSED (FD-40), FD-31 OPEN, box FROZEN ("do not reboot" stands), AF carried as CORRECTED class finding with fork SG sg-0164d0b20fbebacbb state carried-not-re-verified, Locus 7 deferred to post-[3] sweep.
**Path A discipline note:** v1.13 is [3]-precondition accounting only. No production action, no new session scheduling, no gate closure. The freeze stands; FD-31 remains OPEN; [3] is not primed. A cold session opening [3] inherits nothing from the warm session that produced this record.

*Fix Plan revision v1.13. Records the P-4/P-5 precondition for [3] as MET on PR #825 single-run captured evidence (commit faac1f42), carries the two qualifiers (npm-ci-by-cache-and-runtime; transcript-on-trust), and leaves the three remaining [3] preconditions OPEN. Mints no FD (precondition-state flip, not a defect/gate record). Inherits Gate 2.5 CLOSED, FD-31 OPEN, box FROZEN from v1.12. [3] not primed.*