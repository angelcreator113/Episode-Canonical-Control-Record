/**
 * History / Raw editor audit R9 (2026-10-24): `**Me:** text` and
 * `**Lala**: text` are speaker lines, not narration, and a `---` rule line
 * is a divider, not words.
 */
const { parseScript } = require('../../../src/utils/scriptBeatParser');

const beatOf = (lines) => parseScript(['## BEAT: 1 · Opening Ritual', ...lines].join('\n')).beats[0];

describe('script parser: bold speakers and rule lines', () => {
  test('bold speaker labels are dialogue, with the words as said', () => {
    const beat = beatOf(['[UI:VOICE_ACTIVATE Lala]', '**Me:** Welcome back, besties.', '**Lala**: "Ready to style?"', '__Prime__: Let us go']);
    expect(beat.dialogue_count).toBe(3);
    expect(beat.speakers.sort()).toEqual(['lala', 'prime']);
    expect(beat.word_count).toBe(3 + 3 + 3);
  });

  test('they count the same words as the plain labels', () => {
    const plain = beatOf(['Me: Welcome back, besties.', '[UI:VOICE_ACTIVATE Lala]', 'Lala: "Ready to style?"']);
    const bold = beatOf(['**Me:** Welcome back, besties.', '[UI:VOICE_ACTIVATE Lala]', '**Lala:** "Ready to style?"']);
    expect(bold.word_count).toBe(plain.word_count);
    expect(bold.dialogue_count).toBe(plain.dialogue_count);
  });

  test('a rule line (`---`, `***`, `- - -`) is no words', () => {
    const withRules = beatOf(['Me: Hello there.', '---', '***', '- - -', '___']);
    const without = beatOf(['Me: Hello there.']);
    expect(withRules.word_count).toBe(without.word_count);
    expect(withRules.duration_s).toBe(without.duration_s);
  });

  test('narration with words still counts', () => {
    expect(beatOf(['She walks in -- slowly.']).word_count).toBe(5);
  });
});
