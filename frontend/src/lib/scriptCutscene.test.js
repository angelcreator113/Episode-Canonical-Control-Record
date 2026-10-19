/**
 * Beats 11-13 are the cutscene (Evoni, 2026-10-19): an AI video where the
 * characters say their own lines; no phone and no voice-icon click. Beat 14
 * is gameplay again.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { isCutsceneBeat, scriptWithShowRules } from './scriptShowRules';
import { beatOnScreen, phoneStartScreens, EXPECTED_ON_SCREEN } from './scriptMoments';
import { scriptHealth } from './scriptHealth';
import { scriptWithPhonePaths } from './phonePaths';
import { BEATS } from './canonicalBeats';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/scriptShowRules.js');

const ON = {
  screens: [{ id: 'home', name: 'Home', is_home: true }, { id: 'bank', name: 'Bank Page' }],
  icons: [{ key: 'bank', name: 'Bank', on: 'home', onName: 'Home', opens: 'bank', opensName: 'Bank Page' }],
  overlays: [{ key: 'stats', label: 'Stats Panel', image_url: 'https://x/s.png' }],
};

describe('the cutscene', () => {
  test('beats 11-13 are the cutscene, on both sides', () => {
    expect([1, 10, 11, 12, 13, 14].map(isCutsceneBeat)).toEqual([false, false, true, true, true, false]);
    expect([10, 11, 13, 14].map(server.isCutsceneBeat)).toEqual([false, true, true, false]);
  });

  test('Lala needs no voice click in 11-13; Ready to film does not flag her there', () => {
    const beats = [
      { id: 'b11', number: 11, lines: ['Lala: hi Sable', 'Me: (laughs) she is nervous'] },
      { id: 'b13', number: 13, lines: ['[UI:DISPLAY Stats Panel]', 'Lala: what a night'] },
      { id: 'b14', number: 14, lines: ['Lala: who is that'] },
    ];
    const voice = scriptHealth({ beats, onScreen: ON }).filter((r) => r.key.startsWith('voice'));
    expect(voice.map((r) => r.key)).toEqual(['voice-b14']);
    const fixed = scriptWithShowRules('## BEAT: 12 · Fashion Challenge\nLala: walk?\n\n## BEAT: 14 · Cliffhanger\nLala: hm', ON);
    expect(fixed.voice_clicks).toBe(1);
    expect(fixed.script).toContain('## BEAT: 12 · Fashion Challenge\nLala: walk?');
  });

  test('a phone moment in the cutscene is flagged and brings nothing up; the stats panel shows', () => {
    const r = beatOnScreen(['[UI:SHOW phone]', '[UI:CLICK Bank]', '[UI:OPEN Bank Page]', '[UI:DISPLAY Stats Panel]'], ON, { phoneUp: true, cutscene: true });
    expect(r.phoneDownAt).toEqual([0, 1, 2]);
    expect(r.phoneUpAtEnd).toBe(false);
    expect(r.withByLine[3]).toEqual([]);
  });

  test('beat 14 starts the phone at home after the cutscene', () => {
    const beats = [
      { number: 10, lines: ['[UI:CLICK Bank]'] },
      { number: 11, lines: ['Lala: hi'] },
      { number: 14, lines: ['[UI:CLICK Bank]'] },
    ];
    expect(phoneStartScreens(beats, ON)).toEqual([null, null, null]);
    expect(scriptHealth({ beats, onScreen: ON }).filter((r) => r.key.startsWith('phone-'))).toEqual([]);
  });

  test('no phone step goes into the cutscene', () => {
    const script = '## BEAT: 12 · Fashion Challenge\n[UI:CLICK Bank]\n[UI:CLICK Bank]';
    expect(scriptWithPhonePaths(script, ON)).toEqual({ script, added: 0 });
  });

  test('beat 12 is not on her phone', () => {
    expect(BEATS.find((b) => b.number === 12).phone).toBe(false);
    expect(EXPECTED_ON_SCREEN[12].where).toBe("Lala's Environment");
  });
});
