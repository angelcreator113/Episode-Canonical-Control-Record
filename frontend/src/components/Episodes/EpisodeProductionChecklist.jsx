import { adminOnlyMessage } from '../../utils/authGroups';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { nextStep } from '../../utils/sceneSteps';
import { sceneSetsPath } from '../../utils/sceneSets';
import { withReturn, tabOrigin } from '../../utils/returnPath';
import { ProductionSummary, EpisodeTimeline, SectionCard, CheckBox } from './ChecklistHub';
import { SECTION_GUIDE, sectionCount, sectionGuideText } from '../../lib/checklistHub';
import { closetBeat } from '../../lib/scriptMoments';
import { styleReadiness } from '../../lib/styleReadiness';
import { seasonPageHref } from '../../lib/seasonPage';

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
  const events = { href: seasonPageHref(showId, 'events') };
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
    scene_images: { href: `/episodes/${episodeId}?tab=beatplan`, label: 'Open the Scenes plan' },
    wardrobe_inventory: wardrobe,
    wardrobe_ready: wardrobe,
    outfit_picked: { ...events, label: 'Pick outfit' },
    overlays_generated: { href: `/shows/${showId}/world?tab=overlays-tab`, label: "Lala's Phone" },
    lookbook_ready: { href: `/episodes/${episodeId}?tab=lookbook`, label: 'Fill the Style Page' },
    style_sheet_approved: { href: `/episodes/${episodeId}?tab=lookbook`, label: 'Approve on the Style Page' },
    // Lala's stats are set on Producer Mode › Cast & Continuity › Lala's State
    // & Continuity (Evoni, 2026-11-15). It opened Producer Mode's Overview,
    // which is where Producer Mode's own checklist card sends from.
    character_state: { href: `/shows/${showId}/world?tab=characters-list`, label: 'Set up in Producer Mode' },
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
 * linkedEvent, read }; a check whose source cannot be read is false.
 *
 * Since PR-07 of docs/design/2026-11-studio-home-episode-command-center.md
 * the reads are made together, and the checks are then worked out from what
 * came back in the order they always were, so the checks, the notes and the
 * console lines do not depend on which answer arrives first.
 *
 * options.loaded (optional): what the caller already holds, used in place
 * of its read. A key that is absent or undefined is read; any other value,
 * null and [] included, is taken as the answer.
 *   brief        the episode brief, or null
 *   linkedEvent  the episode's anchor event, or null (ignored with no show,
 *                where no event is looked for)
 *   sceneSets    the scene sets linked to the episode
 *   lalaState    Lala's state, or null
 *
 * read: what the checks used, by name, whether it was read here or given in
 * `loaded`. A read that failed or was not made has no key; one that answered
 * with nothing is null or []. read.supplied lists the keys that came from
 * `loaded`; it describes the others and is not itself data.
 */
