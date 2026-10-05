/**
 * Producer Mode → Episodes → Season Arc (Evoni's redesign, 2026-10-05): the
 * season's 24 slots as a grid by part, one slot open beside it. Pure helpers
 * over GET /world/:showId/season/roadmap (seasonSlotService.getRoadmap).
 */

/** "S1 · E7" → "E7": the tile shows the episode number, the panel the full label. */
export function shortSlotLabel(slot) {
  return `E${slot.slot_number}`;
}

/** What a slot holds, for its tile and panel: the episode, else the event, else the idea (its primary purpose). */
export function slotTitle(slot) {
  return slot?.episode?.title || slot?.event?.name || slot?.intention?.story_purpose || null;
}

/** The story threads a slot moves: every purpose's thread, then the slot's own, once each. */
export function slotThreads(slot) {
  const seen = new Map();
  for (const p of slot?.intention?.story_purposes || []) {
    if (p?.story_thread?.id && !seen.has(p.story_thread.id)) seen.set(p.story_thread.id, p.story_thread);
  }
  const own = slot?.intention?.story_thread;
  if (own?.id && !seen.has(own.id)) seen.set(own.id, own);
  return [...seen.values()];
}

/** The slot to open first: the one in production, else the next open one, else the first. */
export function defaultSlotId(roadmap) {
  const slots = (roadmap?.phases || []).flatMap((p) => p.slots || []);
  const producing = slots.find((s) => s.state === 'in_production');
  const next = slots.find((s) => s.slot_number === roadmap?.next_slot_number);
  return (producing || next || slots[0])?.id || null;
}

/** The line beside the season's name: "1 in production · 3 pencilled · 24 slots". */
export function arcSummary(roadmap) {
  const counts = roadmap?.counts || {};
  const parts = [];
  if (counts.done) parts.push(`${counts.done} done`);
  parts.push(`${counts.in_production || 0} in production`);
  parts.push(`${counts.event_ready || 0} pencilled`);
  parts.push(`${roadmap?.slot_count ?? 0} slots`);
  return parts.join(' · ');
}
