-- v25 Sec 6 item 8 — follow-up reads, ADDENDUM A, 2026-08-30
--
-- ADDENDUM to the frozen instrument
--   docs/audit/EvidenceNote_Item8_Followup_Reads_Instrument_2026-08-30.sql
--   sha256 dbdadcc5272640f4811da17f4910e7856cd12510b325ae95251f9dbfacb7ec3b
--   170 lines, rev 4, frozen 2026-08-30.
--
-- THE FROZEN BODY IS NOT EDITED. Its hash stands and remains the version whose
-- pre-registered readings govern. This file supersedes only QUERY 0 and adds
-- QUERY 3; QUERY 1 and QUERY 2 are unchanged and were already answered.
--
-- ================= WHY THIS EXISTS =================
-- The 2026-08-30 run failed admissibility. QUERY 0 was written as
--     SELECT ... transaction_read_only ...
-- but transaction_read_only is a GUC, not a column, so the statement errored:
--     ERROR: column "transaction_read_only" does not exist
-- Because identity and posture shared ONE SELECT, that error took
-- current_database() and inet_server_addr() down with it. The gate did not
-- merely fail — IT DESTROYED THE IDENTITY EVIDENCE IT EXISTED TO CAPTURE.
--
-- Two fixes, and the second is the one that matters:
--   (1) current_setting('transaction_read_only'), and identity split into its
--       own statement so no single failure can take the rest with it.
--   (2) QUERY 3 — the contradicting schema read IN THE SAME SESSION as the
--       gate. This is not belt-and-braces. The 2026-08-30 findings for
--       case (d) and case (e1) are CROSS-SOURCE claims: this ledger against
--       the 2026-08-29 capture. If those two reads reached different
--       instances the findings collapse entirely, and an instance NAME is
--       not identity — the register carries the 100.50.2.212 / 10.0.20.224
--       question open for exactly that reason. QUERY 3 removes the
--       cross-source dependency rather than shoring it up.
--
-- ================= PRE-REGISTERED READINGS, ADDENDUM =================
-- Written BEFORE this re-run. The frozen file's readings for QUERY 1 and
-- QUERY 2 are unchanged and are NOT restated here; read them there.
-- Branch/limit ratio is unaffected: QUERY 3 adds no outcome branch to
-- QUERY 1 or QUERY 2. It adds one limit, below.
--
-- QUERY 3 — same-session confirmation of the case (d) / (e1) contradiction.
--   Expected, if this session reaches the same instance the capture did:
--     thumbnails         has episode_id, NOT episodeId
--     processing_queues  ABSENT      processing_queue  PRESENT
--     decision_logs      ABSENT      decision_log      PRESENT
--   Tree side, verified at main 169e4192 and not re-derived here:
--     20240101000003-create-thumbnails.js       createTable('thumbnails')
--                                               episodeId s3Bucket s3Key
--                                               fileSizeBytes mimeType
--     20240101000004-create-processing-queue.js createTable('processing_queues')
--     20260208110001-create-decision-logs-table.js createTable('decision_logs')
--   All three are recorded applied in SequelizeMeta per the 2026-08-30 run.
--
--   (i)  QUERY 3 matches the expectation -> the ledger and the schema
--        disagree WITHIN ONE SESSION. Case (d) and (e1) hold without any
--        cross-source assumption. This is the outcome that makes the finding
--        admissible.
--   (ii) QUERY 3 disagrees with the capture -> the 2026-08-30 ledger read and
--        the 2026-08-29 capture reached DIFFERENT INSTANCES. Case (d) and
--        (e1) are withdrawn, not weakened, and the finding becomes a
--        two-instance finding instead — which is a different and larger
--        question about what "canon" names.
--
--   A LIMIT. QUERY 3 establishes that ONE session saw both the ledger and the
--   schema. It does NOT establish that this session's instance is the same one
--   the 2026-08-29 capture read. Only QUERY 0's identity values, compared
--   against whatever identity the capture session recorded, can do that — and
--   the capture carries no such values, so that comparison may not be
--   available at all. If it is not, the honest statement is that the
--   contradiction is established WITHIN this session and the capture's
--   relationship to it is unestablished.
-- =====================================================================

SET statement_timeout = '30s';

\echo '===== QUERY 0a: IDENTITY — which instance answered ====='
\echo '-- Own statement. If this fails, nothing below is admissible.'
SELECT current_database() AS database,
       inet_server_addr() AS server_addr,
       inet_server_port() AS server_port,
       now()              AS read_at;

\echo ''
\echo '===== QUERY 0b: POSTURE — self-check only, NOT identity ====='
\echo '-- Evidence of neither more nor less than that this session cannot write.'
SELECT current_user                                AS connected_as,
       current_setting('transaction_read_only')    AS transaction_read_only,
       current_setting('default_transaction_read_only') AS default_read_only;

\echo ''
\echo '===== QUERY 3: the contradicting schema, SAME SESSION as the gate ====='
\echo '-- Removes the cross-source dependency in case (d) and case (e1).'
SELECT c.relname AS table_name,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name=c.relname)         AS n_cols,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name=c.relname
           AND column_name='episodeId')                                AS has_episodeId_camel,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name=c.relname
           AND column_name='episode_id')                               AS has_episode_id_snake
FROM (VALUES ('thumbnails'),('processing_queue'),('processing_queues'),
             ('decision_log'),('decision_logs')) AS c(relname)
ORDER BY c.relname;
