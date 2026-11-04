-- A. Episode 1 narrative purpose (Evoni: "YES TO A", 2026-11-04).
-- Final prepared SQL from 2026-11-04-prepared-corrections.md §2.4, run with ON_ERROR_STOP.
-- Changes ONLY season_slots 3e9a5200… (story_purpose, story_purposes, intention_source) and
-- episode_briefs 661234d3… (narrative_purpose). episodes.season_context (frozen snapshot) is not touched.
\set ON_ERROR_STOP on
\pset pager off
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43'
       AND story_purpose = $t$Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.$t$
       AND intention_source = 'auto-drafted') THEN
    RAISE EXCEPTION 'A STOPPED: slot 1 is not the reviewed value; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da'
       AND episode_id = '8b9301a6-2d99-45a7-8488-4fe40504dd55' AND deleted_at IS NULL
       AND status = 'draft' AND narrative_purpose LIKE 'Wearable Experiments Studio Session%') THEN
    RAISE EXCEPTION 'A STOPPED: Episode 1 brief is not the reviewed draft value; nothing changed';
  END IF;
END $$;
UPDATE season_slots
   SET story_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$,
       story_purposes = jsonb_build_array(jsonb_build_object(
         'text', $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$,
         'source', 'edited', 'primary', true, 'story_thread_id', NULL)),
       intention_source = 'edited',
       updated_at = NOW()
 WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43';
UPDATE episode_briefs
   SET narrative_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.

Core dilemma: How much should Lala invest in being seen before she knows whether the opportunity will pay off?

Creator lesson: Looking successful and building a sustainable creator career aren't always the same thing.$p$,
       updated_at = NOW()
 WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND episode_id = '8b9301a6-2d99-45a7-8488-4fe40504dd55' AND deleted_at IS NULL AND status = 'draft';
DO $$
BEGIN
  IF (SELECT count(*) FROM season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43' AND intention_source = 'edited' AND story_purpose LIKE 'Lala enters Studio by Sable%') <> 1
  OR (SELECT count(*) FROM episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND narrative_purpose LIKE 'Lala enters Studio by Sable%Creator lesson:%') <> 1
  OR (SELECT count(*) FROM episodes WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55'
        AND season_context->>'snapshotted_at' = '2026-10-02T06:23:32.276Z'
        AND season_context->>'story_purpose' LIKE 'Lala discovers her authentic design voice%') <> 1 THEN
    RAISE EXCEPTION 'A STOPPED: post-update check failed; rolled back';
  END IF;
END $$;
COMMIT;
\echo 'A COMMITTED'
