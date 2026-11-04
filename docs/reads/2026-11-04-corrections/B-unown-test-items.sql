-- B v2. Un-own the four test-voided items (Evoni: YES TO B, 2026-11-04).
-- Safeguards: (1) exact guards; (2) SERIALIZABLE + the same show lock purchases take
-- (shows FOR NO KEY UPDATE, as coinLedgerSync.lockedLedgerBalance) + FOR UPDATE on the four
-- wardrobe rows, so no purchase, ownership edit or FK-linked reference can interleave;
-- (3) durable undo records in data_correction_log (unique per item, so B cannot run twice).
-- Voided ledger rows and the deleted test episode's links are left as history.
\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog, pg_temp;  -- built-ins only: nothing planted in public or a look-alike schema can resolve; tables are named public.x
SELECT 1 FROM public.shows WHERE id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b' FOR NO KEY UPDATE;
SELECT 1 FROM public.wardrobe WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') FOR UPDATE;
DO $g$
DECLARE owned int; legit int; refs int; voided int;
BEGIN
  IF to_regclass('public.data_correction_log') IS NULL THEN
    RAISE EXCEPTION 'B STOPPED: data_correction_log does not exist (its migration has not run); nothing changed';
  END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.data_correction_log'::regclass) <> session_user THEN
    RAISE EXCEPTION 'B STOPPED: run with the migration credential (~/.episode-migrate.env), the owner of data_correction_log; nothing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c, aclexplode(c.relacl) a WHERE c.oid = 'public.data_correction_log'::regclass
       AND a.grantee <> c.relowner AND a.grantee IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname = 'prime_readonly')) THEN
    RAISE EXCEPTION 'B STOPPED: a role other than the owner and prime_readonly holds a privilege on data_correction_log; nothing changed';
  END IF;
  SELECT count(*) INTO owned FROM public.wardrobe WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') AND is_owned = true AND deleted_at IS NULL AND show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b';
  IF owned <> 4 THEN RAISE EXCEPTION 'B STOPPED: expected 4 owned items, found %; nothing changed', owned; END IF;
  SELECT count(*) INTO legit FROM public.financial_transactions WHERE source_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') AND status = 'executed' AND deleted_at IS NULL;
  IF legit <> 0 THEN RAISE EXCEPTION 'B STOPPED: % valid purchase(s) now exist; nothing changed', legit; END IF;
  SELECT count(*) INTO voided FROM public.financial_transactions WHERE source_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') AND status = 'voided'
     AND id IN ('1e9da9a3-e7fc-48a7-850e-295c1ae7945d','d7b34f33-b51d-4d3f-8659-3f2dd2516575','b008d849-f3f1-4306-a32f-31ae18d844ac','3408a459-f230-48e5-8c80-11fd1c173588');
  IF voided <> 4 THEN RAISE EXCEPTION 'B STOPPED: the 4 reviewed voided rows are not exactly as reviewed (found %); nothing changed', voided; END IF;
  SELECT (SELECT count(*) FROM public.episode_wardrobe WHERE wardrobe_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867'))
       + (SELECT count(*) FROM public.episode_lookbook_images WHERE wardrobe_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867'))
       + (SELECT count(*) FROM public.wardrobe_brand_tags WHERE wardrobe_item_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867'))
       + (SELECT count(*) FROM public.wardrobe_order_lines WHERE wardrobe_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867'))
       + (SELECT count(*) FROM public.world_events we WHERE EXISTS (SELECT 1 FROM unnest(ARRAY['051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867']) i WHERE we.outfit_pieces::text LIKE '%' || i || '%'))
       + (SELECT count(*) FROM public.pulse_poll_options po WHERE EXISTS (SELECT 1 FROM unnest(ARRAY['051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867']) i WHERE po.wardrobe_ids::text LIKE '%' || i || '%'))
       + (SELECT count(*) FROM public.pulse_reveals WHERE item_id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867'))
       + (SELECT count(*) FROM public.financial_transactions WHERE source_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867'))
    INTO refs;
  IF refs <> 8 THEN RAISE EXCEPTION 'B STOPPED: expected the 8 reviewed references (4 test-episode links + 4 voided rows), found %; nothing changed', refs; END IF;
  IF (SELECT count(*) FROM public.episode_wardrobe ew JOIN public.episodes e ON e.id = ew.episode_id
       WHERE ew.wardrobe_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') AND e.id = 'be95953c-8965-4953-b20b-951ee12ea807' AND e.deleted_at IS NOT NULL) <> 4 THEN
    RAISE EXCEPTION 'B STOPPED: the 4 links are not all to the deleted test episode; nothing changed';
  END IF;
END $g$;
CREATE TEMP TABLE b_ledger ON COMMIT DROP AS
  SELECT count(*) AS n, COALESCE(SUM(amount), 0) AS total, md5(string_agg(id::text || status || amount::text, ',' ORDER BY id)) AS h
    FROM public.financial_transactions WHERE show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b';
INSERT INTO public.data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref)
SELECT 'B-2026-11-04', show_id, 'wardrobe', id::text, 'is_owned', to_jsonb(is_owned), to_jsonb(false), 'Evoni', $r$Evoni, 2026-11-04: YES TO A / YES TO B (docs/reads/2026-11-04-prepared-corrections.md)$r$
  FROM public.wardrobe WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867');
UPDATE public.wardrobe SET is_owned = false, updated_at = NOW() WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') AND is_owned = true;
DO $g$
DECLARE changed int;
BEGIN
  SELECT count(*) INTO changed FROM public.wardrobe WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') AND is_owned = false;
  IF changed <> 4 THEN RAISE EXCEPTION 'B STOPPED: expected exactly 4 ownership changes, got %; rolled back', changed; END IF;
  IF (SELECT count(*) FROM public.data_correction_log WHERE correction_key = 'B-2026-11-04' AND undone_at IS NULL) <> 4 THEN
    RAISE EXCEPTION 'B STOPPED: undo records incomplete; rolled back';
  END IF;
  IF (SELECT ROW(count(*), COALESCE(SUM(amount), 0), md5(string_agg(id::text || status || amount::text, ',' ORDER BY id)))
        FROM public.financial_transactions WHERE show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b') IS DISTINCT FROM (SELECT ROW(n, total, h) FROM b_ledger) THEN
    RAISE EXCEPTION 'B STOPPED: Prime Bank ledger changed; rolled back';
  END IF;
END $g$;
COMMIT;
\echo 'B COMMITTED'
