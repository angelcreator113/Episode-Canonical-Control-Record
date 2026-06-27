# F-Deploy-1 Canon Credential Durability PLAN (2026-06-12)

> **SCOPING / PLAN DOCUMENT. AUTHORIZES NO BOX ACTION AND NO SECRET WRITE BY ITSELF.**
> This plans the closure of the durability gap recorded in
> `F-Deploy-1_Canon_Credential_Durability_Finding_2026-06-12.md`. It selects the
> store, the naming, and the verification posture, and leaves the single write step
> un-templated by design -- the `put-parameter` is its own deliberate Rule 7 pass,
> not performed in the planning session. Box stays FROZEN. [3] not primed. Reading
> or committing this changes nothing on `episode-backend` and writes no secret.

| | |
|---|---|
| **Parent finding** | `F-Deploy-1_Canon_Credential_Durability_Finding_2026-06-12.md` (the gap this plan closes). |
| **Related** | `F-Deploy-1_Canon_RDS_Password_Rotation_2026-06-12.md` (the credential this backs up); `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` Sec 0 / Sec 7 step 8 (AD migration, deferred). |
| **Scope decision** | **Path 1 (minimal, decoupled) ONLY.** Durable off-box *backup of record*; box boot path UNCHANGED; fetch identity = admin, not the box. |
| **Store decision** | AWS SSM Parameter Store, `SecureString`, KMS-encrypted, `us-east-1`. |
| **Deferred** | **Path 2 (fetch-at-boot via instance profile)** -- folded into the AD/AE instance-profile migration at the post-[3] security sweep (runbook Sec 7 step 8). NOT this plan. |
| **Status** | DRAFT -- scoping complete; awaiting review + commit. Execution (the single `put-parameter`) is a separate gated session. |

---

## Sec 0 -- The two-path split (why Path 1, why not more)

The finding's named risk is narrow and specific: *if the box `.env` is lost or
corrupted before a durable copy exists, the next restart fails canon auth and the
system returns to a credential gap.* Path 1 closes exactly that risk and nothing
more, deliberately:

- **Path 1 (this plan):** store the post-rotation canon password in SSM SecureString
  as a human-retrievable backup of record. The box keeps `.env` as its working copy
  exactly as today. The box boot path does not change. The fetch identity is the
  operator's admin credentials, not the box -- so the AD static-keys hazard is NOT
  touched. Lightest possible closure; can land before [3]; changes nothing about the
  planned restart-to-align.

- **Path 2 (DEFERRED):** migrate the box to fetch the credential from SSM at boot via
  an EC2 **instance profile**, which would also resolve AD (removing the static
  `AWS_ACCESS_KEY_ID`/`SECRET` from `.env`). This is the correct long-term
  architecture but it changes box boot mechanics, adds an IAM role + policy, and runs
  on a memory-constrained, zero-swap, disk-thin box (the box's own `cfoAgent.js`
  warns at `rssMB > 1500` "risk of OOM kill"). It belongs with the AD/AE remediation
  in the post-[3] security sweep, in its own deliberate window -- NOT bolted onto the
  pre-[3] durability fix.

Conflating them would drag a boot-path change into the pre-[3] window for no
durability benefit Path 1 does not already give. Path 1 now; Path 2 with AD, later.

## Sec 1 -- Store: SSM Parameter Store, SecureString

**Decision: SSM Parameter Store `SecureString`, not Secrets Manager.**

Rationale: for a backup-of-record that a human retrieves on a lost-`.env` event,
Secrets Manager's lifecycle features (built-in rotation scheduling, cross-service
integration) are unused weight and cost. SSM SecureString gives KMS-at-rest
encryption, IAM-gated access, and a simple put/get -- exactly the surface Path 1
needs and no more. (If Path 2 later wants automatic rotation, the store decision can
be revisited at that time; it does not bind Path 2.)

There is no prior SSM usage in the tree (confirmed by tree search 2026-06-12: the
only SSM/Secrets-Manager mentions are this morning's three finding/rotation/runbook
docs, all stating "no SSM parameter exists"). So this plan SETS the convention rather
than matching one.

## Sec 2 -- Naming + region

- **Region:** `us-east-1` (same as canon `episode-control-dev`).
- **Parameter name:** `/episode-metadata/canon/db_password`
  - `/episode-metadata` -- app namespace root; matches the on-box dir
    (`/home/ubuntu/episode-metadata`) and the DB name (`episode_metadata`), so the
    path reads as unambiguously this system.
  - `/canon` -- marks this as the canon (`-dev`) credential specifically. This is a
    deliberate guard against the standing RDS naming-inversion hazard: a future
    fork-related parameter would live under a different leaf (e.g.
    `/episode-metadata/fork/...`) and could never be mistaken for the canon value.
  - `db_password` -- the leaf.
