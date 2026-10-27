'use strict';

/**
 * Where an event's tag goes (A1c R1; Evoni, 2026-10-27, rulings D9, P3 and
 * N6): in its intended beat (Strategic Reaction, else Reveal, else an
 * Interruption: canonical beats 6, 5, 4, 7), found by the header's number or
 * its canonical name, in either header format the app writes. When there is
 * no such beat, or it is approved, or an old tag sits in an approved beat,
 * it is refused. It is never put in another beat or at the top.
 */

const { injectedScript, INTENDED_BEATS } = require('../../../src/routes/worldEvents/inject');
const { splitScriptBeats } = require('../../../src/utils/scriptBeatLocks');

const TAG = '[EVENT: name="Velour Gala" prestige=5]\n';
const TAGS = '[EVENT: name="Velour Gala" prestige=5]\n[LOCATION_HINT: "the garden"]\n';
const place = (script, locks = [], injection = TAG) => injectedScript({ script_content: script, script_locked_beats: locks }, injection);
const refusal = (fn) => { try { fn(); } catch (err) { return err; } throw new Error('expected a refusal'); };
const beatText = (script, n) => splitScriptBeats(script).beats.find((b) => b.number === n)?.text;

const NUMBERED = [
  '## BEAT: 1 · Opening Ritual', 'Lala: "Bestie, come style me."', '',
  '## BEAT: 5 · Reveal', 'Prime: "Reads the invite."', '',
  '## BEAT: 6 · Strategic Reaction', 'Lala: "This is my moment."', '',
  '## BEAT: 8 · Transformation Loop', 'Lala: "Closet time."',
].join('\n');
// As scriptSkeletonGenerator and generate-beats write them.
const NAMED = [
  '## BEAT: OPENING_RITUAL', 'Lala: "Bestie, come style me."', '',
  '## BEAT: INTERRUPTION #1', '[UI:NOTIFICATION MailDing]', '',
  '## BEAT: REVEAL #1', 'Prime: "Reads the invite."', '',
  '## BEAT: STAKES_INTENTION', 'Lala: "This is my moment."', '',
  '## BEAT: TRANSFORMATION', 'Lala: "Closet time."',
].join('\n');

