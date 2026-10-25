/**
 * The Season page's Plants tab (components/Show/SeasonPlants, 2026-10-25):
 * pure helpers over GET /world/:showId/season/twists (services/seasonTwists
 * getTwists). Every twist is a plant: a small detail an episode's script
 * sets up that should pay off later in the season.
 */

export const PLANT_KINDS = ['twist', 'relationship', 'opportunity', 'mystery', 'callback'];
export const KIND_LABEL = { twist: 'Twist', relationship: 'Relationship', opportunity: 'Opportunity', mystery: 'Mystery', callback: 'Callback' };
export const PLANT_STATUS = { planned: 'Not planted yet', planted: 'Planted', paid_off: 'Paid off', dropped: 'Dropped' };

/** Still waiting on its payoff: planned or planted, not paid off or dropped. */
export const isOpen = (t) => t.status === 'planned' || t.status === 'planted';

/**
 * The timeline: each episode that plants something, in season order, with
 * its plants; a plant whose episode is no longer in the season comes last.
 */
export function plantsByEpisode(slots = [], twists = []) {
  const groups = new Map();
  for (const t of twists) {
    const key = t.plant?.id || 'missing';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const bySlot = new Map(slots.map((s) => [s.id, s]));
  return [...groups.entries()]
    .map(([key, plants]) => ({ key, slot: bySlot.get(key) || null, plants }))
    .sort((a, b) => (a.slot?.slot_number ?? Infinity) - (b.slot?.slot_number ?? Infinity));
}

/** Open plants with no payoff episode chosen. */
export const openWithoutPayoff = (twists = []) => twists.filter((t) => isOpen(t) && !t.payoff_slot_id);

/** The counts the tab's summary line reads. */
export function plantCounts(twists = []) {
  return {
    total: twists.filter((t) => t.status !== 'dropped').length,
    open: twists.filter(isOpen).length,
    paidOff: twists.filter((t) => t.status === 'paid_off').length,
    noPayoff: openWithoutPayoff(twists).length,
  };
}

/** The episodes a plant can pay off in: every one after its plant episode. */
export const payoffChoices = (slots = [], t) => slots.filter((s) => t.plant && s.slot_number > t.plant.slot_number);

/** "Episode 6" for a slot shape { slot_number }; null without one. */
export const episodeName = (slot) => (slot ? `Episode ${slot.slot_number}` : null);

/** Where the plant's payoff stands, in plain words. */
export function payoffLine(t) {
  if (t.status === 'paid_off') {
    const where = episodeName(t.paid_off || t.payoff);
    return where ? `Paid off in ${where}` : 'Paid off';
  }
  if (t.status === 'dropped') return 'Dropped — it will not pay off';
  if (t.payoff) return `Planned to pay off in ${episodeName(t.payoff)}`;
  return 'No payoff planned yet';
}
