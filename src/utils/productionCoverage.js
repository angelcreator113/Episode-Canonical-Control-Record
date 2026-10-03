'use strict';

/**
 * Production coverage (docs/EVENT_EPISODE_FLOW.md §8(o) item 2; Evoni,
 * 2026-10-03, episode creation step 8). Each canonical beat has four
 * independent indicators, each 'required', 'not_required' or 'per_episode':
 *
 *   environment — the Lala's World set (from the beat's own diegetic flag;
 *                 beats 1-2 are 'per_episode', Evoni's answer to §8(o) open
 *                 question 4, 2026-10-03)
 *   host        — a JustAWoman performance clip (actor 'justawoman')
 *   character   — a Lala performance clip (actor 'lala')
 *   interface   — a UI or overlay asset (the beat is presented on Lala's
 *                 Phone or Full Screen, at its start or end)
 *
 * A beat is covered only when every 'required' indicator is met (§8(o)).
 * What is met comes from data that exists (§8(o) item 5; Evoni, 2026-10-03):
 *   environment — the beat's plan row has a set and an imaged angle
 *                 (planLocationsService.planReadiness)
 *   interface   — an overlay placed on the beat (timeline_placements whose
 *                 properties.anchor is 'beat', at properties.beat_number;
 *                 null, "not tracked", when they could not be read)
 *   host, character — a clip attached to the beat for that performer
 *                 (episode_performance_clips, the clip home agreed with this
 *                 step). When the clips could not be read, met is null
 *                 ("not tracked"), never guessed.
 *
 * Pure; no I/O.
 */

const { CANONICAL_BEATS } = require('../constants/canonicalBeats');

const INDICATORS = ['environment', 'host', 'character', 'interface'];
const LABELS = { environment: 'Environment', host: 'JustAWoman clip', character: 'Lala clip', interface: 'Interface' };
const PER_EPISODE_ENVIRONMENT = new Set([1, 2]);
const INTERFACE_SURFACES = new Set(["Lala's Phone", 'Full Screen']);
const UNTRACKED = 'Clips could not be read';
const OVERLAYS_UNTRACKED = 'Overlays could not be read';
const PERFORMER = { host: 'justawoman', character: 'lala' };

const surfacesOf = (s) => (s && typeof s === 'object' ? [s.start, s.end] : [s]);

function beatRequirements(beat) {
  const environment = PER_EPISODE_ENVIRONMENT.has(beat.number)
    ? 'per_episode'
    : (beat.diegetic === true ? 'required' : 'not_required');
  return {
    environment,
    host: beat.actor === 'justawoman' ? 'required' : 'not_required',
    character: beat.actor === 'lala' ? 'required' : 'not_required',
    interface: surfacesOf(beat.surface).some((s) => INTERFACE_SURFACES.has(s)) ? 'required' : 'not_required',
  };
}

/**
 * planRows: the episode's scene_plans rows ({ beat_number, ... });
 * readiness: planReadiness(planRows) ({ not_ready: [{ beat_number, text }] });
 * overlays: beat-anchored placements ({ beat_number, label }), or null
 * when they could not be read;
 * clips: the episode's performance clips ({ canonical_beat_number,
 * performer, label, status }), or null when they could not be read.
 * Returns { beats, required, met, untracked, covered, total, next } where
 * required counts the 'required' indicators, met those met, untracked the
 * required ones nothing can check yet, and next is the first required,
 * trackable, unmet indicator in beat order ({ beat_number, beat_name,
 * indicator, label, text }) or null.
 */
function computeCoverage({ planRows = [], readiness = null, overlays = [], clips = null } = {}) {
  const planned = new Set((planRows || []).map((r) => Number(r.beat_number)));
  const notReady = new Map(((readiness && readiness.not_ready) || []).map((n) => [Number(n.beat_number), n.text]));
  const overlaysByBeat = new Map();
  for (const o of overlays || []) {
    const n = Number(o.beat_number);
    if (!overlaysByBeat.has(n)) overlaysByBeat.set(n, []);
    overlaysByBeat.get(n).push(o.label || 'Overlay');
  }

  const clipAt = new Map();
  for (const c of clips || []) clipAt.set(`${Number(c.canonical_beat_number)}:${c.performer}`, c);

  let required = 0;
  let met = 0;
  let untracked = 0;
  let covered = 0;
  let next = null;
  const beats = CANONICAL_BEATS.map((beat) => {
    const req = beatRequirements(beat);
    const indicators = {};
    for (const key of INDICATORS) {
      let state = null;
      let text = null;
      if (key === 'environment') {
        if (!planned.has(beat.number)) { state = false; text = 'Not in the beat plan'; }
        else if (notReady.has(beat.number)) { state = false; text = notReady.get(beat.number); }
        else { state = true; }
      } else if (key === 'interface') {
        if (overlays === null) {
          text = OVERLAYS_UNTRACKED;
        } else {
          const placed = overlaysByBeat.get(beat.number) || [];
          state = placed.length > 0;
          text = state ? placed.join(', ') : 'No overlay placed on this beat';
        }
      } else if (clips === null) {
        text = UNTRACKED;
      } else {
        const clip = clipAt.get(`${beat.number}:${PERFORMER[key]}`);
        state = !!clip;
        text = clip
          ? `${clip.label || (key === 'host' ? 'JustAWoman clip' : 'Lala clip')}${clip.status === 'approved' ? ' · approved' : ''}`
          : 'No clip attached';
      }
      indicators[key] = { requirement: req[key], met: state, text };
      if (req[key] === 'required') {
        required += 1;
        if (state === true) met += 1;
        else if (state === null) untracked += 1;
        else if (!next) next = { beat_number: beat.number, beat_name: beat.name, indicator: key, label: LABELS[key], text };
      }
    }
    const isCovered = INDICATORS.every((k) => indicators[k].requirement !== 'required' || indicators[k].met === true);
    if (isCovered) covered += 1;
    return { number: beat.number, name: beat.name, indicators, covered: isCovered };
  });

  return { beats, required, met, untracked, covered, total: beats.length, next };
}

module.exports = { INDICATORS, LABELS, PERFORMER, beatRequirements, computeCoverage };
