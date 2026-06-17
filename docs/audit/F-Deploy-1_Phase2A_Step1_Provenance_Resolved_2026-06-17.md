SESSION NOTE ONLY. AUTHORIZES NO PROD-BOX ACTION. BOX REMAINS FROZEN.
Warm continuation following PR #813 provenance HOLD. Resolves the open pin-provenance question via local git-history reads only. Does not overturn #812 abort, does not proceed past it, and does not open a Phase 2A attempt (this session is warm, not a cold window).

Outcome: Pin provenance RESOLVED. v20.20.2 origin identified and validated. The .2-vs-.1 mismatch is explained as benign build-vs-provision skew. Gate-rule question is raised for next cold entry. HOLD on Phase 2A continuation stands.

Provenance trail (git log -S "20.20.2" -- docs/):
- v20.20.2 first enters the record in the Pre-2A PASS artifact, commit 7d729801 (#796, 06-14).
- Carried forward through P-4/P-5 reconfirm (e9f922d6, #806) and the #812 abort note.
- Not present in repo manifests (engines: node >=20.0.0; no .nvmrc).
- Not installed on the prod box (box has v20.20.0 and v20.20.1 only).

Origin (from 7d729801 diff):
- The .2 reading is container-local and off-box.
- P-4/P-5 ran in a parity container (ubuntu:22.04, Node 20 via NodeSource setup_20.x) against a detached worktree at f8253262 (origin/main tip / PR #792 merge tip at execution time).
- v20.20.2 is the version setup_20.x resolved to inside that build container on 06-14 (the then-latest Node 20.x).
- It is the BUILD-CONTAINER Node, validly recorded; not a box reading and not an aspirational pin.

Why .2 (container) differs from .1 (box):
- Ordinary build-time-vs-provision-time skew.
- NodeSource setup_20.x installs the newest 20.x at run time (06-14 -> .2); the prod box was provisioned earlier and sits on .1.
- Both satisfy engines >=20.0.0. v20.20.1 and v20.20.2 share the same Node major and NODE_MODULE_VERSION (ABI-identical).

Why the skew is operationally benign in this deployment model:
- Deploy is source-on-box (pm2 runs node src/server.js on the box's own Node; confirmed 06-17 via pm2 describe: id 3, v20.20.1, 15D uptime, 0 restarts).
- The build container's Node never reaches prod runtime.
- Even under a hypothetical artifact-copy path, .1 to .2 is same-major / same-ABI, so no native-module incompatibility arises.
- The container's .2 governs only the off-box build viability checks (P-4 npm ci PASS; P-5 start PASS), not the deployed process.

Net:
- The v20.20.2 pin has valid provenance but pins the build container's Node, not a requirement the source-on-box runtime carries.
- The Phase 2A step 1 exact-patch parity rule, as written, treats this benign same-major skew as a blocking FAIL.

Raised for next cold entry (NOT decided here):
- Whether Phase 2A step 1 should assert exact-patch build-container-vs-box Node parity, given a source-on-box deploy and an operationally benign skew.
- This is a runbook-RULE judgment, deferred to a deliberate cold-window decision with the runbook owner. Not resolvable by reconstruction; not a warm-session call.

Supersedes:
- PR #813 finding 1 ("parity pin provenance remains unverified") is now VERIFIED per above.
- #813 other contents (identity, runtime truth, config/runtime .0-vs-.1 drift hazard, deviation log) stand unchanged.

Safety/state assertions:
- This session's resolution work was local git-history reads only (git log -S, git show -- docs/, Select-String).
- No box contact this session. No canon writes. No repo execution-path mutation. No restart. Box frozen.

Session-status note:
- WARM continuation of the #813 session (confirmed: #813 created minutes prior; HEAD unchanged at 0cfab9c2; no real session break).
- Not a cold window. No Phase 2A attempt opened.