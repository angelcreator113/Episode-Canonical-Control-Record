'use strict';

/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"): a whole-script writer keeps each locked beat word for word.
 */

const { splitScriptBeats, normalizeLockedBeats, keepLockedBeats, scriptKeepingLocks } = require('../../../src/utils/scriptBeatLocks');

const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;
const script = (...beats) => `[EVENT: gala]\n\n${beats.join('\n\n')}`;

describe('scriptBeatLocks', () => {
  test('splits on beat headers, numbering by the header and otherwise by position', () => {
    const split = splitScriptBeats('intro\n## BEAT: 5 · Reveal\nA\n## BEAT: CLIFFHANGER\nB');
    expect(split.preamble).toBe('intro');
    expect(split.beats).toEqual([{ number: 5, text: '## BEAT: 5 · Reveal\nA' }, { number: 2, text: '## BEAT: CLIFFHANGER\nB' }]);
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
});
