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
const {
  DEFAULTS, loadCultureList, awardShowsBlock, gossipMediaBlock, hierarchyBlock, schoolsBlock, companiesBlock, economyBlock, profileWorldBlock,
  trendsBlock, loadTrends,
} = require('../../../src/services/cultureCanon');

const data = (file) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'data', file), 'utf8');
const frontend = data('calendarData.js');
const pageList = (name, source = frontend) => {
  const m = new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\n\\]);`).exec(source);
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

  test('the World and Society pages\' lists, as dreamCities.js and influencerData.js have them', () => {
    expect(DEFAULTS.UNIVERSITIES).toEqual(pageList('UNIVERSITIES', data('dreamCities.js')).map(pick(['name', 'city', 'specialization', 'programs', 'significance'])));
    expect(DEFAULTS.CORPORATIONS).toEqual(pageList('CORPORATIONS', data('dreamCities.js')).map(pick(['name', 'industry', 'knownFor', 'power'])));
    expect(DEFAULTS.ECONOMY_STREAMS).toEqual(pageList('ECONOMY_STREAMS', data('influencerData.js')).map(pick(['stream', 'what', 'who'])));
  });

  test('the trends and archives, as influencerData.js and memoryData.js have them', () => {
    expect(DEFAULTS.FASHION_TREND_STAGES).toEqual(pageList('FASHION_TREND_STAGES', data('influencerData.js')).map(pick(['stage', 'name'])));
    expect(DEFAULTS.BEAUTY_TREND_STAGES).toEqual(pageList('BEAUTY_TREND_STAGES', data('influencerData.js')).map(pick(['stage', 'name'])));
    expect(DEFAULTS.MOMENTUM_WAVES).toEqual(pageList('MOMENTUM_WAVES', data('influencerData.js')).map(pick(['event', 'feedEffect'])));
    expect(DEFAULTS.ARCHIVES).toEqual(pageList('ARCHIVES', data('memoryData.js')).map(pick(['name', 'tracks'])));
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

  test('each list from its own page; an economy stream is named by `stream`', async () => {
    const saved = db(async ({ where }) => (where.constant_key === 'ECONOMY_STREAMS' ? { data: [{ stream: 'Prime Coin tips', what: 'x' }, { name: 'no stream' }] } : null));
    expect(await loadCultureList(saved, 'ECONOMY_STREAMS')).toEqual([{ stream: 'Prime Coin tips', what: 'x' }]);
    await loadCultureList(saved, 'UNIVERSITIES');
    expect(saved.PageContent.findOne.mock.calls.map(([q]) => q.where.page_name)).toEqual(['influencer_systems', 'world_infrastructure']);
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

describe('the profile writers\' lists', () => {
  test('schools: their city\'s first, may-have-trained; companies; the economy', () => {
    const schools = schoolsBlock(DEFAULTS.UNIVERSITIES, 'Radiance Row');
    expect(schools).toContain('a creator may have trained at one, most did not; never invent another');
    expect(schools.indexOf('The Radiance Institute')).toBeLessThan(schools.indexOf('The Dazzle Academy'));
    expect(schools).toContain('- The Radiance Institute (Radiance Row): Most prestigious beauty academy; programs: Makeup artistry, Skincare science');
    expect(companiesBlock(DEFAULTS.CORPORATIONS)).toContain('- Pulse Media Network (Talent and media): Talent management, influencer partnerships, brand matchmaking. The middleman');
    expect(companiesBlock(DEFAULTS.CORPORATIONS)).toContain('most have none');
    expect(economyBlock(DEFAULTS.ECONOMY_STREAMS)).toContain('- Event Appearances: Festivals, award shows, industry panels, brand activations. Tier 1-3. Invitation is the signal.');
    expect(schoolsBlock([])).toBe('');
    expect(companiesBlock(null)).toBe('');
    expect(economyBlock([])).toBe('');
  });

  test('profileWorldBlock: the four in order, a city key read as its name', async () => {
    const block = await profileWorldBlock({}, 'ascent_tower');
    const at = (s) => block.indexOf(s);
    expect(at('CELEBRITY HIERARCHY')).toBeGreaterThan(-1);
    expect(at('CELEBRITY HIERARCHY')).toBeLessThan(at('SCHOOLS'));
    expect(at('SCHOOLS')).toBeLessThan(at('BIG COMPANIES'));
    expect(at('BIG COMPANIES')).toBeLessThan(at('MAKE MONEY'));
    expect(block.indexOf('Ascent Tech Institute')).toBeLessThan(block.indexOf('The Dazzle Academy'));
  });
});

describe('the drafter\'s trends and archives', () => {
  test('a few lines: trends in stage order, what moves a career, the archives; none with nothing', async () => {
    const block = trendsBlock({ fashion: [{ stage: 2, name: 'Rising' }, { stage: 1, name: 'Underground' }], waves: DEFAULTS.MOMENTUM_WAVES, archives: DEFAULTS.ARCHIVES });
    expect(block).toContain('most posts need none of it');
    expect(block).toContain('- A fashion trend moves: Underground → Rising.');
    expect(block).not.toContain('A beauty trend moves');
    expect(block).toContain('Award Wins (immediate career trajectory jump)');
    expect(block).toContain('The Whisper Ledger (feuds, breakups, public controversies, cancelled creators, apology records)');
    expect(trendsBlock({})).toBe('');
    expect(trendsBlock(await loadTrends({}))).toContain('- A beauty trend moves: Salon Discovery → Creator Demonstration → Product Launch → Viral Adoption.');
  });

  test('the drafter\'s block is the outlets and the culture', async () => {
    const { mediaBlock } = require('../../../src/services/pulseDrafter');
    const block = await mediaBlock({});
    expect(block).toContain('The Whisper Wire');
    expect(block).toContain('What the LalaVerse remembers');
    expect(block.indexOf('gossip and media outlets')).toBeLessThan(block.indexOf("The LalaVerse's culture"));
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
