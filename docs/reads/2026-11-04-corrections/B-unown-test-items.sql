-- B. Un-own the four test-voided items (Evoni: "YES TO B", 2026-11-04).
-- Final prepared SQL from 2026-11-04-prepared-corrections.md §4.1, with the manual
-- "expect exactly 4 rows" turned into automatic guards (stop if any check fails).
-- Leaves voided ledger rows and deleted-episode links as history; no ledger write.
\set ON_ERROR_STOP on
\pset pager off
BEGIN;
CREATE TEMP TABLE d2_undo ON COMMIT DROP AS
  SELECT id, name, is_owned, updated_at FROM wardrobe
   WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867');
\echo '== undo manifest (copy this)'
SELECT * FROM d2_undo ORDER BY name;
CREATE TEMP TABLE d2_balance ON COMMIT DROP AS
  SELECT COALESCE(SUM(CASE WHEN type IN ('income','reward') THEN amount WHEN type IN ('expense','deduction') THEN -amount ELSE 0 END), 0) AS balance,
         count(*) AS rows_total, max(updated_at) AS last_change
    FROM financial_transactions WHERE show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b';
DO $$
DECLARE refs int; legit int; owned int;
BEGIN
  SELECT count(*) INTO owned FROM d2_undo WHERE is_owned = true;
  IF owned <> 4 THEN RAISE EXCEPTION 'B STOPPED: expected 4 owned items, found %; nothing changed', owned; END IF;
  SELECT count(*) INTO legit FROM financial_transactions ft JOIN d2_undo d ON ft.source_id::text = d.id::text
   WHERE ft.status = 'executed' AND ft.deleted_at IS NULL;
  IF legit <> 0 THEN RAISE EXCEPTION 'B STOPPED: % valid purchase(s) now exist; nothing changed', legit; END IF;
  SELECT (SELECT count(*) FROM episode_wardrobe ew JOIN d2_undo d ON d.id = ew.wardrobe_id)
       + (SELECT count(*) FROM episode_lookbook_images li JOIN d2_undo d ON d.id = li.wardrobe_id)
       + (SELECT count(*) FROM wardrobe_brand_tags bt JOIN d2_undo d ON d.id = bt.wardrobe_item_id)
       + (SELECT count(*) FROM wardrobe_order_lines ol JOIN d2_undo d ON d.id = ol.wardrobe_id)
       + (SELECT count(*) FROM world_events we JOIN d2_undo d ON we.outfit_pieces::text LIKE '%' || d.id::text || '%')
       + (SELECT count(*) FROM pulse_poll_options po JOIN d2_undo d ON po.wardrobe_ids::text LIKE '%' || d.id::text || '%')
       + (SELECT count(*) FROM pulse_reveals pr JOIN d2_undo d ON pr.item_id = d.id::text)
       + (SELECT count(*) FROM financial_transactions ft JOIN d2_undo d ON ft.source_id::text = d.id::text)
    INTO refs;
  IF refs <> 8 THEN RAISE EXCEPTION 'B STOPPED: expected the 8 reviewed references (4 test-episode links + 4 voided rows), found %; nothing changed', refs; END IF;
END $$;
UPDATE wardrobe w SET is_owned = false, updated_at = NOW()
 WHERE w.id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867')
   AND w.is_owned = true AND w.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM financial_transactions ft
                    WHERE ft.source_id::text = w.id::text AND ft.status = 'executed' AND ft.deleted_at IS NULL);
DO $$
DECLARE changed int; b_now numeric; n_now int;
BEGIN
  SELECT count(*) INTO changed FROM wardrobe w JOIN d2_undo d ON d.id = w.id WHERE w.is_owned = false;
  IF changed <> 4 THEN RAISE EXCEPTION 'B STOPPED: expected exactly 4 ownership changes, got %; rolled back', changed; END IF;
  SELECT COALESCE(SUM(CASE WHEN type IN ('income','reward') THEN amount WHEN type IN ('expense','deduction') THEN -amount ELSE 0 END), 0), count(*)
    INTO b_now, n_now FROM financial_transactions WHERE show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b';
  IF b_now <> (SELECT balance FROM d2_balance) OR n_now <> (SELECT rows_total FROM d2_balance) THEN
    RAISE EXCEPTION 'B STOPPED: Prime Bank ledger changed during B; rolled back';
  END IF;
END $$;
COMMIT;
\echo 'B COMMITTED'
