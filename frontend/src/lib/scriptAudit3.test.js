/**
 * Script page audit 3 (2026-10-19): a realistic 14-beat script and its broken
 * variants, read by "Ready to film?" and the server's checks. Each test is one
 * finding; the server's copies are checked alongside.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as rules from './scriptRuleChecks';
import { featuredGuestIds } from './scriptRuleChecks';
import { scriptHealth } from './scriptHealth';
import { voiceOffLines } from './scriptShowRules';
import { phoneIcons, phoneCheck, closetBeat, messageOf } from './scriptMoments';
import { invitationLine } from './beat14Invitation';
import { normalizeBeatHeaders, headerNumber, BEAT_SPLIT } from './beatLabelNumber';
import { BEATS } from './canonicalBeats';

const require = createRequire(import.meta.url);
const serverRules = require('../../../src/utils/scriptRuleChecks.js');
const serverMoney = require('../../../src/utils/scriptMoney.js');
const serverShow = require('../../../src/utils/scriptShowRules.js');
const serverLabels = require('../../../src/utils/beatLabelNumber.js');
const serverWear = require('../../../src/utils/scriptWear.js');
const serverCoverage = require('../../../src/utils/scriptCoverage.js');
const serverInvite = require('../../../src/utils/beat14Invitation.js');
const serverPaths = require('../../../src/utils/phonePaths.js');

const at = (number, ...lines) => ({ id: `beat-${number}`, number, lines, approved: false });
const MONEY = { look: [{ id: 'p1', name: 'Gold Slip', amount: 120 }, { id: 'p2', name: 'Gold Hoops', amount: 80 }], recap: [{ label: 'Entry fee', amount: 150 }], income: [] };
const screens = [
  { id: 'home', name: 'Homepage', is_home: true, url: 'h', screen_links: [{ label: 'Mail', target: 'mail' }, { label: 'Closet', target: 'closet' }] },
  { id: 'mail', name: 'Mail', url: 'm', screen_links: [{ label: 'Back', target: 'home' }] },
  { id: 'closet', name: 'Closet', url: 'c', screen_links: [{ label: 'Back', target: 'home' }] },
];
const ON = { screens, icons: phoneIcons(screens), overlays: [{ key: 'invitation', label: 'Invitation', image_url: 'i' }] };
const parse = (text) => normalizeBeatHeaders(text).split(BEAT_SPLIT).filter((s) => /^\s*##\s*BEAT:/i.test(s)).map((s, i) => {
  const lines = s.split('\n').filter((l) => l.trim());
  return { number: headerNumber((lines[0].match(/##\s*BEAT:\s*(.+)/i)?.[1] || '').trim()) || i + 1, lines: lines.slice(1) };
});

describe('1. a piece is charged once, its coin line anywhere before the next piece', () => {
  const beat8 = at(8, '[UI:OPEN Closet]', '[WEAR: p1]', '[UI:CLICK Voice]', 'Lala: The gold slip, yes.', 'Me: Oh she loves it.', '[STAT: coins -120]', '[WEAR: p2]', '[STAT: coins -80]');
  test('the coin line three lines after its [WEAR] is its own', () => {
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings([beat8], { money: MONEY });
      expect(found.filter((f) => !f.ok)).toEqual([]);
    }
  });
  test('the server adds no second coin line for it', () => {
    const script = `## BEAT: 8 · Transformation Loop\n${beat8.lines.join('\n')}`;
    expect(serverMoney.scriptWithCoinLines(script, MONEY).added).toBe(0);
  });
  test('a second coin line for one piece is flagged', () => {
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings([at(8, '[UI:OPEN Closet]', '[WEAR: p1]', '[STAT: coins -120]', 'Lala: Yes.', '[STAT: coins -120]', '[WEAR: p2]', '[STAT: coins -80]')], { money: MONEY });
      expect(found.filter((f) => !f.ok).map((f) => f.key)).toEqual(['beat8-p1']);
    }
  });
});

describe('2. the featured guests are read by their profiles', () => {
  test('featuredGuestIds names the two featured guests the cast reads', () => {
    const event = { canon_consequences: { automation: { guest_profiles: [{ profile_id: 2, featured: true }, { profile_id: 9 }, { id: 3, featured: true }, { profile_id: 4, featured: true }] } } };
    expect(featuredGuestIds(event)).toEqual(['2', '3']);
    expect(featuredGuestIds(null)).toEqual([]);
  });
});

describe('3. [UI:NOTIFICATION …] is a notification', () => {
  test('the phone check does not open Mail for it', () => {
    const check = phoneCheck(['[UI:NOTIFICATION Mail: You have a new letter]', '[UI:CLICK Mail]'], ON);
    expect(check.taps.every((t) => t.ok)).toBe(true);
    expect(check.missing).toEqual([]);
    expect(messageOf({ verb: 'NOTIFICATION', target: 'Mail: hi' })?.kind).toBe('notify');
    expect(serverPaths.phoneCheck(['[UI:NOTIFICATION Mail: You have a new letter]', '[UI:CLICK Mail]'], ON).taps.every((t) => t.ok)).toBe(true);
  });
  test('beat 14 delivers the opportunity in one', () => {
    const lines = ["[UI:NOTIFICATION Marisol Vega: You're on the list for the After Hours Salon.]"];
    expect(invitationLine(lines, 'After Hours Salon')).not.toBeNull();
    expect(serverInvite.invitationLine(lines, 'After Hours Salon')).not.toBeNull();
  });
});

describe('4. a notification or message in the cutscene is the phone', () => {
  test('flagged in beats 11-13', () => {
    for (const lib of [rules, serverRules]) {
      const found = lib.cutsceneFindings([at(12, 'Me: serving.', '[UI:NOTIFY Fans: 2k new followers]'), at(13, '[UI:DM Jessica: you ate]', '[UI:DISPLAY Stats Panel]')]);
      expect(found.map((f) => f.key)).toEqual(['cutscene-12', 'cutscene-13']);
    }
  });
});

describe('5. the server fixes the show rules under any header spelling', () => {
  const body = (h) => `${h(5, 'Reveal')}\n[UI:DISPLAY Invitation]\n\n${h(6, 'Strategic Reaction')}\nLala: We need a look.`;
  test.each([
    ['number first', (n, name) => `## Beat ${n}: ${name}`],
    ['three hashes', (n, name) => `### BEAT: ${n} · ${name}`],
    ['bold', (n, name) => `**## BEAT: ${n} · ${name}**`],
  ])('%s', (_, h) => {
    expect(serverShow.scriptWithShowRules(body(h), ON).voice_clicks).toBe(1);
  });
  test('an unchanged script comes back as written', () => {
    const t = body((n, name) => `## Beat ${n}: ${name}`).replace('Lala: We need a look.', 'Me: We need a look.');
    expect(serverShow.scriptWithShowRules(t, ON).script).toBe(t);
  });
  test('the coin pass reads them too', () => {
    const t = '### BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n[WEAR: p1]\nLala: yes';
    expect(serverMoney.scriptWithCoinLines(t, MONEY).added).toBe(1);
  });
});

describe('6. every header spelling is a header', () => {
  test.each(['##  BEAT : 11 · The Event', '# BEAT 11: The Event', '# BEAT: 11 · The Event', '## BEAT :11'])('%s', (header) => {
    for (const norm of [normalizeBeatHeaders, serverLabels.normalizeBeatHeaders]) {
      const out = norm(`## BEAT: 10 · Event Travel\nMe: go.\n${header}\nLala: hi.`);
      expect(out.split(BEAT_SPLIT)).toHaveLength(2);
    }
    expect(parse(`## BEAT: 10 · Event Travel\nMe: go.\n${header}\nLala: hi.`).map((b) => b.number)).toEqual([10, 11]);
  });
  test('a title that is not a beat stays', () => {
    expect(normalizeBeatHeaders('# Beat Sheet: Episode 3')).toBe('# Beat Sheet: Episode 3');
  });
});

describe('7. a speaker named with a curly apostrophe or no accent is the cast member', () => {
  test('D’Angelo is D\'Angelo Price; Renee is Renée Laurent', () => {
    const cast = [{ name: "D'Angelo Price", role: 'featured guest', aliases: [] }, { name: 'Renée Laurent', role: 'host', aliases: [] }];
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings([at(11, 'D’Angelo: Gold on gold.', 'Renee Laurent: Welcome.', 'Lala: Hi!', 'Me: Okay, cast.')], { cast });
      expect(found.filter((f) => !f.ok)).toEqual([]);
    }
  });
});

describe('8. coin rules that need no money still run without it', () => {
  test('a + coin line, and coins in beat 6, are flagged with money unread', () => {
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings([at(6, '[STAT: coins -40]'), at(13, '[STAT: coins +500]', 'Lala: wow.')], { money: null });
      expect(found.filter((f) => !f.ok).map((f) => f.key)).toEqual(expect.arrayContaining(['coins-6', 'coins-13']));
    }
  });
});

describe('9. the runway is a runway', () => {
  test('"walks over to the bar" is not the runway walk', () => {
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings([at(12, 'Lala walks over to the bar.')]);
      expect(found.find((f) => f.key === 'beat12-runway').ok).toBe(false);
      expect(lib.scriptRuleFindings([at(12, 'Lala walks the catwalk.')]).find((f) => f.key === 'beat12-runway').ok).toBe(true);
    }
  });
});

describe('10. the closet is the screen named Closet', () => {
  const script = '## BEAT: 7 · Pulse\n[UI:OPEN Closet Sale Alert]\n\n## BEAT: 8 · Loop\n[UI:OPEN Closet]\n[WEAR: p1]\n[STAT: coins -120]';
  test.each(['Closet Sale Alert', 'Shop the Closet Sale'])('"%s" in beat 7 is not the closet', (name) => {
    const t = script.replace('Closet Sale Alert', name);
    expect(closetBeat(t)).toBe(8);
    const beats = [at(7, `[UI:OPEN ${name}]`), at(8, '[UI:OPEN Closet]', '[WEAR: p1]', '[STAT: coins -120]', '[WEAR: p2]', '[STAT: coins -80]')];
    for (const lib of [rules, serverRules]) expect(lib.scriptRuleFindings(beats, { money: MONEY }).filter((f) => !f.ok)).toEqual([]);
    expect(serverWear.closetIndex(serverWear.scriptBeats(t))).toBe(1);
    const cov = serverCoverage.scriptCoverage(t, { lockedPieces: [{ id: 'p1', name: 'Gold Slip' }] });
    expect(cov.items.find((i) => i.kind === 'wear').target).toBe(8);
  });
  test("[UI:OPEN Lala's Closet] still opens the closet", () => {
    expect(closetBeat("## BEAT: 6 · x\n[UI:OPEN Lala's Closet]")).toBe(6);
  });
});

describe('11. one row per cause; bold Lala is Lala', () => {
  test('a login tap in beat 5 is the reveal row only', () => {
    const rows = scriptHealth({ beats: [at(5, '[UI:DISPLAY Invitation]', '[UI:CLICK LoginButton]')], canonical: BEATS, onScreen: ON });
    expect(rows.filter((r) => !r.ok && r.key !== 'approved' && r.key !== 'beats').map((r) => r.key)).toEqual(['reveal']);
  });
  test('**Lala:** and **Lala**: need her voice click', () => {
    for (const fn of [voiceOffLines, serverShow.voiceOffLines]) {
      expect(fn(['**Lala:** We need a look.', '__Lala__: And shoes.'])).toEqual([0, 1]);
    }
    const rows = scriptHealth({ beats: [at(6, '**Lala:** We need a look.')], canonical: BEATS, onScreen: ON });
    expect(rows.find((r) => r.key.startsWith('voice')).ok).toBe(false);
    for (const lib of [rules, serverRules]) {
      expect(lib.scriptRuleFindings([at(13, '**Lala:** That felt big.')]).find((f) => f.key === 'beat13').ok).toBe(true);
    }
  });
});
