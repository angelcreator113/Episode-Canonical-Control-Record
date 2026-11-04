-- A verification (read only).
\pset pager off
SET default_transaction_read_only = on;
SELECT 'slot' AS record, intention_source, story_purposes->0->>'source' AS purposes_source, left(story_purpose, 60) AS purpose_start, updated_at
  FROM season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43';
SELECT 'brief' AS record, status, left(narrative_purpose, 60) AS purpose_start,
       (narrative_purpose LIKE '%Core dilemma: How much should Lala invest%') AS has_dilemma,
       (narrative_purpose LIKE '%Creator lesson: Looking successful%') AS has_lesson, updated_at
  FROM episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da';
SELECT 'frozen snapshot' AS record, season_context->>'snapshotted_at' AS snapshotted_at, left(season_context->>'story_purpose', 60) AS purpose_start,
       (season_context ? 'corrections') AS has_corrections
  FROM episodes WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55';
