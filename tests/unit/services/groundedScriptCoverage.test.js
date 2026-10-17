// ============================================================================
// The Script tab's writer reads what the Script Writer reads, and checks its
// own script (Evoni, 2026-10-15: "when a script is being generated what
// information is it using? Is it making sure everything is being done within
// the script?"). Career, money, the people at the event and the content she
// must make go into the prompt; after writing, each beat missing something
// the episode needs is written again, never an approved one. No database,
// no network.
// ============================================================================

const PIECE = '3f2a9c1e-0000-4000-8000-000000000001';
const story = {
  career: {
    deal: { kind: 'paid', payer: 'Studio Sable', terms: ['300 coins to appear'], bonus: null },
    deliverables: [{ description: 'TikTok outfit reveal', required: true }],
    goals: [{ label: 'Meet Marcus Reed' }],
  },
  financial: { pressure_level: 'tight', balance: 420, total_income: 0, total_expenses: 80, financial_score: 6 },
  socialProfiles: [{ handle: 'marcusreed', display_name: 'Marcus Reed', platform: 'instagram', story_role: 'the agent' }],
  unfeaturedGuestCount: 0,
  socialTasks: [{ label: 'Live from the red carpet', timing: 'during', required: true }],
  previousEpisode: { title: 'The Rooftop', episode_number: 2, tier: 'pass', score: 71, narrative: 'She held her own.' },
  characterState: { coins: 420, reputation: 6, brand_trust: 5, influence: 4, stress: 6 },
  wardrobe: [{ id: PIECE, name: 'Gold slip dress', clothing_category: 'dress', tier: 'luxury' }],
  event: null,
};

const beat = (n, name, ...lines) => [`## BEAT: ${n} · ${name}`, ...lines].join('\n');
const NAMES = ['Opening Ritual', 'Login Sequence', 'Welcome', 'Interruption Pulse 1', 'Reveal', 'Strategic Reaction', 'Interruption Pulse 2', 'Transformation Loop', 'Reminder/Deadline', 'Event Travel', 'Event Outcome', 'Deliverable Creation', 'Recap Panel', 'Cliffhanger'];
// A first draft that covers everything but the deliverable (beat 12) and the wear cue (beat 8).
const draft = NAMES.map((name, i) => {
  const n = i + 1;
  if (n === 8) return beat(8, name, '[UI:OPEN Closet]', 'Lala: the gold slip dress');
  // Lala talks once her voice icon is clicked; beat 5 brings up the invitation (show rules, 2026-10-17).
  if (n === 5) return beat(5, name, '[UI:OPEN Invitation]');
  if (n === 11) return beat(11, name, '[UI:CLICK Voice Icon]', 'Lala: I finally get to meet Marcus Reed');
  if (n === 12) return beat(12, name, '[UI:OPEN Camera]', '[UI:CLICK Voice Icon]', 'Lala: a quiet moment');
  if (n === 14) return beat(14, name, 'Me: and then the DM arrives');
  return beat(n, name, [4, 5, 7, 9, 10].includes(n) ? '[UI:OPEN Mail]' : 'Me: hi');
}).join('\n\n');

function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}
const models = () => ({
  EpisodeBrief: { findOne: async () => ({ forward_hook: 'and then the DM arrives' }) },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
});

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
    ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
    loadScriptContext: async () => story,
  }));
});
afterEach(() => jest.restoreAllMocks());

const reply = (text) => ({ content: [{ text }] });
const whenBeat = (n, text) => (call) => call.messages[0].content.includes(`Write ONLY beat ${n} again`) && reply(text);

