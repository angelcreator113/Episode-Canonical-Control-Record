# F-Deploy-1 Finding - Credential Recovery Surface Status (2026-06-13)

Status: FILED - 2026-06-13  
Scope: Credential recovery viability for canon auth continuity before [3]  
Position: Companion to v20, additive, no supersede

## 1. Finding statement

Recovery via tested safe extraction surfaces is exhausted.

Specifically:
1. On-disk .env was previously refuted as canon-invalid.
2. Process-environ recovery was tested and either absent (API) or stale-at-canon (worker, hotfix).

The API working value, if it persists in heap, was deliberately not mined. Live-heap extraction on frozen production is out of scope as unsafe.

## 2. Evidence matrix (process-by-process)

Process: episode-api (PID 1380150, boot ~2026-06-01 05:12)
1. DB_PASSWORD presence in process environ: 0
2. Extraction result: EXTRACT_EMPTY
3. Auth probe from environ: not possible (no value in environ)

Process: episode-worker (PID 1371604, boot ~2026-05-31 01:32)
1. DB_PASSWORD presence in process environ: 1
2. Extraction result: non-empty recoverable value
3. Auth probe with sslmode=require to canon: FATAL password authentication failed for user postgres

Process: episode-api-prod-hotfix (PID 1384830, boot ~2026-06-01 20:02)
1. DB_PASSWORD presence in process environ: 1
2. Extraction result: non-empty recoverable value
3. Auth probe with sslmode=require to canon: FATAL password authentication failed for user postgres

Shared target verification:
1. API and hotfix PM2 env point to the canon-named RDS host episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
2. DB user is postgres, DB name is episode_metadata
3. Canon rejects non-SSL fallback (pg_hba no-encryption rejection observed), so SSL is a hard client constraint
4. All three processes booted before the 2026-06-10 canon rotation; stale-at-canon results are consistent with each holding pre-rotation values

## 3. Runtime-health interpretation guard (load-bearing)

Pooled connections re-authenticate only on socket reconnect, not per-query. Live counts therefore reflect sessions authenticated at June-1 boot time, not proof that any credential would authenticate a fresh connection today.

Observed:
1. Local health checks on ports 3002 and 3000 returned database connected with nonzero counts.

Interpretation boundary:
1. Correct: runtime DB operations currently succeed while tested recoverable credentials are stale.
2. Incorrect: API credential is proven valid against fresh auth.

## 4. [3] hazard mechanism (sharpened)

1. Runtime continuity can be sustained by existing pooled DB sessions established before credential invalidation.
2. Restart tears down those sessions and forces fresh auth.
3. Fresh auth then depends on credential material available at restart time.
4. All safely recoverable values tested so far are stale (or absent in API environ).

Whether the API additionally holds a still-valid heap credential is undetermined and does not change this hazard: restart forces fresh auth regardless, and all safely recoverable values are stale.

## 5. Recovery-surface accounting and resolution gate

Recovery surfaces considered:
1. On-disk .env at /home/ubuntu/episode-metadata/.env  
Result: refuted as canon-invalid by prior finding chain.
2. Process environ at /proc/pid/environ  
Result: tested in this finding; exhausted on tested processes (API absent, worker/hotfix stale).
3. PM2 dump at /home/ubuntu/.pm2/dump.pm2  
Result: resolved stale-at-canon by mtime. Dump last saved 2026-06-01 15:03 UTC (stat), predating the 2026-06-10 canon rotation by nine days. Any DB_PASSWORD it serializes is from the pre-rotation population and structurally cannot be canon-valid, by the same mechanism as the worker/hotfix environ values. Presence confirmed (grep count 8 across all app env blocks); value deliberately not extracted or probed, as mtime resolves the surface without live auth load on frozen production.
4. Live process heap  
Result: ruled out by policy as unsafe on frozen production.

Resolution:
1. Recovery via all four safe surfaces is exhausted: on-disk .env (canon-invalid), API environ (absent), worker/hotfix environ (stale-at-canon, probe-confirmed), PM2 dump (stale-at-canon by mtime). Live heap ruled out by policy.
2. No untested safe surface remains.
3. Rotation is the operational path for [3], atomic with restart-to-align per the Step-0 mechanics below.

Rotation mechanics (explicit):
1. Rotation means changing the canon RDS master password for postgres on the inversion-named canon instance episode-control-dev.
2. This is an RDS API operation.
3. It invalidates in-memory credentials across all running processes simultaneously.
4. Therefore rotation and restart-to-align must be one atomic [3]/FD-31 Step-0 window, not staged as separate actions.

## 6. Explicit non-actions in this finding

This finding does not:
1. Prime [3]
2. Restart any process
3. Rotate credentials
4. Modify on-disk .env
5. Claim API credential freshness/validity on fresh auth
6. Close inet_server_addr vantage reconcile by itself

## 7. Deferred observations (cross-ref only, no action here)

1. episode-api logs show active schema-drift error behavior (Thumbnail.episodeId vs episode_id).
2. episode-api-prod-hotfix logs show repeated 404/ENOENT asset probes, including /assets/.env scan signature.
3. PM2-dump extraction harness (python3 present on box; JSON-parse into in-memory PW, reuse confirmed read -rs / PGPASSWORD single-probe pattern) was confirmed available but deliberately not run. Surface resolved by mtime, so no live auth probe was issued. Recorded here to keep the no-prod-load decision explicit in the paper trail.
