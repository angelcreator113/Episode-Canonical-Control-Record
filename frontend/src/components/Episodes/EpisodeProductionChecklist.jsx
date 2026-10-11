import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { nextStep } from '../../utils/sceneSteps';
import { sceneSetsPath } from '../../utils/sceneSets';
import { ProductionSummary, EpisodeTimeline, SectionCard, CheckBox } from './ChecklistHub';
import { SECTION_GUIDE, sectionCount, sectionGuideText } from '../../lib/checklistHub';
import { closetBeat } from '../../lib/scriptMoments';
import { styleReadiness } from '../../lib/styleReadiness';

/**
 * EpisodeProductionChecklist
 *
 * Replaces the generic progress bar in EpisodeOverviewTab.
 * Checks real production gates and shows exactly what's missing
 * before the Generate Script button unlocks.
 */

export const CHECKLIST_SECTIONS = [
  {
    id: 'brief',
    icon: '📋',
    label: 'Episode Brief',
    items: [
      { id: 'arc_position',      label: 'Arc position set',           required: true  },
      { id: 'archetype',         label: 'Episode archetype chosen',   required: true  },
      { id: 'designed_intent',   label: 'Designed intent set',        required: true  },
      { id: 'narrative_purpose', label: 'Narrative purpose written',  required: false },
      { id: 'forward_hook',      label: 'Forward hook written',       required: false },
    ],
  },
  {
    id: 'world',
    icon: '🌍',
    label: 'Event & Venue',
    items: [
      { id: 'event_linked',      label: 'Event linked to episode',    required: true  },
      { id: 'venue_set',         label: 'Venue assigned',             required: false },
      { id: 'venue_image',       label: 'Venue image generated',      required: false },
      { id: 'invitation_exists', label: 'Invitation generated',       required: false },
    ],
  },
  {
    id: 'scene',
    icon: '🎬',
    label: 'Scene Plan',
    items: [
      { id: 'scene_sets',        label: 'Scene sets assigned',        required: true  },
      // Evoni, 2026-10-09: "scenes should not have beats attached makes
      // things too complicated": the checklist no longer asks for beat
      // locks or per-beat clips (the Scenes tab keeps them).
      { id: 'scene_plan',        label: 'Scene plan generated',       required: true  },
      // L5, Q21 (Evoni, 2026-10-02, §8(hh)): flagged, never blocking.
      { id: 'scene_images',      label: 'Scene images for every beat', required: false },
    ],
  },
  {
    id: 'wardrobe',
    icon: '👗',
    label: 'Wardrobe & Outfit',
    items: [
      // Audit GATE-02 (2026-10-03): inventory and required-slot coverage are
      // separate facts; one shoe no longer satisfies the wardrobe gate.
      { id: 'wardrobe_inventory', label: 'Wardrobe pieces uploaded',  required: false },
      { id: 'wardrobe_ready',    label: 'Required wardrobe slots covered', required: true },
      { id: 'outfit_picked',     label: 'Outfit picked for event',    required: false },
    ],
  },
  // The episode's Style Page (was Lookbook; Tasks #2815, #2876): counted in
  // the checklist's total, never blocking the script. Readiness is the Style
  // Page's own rule (lib/styleReadiness, 12 chips).
  {
    id: 'lookbook',
    icon: '📸',
    label: 'Style Page',
    items: [
      { id: 'lookbook_ready',       label: 'Style sheet ready (12 of 12)', required: false },
      { id: 'style_sheet_approved', label: 'Style sheet approved',             required: false },
    ],
  },
  {
    id: 'overlays',
    icon: '📱',
    label: "Lala's Phone",
    items: [
      { id: 'overlays_generated', label: 'Phone screens generated',   required: false },
    ],
  },
  // What sits on top of the video (the Checklist's Overlays card,
  // 2026-10-08): the title overlay and the overlays placed on the
  // timeline, worked on in Production → Overlays. Neither blocks the script.
  {
    id: 'onscreen',
    icon: '🎞️',
    label: 'Overlays',
    items: [
      { id: 'title_overlay',     label: 'Title overlay made',          required: false },
      { id: 'overlays_placed',   label: 'Overlays placed on the video', required: false },
    ],
  },
  {
    id: 'social',
    icon: '📱',
    label: 'Social & Content',
    items: [
      { id: 'social_checklist',  label: 'Social media checklist',     required: false },
      { id: 'title_generated',   label: 'Episode title (AI-generated)', required: false },
    ],
  },
  {
    id: 'intelligence',
    icon: '🧠',
    label: 'Intelligence',
    items: [
      { id: 'character_state',   label: 'Character state loaded',     required: true  },
      { id: 'show_brain',        label: 'Show Brain accessible',      required: false },
    ],
  },
];

