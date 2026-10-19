/**
 * Script checks that gave wrong answers (Script page audit, 2026-10-19):
 * each test failed on the code before the fix. Show rules (Evoni): Lala
 * talks after her voice icon is clicked, per line; the phone is down from
 * beat 11; beat 5 shows the invitation letter; each costing piece's
 * `[WEAR: id]` is followed by its own coin line; beat 9 reads the approved
 * Shopping list.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as rules from './scriptShowRules';
import { beatCoins, coinChange } from './beatState';
import { phoneCheck, phoneStartScreens, resolveMoment, todoModeAt } from './scriptMoments';
import { headerNumber, normalizeBeatHeaders } from './beatLabelNumber';
import { lalaLineSlots } from './lalaLineDraft';
import { speakerLine } from './scriptSpeaker';
import { scriptPeople } from './episodeScript';
import { scriptHealth } from './scriptHealth';

const require = createRequire(import.meta.url);
const serverRules = require('../../../src/utils/scriptShowRules.js');
const serverLabels = require('../../../src/utils/beatLabelNumber.js');

describe("Lala's voice", () => {
  test('an acting note with "vo" in it is talking; only (V.O.) is her thoughts', () => {
    expect(rules.voiceOffLines(['Lala (nervously): hi'])).toEqual([0]);
    expect(rules.voiceOffLines(['Lala (devoted): always'])).toEqual([0]);
    expect(rules.voiceOffLines(['Lala (VO): hm', 'Lala (v.o.): hm', 'Lala ( V.O. ): hm', 'Lala (V.O., softly): hm'])).toEqual([]);
    expect(serverRules.voiceOffLines(['Lala (nervously): hi'])).toEqual([0]);
  });

  test('one wear cue does not free the whole beat', () => {
    expect(rules.voiceOffLines(['Lala: hi besties', 'Me: ok', '[WEAR: p1]', '[STAT: coins -50]', 'Lala: love it', 'Me: next', 'Lala: bye'])).toEqual([0, 6]);
    // The line right before a wear cue is her being dressed.
    expect(rules.voiceOffLines(['Lala: this one', '[WEAR: p1]'])).toEqual([]);
  });

  test('the closet frees the lines while it is open, not before or after', () => {
    expect(rules.voiceOffLines(['Lala: before', '[UI:OPEN Closet]', 'Lala: this', 'Lala: and this', '[UI:CLOSE Closet]', 'Lala: after'])).toEqual([0, 5]);
  });

  test('a notification covers the next line she says, not a later one', () => {
    expect(rules.voiceOffLines(['[UI:NOTIFY Mira: you up?]', 'Me: who is that', 'Lala: Mira!', 'Lala: anyway'])).toEqual([3]);
  });

  test('[UI:VOICE_ACTIVATE Lala] turns her voice on, as the server parser reads it', () => {
    expect(rules.voiceOffLines(['[UI:VOICE_ACTIVATE Lala]', 'Lala: hi'])).toEqual([]);
    expect(rules.voiceOffLines(['[UI:VOICEACTIVATE Lala]', 'Lala: hi', 'Lala: again'])).toEqual([2]);
    expect(serverRules.voiceOffLines(['[UI:VOICE_ACTIVATE Lala]', 'Lala: hi'])).toEqual([]);
  });
});

describe('beat 5 shows the invitation letter', () => {
  test('a notification about the letter, or hiding it, is not showing it', () => {
    expect(rules.revealCheck(['[UI:NOTIFY Mail: You are invited!]'])).toEqual({ login: [], invitation: false });
    expect(rules.revealCheck(['[UI:HIDE Invitation]'])).toEqual({ login: [], invitation: false });
    expect(rules.revealCheck(['[UI:DISPLAY Invitation]']).invitation).toBe(true);
    expect(rules.revealCheck(['[UI:SHOW Invite Letter]']).invitation).toBe(true);
    expect(rules.revealWithInvitation(['[UI:NOTIFY Mail: You are invited!]'], {}).lines).toEqual(['[UI:OPEN Invitation]', '[UI:NOTIFY Mail: You are invited!]']);
  });

  test('"Blog Index" and "Catalog Insert" are not the login screen; LoginWindow and Sign In are', () => {
    expect(rules.revealCheck(['[UI:OPEN Blog Index]', '[UI:OPEN Catalog Insert]', '[UI:OPEN Invitation]'])).toEqual({ login: [], invitation: true });
    expect(rules.revealCheck(['[UI:OPEN LoginWindow]', '[UI:OPEN Log-in Screen]', '[UI:CLICK Sign In]', '[UI:OPEN Invitation]']).login).toEqual([0, 1, 2]);
    expect(serverRules.revealCheck(['[UI:OPEN Blog Index]'])).toEqual({ login: [], invitation: false });
  });
});

describe('coin lines in any form', () => {
  test('colon, Unicode minus, a space, thousands and other stats in the tag', () => {
    expect(coinChange('[STAT: coins -50]')).toBe(-50);
    expect(coinChange('[STAT: coins: -50]')).toBe(-50);
    expect(coinChange('[STAT: coins −50]')).toBe(-50);
    expect(coinChange('[STAT: coins - 50]')).toBe(-50);
    expect(coinChange('[STAT: coins -1,200]')).toBe(-1200);
    expect(coinChange('[STAT: coins +75]')).toBe(75);
    expect(coinChange('[STAT: coins -50, reputation +2]')).toBe(-50);
    expect(coinChange('[STAT: reputation +2, coins -30]')).toBe(-30);
    expect(coinChange('[STAT: reputation +2]')).toBeNull();
    expect(coinChange('Lala: coins -50')).toBeNull();
    expect(beatCoins(['[STAT: coins: -50]', '[STAT: coins −1,200, stress +1]', 'Me: ok'])).toBe(-1250);
  });
});

describe('the phone path', () => {
  const screens = [
    { id: 'home', name: 'Home', is_home: true },
    { id: 'bank', name: 'Bank Page' },
    { id: 'closet', name: 'Closet' },
  ];
  // Two icons named Back: one on Bank Page, one on Closet.
  const icons = [
    { key: 'back_bank', name: 'Back', on: 'bank', onName: 'Bank Page', opens: 'home', opensName: 'Home' },
    { key: 'back_closet', name: 'Back', on: 'closet', onName: 'Closet', opens: 'home', opensName: 'Home' },
    { key: 'bank', name: 'Bank', on: 'home', onName: 'Home', opens: 'bank', opensName: 'Bank Page' },
  ];
  const on = { screens, icons };

  test('a tap on an icon with a shared name is the one on the screen showing', () => {
    const check = phoneCheck(['[UI:CLICK Back]'], on, { startAt: 'closet' });
    expect(check.taps[0]).toMatchObject({ ok: true, on: 'closet' });
    expect(check.endAt).toBe('home');
    expect(resolveMoment({ verb: 'CLICK', target: 'Back' }, on, { at: 'closet' })).toMatchObject({ on: 'Closet' });
  });

  test('a beat with the phone down starts it at home, not where beat 10 left it', () => {
    const beats = [
      { number: 10, lines: ['[UI:CLICK Bank]'] },
      { number: 11, lines: ['Me: we made it'] },
      { number: 12, lines: ['[UI:SHOW phone]', '[UI:CLICK Bank]'] },
    ];
    expect(phoneStartScreens(beats, on)).toEqual([null, null, null]);
    // Before: beat 12 started on Bank Page and the tap on Bank was flagged.
    const rows = scriptHealth({ beats, onScreen: on });
    expect(rows.filter((r) => r.key.startsWith('phone-'))).toEqual([]);
  });

  test('up through beat 10, each beat starts where the one before left the phone', () => {
    const beats = [{ number: 9, lines: ['[UI:CLICK Bank]'] }, { number: 10, lines: ['[UI:CLICK Back]'] }];
    expect(phoneStartScreens(beats, on)).toEqual([null, 'bank']);
  });
});

describe('Beat N headers', () => {
  test('`## Beat 5: Name` is a header, numbered 5', () => {
    expect(normalizeBeatHeaders('## Beat 5: Reveal\nMe: hi')).toBe('## BEAT: 5 · Reveal\nMe: hi');
    expect(normalizeBeatHeaders('### Beat 12 — The Fashion Challenge')).toBe('## BEAT: 12 · The Fashion Challenge');
    expect(normalizeBeatHeaders('## Beat 3')).toBe('## BEAT: 3');
    expect(normalizeBeatHeaders('## Beat sheet notes')).toBe('## Beat sheet notes');
    expect(serverLabels.normalizeBeatHeaders('## Beat 5: Reveal')).toBe('## BEAT: 5 · Reveal');
  });

  test('`## BEAT: Beat 4 · Pulse` names beat 4', () => {
    expect(headerNumber('Beat 4 · Pulse')).toBe(4);
    expect(headerNumber('beat 12: The Fashion Challenge')).toBe(12);
    expect(headerNumber('Beat #9')).toBe(9);
    expect(headerNumber('Reveal')).toBe(5);
    expect(serverLabels.headerNumber('Beat 4 · Pulse')).toBe(4);
  });

  test('a script with `## Beat N:` headers is not "All 14 beats" when beats are missing', () => {
    const text = normalizeBeatHeaders('## Beat 1: Opening Ritual\nMe: hi\n\n## Beat 2: Login Sequence\nMe: in');
    const numbers = text.split('\n').filter((l) => l.startsWith('## BEAT:')).map((l) => headerNumber(l.replace('## BEAT:', '')));
    expect(numbers).toEqual([1, 2]);
  });
});

describe("Lala's line slot after a wear cue", () => {
  const look = [{ id: 'p1', name: 'Gold Slip' }];
  test('it goes after the coin line, never between the wear cue and its coin line', () => {
    const beats = [{ lines: ['[WEAR: p1]', '[STAT: coins -50]', 'Me: next'] }];
    expect(lalaLineSlots(beats, look)).toEqual([{ beatIndex: 0, lineIndex: 1, piece: look[0] }]);
  });
  test('Lala speaking with an acting note, past the coin line, needs no slot', () => {
    expect(lalaLineSlots([{ lines: ['[WEAR: p1]', '[STAT: coins -50]', 'Lala: love it'] }], look)).toEqual([]);
    expect(lalaLineSlots([{ lines: ['[WEAR: p1]', 'Lala (twirling): love it'] }], look)).toEqual([]);
  });
});

describe('beat 9 reads the Shopping list', () => {
  const beats = [7, 8, 9, 10].map((number) => ({ number, lines: [] }));
  test('the beat after the closet beat is shopping, the one after that is not', () => {
    expect(todoModeAt(beats, 2, { closetNumber: 8 })).toEqual({ mode: 'shopping', source: 'auto' });
    expect(todoModeAt(beats, 2, { closetNumber: 8, dealLocked: true })).toEqual({ mode: 'shopping', source: 'auto' });
    expect(todoModeAt(beats, 3, { closetNumber: 8, dealLocked: true })).toEqual({ mode: 'deal', source: 'auto' });
    expect(todoModeAt(beats, 2, { closetNumber: null })).toEqual({ mode: 'shopping', source: 'auto' });
  });
});

describe('who speaks', () => {
  test('"Suddenly: the lights go out." is narration, not a speaker', () => {
    expect(speakerLine('Suddenly: the lights go out.')).toBeNull();
    expect(speakerLine('Later: she checks her phone.')).toBeNull();
    expect(speakerLine('The Room: goes quiet as she walks in.')).toBeNull();
    expect(scriptPeople({ beats: [{ lines: ['Suddenly: the lights go out.', 'Mira: "Hi"'] }] })).toEqual(['Mira']);
  });
  test('people still speak, quoted, capitalised, short or with a note', () => {
    expect(speakerLine('Mira: "the lights went out"')?.speaker).toBe('Mira');
    expect(speakerLine('Mary Jane: Hi there friend')?.speaker).toBe('Mary Jane');
    expect(speakerLine('Émile: oui')?.speaker).toBe('Émile');
    expect(speakerLine('Mira (whispering): the lights went out')?.speaker).toBe('Mira');
    expect(speakerLine('Lala: i love this for me')?.speaker).toBe('Lala');
  });
});
