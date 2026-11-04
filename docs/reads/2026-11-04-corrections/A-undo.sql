-- Undo of A v2: restores the exact logged before-values, only while every field still holds
-- the exact logged after-value; marks the log rows undone (a second undo stops).
\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout = '10s';
SELECT 1 FROM season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43' FOR UPDATE;
SELECT 1 FROM episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' FOR UPDATE;
SELECT 1 FROM data_correction_log WHERE correction_key = 'A-2026-11-04' FOR UPDATE;
DO $g$
BEGIN
  IF (SELECT count(*) FROM data_correction_log WHERE correction_key = 'A-2026-11-04' AND undone_at IS NULL) <> 4 THEN
    RAISE EXCEPTION 'A UNDO STOPPED: no complete, not-yet-undone A record; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.id = '3e9a5200-161e-4369-b596-a915a268cd43'
        AND to_jsonb(s.story_purpose) = (SELECT after_value FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='story_purpose')
        AND s.story_purposes = (SELECT after_value FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='story_purposes')
        AND to_jsonb(s.intention_source) = (SELECT after_value FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='intention_source'))
  OR NOT EXISTS (SELECT 1 FROM episode_briefs b WHERE b.id = '661234d3-bf88-4c8f-b253-8352261185da'
        AND to_jsonb(b.narrative_purpose) = (SELECT after_value FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='narrative_purpose')) THEN
    RAISE EXCEPTION 'A UNDO STOPPED: the records changed after A; nothing restored';
  END IF;
END $g$;
UPDATE season_slots s SET
   story_purpose    = (SELECT before_value #>> '{}' FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='story_purpose'),
   story_purposes   = (SELECT before_value       FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='story_purposes'),
   intention_source = (SELECT before_value #>> '{}' FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='intention_source'),
   updated_at = NOW()
 WHERE s.id = '3e9a5200-161e-4369-b596-a915a268cd43';
UPDATE episode_briefs b SET
   narrative_purpose = (SELECT before_value #>> '{}' FROM data_correction_log WHERE correction_key='A-2026-11-04' AND field='narrative_purpose'),
   updated_at = NOW()
 WHERE b.id = '661234d3-bf88-4c8f-b253-8352261185da';
UPDATE data_correction_log SET undone_at = NOW(), undone_by = current_user, updated_at = NOW()
 WHERE correction_key = 'A-2026-11-04' AND undone_at IS NULL;
COMMIT;
\echo 'A UNDONE'
