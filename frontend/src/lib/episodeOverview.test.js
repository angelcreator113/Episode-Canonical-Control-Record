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

describe('nextStep: what is not known yet is not guessed', () => {
  test('callers that say nothing about loading get the same steps as before', () => {
    expect(nextStep({ hasScript: false })).toMatchObject({ key: 'script', why: 'The brief is done.', action: 'Generate Script', tab: 'scripts' });
    expect(nextStep({ hasScript: true })).toMatchObject({ key: 'production', why: 'The script is written.', action: 'Open Checklist', tab: 'checklist' });
  });
  test('the script check is still out, or failed: no step is named and there is no button', () => {
    expect(nextStep({ hasScript: false, script: 'loading' })).toMatchObject({ title: 'Checking for a script…', action: null, tab: null });
    expect(nextStep({ hasScript: false, script: 'failed' })).toMatchObject({ title: "Couldn't check for a script", why: 'Retry above to see your next step.', action: null, tab: null });
    // The checklist and the brief are not what this waits for.
    expect(nextStep({ hasScript: false, script: 'loading', checks: { done: 3, total: 3 }, brief: { narrative_purpose: 'x' } }).action).toBeNull();
  });
  test('no script: the button does not wait for the brief; only the sentence does', () => {
    const loading = nextStep({ hasScript: false, briefStatus: 'loading', checksStatus: 'loading' });
    expect(loading).toMatchObject({ key: 'script', title: 'Generate the script', why: 'Checking the brief…', action: 'Generate Script', tab: 'scripts' });
    expect(loading.why).not.toContain('The brief is done');
    expect(nextStep({ hasScript: false, briefStatus: 'failed' }).why).toBe("The brief couldn't be loaded.");
  });
  test('a script, the checklist still out: no step is named and there is no button', () => {
    expect(nextStep({ hasScript: true, checksStatus: 'loading' })).toMatchObject({ title: 'Checking the production checklist…', why: 'The script is written.', action: null, tab: null });
    // The brief still loading changes nothing here.
    expect(nextStep({ hasScript: true, checksStatus: 'loading', briefStatus: 'loading' }).why).toBe('The script is written.');
  });
  test('a script, the checklist failed: said, with the Checklist tab to check again; never "complete"', () => {
    const step = nextStep({ hasScript: true, checksStatus: 'failed' });
    expect(step).toMatchObject({ key: 'production', title: 'Work through production', action: 'Open Checklist', tab: 'checklist' });
    expect(step.why).toContain("couldn't be checked");
  });
  test('once the checks are there they decide, whatever the status said', () => {
    expect(nextStep({ hasScript: true, checks: { done: 2, total: 5 }, checksStatus: 'loading' })).toMatchObject({ key: 'production', why: '3 production checks left.' });
    expect(nextStep({ hasScript: true, checks: { done: 5, total: 5 }, checksStatus: 'ready' })).toMatchObject({ key: 'results', action: 'Open Results' });
    // One check short is never "complete", whatever the reason it is short.
    expect(nextStep({ hasScript: true, checks: { done: 4, total: 5 }, checksStatus: 'ready' }).key).toBe('production');
  });
});
