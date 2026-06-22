# Evidence — 2026-06-21 Canon Auth Investigation (Adjudication Record)

**Type:** Evidentiary note (forensic capture + adjudication). Filed as a note + forward-pointer; mints no FD; not a Fix Plan revision.
**Backs:** FD-41 (F-Deploy-1 Fix Plan v1.14 §3) — stored canon credential stale against canon — AND the correction of the original 2026-06-21 investigation claims.
**Session:** 2026-06-21, read-only. No mutations; no prod-box action.
**Forward-pointer:** → FD-41.

---

## 1. Scope and outcome

This note holds the read-only captures that (a) refuted the original investigation's two headline claims and (b) established the corrected finding. Outcome: the original claims of "no credential authenticates against canon" and "`.env` SHA ≠ SSM v2 SHA" are both FALSE; the corrected, narrower condition is that the **stored** credential (`.env` == SSM v2) is stale against canon, with the working credential held only in the running app's in-memory pool. Cause is admin-confirmed benign (incomplete credential change, 2026-06-14/15). Secret discipline: passwords appear only as SHA-256 + length + first/last char.

## 2. App posture — app is healthy on canon

`pm2 list` (box): `episode-api` (id 0, cluster) online; `episode-api-prod-…` (id 3, fork) online; `episode-worker` (id 1) online.

Listening (`ss -ltnp`): `0.0.0.0:3000` (node, pid 1384830) and `0.0.0.0:3002` (PM2 God daemon).

`/health` on canon host (`curl http://localhost:3000/health`), verbatim:
```
{"status":"healthy","timestamp":"2026-06-21T18:59:45.842Z","uptime":1743434.400321572,"version":"v1","environment":"production","config":{"DATABASE_URL":"NOT SET","DB_HOST":"episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com","DB_NAME":"episode_metadata","DB_SSL":"true"},"database":"connected","showsTableExists":true,"showCount":1,"episodeCount":18,"currentDatabase":"episode_metadata"}
```
HTTP 200. `database:connected`, `currentDatabase:episode_metadata`, uptime ≈ 1,743,434 s ≈ 20.2 days (start ≈ 2026-06-01). The running app authenticates against canon — refutes original claim (a).

## 3. Masked `.env` config extract (box)

Source: `/home/ubuntu/episode-metadata/.env`.
```
DB_HOST=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
DB_NAME=episode_metadata
DB_USER=postgres
DB_PORT=5432
```
`DB_PASSWORD` (masked): `len=38`, `firstchar=F`, `lastchar=9`; SHA-256 = `97aac3b0db096fa8176902ac3de71cf2286cef121f3ba8517e5d2f2a17041fae`.

## 4. Stored-credential auth tests — fail against canon from both shells

Workstation (`PGPASSWORD` from SSM v2 → psql to canon):
```
psql: error: ... episode-control-dev...(100.50.2.212), port 5432 failed:
FATAL:  password authentication failed for user "postgres"
psql_exit=2
```
Box (`PGPASSWORD` from `.env` → psql to canon):
```
psql: error: ... episode-control-dev...(100.50.2.212), port 5432 failed:
FATAL:  password authentication failed for user "postgres"
psql_exit=2
```
Both reached the server and received an authentication verdict (not a timeout/refusal). The stored credential fails against canon; the app's in-memory credential is the only one that works.

## 5. Hash identity — `.env` == SSM v2 (refutes original claim (b))

```
A6 (box .env) env_pw_sha256 = 97aac3b0db096fa8176902ac3de71cf2286cef121f3ba8517e5d2f2a17041fae  (len 38, F…9)
B7 (SSM v2)   ssm_v2_sha256 = 97aac3b0db096fa8176902ac3de71cf2286cef121f3ba8517e5d2f2a17041fae  (len 38, F…9)
```
Byte-identical. The `97aac3b0…41fae` value the original cited as a point of mismatch is the SHARED hash of both stored values.

## 6. Control-plane state

`describe-db-instances` (JSON), two instances:
```
[
  {"Id":"episode-control-dev","Status":"available","Public":true,"Master":"postgres","Endpoint":"episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com"},
  {"Id":"episode-control-prod","Status":"available","Public":true,"Master":"postgres","Endpoint":"episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com"}
]
```
Both instances `available`, `Public:true` (the public exposure is the known AF-class finding), master user `postgres` (confirms `modify-db-instance --master-user-password` is the apply mechanism).

SSM `get-parameter-history` (JSON), no v3:
```
[
  {"Version":1,"LastModified":"2026-06-14T14:19:58.702000-04:00","User":"arn:aws:iam::637423256673:user/evoni-admin"},
  {"Version":2,"LastModified":"2026-06-15T09:53:10.214000-04:00","User":"arn:aws:iam::637423256673:user/evoni-admin"}
]
```
v1 2026-06-14, v2 2026-06-15, both by `evoni-admin`. App start (~06-01) predates both — the app loaded its credential before either stored version existed.

CloudTrail `ModifyDBInstance` lookup: empty (no RDS-side master-password change). RDS events in window: routine automated backups + a 2026-06-08 engine-version upgrade (pre-check / downtime / upgrade started) — unrelated to the credential.

## 7. Fork — out of scope, no auth conclusion

Fork (`episode-control-prod`) resolves to `34.237.165.225` (distinct from canon's `100.50.2.212`). From the box, `:5432` was NETWORK-UNREACHABLE (connection timed out; `prod_5432=unreachable`). No fork auth was attempted to a verdict — no fork conclusion is claimed. Admin confirms `FORK_DB_PASSWORD` is a distinct value from `DB_PASSWORD` (no cross-wire).

## 8. Adjudication

Hypotheses considered: H1 (investigation auth-test artifact), H2 (real stored-credential drift), H3 (wrong-target/misdirected test). Both shells resolved canon to the same `100.50.2.212` and both got an auth verdict (kills H3-as-misdirection); `PGPASSWORD` bypassed shell quoting and still failed (kills H1-as-quoting). The app authenticates on a pre-06-15 in-memory credential while the stored 06-15 value fails → **H2**. Admin recognizes the 06-14/15 SSM writes and confirms they were an intended credential change never completed against canon → **H2 benign (incomplete/mis-targeted rotation)**, not an incident, not a cross-wire.

Forward-pointer → FD-41 (Fix Plan v1.14 §3). Remediation direction (admin-chosen): apply the stored value to canon as master, adopted at the [3] restart-to-align.
