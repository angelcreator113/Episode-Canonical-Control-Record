-- B verification (read only).
\pset pager off
SET default_transaction_read_only = on;
SELECT id, name, is_owned FROM wardrobe WHERE id IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') ORDER BY name;
SELECT status, count(*) AS rows FROM financial_transactions WHERE source_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867') GROUP BY status;
SELECT count(*) AS test_episode_links_kept FROM episode_wardrobe WHERE wardrobe_id::text IN ('051d2cac-3723-404b-b481-5274dcb88957','ee7a7e6b-6583-4f2f-8c73-a44785a77c34','46967b7a-6a9a-4453-b75a-aa5eb7806031','a173120e-2618-4da2-bed1-e6ace3a4d867');
SELECT coins AS lala_coins FROM character_state WHERE show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b' AND character_key = 'lala';
SELECT count(*) AS owned_items FROM wardrobe WHERE show_id = '9bd0655f-0426-4da4-95b8-44cdfd608b2b' AND deleted_at IS NULL AND is_owned;
SELECT record_id, before_value, after_value, applied_at, applied_by, undone_at FROM data_correction_log WHERE correction_key = 'B-2026-11-04' ORDER BY record_id;
