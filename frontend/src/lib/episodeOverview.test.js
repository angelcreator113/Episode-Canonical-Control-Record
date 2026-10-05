import { describe, test, expect } from 'vitest';
import { briefState, fromEventItems, nextStep, coinsAfter } from './episodeOverview';

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
      title: 'Generate the script', why: "The brief is done. Lala's look can wait, but Beat 8 will need it.", tab: 'scripts',
    });
    expect(nextStep({ hasScript: false, brief: { ...FULL, forward_hook: '' } }).why).toBe('The brief is missing forward hook; the script fills the gap and flags it.');
    expect(nextStep({ hasScript: true, checks: { done: 16, total: 21 } })).toMatchObject({ title: 'Work through production', why: '5 production checks left.', tab: 'checklist' });
    expect(nextStep({ hasScript: true, checks: { done: 21, total: 21 } })).toMatchObject({ tab: 'results' });
  });

  test('coins after the episode add the estimate until it is accepted', () => {
    expect(coinsAfter({ balance: 1900, net: 439 })).toBe(2339);
    expect(coinsAfter({ balance: 1900, net: 439, accepted: true })).toBe(1900);
    expect(coinsAfter({ balance: null, net: 10 })).toBeNull();
  });
});
