import { describe, test, expect } from 'vitest';
import { beatStatus, beatPictures, beatChecklist, beatAssets, piecesWornIn, lineDuration } from './scriptBeatView';

const beat = (over = {}) => ({ id: 'beat-2', number: 2, raw: '## BEAT: 2 · Login Sequence\nLala: "Hi."', lines: ['Lala: "Hi."', '(She waves.)'], approved: false, ...over });

describe('beatStatus', () => {
  test('approved beats are APPROVED, whatever their rows say', () => {
    expect(beatStatus(beat({ approved: true }), [{ key: 'x', ok: false, beatId: 'beat-2' }])).toBe('approved');
  });
  test('a not-OK Ready-to-film row of this beat makes it NEEDS REVISION; another beat\'s does not', () => {
    expect(beatStatus(beat(), [{ key: 'x', ok: false, beatId: 'beat-2' }])).toBe('revision');
    expect(beatStatus(beat(), [{ key: 'x', ok: false, beatId: 'beat-3' }, { key: 'y', ok: true, beatId: 'beat-2' }, { key: 'z', ok: false, beatId: null }])).toBe('draft');
  });
});

describe('beatPictures', () => {
  test('the scene picture first, then the plan\'s other pictures, each once', () => {
    const scene = { image: 'a.png', image_label: 'Home · Window', location: { image: { url: 'a.png' }, angle: { still_image_url: 'b.png' }, look: { image_url: 'c.png' } }, sceneSet: { name: 'Home', base_still_url: 'b.png' } };
    expect(beatPictures(scene)).toEqual([{ url: 'a.png', label: 'Home · Window' }, { url: 'b.png', label: 'Angle' }, { url: 'c.png', label: 'Event look' }]);
    expect(beatPictures(null)).toEqual([]);
  });
});

describe('beatChecklist', () => {
  test('counts the honest basics, this beat\'s rows and the lock', () => {
    const rows = [{ key: 'voice-beat-2', ok: false, beatId: 'beat-2', text: 'Beat 2: Lala talks first.' }, { key: 'reveal', ok: true, beatId: 'beat-2', text: 'Beat 2 ok.' }, { key: 'other', ok: false, beatId: 'beat-9', text: 'no' }];
    const c = beatChecklist(beat(), { healthRows: rows, scene: { scene_set_name: 'Home' }, pictures: [{ url: 'a' }] });
    expect(c.items.map((i) => [i.key, i.ok])).toEqual([
      ['header', true], ['lines', true], ['dialogue', true], ['visual', true], ['location', true],
      ['health-voice-beat-2', false], ['health-reveal', true], ['approved', false],
    ]);
    expect([c.done, c.total]).toEqual([6, 8]);
  });
  test('a beat from a script with no headers, no scene and only actions', () => {
    const c = beatChecklist(beat({ raw: '(She waves.)', lines: ['(She waves.)'], approved: true }));
    expect(c.items.filter((i) => i.ok).map((i) => i.key)).toEqual(['lines', 'approved']);
    expect([c.done, c.total]).toEqual([2, 6]);
  });
});

describe('beatAssets and piecesWornIn', () => {
  test('the location, what is on screen and the pieces worn in the beat', () => {
    const look = [{ id: 'p1', name: 'Gold gown' }, { id: 'p2', name: 'Pearls' }];
    const beats = [{ lines: ['[WEAR: p2]'] }, { lines: ['[WEAR: p1]', '[WEAR: p1]', '[WEAR: nope]'] }];
    const worn = piecesWornIn(beats, 1, look);
    expect(worn.map((p) => p.name)).toEqual(['Gold gown']);
    expect(beatAssets({ scene: { scene_set_name: "Lala's home" }, used: [{ name: 'Invitation letter', kind: 'overlay' }, { name: 'Feed', kind: 'phone' }], worn }).map((a) => `${a.name} (${a.label})`))
      .toEqual(["Lala's home (Location)", 'Invitation letter (Overlay)', 'Feed (Phone screen)', 'Gold gown (Wardrobe)']);
    expect(piecesWornIn(beats, 1, [])).toEqual([]);
  });
});

test('lineDuration: tenths under ten seconds, none for a tag nobody sees', () => {
  expect(lineDuration('(She waves.)')).toBe('3s');
  expect(lineDuration('[WEAR: p1]')).toBeNull();
  expect(lineDuration('Lala: "one two three four five"')).toBe('2s');
  expect(lineDuration('Lala: "one two three four five six seven"')).toBe('2.8s');
});
