'use strict';

/**
 * The Culture page's lists for the writers (Evoni, 2026-10-18: "yes start
 * fix 3"): the defaults are the page's own; a saved list replaces them,
 * even an empty one; a failed read is logged and uses the defaults; each
 * writer's block says what it needs.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const fs = require('fs');
const path = require('path');
const { DEFAULTS, loadCultureList, awardShowsBlock, gossipMediaBlock, hierarchyBlock } = require('../../../src/services/cultureCanon');

const frontend = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'data', 'calendarData.js'), 'utf8');
const pageList = (name) => {
  const m = new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\n\\]);`).exec(frontend);
  expect(m).toBeTruthy();
  const T = new Proxy({}, { get: (_, k) => String(k) });
  return Function('T', `return ${m[1]}`)(T);
};
const pick = (keys) => (o) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const db = (impl) => ({ PageContent: { findOne: jest.fn(impl) } });

describe('the defaults', () => {
  test('are the Culture page\'s own, as frontend/src/data/calendarData.js has them', () => {
    expect(DEFAULTS.AWARD_SHOWS).toEqual(pageList('AWARD_SHOWS').map(pick(['name', 'month', 'desc', 'categories'])));
    expect(DEFAULTS.GOSSIP_MEDIA).toEqual(pageList('GOSSIP_MEDIA').map(pick(['name', 'focus', 'covers', 'power'])));
    expect(DEFAULTS.CELEBRITY_HIERARCHY).toEqual(pageList('CELEBRITY_HIERARCHY').map(pick(['tier', 'name', 'followers', 'desc'])));
  });
});

describe('loadCultureList', () => {
  test('the saved list (named items only), an empty one too; else the defaults', async () => {
    const saved = db(async () => ({ data: [{ name: 'Velvet Crowns', month: 'May' }, { name: '' }, null] }));
    expect(await loadCultureList(saved, 'AWARD_SHOWS')).toEqual([{ name: 'Velvet Crowns', month: 'May' }]);
    expect(saved.PageContent.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { page_name: 'cultural_calendar', constant_key: 'AWARD_SHOWS' } }));
    expect(await loadCultureList(db(async () => ({ data: [] })), 'GOSSIP_MEDIA')).toEqual([]);
    expect(await loadCultureList(db(async () => null), 'GOSSIP_MEDIA')).toBe(DEFAULTS.GOSSIP_MEDIA);
  });

  test('a failed read is logged and uses the defaults; an unknown list throws', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadCultureList(db(async () => { throw new Error('down'); }), 'CELEBRITY_HIERARCHY')).toBe(DEFAULTS.CELEBRITY_HIERARCHY);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    await expect(loadCultureList({}, 'NOPE')).rejects.toThrow('Unknown culture list');
  });
});

describe('the blocks', () => {
  test('award shows: the year by month, this month\'s named as one of the events', () => {
    const block = awardShowsBlock(DEFAULTS.AWARD_SHOWS, 'November');
    expect(block).toContain('- Starlight Awards (November): The main event. Creator recognition across all categories. Categories: Creator of the Year,');
    expect(block).toContain('- Glow Honors (September)');
    expect(block).toContain('This month is Starlight Awards: unless it already exists, one of the events is it, by that name.');
    expect(awardShowsBlock(DEFAULTS.AWARD_SHOWS, 'October')).toContain('No award show falls in October.');
    expect(awardShowsBlock([], 'May')).toBe('');
  });

  test('gossip media and the hierarchy', () => {
    expect(gossipMediaBlock(DEFAULTS.GOSSIP_MEDIA)).toContain('- The Whisper Wire: Celebrity & influencer gossip; covers Relationship drama, feuds, who unfollowed who. The Whisper Wire always knows.');
    expect(hierarchyBlock(DEFAULTS.CELEBRITY_HIERARCHY)).toContain('- Rising Creators (100K-1M followers): Viral creators, niche experts.');
    expect(hierarchyBlock(DEFAULTS.CELEBRITY_HIERARCHY)).toContain('not the follower_tier values');
    expect(gossipMediaBlock([])).toBe('');
    expect(hierarchyBlock(null)).toBe('');
  });
});

describe('the writers', () => {
  test('the post batch and the direct message carry the outlets', () => {
    const { buildPostBatchPrompt } = require('../../../src/services/pulseDrafter');
    const media = gossipMediaBlock(DEFAULTS.GOSSIP_MEDIA);
    const entry = { profile: { handle: 'a', display_name: 'A' }, voice: { habits_json: {}, examples_json: [] }, character: {} };
    expect(buildPostBatchPrompt([entry], { label: 'now', about: 'x', media })).toContain('- Pop Prism: Entertainment & pop culture');
    const { buildPrompt } = require('../../../src/services/pulseDms');
    const sender = { profile: { id: 1, handle: 'a' }, voice: { habits_json: {}, examples_json: [] }, character: {} };
    expect(buildPrompt({ sender, other: { handle: 'b' }, history: [], topic: 't', label: 'now', known: null, media })).toContain('- Glow Gazette: Beauty industry');
  });

  test('the seasonal-event generator gets the saved award shows, this month\'s named', async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '[]' }], usage: { input_tokens: 1, output_tokens: 1 } });
    const models = {
      StoryCalendarEvent: { findAll: jest.fn(async () => []), create: jest.fn() },
      PageContent: { findOne: jest.fn(async ({ where }) => (where.constant_key === 'AWARD_SHOWS' ? { data: [{ name: 'Velvet Crowns', month: 'May', desc: 'Couture night.' }] } : null)) },
      sequelize: { query: jest.fn(async () => [[], 0]) },
    };
    await require('../../../src/services/seasonalEventService').generateSeasonalEvents(4, null, models, { count: 2, year: 2026 });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('- Velvet Crowns (May): Couture night.');
    expect(prompt).toContain('This month is Velvet Crowns');
    expect(prompt).not.toContain('Starlight Awards');
  });
});
