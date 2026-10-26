/**
 * [LEARNS: <state> [id]] (Evoni, 2026-10-26, My Little List ruling 3): a
 * cue, never a line. The teleprompter leaves it out, it takes no screen
 * time, an imported script keeps it as an app tag, and the health check
 * flags one My Little List would ignore for its form.
 */
import { describe, test, expect } from 'vitest';
import { lineSeconds } from './scriptRuntime';
import { teleprompterLines } from './teleprompterLines';
import { convertScript } from './scriptImport';
import { learnsCueFlags, LEARNS_STATES } from './scriptMoments';

const LINES = ['Lala: Can I afford this?', '[LEARNS: deal_accepted]', 'Lala: Yes.'];

describe('never read aloud, never timed', () => {
  test('the teleprompter leaves it out, with or without screen moments', () => {
    for (const screen of [false, true]) {
      const out = teleprompterLines(LINES, { screen });
      expect(out.map((l) => l.text)).toEqual(['Can I afford this?', 'Yes.']);
      expect(JSON.stringify(out)).not.toMatch(/LEARNS|deal_accepted/);
    }
  });

  test('no screen time', () => {
    expect(lineSeconds('[LEARNS: deal_accepted]')).toBe(0);
    expect(lineSeconds('[LEARNS: opportunity_discovered opp-1]')).toBe(0);
  });

  test('an imported script keeps it as an app tag: as written, with no "unknown tag" note', () => {
    const { script, notes } = convertScript(['## BEAT: 6 · Strategic Reaction', ...LINES].join('\n'));
    expect(script.split('\n')).toContain('[LEARNS: deal_accepted]');
    expect(notes.some((n) => /LEARNS/.test(n.text))).toBe(false);
  });
});

describe('learnsCueFlags', () => {
  const beat = (...lines) => [{ number: 6, lines }];

  test('the five states, and a well-formed line flags nothing', () => {
    expect(LEARNS_STATES).toEqual(['invitation_received', 'deal_discovered', 'deal_accepted', 'opportunity_discovered', 'opportunity_accepted']);
    expect(learnsCueFlags(beat('[LEARNS: deal_accepted]', '[LEARNS: opportunity_accepted opp-1]', 'Lala: hi'))).toEqual([]);
  });

  test.each([
    ['[LEARNS: deal_signed]', 'unknown_state'],
    ['[LEARNS: opportunity_discovered]', 'no_reference'],
    ['[LEARNS: deal_accepted opp-1]', 'unexpected_reference'],
  ])('%s is flagged %s', (line, flag) => {
    expect(learnsCueFlags(beat('Lala: hm', line))).toEqual([expect.objectContaining({ beatIndex: 0, lineIndex: 1, flag })]);
  });
});
