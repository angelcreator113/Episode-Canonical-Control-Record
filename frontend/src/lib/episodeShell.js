/**
 * The Episode page's header and tabs in the Producer Mode style (Evoni's
 * Episode mock, 2026-10-05). Pure helpers over what the page already reads.
 */

/**
 * How many production checks are still open: the Production tab's
 * "N left" badge. checks is loadProductionChecks' { id: bool }, sections
 * the checklist's CHECKLIST_SECTIONS. Null until the checks are read.
 */
export function checklistLeft(checks, sections) {
  return checklistProgress(checks, sections)?.left ?? null;
}

/** { done, total, left } over the checklist's items; null until read. */
export function checklistProgress(checks, sections) {
  if (!checks || !sections) return null;
  const items = sections.flatMap((s) => s.items || []);
  const done = items.filter((i) => checks[i.id]).length;
  return { done, total: items.length, left: items.length - done };
}

/**
 * Which of the loader's reads each production check is worked out from:
 * the keys of loadProductionChecks' `read` (a key is there only when its
 * read answered and was worked through; a read that answered with nothing
 * is there as null or []). A check with no key here needs no read.
 *
 * "Venue image generated" lists the event only: the venue set's own read
 * answers "no image" when it fails (venueImageGenerated), so a failed read
 * of the set cannot be told from a set with no image.
 */
export const CHECK_READS = {
  arc_position: ['brief'],
  archetype: ['brief'],
  designed_intent: ['brief'],
  narrative_purpose: ['brief'],
  forward_hook: ['brief'],
  event_linked: ['linkedEvent'],
  venue_set: ['linkedEvent'],
  venue_image: ['linkedEvent'],
  invitation_exists: ['linkedEvent'],
  scene_sets: ['sceneSets', 'plan', 'linkedEvent'],
  scene_plan: ['plan'],
  scene_images: ['plan'],
  wardrobe_inventory: ['slotCoverage'],
  wardrobe_ready: ['slotCoverage'],
  outfit_picked: ['outfit'],
  lookbook_ready: ['styleSheet'],
  style_sheet_approved: ['lookbook'],
  overlays_generated: ['overlays'],
  title_overlay: ['episode'],
  overlays_placed: ['placements'],
  social_checklist: ['socialTasks', 'socialAssets'],
  title_generated: [],
  character_state: ['lalaState'],
  show_brain: ['showBrain'],
};

/** The reads that are about the show. With no show they are not made, or cannot answer; that is not a failed read. */
const SHOW_READS = ['linkedEvent', 'slotCoverage', 'lalaState', 'overlays'];

/**
 * The checks three ways, from the loader's `read`: { done, total,
 * incomplete, unreadable, unreadableIds }. A ticked check is done. An
 * unticked one is unreadable when a read it is worked out from has no key
 * in `read`, and incomplete otherwise. Nothing is guessed from an unticked
 * box: with no `read` this is null, and the caller shows the plain count.
 * An item this file has no entry for is counted as incomplete.
 */
export function checklistReadability(checks, sections, read, { hasShow = true } = {}) {
  const progress = checklistProgress(checks, sections);
  if (!progress || !read || typeof read !== 'object') return null;
  const has = (key) => Object.prototype.hasOwnProperty.call(read, key);
  const unreadableIds = sections.flatMap((s) => s.items || [])
    .filter((i) => !checks[i.id])
    .filter((i) => (CHECK_READS[i.id] || []).some((key) => !has(key) && (hasShow || !SHOW_READS.includes(key))))
    .map((i) => i.id);
  return {
    done: progress.done,
    total: progress.total,
    incomplete: progress.left - unreadableIds.length,
    unreadable: unreadableIds.length,
    unreadableIds,
  };
}

/** "1,900 coins", the header's balance chip. */
export function coinsLabel(balance) {
  const n = Number(balance);
  return Number.isFinite(n) ? `${n.toLocaleString()} coins` : null;
}