describe("the Script tab's writer", () => {
  test("reads Lala's career, money, the people at the event, her content tasks and the last episode", async () => {
    const create = jest.fn(async () => reply(draft));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    await generateGroundedScript('ep1', 'show-1', models());
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("═══ LALA'S CAREER IN THIS EPISODE ═══");
    expect(prompt).toContain('Studio Sable is offering Lala 300 coins to appear');
    expect(prompt).toContain('TikTok outfit reveal');
    expect(prompt).toContain('Meet Marcus Reed');
    expect(prompt).toContain('═══ FINANCIAL CONTEXT ═══');
    expect(prompt).toContain("Lala's balance: 420 Prime Coins");
    expect(prompt).toContain('═══ CHARACTERS AT THE EVENT ═══');
    expect(prompt).toContain('Live from the red carpet');
    expect(prompt).toContain('═══ PREVIOUS EPISODE ═══');
    expect(prompt).toContain(`- Gold slip dress (dress, luxury) [WEAR: ${PIECE}]`);
    expect(prompt).toContain("7. Lala's career is on the page");
  });

  test('rewrites the beats missing what the episode needs, and reports nothing left', async () => {
    const create = jest.fn(async (call) => whenBeat(8, beat(8, 'Transformation Loop', '[UI:OPEN Closet]', 'Lala: the gold slip dress', `[WEAR: ${PIECE}]`))(call)
      || whenBeat(12, beat(12, 'Deliverable Creation', '[UI:OPEN Camera]', 'Lala: filming my TikTok outfit reveal for Sable'))(call)
      || reply(draft));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const out = await generateGroundedScript('ep1', 'show-1', models());
    expect(create).toHaveBeenCalledTimes(3);
    const asks = create.mock.calls.slice(1).map((c) => c[0].messages[0].content);
    expect(asks.find((p) => p.includes('Write ONLY beat 8 again'))).toContain(`[WEAR: ${PIECE}]`);
    expect(asks.find((p) => p.includes('Write ONLY beat 12 again'))).toContain('TikTok outfit reveal');
    expect(out.coverage).toEqual({ missing: [], fixed_beats: [8, 12], phone_steps: 0, voice_clicks: 1, reveal_fixed: false, story_gaps: expect.any(Array) });
    expect(out.script).toContain(`[WEAR: ${PIECE}]`);
    expect(out.script).toContain('filming my TikTok outfit reveal');
  });

  test('never rewrites an approved beat; what it lacks is reported', async () => {
    const create = jest.fn(async (call) => whenBeat(8, beat(8, 'Transformation Loop', '[UI:OPEN Closet]', `[WEAR: ${PIECE}]`))(call) || reply(draft));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const locked = [{ number: 12, text: beat(12, 'Deliverable Creation', '[UI:OPEN Camera]', 'Lala: approved words') }];
    const out = await generateGroundedScript('ep1', 'show-1', models(), { lockedBeats: locked });
    const asks = create.mock.calls.slice(1).map((c) => c[0].messages[0].content);
    expect(asks.some((p) => p.includes('Write ONLY beat 12 again'))).toBe(false);
    expect(out.script).toContain('Lala: approved words');
    expect(out.coverage.missing).toEqual([expect.objectContaining({ kind: 'deliverable', target: 12 })]);
  });

  test('a beat that did not come back is written and put in its place', async () => {
    const cut = draft.split('## BEAT: 14')[0].trimEnd();
    const create = jest.fn(async (call) => whenBeat(14, beat(14, 'Cliffhanger', 'Me: and then the DM arrives'))(call)
      || whenBeat(8, beat(8, 'Transformation Loop', '[UI:OPEN Closet]', `[WEAR: ${PIECE}]`))(call)
      || whenBeat(12, beat(12, 'Deliverable Creation', '[UI:OPEN Camera]', 'Lala: my TikTok outfit reveal'))(call)
      || reply(cut));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const out = await generateGroundedScript('ep1', 'show-1', models());
    expect(out.script.trimEnd().endsWith('Me: and then the DM arrives')).toBe(true);
    expect(out.coverage.fixed_beats).toEqual([8, 12, 14]);
    expect(out.coverage.missing).toEqual([]);
  });

  // Script tab re-audit (2026-10-15).
  test('a first draft that is not a script (a refusal) is refused before any fix is paid for', async () => {
    const create = jest.fn(async () => reply('Sorry, I cannot help with that.'));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    await expect(generateGroundedScript('ep1', 'show-1', models())).rejects.toMatchObject({ code: 'DRAFT_INCOMPLETE', found: 0 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('a draft cut off at its limit gets its lost beats written first', async () => {
    const cut = draft.split('## BEAT: 10')[0].trimEnd();
    const create = jest.fn(async (call) => {
      const asked = call.messages[0].content.match(/Write ONLY beat (\d+) again/);
      if (!asked) return { ...reply(cut), stop_reason: 'max_tokens' };
      const n = Number(asked[1]);
      return reply(beat(n, NAMES[n - 1], n === 14 ? 'Me: and then the DM arrives' : `Me: beat ${n}`, '[UI:OPEN Mail]'));
    });
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const out = await generateGroundedScript('ep1', 'show-1', models());
    const asked = create.mock.calls.slice(1).map((c) => Number(c[0].messages[0].content.match(/Write ONLY beat (\d+) again/)[1])).sort((a, b) => a - b);
    expect(asked).toEqual([10, 11, 12, 13, 14]);
    expect(out.coverage.fixed_beats).toEqual([10, 11, 12, 13, 14]);
    expect(out.coverage.missing.some((g) => g.kind === 'beat')).toBe(false);
  });

  test('a fix that is not the beat, or covers nothing more, leaves the beat as written', async () => {
    const create = jest.fn(async (call) => whenBeat(8, beat(8, 'Transformation Loop', '[UI:OPEN Closet]', 'Lala: a different dress'))(call)
      || whenBeat(12, "Sorry, I can't write that.")(call)
      || reply(draft));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const out = await generateGroundedScript('ep1', 'show-1', models());
    expect(out.script).toBe(draft);
    expect(out.coverage.fixed_beats).toEqual([]);
    expect(out.coverage.missing.map((g) => g.target).sort((a, b) => a - b)).toEqual([8, 12]);
  });

  // Re-audit 2 (2026-10-15).
  test('a missing phone beat goes back even without its phone line, and is asked for one', async () => {
    const cut = draft.replace(/## BEAT: 10[^#]*/, '').trimEnd();
    const create = jest.fn(async (call) => whenBeat(10, beat(10, 'Event Travel', 'Me: off to the gala'))(call)
      || whenBeat(8, beat(8, 'Transformation Loop', '[UI:OPEN Closet]', `[WEAR: ${PIECE}]`))(call)
      || whenBeat(12, beat(12, 'Deliverable Creation', '[UI:OPEN Camera]', 'Lala: my TikTok outfit reveal'))(call)
      || reply(cut));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const out = await generateGroundedScript('ep1', 'show-1', models());
    const ask = create.mock.calls.map((c) => c[0].messages[0].content).find((p) => p.includes('Write ONLY beat 10 again'));
    expect(ask).toContain('at least one [UI:VERB Target] line');
    expect(out.script).toContain('Me: off to the gala');
    expect(out.coverage.fixed_beats).toContain(10);
  });

  test('with nine beats approved, a reply with none of the others is refused', async () => {
    const create = jest.fn(async () => reply("I'm sorry, I can't help write this script."));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const lockedBeats = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ number: n, text: beat(n, NAMES[n - 1], 'Me: approved') }));
    await expect(generateGroundedScript('ep1', 'show-1', models(), { lockedBeats })).rejects.toMatchObject({ code: 'DRAFT_INCOMPLETE' });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