export async function loadProductionChecks(episode, showId, options) {
  let planCoverage = null;
  let sceneStep = null;
  let linkedEvent = null;
  const results = {};
  const checkNotes = {};
  const read = { supplied: [] };

  const loaded = options?.loaded || {};
  const given = (key) => Object.prototype.hasOwnProperty.call(loaded, key) && loaded[key] !== undefined;

  // ── The reads, started together ──
  // Each settles to { ok, value } or { ok: false, error }; none rejects, and
  // nothing is logged or decided here. `sync` marks a read whose call threw
  // before it was a request, which the blocks below treat as they always did.
  const start = (make) => {
    try {
      return Promise.resolve(make()).then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
    } catch (error) {
      return Promise.resolve({ ok: false, error, sync: true });
    }
  };
  /**
   * The answer of a read, or its error thrown where the read used to be
   * awaited. The blocks below still `await` it, though it has already
   * settled, so a malformed answer is reported in the words it always was.
   */
  const take = (settled) => {
    if (!settled.ok) throw settled.error;
    return settled.value;
  };

  const pending = {
    brief: given('brief') ? null : start(() => api.get(`/api/v1/episode-brief/${episode.id}`)),
    // The episode's source event (Task #1906): anchor from the brief, never
    // a scan of the show's event list. Only looked for when there is a show.
    anchor: !showId ? null : (given('linkedEvent') ? null : start(() => getEpisodeAnchorEvent(episode.id))),
    sceneSets: given('sceneSets') ? null : start(() => api.get(`/api/v1/episodes/${episode.id}/scene-sets`)),
    plan: start(() => api.get(`/api/v1/episode-brief/${episode.id}/plan`)),
    slotCoverage: start(() => api.get(`/api/v1/wardrobe/slot-coverage?show_id=${showId}`)),
    outfit: start(() => api.get(`/api/v1/wardrobe/outfit/${episode.id}`)),
    lalaState: given('lalaState') ? null : start(() => api.get(`/api/v1/characters/lala/state?show_id=${showId}`)),
    overlays: showId ? start(() => api.get(`/api/v1/ui-overlays/${showId}`)) : null,
    // The episode's social tasks (episode_todo_lists, the To-Do tab and the
    // script read them), or a social checklist image.
    socialTasks: start(() => api.get(`/api/v1/episodes/${episode.id}/todo/social`).then((r) => r.data?.social_tasks || [])),
    socialAssets: start(() => api.get(`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episode.id}&limit=1`).then((r) => r.data?.data || [])),
    episode: start(() => api.get(`/api/v1/episodes/${episode.id}`)),
    placements: start(() => api.get(`/api/v1/episodes/${episode.id}/timeline/placements`)),
    lookbook: start(() => api.get(`/api/v1/episodes/${episode.id}/lookbook`)),
    styleSheet: start(() => api.get(`/api/v1/episodes/${episode.id}/style-sheet`).catch((err) => { throw err; })),
    showBrain: start(() => api.get('/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1')),
  };
  // The venue's image needs the event, so it follows that read alone. With
  // no event read (it failed, or there is no show) it is not asked for.
  if (showId) {
    const event = given('linkedEvent') ? Promise.resolve({ ok: true, value: loaded.linkedEvent }) : pending.anchor;
    pending.venue = event.then((got) => (got.ok ? start(() => venueImageGenerated(got.value)) : { ok: false, error: got.error }));
  }
  const names = Object.keys(pending).filter((name) => pending[name]);
  const answers = await Promise.all(names.map((name) => pending[name]));
  const got = Object.fromEntries(names.map((name, i) => [name, answers[i]]));

  // ── The checks, in the order they always were, from what came back ──
  try {
    // ── Check Episode Brief ──
    try {
      let brief;
      if (given('brief')) {
        brief = loaded.brief;
        read.supplied.push('brief');
      } else {
        const { data } = await take(got.brief);
        brief = data.data;
      }
      read.brief = brief ?? null;
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
        if (given('linkedEvent')) {
          linkedEvent = loaded.linkedEvent;
          read.supplied.push('linkedEvent');
        } else {
          linkedEvent = take(got.anchor);
        }
        read.linkedEvent = linkedEvent ?? null;
        results.event_linked = !!linkedEvent;
        results.invitation_exists = !!linkedEvent?.invitation_asset_id;
        const auto = linkedEvent?.canon_consequences?.automation || {};
        results.venue_set = !!(linkedEvent?.venue_name || auto.venue_name || linkedEvent?.scene_set_id);
        results.venue_image = take(got.venue);
        read.venueSetHasImage = results.venue_image;
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
      let sets;
      if (given('sceneSets')) {
        sets = loaded.sceneSets || [];
        read.supplied.push('sceneSets');
      } else {
        const { data } = await take(got.sceneSets);
        sets = data?.data || data?.sceneSets || [];
      }
      read.sceneSets = sets;
      results.scene_sets = (Array.isArray(sets) && sets.length > 0) || !!linkedEvent?.scene_set_id;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] episode scene sets read failed:', err.response?.status || err.message);
      results.scene_sets = !!linkedEvent?.scene_set_id;
    }

    // ── Check Scene Plan ──
    try {
      const { data } = await take(got.plan);
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
      // Recorded only now: a plan the block could not work through is not one to reuse.
      read.plan = { beats: plan, coverage, readiness: readiness ?? null };
    } catch (err) {
      console.error('[EpisodeProductionChecklist] plan read failed:', err.response?.status || err.message);
      results.scene_plan = results.scene_images = false;
      sceneStep = null;
    }

    // ── Check Wardrobe (audit GATE-02, 2026-10-03): the show's required
    // slots, each with a piece, not "any piece exists" ──
    try {
      const { data } = await take(got.slotCoverage);
      const slotCoverage = data?.data || null;
      read.slotCoverage = slotCoverage;
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
      const { data } = await take(got.outfit);
      read.outfit = data?.items ?? null;
      results.outfit_picked = (data?.items?.length || 0) > 0;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] locked outfit read failed:', err.response?.status || err.message);
      results.outfit_picked = false;
    }

    // ── Check Character state ──
    try {
      let state;
      if (given('lalaState')) {
        state = loaded.lalaState;
        read.supplied.push('lalaState');
      } else {
        const { data } = await take(got.lalaState);
        state = data?.state || data?.data;
      }
      read.lalaState = state ?? null;
      results.character_state = !!state;
    } catch {
      results.character_state = false;
    }

    // ── Check UI Overlays ──
    try {
      if (showId) {
        const { data } = await take(got.overlays);
        read.overlays = data ?? null;
        results.overlays_generated = (data?.generated_count || 0) >= 5;
      }
    } catch {
      results.overlays_generated = false;
    }

    // ── Check Social Checklist ──
    // A call that threw before it was a request stops the pair, as it did
    // when the two were written side by side. If the tasks read was already
    // on its way and fails, its line follows the pair's, as it did.
    let tasksLineAfter = false;
    try {
      results.social_checklist = false;
      if (got.socialTasks.sync) throw got.socialTasks.error;
      if (got.socialAssets.sync) {
        tasksLineAfter = !got.socialTasks.ok;
        throw got.socialAssets.error;
      }
      let tasks;
      if (got.socialTasks.ok) {
        tasks = got.socialTasks.value;
        read.socialTasks = tasks;
      } else {
        console.error('[EpisodeProductionChecklist] social tasks read failed:', got.socialTasks.error.response?.status || got.socialTasks.error.message);
        tasks = [];
      }
      let assets;
      if (got.socialAssets.ok) {
        assets = got.socialAssets.value;
        read.socialAssets = assets;
      } else {
        console.error('[EpisodeProductionChecklist] social checklist asset read failed:', got.socialAssets.error.response?.status || got.socialAssets.error.message);
        assets = [];
      }
      results.social_checklist = tasks.length > 0 || assets.length > 0;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] social checklist check failed:', err.message);
      results.social_checklist = false;
      if (tasksLineAfter) console.error('[EpisodeProductionChecklist] social tasks read failed:', got.socialTasks.error.response?.status || got.socialTasks.error.message);
    }

    // ── Check the Overlays card: the title overlay, and overlays placed on the video ──
    // The title overlay or the framed title card, read from the episode as
    // it is now (the page's copy can predate the Overlays tab's save;
    // Evoni, 2026-10-09: "title has already been created").
    let titleRow = episode;
    try {
      const { data } = await take(got.episode);
      titleRow = data?.data || data?.episode || data || episode;
      read.episode = titleRow ?? null;
    } catch (err) {
      console.error('[Checklist] episode re-read failed:', err.response?.status || err.message);
    }
    results.title_overlay = !!(titleRow.title_overlay_asset_id || titleRow.title_card_asset_id || episode.title_overlay_asset_id || episode.title_card_asset_id);
    try {
      const { data } = await take(got.placements);
      read.placements = data?.data ?? null;
      results.overlays_placed = (data?.data?.length || 0) > 0;
    } catch (err) {
      console.error('[Checklist] overlay placements read failed:', err.response?.status || err.message);
      results.overlays_placed = false;
    }

    // ── Check the Style Page card: ready x of 12 (the server's rule, read
    //    through lib/styleReadiness), and the style sheet's status ──
    try {
      if (got.lookbook.sync) throw got.lookbook.error;
      if (got.styleSheet.sync) throw got.styleSheet.error;
      let sheetRes;
      if (got.styleSheet.ok) {
        sheetRes = got.styleSheet.value;
      } else {
        console.error('[Checklist] style sheet read failed:', got.styleSheet.error.response?.status || got.styleSheet.error.message);
        sheetRes = null;
      }
      const lbRes = take(got.lookbook);
      const lookbook = lbRes?.data?.data || {};
      const sheet = sheetRes?.data?.data || null;
      const { done, total, missing } = styleReadiness({ sheet });
      results.lookbook_ready = done >= total;
      if (!results.lookbook_ready) checkNotes.lookbook_ready = `Style sheet ready ${done} of ${total}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`;
      results.style_sheet_approved = lookbook.sheet_status === 'approved';
      if (!results.style_sheet_approved) checkNotes.style_sheet_approved = 'Draft';
      // Recorded only now, and the sheet only when its own read answered.
      read.lookbook = lookbook;
      if (got.styleSheet.ok) read.styleSheet = sheet;
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
      const { data } = await take(got.showBrain);
      // The route answers { entries, count }; it read data.data, never there.
      const entries = data?.entries || data?.data || [];
      read.showBrain = entries;
      results.show_brain = Array.isArray(entries) ? entries.length > 0 : false;
    } catch {
      results.show_brain = false;
    }
  } catch (err) {
    console.error('[Checklist] Error:', err);
  }
  return { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep, linkedEvent, read };
}

