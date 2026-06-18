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