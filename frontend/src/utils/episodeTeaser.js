/**
 * Episode viewer teaser helpers (Task #2386; Evoni's P12, 2026-09-30): the
 * teaser is mystery-driven, never reveals the outcome, and puts the hook in
 * the first 150 characters. Start Episode auto-drafts it and keeps a saved
 * copy in teaser_drafted, so doctrine rule 14's label reads Auto-drafted
 * while the teaser still equals that copy and Edited once it differs.
 *
 * Mirrors src/utils/episodeTeaser.js (teaserStateOf, TEASER_HOOK_CHARS).
 */
export const TEASER_HOOK_CHARS = 150;
export const TEASER_DRAFT_SOURCE = 'from event';

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** 'missing' | 'auto_drafted' | 'edited' | 'set' */
export function teaserStateOf(episode) {
  const teaser = text(episode?.teaser);
  const drafted = text(episode?.teaser_drafted);
  if (!teaser) return 'missing';
  if (!drafted) return 'set';
  return teaser === drafted ? 'auto_drafted' : 'edited';
}

/** The rule 14 label for a state, or null for a plain set value. */
export function teaserStateLabel(state) {
  if (state === 'auto_drafted') return `Auto-drafted · ${TEASER_DRAFT_SOURCE}`;
  if (state === 'edited') return 'Edited';
  if (state === 'missing') return 'Missing';
  return null;
}

/** Splits text at the hook boundary: { hook, rest }. */
export function splitTeaserHook(value) {
  const s = typeof value === 'string' ? value : '';
  return { hook: s.slice(0, TEASER_HOOK_CHARS), rest: s.slice(TEASER_HOOK_CHARS) };
}

/** Counter copy for the editor, e.g. "212 characters · hook 150/150". */
export function teaserCounter(value) {
  const n = typeof value === 'string' ? value.length : 0;
  return `${n} character${n === 1 ? '' : 's'} · hook ${Math.min(n, TEASER_HOOK_CHARS)}/${TEASER_HOOK_CHARS}`;
}
