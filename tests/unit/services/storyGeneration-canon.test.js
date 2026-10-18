/**
 * Stage D: a short story is told it may go beneath the episode, never
 * against it, and once saved it is read for canon (services/storyCanon),
 * unawaited. Other formats are neither told nor read.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));
jest.mock('../../../src/services/storyCanon', () => ({ reviewLater: jest.fn(async () => null) }));
jest.mock('../../../src/services/episodeStoryRecord', () => ({ recordBlock: jest.fn(async () => '') }));

const { generateEpisodeStory } = require('../../../src/services/storyGenerationService');
const { reviewLater } = require('../../../src/services/storyCanon');

const sequelizeWith = ({ saveFails = false } = {}) => ({
  QueryTypes: { SELECT: 'SELECT' },
  query: jest.fn(async (sql) => {
    if (/FROM episodes/.test(sql)) return [{ id: 'ep-1', title: 'The Gala', episode_number: 4, script_content: 'MAREN hides her hand.' }];
    if (/FROM world_events/.test(sql)) return [];
    if (/INSERT INTO stories/.test(sql)) { if (saveFails) throw new Error('db down'); return [[]]; }
    return [[]];
  }),
});

describe('generateEpisodeStory and canon', () => {
  const OLD_KEY = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => {
    if (OLD_KEY === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = OLD_KEY;
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    mockCreate.mockReset().mockResolvedValue({ content: [{ type: 'text', text: 'Prose.' }], usage: {} });
    reviewLater.mockClear();
  });

  test('a short story is told the rule and, once saved, read for canon', async () => {
    const sequelize = sequelizeWith();
    const story = await generateEpisodeStory('ep-1', 'show-1', sequelize, { format: 'short_story' });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('CANON: go beneath the episode, never against it.');
    expect(reviewLater).toHaveBeenCalledWith(sequelize, story.id);
  });

  test('another format is neither told nor read', async () => {
    await generateEpisodeStory('ep-1', 'show-1', sequelizeWith(), { format: 'snippet' });
    expect(mockCreate.mock.calls[0][0].messages[0].content).not.toContain('CANON: go beneath');
    expect(reviewLater).not.toHaveBeenCalled();
  });

  test('a story that was not saved is not read', async () => {
    await generateEpisodeStory('ep-1', 'show-1', sequelizeWith({ saveFails: true }), { format: 'short_story' });
    expect(reviewLater).not.toHaveBeenCalled();
  });
});