// Lala's Phone counts the show's generated phone-screen images (GET
// /ui-overlays/:showId, assets rows); it never read phone_missions
// (docs/audit/Checklist_Endpoint_Census_2026-09-18.md §155), so the section
// is no longer marked unavailable for that table (the checklist fixes,
// 2026-10-07). A section can still set unavailableReason.
/**
 * "Venue image generated" (B3, Evoni 2026-10-02): the event's scene set has
 * an actual base image. It was true whenever the event had a scene set,
 * image or not. A set that cannot be read counts as no image.
 */
export async function venueImageGenerated(event) {
  if (!event?.scene_set_id) return false;
  try {
    const { data } = await api.get(`/api/v1/scene-sets/${event.scene_set_id}`);
    return Boolean((data?.data || data)?.base_still_url);
  } catch (err) {
    console.error('[EpisodeProductionChecklist] venue set read failed:', err.response?.status || err.message);
    return false;
  }
}

export function computeSectionState(section, checks) {
  if (section.unavailableReason) {
    return { state: 'unavailable', why: section.unavailableReason };
  }

  const requiredItems = section.items.filter(item => item.required);
  const checkedItems = section.items.filter(item => checks[item.id]);
  const checkedRequired = requiredItems.filter(item => checks[item.id]);

  if (requiredItems.length > 0 && checkedRequired.length === requiredItems.length) {
    return { state: 'complete', why: 'All required items done' };
  }
  // A section with nothing required (Social & Content, Lala's Phone) says
  // so, rather than "0 of 0 required items done" (the checklist fixes, 2026-10-07).
  if (requiredItems.length === 0) {
    if (checkedItems.length === section.items.length) return { state: 'complete', why: 'Nothing required; all done' };
    if (checkedItems.length > 0) return { state: 'in_progress', why: 'Nothing required' };
    return { state: 'needs_setup', why: 'Nothing required; nothing set up yet' };
  }
  if (checkedItems.length > 0) {
    return {
      state: 'in_progress',
      why: `${checkedRequired.length} of ${requiredItems.length} required items done`,
    };
  }
  return { state: 'needs_setup', why: 'Nothing set up yet' };
}

// Pink for what is required and missing, lavender for what is done
// (Evoni's Episode mock, 2026-10-05; it was teal). Text uses the
// text-safe twins (pink as text on white fails 4.5:1; docs/VISUAL_SYSTEM.md §3).
const PINK_TEXT = 'var(--accent-dark)';
const LAV_TEXT = 'var(--lala-lavender-text)';

const STATE_STYLES = {
  complete: { label: 'Complete', color: LAV_TEXT, background: 'var(--lala-lavender-soft)' },
  in_progress: { label: 'In progress', color: 'var(--warning-text)', background: 'var(--warning-bg)' },
  needs_setup: { label: 'Needs setup', color: 'var(--text-secondary)', background: 'var(--lala-parchment-2)' },
  unavailable: { label: 'System unavailable', color: 'var(--text-secondary)', background: 'var(--surface-bg)' },
};

/**
 * Where an unchecked item's Fix button goes (audit LINK-03, 2026-10-03):
 * the page where that work is done, in this app. Show work opens Producer
 * Mode's tab for it, so a missing scene set opens this show's Scene Sets
 * (never the clip library), carrying this checklist as the way back; the
 * phone's screens open Lala's Phone. Null when the item has no page, or the
 * show is unknown and the page is the show's.
 */