describe('event tag placement', () => {
  test('the preference is the strategic reaction, the reveal, then an interruption', () => {
    expect(INTENDED_BEATS).toEqual([6, 5, 4, 7]);
  });

  test('numbered headers: the tag goes on the lines after beat 6\'s header', () => {
    const out = place(NUMBERED);
    expect(beatText(out, 6)).toBe('## BEAT: 6 · Strategic Reaction\n[EVENT: name="Velour Gala" prestige=5]\nLala: "This is my moment."');
    expect(out.startsWith('## BEAT: 1 · Opening Ritual')).toBe(true);
    expect(beatText(out, 1)).toBe(beatText(NUMBERED, 1));
    expect(beatText(out, 5)).toBe(beatText(NUMBERED, 5));
  });

  test('named headers: the tag goes after STAKES_INTENTION, as it always did', () => {
    const out = place(NAMED, [], TAGS);
    expect(beatText(out, 6)).toBe('## BEAT: STAKES_INTENTION\n[EVENT: name="Velour Gala" prestige=5]\n[LOCATION_HINT: "the garden"]\nLala: "This is my moment."');
    // The old marker rule placed it at the same spot.
    const at = NAMED.indexOf('\n', NAMED.indexOf('## BEAT: STAKES')) + 1;
    expect(out).toBe((NAMED.slice(0, at) + TAGS + NAMED.slice(at)).trim());
  });

  test('header variants the app reads (lower case, a space before the colon, Windows line ends) are found', () => {
    expect(beatText(place(NUMBERED.replace('## BEAT: 6 · Strategic Reaction', '## beat : 6 · Strategic Reaction')), 6)).toContain('[EVENT: name="Velour Gala"');
    const crlf = NAMED.replace(/\n/g, '\r\n');
    const out = place(crlf);
    expect(out).toContain('## BEAT: STAKES_INTENTION\r\n[EVENT: name="Velour Gala" prestige=5]\nLala: "This is my moment."');
  });

  test('without beat 6, the reveal; without either, an interruption (4, then 7)', () => {
    const noStakes = NUMBERED.replace('## BEAT: 6 · Strategic Reaction', '## BEAT: 9 · Reminder');
    expect(beatText(place(noStakes), 5)).toContain('[EVENT: name="Velour Gala"');
    const onlySeven = '## BEAT: 1 · Opening\nA.\n\n## BEAT: 7 · Interruption Pulse 2\nB.';
    expect(beatText(place(onlySeven), 7)).toBe('## BEAT: 7 · Interruption Pulse 2\n[EVENT: name="Velour Gala" prestige=5]\nB.');
  });

  test('a header at the very end still gets the tag in its beat, not at the top', () => {
    const out = place('## BEAT: 1 · Opening\nA.\n\n## BEAT: 6 · Strategic Reaction');
    expect(out).toBe('## BEAT: 1 · Opening\nA.\n\n## BEAT: 6 · Strategic Reaction\n[EVENT: name="Velour Gala" prestige=5]');
  });

  test('the old tags are removed wherever they were (in unlocked beats)', () => {
    const tagged = NUMBERED.replace('Prime: "Reads the invite."', '[EVENT: name="Old"]\nPrime: "Reads the invite."');
    const out = place(tagged);
    expect(out).not.toContain('name="Old"');
    expect(out.match(/\[EVENT:/g)).toHaveLength(1);
  });

  test('a beat numbered only by its place is not the intended beat', () => {
    // Sixth header with an unknown name: numbered 6 by place, but it names no canonical beat.
    const byPlace = ['A', 'B', 'C', 'D', 'E', 'Bonus scene'].map((n) => `## BEAT: ${n}\nLine ${n}.`).join('\n\n');
    expect(refusal(() => place(byPlace)).body).toMatchObject({ code: 'INJECT_NO_INTENDED_BEAT', reason: 'no_intended_beat' });
  });

  describe('refusals', () => {
    test('the intended beat approved (numbered)', () => {
      const err = refusal(() => place(NUMBERED, [6]));
      expect(err.status).toBe(409);
      expect(err.body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'intended_beat_locked', beat_number: 6, beat_label: '6 · Strategic Reaction' });
      expect(err.body.error).toContain('Beat 6 · Strategic Reaction is approved, and that is where this event\'s tag goes.');
    });

    test('the intended beat approved (named)', () => {
      const err = refusal(() => place(NAMED, [6]));
      expect(err.body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'intended_beat_locked', beat_number: 6, beat_label: 'STAKES_INTENTION' });
      expect(err.body.error).toContain('Beat 6 · STAKES_INTENTION is approved');
    });

    test('an approved reveal does not stop a tag going in an unlocked beat 6', () => {
      expect(beatText(place(NUMBERED, [1, 5]), 6)).toContain('[EVENT: name="Velour Gala"');
    });

    test('an old tag in an approved beat, numbered or named', () => {
      const numbered = NUMBERED.replace('Lala: "Bestie, come style me."', '[EVENT: name="Old"]\nLala: "Bestie, come style me."');
      expect(refusal(() => place(numbered, [1])).body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'old_tag_in_locked_beat', beat_number: 1 });
      const named = NAMED.replace('Prime: "Reads the invite."', '[LOCATION_HINT: "old"]\nPrime: "Reads the invite."');
      expect(refusal(() => place(named, [5])).body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'old_tag_in_locked_beat', beat_number: 5, beat_label: 'REVEAL #1' });
    });

    test('no intended beat: refused, never placed at the top', () => {
      const none = '## BEAT: 1 · Opening\nA.\n\n## BEAT: 8 · Transformation Loop\nB.';
      const err = refusal(() => place(none));
      expect(err.body).toMatchObject({ code: 'INJECT_NO_INTENDED_BEAT', reason: 'no_intended_beat', beat_number: null, intended_beats: [6, 5, 4, 7] });
      expect(err.body.error).toContain('beats 6, 5, 4 or 7');
    });

    test('no beat headers, with or without a lock: refused', () => {
      for (const locks of [[], [1]]) {
        expect(refusal(() => place('Lala: "no headers here"', locks)).body).toMatchObject({ code: 'INJECT_NO_INTENDED_BEAT', reason: 'no_beat_headers' });
      }
    });

    test('an empty script: no tag to place and nothing to displace (null: attached, untagged)', () => {
      for (const script of ['', '   \n', null]) expect(place(script)).toBeNull();
      // A lock changes nothing there.
      expect(place('', [1, 6])).toBeNull();
    });
  });

  test('the old markers\' names count too: STAKES, REVEAL, INTERRUPTION (2 is beat 7)', () => {
    expect(place('## BEAT: STAKES\nLala arrives.')).toBe('## BEAT: STAKES\n[EVENT: name="Velour Gala" prestige=5]\nLala arrives.');
    expect(beatText(place('## BEAT: OPEN\nA.\n\n## BEAT: REVEAL - the invite\nB.'), 2)).toContain('[EVENT:');
    const two = place('## BEAT: OPEN\nA.\n\n## BEAT: INTERRUPTION 2\nB.');
    expect(two).toBe('## BEAT: OPEN\nA.\n\n## BEAT: INTERRUPTION 2\n[EVENT: name="Velour Gala" prestige=5]\nB.');
    // A lock is on the beat as locks number it (by place here: STAKES is beat 1).
    expect(refusal(() => place('## BEAT: STAKES\nLala arrives.', [1])).body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'intended_beat_locked', beat_number: 1 });
    expect(place('## BEAT: STAKES\nLala arrives.', [6])).toContain('[EVENT:');
  });
});