/**
 * `initial` (optional): the page's own complete loadProductionChecks result
 * for THIS episode, read from the episode as it is now — { episodeId,
 * version, checks, sections, notes, coverage, sceneStep, linkedEvent, read }.
 * Where it is given, the tab shows it and makes no read of its own: the page
 * has already asked these questions (PR-08's `loaded` hand-off made the
 * page's read the cheap one; this stops the second read altogether). It is
 * taken only while its episode AND its `checksVersion` are the ones here, so
 * a record from before a save is never reused, and it is never reported back
 * through onChecks — the page already holds it, and nothing unverified is
 * passed off as a fresh answer.
 *
 * `checksVersion` (optional): the page's generation counter, which goes up
 * after a successful write on one of its tabs. A read of this tab's own is
 * tagged with it and dropped if it has moved on, so a slow answer cannot
 * replace a newer one for the same episode.
 */
export default function EpisodeProductionChecklist({ episode, showId, onScriptGenerate, onChecks, onOpenTab, initial = null, checksVersion = 0 }) {
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

  // What the loader could read, kept for what the page will show of it.
  const [read, setRead] = useState(null);
  // The episode and the generation on screen now, so an answer that arrives
  // after either moved on is dropped instead of being shown.
  const episodeNow = useRef(episode?.id);
  episodeNow.current = episode?.id;
  const versionNow = useRef(checksVersion);
  versionNow.current = checksVersion;
  // The episode and generation already shown, so the same pair is not read twice.
  const shownFor = useRef(null);
  // Which read is the newest one started here. Two reads of this tab's own can
  // overlap at the same episode and generation — ↻ pressed twice, or pressed
  // while the first read is still out — and their generations match, so only
  // this tells them apart. The newest wins; an older answer is dropped rather
  // than shown after it (Evoni, PR #3949 review item 3).
  const runSeq = useRef(0);

  // Shown, not read: the page's record for this episode and generation. It
  // counts as a read of this tab's own for ordering, so a read already in
  // flight cannot land on top of it afterwards.
  const showRecord = (record) => {
    runSeq.current += 1;
    setLinkedEvent(record.linkedEvent || null);
    setCoverage(record.coverage ?? null);
    setSceneStep(record.sceneStep ?? null);
    setChecks(record.checks || {});
    setNotes(record.notes || {});
    setRead(record.read || null);
    setLoading(false);
    // Deliberately no onChecks: the page gave this record, and a record it
    // already holds must not come back as a freshly verified one.
  };

  const checkReadiness = async () => {
    setLoading(true);
    const forEpisodeId = episode.id;
    const forVersion = versionNow.current;
    runSeq.current += 1;
    const mySeq = runSeq.current;
    const { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep: step, linkedEvent: ev, read: readFrom } = await loadProductionChecks(episode, showId);
    // A read for an episode that has since been left, or from a generation
    // written over while it was in flight, is thrown away: it would be older
    // than what is on screen.
    if (episodeNow.current !== forEpisodeId || versionNow.current !== forVersion) return;
    // A read started after this one is the newer answer, even at the same
    // generation: this one is dropped.
    if (runSeq.current !== mySeq) return;
    setLinkedEvent(ev || null);
    setVersion((v) => v + 1);
    setCoverage(planCoverage);
    setSceneStep(step);
    setChecks(results);
    setNotes(checkNotes);
    setRead(readFrom || null);
    setLoading(false);
    // The page's Production badge follows each re-check.
    // With what the loader could read, the episode these are for and the
    // generation they were read from, so the page never takes them for
    // another episode's or for newer than they are.
    onChecks?.(results, CHECKLIST_SECTIONS, {
      read: readFrom, episodeId: forEpisodeId, version: forVersion,
      notes: checkNotes, coverage: planCoverage, sceneStep: step, linkedEvent: ev,
    });
  };

  // One read per episode and generation — or none at all, where the page's
  // own record is already the answer. ↻ does not come through here: it calls
  // checkReadiness itself, which always reads afresh.
  useEffect(() => {
    if (!episode?.id) return;
    const key = `${episode.id}:${checksVersion}`;
    if (shownFor.current === key) return;
    shownFor.current = key;
    const usable = initial
      && String(initial.episodeId) === String(episode.id)
      && initial.version === checksVersion
      && initial.status === 'ready'
      && initial.checks;
    if (usable) showRecord(initial);
    else checkReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, checksVersion, initial]);

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
      setToast({ msg: adminOnlyMessage(err) || err.response?.data?.error || 'Could not resume setup', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setResuming(false);
    }
  };

  // Each action is offered once on the list: the plan and the script by the
  // footer's Scene Plan and Write Script, the images by their row's Open
  // Scenes, so the next step is words only.

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
                {setupStatus?.steps?.season_slot?.status === 'failed' ? ` · season slot: ${setupStatus.steps.season_slot.reason}` : ''}
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
        <div className="ckh-foot-actions">
          {/* Write Script opens the episode's Script tab (Evoni, 2026-11-15).
              It was locked until every required item here was ticked, and
              opened the older writer page with a page reload. The script has
              no such requirement: the server asks only for the brief
              (POST /episode-brief/:id/generate-script), and the items it
              waited on (the scene plan, wardrobe) come after the script.
              Through onOpenTab it is the page's own tab change, which asks
              before unsaved script edits are left. The older page stays at
              /episodes/:id/script-writer. */}
          <button type="button" data-testid="ckh-write-script"
            onClick={() => (onOpenTab ? onOpenTab('scripts') : navigate(`/episodes/${episode.id}?tab=scripts`))} style={{
              background: 'var(--lala-lavender)', color: 'var(--text-inverse)',
              border: 'none', borderRadius: 10, padding: '11px 20px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            Write Script
          </button>
          {/* In the app, with no page reload. */}
          <button type="button" className="ckh-open" data-testid="ckh-scene-plan" onClick={() => navigate(`/episodes/${episode.id}/plan`)}>Scene Plan</button>
          {/* Episode Run Sheet — producer-facing tracker at /episodes/:id/todo (issue #1605).
              It and Evaluate carry this tab as where they were opened from (PR-05). */}
          <Link className="ckh-open" to={withReturn(`/episodes/${episode.id}/todo`, tabOrigin(episode.id, 'checklist'))}>Episode Run Sheet</Link>
          {/* Final step — Evaluate Episode (issue #1601). */}
          <Link className="ckh-evaluate" to={withReturn(`/episodes/${episode.id}/evaluate`, tabOrigin(episode.id, 'checklist'))}>Evaluate Episode</Link>
        </div>
      </div>
    </div>
  );
}
