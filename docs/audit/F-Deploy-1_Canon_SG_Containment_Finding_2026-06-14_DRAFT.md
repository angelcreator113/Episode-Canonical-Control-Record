# F-Deploy-1 - Canon RDS Security-Group Containment Finding

Date: 2026-06-14 (local EDT; evidence timestamps in this document are UTC - see Note on dating)
Status: DRAFT - additive finding and containment action record
Additive on: docs/audit/F-Deploy-1_Canon_Credential_Exposure_Finding_2026-06-14_DRAFT.md (the #797 exposure finding)
Supersedes: Nothing

---

## Note on dating

The containment actions in this record executed late on 2026-06-14 local (US/Eastern, EDT, UTC-4). All machine-emitted evidence quoted below is in UTC, so it carries 2026-06-15 timestamps (e.g. the post-containment health body at `2026-06-15T03:48:28Z` = 2026-06-14 23:48 EDT). The filename and `Date:` field use local date for consistency with the adjacent exposure finding; the UTC evidence timestamps are not an inconsistency.

## 0. Relationship to the exposure finding (#797)

The #797 exposure finding established that the canon RDS credential is **compromised** (surfaced in terminal error output during a wholesale `source` of the box `.env`), that the value is **not** present in any committed artifact (no git-history scrub indicated), that the box `.env` and **SSM SecureString v1** both hold the compromised value (v1 byte-equal to box `DB_PASSWORD`), and that the canon-side RDS security group allowed `tcp/5432` from `0.0.0.0/0` with `PubliclyAccessible: true`, calling out the acute combined risk.

This document is the **containment action record** that followed from that finding: the canon-side network path was closed. It does not close the exposure - rotation remains owed (Section 6).

## 1. Summary

Canon RDS security group `sg-002578912805d1930` (fronting `episode-control-dev`, the live canon instance) was reachable on `tcp/5432` from the entire internet, while the canon credential was confirmed compromised. During investigation, the RDS error logs showed the port was being **actively probed** from the internet. The open path and an unidentified external standing-access rule were removed under an add-before-remove sequence. Production was not interrupted. The credential itself remains compromised and unrotated; this was containment of the network path, not closure of the exposure.

## 2. Topology resolved by evidence (naming-inversion hazard)

All bindings below were resolved read-only by IP/VPC, not by resource-name string, per the standing naming-inversion hazard.

- **Canon** = `episode-control-dev`, endpoint `episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`, `PubliclyAccessible: true`, SG `sg-002578912805d1930`, VPC `vpc-0754967be21268e7e`, VPC CIDR `10.0.0.0/16` (confirmed via `describe-vpcs`).
- **Fork** (empty) = `episode-control-prod`, SG `sg-0164d0b20fbebacbb`, VPC `vpc-09cc6fa2ee3ce35ba`. Also open `0.0.0.0/0` on `:5432`; NOT credential-coupled; deferred to the post-[3] sweep.
- **Prod box** = `i-02ae7608c531db485`, VPC `vpc-0648ebfe73202e60d`, private `172.31.26.1`, public `54.163.229.144`, SG `sg-05c3a6ed6eee7b3a6`. Cross-VPC from canon; reaches canon over the **public** endpoint (canon resolved to public `100.50.2.212` from the box, stable across three reads). SG-to-SG reference therefore not viable; CIDR allowlist used.

**Correction to carried state:** prior-session state recorded the canon-side open SG as `sg-0164d0b20fbebacbb` ("AF = prod RDS SG"). That ID is real but fronts the **empty fork**, not canon. The canon-side SG that actually carried the compromised-credential exposure is `sg-002578912805d1930`. Acting on the carried label would have hardened an empty database and left canon open. Resolved by `describe-db-instances` / `describe-security-groups` / `describe-vpcs`.

## 3. Pre-containment ingress snapshot (rollback reference)

`sg-002578912805d1930`, `tcp/5432`, as captured immediately before mutation:

- `0.0.0.0/0`
- `3.94.166.174/32`
- `108.216.160.136/32` (workstation; already present)
- `10.0.0.0/16` (canon VPC internal; already present)

**Key finding within the snapshot:** the prod box's own IP (`54.163.229.144/32`) was **not** an ingress rule. The box had been reaching its production database **through `0.0.0.0/0`**. The open rule was not a harmless misconfiguration sitting beside proper rules - it was production's actual canon DB path. This is why the containment had to add the box's dedicated rule **before** revoking the broad rule; reversing that order would have cut production's live DB connection.

## 4. The unidentified external rule: `3.94.166.174/32`

A specific `/32` for `3.94.166.174` held standing `:5432` access to canon. Investigation:

- `ec2:describe-instances` filtered on this IP returned empty -> not an EC2 instance in this account.
- `ec2:describe-addresses` filtered on this IP returned empty -> not an Elastic IP in this account.
- `cloudtrail lookup-events` on `AuthorizeSecurityGroupIngress` (200 events) returned no match for the IP or the SG -> the authorizing event has most likely **aged out** of CloudTrail's ~90-day lookup window.

The rule could **not** be attributed. `3.94.166.174` is in AWS-owned (`3.x`) address space, but ownership/purpose is unknown. It was removed without attribution. The benign reading (stale setup-era or former-resource entry) and the non-benign reading (deliberately pinned external access) cannot be distinguished from the available evidence. **If this IP reappears in any ingress rule, treat as escalation.**

## 5. Telemetry gaps and active-probing evidence

**Telemetry we do not have:**
- **No VPC flow logs** exist on canon's VPC (`vpc-0754967be21268e7e`) - `describe-flow-logs` returned empty. We therefore **cannot prove** whether `3.94.166.174`, or anyone, ever connected to `:5432`.
- RDS logs are **error logs only** (no `log_connections`); ~7-13 KB/hour, back to 2026-06-12 only. They show **failed** auth attempts but **cannot confirm or rule out a successful login** with the compromised credential.

**Active probing observed** (from downloaded `tmp_rds_logs/*.txt` - see provenance note):
- `186.236.240.56` - repeated `FATAL ... no pg_hba.conf entry`, cycling usernames `testadmin` / `webuser` / `appuser` against `postgres`, continuing into current hours.
- `64.89.163.134` - auth failures at `2026-06-15T02:10Z` for `postgres`.
- Own-address failures during recovery windows (`108.216.160.136`, `54.163.229.144`) - expected, not noteworthy.

The probing confirmed the exposure was being actively exercised at the time of containment. Once `0.0.0.0/0` was revoked, these sources lost their path along with everyone not explicitly allowlisted; no per-IP blocks were needed.

## 6. Containment actions executed

Add-before-remove ordering on `sg-002578912805d1930`, `tcp/5432`. Each step verified before proceeding. `108.216.160.136/32` and `10.0.0.0/16` were already present and were NOT re-added (would have errored on duplicate). Step 4 of the original draft (re-assert internal range) was therefore cancelled.

| Step | Action | CIDR | Resulting/removed rule ID |
|------|--------|------|---------------------------|
| 3a | authorize | `54.163.229.144/32` (prod box) | `sgr-0bdda3eea75890267` |
| 3b | authorize | `98.93.190.74/32` (dev box) | `sgr-00607180cbd09ef29` |
| 5 | revoke | `0.0.0.0/0` | `sgr-02fd7407378d691f4` (removed) |
| 6 | revoke | `3.94.166.174/32` | `sgr-089138f4cbaec10f3` (removed) |

Between step 5 and step 6, a box-side reachability smoke check (`nc -zv -w 5 <canon endpoint> 5432`) confirmed the box still reached canon via its new `/32` - production survived the cut. Rollback (re-add `0.0.0.0/0`, find the box's true egress, re-cut) was staged but not needed.

**Final verified ingress** (`tcp/5432`), exactly four rules:
- `10.0.0.0/16`
- `54.163.229.144/32`
- `98.93.190.74/32`
- `108.216.160.136/32`

No `0.0.0.0/0`. No `3.94.166.174/32`.

**Post-containment health (identity-asserted):** `GET /health` on the box returned `200` with `database: connected`, `currentDatabase: episode_metadata`, `DB_HOST` = the `episode-control-dev` endpoint, `showCount: 1`, `episodeCount: 18` (timestamp `2026-06-15T03:48:28Z`). The application is connected to canon, on the expected host, with show/episode counts consistent with prior liveness reads. Incidental: `DATABASE_URL: NOT SET`, `DB_SSL: true` - the app connects over SSL via discrete `DB_*` vars, not a URL-embedded credential.

## 7. What remains OPEN (this is containment, not closure)

1. **Credential still compromised.** The network path is closed; the credential is not rotated. An unrotated-but-now-unreachable credential is contained, not fixed. **Rotation is owed as its own deliberate session, BEFORE [3] - not buried inside the [3] window.** Rotation must also overwrite **SSM SecureString to v2** (v1 is byte-equal to the leaked value per #797).
2. **`3.94.166.174` unidentified.** Removed without attribution. Reappearance = escalate.
3. **`PubliclyAccessible: true` still set on canon.** The SG is now the **only** barrier between the internet and `:5432`; a single SG misconfiguration would re-expose. Flipping to `false` is the deeper fix but couples to endpoint/DNS/connection-string changes and the running process - it belongs in a later gated window, not a panic move.
4. **No flow logs on canon's VPC.** Enable them so the next "did anyone connect" is answerable rather than blind.
5. **Fork SG `sg-0164d0b20fbebacbb`** still open `0.0.0.0/0` on `:5432`. Real but not credential-coupled (empty DB); deferred to the post-[3] sweep as planned (AF/AE).
6. **AD (no instance profile; static keys in box `.env`)** is directly implicated - the leaked credential was a static secret living in `.env`. Migration off static keys to an instance profile remains in the post-[3] security sweep and is reinforced by this incident.

## 8. Methodological notes

- The naming-inversion hazard bit (carried `AF = sg-0164...` was the fork, not canon) and was caught only because bindings were verified by IP/VPC, not name string. Standing hazard reaffirmed.
- The `source .env` exposure vector from #797 was actively avoided throughout tonight's box reads: single-line `grep -E '^DB_HOST='` only, never a wholesale `source`.
- Gate discipline held end to end: every value verified by read-only evidence before any mutation; add-before-remove; smoke check between the two revokes; rollback staged. No command batched in a way that could obscure an error on the site-risking step.

## 9. Evidence provenance

- Probing evidence: the **downloaded** `tmp_rds_logs/*.txt` files (from `rds:download-db-log-file-portion`), NOT the editor cache renders the same text was first viewed through. For an incident record, cite the downloaded artifacts.
- Rule IDs: from the live `authorize`/`revoke` API responses (Section 6 table).
- Topology: `describe-db-instances`, `describe-security-groups`, `describe-vpcs`, `describe-instances`, `describe-addresses`, `describe-flow-logs`; box-side `nc` and `getent`.
- **Retention:** `tmp_sg_describe.json`, `tmp_sg_authz_events.json`, and `tmp_rds_logs/` must be retained until this finding has been reviewed and its quoted evidence confirmed transcribed. They are local scratch and must NOT be committed; clean them only after review.
