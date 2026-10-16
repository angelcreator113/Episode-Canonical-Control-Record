// Phone paths (Evoni, 2026-10-16): before a tap the phone can't make from
// where it is, a step to the icon's screen. The phone here is shaped like
// the show's: Messages, the wallet and the closet on Homepage; the outfit
// inside the closet.
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { phoneIcons, phoneCheck } from './scriptMoments';
import { beatWithPhonePaths, scriptWithPhonePaths } from './phonePaths';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/phonePaths.js');

const screens = [
  { id: 'homepage', name: 'Homepage', is_home: true, screen_links: [
    { label: 'Messages Icon', target: 'messages_page' }, { label: 'wallet', target: 'bank_page' }, { label: 'Closet Icon', target: 'closet' },
  ] },
  { id: 'messages_page', name: 'Messages Page' },
  { id: 'bank_page', name: 'Bank Page' },
  { id: 'closet', name: 'closet', screen_links: [{ label: 'Outfit Icon', target: 'outfit_page' }] },
  { id: 'outfit_page', name: 'Outfit Page' },
];
const on = { screens, icons: phoneIcons(screens), overlays: [] };

describe('beatWithPhonePaths', () => {
  test('a Homepage tap from another screen goes home first', () => {
    const out = beatWithPhonePaths(['Me: "Something came in."', '[UI:CLICK Messages Icon]'], on, { startAt: 'closet' });
    expect(out.lines).toEqual(['Me: "Something came in."', '[UI:OPEN Homepage]', '[UI:CLICK Messages Icon]']);
    expect(out.added).toEqual([{ at: 1, screen: 'Homepage' }]);
    expect(out.endAt).toBe('messages_page');
  });

  test('an icon inside another screen goes to that screen', () => {
    const out = beatWithPhonePaths(['[UI:CLICK Outfit Icon]'], on, { startAt: 'messages_page' });
    expect(out.lines).toEqual(['[UI:OPEN closet]', '[UI:CLICK Outfit Icon]']);
  });

  test('a path that already works is left as it is', () => {
    const lines = ['[UI:CLICK Messages Icon]', '[UI:CLOSE Messages Page]', '[UI:CLICK wallet]'];
    expect(beatWithPhonePaths(lines, on).lines).toEqual(lines);
  });
});

describe('scriptWithPhonePaths', () => {
  // Beats 3-7 of "I Designed My Outfit": the closet opens in 3, then each
  // beat taps a Homepage icon from where the last one left the phone.
  const script = [
    '## BEAT: 3 · Welcome\n[UI:OPEN closet]\nMe: "Welcome to the closet."',
    '## BEAT: 4 · Interruption Pulse 1\n[UI:CLICK Messages Icon]\n[UI:OPEN Messages Page]',
    '## BEAT: 5 · Reveal\n[UI:CLICK Messages Icon]',
    '## BEAT: 6 · Strategic Reaction\n[UI:CLICK wallet]\n[UI:OPEN Bank Page]\n[UI:CLOSE Bank Page]',
    '## BEAT: 7 · Interruption Pulse 2\n[UI:CLICK Messages Icon]\n[UI:OPEN Messages Page]\n[UI:CLOSE Messages Page]',
  ].join('\n\n');

  test('every beat gets the steps its taps need, each starting where the last left the phone', () => {
    const { script: fixed, added } = scriptWithPhonePaths(script, on);
    // Beats 4, 5 and 6; once 6 goes home first, closing Bank Page is back on Homepage for 7.
    expect(added).toBe(3);
    const beats = fixed.split('\n\n').map((b) => b.split('\n').slice(1));
    let at = null;
    for (const lines of beats) {
      const check = phoneCheck(lines, on, { startAt: at });
      expect(check.taps.every((t) => t.ok)).toBe(true);
      at = check.endAt;
    }
    expect(beats[1][0]).toBe('[UI:OPEN Homepage]');
  });

  test('only one beat, and an approved beat is never changed', () => {
    expect(scriptWithPhonePaths(script, on, { only: [1] }).added).toBe(1);
    const { script: fixed } = scriptWithPhonePaths(script, on, { skip: [1] });
    expect(fixed).toContain('## BEAT: 4 · Interruption Pulse 1\n[UI:CLICK Messages Icon]');
  });

  test('nothing to fix leaves the script exactly as it is', () => {
    const fine = '## BEAT: 1 · Opening Ritual\n[UI:CLICK Messages Icon]';
    expect(scriptWithPhonePaths(fine, on)).toEqual({ script: fine, added: 0 });
  });
});

// The writer adds the same steps on the server (src/utils/phonePaths.js),
// so the Script tab finds nothing left to fix.
describe('the server reads the phone the same way', () => {
  const serverOn = { screens, icons: server.phoneIcons(screens), overlays: [] };
  test('the same icon map', () => {
    expect(server.phoneIcons(screens)).toEqual(phoneIcons(screens));
  });
  test('the same check, the same steps, the same script', () => {
    const lines = ['[UI:OPEN closet]', '[UI:CLICK Messages Icon]', '[UI:CLOSE Messages Page]', '[UI:CLICK Outfit Icon]', '[UI:CLICK wallet]'];
    expect(server.phoneCheck(lines, serverOn)).toEqual(phoneCheck(lines, on));
    expect(server.beatWithPhonePaths(lines, serverOn, { startAt: 'bank_page' })).toEqual(beatWithPhonePaths(lines, on, { startAt: 'bank_page' }));
    const script = '[EVENT: gala]\n\n## BEAT: 3 · Welcome\n[UI:OPEN closet]\n\n## BEAT: 4 · Interruption Pulse 1\n[UI:CLICK Messages Icon]\n\n## BEAT: 5 · Reveal\n[UI:CLICK Outfit Icon]';
    expect(server.scriptWithPhonePaths(script, serverOn)).toEqual(scriptWithPhonePaths(script, on));
    expect(server.scriptWithPhonePaths(script, serverOn, { skip: [1] })).toEqual(scriptWithPhonePaths(script, on, { skip: [1] }));
  });
});

