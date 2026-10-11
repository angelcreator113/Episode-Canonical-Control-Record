/**
 * The Episode Overview in the Producer Mode style (Evoni's Episode mock,
 * 2026-10-05): the next step, four tiles, the story brief and what the
 * episode carried from its event. Pure helpers over what the Overview
 * already reads: the brief (GET /episode-brief/:id), the source event's
 * planning items (utils/episodePlanning.js), the production checks
 * (loadProductionChecks) and Lala's balance (GET /world/:showId/balance).
 */

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** The brief's four creative fields: how many are set, and which are missing. */
export const BRIEF_FIELDS = [
  { key: 'episode_archetype', label: 'Archetype' },
  { key: 'designed_intent', label: 'Designed intent' },
  { key: 'narrative_purpose', label: 'Narrative purpose' },
  { key: 'forward_hook', label: 'Forward hook' },
];

export function briefState(brief) {
  if (!brief) return null;
  const missing = BRIEF_FIELDS.filter((f) => !text(brief[f.key]));
  return { complete: missing.length === 0, set: BRIEF_FIELDS.length - missing.length, total: BRIEF_FIELDS.length, missing };
}

// The mock's order, and its names: Location is "Place".
const FROM_EVENT_ORDER = ['event', 'location', 'stakes', 'cast', 'look'];
const FROM_EVENT_LABEL = { event: 'Event', location: 'Place', stakes: 'Stakes', cast: 'Cast', look: 'Look' };

/**
 * "From the event": the planning items in the mock's order, each with where
 * to finish it. Cast with none featured is finished in the Event Package.
 */
export function fromEventItems(plan) {
  if (!plan) return null;
  const byKey = new Map(plan.items.map((i) => [i.key, i]));
  const items = FROM_EVENT_ORDER.map((k) => byKey.get(k)).filter(Boolean).map((i) => {
    let fix = i.fix;
    let fixLabel = null;
    if (i.key === 'cast' && !i.done) { fix = 'package'; fixLabel = 'Choose featured attendees'; }
    else if (fix === 'package') fixLabel = 'Choose in the Event Package';
    else if (fix === 'wardrobe') fixLabel = 'Choose in Wardrobe';
    return { ...i, label: FROM_EVENT_LABEL[i.key] || i.label, fix, fixLabel };
  });
  return { items, ready: items.filter((i) => i.done).length, total: items.length };
}

/**
 * The banner's next step: generate the script while there is none, then
 * work through production; done when every check is. { title, why, action, tab }.
 */
export function nextStep({ hasScript, brief = null, plan = null, checks = null }) {
  const look = plan?.items?.find((i) => i.key === 'look');
  // The beat is the script's closet beat (Task #2880), when it has one.
  const lookLater = look && !look.done
    ? (look.beat ? ` Lala's look can wait, but Beat ${look.beat} will need it.` : " Lala's look can wait.")
    : '';
  if (!hasScript) {
    const b = briefState(brief);
    const why = b && !b.complete
      ? `The brief is missing ${b.missing.map((m) => m.label.toLowerCase()).join(', ')}; the script fills the gap and flags it.`
      : 'The brief is done.';
    return { key: 'script', title: 'Generate the script', why: `${why}${lookLater}`, action: 'Generate Script', tab: 'scripts' };
  }
  if (checks && checks.total > 0 && checks.done >= checks.total) {
    return { key: 'results', title: 'Complete the episode', why: 'Every production check is done.', action: 'Open Results', tab: 'results' };
  }
  const left = checks ? checks.total - checks.done : null;
  return {
    key: 'production',
    title: 'Work through production',
    why: left != null ? `${left} production check${left === 1 ? '' : 's'} left.${lookLater}` : `The script is written.${lookLater}`,
    action: 'Open Production',
    tab: 'checklist',
  };
}

/**
 * The "Coins after episode" tile from the episode's Money plan (Task #1919):
 * its projected balance (Lala's balance now, plus what is pending and
 * planned; a conditional bonus is never counted). The plan prices the
 * event's terms and the chosen look only, so the tile never carries the
 * closet or a fee nobody earned. The note says what the number is:
 *   'outfit not chosen'  no look yet, so no outfit cost is in it;
 *   'estimate'           lines are still planned or pending;
 *   nothing              settled (accepted, or nothing open).
 * `money` is the plan, null while it loads, false when it could not be read.
 */
export function coinsAfterPlan(money, { accepted = false } = {}) {
  if (money === false) return { value: '—', note: 'could not be read' };
  const p = money?.projection;
  const b = Number(p?.projected_balance);
  if (!p || !Number.isFinite(b)) return { value: '—', note: null };
  let note = null;
  if (!accepted && money.look?.pieces === 0) note = 'outfit not chosen';
  else if (!accepted && (p.open_count ?? 0) > 0) note = 'estimate';
  return { value: b.toLocaleString(), note };
}
