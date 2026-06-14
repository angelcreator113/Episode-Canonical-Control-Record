# Finding - PM2 Process-Identity Inversion: Production Ingress Is `episode-api-prod-hotfix` (PORT 3000), Not `episode-api`

**Date:** 2026-06-14
**Session:** Read-only PM2/nginx/port forensics on prod box
**Status:** DRAFT FILED LOCALLY - additive finding only. No box mutation. No restart. No credential extraction.
**Additive on:** `Prime_Studios_Audit_Handoff_v20.md` (especially Sec 4) and the credential-recovery decision chain (`#791`). Supersedes nothing.

---

## 0. One-line

Production ingress currently terminates on PM2 process `episode-api-prod-hotfix` (PORT 3000), while PM2 process `episode-api` serves dev ingress on PORT 3002. Process names are not reliable role indicators in this topology; route and port are authoritative.

## 1. Why this finding was opened

v20 required identifying the undocumented third PM2 process `episode-api-prod-hotfix` before any `[3]` restart planning. This session closed that unknown and found a higher-order issue: process identity in planning had been inferred by name, but live routing shows role inversion at the PM2 layer.

## 2. Evidence captured (read-only)

### 2.1 PM2 process inventory

`pm2 ls` shows three online processes:
- `episode-api` (cluster, uptime ~13D)
- `episode-worker` (fork, uptime ~14D)
- `episode-api-prod-hotfix` (fork, uptime ~12D)

### 2.2 Hotfix process identity

`pm2 describe episode-api-prod-hotfix`:
- script path: `/home/ubuntu/episode-metadata/src/server.js`
- exec cwd: `/home/ubuntu/episode-metadata`
- node env: `production`
- created at: `2026-06-01T14:42:31.435Z`

Timestamp reconciliation (authoritative source check):
- PM2 raw data (`pm2 jlist`) reports both `pm_uptime` and `created_at` as `1780324951435` for this process.
- Decoding `1780324951435` yields `2026-06-01T14:42:31.435Z`.
- Therefore, prior references to `~06-01 20:02` (including v20 Sec 1 wording) are treated as a decode/transcription error, and this finding is the correcting record for planning use.
- Discipline note: v20 carried a specific-looking timestamp that is not supported by live PM2 data; treat this as a sourcing-quality signal, not just a numeric swap.

### 2.3 PM2 env role split (non-secret fields)

Key non-secret env comparison:
- `episode-api` (id 0): `PORT=3002`, `APP_NAME=Episode Metadata API (Development)`
- `episode-api-prod-hotfix` (id 3): `PORT=3000`, `APP_NAME=Episode Metadata API (Production)`
- `episode-worker` (id 1): worker process, separate script

### 2.4 nginx ingress mapping

Active nginx config (`nginx -T`) shows:
- `dev.primepisodes.com` -> `proxy_pass http://localhost:3002`
- `primepisodes.com` and `www.primepisodes.com` -> `proxy_pass http://localhost:3000`

### 2.5 Listener ownership and health checks

Socket ownership:
- `:3000` is owned by node PID `1384830` (PM2 id 3, `episode-api-prod-hotfix`)
- `:3002` is separately listening and reachable

Both endpoints respond healthy:
- `http://127.0.0.1:3000/health` -> healthy
- `http://127.0.0.1:3002/health` -> healthy

## 3. Conclusion

The active production API listener is `episode-api-prod-hotfix` on PORT 3000. The process named `episode-api` is currently aligned to dev routing on PORT 3002.

Operational rule from this point forward:
- Do not infer production role from PM2 process name.
- Verify role by ingress route (`nginx`) and bound port (`ss`), then map to PID/PM2 id.

## 4. Impact on v20 credential reasoning

v20 correctly established that the working canon credential is volatile and tied to long-running process memory, but it did not yet distinguish API role by route/port.

Because both API-class processes booted around 2026-06-01, the sharpened pre-`[3]` question is:
- Which running process memory currently holds the credential that actually authenticates to canon?
- Is that the same process currently serving production ingress (PORT 3000 path)?

This is sequencing-critical for the atomic rotate+restart window.

## 5. Policy and handling constraints reaffirmed

A credential value appeared in PM2 env output during this session. It was treated as sensitive:
- not copied into this finding
- not echoed in chat artifacts beyond redacted mention
- not persisted to new secret stores

No credential extraction action was taken. Recovery-vs-rotate remains the architecture/policy decision tracked in `#791` chain and v20 Sec 8 Q1.

## 6. `[3]` planning deltas from this finding

This finding closes one v20 prerequisite (identify hotfix process), but does not make `[3]` ready to prime.

Required deltas for `[3]` Step-0 planning:
- Treat PM2 id/name mapping as non-authoritative until route/port checked live.
- Include PM2 id 3 (`episode-api-prod-hotfix`, PORT 3000) explicitly in production restart targeting.
- Keep v20 blockers unchanged: credential re-establish/correction requirement, fresh FD-31/FD-38 abort re-verify, and `inet_server_addr()` reconcile.

## 7. Session-close state

- Box changes: none (read-only diagnostics only)
- Process changes: none
- nginx/PM2 writes: none
- Artifact: this finding file only

## 8. Canonical cross-references

- `docs/audit/Prime_Studios_Audit_Handoff_v20.md` (Sec 1, Sec 4)
- `docs/audit/F-Deploy-1_Finding_BoxEnv_CredentialDrift_2026-06-13.md`
- `docs/audit/F-Deploy-1_Branch-B_Extraction_Runbook_2026-06-12.md`
- `#791` recovery-surface closure chain (external issue thread)
