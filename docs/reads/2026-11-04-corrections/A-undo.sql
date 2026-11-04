-- Undo of A (exact before values from E1). Run only on Evoni's request.
\set ON_ERROR_STOP on
BEGIN;
UPDATE season_slots
   SET story_purpose = $o$Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.$o$,
       story_purposes = $j$[{"text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "source": "auto-drafted", "primary": true, "story_thread_id": null}]$j$::jsonb,
       intention_source = 'auto-drafted', updated_at = NOW()
 WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43' AND intention_source = 'edited' AND story_purpose LIKE 'Lala enters Studio by Sable%';
UPDATE episode_briefs
   SET narrative_purpose = $o$Wearable Experiments Studio Session — Step into STUDIO BY SABLE's workspace for an evening dedicated to celebrating independent design innovation. This showcase brings together wearable art—from conceptual sculptural pieces to documentary-driven collections—created by emerging designers working at the intersection of fashion and fine art. Move freely through the studio's gallery-like setting, examine pieces in intimate detail, and speak directly with creators about their inspirations and techniques. Expect a thoughtfully curated evening that honors craft, experimentation, and the stories behind each garment.$o$,
       updated_at = NOW()
 WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND narrative_purpose LIKE 'Lala enters Studio by Sable%';
COMMIT;
\echo 'A UNDONE'
