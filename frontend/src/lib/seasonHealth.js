/**
 * The Season page's one-line health summary under the hero (Evoni,
 * 2026-10-25: "What else can we improve on the Season page?" … "I want them
 * all"; 2026-10-26, round 3). Plain counting, in words:
 *
 *   "On track · Part 1 is 6 of 8 ready · 2 goals behind · next release Sun, Nov 1"
 *
 * Every piece is read from what the page already has: the part in progress
 * and its slots (the roadmap), the goals behind (the goal coverage), the
 * next release (lib/releaseSchedule nextReleaseOf) and the tone from "Needs
 * attention" (lib/seasonAttention attentionItems). Nothing is fetched here.
 *
 * The tone chip, by one rule:
 *   Behind           an episode is past its release date and not out (a
 *                    Needs attention item of tone 'overdue').
 *   Needs attention  nothing is late, but something is due soon or holds up
 *                    the part in progress (an item of tone 'soon': a release
 *                    within three days, a held offer whose episode is done,
 *                    an empty slot or a goal nothing moves in the part in
 *                    progress), or a goal is behind.
 *   On track         neither.
 *   Season complete  a finished season (from the switcher) says so instead.
 *
 * "Ready" is a slot with an event or an episode in it (any state but Open).
 * A goal is behind when it is being worked on and nothing in the part in
 * progress moves it (the coverage's part gaps, goal ladders' active rungs
 * only), or when it is a stat to keep down that is over its target
 * (off_track, e.g. stress).
 */
import { allSlots } from './seasonPage';
import { goalGaps } from './seasonAttention';
import { nextReleaseOf, todayIso } from './releaseSchedule';

export const HEALTH_TONES = {
  on_track: 'On track',
  attention: 'Needs attention',
  behind: 'Behind',
  complete: 'Season complete',
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The goals behind (see the file comment): [{ id, title }], each once. */
export function goalsBehind(coverage, { arc = null } = {}) {
  if (!coverage) return null;
  const out = new Map();
  for (const part of goalGaps(coverage, { arc }).filter((p) => p.current)) {
    for (const g of part.gaps) out.set(String(g.goal_id ?? g.title), { id: g.goal_id ?? null, title: g.title });
  }
  for (const g of coverage.goals || []) {
    if (g.off_track) out.set(String(g.id), { id: g.id, title: g.title });
  }
  return [...out.values()];
}

/** The part in progress and how many of its slots are ready: { phase, title, ready, total } or null. */
export function partReadiness(roadmap, arc = null) {
  const now = Number(arc?.current_phase ?? roadmap?.arc?.current_phase) || 1;
  const phase = (roadmap?.phases || []).find((p) => Number(p.phase) === now);
  if (!phase) return null;
  const slots = phase.slots || [];
  return { phase: now, title: phase.title || null, ready: slots.filter((s) => s.state && s.state !== 'needs_event').length, total: slots.length };
}

/** The tone by the rule above. */
export function healthTone({ attention = [], behind = [], complete = false } = {}) {
  if (complete) return 'complete';
  if ((attention || []).some((i) => i.tone === 'overdue')) return 'behind';
  if ((attention || []).some((i) => i.tone === 'soon') || (behind || []).length > 0) return 'attention';
  return 'on_track';
}

/**
 * The line: { tone, label, pieces: [{ key, text }], text }. isCurrent false
 * (a past season) leaves out the goals, which are the show's, not kept per
 * season.
 */
export function seasonHealth({ arc = null, roadmap = null, coverage = null, release = null, attention = [], isCurrent = true, today = todayIso() } = {}) {
  const complete = arc?.status === 'completed';
  const behind = isCurrent ? goalsBehind(coverage, { arc }) : null;
  const tone = healthTone({ attention, behind: behind || [], complete });
  const pieces = [];

  if (complete) {
    const slots = allSlots(roadmap);
    const done = slots.filter((s) => s.state === 'done').length;
    if (slots.length) pieces.push({ key: 'part', text: done === slots.length ? (slots.length === 1 ? 'The episode is done' : `All ${slots.length} episodes done`) : `${done} of ${slots.length} episodes done` });
  } else {
    const part = partReadiness(roadmap, arc);
    if (part) pieces.push({ key: 'part', text: `Part ${part.phase} is ${part.ready} of ${part.total} ready` });
  }

  if (behind) pieces.push({ key: 'goals', text: behind.length ? `${plural(behind.length, 'goal')} behind` : 'no goals behind' });

  // A finished season has no next release to name.
  const seasonNumber = roadmap?.season_number ?? arc?.season_number ?? null;
  const next = complete ? null : nextReleaseOf(release, seasonNumber, today);
  if (next?.state === 'next') {
    pieces.push({ key: 'release', text: next.overdue ? `${next.code || 'an episode'} was due ${next.text}` : `next release ${next.text}` });
  } else if (next) {
    pieces.push({ key: 'release', text: next.text === 'Paused' ? 'releases paused' : next.text.charAt(0).toLowerCase() + next.text.slice(1) });
  }

  const label = HEALTH_TONES[tone];
  return { tone, label, pieces, text: [label, ...pieces.map((p) => p.text)].join(' · ') };
}
