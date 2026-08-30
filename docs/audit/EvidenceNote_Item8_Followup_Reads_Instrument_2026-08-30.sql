-- v25 Sec 6 item 8 — follow-up reads, 2026-08-30  (rev 4)
--
-- READ-ONLY. No writes, no DDL. Same operator-workstation route as the
-- 2026-08-29 capture; no new authorization class. Prod FROZEN.
--
--     psql "<canon conn>" -f item8_followup_reads_2026-08-30.sql > out.txt 2>&1
-- Default psql aligned output already matches the existing EvidenceNote files.
--
-- rev 4 — NO DATA HAS BEEN SEEN BY EITHER READER. Everything below is still
-- pre-registration, not post-hoc fitting.
--   rev 3 added: the QUERY 0 gate, the CREATE-migration first cut, the
--     rollback limit, the second witness, F-App-1's removal dated.
--   rev 4 adds: the witness measured at six columns across three tables, not
--     two; case (e) SPLIT, because the two entries' down() differ and so do
--     their implications; and QUERY 0 separated into identity vs posture.
--
-- ================= PRE-REGISTERED READINGS =================
-- §H4 is closed and cannot be reopened, so this is the only independent check
-- still available, and it works only if fixed in advance.
-- DO NOT REVISE BELOW THIS LINE AFTER SEEING OUTPUT.
--
-- QUERY 0 — ADMISSIBILITY, not a finding. TWO DIFFERENT THINGS, kept apart.
--
--   IDENTITY — which instance was read:
--     current_database(), inet_server_addr(), inet_server_port()
--   POSTURE — what the session could have done, a SELF-CHECK only:
--     transaction_read_only, current_user
--
--   THESE ARE NOT INTERCHANGEABLE. transaction_read_only is evidence of
--   neither more nor less than that the session could not write. It is NOT
--   evidence of which instance was read. An Amd21 listing all of QUERY 0
--   under one heading would invite a successor to read a read-only session
--   as identity evidence; Amd18 §T1's gate carried the distinction and any
--   filing of these results must carry it too.
--
--   Amd18 §T1 rests on identity. An Amd21 filing these results without the
--   gate would assert a boundary from one side, which Amd20 §V2 exists to
--   prevent. If QUERY 0 is missing from the output, THE RUN IS NOT ADMISSIBLE
--   AS A READ OF CANON and must be re-run, whatever QUERY 1 and 2 returned.
--
-- QUERY 1 — discriminators are named migrations, not an approximate date.
--   Tree holds 211 sequelize migrations; 193 postdate the pgmigrations
--   ceiling of 2026-01-22.
--
--   FIRST CUT — the CREATE, not the column-adds:
--     20260721000000-create-ui-overlay-types
--   Canon carries ui_overlay_types at all, so either this ran or something
--   else built the table. That is a cleaner first question than how far past
--   July the ledger reaches.
--
--   THEN the three column-adds, which measure reach:
--     lifecycle     20260723000002-overlay-lifecycle
--     opens_screen  20260725000000-add-opens-screen-and-backfill
--     is_home       20260726000000-add-is-home-and-style-prefix
--
--   (a) CREATE present (with or without the three) -> sequelize migrations
--       ran on canon after January. §T2.2's mechanism identified. The three
--       column-adds then say how far the ledger reaches past July.
--   (b) Rows present, none after 2026-01-22 -> a third path built the July
--       schema. Sync leads; §T2.2 narrows but stays open.
--   (c) Empty -> no sequelize migration ever recorded applied on canon. The
--       whole post-pgmigrations schema came from another path.
--   (d) ~211, tree-complete -> A CONTRADICTION, NOT A CONFIRMATION. Canon's
--       thumbnails is snake_case and processing_queues is absent; a
--       tree-complete run produces neither. Sharpens §T2 rather than closing
--       it, and means migrations were edited after application or applied
--       against pre-existing tables and skipped. NAMED IN ADVANCE because it
--       is the outcome most likely to be waved through as agreement.
--   (e) DECISIVE — but the two entries are NOT EQUIVALENT and must be read
--       as SEPARATE RESULTS, because their down() differ. Verified in tree:
--         20260208110001 down = dropTable('decision_logs')
--         20260818000000 down = removeColumn('decision_logs','deleted_at')
--
--       (e1) 20260208110001 present, decision_logs ABSENT.
--            Its own down() drops the table AND removes its ledger row, so
--            this pairing CANNOT be produced by a clean rollback of itself.
--            Either the table was dropped outside the migration system, or
--            the ledger row was written without the effect landing.
--
--       (e2) 20260818000000 present, decision_logs ABSENT.
--            Its down() removes only a column; rolling it back LEAVES THE
--            TABLE STANDING. So the table existed, took the column, and later
--            vanished by some other means — and the ledger still carries a row
--            for a migration whose target is gone.
--
--       (e0) THE EXPLICABLE CASE, named so it is not mistaken for (e1)/(e2):
--            a clean, ordered rollback of BOTH removes both rows and the
--            table, leaving NEITHER entry and NO table — indistinguishable
--            from never-applied. So ANY surviving entry beside an absent
--            table means the rollback was not clean and ordered, or the drop
--            happened outside migrations.
--
--       In (e1) and (e2) alike the ledger records an application whose effect
--       is gone. That is stronger than identifying a provisioning path: it
--       breaks the assumption FD-66 §7.1 steps 2-3 rest on in calling for a
--       baseline. You cannot baseline against a ledger that does not record
--       what is there.
--
--   A LIMIT ON WHAT QUERY 1 CAN SETTLE. 20260208110001's own down() drops
--   decision_logs, and a rollback removes its SequelizeMeta row too. So
--   "never applied" and "applied then rolled back" leave an IDENTICAL trace.
--   Query 1 cannot separate them. Only branch (e) escapes this, because no
--   rollback explains a present entry with an absent table.
--
--   A SECOND, INDEPENDENT WITNESS — SIX COLUMNS, THREE TABLES, NOT TWO.
--   20260719000000-career-pipeline-links adds six columns. Every one is
--   PRESENT on canon, verified against the 2026-08-29 capture:
--     career_goals.deleted_at          world_events.opportunity_id
--     opportunities.career_goal_id     opportunities.career_tier
--     opportunities.fail_consequence   opportunities.success_unlock
--   SIX-FOR-SIX ACROSS THREE TABLES IS NOT WHAT A PARTIAL OR HAND-APPLIED
--   CHANGE PRODUCES. That July migration ran on canon by effect, beyond
--   reasonable doubt. If its entry is missing from the ledger, THE LEDGER IS
--   INCOMPLETE — independently of anything decision_logs shows, and on
--   stronger evidence than a two-table witness would give.
--
-- QUERY 2 — count answers "is it populated"; max(created_at) answers "is it
--   still being written", which is a different and larger finding.
--
--   F-App-1's auto-repair removal is commit 6bfd99e2, dated 2026-05-14.
--   That date is the predates/postdates boundary below.
--
--   decision_log = 0                    -> tidy-up. §7.1.1's pilot becomes a
--                                          low-stakes create-or-rename call.
--   > 0, newest BEFORE 2026-05-14       -> orphaned legacy data. Real,
--                                          bounded, not urgent.
--   > 0, newest AFTER 2026-05-14        -> A LIVE WRITE PATH to a table no
--                                          model targets. Bigger than the gap
--                                          it was meant to size.
--   character_state_history > 0         -> same shape; read TOGETHER with
--                                          character_state, which the
--                                          character_key drift finding writes.
-- ===========================================================

