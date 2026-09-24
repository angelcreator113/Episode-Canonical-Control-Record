/**
 * Event organizer readers (Task #1791) — each reader that used to find the
 * creator organizer through canon_consequences.automation alone now reads
 * source_profile_id first (eventCreatorOrganizer, src/utils/eventOrganizer.js)
 * and falls back to the automation copy.
 *
 * Four cases per reader: (a) source_profile_id only, (b) the automation
 * copy only, (c) both naming the same person, (d) a brand organizer with
 * neither. Mocked; no database.
 *
 * episodeGeneratorService (social tasks), todoListService (social tasks)
 * and the generate-overlay route (social overlay) sit behind S3, canvas and
 * the full episode generator; for those, the guard at the bottom checks
 * they take the creator from eventCreatorOrganizer and read no automation
 * host id of their own. The helper's four cases are in
 * tests/unit/utils/eventOrganizer.test.js.
 */

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: jest.fn().mockRejectedValue(new Error('stop after the prompt is built')) },
})));

const fs = require('fs');
const path = require('path');
const { syncAfterEvent, generatePostEventOpportunities } = require('../../../src/services/characterSyncService');
const { generatePostEventActivity } = require('../../../src/services/feedActivityService');
const { generateSocialChecklist } = require('../../../src/services/socialChecklistService');
const { loadScriptContext } = require('../../../src/services/episodeScriptWriterService');
const { generateEpisodeStory } = require('../../../src/services/storyGenerationService');

const PROFILES = {
  7: { id: 7, handle: 'mika', display_name: 'Mika', platform: 'instagram', content_category: 'fashion', archetype: 'host' },
  9: { id: 9, handle: 'noor', display_name: 'Noor', platform: 'tiktok', content_category: 'beauty', archetype: 'host' },
};

// The four cases. `expected` is the creator each reader must find.
const CASES = [
  ['(a) source_profile_id only', { source_profile_id: 7, host: 'Mika', canon_consequences: { automation: { guest_profiles: [] } } }, 7],
  ['(b) the automation copy only', { source_profile_id: null, canon_consequences: { automation: { host_profile_id: 7, host_handle: 'mika', host_display_name: 'Mika', guest_profiles: [] } } }, 7],
  ['(c) both naming the same person', { source_profile_id: 7, canon_consequences: { automation: { host_profile_id: 7, host_handle: 'mika', host_display_name: 'Mika', guest_profiles: [] } } }, 7],
  ['(d) a brand organizer with neither', { source_profile_id: null, host_brand: 'Velour', canon_consequences: { automation: { host_brand: 'Velour', guest_profiles: [] } } }, null],
];
const withBase = (ev) => ({ id: 'event-1', show_id: 'show-1', name: 'Velour Garden Night', event_type: 'invite', prestige: 5, ...ev });

// Column and copy naming different people: the column wins.
const DIFFERENT = withBase({ source_profile_id: 9, canon_consequences: { automation: { host_profile_id: 7, host_handle: 'mika', host_display_name: 'Mika', guest_profiles: [] } } });

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

describe('characterSyncService.syncAfterEvent — the host profile it updates', () => {
  const run = async (event) => {
    const seen = [];
    const findByPk = jest.fn(async (id) => {
      seen.push(id);
      const p = PROFILES[id];
      return p ? { ...p, full_profile: {}, lala_relevance_score: 0, current_state: 'rising', update: jest.fn() } : null;
    });
    const result = await syncAfterEvent(event, { id: 'ep-1', episode_number: 1, evaluation_json: null }, { SocialProfile: { findByPk } });
    return { seen, result };
  };
  test.each(CASES)('%s', async (_label, ev, expected) => {
    const { seen, result } = await run(withBase(ev));
    expect(seen).toEqual(expected === null ? [] : [expected]);
    expect(result.updated).toBe(expected === null ? 0 : 1);
  });
  test('an event with no automation copy at all still updates its organizer', async () => {
    const { seen } = await run(withBase({ source_profile_id: 7, canon_consequences: {} }));
    expect(seen).toEqual([7]);
  });
  test('column and copy naming different people: the column', async () => {
    expect((await run(DIFFERENT)).seen).toEqual([9]);
  });
});

