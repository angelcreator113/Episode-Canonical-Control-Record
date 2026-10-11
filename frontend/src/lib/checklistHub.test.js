import { describe, test, expect } from 'vitest';
import { timelineGrid, sectionCount, sectionGuideText } from './checklistHub';

const ind = (requirement, met, text = null) => ({ requirement, met, text });
const COVERAGE = {
  covered: 1, total: 3,
  beats: [
    { number: 1, name: 'Opening Ritual', indicators: { environment: ind('per_episode', false), host: ind('required', true, 'Intro clip'), character: ind('not_required', false), interface: ind('not_required', false) } },
    { number: 2, name: 'Login Sequence', indicators: { environment: ind('required', true), host: ind('required', null, 'Clips could not be read'), character: ind('required', false), interface: ind('required', true, 'Login screen') } },
    { number: 8, name: 'Transformation Loop', indicators: { environment: ind('required', false, 'No imaged angle'), host: ind('not_required', false), character: ind('required', false), interface: ind('not_required', false) } },
  ],
};

describe('checklistHub', () => {
  test('a cell per beat per row: ready, missing, decided per episode, not tracked, not used', () => {
    const g = timelineGrid(COVERAGE, { lookReady: false, lookBeat: 8 });
    const row = (k) => g.rows.find((r) => r.key === k).cells.map((c) => c.state);
    expect(g.beats.map((b) => b.number)).toEqual([1, 2, 8]);
    expect(row('environment')).toEqual(['optional', 'ready', 'missing']);
    expect(row('host')).toEqual(['ready', 'untracked', 'unused']);
    expect(row('character')).toEqual(['unused', 'missing', 'missing']);
    expect(row('interface')).toEqual(['unused', 'ready', 'unused']);
    // Lala's look sits in the script's closet beat only (Task #2880).
    expect(row('look')).toEqual(['unused', 'unused', 'missing']);
    expect(timelineGrid(COVERAGE, { lookReady: true, lookBeat: 8 }).rows.find((r) => r.key === 'look').cells[2].state).toBe('ready');
    expect(timelineGrid(COVERAGE, { lookReady: false, lookBeat: 2 }).rows.find((r) => r.key === 'look').cells.map((c) => c.state)).toEqual(['unused', 'missing', 'unused']);
    // A script with no closet beat names no beat: the Look row has no cell.
    expect(timelineGrid(COVERAGE, { lookReady: false }).rows.find((r) => r.key === 'look').cells.map((c) => c.state)).toEqual(['unused', 'unused', 'unused']);
    expect(timelineGrid(null)).toBeNull();
  });

  test("the Wardrobe card names the script's closet beat, and no beat without one", () => {
    expect(sectionGuideText('wardrobe', { closetBeat: 9 })).toBe("Lala's closet and her look for the event. Beat 9 needs it.");
    expect(sectionGuideText('wardrobe')).toBe("Lala's closet and her look for the event.");
    expect(sectionGuideText('scene', { closetBeat: 9 })).toBe('Where each beat happens. Starts from the event’s venue.');
    expect(sectionGuideText('nope')).toBeNull();
  });

  test('a section counts its done items', () => {
    expect(sectionCount({ items: [{ id: 'a' }, { id: 'b' }] }, { a: true })).toEqual([1, 2]);
  });
});
