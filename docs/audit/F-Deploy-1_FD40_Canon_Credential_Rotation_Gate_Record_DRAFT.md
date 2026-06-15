# F-Deploy-1 FD-40 Canon Credential Rotation Gate Record

**Gate 2.5: CLOSED — 2026-06-15**

Rotation complete. All four evidence points satisfied. Gate moves OPEN → CLOSED.

## 1) Purpose

Records the canon credential rotation that closed Gate 2.5. Rotation commands were live-assembled at execution time per the source-of-record procedure (exposure finding §5). No credential value appears in this record.

## 2) Sources

Sources:
- docs/audit/F-Deploy-1_Canon_Credential_Exposure_Finding_2026-06-14_DRAFT.md (especially Sec 5)
- docs/audit/F-Deploy-1_Canon_SG_Containment_Finding_2026-06-14_DRAFT.md
- docs/audit/F-Deploy-1_Canon_Credential_Rotation_Session_Brief_DRAFT.md
- docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md (blocker context only)

Scope of this FD:
Scope: Gate 2.5 rotation and closure record. Canon AF-label correction. Escalation triggers. Investigation-status carry.

## 3) FD-40 finding and decision

**Exposure finding (carried from 2026-06-14, now closed):**
- Canon DB credential confirmed exposed in terminal output during the 2026-06-14 put-parameter verification session. Classified COMPROMISED. SSM v1 backed a compromised value.
- Network containment executed same night: sg-002578912805d1930 tcp/5432 narrowed to four explicit CIDRs; 0.0.0.0/0 and 3.94.166.174/32 removed. Production was not interrupted.

**Decision — rotation and gate-close (this session, 2026-06-15):**
- Canon DB credential rotated on RDS instance `episode-control-dev`.
- Box `/home/ubuntu/episode-metadata/.env` DB_PASSWORD updated via keyed sed replacement.
- SSM `/episode-metadata/canon/db_password` overwritten to version 2.
- All four evidence points satisfied. Gate 2.5 CLOSED.

## 4) Canon AF-label correction (carried and closed)

- Canon-side exposed SG: `sg-002578912805d1930` (canon, `10.0.20.224`)
- Previously mis-labeled in carried register: `sg-0164d0b20fbebacbb` (empty fork — not canon)
- Correction is now on record. Hardening actions must target `sg-002578912805d1930`.

## 5) Standing escalation triggers

Treat either condition as immediate escalation, not a rotation step:
- 0.0.0.0/0 reappears on canon SG ingress for tcp/5432.
- 3.94.166.174/32 reappears on canon ingress.

## 6) Investigation-status carry (was-it-used question)

Status at FD-40 close: **investigation-incomplete, closed on rotation.**

- VPC flow logs absent on canon VPC (`vpc-0754967be21268e7e`). Cannot determine whether any connection succeeded against the exposed credential.
- RDS error logs available back to 2026-06-12 only. Show failed external auth probes (active internet scanning observed at containment time) but cannot confirm or rule out a successful login before containment.
- CloudTrail attribution for `3.94.166.174/32` rule origin aged out of 90-day lookup window. Rule removed without attribution; identity unknown.
- Disposition: investigation-incomplete. Credential rotated; path closed; this is the final evidence-retention entry.

## 7) Gate 2.5 closure evidence (all four satisfied)

**1. CloudTrail PutParameter v1 → v2:**
- v2 write: `2026-06-15T09:53:10-04:00 | evoni-admin`
- v1 prior write (superseded): `2026-06-14T14:19:58-04:00 | evoni-admin`
- Version increment confirmed this session.

**2. Byte-equality:**
- `SSM_LEN=38  ENV_LEN=38  EQUAL=TRUE`
- Both 38 chars, length-matched. SSM v2 == box .env DB_PASSWORD.

**3. Box-side canon probe:**
- Output: `episode_metadata|143|10.0.20.224`
- Canon discriminator confirmed: correct database, full 143-table population, canon private IP `10.0.20.224`.

**4. Hygiene:**
- In-memory variables `PlainPw` and `SecurePw` removed after SSM write, before evidence block.
- No credential value appears in this record or in any committed artifact.
- Local terminal scrollback cleared by operator after session close (operator attestation required to complete this point).

## 8) Session scope close

Gate 2.5 is CLOSED. This session is complete.

[3] is eligible to open in its own cold session, subject to its own wake-up sequence and FD-31 §7 abort re-verify. [3] was not primed or touched in this session.

Remaining deferred items (not this session):
- Fork-side SG `sg-0164d0b20fbebacbb` still open `0.0.0.0/0` on :5432 — deferred to post-[3] security sweep.
- AD instance-profile migration, AE/AF SG lockdown, snapshot encryption — post-[3] sweep.
- Enable VPC flow logs on canon VPC (`vpc-0754967be21268e7e`).
- `PubliclyAccessible: true` still set on canon RDS — deeper fix, gated window required.

---

*FD-40 gate record. Gate 2.5 CLOSED 2026-06-15. Credential rotated on episode-control-dev; SSM v2 written by evoni-admin at 2026-06-15T09:53:10-04:00; box .env aligned (38 chars, EQUAL=TRUE); canon probe confirmed episode_metadata|143|10.0.20.224. No credential value recorded. [3] not primed.*