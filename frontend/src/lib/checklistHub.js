/**
 * Production → Checklist as a hub (Evoni's Episode mock, 2026-10-05): the
 * episode timeline, a row per kind of piece and a column per beat, and a
 * card per checklist section. Pure helpers over what the page already reads:
 * the production coverage (GET /episode-brief/:id/production-coverage,
 * utils/productionCoverage.js on the server: per canonical beat, whether
 * its set, JustAWoman clip, Lala clip and interface are required and met)
 * and the production checks (loadProductionChecks).
 */

/** The timeline's rows: the coverage's four indicators, and Lala's look (in the script's closet beat). */
export const TIMELINE_ROWS = [
  { key: 'environment', label: 'Scene' },
  { key: 'look', label: 'Look' },
  { key: 'host', label: 'JustAWoman' },
  { key: 'character', label: 'Lala' },
  { key: 'interface', label: 'Phone & overlays' },
];

export const CELL_LEGEND = [
  { state: 'ready', label: 'Ready' },
  { state: 'missing', label: 'Needed, missing' },
  { state: 'optional', label: 'Decided per episode' },
  { state: 'untracked', label: 'Not tracked yet' },
  { state: 'unused', label: 'Not used in this beat' },
];

function cellOf(indicator) {
  if (!indicator || indicator.requirement === 'not_required') return { state: indicator?.met ? 'ready' : 'unused', text: indicator?.text || null };
  if (indicator.met === true) return { state: 'ready', text: indicator.text || null };
  if (indicator.met === null) return { state: 'untracked', text: indicator.text || null };
  if (indicator.requirement === 'per_episode') return { state: 'optional', text: indicator.text || null };
  return { state: 'missing', text: indicator.text || null };
}

/**
 * { beats: [{ number, name }], rows: [{ key, label, cells: [{ state, text }] }], covered, total }
 * from the coverage; null without it. lookReady: an outfit is chosen.
 * lookBeat: the script's closet beat (lib/scriptMoments closetBeat; Task
 * #2880), where the look's cell sits; without one the Look row has none.
 */
export function timelineGrid(coverage, { lookReady = false, lookBeat = null } = {}) {
  const beats = coverage?.beats;
  if (!Array.isArray(beats) || !beats.length) return null;
  const rows = TIMELINE_ROWS.map((row) => ({
    ...row,
    cells: beats.map((b) => {
      if (row.key === 'look') {
        if (!lookBeat || b.number !== lookBeat) return { state: 'unused', text: null };
        return lookReady ? { state: 'ready', text: "Lala's look is chosen" } : { state: 'missing', text: "Lala's look is not chosen" };
      }
      return cellOf(b.indicators?.[row.key]);
    }),
  }));
  return { beats: beats.map((b) => ({ number: b.number, name: b.name })), rows, covered: coverage.covered ?? null, total: coverage.total ?? beats.length };
}

/** What each checklist section is for, and where it is worked on. */
export const SECTION_GUIDE = {
  brief: { text: 'Arc position, archetype, intent, purpose and hook.', open: { label: 'Open Overview', tab: 'overview' } },
  world: { text: 'The event, its venue, the venue image and the invitation.', open: { label: 'Open the event package', event: true } },
  scene: { text: 'Where each beat happens. Starts from the event’s venue.', open: { label: 'Open Scenes', tab: 'scenes' } },
  wardrobe: { text: "Lala's closet and her look for the event.", open: { label: 'Open Wardrobe', tab: 'wardrobe' } },
  lookbook: { text: "The episode's style sheet, ready x of 12, and its status (Draft or Approved).", open: { label: 'Open Style Page', tab: 'lookbook' } },
  overlays: { text: 'Screens Lala looks at during the episode.', open: { label: 'Open Phone', tab: 'phone' } },
  onscreen: { text: 'What sits on top of the video: the title overlay and the overlays placed on the timeline.', open: { label: 'Open Overlays', tab: 'overlays' } },
  social: { text: 'The social checklist and the episode title.', open: { label: 'Open Assets', tab: 'assets' } },
  intelligence: { text: "Lala's state and the Show Brain the script reads.", open: null },
};

/** A section's guide text; Wardrobe's names the script's closet beat when it has one (Task #2880). */
export function sectionGuideText(id, { closetBeat = null } = {}) {
  const guide = SECTION_GUIDE[id];
  if (!guide) return null;
  return id === 'wardrobe' && closetBeat ? `${guide.text} Beat ${closetBeat} needs it.` : guide.text;
}

/** [done, total] for a section's items. */
export function sectionCount(section, checks) {
  const done = section.items.filter((i) => checks?.[i.id]).length;
  return [done, section.items.length];
}
