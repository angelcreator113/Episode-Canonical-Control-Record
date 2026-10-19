'use strict';

/**
 * Which to-do list Lala's phone shows at a beat, and what of the deal is
 * delivered by then, on the server (Task #3191; Evoni, 2026-10-14, Lala's
 * Phone phase 3 rulings 3 and 6). The frontend twin is
 * frontend/src/lib/scriptMoments.js (deliverCues, deliveredAt, todoModeAt):
 * the same cues, the same beats (scriptWear.scriptBeats).
 *
 * - `[DELIVER: <deliverable id>]` ticks that deliverable from its line. An id
 *   that isn't one of the event's deliverables ticks nothing. A tick never
 *   changes the deliverable's status; approval stays manual in Money.
 * - `[TODO_MODE: shopping|deal|career]` in a beat sets that beat's list.
 * - Otherwise, by beat: the Shopping list through the closet beat and at
 *   canonical beat 9, which reads the approved list (Script page audit,
 *   2026-10-19); then the deal checklist when the event's terms
 *   are locked to this episode; else the Career list.
 */

const { closetIndex } = require('./scriptWear');

const DELIVER_LINE = /^\s*\[DELIVER:\s*([^\]\s]+)\s*\]\s*$/i;
const TODO_MODE_LINE = /^\s*\[TODO_MODE:\s*([^\]\s]*)\s*\]\s*$/i;
const TODO_MODES = ['shopping', 'deal', 'career'];
// The beat that reads the approved Shopping list (canonicalBeats TODO_LIST).
const SHOPPING_READ_BEAT = (require('../constants/canonicalBeats').CANONICAL_BEATS.find((b) => b.screen_action === 'TODO_LIST') || { number: 9 }).number;

/** Every [DELIVER] cue in order: { beatIndex, lineIndex, id, deliverable (or null) }. */
function deliverCues(beats, deliverables) {
  const byId = new Map((deliverables || []).filter(Boolean).map((d) => [String(d.id), d]));
  const cues = [];
  beats.forEach((beat, beatIndex) => {
    beat.lines.forEach((line, lineIndex) => {
      const m = String(line).match(DELIVER_LINE);
      if (m) cues.push({ beatIndex, lineIndex, id: m[1], deliverable: byId.get(String(m[1])) || null });
    });
  });
  return cues;
}

/** The deliverable ids ticked at or before a beat (its index) and line. */
function deliveredAt(beats, beatIndex, lineIndex, deliverables) {
  const ids = new Set();
  for (const c of deliverCues(beats, deliverables)) {
    if (c.beatIndex > beatIndex || (c.beatIndex === beatIndex && c.lineIndex > lineIndex)) break;
    if (c.deliverable) ids.add(String(c.deliverable.id));
  }
  return ids;
}

/** The beat's own `[TODO_MODE]`, the last valid one in the beat, or null. */
function todoModeCue(beat) {
  let mode = null;
  for (const line of beat?.lines || []) {
    const m = String(line).match(TODO_MODE_LINE);
    if (m && TODO_MODES.includes(m[1].toLowerCase())) mode = m[1].toLowerCase();
  }
  return mode;
}

/** The list shown at a beat (its index): { mode, source: 'cue' | 'auto' }. */
function todoModeAt(beats, beatIndex, { dealLocked = false } = {}) {
  const cue = todoModeCue(beats[beatIndex]);
  if (cue) return { mode: cue, source: 'cue' };
  const closet = closetIndex(beats);
  if (closet >= 0 && beatIndex <= closet) return { mode: 'shopping', source: 'auto' };
  if (beats[beatIndex]?.number === SHOPPING_READ_BEAT) return { mode: 'shopping', source: 'auto' };
  return { mode: dealLocked ? 'deal' : 'career', source: 'auto' };
}

module.exports = { TODO_MODES, deliverCues, deliveredAt, todoModeCue, todoModeAt };
