// ============================================================================
// Canonical beats in script text (episode creation step 7; §8(j)): every
// script beat keeps its canonical number, and the script never invents
// beats. Pure helpers; no database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader, splitCanonicalBeats } = require('../../../src/utils/canonicalScriptBeats');
const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');

const fullScript = () => CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: line for ${b.number}\nLala: reply ${b.number}`).join('\n\n');

describe('beatHeader', () => {
  test('number and canonical name, behind the ## BEAT: prefix the existing readers split on', () => {
    expect(beatHeader(CANONICAL_BEATS[4])).toBe('## BEAT: 5 · Reveal');
    expect(CANONICAL_BEATS.map(beatHeader).every((h) => /^##\s*BEAT:\s*(.+)$/i.test(h))).toBe(true);
  });
});

describe('splitCanonicalBeats', () => {
  test('a complete script: 14 beats in order, each with its own text', () => {
    const r = splitCanonicalBeats(`Preamble ignored\n${fullScript()}`);
    expect(r.complete).toBe(true);
    expect(r.beats.map((b) => b.number)).toEqual(CANONICAL_BEATS.map((b) => b.number));
    expect(r.beats[4]).toMatchObject({ number: 5, name: 'Reveal', text: 'Me: line for 5\nLala: reply 5' });
  });

  test('the canonical name wins over whatever the header says; looser separators still read', () => {
    const r = splitCanonicalBeats('## BEAT: 5 - The Big Reveal\nx\n##BEAT: 6. Strategy\ny');
    expect(r.beats.map((b) => [b.number, b.name])).toEqual([[5, 'Reveal'], [6, 'Strategic Reaction']]);
  });

  test('missing, unknown and out-of-order beats are reported, not filled in', () => {
    const r = splitCanonicalBeats('## BEAT: 2 · Login Sequence\na\n## BEAT: 1 · Opening Ritual\nb\n## BEAT: 15 · Bonus\nc');
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(r.unknown).toEqual([15]);
    expect(r.outOfOrder).toBe(true);
    expect(r.beats.map((b) => b.number)).toEqual([2, 1]);
  });

  test('an old-style script with name-only headers has no canonical beats', () => {
    const r = splitCanonicalBeats('## BEAT: OPENING_RITUAL\nx');
    expect(r.beats).toEqual([]);
    expect(r.missing).toHaveLength(14);
  });
});

describe('buildScriptPrompt (grounded generator)', () => {
  const base = { brief: null, franchiseLaws: [], eventData: null, wardrobeItems: [], lalaStats: null, outfitScore: null };

  test('lists all 14 canonical beats with their headers, in order, even with no plan rows', () => {
    const prompt = buildScriptPrompt({ ...base, scenePlan: [] });
    const at = CANONICAL_BEATS.map((b) => prompt.indexOf(`${beatHeader(b)}\n  Purpose: ${b.narrative_purpose}`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(prompt).toMatch(/Each of the 14 beats opens with its header line, exactly as written above, in order from 1 to 14/);
    expect(prompt).toMatch(/Do not add, merge, rename or skip beats/);
  });

  test('a plan row lands on its own beat by number, and a canonical name replaces a stale one', () => {
    const prompt = buildScriptPrompt({
      ...base,
      scenePlan: [{ beat_number: 8, beat_name: 'CLOSET', sceneSet: { name: 'Lala Closet', scene_type: 'HOME' }, director_note: 'Slow reveal' }],
    });
    const beat8 = prompt.slice(prompt.indexOf('## BEAT: 8 · Transformation Loop'), prompt.indexOf('## BEAT: 9 ·'));
    expect(beat8).toMatch(/Location: Lala Closet \(HOME\)/);
    expect(beat8).toMatch(/Director note: Slow reveal/);
    expect(beat8).toMatch(/UI action: CLOSET_OPEN/);
    expect(prompt).not.toMatch(/BEAT 8: CLOSET/);
    expect(prompt).toMatch(/## BEAT: 1 · Opening Ritual\n {2}Purpose: [^\n]+\n {2}Location: Not planned yet/);
  });
});
