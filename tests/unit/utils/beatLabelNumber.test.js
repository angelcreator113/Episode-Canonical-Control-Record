// ============================================================================
// Named beat headers (Script tab audit, 2026-10-15): the skeleton writes
// `## BEAT: OPENING_RITUAL` … `## BEAT: CLIFFHANGER` with no numbers. Each
// name reads as its canonical beat, on the server as on the Script tab.
// ============================================================================

const { beatNumberForLabel } = require('../../../src/utils/beatLabelNumber');
const { splitScriptBeats, keepLockedBeats } = require('../../../src/utils/scriptBeatLocks');
const { scriptBeats } = require('../../../src/utils/scriptWear');

const SKELETON = [
  'OPENING_RITUAL', 'CREATOR_WELCOME', 'INTERRUPTION #1', 'REVEAL #1', 'STAKES_INTENTION',
  'TRANSFORMATION', 'INTERRUPTION #2', 'EVENT_TRAVEL', 'CLIFFHANGER',
].map((name, i) => `## BEAT: ${name}\nMe: line ${i + 1}`).join('\n\n');

describe('beatNumberForLabel', () => {
  test('a number wins; the skeleton names and the canonical names map to their beats', () => {
    expect(beatNumberForLabel('5 · Reveal')).toBe(5);
    expect(beatNumberForLabel('12')).toBe(12);
    expect(beatNumberForLabel('OPENING_RITUAL')).toBe(1);
    expect(beatNumberForLabel('CREATOR_WELCOME')).toBe(2);
    expect(beatNumberForLabel('INTERRUPTION #1')).toBe(4);
    expect(beatNumberForLabel('REVEAL #1')).toBe(5);
    expect(beatNumberForLabel('STAKES_INTENTION')).toBe(6);
    expect(beatNumberForLabel('INTERRUPTION #2')).toBe(7);
    expect(beatNumberForLabel('TRANSFORMATION')).toBe(8);
    expect(beatNumberForLabel('Transformation Loop')).toBe(8);
    expect(beatNumberForLabel('Reminder / Deadline')).toBe(9);
    expect(beatNumberForLabel('EVENT_TRAVEL')).toBe(10);
    expect(beatNumberForLabel('CLIFFHANGER')).toBe(14);
  });

  test('anything else is null', () => {
    expect(beatNumberForLabel('Bonus scene')).toBeNull();
    expect(beatNumberForLabel('')).toBeNull();
    expect(beatNumberForLabel('15 · Extra')).toBeNull();
  });
});

describe('a skeleton script is numbered by its names', () => {
  test('splitScriptBeats and scriptBeats agree', () => {
    const numbers = [1, 2, 4, 5, 6, 8, 7, 10, 14];
    expect(splitScriptBeats(SKELETON).beats.map((b) => b.number)).toEqual(numbers);
    expect(scriptBeats(SKELETON).map((b) => b.number)).toEqual(numbers);
  });

  test('a lock on beat 8 keeps the TRANSFORMATION beat, not the sixth one', () => {
    const edited = SKELETON.replace('Me: line 6', 'Me: changed').replace('Me: line 5', 'Me: also changed');
    const kept = keepLockedBeats(edited, SKELETON, [8]);
    expect(kept.script).toContain('## BEAT: TRANSFORMATION\nMe: line 6');
    expect(kept.script).toContain('Me: also changed');
    expect(kept.kept).toEqual([8]);
  });

  test('a "## BEAT:" inside a line is not a header', () => {
    const text = '## BEAT: 1 · Opening Ritual\nLala: "drop it ## BEAT: now"\n\n## BEAT: 2 · Login Sequence\nMe: hi';
    expect(scriptBeats(text).map((b) => b.number)).toEqual([1, 2]);
    expect(scriptBeats(text)[0].lines).toEqual(['Lala: "drop it ## BEAT: now"']);
  });
});
