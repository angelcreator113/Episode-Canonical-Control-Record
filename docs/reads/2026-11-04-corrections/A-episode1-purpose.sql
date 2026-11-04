-- A v2. Episode 1 narrative purpose (Evoni: YES TO A, 2026-11-04).
-- Safeguards: (1) exact full-value guards and post-checks; (2) SERIALIZABLE + row locks on
-- the slot, brief and episode; (3) durable undo records in data_correction_log (one row per
-- field, unique per correction key, so A cannot be applied twice). Requires the
-- data_correction_log migration to have run (separate approval).
\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog, pg_temp;  -- built-ins only: nothing planted in public or a look-alike schema can resolve; tables are named public.x
SELECT 1 FROM public.season_slots   WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43'  FOR UPDATE;
SELECT 1 FROM public.episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' FOR UPDATE;
SELECT 1 FROM public.episodes       WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55'    FOR UPDATE;
DO $g$
BEGIN
  IF to_regclass('public.data_correction_log') IS NULL THEN
    RAISE EXCEPTION 'A STOPPED: data_correction_log does not exist (its migration has not run); nothing changed';
  END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.data_correction_log'::regclass) <> session_user THEN
    RAISE EXCEPTION 'A STOPPED: run with the migration credential (~/.episode-migrate.env), the owner of data_correction_log; nothing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c, aclexplode(c.relacl) a WHERE c.oid = 'public.data_correction_log'::regclass
       AND a.grantee <> c.relowner AND a.grantee IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname = 'prime_readonly')) THEN
    RAISE EXCEPTION 'A STOPPED: a role other than the owner and prime_readonly holds a privilege on data_correction_log; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43'
       AND story_purpose = $t$Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.$t$
       AND story_purposes = $j$[{"text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "source": "auto-drafted", "primary": true, "story_thread_id": null}]$j$::jsonb
       AND intention_source = 'auto-drafted' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'A STOPPED: slot 1 does not hold the exact reviewed values; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND episode_id = '8b9301a6-2d99-45a7-8488-4fe40504dd55'
       AND deleted_at IS NULL AND status = 'draft'
       AND narrative_purpose = $t$Wearable Experiments Studio Session — Step into STUDIO BY SABLE's workspace for an evening dedicated to celebrating independent design innovation. This showcase brings together wearable art—from conceptual sculptural pieces to documentary-driven collections—created by emerging designers working at the intersection of fashion and fine art. Move freely through the studio's gallery-like setting, examine pieces in intimate detail, and speak directly with creators about their inspirations and techniques. Expect a thoughtfully curated evening that honors craft, experimentation, and the stories behind each garment.$t$) THEN
    RAISE EXCEPTION 'A STOPPED: the Episode 1 brief Intent is not the exact reviewed value; nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.episodes WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55' AND season_context = $j${"label": "S1 · E1", "phase": {"title": "Foundation", "number": 1, "tagline": "Prove you belong", "emotional_arc": "curiosity → first stumble → finding her footing"}, "arc_id": "f5607805-cba1-45a8-85d5-9560eafc58c9", "arc_title": "Soft Luxury Ascension", "slot_number": 1, "career_focus": "Build the Portfolio, First Impressions", "story_thread": null, "outcome_range": {"max": "pass", "min": "safe"}, "season_number": 1, "story_purpose": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "snapshotted_at": "2026-10-02T06:23:32.276Z", "story_purposes": [{"text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "primary": true, "story_thread": null}], "desired_pressure": "Low", "position_in_phase": 1}$j$::jsonb) THEN
    RAISE EXCEPTION 'A STOPPED: the frozen Start snapshot is not the exact reviewed value; nothing changed';
  END IF;
END $g$;
INSERT INTO public.data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref) VALUES
 ('A-2026-11-04', '9bd0655f-0426-4da4-95b8-44cdfd608b2b', 'season_slots',   '3e9a5200-161e-4369-b596-a915a268cd43',  'story_purpose',    to_jsonb($t$Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.$t$::text), to_jsonb($p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$::text), 'Evoni', $r$Evoni, 2026-11-04: YES TO A / YES TO B (docs/reads/2026-11-04-prepared-corrections.md)$r$),
 ('A-2026-11-04', '9bd0655f-0426-4da4-95b8-44cdfd608b2b', 'season_slots',   '3e9a5200-161e-4369-b596-a915a268cd43',  'story_purposes',   $j$[{"text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "source": "auto-drafted", "primary": true, "story_thread_id": null}]$j$::jsonb, $j$[{"text": "Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.", "source": "edited", "primary": true, "story_thread_id": null}]$j$::jsonb, 'Evoni', $r$Evoni, 2026-11-04: YES TO A / YES TO B (docs/reads/2026-11-04-prepared-corrections.md)$r$),
 ('A-2026-11-04', '9bd0655f-0426-4da4-95b8-44cdfd608b2b', 'season_slots',   '3e9a5200-161e-4369-b596-a915a268cd43',  'intention_source', to_jsonb('auto-drafted'::text), to_jsonb('edited'::text), 'Evoni', $r$Evoni, 2026-11-04: YES TO A / YES TO B (docs/reads/2026-11-04-prepared-corrections.md)$r$),
 ('A-2026-11-04', '9bd0655f-0426-4da4-95b8-44cdfd608b2b', 'episode_briefs', '661234d3-bf88-4c8f-b253-8352261185da', 'narrative_purpose', to_jsonb($t$Wearable Experiments Studio Session — Step into STUDIO BY SABLE's workspace for an evening dedicated to celebrating independent design innovation. This showcase brings together wearable art—from conceptual sculptural pieces to documentary-driven collections—created by emerging designers working at the intersection of fashion and fine art. Move freely through the studio's gallery-like setting, examine pieces in intimate detail, and speak directly with creators about their inspirations and techniques. Expect a thoughtfully curated evening that honors craft, experimentation, and the stories behind each garment.$t$::text), to_jsonb($p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.

Core dilemma: How much should Lala invest in being seen before she knows whether the opportunity will pay off?

Creator lesson: Looking successful and building a sustainable creator career aren't always the same thing.$p$::text), 'Evoni', $r$Evoni, 2026-11-04: YES TO A / YES TO B (docs/reads/2026-11-04-prepared-corrections.md)$r$);
UPDATE public.season_slots
   SET story_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$, story_purposes = $j$[{"text": "Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.", "source": "edited", "primary": true, "story_thread_id": null}]$j$::jsonb, intention_source = 'edited', updated_at = NOW()
 WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43';
UPDATE public.episode_briefs SET narrative_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.

Core dilemma: How much should Lala invest in being seen before she knows whether the opportunity will pay off?

Creator lesson: Looking successful and building a sustainable creator career aren't always the same thing.$p$, updated_at = NOW()
 WHERE id = '661234d3-bf88-4c8f-b253-8352261185da';
DO $g$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43' AND story_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.$p$
        AND story_purposes = $j$[{"text": "Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.", "source": "edited", "primary": true, "story_thread_id": null}]$j$::jsonb AND intention_source = 'edited')
  OR NOT EXISTS (SELECT 1 FROM public.episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da' AND narrative_purpose = $p$Lala enters Studio by Sable's experimental fashion event, hoping to make connections, create compelling content and establish herself in Dream Cities' competitive creator scene. She must balance the cost of showing up with the opportunity to gain attention, strengthen relationships and secure future opportunities.

Core dilemma: How much should Lala invest in being seen before she knows whether the opportunity will pay off?

Creator lesson: Looking successful and building a sustainable creator career aren't always the same thing.$p$)
  OR NOT EXISTS (SELECT 1 FROM public.episodes WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55' AND season_context = $j${"label": "S1 · E1", "phase": {"title": "Foundation", "number": 1, "tagline": "Prove you belong", "emotional_arc": "curiosity → first stumble → finding her footing"}, "arc_id": "f5607805-cba1-45a8-85d5-9560eafc58c9", "arc_title": "Soft Luxury Ascension", "slot_number": 1, "career_focus": "Build the Portfolio, First Impressions", "story_thread": null, "outcome_range": {"max": "pass", "min": "safe"}, "season_number": 1, "story_purpose": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "snapshotted_at": "2026-10-02T06:23:32.276Z", "story_purposes": [{"text": "Lala discovers her authentic design voice by immersing herself in experimental fashion, setting the tone for her luxury career journey.", "primary": true, "story_thread": null}], "desired_pressure": "Low", "position_in_phase": 1}$j$::jsonb)
  OR (SELECT count(*) FROM public.data_correction_log WHERE correction_key = 'A-2026-11-04' AND undone_at IS NULL) <> 4 THEN
    RAISE EXCEPTION 'A STOPPED: post-update exact check failed; rolled back';
  END IF;
END $g$;
COMMIT;
\echo 'A COMMITTED'
