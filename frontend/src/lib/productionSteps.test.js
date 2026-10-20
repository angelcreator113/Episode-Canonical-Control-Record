import { describe, test, expect } from 'vitest';
import { productionSteps, sectionDone, linkedScenes, sectionSummary, canMarkReady, takesStat, SCENE_COUNT } from './productionSteps';

const SECTIONS = [
  { id: 'brief', label: 'Episode Brief', items: [{ id: 'a', required: true }, { id: 'b', required: false }] },
  { id: 'world', label: 'Event & Venue', items: [{ id: 'c', required: true }] },
  { id: 'scene', label: 'Scene Plan', items: [{ id: 'd' }, { id: 'e' }] },
];

describe('sectionDone', () => {
  test('required items decide; a section with none needs every item', () => {
    expect(sectionDone(SECTIONS, { a: true }, 'brief')).toBe(true);
    expect(sectionDone(SECTIONS, { d: true }, 'scene')).toBe(false);
    expect(sectionDone(SECTIONS, { d: true, e: true }, 'scene')).toBe(true);
    expect(sectionDone(SECTIONS, null, 'brief')).toBe(false);
    expect(sectionDone(SECTIONS, { a: true }, 'nope')).toBe(false);
  });
});

describe('linkedScenes', () => {
  test('counts each linked scene once and ignores unlinked clips', () => {
    expect([...linkedScenes([{ beat_number: 3 }, { beat_number: 3 }, { beat_number: null }, { beat_number: 14 }])]).toEqual([3, 14]);
  });
});

describe('productionSteps', () => {
  test('a new episode: nothing done, Event & Brief is current, each step knows where it opens', () => {
    const steps = productionSteps({ episode: { id: 'ep-1', status: 'draft' }, sections: SECTIONS, checks: {} });
    expect(steps.map((s) => s.label)).toEqual(['Event & Brief', 'Script', 'Scenes', 'Files', 'Edit & Assemble', 'Thumbnail', 'Review & Publish']);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.filter((s) => s.current).map((s) => s.key)).toEqual(['brief']);
    expect(steps.find((s) => s.key === 'edit').open).toEqual({ href: '/episodes/ep-1/timeline' });
    expect(steps.find((s) => s.key === 'thumbnail').open).toEqual({ href: '/template-studio/youtube?episode=ep-1' });
    expect(steps.find((s) => s.key === 'publish').open).toEqual({ tab: 'distribution' });
  });

  test('done steps follow the checks, the script, the clips, the thumbnail and the status', () => {
    const clips = Array.from({ length: SCENE_COUNT }, (_, i) => ({ beat_number: i + 1 }));
    const steps = productionSteps({
      episode: { id: 'ep-1', status: 'in_build', script_content: 'INT. BEDROOM' },
      sections: SECTIONS, checks: { a: true, c: true, d: true, e: true }, clips, hasThumbnail: true,
    });
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['brief', 'script', 'scenes', 'files', 'edit', 'thumbnail']);
    expect(steps.find((s) => s.current).key).toBe('publish');
    expect(steps.find((s) => s.key === 'files').detail).toBe('14 clips');
  });

  test('part-linked scenes say how many; In review finishes the last step', () => {
    const steps = productionSteps({ episode: { id: 'e', status: 'in_review' }, clips: [{ beat_number: 1 }, { beat_number: 2 }] });
    expect(steps.find((s) => s.key === 'edit')).toMatchObject({ done: false, detail: '2 of 14 scenes have a clip' });
    expect(steps.find((s) => s.key === 'script').done).toBe(true);
    expect(steps.find((s) => s.key === 'publish').done).toBe(true);
  });
});

// Evoni, 2026-10-19: "script is being marked completed before it's finished".
describe('the Script step', () => {
  const ALL = Array.from({ length: 14 }, (_, i) => i + 1);
  const step = (episode) => productionSteps({ episode: { id: 'e', status: 'draft', ...episode } }).find((s) => s.key === 'script');
  test('a written script is not done until every beat is approved', () => {
    expect(step({ script_content: '## BEAT: 1 · Opening Ritual\nMe: hi' })).toMatchObject({ done: false, detail: '0 of 14 beats approved', current: false });
    expect(step({ script_content: 'x', script_locked_beats: [1, 2, 3] })).toMatchObject({ done: false, detail: '3 of 14 beats approved' });
  });
  test('done when all 14 beats are approved, saved as numbers or as JSON text', () => {
    expect(step({ script_content: 'x', script_locked_beats: ALL })).toMatchObject({ done: true, detail: null });
    expect(step({ script_content: 'x', script_locked_beats: JSON.stringify(ALL) }).done).toBe(true);
  });
  test('no script: not done and no count; status past Draft still counts as done', () => {
    expect(step({})).toMatchObject({ done: false, detail: null });
    expect(step({ status: 'scripted' }).done).toBe(true);
  });
});

describe('sectionSummary and canMarkReady', () => {
  test('each section with its count', () => {
    expect(sectionSummary(SECTIONS, { a: true, d: true })).toEqual([
      { id: 'brief', label: 'Episode Brief', done: true, count: 1, total: 2 },
      { id: 'world', label: 'Event & Venue', done: false, count: 0, total: 1 },
      { id: 'scene', label: 'Scene Plan', done: false, count: 1, total: 2 },
    ]);
  });

  test('Mark Ready until In review', () => {
    expect(canMarkReady({ status: 'in_build' })).toBe(true);
    expect(canMarkReady({ status: 'in_review' })).toBe(false);
    expect(canMarkReady({})).toBe(true);
  });
});

describe('takesStat (Teleprompter batch 2)', () => {
  test('counts the beats 1-14 with at least one take; it rides on the Files step', () => {
    expect(takesStat([])).toBe('Takes: 0 of 14 beats');
    expect(takesStat([{ beat_number: 8 }, { beat_number: 8 }, { beat_number: 15 }, { beat_number: null }, { beat_number: '3' }])).toBe('Takes: 2 of 14 beats');
    const steps = productionSteps({ episode: { id: 'ep-1' }, clips: [{ beat_number: 4 }] });
    expect(steps.find((s) => s.key === 'files').stat).toBe('Takes: 1 of 14 beats');
    expect(steps.filter((s) => s.stat).map((s) => s.key)).toEqual(['files']);
  });
});
