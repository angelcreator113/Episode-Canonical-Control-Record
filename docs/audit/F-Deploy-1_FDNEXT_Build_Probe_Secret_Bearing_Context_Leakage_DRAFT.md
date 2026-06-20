# F-Deploy-1 FD-NEXT Build-Probe Secret-Bearing Context Leakage Record
**Status: PROPOSED ONLY — FD number UNRESOLVED, pending register reconciliation (see §1)**

## 1) Status and minting caveat

This record is PROPOSED and its FD number is deliberately NOT assigned. The authoritative register tail is FD-39 (Fix Plan v1.11; predecessor v1.10 carried the register through FD-38). A standalone record file — F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md — claims FD-40, but no Fix Plan revision in the repo mints FD-40. That number is therefore contested/orphaned, not a settled tail.

Mint rule for THIS record:
1. Becomes FD-40 only if the orphaned FD-40 canon-credential record is renumbered or withdrawn before this record is minted.
2. Becomes FD-41 only if the canon-credential finding is first formally minted as FD-40 in a Fix Plan revision.

At mint time, re-verify the tail against the Fix Plan register itself, not against docs/audit filenames, and not by lexicographic filename sort (which mis-orders v1.10 and v1.11 below v1.9). Use a semantic version sort.

Upstream note (NOT resolved by this record): the orphaned FD-40 canon-credential record documents Gate 2.5, a closed gate the [3] window depends on. Its register status being unreconciled is a register-integrity issue upstream of this finding, flagged separately in F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md.

## 2) Class and relation to FD-40 standalone

Class: hardening and secret-handling hygiene.
Disposition: latent defect eliminated before demonstrated exploitation.
Relation to the orphaned FD-40 standalone: distinct subject matter. This record does not reopen, close, renumber, or classify the canon-credential finding.

## 3) Summary

During the 2026-06-18 F-Deploy-1 P-4/P-5 off-box parity-build verification, two surfaces showed one root pattern: secret-bearing or probe-bearing context could land in unintended build or tool byproducts. Both instances were remediated in-session. No demonstrated downstream compromise is asserted.

## 4) Why this is a finding

The finding is not proven abuse. The finding is leakage-path permissiveness in the build-probe loop: sensitive runtime context could land in byproducts where it did not belong. That pattern is a defect even when immediate run controls prevent live impact.

## 5) Instance A — .env entered parity-image context

What happened:
1. Parity image built from repo context with COPY . .
2. Active .dockerignore at first run did not exclude .env.
3. First start-verify output included injecting env (31) from .env and showed .env-derived defaults including a real RDS host value.

What is asserted:
1. First verification image carried .env-derived defaults that should not exist in parity evidence artifacts.
2. Image remained local and was not pushed.
3. Run remained DB-safe because explicit dead-target DATABASE_URL override won; process attempted 127.0.0.1:1.

Why it matters:
1. Parity evidence artifacts must not carry credential defaults or real runtime connection defaults.
2. Without dead-target override, artifact defaults could drift toward real endpoint use.

Remediation:
1. .dockerignore corrected to exclude .env and .env.*.
2. Credential-bearing local image removed, not merely superseded (proof in Appendix A).
3. Build and start-verify rerun clean: injecting env (0), DB_HOST NOT SET, DB_USER NOT SET, DB_SSL NOT SET, ready banner reached.

## 6) Instance B — Copilot session cache surface read during same probe loop

What happened:
1. During verification, Copilot chat-session content.txt cache surface was read.
2. That surface is known to potentially carry probe-bearing context.

What is asserted:
1. Reading the surface replicated held probe-context into an additional session context.
2. This record does not assert a confirmed live secret value in file content at read time.
3. Risk is surface expansion itself.

Why it matters:
1. Same root pattern as Instance A, at tool-cache layer.

Remediation:
1. Session content.txt cache cleared immediately after recognition.
2. Clearance confirmed: 6 files removed, 0 remaining.
3. Post-probe cache clearance reaffirmed as mandatory close step.

## 7) Shared root pattern

Same control failure at two layers: secret-bearing context landing in build byproduct or tool-cache byproduct. Control intent is to reduce open leakage paths and enforce closeout discipline independent of operator memory.

## 8) Controls added or reaffirmed

1. Any image built from repo context must exclude .env and .env.* in .dockerignore.
2. Post-probe Copilot content.txt cache clearance is mandatory close step for build-probe sessions.
3. If earlier artifact carried secret-bearing defaults, evidence artifact-of-record must be clean rerun and superseded artifact must be removed.

## 9) Scope and non-claims

1. No pushed image, shared registry publication, or downstream credential use is asserted.
2. This record does not decide numbering or status of the orphaned FD-40 standalone.
3. P-4/P-5 run is not claimed to have contacted real database; clean rerun evidence shows dead-target override stayed in force.

## 10) Operational result

Both instances were closed in-session. Artifact-of-record is the clean rerun, not the first image and run. First credential-bearing local image was removed.

## 11) Appendix A — Image provenance and removal proof

Purpose: disambiguate same-tag rebuilds and prove the credential-bearing first image is not retained.

Evidence:
1. Dirty build exported manifest-list digest, captured from p4p5-build-20260618-114808.log: sha256:323ce2be9bf5e705fda7995d327ce3ee848bb5000239f6f065ad4986372b2574. Local presence check for this digest: NOT present.
2. Present retained image: ID b6f36bdf0aa1, tag local, created 2026-06-18 12:05:56 -0400, size 1.94GB.
3. Clean build log binds this image. The present image ID b6f36bdf0aa1 is the leading 12 hex of the clean build config digest sha256:b6f36bdf0aa1c95a32349750c4ebad7977eb21a74ebe876b57cff44589e2e43d, recorded in p4p5-build-20260618-120336-clean.log alongside the naming line for episode-p4p5-verify:local.

Conclusion: the retained local image is the clean rebuild (digest head + creation timestamp both tie to the clean build); the dirty credential-bearing manifest-list digest is absent locally. The "removed" claim in sections 5 and 10 is proven, not asserted.

Historical-removal note: removal-moment output from docker image rm was not retained at execution time; per discipline it is not reconstructed. The provenance proof above stands independently of the removal-moment output.