export function checklistFixTarget(itemId, { episode, showId } = {}) {
  const episodeId = episode?.id;
  const plan = { href: `/episodes/${episodeId}/plan`, label: 'Set up' };
  const events = { href: `/shows/${showId}/world?tab=events` };
  const wardrobe = { href: `/shows/${showId}/world?tab=wardrobe-items`, label: 'Upload' };
  const targets = {
    arc_position: plan,
    archetype: plan,
    designed_intent: plan,
    event_linked: { ...events, label: 'Events' },
    venue_set: { ...events, label: 'Add venue' },
    scene_sets: {
      href: sceneSetsPath(showId, { from: `/episodes/${episodeId}?tab=checklist`, fromLabel: episode?.title || 'the episode checklist', need: 'Scene sets assigned' }),
      label: 'Scene Sets',
    },
    scene_plan: { ...plan, label: 'Generate' },
    scene_images: { href: `/episodes/${episodeId}?tab=scenes`, label: 'Open Scenes' },
    wardrobe_inventory: wardrobe,
    wardrobe_ready: wardrobe,
    outfit_picked: { ...events, label: 'Pick outfit' },
    overlays_generated: { href: `/shows/${showId}/world?tab=overlays-tab`, label: "Lala's Phone" },
    lookbook_ready: { href: `/episodes/${episodeId}?tab=lookbook`, label: 'Fill the Style Page' },
    style_sheet_approved: { href: `/episodes/${episodeId}?tab=lookbook`, label: 'Approve on the Style Page' },
    character_state: { href: `/shows/${showId}/world?tab=overview`, label: 'Set up' },
  };
  const target = targets[itemId];
  if (!target || !episodeId) return null;
  if (target.href.startsWith('/shows/') && !showId) return null;
  return target;
}

