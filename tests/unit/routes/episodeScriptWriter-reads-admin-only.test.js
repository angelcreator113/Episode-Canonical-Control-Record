/**
 * The Script Writer's reads are an ADMIN's (Evoni, 2026-11-22): GET
 * /api/v1/episode-scripts/:episodeId, /:episodeId/version/:version,
 * /:episodeId/latest and /:episodeId/context answered any signed-in account
 * with a version's text at any status. They now need a sign-in in the admin
 * group. For an admin the answers are as the Script Writer page reads them;
 * the version reads select the model's columns by name
 * (services/scriptReadFields).
 *
 * The real router and auth middleware; the model and the context loader are
 * stand-ins, so no database is read and no model is asked.
 */
const mockFindAll = jest.fn();
const mockFindOne = jest.fn();
const mockLoadContext = jest.fn();
jest.mock('../../../src/models', () => ({
  EpisodeScript: { findAll: (...a) => mockFindAll(...a), findOne: (...a) => mockFindOne(...a), findByPk: jest.fn(async () => null) },
}));
jest.mock('../../../src/services/episodeScriptWriterService', () => ({
  loadScriptContext: (...a) => mockLoadContext(...a), generateEpisodeScript: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const { WRITER_SCRIPT_LIST_FIELDS, WRITER_SCRIPT_FIELDS } = require('../../../src/services/scriptReadFields');
const EpisodeScriptModel = jest.requireActual('../../../src/models/EpisodeScript');

const app = express();
app.use(express.json());
app.use('/api/v1/episode-scripts', require('../../../src/routes/episodeScriptWriterRoutes'));

const EP = '11111111-1111-4111-8111-111111111111';
const SHOW = '33333333-3333-4333-8333-333333333333';
const token = (groups) => TokenService.generateTokenPair({
  id: `writer-${groups.join('-') || 'none'}`, email: 'writer@test.dev', name: 'writer', groups, role: groups[0],
}).accessToken;
const get = (path, auth) => {
  const r = request(app).get(`/api/v1/episode-scripts/${EP}${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const VERSION = {
  id: 'es-1', episode_id: EP, version: 2, status: 'draft', title: 'Gala Night', word_count: 900, beat_count: 14, voice_score: 80,
  script_text: 'Lala: The unpublished line.', script_json: [{ beat_number: 1, lines: [] }],
  context_snapshot: { brain_rules: { used: [] } }, financial_context: { balance: 12 }, created_at: '2026-11-01T00:00:00Z',
};
const CONTEXT = {
  brief: { episode_archetype: 'Trial' }, scenePlan: [{}, {}], event: { name: 'Gala', prestige: 7 }, financial: { balance: 12 },
  wardrobe: [{}], feedMoments: [{}, {}, {}], franchiseLaws: [{}], brainRules: { used: [], unused: [] }, opportunities: [],
};

const READS = ['', '/version/2', '/latest', `/context?showId=${SHOW}`];
const NOT_ADMIN = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []];

beforeEach(() => {
  jest.clearAllMocks();
  mockFindAll.mockResolvedValue([VERSION]);
  mockFindOne.mockResolvedValue(VERSION);
  mockLoadContext.mockResolvedValue(CONTEXT);
});
const readerCalls = () => mockFindAll.mock.calls.length + mockFindOne.mock.calls.length + mockLoadContext.mock.calls.length;

describe('the Script Writer reads need a sign-in in the admin group', () => {
  test.each(READS)('signed out: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, null);
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
    expect(readerCalls()).toBe(0);
  });

  test.each(READS)('signed in but not an admin: GET %s is a 403 and reads nothing', async (path) => {
    for (const groups of NOT_ADMIN) {
      const res = await get(path, token(groups));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('unpublished line');
    }
    expect(readerCalls()).toBe(0);
  });

  test.each(READS)('an admin: GET %s is a 200', async (path) => {
    expect((await get(path, token(['ADMIN']))).status).toBe(200);
  });
});

describe('an admin gets what the Script Writer page reads', () => {
  const admin = token(['ADMIN']);

  test('the list: the live versions, newest first, by the list names (never the text)', async () => {
    const res = await get('', admin);
    expect(res.body).toEqual({ data: [VERSION], count: 1 });
    const query = mockFindAll.mock.calls[0][0];
    expect(query.where).toEqual({ episode_id: EP, deleted_at: null });
    expect(query.order).toEqual([['version', 'DESC']]);
    expect(query.attributes).toEqual([...WRITER_SCRIPT_LIST_FIELDS]);
    for (const k of ['script_text', 'script_json', 'context_snapshot']) expect(query.attributes).not.toContain(k);
  });

  test('one version and the latest: the whole version, its columns asked for by name', async () => {
    const one = await get('/version/2', admin);
    expect(one.body).toEqual({ data: VERSION });
    expect(mockFindOne.mock.calls[0][0]).toEqual({ where: { episode_id: EP, version: 2, deleted_at: null }, attributes: [...WRITER_SCRIPT_FIELDS] });
    const latest = await get('/latest', admin);
    expect(latest.body).toEqual({ data: VERSION });
    expect(mockFindOne.mock.calls[1][0]).toEqual({ where: { episode_id: EP, deleted_at: null }, order: [['version', 'DESC']], attributes: [...WRITER_SCRIPT_FIELDS] });
  });

  test('no version is a 404', async () => {
    mockFindOne.mockResolvedValue(null);
    expect((await get('/version/9', admin)).status).toBe(404);
    expect((await get('/latest', admin)).status).toBe(404);
  });

  test('the context: what will feed the generation, as it was', async () => {
    const res = await get(`/context?showId=${SHOW}`, admin);
    expect(mockLoadContext).toHaveBeenCalledWith(EP, SHOW, expect.anything());
    expect(res.body.data).toEqual({
      has_brief: true, brief_archetype: 'Trial', scene_plan_beats: 2, has_event: true, event_name: 'Gala', event_prestige: 7,
      financial: { balance: 12 }, wardrobe_items: 1, feed_moments: 3, franchise_laws: 1, brain_rules: { used: [], unused: [] },
      opportunities: 0, ready: true,
    });
    expect((await get('/context', admin)).status).toBe(400);
  });

  test('a failed read is a 500 and is logged', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFindAll.mockRejectedValue(new Error('down'));
    expect((await get('', admin)).status).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('the names a version read asks for', () => {
  // The model as it is defined, with a stand-in for Sequelize.
  let columns;
  EpisodeScriptModel({ define: (_name, attributes) => { columns = Object.keys(attributes); return {}; } });

  test('are the model\'s own columns and its two timestamps: every one, and no other', () => {
    expect([...WRITER_SCRIPT_FIELDS].sort()).toEqual([...columns, 'created_at', 'updated_at'].sort());
  });
  test('the page\'s fields are among them', () => {
    for (const k of ['id', 'episode_id', 'version', 'status', 'word_count', 'beat_count', 'voice_score', 'context_snapshot', 'script_json', 'script_text']) {
      expect(WRITER_SCRIPT_FIELDS).toContain(k);
    }
  });
  test('the list names are a part of them, without the text', () => {
    for (const k of WRITER_SCRIPT_LIST_FIELDS) expect(WRITER_SCRIPT_FIELDS).toContain(k);
    for (const k of ['script_text', 'script_json']) expect(WRITER_SCRIPT_LIST_FIELDS).not.toContain(k);
  });
});

describe('the writes are as they were', () => {
  test('signed out, a write is still a 401', async () => {
    expect((await request(app).put('/api/v1/episode-scripts/es-1').send({})).status).toBe(401);
  });
  test('signed in and not an admin, a write is not refused for the group', async () => {
    const res = await request(app).put('/api/v1/episode-scripts/es-1').set('Authorization', `Bearer ${token(['USER'])}`).send({});
    expect(res.status).toBe(404);
  });
});
