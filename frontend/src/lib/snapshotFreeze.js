/**
 * The Start snapshot freeze (A1.2a; Evoni's rulings of 2026-11-06), as the
 * pages say it. Once filming begins (the first raw clip), an episode keeps
 * the season context it was started under; the server refuses (409) or
 * skips any change to it and says which. These helpers turn its answers
 * into the page's words. They never decide anything: the server does.
 */

/** The refusal codes the server sends for a filmed episode. */
export const FREEZE_CODES = Object.freeze([
  'EPISODE_SNAPSHOT_FROZEN',
  'START_RECORD_FROZEN',
  'INTENT_EDIT_PENDING_AUDIT',
  'LATE_CONTEXT_NOT_AVAILABLE',
]);

/** True when an API error is one of the freeze refusals. */
export function isFreezeRefusal(err) {
  return FREEZE_CODES.includes(err?.response?.data?.code);
}

/**
 * The note for a save whose snapshot was skipped (snapshot_skipped in the
 * response): "E1 has been filmed: it keeps its Start snapshot; this change
 * applies to the slot." Empty when nothing was skipped.
 */
export function skippedNote(skipped, { applies = 'the slot' } = {}) {
  const list = Array.isArray(skipped) ? skipped : [];
  if (!list.length) return '';
  const names = list.map((s) => s?.label || 'An episode');
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1
    ? `${who} has been filmed: it keeps its Start snapshot; this change applies to ${applies}.`
    : `${who} have been filmed: they keep their Start snapshots; this change applies to ${applies}.`;
}

/** A sentence with the note after it, when there is one. */
export function withSkippedNote(text, skipped, options) {
  const note = skippedNote(skipped, options);
  return note ? `${text} ${note}` : text;
}
