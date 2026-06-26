# F-Deploy-1 Evidence Note -- stray ct_modifydb.json removal (2026-06-26)

STATUS: Evidence note. NOT an FD. Mints no register number (FD numbers mint only via
Fix Plan revisions). Forward-pointer record per the register structural rule. Advances no
gate, primes nothing, authorizes no box action. Freeze stands; FD-31/FD-42/FD-43 unchanged.

## What
A stray binary `ct_modifydb.json` was found at repo root on origin/main and removed.

## Provenance
- Introduced: commit `442bac35` (Authorities-block text fix to the Credential Branch
  Execution Runbook). The binary rode in as unintended debris via a blanket `git add`;
  the commit message describes a one-line text edit only. Author: Evoni.
- Removed: commit `7d1d4149` ("chore: remove stray ct_modifydb.json from repo root").

## Classification (why removal, not escalation)
- Distinct from the canonical artifact `docs/audit/F-Deploy-1_CT_ModifyDB_06-23_Rotation_Evidence_REDACTED.json`
  by git hash, but same 224-line count; Compare-Object delta = 20 lines (benign serialization).
- Masking marker `HIDDEN_DUE_TO_SECURITY_REASONS` present 3 times in BOTH files (count-only
  check; contents never dumped). The credential field is masked in the stray file.
- Conclusion: masked-redundant serialization variant. NOT un-redacted. No secret exposure.
- Unreferenced: `git grep -l` on origin/main returned no citation from any fix-plan artifact.

## Disposition
Tree removal only. History bytes at `442bac35` are masked, so no history purge required.

## Carry-forward
- Root cause is a blanket `git add`. Reinforce explicit-path `git add` discipline.
- The removal push used admin bypass of branch protection (direct-to-main, checks skipped);
  one-off exception for trivial debris, not a precedent for substantive changes.