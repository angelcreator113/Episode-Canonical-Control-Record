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
    expect(keepLockedBeats(next, prev, [1])).toEqual({ script: next, kept: [1], changed: [], moved: [] });
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
    expect(keepLockedBeats(next, prev, [3])).toEqual({ script: '## BEAT: 3 · Welcome\nA1\n\n## BEAT: 3 · Welcome\nB1\n\n## BEAT: 4\nC2', kept: [3], changed: [3], moved: [] });
    // A copy the new script dropped goes back after the first.
    expect(keepLockedBeats('## BEAT: 3 · Welcome\nA2\n\n## BEAT: 4\nC2', prev, [3]).script).toBe(prev.replace('C1', 'C2'));
  });

  test('an approved beat numbered by its place goes back with its number written in', () => {
    const prev = '## BEAT: 1 · Opening Ritual\nA\n\n## BEAT: Bonus Scene\nBONUS\n\n## BEAT: Extra\nEXTRA';
    const moved = '## BEAT: 1 · Opening Ritual\nA\n\n## BEAT: 3 · Extra\nEXTRA\n\n## BEAT: 2 · Bonus Scene\nBONUS';
    expect(keepLockedBeats(moved, prev, [2])).toEqual({ script: moved, kept: [2], changed: [], moved: [] });
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

  // History / Raw editor audit (2026-10-24).
  describe('R1: a locked beat whose header line was deleted', () => {
    const B1 = beat(1, 'Opening Ritual', 'Prime: "open"');
    const B2 = beat(2, 'Login Sequence', 'Lala: "locked one"\n[UI:CLICK Login]');
    const B3 = beat(3, 'Welcome', 'Prime: "welcome"');
    const prev = script(B1, B2, B3);

    test('its lines, merged into the beat above, are taken out there and the beat goes back once', () => {
      const merged = script(`${B1}\n\nLala: "locked one"\n[UI:CLICK Login]`, B3);
      const out = keepLockedBeats(merged, prev, [2]);
      expect(out.script).toBe(prev);
      expect(out.script.match(/locked one/g)).toHaveLength(1);
      expect(out.changed).toEqual([2]);
    });

    test('the beat above keeps its own edits', () => {
      const merged = script(beat(1, 'Opening Ritual', 'Prime: "open, edited"\nLala: "locked one"\n[UI:CLICK Login]'), B3);
      expect(keepLockedBeats(merged, prev, [2]).script).toBe(script(beat(1, 'Opening Ritual', 'Prime: "open, edited"'), B2, B3));
    });

    test('the first beat, its header deleted, comes out of the lines before the first header', () => {
      const prevFirst = script(B1, B3);
      const merged = `[EVENT: gala]\n\nPrime: "open"\n\n${B3}`;
      const out = keepLockedBeats(merged, prevFirst, [1]);
      expect(out.script).toBe(prevFirst);
      expect(out.script.match(/Prime: "open"/g)).toHaveLength(1);
    });

    test('its lines edited as well stay where they are (nothing matches word for word)', () => {
      const merged = script(`${B1}\n\nLala: "locked one, changed"\n[UI:CLICK Login]`, B3);
      const out = keepLockedBeats(merged, prev, [2]);
      expect(out.script).toBe(script(`${B1}\n\nLala: "locked one, changed"\n[UI:CLICK Login]`, B2, B3));
    });

    test('the same lines elsewhere, or not at the end of the beat above, are left alone', () => {
      const prevOne = script(B1, beat(2, 'Login Sequence', 'Lala: "yes"'), B3);
      const shared = script(beat(1, 'Opening Ritual', 'Lala: "yes"\nPrime: "open"'), beat(3, 'Welcome', 'Lala: "yes"'));
      expect(keepLockedBeats(shared, prevOne, [2]).script).toBe(script(beat(1, 'Opening Ritual', 'Lala: "yes"\nPrime: "open"'), beat(2, 'Login Sequence', 'Lala: "yes"'), beat(3, 'Welcome', 'Lala: "yes"')));
    });

    test('a locked beat simply dropped still goes back after the beat it followed', () => {
      expect(keepLockedBeats(script(B1, B3), prev, [2]).script).toBe(prev);
    });
  });

  describe('R2: a new beat under a locked beat\'s number', () => {
    const B1 = beat(1, 'Opening Ritual', 'A');
    const B2 = beat(2, 'Login Sequence', 'APPROVED');
    const B3 = beat(3, 'Welcome', 'C');
    const prev = script(B1, B2, B3);

    test('a save keeps it, with the first free number past 14, and names it in moved', () => {
      const next = script(B1, B2, beat(2, 'New scene', 'Lala: "brand new"'), B3);
      const out = keepLockedBeats(next, prev, [2], { keepExtras: true });
      expect(out.script).toBe(script(B1, B2, beat(15, 'New scene', 'Lala: "brand new"'), B3));
      expect(out.moved).toEqual([{ from: 2, to: 15, header: '## BEAT: 15 · New scene' }]);
      expect(out.changed).toEqual([]);
    });

    test('it may stand before the approved copy, which is found word for word', () => {
      const next = script(B1, beat(2, 'New scene', 'NEW'), B2, B3);
      const out = keepLockedBeats(next, prev, [2], { keepExtras: true });
      expect(out.script).toBe(script(B1, beat(15, 'New scene', 'NEW'), B2, B3));
      expect(out.moved.map((m) => m.to)).toEqual([15]);
    });

    test('an edited approved beat and a new one: the first is the copy, put back; the second moves', () => {
      const next = script(B1, beat(2, 'Login Sequence', 'EDITED'), beat(2, 'Login Sequence', 'NEW'), B3);
      const out = keepLockedBeats(next, prev, [2], { keepExtras: true });
      expect(out.script).toBe(script(B1, B2, beat(15, 'Login Sequence', 'NEW'), B3));
      expect(out.changed).toEqual([2]);
      expect(out.moved).toEqual([{ from: 2, to: 15, header: '## BEAT: 15 · Login Sequence' }]);
    });

    test('a header by name (`## BEAT: LOGIN_SEQUENCE`) and numbers already past 14 are skipped', () => {
      const next = script(B1, B2, '## BEAT: LOGIN_SEQUENCE\nNEW', beat(15, 'Extra', 'E'), B3);
      const out = keepLockedBeats(next, prev, [2], { keepExtras: true });
      expect(out.script).toBe(script(B1, B2, '## BEAT: 16 · LOGIN_SEQUENCE\nNEW', beat(15, 'Extra', 'E'), B3));
      expect(out.moved).toEqual([{ from: 2, to: 16, header: '## BEAT: 16 · LOGIN_SEQUENCE' }]);
    });

    test('a writer\'s reply (no keepExtras) still drops it', () => {
      const next = script(B1, B2, beat(2, 'New scene', 'NEW'), B3);
      const out = keepLockedBeats(next, prev, [2]);
      expect(out.script).toBe(prev);
      expect(out.moved).toEqual([]);
    });
  });

  describe('R3: a locked beat with its header renamed or renumbered', () => {
    const B1 = beat(1, 'Opening Ritual', 'A');
    const B2 = beat(2, 'Login Sequence', 'Lala: "approved"\n[UI:CLICK Login]');
    const B3 = beat(3, 'Welcome', 'C');
    const prev = script(B1, B2, B3);

    test('renumbered: its header is put back in place, no second copy', () => {
      const next = script(B1, beat(3, 'Login Sequence', 'Lala: "approved"\n[UI:CLICK Login]'), B3);
      const out = keepLockedBeats(next, prev, [2]);
      expect(out.script).toBe(prev);
      expect(out.script.match(/approved/g)).toHaveLength(1);
      expect(out.changed).toEqual([2]);
    });

    test('renamed to a header that names no beat: put back in place', () => {
      const next = script(B1, '## BEAT: Logging in\nLala: "approved"\n[UI:CLICK Login]', B3);
      expect(keepLockedBeats(next, prev, [2]).script).toBe(prev);
    });

    test('moved and renumbered: put back where it now stands', () => {
      const next = script(B1, B3, beat(9, 'Later', 'Lala: "approved"\n[UI:CLICK Login]'));
      expect(keepLockedBeats(next, prev, [2]).script).toBe(script(B1, B3, B2));
    });

    test('renumbered onto another locked beat: each is found by its own lines', () => {
      const next = script(B1, beat(3, 'Login Sequence', 'Lala: "approved"\n[UI:CLICK Login]'), B3);
      const out = keepLockedBeats(next, prev, [2, 3], { keepExtras: true });
      expect(out.script).toBe(prev);
      expect(out.moved).toEqual([]);
    });

    test('an empty locked beat is not matched by its (empty) lines', () => {
      const prevEmpty = script(B1, '## BEAT: 2 · Login Sequence', B3);
      const next = script(B1, '## BEAT: 7 · Other', B3);
      expect(keepLockedBeats(next, prevEmpty, [2]).script).toBe(script(B1, '## BEAT: 2 · Login Sequence', '## BEAT: 7 · Other', B3));
    });

    test('scriptKeepingLocks passes keepExtras on', () => {
      const episode = { script_content: prev, script_locked_beats: [2] };
      const out = scriptKeepingLocks(episode, script(B1, B2, beat(2, 'New', 'N'), B3), { keepExtras: true });
      expect(out.moved).toHaveLength(1);
    });
  });
});
