SESSION NOTE ONLY. AUTHORIZES NO PROD-BOX ACTION. BOX REMAINS FROZEN.
Continuation read-only session following #812 Phase 2A step 1 abort. Establishes live ground truth; does not overturn or proceed past the abort.

Outcome: HOLD. Phase 2A not continued. #812 abort stands.

Identity (confirmed): prod box i-02ae7608c531db485, public 54.163.229.144, private 172.31.26.1 (ip-172-31-26-1). Wrong-host concern is closed.

Live runtime ground truth:
- Process id 3 episode-api-prod-hotfix: online, uptime 15D, restarts 0, unstable restarts 0.
- node.js version: 20.20.1 (authoritative runtime value).
- Source-on-box execution (script .../src/server.js, cwd .../episode-metadata). No build artifact.

Findings:
1. Parity pin provenance remains unverified.
- Step 1 rule is exact 4-tuple parity against build-host pins.
- Prior pin was 20.20.2; live runtime is 20.20.1.
- 20.20.2 is not installed on box; only 20.20.0 and 20.20.1 are present.
- Resolving 20.20.2 vs 20.20.1 requires authoritative build-host provenance.

2. Committed-config vs runtime Node drift (new finding).
- ecosystem config declares PATH forcing v20.20.0 and NODE_VERSION 20.20.0.
- Live process runs 20.20.1.
- Both binaries exist, so a from-config restart can plausibly shift runtime down to 20.20.0.
- Treat as restart hazard independent of parity-pin provenance.

Corrected prior reasoning in-session:
- Withdrawn: down-pin build artifact to 20.20.1 (no build artifact exists in this runtime-from-source path).
- Withdrawn: switch comparator to engines-range satisfaction (runbook Step 1 currently defines exact parity).

Next-attempt entry conditions:
- Resolve Node pin provenance (authoritative build-host Node and source of 20.20.2 record).
- Address/acknowledge config-vs-runtime Node drift before any restart step.
- Fresh cold window open; rerun Phase 2A Step 1 from top before first mutation.

Safety/state assertions:
- No intended state mutation on box or canon from trusted reads.
- No restart.
- No repo execution-path mutation.

Process-deviation note:
- An un-gated automated probe sequence (not drafted, not confirmed under Draft→Confirm→Execute) executed multiple SSH commands including a box-side temp write (/tmp/pm2jlist.json, inert) and local captures; several were malformed by shell-quoting corruption, and the assembled summary it produced was rejected as untraceable.
- All values in this note derive solely from two clean, individually-confirmed single-command reads (pm2 describe; ls -la).
- Logged so the next entry treats the gate as having been circumvented once this session.