# F-Deploy-1 Locus 7 — Fork RDS SG Disposition (close-not-decommission)

| | |
|---|---|
| **Subject** | Fork RDS SG `sg-0164d0b20fbebacbb` (instance `episode-control-prod`, empty) |
| **Finding** | AF (P0) — world-open `0.0.0.0/0` on `tcp/5432` |
| **Decision date** | 2026-06-16 |
| **Status** | DRAFT — disposition record |
| **Live action this session** | AF P0 closed (revoke executed + verified). All other CIDRs left intact. |

## §1 Live-state findings (verified 2026-06-16, read-only then single revoke)

The fork was confirmed **live**, not inert: instance `episode-control-prod` is `available`, `PubliclyAccessible: true`, bound to `sg-0164d0b20fbebacbb`. "Empty of data" did not mean "not an attack surface" — a live, publicly reachable Postgres accepts connection attempts and is a credential-guessing / pivot target.

`sg-0164d0b20fbebacbb` ingress at read time:

| Proto | Port | CIDR | Disposition |
|---|---|---|---|
| tcp | 5432 | `0.0.0.0/0` | **AF (P0) — REVOKED this session** |
| tcp | 5432 | `10.2.0.0/16` | fork VPC CIDR — legitimate, retained |
| tcp | 5432 | `172.31.0.0/16` | AWS default-VPC range — unexplained, retained pending attribution (§3) |
| tcp | 5432 | `172.31.26.1/32` | unattributed /32 — retained pending attribution (§3) |
| tcp | 5432 | `108.216.160.136/32` | workstation — legitimate, retained |
| tcp | 22 | `10.2.0.0/16` | vestigial (RDS has no SSH) — retained, noted (§3) |

## §2 Action taken and disposition

**AF (P0) closed.** Revoked `0.0.0.0/0` on `tcp/5432` from `sg-0164d0b20fbebacbb`. Revoke confirmed rule `sgr-0d87868226d2a4cd7`; post-revoke describe confirms `0.0.0.0/0` removed and the other four `:5432` CIDRs plus the `tcp/22` rule unchanged. Single-purpose mutation; no deletions, no instance stop/delete, no route/DB/app changes. Rollback command on file (re-authorize the same triple) — not used.

**Disposition: close, NOT decommission.**

- The world-open exposure is closed (§2 above).
- **Decommission (deleting the SG and/or the fork instance) is deferred** until the B-vs-C infrastructure decision is explicit. B is the recorded lean (#781) and P-4/P-5 off-box build viability closed PASS (PR #806); if the B path uses the fork instance as target infrastructure, decommission would destroy a possibly-needed resource. "Nothing to lose" does not license deletion. Decommission is reconsidered only once B-vs-C is committed.

## §3 Residual findings — deliberately out of scope for this pass

Surfaced by live read; **not** acted on (single-purpose discipline). Carried as follow-ups:

1. **`172.31.0.0/16` (default-VPC range) has `:5432` ingress to the fork.** Fork lives in `10.2.0.0/16`; a default-VPC range with Postgres ingress is unexplained — probable SG-template legacy. Attribute or remove in a future security pass.
2. **`172.31.26.1/32` — unattributed /32 with `:5432` ingress.** Structurally identical to the canon-SG `3.94.166.174/32` hazard (an unattributable host treated as an escalation trigger). Attribute or remove; treat reappearance/persistence as a flag.
3. **`tcp/22` rule on an RDS-attached SG.** Vestigial (RDS has no SSH endpoint); suggests this SG was cloned from an EC2 SG. Cosmetic; remove in cleanup.

## §4 What this disposition does NOT do

- Does not remove the §3 residual CIDRs — separate, attributed pass required.
- Does not decommission the SG or the fork instance — deferred to B-vs-C.
- Does not touch canon, the prod box, or any runtime.
- Does not flip `PubliclyAccessible` on the fork — noted as available for a later sweep, not done here.
