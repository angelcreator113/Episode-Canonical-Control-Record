/**
 * Beat 14's invitation (Script page audit, 2026-10-19): the Script tab and
 * the server read it the same way (src/utils/beat14Invitation.js).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test, expect } from 'vitest';
import { invitationLine, beat14Delivers, beat14Outcome, namesIt } from './beat14Invitation';

const require = createRequire(import.meta.url);

describe('beat14Invitation', () => {
  test('a DM or notification naming it is the invitation; anything else is not', () => {
    expect(invitationLine(['Me: oh', '[UI:DM Sable Reyes: The Sable campaign shoot is yours.]'], 'Sable Campaign Shoot')).toContain('[UI:DM');
    expect(invitationLine(['[UI:POST The Sable campaign shoot]'], 'Sable Campaign Shoot')).toBeNull();
    expect(invitationLine(['[UI:DM Sable Reyes: hi]'], '')).toBeNull();
    expect(namesIt('three quarters: sable campaign spring', 'Sable Spring Campaign Shoot')).toBe(true);
  });
  test('only beat 14 counts', () => {
    const line = '[UI:NOTIFY Sable: The Sable campaign shoot]';
    expect(beat14Delivers([{ number: 13, lines: [line] }], 'Sable Campaign Shoot')).toBe(false);
    expect(beat14Delivers([{ number: 14, lines: [line] }], 'Sable Campaign Shoot')).toBe(true);
  });
  test('held follows the designed intent; expired never comes; offered and after came', () => {
    expect(beat14Outcome(null, 'pass')).toBeNull();
    expect(beat14Outcome({ status: 'held' }, 'pass')).toBe('invitation');
    expect(beat14Outcome({ status: 'held' }, 'fail')).toBe('withheld');
    expect(beat14Outcome({ status: 'expired' }, 'pass')).toBe('withheld');
    expect(beat14Outcome({ status: 'offered' }, 'fail')).toBe('invitation');
    expect(beat14Outcome({ status: 'considering' }, null)).toBe('invitation');
  });
  test('the server has the same code', () => {
    const shared = (text) => text.slice(text.search(/^\/\/ BEGIN SHARED$/m), text.search(/^\/\/ END SHARED$/m));
    const here = readFileSync(require.resolve('./beat14Invitation.js'), 'utf8');
    const there = readFileSync(require.resolve('../../../src/utils/beat14Invitation.js'), 'utf8');
    expect(shared(here).length).toBeGreaterThan(100);
    expect(shared(there)).toBe(shared(here));
  });
});
