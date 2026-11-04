-- Read-only pre-flight: exact-value fingerprints of everything A and B guard on.
\pset pager off
SET default_transaction_read_only = on;
SELECT md5(story_purpose) AS slot_purpose_md5, md5(story_purposes::text) AS slot_purposes_md5, intention_source FROM season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43';
SELECT md5(narrative_purpose) AS brief_md5, length(narrative_purpose) AS brief_len, status FROM episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da';
SELECT md5(season_context::text) AS snapshot_md5 FROM episodes WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55';
SELECT to_regclass('public.data_correction_log') AS correction_log_table;
