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
  scene: { text: 'Where each beat happens. Starts from the event’s venue.', open: { label: 'Open the Scenes plan', tab: 'beatplan' } },
  wardrobe: { text: "Lala's closet and her look for the event.", open: { label: 'Open Wardrobe', tab: 'wardrobe' } },
  lookbook: { text: "The episode's style sheet, ready x of 12, and its status (Draft or Approved).", open: { label: 'Open Style Page', tab: 'lookbook' } },
  overlays: { text: 'Screens Lala looks at during the episode.', open: { label: 'Open Phone', tab: 'phone' } },
  onscreen: { text: 'What sits on top of the video: the title overlay and the overlays placed on the timeline.', open: { label: 'Manage On-Screen Overlays', tab: 'overlays' } },
  social: { text: 'The social checklist and the episode title.', open: { label: 'Manage Social Deliverables', tab: 'overlays' } },
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

// ── Phase 2: the checklist as a command center (Evoni, 2026-11-27) ──
//
// Presentation only. Every fact below comes from an authority that already
// existed: productionSteps for the stages and the current step,
// episodeOverview.nextStep for the recommended action, planReadiness for the
// beat-level problems, computeSectionState for a section, checklistProgress
// for the counts and checklistReadability for what could not be read. Nothing
// here computes readiness, completion or production state of its own.

/**
 * The four stages, as a grouping over the SEVEN existing production steps and
 * the NINE existing checklist sections. Each step key is productionSteps'
 * own; each section id is CHECKLIST_SECTIONS'. No stage has a completion of
 * its own: a stage shows its steps' marks and its sections' counts, and
 * nothing is derived from the grouping itself.
 *
 * Intelligence sits in Plan as a prerequisite, not a stage of its own.
 * Produce and Publish carry one section each because Files, Edit, Thumbnail
 * and Review are steps with no checklist section — which is the point: the
 * band shows them rather than hiding the gap.
 */
export const STAGES = [
  { key: 'plan', label: 'Plan', steps: ['brief'], sections: ['brief', 'world', 'intelligence'] },
  { key: 'prepare', label: 'Prepare', steps: ['script', 'scenes'], sections: ['scene', 'wardrobe', 'lookbook', 'overlays'] },
  { key: 'produce', label: 'Produce', steps: ['files', 'edit'], sections: ['onscreen'] },
  { key: 'publish', label: 'Publish', steps: ['thumbnail', 'publish'], sections: ['social'] },
];

/** [requiredDone, requiredTotal, optionalDone, optionalTotal] for one section. */
export function sectionCounts(section, checks) {
  const required = section.items.filter((i) => i.required);
  const optional = section.items.filter((i) => !i.required);
  const done = (list) => list.filter((i) => checks?.[i.id]).length;
  return [done(required), required.length, done(optional), optional.length];
}

/**
 * Whether a section's optional rows start folded, from the FIRST usable
 * readiness information — never from an empty loading state, which the
 * caller must not ask about. Evoni's rules, 2026-11-27:
 *   required items outstanding        → expanded
 *   every required item done          → collapsed
 *   none required, optional outstanding → expanded
 *   everything done                   → collapsed
 * A section holding an unreadable row is always expanded: an answer that
 * could not be read must stay in sight.
 */
export function optionalStartsFolded(section, checks, unreadableIds = []) {
  const unreadable = new Set(unreadableIds);
  if (section.items.some((i) => unreadable.has(i.id))) return false;
  const [rDone, rTotal, oDone, oTotal] = sectionCounts(section, checks);
  if (rTotal > 0) return rDone === rTotal && oDone === oTotal;
  return oTotal === 0 || oDone === oTotal;
}

/**
 * The beat-level problems planReadiness already reported, split by what they
 * mean, for the summary and for the Scene Plan rows to read the SAME way.
 *
 *   blocking  the beat has no usable location: `locations` (no set at all,
 *             which is what #3948 also reports as an unplaced beat) and
 *             `removed_set` (its set was removed). Wording stays "needs a
 *             usable location": nothing here restricts filming.
 *   advisory  the set is there but its picture is not: `scene_set`. Flagged,
 *             never blocking (L5 Q21, Evoni 2026-10-02).
 *
 * planReadiness pushes at most ONE entry per beat (a single if/else-if chain
 * per row, planLocationsService), so a beat appears once and the counts are
 * beats as well as problems. If that ever reports a beat twice, count unique
 * beat_number instead.
 */
export function beatProblems(readiness) {
  const rows = Array.isArray(readiness?.not_ready) ? readiness.not_ready : [];
  const pick = (kinds) => rows
    .filter((r) => kinds.includes(r.fix?.kind))
    .map((r) => ({ beat: Number(r.beat_number), name: r.beat_name || null, text: r.text, fix: r.fix }))
    .sort((a, b) => a.beat - b.beat);
  const blocking = pick(['locations', 'removed_set']);
  const advisory = pick(['scene_set']);
  return {
    blocking,
    advisory,
    beats: (list) => [...new Set(list.map((p) => p.beat))],
  };
}

/** "beats 4, 6" / "beat 4" — for a sentence about a list of beats. */
export function beatList(beats) {
  const n = beats.length;
  if (!n) return '';
  return `beat${n === 1 ? '' : 's'} ${beats.join(', ')}`;
}