describe('characterSyncService.generatePostEventOpportunities — the connector handle', () => {
  const run = async (event) => {
    const created = [];
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const Opportunity = { create: jest.fn(async (row) => { created.push(row); return row; }) };
    await generatePostEventOpportunities({ ...event, prestige: 9 }, { evaluation_json: { tier_final: 'slay' } }, { Opportunity });
    Math.random.mockRestore();
    return created.map(o => o.connector_handle);
  };
  test.each(CASES)('%s', async (_label, ev, expected) => {
    const handles = await run(withBase(ev));
    // The copy's handle is used only when it names this creator; a
    // column-only event has none here (this function queries no profile).
    const copyNamesCreator = expected !== null && String(ev.canon_consequences.automation.host_profile_id) === String(expected);
    expect(handles.every(h => h === (copyNamesCreator ? 'mika' : null))).toBe(true);
  });
  test('column and copy naming different people: the copy\'s handle is not used', async () => {
    expect((await run(DIFFERENT)).every(h => h === null)).toBe(true);
  });
});

describe('feedActivityService.generatePostEventActivity — the host post', () => {
  const run = async (event) => {
    const models = {
      SocialProfile: { findByPk: jest.fn(async (id) => PROFILES[id] || null) },
      sequelize: { query: jest.fn(async () => [[]]) },
    };
    const posts = await generatePostEventActivity(event, models);
    return posts.filter(p => p.role === 'host');
  };
  test.each(CASES)('%s', async (_label, ev, expected) => {
    const host = await run(withBase(ev));
    if (expected === null) {
      expect(host).toEqual([]);
    } else {
      expect(host).toHaveLength(1);
      expect(host[0]).toMatchObject({ profile_id: expected, handle: 'mika' });
    }
  });
  test('an event with no automation copy at all still gets its organizer\'s post', async () => {
    const host = await run(withBase({ source_profile_id: 7, canon_consequences: {} }));
    expect(host[0]).toMatchObject({ profile_id: 7, handle: 'mika' });
  });
  test('column and copy naming different people: the column, with its own handle', async () => {
    const host = await run(DIFFERENT);
    expect(host[0]).toMatchObject({ profile_id: 9, handle: 'noor' });
    expect(host[0].content).not.toMatch(/mika/);
  });
});

describe('socialChecklistService.generateSocialChecklist — the host profile it queries', () => {
  const run = async (event) => {
    const ids = [];
    const query = jest.fn(async (sql, opts = {}) => {
      if (/FROM social_profiles/.test(sql)) {
        ids.push(opts.replacements.id);
        return [[PROFILES[opts.replacements.id]].filter(Boolean)];
      }
      return [[]];
    });
    const { tasks } = await generateSocialChecklist(event, { sequelize: { query } }, { forceRebuild: true });
    return { ids, tasks };
  };
  test.each(CASES)('%s', async (_label, ev, expected) => {
    const { ids, tasks } = await run(withBase(ev));
    expect(ids).toEqual(expected === null ? [] : [expected]);
    const text = JSON.stringify(tasks);
    if (expected !== null) expect(text).toMatch(/@mika/);
  });
  test('column and copy naming different people: the column, with its own handle', async () => {
    const { ids, tasks } = await run(DIFFERENT);
    expect(ids).toEqual([9]);
    expect(JSON.stringify(tasks)).not.toMatch(/@mika/);
  });
});

