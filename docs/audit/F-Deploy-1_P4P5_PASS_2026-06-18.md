> ============================================================
> SUPERSEDE BANNER - 2026-06-19 (PASS WITHDRAWN)
> ============================================================
> STATUS: P-4/P-5 = NOT PASSED. [3] precondition NOT met.
>
> The PASS banner below (added by commit 4909b05a, PR #823) is
> WITHDRAWN. It does not rest on a single coherent captured run.
>
> Provenance defect (verified 2026-06-19 against live tree):
> - Named transcript p4p5-build-20260619-091646.log is UNTRACKED:
>   git log --all -- "docs/audit/*.log" is empty; the file exists
>   only at repo root, not committed, not under docs/audit/.
> - Run 091646 CONFIRMS: x86_64/amd64, glibc 2.35, Node v20.20.2,
>   npm 10.8.2, "Up 40 seconds", a GET /health request, models
>   loaded.
> - Run 091646 DOES NOT CONTAIN: the image digest
>   sha256:b0b917d6..., a "BUILD EXIT 0" marker, nor any
>   exporting / manifest / writing-image / naming-to line. The
>   named run exported NO image.
> - Digest sha256:b0b917d6... appears ONLY in a DIFFERENT run,
>   p4p5-build-20260619-091243.log line 2063 ("exporting manifest
>   list"), captured roughly 4 minutes earlier.
> - The tracked evidence file docs/audit/P4P5_Evidence_*.md
>   contains NONE of: b0b917d6, "BUILD EXIT", "sha256".
> - /health 200 status code not literally present in 091646 (the
>   request is logged, the status line is not) - unconfirmed, not
>   contradicted.
> - Note: 091646 logged Redis "giving up after 5 reconnect
>   attempts" (line 2354); the app came up regardless. Whether
>   Redis-up belongs to the P-5 start-verify spec is a runbook
>   question, not adjudicated here.
>
> Conclusion: the PASS attaches run 091243's image digest to run
> 091646's start-verify and presents them as one attestation.
> This is stitched cross-run evidence. Under the single-clean-run
> rule the PASS is unsupported and is withdrawn.
>
> Remedy (cold session, not this one): one clean captured rerun
> that builds, exports (digest line present), starts detached,
> stays up, and serves /health 200 - all in a SINGLE log -
> committed to a tracked path via explicit git add in the same
> motion. The PASS banner is then re-written from that one file.
>
> FD discipline: this is an evidence/correction note, not a new
> FD mint. The next Fix Plan revision should reflect
> P-4/P-5 = NOT PASSED and carry forward this provenance finding.
>
> Filed 2026-06-19. Supersedes the PASS added in commit 4909b05a.
> Body below preserved verbatim.
> ============================================================

> **STATUS UPDATE 2026-06-19 (additive-supersede; all text below preserved verbatim):**
> P-4/P-5 returns to **PASS** on the live board, now backed by transcript-level
> evidence captured this session. This supersedes the 2026-06-18 NOT-PASSED
> correction below: the gap it identified -- no captured four-tuple, no pasted
> npm ci, no pasted start-verify -- is closed by the transcript in p4p5-build-20260619-091646.log.
>
> Build provenance: built at HEAD ae721589, equivalent to pin 903517f2 for all
> build-relevant inputs (git diff 903517f2..ae721589 is docs/audit-only; no
> package.json, package-lock.json, src/, or Dockerfile change). Recorded as
> built-at-HEAD to match the actual checkout.
>
> Captured evidence (in p4p5-build-20260619-091646.log):
> - Build: docker compose build --no-cache, BUILD EXIT 0; npm ci added 946
>   packages with no engines-range abort (A1 ABI behavior; #812 false-abort did
>   not recur).
> - Four-tuple (in-container): ARCH=x86_64, glibc 2.35, NODE=v20.20.2, NPM=10.8.2.
>   v20.20.2 vs box v20.20.1 is a PASS under the A1 engines-range decision, as
>   the correction below anticipated.
> - Image digest of record:
>   sha256:b0b917d6b5ba5d921136c2818209bb38c733f6bc747c7e5ff0424807dc8e093b
>   (compose-default tag ...-app:latest; the digest is the binding identifier,
>   not the tag).
> - P-5 start-verify: container Up 40s, zero restarts, /health returned 200, full
>   route tree mounted, ABI load clean (no .node load failure). Disposable scratch
>   Postgres torn down with -v post-verify; zero box contact; box remains FROZEN.
>
> Non-blocking observations (not P-5 failures): empty-DB relation-does-not-exist
> (live F-App-1 boot-migrate sighting); Redis ECONNREFUSED (no sidecar, graceful
> degrade); three route registrations (episodes, files, jobs, socket) threw
> JWT_SECRET-must-be-set -- a config-gated load refusal, not an ABI failure; the
> harness does not set JWT_SECRET by design.
>
> Consequence: the cold [3] window PRECONDITION is now MET. [3] is NOT primed by
> this result -- it remains its own fresh cold session (own wake-up trio, scoped
> runbook read, live FD-31 Sec 7 abort re-verify, inherit nothing). Box-side gate
> sequence, the A2-cfg ecosystem.config.js mechanism change, and FD-31 Sec 7
> abort re-verify all remain [3]-window work, unchanged.
>
> Filename note: this file is named _PASS_; its live status is governed by the
> topmost banner, not the filename. The name has at times disagreed with body
> status. A rename is deferred as optional cleanup; do not infer status from it.
>
> Mint/scope: this is a status flip on an existing artifact and mints no FD
> number. The detailed evidence pack is a separate follow-up commit.

> **CORRECTION 2026-06-18 (additive-supersede; text below preserved verbatim):**
> P-4/P-5 reverts to **NOT PASSED** on the live board. This document records a
> real off-box parity build (pinned `903517f2`, Docker ubuntu:22.04 / amd64 /
> glibc 2.35, NodeSource Node 20, torn down post-verify) but states its build,
> four-tuple, npm ci, and start-verify outcomes as **summary assertions**; this
> document does **not** contain the transcript-level evidence required to verify
> execution of the gate — no captured `uname -m` / `ldd --version` / `node -v` /
> `npm -v` block, no pasted `npm ci` output, no pasted start-check transcript.
> P-4/P-5 is a build-execution gate; a build being real does not make its results
> verifiable from the record. Disposition: NOT PASSED until a build session
> records captured transcripts in the PASS artifact.
>
> Scope of this claim: limited to this document. It asserts nothing about the
> separate 2026-06-14 #806 Pre-2A build confirmation, whose body is not read here.
>
> Consequence: the cold **[3]** window precondition is **UNMET**; [3] is not
> openable. The off-box parity build remains the active gating item and must run
> in its own fresh cold session, rebuild-at-priming from the then-current pin,
> zero box contact, with transcripts pasted into the PASS artifact.
>
> Open contradiction the real build must resolve: the build verified at Node
> **v20.20.2** (rolling NodeSource 20.x) while the box runs **v20.20.1**. The
> rebuild must show `npm ci` engines-range behavior under the A1 ABI decision —
> not a patch-exact match — consistent with the #812 false-abort fix.

# F-Deploy-1 — P-4/P-5 Off-Box Parity Build: PASS

| | |
|---|---|
| **Date** | 2026-06-18 |
| **Pinned commit** | 903517f2 |
| **Keystone** | F-Deploy-1 |
| **Status** | P-4 CLOSED · P-5 CLOSED |
| **Supersedes/settles** | Prerequisite 2 + Sec 1 P-4/P-5 rows in `F-Deploy-1_Phase2A_ExecutionSpec_2026-06-12_DRAFT.md`; Sec 2 steps 1–2 in `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md` |

## Result

Artifact built deterministically from pinned commit `903517f2` via `npm ci` against the committed lockfile, on a parity-matched host (Docker, `ubuntu:22.04` / glibc 2.35, built `--platform linux/amd64`, NodeSource Node 20). Start-verified clean. **P-4 and P-5 both CLOSED.**

## Empirical four-tuple confirm

App boot log reported `Node v20.20.2` on x86_64 / glibc 2.35 — the box's exact Node patch, landing inside A1 engines-range parity (not merely the major). Arch + libc HIGH (confirmed empirically); Node/npm MEDIUM pins empirically HIGH for this build. The MEDIUM pin language in the ExecutionSpec/Install-Method drafts is unchanged; `v20.20.2` is recorded here as empirical confirm only, not a re-rating of the pin.

## P-5 pass criterion (set here — spec left it undefined)

Process up ≥30s with zero restarts AND `/health` returns an HTTP response; DB-disconnected state acceptable, because the parity container has no route to canon RDS by design (zero box contact). Rationale: P-5 proves native-module ABI load, not DB connectivity — a tree that require()s its `.node` binaries successfully against the correct ABI is what the gate exists to verify.

Result against criterion: container `Up 11 min` (no restart), `/health` → `200`, full route tree mounted, `Database connection authenticated` against a disposable scratch Postgres. All three legs met.

## Zero box contact

Entire build off-box. The only prod-directed read in the P-1..P-5 chain was the P-1 control-plane arch read (prior, `aws ec2 describe-instances`). The box at `54.163.229.144` was not touched or read during P-4/P-5. Box remains FROZEN.

## Rebuild-at-priming

Artifact, scratch DB, network, image, and scaffolding files torn down post-verify. No persistence. If the `[3]` window needs the artifact, it is rebuilt fresh from `903517f2`.

## Expected non-blocking observations (not failures)

- Empty-DB `relation "..." does not exist` errors against the scratch Postgres — a live F-App-1 sighting (boot-time auto-migrate/CREATE TABLE against a blank DB). Irrelevant to ABI start-verify.
- Redis `ECONNREFUSED 127.0.0.1:6379` — no Redis sidecar; app degrades gracefully and keeps serving.
- `dotenv injecting env (0)` — confirms no host `.env` rode into the image (`.dockerignore` exclusion worked); runtime config came from explicit `-e` flags.

## What this does NOT change

P-4/P-5 closure discharges the off-box prerequisite chain only. Step 3 of Install-Method (stream onto box), ExecutionSpec Sec 2+ (box-side gate sequence, the `[3]` window itself), the A2-cfg `ecosystem.config.js` mechanism change, and FD-31 §7 abort re-verify are all unchanged and remain `[3]`-window work. `[3]` is not primed by this result.