SET statement_timeout = '30s';

\echo '===== QUERY 0: identity gate — admissibility, not a finding ====='
SELECT current_database()      AS database,
       inet_server_addr()      AS server_addr,
       inet_server_port()      AS server_port,
       current_user            AS connected_as,
       transaction_read_only   AS read_only,
       now()                   AS read_at;

\echo ''
\echo '===== QUERY 1: SequelizeMeta rows ====='
SELECT name FROM "SequelizeMeta" ORDER BY name;
SELECT count(*) AS sequelizemeta_row_count FROM "SequelizeMeta";

\echo ''
\echo '===== QUERY 2a: size estimate first (free, no scan) ====='
SELECT relname AS table_name, reltuples::bigint AS est_rows
FROM pg_class
WHERE relname IN ('decision_log','character_state_history','world_events',
                  'character_state','career_goals')
ORDER BY relname;

\echo ''
\echo '===== QUERY 2b: exact counts + newest row ====='
\echo '-- If 2a shows anything in the millions, stop and report 2a instead.'
SELECT 'decision_log'            AS table_name, count(*) AS n, max(created_at) AS newest FROM decision_log
UNION ALL
SELECT 'character_state_history', count(*), max(created_at) FROM character_state_history
UNION ALL
SELECT 'world_events',            count(*), max(created_at) FROM world_events
UNION ALL
SELECT 'character_state',         count(*), max(created_at) FROM character_state
UNION ALL
SELECT 'career_goals',            count(*), max(created_at) FROM career_goals
ORDER BY table_name;