describe('episodeScriptWriterService.loadScriptContext — the host in the script prompt', () => {
  const run = async (event) => {
    const asked = [];
    const QueryTypes = { SELECT: 'SELECT' };
    const models = {
      EpisodeBrief: { findOne: async () => null },
      ScenePlan: { findAll: async () => [] },
      SceneSet: {}, SceneAngle: {}, FranchiseKnowledge: null, WorldLocation: null, Opportunity: null,
      WorldEvent: { CURRENT_ATTRIBUTES: ['id'], findOne: async () => ({ toJSON: () => event }) },
      Episode: { findByPk: async () => null },
      sequelize: {
        QueryTypes,
        query: jest.fn(async (sql, options = {}) => {
          if (/FROM social_profiles/.test(sql)) {
            asked.push(...options.replacements.ids);
            return [options.replacements.ids.map(id => PROFILES[id]).filter(Boolean)];
          }
          return options.type === QueryTypes.SELECT ? [] : [[]];
        }),
      },
    };
    const context = await loadScriptContext('ep-1', 'show-1', models);
    return { asked, ids: context.socialProfiles.map(p => p.id) };
  };
  test.each(CASES)('%s', async (_label, ev, expected) => {
    const { asked, ids } = await run(withBase(ev));
    expect(asked).toEqual(expected === null ? [] : [expected]);
    expect(ids).toEqual(expected === null ? [] : [expected]);
  });
  test('column and copy naming different people: the column', async () => {
    expect((await run(DIFFERENT)).asked).toEqual([9]);
  });
});

describe('storyGenerationService.generateEpisodeStory — the host in the story prompt', () => {
  const OLD_KEY = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });
  afterAll(() => { if (OLD_KEY === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = OLD_KEY; });

  const run = async (event) => {
    const asked = [];
    let eventSql = '';
    const sequelize = {
      QueryTypes: { SELECT: 'SELECT' },
      query: jest.fn(async (sql, opts = {}) => {
        if (/FROM episodes/.test(sql)) return [{ id: 'ep-1', title: 'Ep', episode_number: 1 }];
        if (/FROM world_events/.test(sql)) { eventSql = sql; return [event]; }
        if (/FROM social_profiles/.test(sql)) { asked.push(...opts.replacements.ids); return [[]]; }
        return [[]];
      }),
    };
    await expect(generateEpisodeStory('ep-1', 'show-1', sequelize)).rejects.toThrow('stop after the prompt is built');
    return { asked, eventSql };
  };
  test.each(CASES)('%s', async (_label, ev, expected) => {
    const { asked, eventSql } = await run(withBase(ev));
    expect(eventSql).toMatch(/source_profile_id/);
    expect(asked).toEqual(expected === null ? [] : [expected]);
  });
  test('column and copy naming different people: the column', async () => {
    expect((await run(DIFFERENT)).asked).toEqual([9]);
  });
});

describe('readers behind S3/canvas — take the creator from eventCreatorOrganizer', () => {
  const root = path.join(__dirname, '../../..');
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const between = (src, start, end) => {
    const i = src.indexOf(start);
    const j = src.indexOf(end, i + start.length);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    return src.slice(i, j);
  };

  test('episodeGeneratorService — social tasks (step 4, Create Todo List)', () => {
    const block = between(read('src/services/episodeGeneratorService.js'), '── 4. Create Todo List', 'guest_names:');
    expect(block).toMatch(/eventCreatorOrganizer\(event\)/);
    expect(block).not.toMatch(/automation\.host_(profile_id|handle|display_name)/);
  });
  test('todoListService.generateEpisodeTodoList — social tasks', () => {
    const block = between(read('src/services/todoListService.js'), 'If no social tasks exist yet', 'buildSocialTasks(eventType, hostProfile)');
    expect(block).toMatch(/eventCreatorOrganizer\(event\)/);
    expect(block).not.toMatch(/host_profile_id/);
  });
  test('worldEvents.js generate-overlay — social overlay', () => {
    const block = between(read('src/routes/worldEvents.js'), "overlayType === 'social'", 'renderSocialChecklist');
    expect(block).toMatch(/eventCreatorOrganizer\(event\)/);
    expect(block).not.toMatch(/host_profile_id/);
  });
});