function CheckItem({ item, checked, loading, onAction, actionLabel, unavailable, note }) {
  return (
    <div className="ckh-item" style={{ opacity: loading ? 0.5 : 1 }}>
      <CheckBox checked={checked} required={item.required} />
      <span style={{
        fontSize: 14, flex: 1, minWidth: 0,
        color: checked ? 'var(--text-primary)' : item.required ? PINK_TEXT : 'var(--text-secondary)',
        fontWeight: item.required && !checked ? 600 : 400,
        textDecoration: checked ? 'line-through' : 'none',
      }}>
        {item.label}
        {/* On its own line, so a long label wraps cleanly beside its button (the checklist fixes, 2026-10-07). */}
        {item.required && !checked && (
          <span className="ckh-required" style={{ display: 'block', fontSize: 10, color: PINK_TEXT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            required
          </span>
        )}
        {note && (
          <span data-testid={`check-note-${item.id}`} style={{ display: 'block', fontSize: 12, color: item.required ? PINK_TEXT : 'var(--warning-text)', textDecoration: 'none' }}>{note}</span>
        )}
      </span>
      {!checked && onAction && (
        <button type="button" className="ckh-fix" onClick={onAction} disabled={unavailable}>{actionLabel || 'Fix'}</button>
      )}
    </div>
  );
}

/**
 * The production checks for one episode: what the checklist shows, also read
 * by Producer Mode's Overview (the redesign, 2026-10-05) so both show the
 * same checklist. Resolves to { checks, notes, coverage, sceneStep,
 * linkedEvent }; a check whose source cannot be read is false.
 */
export async function loadProductionChecks(episode, showId) {
  let planCoverage = null;
  let sceneStep = null;
  let linkedEvent = null;
  const results = {};
  const checkNotes = {};

  try {
    // ── Check Episode Brief ──
    try {
      const { data } = await api.get(`/api/v1/episode-brief/${episode.id}`);
      const brief = data.data;
      results.arc_position      = !!(brief?.arc_number && brief?.position_in_arc);
      results.archetype         = !!brief?.episode_archetype;
      results.designed_intent   = !!brief?.designed_intent;
      results.narrative_purpose = !!brief?.narrative_purpose;
      results.forward_hook      = !!brief?.forward_hook;
    } catch {
      Object.assign(results, { arc_position: false, archetype: false, designed_intent: false, narrative_purpose: false, forward_hook: false });
    }

    // ── Check Event, Venue, Invitation, Outfit ──
    try {
      if (showId) {
        // The episode's source event (Task #1906): anchor from the
        // brief, never a scan of the show's event list.
        linkedEvent = await getEpisodeAnchorEvent(episode.id);
        results.event_linked = !!linkedEvent;
        results.invitation_exists = !!linkedEvent?.invitation_asset_id;
        const auto = linkedEvent?.canon_consequences?.automation || {};
        results.venue_set = !!(linkedEvent?.venue_name || auto.venue_name || linkedEvent?.scene_set_id);
        results.venue_image = await venueImageGenerated(linkedEvent);
      } else {
        results.event_linked = false;
      }
    } catch {
      results.event_linked = false;
    }

    // ── Check Scene Sets assigned: linked to the episode, or used by the
    // scene plan or the event (checked again below, once the plan is read;
    // Evoni, 2026-10-09: the checklist did not cross out what was done) ──
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
      const sets = data?.data || data?.sceneSets || [];
      results.scene_sets = (Array.isArray(sets) && sets.length > 0) || !!linkedEvent?.scene_set_id;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] episode scene sets read failed:', err.response?.status || err.message);
      results.scene_sets = !!linkedEvent?.scene_set_id;
    }

    // ── Check Scene Plan ──
    try {
      const { data } = await api.get(`/api/v1/episode-brief/${episode.id}/plan`);
      const plan = data?.data || [];
      // Audit GATE-01 (2026-10-03): generated means the server's coverage
      // says every canonical beat is planned once; never a row count.
      const coverage = data?.coverage || null;
      planCoverage = coverage;
      results.scene_plan        = Boolean(coverage?.complete);
      if (plan.length > 0 && !coverage) checkNotes.scene_plan = 'Beat coverage was not reported';
      else if (coverage && !coverage.complete) checkNotes.scene_plan = coverage.text;
      if (plan.some((b) => b.scene_set_id || b.sceneSet)) results.scene_sets = true;
      // L5, Q21: every planned beat has an angle with an image.
      const readiness = data?.readiness;
      results.scene_images = Boolean(readiness && readiness.total > 0 && readiness.ready === readiness.total);
      if (readiness && readiness.total > 0 && readiness.ready < readiness.total) {
        // S9 (a, c): the Scenes tab's summary.
        const n = readiness.not_ready.length;
        const beats = readiness.not_ready.map((b) => b.beat_number).join(', ');
        checkNotes.scene_images = `${readiness.ready} ready · ${n} ${n === 1 ? 'needs' : 'need'} attention: beat${n === 1 ? '' : 's'} ${beats}`;
      }
      sceneStep = nextStep(plan, readiness, coverage);
      // Locking the beats is not a checklist step (2026-10-09).
      if (sceneStep?.kind === 'lock') sceneStep = { kind: 'script', text: 'Write the script' };
    } catch (err) {
      console.error('[EpisodeProductionChecklist] plan read failed:', err.response?.status || err.message);
      results.scene_plan = results.scene_images = false;
      sceneStep = null;
    }

    // ── Check Wardrobe (audit GATE-02, 2026-10-03): the show's required
    // slots, each with a piece, not "any piece exists" ──
    try {
      const { data } = await api.get(`/api/v1/wardrobe/slot-coverage?show_id=${showId}`);
      const slotCoverage = data?.data || null;
      results.wardrobe_inventory = (slotCoverage?.inventory || 0) > 0;
      results.wardrobe_ready = Boolean(slotCoverage?.covered);
      if (slotCoverage && !slotCoverage.covered) checkNotes.wardrobe_ready = slotCoverage.text;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] wardrobe slot coverage failed:', err.response?.status || err.message);
      results.wardrobe_inventory = false;
      results.wardrobe_ready = false;
      checkNotes.wardrobe_ready = 'Wardrobe could not be read';
    }

    // ── Outfit picked: the outfit locked on the Wardrobe tab, the one the
    // script writer reads (it read the event's planned pieces only) ──
    try {
      const { data } = await api.get(`/api/v1/wardrobe/outfit/${episode.id}`);
      results.outfit_picked = (data?.items?.length || 0) > 0;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] locked outfit read failed:', err.response?.status || err.message);
      results.outfit_picked = false;
    }

    // ── Check Character state ──
    try {
      const { data } = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
      results.character_state = !!(data?.state || data?.data);
    } catch {
      results.character_state = false;
    }

    // ── Check UI Overlays ──
    try {
      if (showId) {
        const { data } = await api.get(`/api/v1/ui-overlays/${showId}`);
        results.overlays_generated = (data?.generated_count || 0) >= 5;
      }
    } catch {
      results.overlays_generated = false;
    }

    // ── Check Social Checklist ──
    try {
      results.social_checklist = false;
      // The episode's social tasks (episode_todo_lists, the To-Do tab and the
      // script read them), or a social checklist image.
      const [tasks, assets] = await Promise.all([
        api.get(`/api/v1/episodes/${episode.id}/todo/social`).then((r) => r.data?.social_tasks || []).catch((err) => {
          console.error('[EpisodeProductionChecklist] social tasks read failed:', err.response?.status || err.message);
          return [];
        }),
        api.get(`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episode.id}&limit=1`).then((r) => r.data?.data || []).catch((err) => {
          console.error('[EpisodeProductionChecklist] social checklist asset read failed:', err.response?.status || err.message);
          return [];
        }),
      ]);
      results.social_checklist = tasks.length > 0 || assets.length > 0;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] social checklist check failed:', err.message);
      results.social_checklist = false;
    }

    // ── Check the Overlays card: the title overlay, and overlays placed on the video ──
    // The title overlay or the framed title card, read from the episode as
    // it is now (the page's copy can predate the Overlays tab's save;
    // Evoni, 2026-10-09: "title has already been created").
    let titleRow = episode;
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}`);
      titleRow = data?.data || data?.episode || data || episode;
    } catch (err) {
      console.error('[Checklist] episode re-read failed:', err.response?.status || err.message);
    }
    results.title_overlay = !!(titleRow.title_overlay_asset_id || titleRow.title_card_asset_id || episode.title_overlay_asset_id || episode.title_card_asset_id);
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}/timeline/placements`);
      results.overlays_placed = (data?.data?.length || 0) > 0;
    } catch (err) {
      console.error('[Checklist] overlay placements read failed:', err.response?.status || err.message);
      results.overlays_placed = false;
    }

    // ── Check the Style Page card: ready x of 12 (the server's rule, read
    //    through lib/styleReadiness), and the style sheet's status ──
    try {
      const [lbRes, sheetRes] = await Promise.all([
        api.get(`/api/v1/episodes/${episode.id}/lookbook`),
        api.get(`/api/v1/episodes/${episode.id}/style-sheet`).catch((err) => {
          console.error('[Checklist] style sheet read failed:', err.response?.status || err.message);
          return null;
        }),
      ]);
      const lookbook = lbRes?.data?.data || {};
      const sheet = sheetRes?.data?.data || null;
      const { done, total, missing } = styleReadiness({ sheet });
      results.lookbook_ready = done >= total;
      if (!results.lookbook_ready) checkNotes.lookbook_ready = `Style sheet ready ${done} of ${total}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`;
      results.style_sheet_approved = lookbook.sheet_status === 'approved';
      if (!results.style_sheet_approved) checkNotes.style_sheet_approved = 'Draft';
    } catch (err) {
      console.error('[Checklist] Lookbook read failed:', err.response?.status || err.message);
      results.lookbook_ready = false;
      results.style_sheet_approved = false;
      checkNotes.lookbook_ready = 'The Style Page could not be read';
    }

    // ── Check Episode Title (AI-generated vs default) ──
    results.title_generated = !!(episode.title && !episode.title.startsWith('Episode ') && episode.title !== episode.description?.split(' — ')?.[0]);

    // ── Check Show Brain ──
    try {
      const { data } = await api.get('/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1');
      // The route answers { entries, count }; it read data.data, never there.
      const entries = data?.entries || data?.data || [];
      results.show_brain = Array.isArray(entries) ? entries.length > 0 : false;
    } catch {
      results.show_brain = false;
    }
  } catch (err) {
    console.error('[Checklist] Error:', err);
  }
  return { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep, linkedEvent };
}

