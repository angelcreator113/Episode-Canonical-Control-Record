// ============================================================================
// Regenerate one beat (Evoni, 2026-10-09, Task #2785): the grounded prompt
// asks for one beat against the script as it stands, and the reply is
// reduced to that beat under its canonical header. No database, no network.
// ============================================================================

const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');
const { beatHeader } = require('../../../src/utils/canonicalScriptBeats');

function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}

const models = () => ({
  EpisodeBrief: { findOne: async () => null },
  ScenePlan: { findAll: async () => [] },
  SceneSet: {},
  sequelize: { query: async () => [[]] },
});

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('beatFromReply', () => {
  const { beatFromReply } = require('../../../src/services/groundedScriptGeneratorService');

  test('keeps only the asked beat, under its canonical header', () => {
    const reply = `## BEAT: 6 · Whatever\nMe: six\n\n## BEAT: 7 · Old name\nMe: seven\nLala: yes bestie\n\n## BEAT: 8 · x\nMe: eight`;
    expect(beatFromReply(reply, 7)).toBe(`${beatHeader(CANONICAL_BEATS[6])}\nMe: seven\nLala: yes bestie`);
  });

  test('a reply without a header becomes the beat under its header', () => {
    expect(beatFromReply('Me: hi besties\n\nLala: hey', 3)).toBe(`${beatHeader(CANONICAL_BEATS[2])}\nMe: hi besties\nLala: hey`);
  });

  test('nothing back, or a beat that is not canonical, is null', () => {
    expect(beatFromReply('  \n', 3)).toBeNull();
    expect(beatFromReply(`## BEAT: 3 · Welcome\n`, 3)).toBeNull();
    expect(beatFromReply('Me: hi', 15)).toBeNull();
  });
});

describe('generateGroundedBeat', () => {
  test('asks for one beat with the script as it stands, and returns that beat', async () => {
    const create = jest.fn(async () => ({ content: [{ text: '## BEAT: 5 · Reveal\nMe: new reveal' }] }));
    mockAnthropic(create);
    const { generateGroundedBeat } = require('../../../src/services/groundedScriptGeneratorService');
    const beat = await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 5, currentScript: '## BEAT: 4 · Interruption Pulse 1\nMe: the old four' });
    expect(beat).toBe(`${beatHeader(CANONICAL_BEATS[4])}\nMe: new reveal`);
    const call = create.mock.calls[0][0];
    expect(call.max_tokens).toBe(1500);
    expect(call.messages[0].content).toContain('Me: the old four');
    expect(call.messages[0].content).toContain('Write ONLY beat 5 again');
    expect(call.messages[0].content).not.toContain('Write the complete 14-beat script now');
  });

  test('tries a second time when the first call fails', async () => {
    const create = jest.fn()
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValueOnce({ content: [{ text: 'Me: second try' }] });
    mockAnthropic(create);
    const { generateGroundedBeat } = require('../../../src/services/groundedScriptGeneratorService');
    expect(await generateGroundedBeat('ep1', 'show-1', models(), { beatNumber: 2, currentScript: '' })).toBe(`${beatHeader(CANONICAL_BEATS[1])}\nMe: second try`);
    expect(create).toHaveBeenCalledTimes(2);
  });

  test('the whole script still asks for all 14 beats, once', async () => {
    const create = jest.fn().mockRejectedValue(new Error('timeout'));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    await expect(generateGroundedScript('ep1', 'show-1', models())).rejects.toThrow('timeout');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].max_tokens).toBe(8000);
    expect(create.mock.calls[0][0].messages[0].content).toContain('Write the complete 14-beat script now');
  });
});
