'use strict';

/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"): a whole-script writer keeps each locked beat word for word.
 */

const { splitScriptBeats, normalizeLockedBeats, keepLockedBeats, scriptKeepingLocks, withoutExtraCopies } = require('../../../src/utils/scriptBeatLocks');

const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;
const script = (...beats) => `[EVENT: gala]\n\n${beats.join('\n\n')}`;

describe('scriptBeatLocks', () => {
  test('splits on beat headers, numbering by the header, then by a beat name, otherwise by position', () => {
    const split = splitScriptBeats('intro\n## BEAT: 5 · Reveal\nA\n## BEAT: CLIFFHANGER\nB\n## BEAT: Bonus scene\nC');
    expect(split.preamble).toBe('intro');
    // Script tab audit (2026-10-15): a named header is its canonical beat.
    expect(split.beats).toEqual([
      { number: 5, text: '## BEAT: 5 · Reveal\nA' },
      { number: 14, text: '## BEAT: CLIFFHANGER\nB' },
      { number: 3, text: '## BEAT: Bonus scene\nC' },
    ]);
  });

  test('locked beat numbers are whole numbers 1-14, once each, in order', () => {
    expect(normalizeLockedBeats([5, '2', 2, 0, 15, 3.5, 'x'])).toEqual([2, 5]);
    expect(normalizeLockedBeats(null)).toEqual([]);
  });

  test('regenerating keeps the locked beats word for word and takes the rest from the new script', () => {
    const prev = script(beat(1, 'Opening Ritual', 'Prime: "old one"'), beat(2, 'Login Sequence', 'Lala: "keep me"'), beat(3, 'Welcome', 'old three'));
    const next = script(beat(1, 'Opening Ritual', 'Prime: "new one"'), beat(2, 'Login Sequence', 'Lala: "rewritten"'), beat(3, 'Welcome', 'new three'));
    const out = keepLockedBeats(next, prev, [2]);
    expect(out.script).toBe(script(beat(1, 'Opening Ritual', 'Prime: "new one"'), beat(2, 'Login Sequence', 'Lala: "keep me"'), beat(3, 'Welcome', 'new three')));
    expect(out).toMatchObject({ kept: [2], changed: [2] });
  });

  test('a locked beat the new script dropped goes back after the beat it followed', () => {
    const prev = script(beat(1, 'Opening Ritual', 'a'), beat(2, 'Login Sequence', 'locked'), beat(3, 'Welcome', 'c'));
    const next = script(beat(1, 'Opening Ritual', 'A'), beat(3, 'Welcome', 'C'));
    expect(keepLockedBeats(next, prev, [2]).script).toBe(script(beat(1, 'Opening Ritual', 'A'), beat(2, 'Login Sequence', 'locked'), beat(3, 'Welcome', 'C')));
  });

  test('nothing locked, or a lock with no beat in the old script, leaves the new script exactly as it is', () => {
    const prev = script(beat(1, 'Opening Ritual', 'a'));
    const next = `${script(beat(1, 'Opening Ritual', 'A'))}\n`;
    expect(keepLockedBeats(next, prev, []).script).toBe(next);
    expect(keepLockedBeats(next, prev, [9]).script).toBe(next);
    expect(keepLockedBeats(next, '', [1]).script).toBe(next);
  });

  test('an unchanged locked beat leaves the new script exactly as it is', () => {
    const prev = script(beat(1, 'Opening Ritual', 'same'));
    const next = `${script(beat(1, 'Opening Ritual', 'same'))}\n\n\n`;
    expect(keepLockedBeats(next, prev, [1])).toEqual({ script: next, kept: [1], changed: [] });
  });

  test('scriptKeepingLocks reads the episode row', () => {
    const episode = { script_content: script(beat(4, 'Interruption Pulse 1', 'kept')), script_locked_beats: [4] };
    expect(scriptKeepingLocks(episode, script(beat(4, 'Interruption Pulse 1', 'new'))).script).toBe(script(beat(4, 'Interruption Pulse 1', 'kept')));
    expect(scriptKeepingLocks(null, 'x').script).toBe('x');
  });

  // Script tab re-audit (2026-10-15).
  test('a number held by two beats keeps both approved copies', () => {
    const prev = '## BEAT: 3 · Welcome\nA1\n\n## BEAT: 3 · Welcome\nB1\n\n## BEAT: 4\nC1';
    const next = '## BEAT: 3 · Welcome\nA2\n\n## BEAT: 3 · Welcome\nNEW-B\n\n## BEAT: 4\nC2';
    expect(keepLockedBeats(next, prev, [3])).toEqual({ script: '## BEAT: 3 · Welcome\nA1\n\n## BEAT: 3 · Welcome\nB1\n\n## BEAT: 4\nC2', kept: [3], changed: [3] });
    // A copy the new script dropped goes back after the first.
    expect(keepLockedBeats('## BEAT: 3 · Welcome\nA2\n\n## BEAT: 4\nC2', prev, [3]).script).toBe(prev.replace('C1', 'C2'));
  });

  test('an approved beat numbered by its place goes back with its number written in', () => {
    const prev = '## BEAT: 1 · Opening Ritual\nA\n\n## BEAT: Bonus Scene\nBONUS\n\n## BEAT: Extra\nEXTRA';
    const moved = '## BEAT: 1 · Opening Ritual\nA\n\n## BEAT: 3 · Extra\nEXTRA\n\n## BEAT: 2 · Bonus Scene\nBONUS';
    expect(keepLockedBeats(moved, prev, [2])).toEqual({ script: moved, kept: [2], changed: [] });
    const written = '## BEAT: 1 · Opening Ritual\nA2\n\n## BEAT: 2 · Login Sequence\nNEW\n\n## BEAT: 3 · Welcome\nC2';
    expect(keepLockedBeats(written, prev, [2]).script).toBe('## BEAT: 1 · Opening Ritual\nA2\n\n## BEAT: 2 · Bonus Scene\nBONUS\n\n## BEAT: 3 · Welcome\nC2');
  });

  test('Windows line ends and Markdown-dressed headers are beats, so their locks hold', () => {
    const crlf = '## BEAT: 1 · Opening Ritual\r\nLala: "Hi"\r\n\r\n## BEAT: 2 · Login Sequence\r\nLala: "In"';
    expect(splitScriptBeats(crlf).beats.map((b) => b.number)).toEqual([1, 2]);
    expect(keepLockedBeats('## BEAT: 1 · Opening Ritual\nChanged\n\n## BEAT: 2 · Login Sequence\nNew', crlf, [1]).changed).toEqual([1]);
    expect(splitScriptBeats('**## BEAT: 1 · Opening Ritual**\nx\n### BEAT: 2\ny').beats.map((b) => b.number)).toEqual([1, 2]);
  });

  // Re-audit 2 (2026-10-15).
  test('a beat numbered only by its place is not a copy of the locked beat it lands on', () => {
    const fourteen = Array.from({ length: 14 }, (_, i) => `## BEAT: ${i + 1}\nline ${i + 1}`);
    const prev = [...fourteen, '## BEAT: Extra\nextra line'].join('\n\n');
    const moved = ['## BEAT: Extra\nextra line', ...fourteen].join('\n\n');
    const out = keepLockedBeats(moved, prev, [1]);
    expect(out.script).toContain('extra line');
    expect(out.script.match(/line 1\b/g)).toHaveLength(1);
  });

  test('a number past 14 is the beat\'s own, and odd spaces in a header still make a beat', () => {
    expect(splitScriptBeats('## BEAT: 15 · Extra\nx').beats[0].number).toBe(15);
    expect(splitScriptBeats('\uFEFF## BEAT: 5\ny').beats[0].number).toBe(5);
    const prev = '## BEAT: 1\nLala: "keep me"\n\u00a0## BEAT: 2\nLala: "and me"';
    expect(keepLockedBeats('## BEAT: 1\nLala: "regen"\n## BEAT: 2\nLala: "regen 2"', prev, [1]).script).toContain('keep me');
  });

  // Script page audit (2026-10-19): a writer's reply with two headers for an
  // approved beat kept the second as an extra beat.
  test('a drafted copy of an approved beat beyond the approved count is dropped', () => {
    const prev = script(beat(1, 'Opening Ritual', 'A'), beat(2, 'Login Sequence', 'APPROVED'), beat(3, 'Welcome', 'C'));
    const next = script(beat(1, 'Opening Ritual', 'A2'), beat(2, 'Login Sequence', 'DRAFT ONE'), beat(2, 'Login Sequence', 'DRAFT TWO'), beat(3, 'Welcome', 'C2'));
    const out = keepLockedBeats(next, prev, [2]);
    expect(out.script).toBe(script(beat(1, 'Opening Ritual', 'A2'), beat(2, 'Login Sequence', 'APPROVED'), beat(3, 'Welcome', 'C2')));
    expect(out.changed).toEqual([2]);
    // The approved beat drafted word for word, then again: still one.
    const same = script(beat(1, 'Opening Ritual', 'A2'), beat(2, 'Login Sequence', 'APPROVED'), beat(2, 'Login Sequence', 'APPROVED'), beat(3, 'Welcome', 'C2'));
    expect(keepLockedBeats(same, prev, [2]).script.match(/APPROVED/g)).toHaveLength(1);
  });

  test('two approved copies keep two; a third drafted copy is dropped', () => {
    const prev = script(beat(2, 'Login Sequence', 'FIRST'), beat(2, 'Login Sequence', 'SECOND'));
    const next = script(beat(2, 'Login Sequence', 'x'), beat(2, 'Login Sequence', 'y'), beat(2, 'Login Sequence', 'z'));
    expect(keepLockedBeats(next, prev, [2]).script).toBe(script(beat(2, 'Login Sequence', 'FIRST'), beat(2, 'Login Sequence', 'SECOND')));
  });

  test('withoutExtraCopies keeps as many copies as are counted, and a beat numbered only by its place', () => {
    const text = script(beat(1, 'Opening Ritual', 'A'), beat(1, 'Opening Ritual', 'A again'), beat(2, 'Login Sequence', 'B'));
    expect(withoutExtraCopies(text, new Map([[1, 1]]))).toBe(script(beat(1, 'Opening Ritual', 'A'), beat(2, 'Login Sequence', 'B')));
    expect(withoutExtraCopies(text, new Map([[2, 1]]))).toBe(text);
    const placed = '## BEAT: 1\nA\n\n## BEAT: Bonus\nB\n\n## BEAT: 2\nC';
    expect(withoutExtraCopies(placed, new Map([[2, 1]]))).toBe(placed);
  });
});
