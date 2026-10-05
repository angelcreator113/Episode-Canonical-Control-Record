import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { nextStep } from '../../utils/sceneSteps';
import { sceneSetsPath } from '../../utils/sceneSets';
import ProductionCoveragePanel from './ProductionCoveragePanel';

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
      { id: 'scene_plan',        label: 'Scene plan generated (14 beats)', required: true  },
      { id: 'scene_plan_locked', label: 'Scene plan locked',          required: false },
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
  {
    id: 'overlays',
    icon: '📱',
    label: "Lala's Phone",
    unavailableReason: 'Phone missions not deployed yet (phone_missions absent from canon)',
    items: [
      { id: 'overlays_generated', label: 'Phone screens generated',   required: false },
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

// The endpoint census records phone_missions as absent from canon:
// docs/audit/Checklist_Endpoint_Census_2026-09-18.md.
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
  if (checkedItems.length > 0) {
    return {
      state: 'in_progress',
      why: `${checkedRequired.length} of ${requiredItems.length} required items done`,
    };
  }
  return { state: 'needs_setup', why: 'Nothing set up yet' };
}

// Soft pink for what is required and missing, teal for what is done
// (Evoni: the site's colors are soft pink and teal).
// Fills and borders use the family color; text uses its text-safe twin
// (pink and teal as text on white fail 4.5:1; docs/VISUAL_SYSTEM.md §3).
const PINK = 'var(--accent)';
const PINK_TEXT = 'var(--accent-dark)';
const TEAL = 'var(--primary)';
const TEAL_TEXT = 'var(--primary-text)';

const STATE_STYLES = {
  complete: { label: 'Complete', color: TEAL_TEXT, background: 'var(--primary-subtle)' },
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
    character_state: { href: `/shows/${showId}/world?tab=overview`, label: 'Set up' },
  };
  const target = targets[itemId];
  if (!target || !episodeId) return null;
  if (target.href.startsWith('/shows/') && !showId) return null;
  return target;
}

function CheckItem({ item, checked, loading, onAction, actionLabel, unavailable, note }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 0',
      opacity: loading ? 0.5 : 1,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: checked ? 'none' : `1.5px solid ${item.required ? PINK : 'var(--lala-parchment-3)'}`,
        background: checked ? TEAL : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <span style={{ color: 'var(--text-inverse)', fontSize: 11, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{
        fontSize: 13, flex: 1,
        color: checked ? 'var(--text-primary)' : item.required ? PINK_TEXT : 'var(--text-secondary)',
        fontWeight: item.required && !checked ? 600 : 400,
        textDecoration: checked ? 'line-through' : 'none',
      }}>
        {item.label}
        {item.required && !checked && (
          <span style={{ marginLeft: 6, fontSize: 9, color: PINK_TEXT, fontWeight: 700, textTransform: 'uppercase' }}>
            required
          </span>
        )}
        {note && (
          <span data-testid={`check-note-${item.id}`} style={{ display: 'block', fontSize: 11, color: item.required ? PINK_TEXT : 'var(--warning-text)', textDecoration: 'none' }}>{note}</span>
        )}
      </span>
      {!checked && onAction && (
        <button onClick={onAction} disabled={unavailable} style={{
          padding: '2px 8px', borderRadius: 4, border: 'none',
          background: unavailable ? 'var(--lala-parchment-3)' : 'var(--lala-gold)',
          color: unavailable ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: 9,
          fontWeight: 600, cursor: unavailable ? 'not-allowed' : 'pointer', flexShrink: 0,
        }}>{actionLabel || 'Fix'}</button>
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
        const outfit = typeof linkedEvent?.outfit_pieces === 'string' ? JSON.parse(linkedEvent.outfit_pieces || '[]') : (linkedEvent?.outfit_pieces || []);
        results.outfit_picked = outfit.length > 0;
      } else {
        results.event_linked = false;
      }
    } catch {
      results.event_linked = false;
    }

    // ── Check Scene Sets assigned ──
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
      const sets = data?.data || data?.sceneSets || [];
      results.scene_sets = Array.isArray(sets) ? sets.length > 0 : false;
    } catch {
      results.scene_sets = false;
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
      results.scene_plan_locked = Boolean(coverage?.complete) && plan.every(b => b.locked);
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
    } catch (err) {
      console.error('[EpisodeProductionChecklist] plan read failed:', err.response?.status || err.message);
      results.scene_plan = results.scene_plan_locked = results.scene_images = false;
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
      // Check if episode has a social checklist asset
      const { data } = await api.get(`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episode.id}&limit=1`);
      results.social_checklist = (data?.data?.length || 0) > 0;
    } catch {
      results.social_checklist = false;
    }

    // ── Check Episode Title (AI-generated vs default) ──
    results.title_generated = !!(episode.title && !episode.title.startsWith('Episode ') && episode.title !== episode.description?.split(' — ')?.[0]);

    // ── Check Show Brain ──
    try {
      const { data } = await api.get('/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1');
      const entries = data?.data || [];
      results.show_brain = Array.isArray(entries) ? entries.length > 0 : false;
    } catch {
      results.show_brain = false;
    }
  } catch (err) {
    console.error('[Checklist] Error:', err);
  }
  return { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep, linkedEvent };
}

