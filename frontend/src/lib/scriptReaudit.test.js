/**
 * Script page re-audit (2026-10-19): the checks that read the script gave
 * wrong answers on a full 14-beat cutscene-format script. Each test is one
 * of them; the server's copies are checked alongside.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as rules from './scriptRuleChecks';
import * as stats from './scriptStats';
import { coinChange as cardCoin } from './beatState';
import { scriptHealth } from './scriptHealth';
import { mustCover } from './episodeScript';
import { voiceOffLines, scriptWithShowRules } from './scriptShowRules';
import { phoneIcons, phoneCheck, closetBeat } from './scriptMoments';
import { scriptWithPhonePaths } from './phonePaths';

const require = createRequire(import.meta.url);
const serverRules = require('../../../src/utils/scriptRuleChecks.js');
const serverStats = require('../../../src/utils/scriptStats.js');
const serverMoney = require('../../../src/utils/scriptMoney.js');
const serverPaths = require('../../../src/utils/phonePaths.js');
const serverShow = require('../../../src/utils/scriptShowRules.js');

const at = (number, ...lines) => ({ id: `beat-${number}`, number, lines, approved: false });
const shared = (text) => text.slice(text.search(/^\/\/ BEGIN SHARED$/m), text.search(/^\/\/ END SHARED$/m));
const MONEY = { look: [{ id: 'p1', name: 'Gold Dress', amount: 120 }, { id: 'p2', name: 'Heels', amount: 80 }], recap: [], income: [] };
const CAST = [{ name: 'Declan Ferris', role: 'host', aliases: [] }];

const screens = [
  { id: 'home', name: 'Home', is_home: true, screen_links: [{ label: 'Mail', target: 'mail' }, { label: 'Closet', target: 'closet' }] },
  { id: 'mail', name: 'Mail Page', screen_links: [{ label: 'Back', target: 'home' }] },
  { id: 'closet', name: 'Closet', screen_links: [{ label: 'Back', target: 'home' }] },
];
const ON = { screens, icons: phoneIcons(screens), overlays: [{ key: 'stats', label: 'Stats Panel', image_url: 'x' }] };

describe("Lala's notes are not voice-overs", () => {
  test('(devoted), (nervously) and (voice cracking) are Lala speaking in beats 11 and 13; (V.O.) is not', () => {
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings([
        at(11, 'Declan: Welcome.', 'Lala (devoted): Thank you for having me.', 'Me: wow'),
        at(13, 'Lala (overwhelmed, voice cracking): That was everything.', 'Me: yes'),
      ], { cast: CAST });
      expect(found.find((f) => f.key === 'beat11')?.ok).toBe(true);
      expect(found.find((f) => f.key === 'beat13')?.ok).toBe(true);
      const vo = lib.scriptRuleFindings([at(13, 'Lala (V.O.): That was everything.')], {});
      expect(vo.find((f) => f.key === 'beat13')?.ok).toBe(false);
    }
  });
});

describe('one coin reader everywhere', () => {
  const forms = [
    ['[STAT: coins —120]', -120], ['[STAT: coins –120]', -120], ['[STAT: coins −120]', -120], ['[ STAT: coins -50]', -50],
    ['[STAT: coins -1,200.50]', -1200.5], ['[STAT: coins-50]', -50], ['[STAT: coins +75]', 75],
    ['[STAT: reputation +2, coins -30]', -30], ['[STAT: Lala coins -50]', null], ['[STAT: reputation +2]', null], ['Lala: coins -50', null],
  ];
  test('the card, the rules and the server coin pass read every form the same', () => {
    for (const [line, n] of forms) {
      expect([line, stats.coinChange(line)]).toEqual([line, n]);
      expect([line, cardCoin(line)]).toEqual([line, n]);
      expect([line, rules.coinChange(line)]).toEqual([line, n]);
      expect([line, serverRules.coinChange(line)]).toEqual([line, n]);
      expect([line, serverStats.isCoinLine(line)]).toEqual([line, n !== null]);
    }
  });
  test("the server's copy is the same code", () => {
    const here = readFileSync(require.resolve('./scriptStats.js'), 'utf8');
    const there = readFileSync(require.resolve('../../../src/utils/scriptStats.js'), 'utf8');
    expect(shared(here).length).toBeGreaterThan(100);
    expect(shared(there)).toBe(shared(here));
  });
  test('an em-dash coin line after its [WEAR:] is the piece paid for', () => {
    const found = rules.scriptRuleFindings([at(8, '[UI:OPEN Closet]', '[WEAR: p1]', '[STAT: coins —120]', '[WEAR: p2]', '[STAT: coins -80]')], { money: MONEY, closetNumber: 8 });
    expect(found.find((f) => f.key === 'beat8')?.ok).toBe(true);
  });
  test('brand-trust is brand_trust', () => {
    expect(stats.statEntries('[STAT: brand-trust +2]')).toEqual([{ stat: 'brand_trust', value: 2 }]);
    const found = rules.scriptRuleFindings([at(12, 'Lala walks the runway.', '[STAT: reputation +3]', '[STAT: brand-trust +2]', '[STAT: influence +1, stress -1]')], {});
    expect(found.find((f) => f.key === 'stats')?.ok).toBe(true);
  });
});

describe('no phone in the cutscene', () => {
  test('a tap in beat 11 is flagged as the cutscene, with no fix; beat 12 offers no phone path', () => {
    const beats = [at(10, '[UI:CLICK Mail]'), at(11, '[UI:CLICK Mail]', 'Lala: hi'), at(12, '[UI:OPEN Closet]', '[UI:CLICK Mail]'), at(13, '[UI:DISPLAY Stats Panel]', '[UI:HIDE Stats Panel]')];
    const rows = scriptHealth({ beats, onScreen: ON }).filter((r) => r.key.startsWith('phone') || r.key.includes('cutscene'));
    // One row per beat with the rules read too, and the same on the server, as a coverage item.
    const read = scriptHealth({ beats, onScreen: ON, rules: { money: null, shoppingApproved: null, cast: [] } });
    expect(read.filter((r) => r.key.includes('cutscene')).map((r) => r.key)).toEqual(['rule-cutscene-11', 'rule-cutscene-12']);
    expect(serverRules.cutsceneFindings(beats)).toEqual(rules.cutsceneFindings(beats));
    const items = serverRules.scriptRuleItems([{ number: 11, text: '## BEAT: 11\n[UI:CLICK Mail]\n[UI:VOICE_ACTIVATE Lala]\n[UI:SHOW phone]\n[UI:DISPLAY Stats Panel]\n[TRANSITION: fade]\nLala: hi' }]);
    expect(items.map((i) => [i.rule, i.beat, i.target])).toEqual([['cutscene-11', null, 11]]);
    expect(items[0].ask).toContain('[UI:CLICK Mail], [UI:VOICE_ACTIVATE Lala] and [UI:SHOW phone]');
    expect(rows.map((r) => [r.key, r.ok, r.text, !!r.fix])).toEqual([
      ['phone', true, 'Every phone and overlay moment points at something made.', false],
      ['rule-cutscene-11', false, 'Beat 11: Beats 11–13 are the cutscene: no phone — remove [UI:CLICK Mail].', false],
      ['rule-cutscene-12', false, 'Beat 12: Beats 11–13 are the cutscene: no phone — remove [UI:OPEN Closet] (+1 more).', false],
    ]);
  });
});

describe("the server's phone walk is the tab's", () => {
  test('a Back on the screen showing is that Back', () => {
    const lines = ['[UI:CLICK Closet]', '[UI:CLICK Back]'];
    const on = { screens, icons: serverPaths.phoneIcons(screens, []), overlays: [] };
    expect(serverPaths.phoneCheck(lines, on).taps.map((t) => t.ok)).toEqual(phoneCheck(lines, on).taps.map((t) => t.ok));
    expect(serverPaths.phoneCheck(lines, on).taps.map((t) => t.ok)).toEqual([true, true]);
    const text = '## BEAT: 8 · Transformation Loop\n[UI:CLICK Closet]\n[UI:CLICK Back]';
    expect(serverPaths.scriptWithPhonePaths(text, on).added).toBe(0);
    expect(scriptWithPhonePaths(text, on).added).toBe(0);
  });
  test('the walk is the same code on both sides', () => {
    const fns = ['resolveMoment', 'phoneCheck'];
    const here = readFileSync(require.resolve('./scriptMoments.js'), 'utf8');
    const there = readFileSync(require.resolve('../../../src/utils/phonePaths.js'), 'utf8');
    const body = (text, name) => { const s = text.search(new RegExp(`^(?:export )?function ${name}\\(`, 'm')); const e = text.indexOf('\n}\n', s); return text.slice(s, e).replace(/^export /, ''); };
    for (const name of fns) expect(body(there, name)).toBe(body(here, name));
  });
});

describe('one row for a missing beat 14 opportunity', () => {
  test('the must-cover list does not repeat beat 14', () => {
    const beats = [at(14, 'Lala: bye')];
    const opp = { name: 'Velvet Rooftop Residency', status: 'held' };
    const rows = scriptHealth({ beats, cover: mustCover({ beats, opportunity: opp }), onScreen: ON, beat14: { opportunity: opp } });
    expect(rows.filter((r) => /Velvet Rooftop/.test(r.text)).map((r) => r.key)).toEqual(['beat14']);
  });
});

describe('a notification frees her line', () => {
  test('[UI:NOTIFICATION …] is a notification, on both sides', () => {
    expect(voiceOffLines(['[UI:NOTIFICATION MailDing]', 'Lala: ooh mail'])).toEqual([]);
    expect(serverShow.voiceOffLines(['[UI:NOTIFICATION MailDing]', 'Lala: ooh mail'])).toEqual([]);
    expect(scriptWithShowRules('## BEAT: 4 · Pulse\n[UI:NOTIFICATION MailDing]\nLala: ooh', {}).voice_clicks).toBe(0);
  });
});

describe('the closet is the screen named Closet', () => {
  test('"Shop the Closet Sale" in beat 7 is not the closet; it is the beat closetBeat names', () => {
    const money = { look: [{ id: 'p1', name: 'Gold Dress', amount: 120 }], recap: [] };
    const beats = [at(7, '[UI:OPEN Shop the Closet Sale]', 'Me: sale!'), at(8, '[UI:OPEN Closet]', '[WEAR: p1]', '[STAT: coins -120]')];
    for (const lib of [rules, serverRules]) {
      const found = lib.scriptRuleFindings(beats, { money });
      expect(found.filter((f) => !f.ok)).toEqual([]);
      expect(found.find((f) => f.key === 'beat8')?.beat).toBe(8);
    }
    expect(closetBeat('## BEAT: 7 · Pulse\n[UI:OPEN Shop the Closet Sale]\n\n## BEAT: 8 · Loop\n[UI:OPEN Closet]')).toBe(8);
  });
});

describe('the coin pass and the rule agree', () => {
  test('a piece whose next line is the next piece gets its own coin line', () => {
    const text = '## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n[WEAR: p1]\n[WEAR: p2]\n[STAT: coins -80]';
    const out = serverMoney.scriptWithCoinLines(text, MONEY);
    expect(out.added).toBe(1);
    expect(out.script).toContain('[WEAR: p1]\n[STAT: coins -120]\n[WEAR: p2]\n[STAT: coins -80]');
    const beat = out.script.split('\n').slice(1);
    expect(rules.scriptRuleFindings([at(8, ...beat)], { money: MONEY, closetNumber: 8 }).find((f) => f.key === 'beat8')?.ok).toBe(true);
  });
});

describe("the voice row is gameplay's", () => {
  test('Lala speaking only in the cutscene gives no voice row', () => {
    const rows = scriptHealth({ beats: [at(11, 'Lala: hi'), at(13, 'Lala: wow')], onScreen: ON });
    expect(rows.some((r) => r.key === 'voice')).toBe(false);
    expect(scriptHealth({ beats: [at(3, '[UI:CLICK Voice Icon]', 'Lala: hi')], onScreen: ON }).some((r) => r.key === 'voice' && r.ok)).toBe(true);
  });
});

describe('beat 11 is The Event (Evoni, 2026-10-19)', () => {
  test('its new name and its old one both read as beat 11, on both sides', async () => {
    const { headerNumber } = await import('./beatLabelNumber');
    const { BEATS } = await import('./canonicalBeats');
    const server = require('../../../src/utils/beatLabelNumber.js');
    const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats.js');
    for (const label of ['The Event', 'THE_EVENT', 'Event Outcome', 'EVENT_OUTCOME', '11 · Event Outcome', '11 · The Event']) {
      expect([label, headerNumber(label)]).toEqual([label, 11]);
      expect([label, server.headerNumber(label)]).toEqual([label, 11]);
    }
    expect(BEATS.find((b) => b.number === 11).name).toBe('The Event');
    expect(CANONICAL_BEATS.find((b) => b.number === 11).name).toBe('The Event');
  });
});
