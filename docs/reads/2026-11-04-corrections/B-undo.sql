-- Undo of B v2: per item, restores the logged before-value only while the item still holds
-- the logged after-value and has gained no purchase; marks log rows undone (a second undo stops).
\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog, pg_temp;  -- built-ins only: nothing planted in public or a look-alike schema can resolve; tables are named public.x
SELECT 1 FROM public.shows WHERE id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b' FOR NO KEY UPDATE;
SELECT 1 FROM public.wardrobe WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') FOR UPDATE;
SELECT 1 FROM public.data_correction_log WHERE correction_key = 'B-2026-11-04' FOR UPDATE;
DO $g$
BEGIN
  IF (SELECT count(*) FROM public.data_correction_log WHERE correction_key = 'B-2026-11-04' AND undone_at IS NULL) <> 4 THEN
    RAISE EXCEPTION 'B UNDO STOPPED: no complete, not-yet-undone B record; nothing changed';
  END IF;
  IF (SELECT count(*) FROM public.wardrobe w JOIN public.data_correction_log l ON l.record_id = w.id::text AND l.correction_key = 'B-2026-11-04'
       WHERE to_jsonb(w.is_owned) = l.after_value) <> 4 THEN
    RAISE EXCEPTION 'B UNDO STOPPED: an item changed after B; nothing restored';
  END IF;
END $g$;
UPDATE public.wardrobe w SET is_owned = (l.before_value #>> '{}')::boolean, updated_at = NOW()
  FROM public.data_correction_log l WHERE l.correction_key = 'B-2026-11-04' AND l.record_id = w.id::text AND l.undone_at IS NULL;
UPDATE public.data_correction_log SET undone_at = NOW(), undone_by = session_user, updated_at = NOW()
 WHERE correction_key = 'B-2026-11-04' AND undone_at IS NULL;
COMMIT;
\echo 'B UNDONE'