export default function EpisodeProductionChecklist({ episode, showId, onScriptGenerate, onChecks }) {
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
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!episode?.id) return;
    checkReadiness();
  }, [episode?.id]);

  const checkReadiness = async () => {
    setLoading(true);
    const { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep: step } = await loadProductionChecks(episode, showId);
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
  const lockAllBeats = async () => {
    setLocking(true);
    try {
      await api.post(`/api/v1/episode-brief/${episode.id}/plan/lock-all`);
      await checkReadiness();
    } catch (err) {
      console.error('[EpisodeProductionChecklist] lock all failed:', err);
      setToast({ msg: err.response?.data?.error || 'Could not lock the beats', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLocking(false);
    }
  };
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
  // Scenes; only locking every beat has no other button.
  const sceneStepAction = sceneStep?.kind === 'lock' ? { label: 'Lock all beats', onClick: lockAllBeats } : null;

  const allRequired = CHECKLIST_SECTIONS
    .flatMap(s => s.items)
    .filter(i => i.required)
    .every(i => checks[i.id]);

  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = CHECKLIST_SECTIONS.flatMap(s => s.items).length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Production Checklist</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{completedCount}/{totalCount}</span>
          <button onClick={checkReadiness} disabled={loading} style={{
            background: 'none', border: '1px solid var(--lala-parchment-3)', borderRadius: 6,
            padding: '3px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer',
          }}>↻</button>
        </div>
      </div>

      <div style={{ height: 5, background: 'var(--lala-parchment-2)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: pct === 100 ? TEAL : pct >= 60 ? 'var(--lala-gold)' : PINK,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {CHECKLIST_SECTIONS.map(section => (
        (() => {
          const sectionStatus = computeSectionState(section, checks);
          const stateStyle = STATE_STYLES[sectionStatus.state];

          return (
        <div key={section.id} style={{
          background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        }}>
          <h4 style={{
            margin: '0 0 6px', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {section.icon} {section.label}
            <span style={{
              marginLeft: 'auto', padding: '2px 7px', borderRadius: 999,
              color: stateStyle.color, background: stateStyle.background,
              fontSize: 10, fontWeight: 600,
            }}>
              {stateStyle.label}
            </span>
          </h4>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{sectionStatus.why}</div>
          {section.id === 'scene' && sceneStep && (
            <div data-testid="checklist-scene-next" style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '6px 10px', borderRadius: 8, background: 'var(--surface-bg)', border: '1px solid rgba(184,150,46,0.35)',
              fontSize: 12, color: 'var(--text-primary)',
            }}>
              <span style={{ flex: '1 1 180px', minWidth: 0 }}><strong>Next:</strong> {sceneStep.text}</span>
              {sceneStepAction && (
                <button type="button" data-testid="checklist-scene-next-action" onClick={sceneStepAction.onClick} disabled={locking} style={{
                  padding: '3px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'var(--text-inverse)',
                  fontSize: 11, fontWeight: 600, cursor: locking ? 'wait' : 'pointer',
                }}>{sceneStepAction.label}</button>
              )}
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
              <button type="button" onClick={resumeSetup} disabled={resuming || loading} data-testid="setup-resume" style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {resuming ? 'Resuming…' : 'Resume setup'}
              </button>
            </div>
          )}
          {section.id === 'scene' && <ProductionCoveragePanel episodeId={episode.id} />}
          {section.items.map(item => (
            <CheckItem key={item.id} item={item} checked={!!checks[item.id]} loading={loading} note={notes[item.id]}
              onAction={actions[item.id]?.action} actionLabel={actions[item.id]?.label}
              unavailable={sectionStatus.state === 'unavailable'} />
          ))}
        </div>
          );
        })()
      ))}

      <div style={{ marginTop: 16 }}>
        {!allRequired && (
          <p style={{ fontSize: 12, color: PINK_TEXT, marginBottom: 6 }}>
            Complete all required items to unlock script generation.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.location.href = `/episodes/${episode.id}/script-writer`} style={{
            flex: 1,
            background: allRequired ? 'var(--primary)' : 'var(--lala-parchment-3)',
            color: allRequired ? 'var(--text-inverse)' : 'var(--text-secondary)',
            border: 'none', borderRadius: 10, padding: '12px 0',
            fontSize: 14, fontWeight: 600, cursor: allRequired ? 'pointer' : 'not-allowed',
            boxShadow: allRequired ? '0 2px 8px rgba(184,150,46,0.25)' : 'none',
          }}>
            ✦ Write Script
          </button>
          <button onClick={() => window.location.href = `/episodes/${episode.id}/plan`} style={{
            padding: '12px 16px', border: '1px solid var(--lala-parchment-3)', borderRadius: 10,
            background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>
            🎬 Scene Plan
          </button>
        </div>
      </div>

      {/* Episode Run Sheet — producer-facing tracker at /episodes/:id/todo
          (issue #1605). Was duplicated beside the audience-facing To-Do
          Overlays in Assets (issue #1602); lives here instead, alongside
          the other producer-facing next-step link below. */}
      <div style={{ marginTop: 12 }}>
        <Link to={`/episodes/${episode.id}/todo`} style={{
          display: 'block', textAlign: 'center', padding: '10px 0',
          borderRadius: 10, textDecoration: 'none',
          border: '1px solid var(--lala-parchment-3)', background: 'var(--surface-card)',
          color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
        }}>
          📋 Episode Run Sheet
        </Link>
      </div>

      {/* Final step — Evaluate Episode, relocated from the Episode Detail
          header (issue #1601). Same route and handler (a plain navigation
          link) as before; it now closes out the checklist instead of
          competing for header space. */}
      <div style={{ marginTop: 12 }}>
        <Link to={`/episodes/${episode.id}/evaluate`} style={{
          display: 'block', textAlign: 'center', padding: '12px 0',
          borderRadius: 10, textDecoration: 'none',
          background: 'var(--primary)',
          color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700,
        }}>
          👑 Evaluate Episode
        </Link>
      </div>
    </div>
  );
}
