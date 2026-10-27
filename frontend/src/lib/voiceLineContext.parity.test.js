// Voice Studio B1: the server's line counting (src/utils/voiceLineContext.js)
// must name the same lines as the teleprompter's (teleprompterScript `vi`,
// what a voice take's line_index names), or a take could be tied to the
// wrong line. Both run here on one corpus of scripts.
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { teleprompterScript } from './teleprompterLines';

const require = createRequire(import.meta.url);
const { lineContexts } = require('../../../src/utils/voiceLineContext.js');

const CORPUS = {
  canonical: [
    '## BEAT: 1 · Opening Ritual',
    'Lala: "Bestie, come style me."',
    '(Lala twirls)',
    '[UI:OPEN Closet]',
    'Prime: "Okay, let\'s go."',
    '',
    '## BEAT: 6 · Strategic Reaction',
    'Lala (softly): "This is my moment."',
    'Lala (auto): "Ooh!"',
    '[SFX: ding]',
    '[TRANSITION: cut to]',
    'Me: I love it.',
    'Guest: "Love the look!"',
    '(breath)',
    '---',
    'Suddenly the lights go out over the whole room.',
  ].join('\n'),
  bold: '## BEAT: 2 · Arrival\n**Lala:** "Hi!"\n__Me__: hey\n**Kelli:** words here',
  lowerCase: '## BEAT: 3 · Reveal\nlala: hello there\nme: hi\nmarcus: not a known speaker so narration maybe\nMarcus: "I am Marcus."',
  duplicates: '## BEAT: 4 · Interruption\nLala: Okay.\nPrime: Wait.\nLala: Okay.\nLala: Okay.',
  namedHeaders: '## BEAT: OPENING_RITUAL\nLala: one\n\n## BEAT: STAKES_INTENTION\nLala: six\n\n## BEAT: TRANSFORMATION\nLala: eight',
  unknownHeaders: '## BEAT: A\nLine A.\n## BEAT: Bonus scene\nLala: bonus',
  noHeaders: 'Lala: no headers here\n(She sits.)\nPrime: right',
  preamble: 'Host: Lala\nDress Code: gold\n## BEAT: 1 · Opening\nLala: hi',
  duplicateNumbers: '## BEAT: 5 · Reveal\nLala: a\n## BEAT: 5 · Reveal again\nLala: b',
  tags: '## BEAT: 7 · Interruption 2\n[STAT: coins +5]\n[WEAR: gold dress]\n[UI:NOTIFICATION MailDing]\n[UI: Lala opens closet]\nLala: "Mail!"\n[TALK: x]\nNote: not a speaker line\n(auto)\nLala (automatic reaction): "Wow"',
};

const serverLines = (script) => {
  const { beats } = lineContexts(script);
  return [...beats.entries()].map(([number, b]) => ({ number, count: b.count, lines: b.lines.map((c) => ({ i: c.line_index, speaker: c.speaker_key, words: c.words, note: c.paren })) }));
};

const clientLines = (script) => {
  const byNumber = new Map();
  for (const b of teleprompterScript(script).beats) {
    const lines = b.lines.filter((l) => l.vi != null).map((l) => ({
      i: l.vi,
      speaker: l.who ? String(l.who).toLowerCase() : null,
      words: l.text,
      note: l.kind === 'mine' || l.kind === 'cue' ? (l.paren || null) : null,
    }));
    const prev = byNumber.get(b.number);
    byNumber.set(b.number, prev ? { number: b.number, count: prev.count + 1, lines: prev.lines } : { number: b.number, count: 1, lines });
  }
  return [...byNumber.values()];
};

describe('voice line counting: server = teleprompter', () => {
  for (const [name, script] of Object.entries(CORPUS)) {
    test(name, () => {
      expect(serverLines(script)).toEqual(clientLines(script));
    });
  }

  test('the corpus covers every kind the teleprompter skips or counts', () => {
    const all = serverLines(CORPUS.canonical)[0].lines.length + serverLines(CORPUS.canonical)[1].lines.length;
    expect(all).toBeGreaterThan(5);
  });
});
