import { describe, test, expect } from 'vitest';
import { briefState, fromEventItems, nextStep, coinsAfterPlan } from './episodeOverview';

const PLAN = { items: [
  { key: 'event', label: 'Event', done: true, detail: 'Gala', fix: null },
  { key: 'cast', label: 'Cast', done: false, detail: '5 invited, none featured', fix: null },
  { key: 'location', label: 'Location', done: true, detail: 'Studio', fix: null },
  { key: 'look', label: 'Look', done: false, detail: 'Not chosen yet', fix: 'wardrobe' },
  { key: 'stakes', label: 'Stakes', done: true, detail: 'A first credit', fix: null },
] };
const FULL = { episode_archetype: 'Redemption', designed_intent: 'pass', narrative_purpose: 'x', forward_hook: 'y' };

describe('episodeOverview', () => {
  test('the brief is complete with its four fields', () => {
    expect(briefState(FULL)).toMatchObject({ complete: true, set: 4 });
    expect(briefState({ ...FULL, forward_hook: ' ' }).missing.map((m) => m.key)).toEqual(['forward_hook']);
    expect(briefState(null)).toBeNull();
  });

  test('From the event runs Event, Place, Stakes, Cast, Look, with where to finish each', () => {
    const f = fromEventItems(PLAN);
    expect(f.items.map((i) => i.label)).toEqual(['Event', 'Place', 'Stakes', 'Cast', 'Look']);
    expect(f.ready).toBe(3);
    expect(f.items.find((i) => i.key === 'cast')).toMatchObject({ fix: 'package', fixLabel: 'Choose featured attendees' });
    expect(f.items.find((i) => i.key === 'look')).toMatchObject({ fix: 'wardrobe', fixLabel: 'Choose in Wardrobe' });
    expect(fromEventItems(null)).toBeNull();
  });

  test('the next step: the script, then production, then results', () => {
    expect(nextStep({ hasScript: false, brief: FULL, plan: PLAN })).toMatchObject({
      title: 'Generate the script', why: "The brief is done. Lala's look can wait.", tab: 'scripts',
    });
    // The beat is the script's closet beat when the plan has one (Task #2880).
    const withBeat = { ...PLAN, items: PLAN.items.map((i) => (i.key === 'look' ? { ...i, beat: 9 } : i)) };
    expect(nextStep({ hasScript: false, brief: FULL, plan: withBeat }).why).toBe("The brief is done. Lala's look can wait, but Beat 9 will need it.");
    expect(nextStep({ hasScript: false, brief: { ...FULL, forward_hook: '' } }).why).toBe('The brief is missing forward hook; the script fills the gap and flags it.');
    expect(nextStep({ hasScript: true, checks: { done: 16, total: 21 } })).toMatchObject({ title: 'Work through production', why: '5 production checks left.', tab: 'checklist' });
    expect(nextStep({ hasScript: true, checks: { done: 21, total: 21 } })).toMatchObject({ tab: 'results' });
  });

  test('coins after the episode come from the Money plan, never the stored columns (Task #1919)', () => {
    const plan = (over = {}) => ({ projection: { projected_balance: 2300, open_count: 2 }, look: { pieces: 3 }, ...over });
    expect(coinsAfterPlan(plan())).toEqual({ value: '2,300', note: 'estimate' });
    expect(coinsAfterPlan(plan({ look: { pieces: 0 } }))).toEqual({ value: '2,300', note: 'outfit not chosen' });
    expect(coinsAfterPlan(plan({ projection: { projected_balance: 2300, open_count: 0 } }))).toEqual({ value: '2,300', note: null });
    expect(coinsAfterPlan(plan({ look: { pieces: 0 } }), { accepted: true })).toEqual({ value: '2,300', note: null });
    expect(coinsAfterPlan(null)).toEqual({ value: '—', note: null });
    expect(coinsAfterPlan(false)).toEqual({ value: '—', note: 'could not be read' });
  });
});