- **Extensibility:** the hierarchy lets the AD/Path-2 work later add siblings under
  the same root (`/episode-metadata/canon/db_host`, `/episode-metadata/aws/...`)
  without rework or renaming.
- **Tagging:** tag the parameter to this finding (e.g. `finding=F-Deploy-1-durability`,
  `created=2026-06-12`) so it is traceable back to why it exists.

## Sec 3 -- KMS key

**Decision (Path 1): default `aws/ssm` managed key.** Sufficient for a
backup-of-record; no extra setup. **Recorded decision point, not buried:** a
customer-managed key (CMK) would give tighter, auditable access control and is the
right upgrade IF Path 2 (box-fetch) is built -- at which point the box's instance
profile would need explicit `kms:Decrypt` on a CMK, which is itself a useful access
boundary. CMK is therefore noted as a **Path-2-era upgrade**, deferred with Path 2.

## Sec 4 -- The single execution step (UN-TEMPLATED -- its own gated Rule 7 pass)

**Not performed in the planning session.** Assemble at execution time, against the
value the operator holds securely. The credential is NEVER written inline into a
drafted command, NEVER echoed to the terminal, NEVER committed to shell history.

1. **Write (one gated mutation):** `aws ssm put-parameter` with `--type SecureString`,
   `--name /episode-metadata/canon/db_password`, `--region us-east-1`, value sourced
   from the operator's secure copy (a file read or a prompted variable, not an inline
   literal). **Rule 7:** confirm the parameter name and region twice before write --
   same identifier-discipline applied to the RDS naming hazard, now applied to the
   param path. This is a write to a new AWS resource, not a box touch and not a
   restart.

That is the only write. There is no box action, no `.env` edit, no pm2 anything.

## Sec 5 -- Verification (read-only, after the write -- value never printed)

1. **Round-trip presence:** `aws ssm get-parameter --with-decryption` and confirm the
   parameter exists and decrypts -- but do NOT echo the plaintext to the terminal.
   Confirm by comparing a length/checksum/hash of the decrypted value against a
   length/checksum/hash of the value the operator intended, rather than displaying it.
2. **Canon-authenticates check:** confirm the stored value is the one canon accepts by
   reusing the established read-only SSL probe pattern -- connect to
   `episode-control-dev` read-only (`PGOPTIONS=-c default_transaction_read_only=on`)
   and confirm `current_database()=episode_metadata` / `inet_server_addr()=10.0.20.224`.
   Do not invent a new credential path; reuse the proven one.
3. On a clean round-trip + canon auth: the durability finding is closed -- the
   credential now lives in all three required places (canon RDS, box `.env`, SSM
   SecureString).

## Sec 6 -- Sequencing

- **Before [3]'s restart-to-align.** The finding requires the durable copy to exist
  before the next restart, so `.env` is not the sole copy when the cutover stresses
  it. This plan's execution step lands in that window: after this plan is committed,
  in its own gated session, and before [3] opens.
- **Records the finding closed** once Sec 5 passes -- a short outcome note re-marking
  the durability finding RESOLVED and citing the parameter name (NOT the value).
- **AD / instance-profile migration explicitly deferred** to the post-[3] security
  sweep (runbook Sec 7 step 8). This plan does NOT address AD; a future reader must
  not infer that storing the password here removed the static AWS keys from `.env`.
  It did not. That is Path 2 / AD.

## Sec 7 -- Standing hazards (unchanged by this plan)

- Box stays FROZEN. [3] not primed. No box action authorized.
- This plan writes no secret; the `put-parameter` is a separate gated session.
- The post-rotation canon credential is handled per the rotation doc's hygiene: never
  inline, never to history, never committed.
- RDS naming inversion still applies: any check against canon confirms identity by
  IP/VPC (`10.0.20.224` / canon VPC), never by the `-dev` / `-prod` name string.

## Sec 8 -- What this plan does NOT do

- Does NOT write the secret (Sec 4 is un-templated; execution is a separate session).
- Does NOT touch, restart, or edit `.env` on the box.
- Does NOT build Path 2 (box fetch-at-boot) or migrate the box to an instance profile.
- Does NOT resolve AD/AE/AF (static keys, open SGs) -- those remain the post-[3] sweep.
- Does NOT prime, schedule, or authorize [3].

---
*Path-1 durability closure plan for the post-rotation canon credential. Selects SSM
SecureString (us-east-1, `/episode-metadata/canon/db_password`, default `aws/ssm`
KMS), backup-of-record posture with the box boot path unchanged and fetch identity =
admin (AD untouched). The single `put-parameter` write is un-templated and is its own
gated Rule 7 session; verification is read-only with the value never printed.
Sequenced before [3]'s restart. Path 2 (box fetch-at-boot via instance profile) and
CMK are deferred to the AD migration in the post-[3] security sweep. Authorizes no box
action and writes no secret.*