export default function EpisodeProductionChecklist({ episode, showId, onScriptGenerate, onChecks, onOpenTab }) {
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState({});
  // Audit STATE-01: the server's beat coverage, and the setup repair.
  const [coverage, setCoverage] = useState(null);
  const [resuming, setResuming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  // S9 (c): the scenes' next step (plan, images, locks, script), moved here
  // from the Scenes tab.
  const [sceneStep, setSceneStep] = useState(null);
  // The source event (the event package card's link) and a counter that
  // reloads the timeline with each re-check.
  const [linkedEvent, setLinkedEvent] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!episode?.id) return;
    checkReadiness();
  }, [episode?.id]);

  const checkReadiness = async () => {
    setLoading(true);
    const { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep: step, linkedEvent: ev } = await loadProductionChecks(episode, showId);
    setLinkedEvent(ev || null);
    setVersion((v) => v + 1);
    setCoverage(planCoverage);
    setSceneStep(step);
    setChecks(results);
    setNotes(checkNotes);
    setLoading(false);
    // The page's Production badge follows each re-check.
    onChecks?.(results, CHECKLIST_SECTIONS);
  };

  const handleGenerateScript = async () => {
    setGenerating(true);
    const post = (confirmOverwrite) => api.post(`/api/v1/episode-brief/${episode.id}/generate-script`, {
      showId, ...(confirmOverwrite ? { confirmOverwrite: true } : {}),
    });
    try {
      let res;
      try {
        res = await post(false);
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.code === 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED') {
          if (!window.confirm('This episode already has a script. Replace it?')) return;
          res = await post(true);
        } else {
          throw err;
        }
      }
      // Audit GATE-03 (2026-10-03): generated is not saved.
      if (res.data?.saved === false) {
        setToast({ msg: `⚠️ ${res.data.error || 'The script was generated but could not be saved.'} Open the Script tab and save it.`, type: 'error' });
        setTimeout(() => setToast(null), 8000);
      } else {
        setToast({ msg: '✅ Script generated! Check the Script tab.', type: 'success' });
        setTimeout(() => setToast(null), 4000);
      }
      if (onScriptGenerate) onScriptGenerate(res.data);
    } catch (err) {
      setToast({ msg: err.response?.data?.error || 'Script generation failed', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setGenerating(false);
    }
  };

  // Each unchecked item's Fix button opens the page where that work is done
  // (checklistFixTarget), in this app, so Back returns to this checklist.
  const navigate = useNavigate();
  const actions = Object.fromEntries(CHECKLIST_SECTIONS.flatMap((s) => s.items).flatMap((item) => {
    const target = checklistFixTarget(item.id, { episode, showId });
    return target ? [[item.id, { action: () => navigate(target.href), label: target.label }]] : [];
  }));

  // S9 (c): lock every beat, then re-check.
  // Audit STATE-01: a partly initialised episode (setup_status.complete
  // false, or canonical beats missing) is repaired in place, never by a
  // second episode. The server makes only the missing beats.
  const setupStatus = episode.setup_status || null;
  const setupIncomplete = setupStatus?.complete === false || Boolean(coverage && !coverage.complete && coverage.present > 0);
  const resumeSetup = async () => {
    setResuming(true);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episode.id}/setup/resume`);
      const step = res.data?.data?.scene_plan;
      if (res.data?.success) {
        setToast({ msg: `✅ Setup resumed: ${step?.created ?? 0} beat${step?.created === 1 ? '' : 's'} made, ${step?.existing ?? 0} already there.`, type: 'success' });
      } else {
        setToast({ msg: `⚠️ ${res.data?.error || 'Setup is still incomplete'}${step?.failed?.length ? ` — ${step.failed.map((f) => `beat ${f.beat}: ${f.reason}`).join('; ')}` : ''}`, type: 'error' });
      }
      setTimeout(() => setToast(null), 8000);
      await checkReadiness();
    } catch (err) {
      console.error('[EpisodeProductionChecklist] resume setup failed:', err);
      setToast({ msg: err.response?.data?.error || 'Could not resume setup', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setResuming(false);
    }
  };

  // Each action is offered once on the list: the plan and the script by the
  // footer's Scene Plan and Write Script, the images by their row's Open
  // Scenes, so the next step is words only.

  const allRequired = CHECKLIST_SECTIONS
    .flatMap(s => s.items)
    .filter(i => i.required)
    .every(i => checks[i.id]);

  // The script's closet beat (Task #2880): where the look sits on the
  // timeline and the beat the Wardrobe card names; none without one.
  const lookBeat = closetBeat(episode?.script_content);
  const completedCount = Object.values(checks).filter(Boolean).length;
  // Items dim only until the first check lands; a re-check keeps the last
  // answers in place rather than flashing every row.
  const hasChecked = Object.keys(checks).length > 0;
  const totalCount = CHECKLIST_SECTIONS.flatMap(s => s.items).length;

  return (
    <div style={{ marginTop: 20 }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
          color: toast.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)',
          border: `1px solid ${toast.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`,
          borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}

      <ProductionSummary done={completedCount} total={totalCount} loading={loading} onRefresh={checkReadiness} />
      <EpisodeTimeline episodeId={episode.id} lookReady={!!checks.outfit_picked} lookBeat={lookBeat} version={version} />

      <div className="ckh-cards">
      {CHECKLIST_SECTIONS.map(section => (
        (() => {
          const sectionStatus = computeSectionState(section, checks);
          const stateStyle = STATE_STYLES[sectionStatus.state];
          const guide = SECTION_GUIDE[section.id] && { ...SECTION_GUIDE[section.id], text: sectionGuideText(section.id, { closetBeat: lookBeat }) };
          // Each action is offered once: no card button where an open item already goes there.
          const itemLabels = new Set(section.items.filter((i) => !checks[i.id]).map((i) => actions[i.id]?.label).filter(Boolean));
          const open = guide?.open && !itemLabels.has(guide.open.label)
            ? (guide.open.event
              ? (linkedEvent && showId ? <Link className="ckh-open" to={`/shows/${showId}/events/${linkedEvent.id}`}>{guide.open.label}</Link> : null)
              : <button type="button" className="ckh-open" onClick={() => onOpenTab?.(guide.open.tab)}>{guide.open.label}</button>)
            : null;

          return (
        <SectionCard key={section.id} section={section} state={sectionStatus} chip={stateStyle.label} count={sectionCount(section, checks)} guide={guide} open={open}>
          {section.id === 'scene' && sceneStep && (
            <div data-testid="checklist-scene-next" className="ckh-next">
              <span style={{ flex: '1 1 180px', minWidth: 0 }}><strong>Next:</strong> {sceneStep.text}</span>
            </div>
          )}
          {/* Production coverage (§8(o) item 2, episode creation step 8). */}
          {section.id === 'scene' && setupIncomplete && (
            <div role="alert" data-testid="setup-incomplete" style={{ margin: '0 0 8px', padding: '8px 10px', borderRadius: 8, background: 'var(--accent-subtle)', border: '1px solid var(--accent)', fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: 1 }}>
                <strong>Setup did not finish.</strong>{' '}
                {coverage && !coverage.complete ? coverage.text : null}
                {setupStatus?.steps?.scene_plan?.failed?.length ? ` · ${setupStatus.steps.scene_plan.failed.map((f) => `beat ${f.beat}: ${f.reason}`).join('; ')}` : ''}
                {setupStatus?.steps?.locations?.status === 'failed' ? ` · locations: ${setupStatus.steps.locations.reason}` : ''}
              </span>
              <button type="button" onClick={resumeSetup} disabled={resuming || loading} data-testid="setup-resume" style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--lala-lavender)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {resuming ? 'Resuming…' : 'Resume setup'}
              </button>
            </div>
          )}
          {section.items.map(item => (
            <CheckItem key={item.id} item={item} checked={!!checks[item.id]} loading={loading && !hasChecked} note={notes[item.id]}
              onAction={actions[item.id]?.action} actionLabel={actions[item.id]?.label}
              unavailable={sectionStatus.state === 'unavailable'} />
          ))}
        </SectionCard>
          );
        })()
      ))}
      </div>

      <div className="ckh-foot">
        {!allRequired && (
          <p className="ckh-foot-note">Complete all required items to unlock script generation.</p>
        )}
        <div className="ckh-foot-actions">
          <button type="button" onClick={() => window.location.href = `/episodes/${episode.id}/script-writer`} disabled={!allRequired} style={{
            background: allRequired ? 'var(--lala-lavender)' : 'var(--lala-parchment-3)',
            color: allRequired ? 'var(--text-inverse)' : 'var(--text-secondary)',
            border: 'none', borderRadius: 10, padding: '11px 20px',
            fontSize: 14, fontWeight: 600, cursor: allRequired ? 'pointer' : 'not-allowed',
          }}>
            Write Script
          </button>
          <button type="button" className="ckh-open" onClick={() => window.location.href = `/episodes/${episode.id}/plan`}>Scene Plan</button>
          {/* Episode Run Sheet — producer-facing tracker at /episodes/:id/todo (issue #1605). */}
          <Link className="ckh-open" to={`/episodes/${episode.id}/todo`}>Episode Run Sheet</Link>
          {/* Final step — Evaluate Episode (issue #1601). */}
          <Link className="ckh-evaluate" to={`/episodes/${episode.id}/evaluate`}>Evaluate Episode</Link>
        </div>
      </div>
    </div>
  );
}
