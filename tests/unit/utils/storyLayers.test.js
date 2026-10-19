// ============================================================================
// Story layers (Evoni, 2026-10-17): each beat has its own story job, and the
// writer reads the main plot, the personal subplot and the larger arc from
// what the show holds. A layer with nothing to draw on is a gap, kept to
// this episode, never invented history. No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');
const { storyLayers } = require('../../../src/utils/storyLayers');

const FULL_INPUTS = {
  brief: { forward_hook: 'A second invitation arrives, unsigned.' },
  eventData: { name: 'Stable Design Preview', narrative_stakes: 'The chosen look leads the campaign.', rewards: JSON.stringify({ outcomes: ['Stable asks her back'] }) },
  seasonContext: { story_purposes: [{ text: 'Lala learns success can cost a friendship', primary: true, story_thread: 'Rising Star' }] },
  story: { socialProfiles: [
    { creator_name: 'Mira', handle: 'mira', lala_relationship: 'direct' },
    { creator_name: 'Stranger', handle: 'stranger', lala_relationship: null },
    { creator_name: 'JustAWoman', handle: 'jaw', lala_relationship: 'justawoman' },
  ] },
};

test('every beat has its own story job', () => {
  expect(CANONICAL_BEATS.every((b) => typeof b.story_job === 'string' && b.story_job.length > 20)).toBe(true);
  expect(new Set(CANONICAL_BEATS.map((b) => b.story_job)).size).toBe(14);
  const job = (n) => CANONICAL_BEATS.find((b) => b.number === n).story_job;
  expect(job(3)).toContain('No message and no app: the only phone moment is the voice click');
  expect(job(4)).toContain('only who it is from');
  expect(job(5)).toContain('The full invitation');
  expect(job(11)).toContain('before the result');
  expect(job(13)).toContain('Lala says how the outcome feels');
});

test('the layers come from what the show holds', () => {
  const { text, gaps } = storyLayers(FULL_INPUTS);
  expect(gaps).toEqual([]);
  expect(text).toContain('═══ STORY LAYERS ═══');
  expect(text).toContain('Main plot: can Lala succeed at Stable Design Preview? Stakes: The chosen look leads the campaign.');
  expect(text).toContain('Personal subplot, what success will cost her: Lala learns success can cost a friendship (thread: Rising Star)');
  expect(text).toContain('Larger arc: thread "Rising Star"; Stable asks her back; forward hook: A second invitation arrives, unsigned.');
  // Only someone with a tie to Lala; never JustAWoman herself.
  expect(text).toContain('Beat 7 message, from someone with an established tie to Lala: Mira (friends; they talk directly)');
  expect(text).not.toContain('Stranger (');
  expect(text).not.toContain('JustAWoman (');
  expect(text).toContain('never invent established history');
  expect(text).toContain('mentions only what they could plausibly know');
  expect(text).toContain('one private exchange at beat 7 is the default, a second at beat 14 optional');
  expect(text).toContain('it never stands in for this episode\'s payoff');
});

test('a layer with nothing to draw on is a gap, and the writer is told so', () => {
  const { text, gaps } = storyLayers({});
  expect(gaps.map((g) => g.layer)).toEqual(['main', 'personal', 'arc', 'sender']);
  expect(text).toContain('Personal subplot: NOT GIVEN');
  expect(text).toContain('Beat 7 message: NO ESTABLISHED SENDER');
  expect(text).toContain('give them no shared history');
});

test('bad event rewards are logged and read as none', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { gaps } = storyLayers({ ...FULL_INPUTS, brief: null, seasonContext: null, eventData: { name: 'X', rewards: '{bad' } });
  expect(gaps.map((g) => g.layer)).toEqual(['personal', 'arc']);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

describe('in the writer', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.doMock('../../../src/services/episodeScriptWriterService', () => ({
      ...jest.requireActual('../../../src/services/episodeScriptWriterService'),
      loadScriptContext: async () => null,
    }));
    jest.doMock('../../../src/services/phoneOverlays', () => ({ overlayStatusForShow: async () => [] }));
  });
  afterEach(() => jest.restoreAllMocks());

  test('the prompt gives each beat its story job and the layers; coverage names the gaps', async () => {
    const FULL = CANONICAL_BEATS.map((b) => `${beatHeader(b)}\nMe: hi`).join('\n\n');
    const create = jest.fn(async () => ({ content: [{ text: FULL }] }));
    const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
    Anthropic.default = Anthropic;
    jest.doMock('@anthropic-ai/sdk', () => Anthropic);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const written = await generateGroundedScript('ep1', 'show-1', {
      EpisodeBrief: { findOne: async () => null },
      ScenePlan: { findAll: async () => [] },
      SceneSet: {},
      sequelize: { query: async () => [[]] },
    });
    const prompt = create.mock.calls[0][0].messages[0].content;
    for (const b of CANONICAL_BEATS) expect(prompt).toContain(`Story job: ${b.story_job}`);
    // Beat 13: Lala has a line (Evoni, 2026-10-17).
    expect(prompt).toMatch(/## BEAT: 13 · Recap Panel[\s\S]*?JAWIHP speaks: true \| Lala speaks: true/);
    expect(prompt).toContain('═══ STORY LAYERS ═══');
    expect(prompt.indexOf('═══ STORY LAYERS ═══')).toBeLessThan(prompt.indexOf('═══ SCENE PLAN'));
    expect(written.coverage.story_gaps.map((g) => g.layer)).toEqual(['main', 'personal', 'arc', 'sender']);
  });
});
