// ============================================================================
// Beats 11-13 are the cutscene (Evoni, 2026-10-19): an AI video where the
// characters say their own lines; JustAWoman stays on screen and comments a
// little; no phone and no voice-icon click. Beat 11 is Lala's conversation
// with the host and two featured guests, beat 12 a surprise runway walk,
// beat 13 the recap with the stats panel over the video. Beat 14 is
// gameplay again. No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');
const { scriptWithShowRules, isCutsceneBeat } = require('../../../src/utils/scriptShowRules');
const { scriptWithPhonePaths } = require('../../../src/utils/phonePaths');

const EVENT = {
  name: 'Gala', prestige: 7, cost_coins: 0, host: 'Sable Reyes', host_brand: 'STUDIO BY SABLE',
  canon_consequences: { automation: { guest_profiles: [
    { display_name: 'Mira Vance', featured: true }, { handle: 'noor.styles', featured: true },
    { display_name: 'Extra Person', featured: false }, { display_name: 'Third Featured', featured: true },
  ] } },
};
const inputs = (over = {}) => ({
  brief: null, scenePlan: [], franchiseLaws: [], wardrobeItems: [], lalaStats: null, outfitScore: null, eventData: EVENT, ...over,
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the canonical beats', () => {
  const beat = (n) => CANONICAL_BEATS.find((b) => b.number === n);
  test('11-13 are the cutscene, 14 is gameplay again', () => {
    expect(beat(11).story_job).toMatch(/cutscene begins/);
    expect(beat(11).story_job).toMatch(/host and its two featured guests/);
    expect(beat(12).story_job).toMatch(/surprise runway walk/);
    expect(beat(12).story_job).toMatch(/no coin line/);
    expect(beat(12).surface).toBe("Lala's Environment");
    expect(beat(13).story_job).toMatch(/Still the cutscene, with the stats panel over the video/);
    expect(beat(13).story_job).toMatch(/paid next episode/);
    expect(beat(14).story_job).toMatch(/Back to gameplay/);
    for (const n of [11, 12, 13]) expect(beat(n).story_job).toMatch(/no voice-icon click|no phone/);
  });
});

describe('the writer prompt', () => {
  const prompt = buildScriptPrompt(inputs());
  test('describes the cutscene and names the host and the first two featured guests', () => {
    expect(prompt).toContain('Beats 11–13 are the cutscene');
    expect(prompt).toContain('Beat 11 (The Event): the cutscene begins. Lala has a real conversation with the host, Sable Reyes (STUDIO BY SABLE) and the two featured guests, Mira Vance and noor.styles.');
    expect(prompt).not.toContain('Extra Person');
    expect(prompt).toContain('Beat 12 (Fashion Challenge): still the cutscene. The challenge is a surprise runway walk');
    expect(prompt).toContain('[UI:DISPLAY Stats Panel]');
    expect(prompt).toContain('Beat 14 (Cliffhanger): back to gameplay');
    expect(prompt).toContain('In the cutscene (beats 11–13) she is still on screen');
  });
  test('asks for voice clicks only in the gameplay beats, and no phone in 11-13', () => {
    expect(prompt).toContain('In the gameplay beats (1–10 and 14) Lala talks only after JustAWoman clicks her voice icon');
    expect(prompt).toContain('In the cutscene (11–13) she speaks with no click.');
    expect(prompt).not.toContain('her phone comes back for it');
    expect(prompt).toContain('No phone and no phone UI');
  });
  test('owed is paid next episode: never a + coin line', () => {
    expect(prompt).toContain('never a + coin line in this episode');
  });
  test('an event with no host or guests read is still named plainly', () => {
    expect(buildScriptPrompt(inputs({ eventData: { name: 'Gala', cost_coins: 0 } })))
      .toContain("Lala has a real conversation with the event's host and two featured guests of the event.");
  });
});

describe('the show rules after writing', () => {
  test('no voice click goes into 11-13; 10 and 14 get theirs', () => {
    expect([10, 11, 12, 13, 14].map(isCutsceneBeat)).toEqual([false, true, true, true, false]);
    const script = ['10 · Event Travel', '11 · Event Outcome', '12 · Fashion Challenge', '13 · Recap Panel', '14 · Cliffhanger']
      .map((h) => `## BEAT: ${h}\nLala: hi`).join('\n\n');
    const out = scriptWithShowRules(script, {});
    expect(out.voice_clicks).toBe(2);
    expect(out.script).toContain('## BEAT: 10 · Event Travel\n[UI:CLICK Voice Icon]\nLala: hi');
    expect(out.script).toContain('## BEAT: 11 · Event Outcome\nLala: hi');
    expect(out.script).toContain('## BEAT: 13 · Recap Panel\nLala: hi');
    expect(out.script).toContain('## BEAT: 14 · Cliffhanger\n[UI:CLICK Voice Icon]\nLala: hi');
  });
  test('a beat named, not numbered, is read by its name', () => {
    expect(scriptWithShowRules('## BEAT: EVENT_OUTCOME\nLala: hi', {}).voice_clicks).toBe(0);
  });
  test('no phone step goes into 11-13, and 14 starts the phone at home', () => {
    const on = {
      screens: [{ id: 'home', name: 'Home', is_home: true }, { id: 'bank', name: 'Bank Page' }],
      icons: [{ key: 'bank', name: 'Bank', on: 'home', onName: 'Home', opens: 'bank' }, { key: 'pay', name: 'Pay', on: 'bank', onName: 'Bank Page', opens: null }],
    };
    const script = '## BEAT: 12 · Fashion Challenge\n[UI:CLICK Pay]\n\n## BEAT: 14 · Cliffhanger\n[UI:CLICK Bank]';
    expect(scriptWithPhonePaths(script, on)).toEqual({ script, added: 0 });
  });
});
