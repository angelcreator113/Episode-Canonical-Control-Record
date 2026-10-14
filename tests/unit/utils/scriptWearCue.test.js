/**
 * [WEAR: <wardrobe id>] (Task #3180; Evoni, 2026-10-14, Lala's Phone phase 3
 * ruling 1): the script names the piece Lala puts on, by id, at its line.
 * The parser keeps it on the beat; the skeleton writes it when the look is
 * locked, else the text-only select as before.
 */
const { parseScript } = require('../../../src/utils/scriptBeatParser');
const { generateScriptSkeleton } = require('../../../src/utils/scriptSkeletonGenerator');

const ID = '3f1c2b8e-1111-4a2b-9c3d-123456789abc';

describe('the parser reads [WEAR: id]', () => {
  test('each cue with its piece id and line, on its beat', () => {
    const script = [
      '## BEAT: TRANSFORMATION',
      '[UI:OPEN ClosetCategory Outfit]',
      `[WEAR: ${ID}]`,
      'Lala: "Okay, this is the one."',
      '[WEAR:  shoes-42 ]',
      '[MYSTERY: still skipped]',
    ].join('\n');
    const { beats, ui_actions: ui } = parseScript(script);
    expect(beats[0].tags.wear).toEqual([{ piece_id: ID, line: 3 }, { piece_id: 'shoes-42', line: 5 }]);
    expect(ui.map((a) => a.type)).toEqual(['open']);
  });

  test('an older select stays a UI action, and a beat with no cue has no wear tag', () => {
    const { beats, ui_actions: ui } = parseScript('## BEAT: TRANSFORMATION\n[UI:SELECT Item Gold Slip]\n');
    expect(beats[0].tags.wear).toBeUndefined();
    expect(ui).toEqual([expect.objectContaining({ type: 'select', target: 'Item Gold Slip' })]);
  });
});

describe('the skeleton writes [WEAR: id] when the look is locked', () => {
  const event = { name: 'Gala', dress_code: 'formal gown, heels, statement accessories', prestige: 8 };

  test('a segment with a locked piece of its slot wears it by id; one with none keeps the select', () => {
    const look = [
      { id: 'dress-1', name: 'Crimson Gown', clothing_category: 'dress' },
      { id: 'shoe-1', name: 'Satin Pump', clothing_category: 'shoes' },
    ];
    const script = generateScriptSkeleton(event, { look });
    expect(script).toContain('[WEAR: dress-1]');
    expect(script).toContain('[WEAR: shoe-1]');
    // Each piece is put on once.
    expect(script.match(/\[WEAR: dress-1\]/g)).toHaveLength(1);
    // The parser reads what the skeleton writes.
    const worn = parseScript(script).beats.flatMap((b) => b.tags.wear || []).map((w) => w.piece_id);
    expect(worn).toEqual(expect.arrayContaining(['dress-1', 'shoe-1']));
  });

  test('without a look, the skeleton is as before: selects, no wear cue', () => {
    const script = generateScriptSkeleton(event, {});
    expect(script).not.toMatch(/\[WEAR:/);
    expect(script).toMatch(/\[UI:SELECT Item /);
  });

  test('a bag goes to the Bags segment, never to Accessories', () => {
    const script = generateScriptSkeleton({ ...event, dress_code: 'cocktail, statement accessories, evening bag' }, {
      look: [{ id: 'bag-1', name: 'Pearl Clutch', clothing_category: 'clutch' }],
    });
    const lines = script.split('\n');
    const wearAt = lines.findIndex((l) => l === '[WEAR: bag-1]');
    expect(wearAt).toBeGreaterThan(0);
    const segment = lines.slice(0, wearAt).reverse().find((l) => /^\(Segment \d+ — /.test(l));
    expect(segment).toMatch(/Bags/);
    // Accessories kept its select: the bag isn't an accessory segment's piece.
    const accessories = lines.findIndex((l) => /^\(Segment \d+ — Accessories\)/.test(l));
    expect(lines.slice(accessories, accessories + 8).some((l) => /^\[UI:SELECT Item /.test(l))).toBe(true);
  });
});
