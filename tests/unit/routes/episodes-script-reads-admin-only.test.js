/**
 * The script reads under an episode are an ADMIN's (Evoni, 2026-11-22):
 * GET /api/v1/episodes/:id/script-versions, /:id/script-versions/:versionId,
 * /:episodeId/scripts and /:episodeId/scripts/:scriptType/versions. They
 * answered any signed-in account with the script's text at any status. They
 * now need a sign-in in the admin group, and the two scripts reads answer
 * with named fields only (services/scriptReadFields).
 *
 * The real router, auth middleware and controller; the models, the scripts
 * service and the two version readers are stand-ins, so no database is read.
 * The rows carry columns the routes must never send.
 */
jest.mock('../../../src/models', () => ({
  // The controllers episodes.js requires destructure this map at load.
  models: {},
  EpisodeScriptVersion: {},
}));
jest.mock('../../../src/services/scriptsService', () => ({
  getScriptsByEpisode: jest.fn(),
  getScriptVersions: jest.fn(),
  createScript: jest.fn(),
}));
jest.mock('../../../src/services/scriptVersions', () => ({
  ...jest.requireActual('../../../src/services/scriptVersions'),
  listVersions: jest.fn(),
  getVersion: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const scriptsService = require('../../../src/services/scriptsService');
const scriptVersions = require('../../../src/services/scriptVersions');
const { SCRIPT_FIELDS, SCRIPT_CONTENT_FIELDS, SCRIPT_VERSION_FIELDS } = require('../../../src/services/scriptReadFields');

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', require('../../../src/routes/episodes'));

const EP = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const token = (groups) => TokenService.generateTokenPair({
  id: `ep-scripts-${groups.join('-') || 'none'}`, email: 'scripts@test.dev', name: 'scripts', groups, role: groups[0],
}).accessToken;
const get = (path, auth) => {
  const r = request(app).get(`/api/v1/episodes/${EP}${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

// A column no allowlist names, as a table may gain one later.
const UNEXPECTED = { internal_notes: 'not for anyone', financial_context: { balance: 12 }, author_notes: 'private', notes: 'a note', is_current: true, deleted_at: null };
const DRAFT = {
  id: 'sc-1', episode_id: EP, script_type: 'main', version: 3, version_number: 3, version_label: 'Draft 3',
  author: 'Evoni', status: 'draft', duration: 600, scene_count: 14, file_format: 'fountain',
  file_url: 'https://files.example/script.fountain', file_size: 1234, is_primary: true, is_latest: true,
  scene_markers: [{ scene: 1 }], created_by: 'sub-123', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
  content: 'INT. LOFT - DAY\nLala: The unpublished line.', title: 'Episode 4', script_text: 'Me: the writer text', script_json: [{ beat_number: 1 }],
  ...UNEXPECTED,
};
const KEPT = { id: VERSION, created_at: '2026-11-02T00:00:00Z', source: 'save', created_by: 'sub-123', restore: false, beats: 1, length: 44, preview: 'Lala: The unpublished line.' };

const READS = ['/script-versions', `/script-versions/${VERSION}`, '/scripts', '/scripts?includeContent=true', '/scripts/main/versions'];
const NOT_ADMIN = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []];

beforeEach(() => {
  jest.clearAllMocks();
  scriptsService.getScriptsByEpisode.mockResolvedValue([DRAFT]);
  scriptsService.getScriptVersions.mockResolvedValue([DRAFT]);
  scriptVersions.listVersions.mockResolvedValue([KEPT]);
  scriptVersions.getVersion.mockResolvedValue({ ...KEPT, script_content: DRAFT.content, script_locked_beats: [] });
});
const readerCalls = () => scriptsService.getScriptsByEpisode.mock.calls.length + scriptsService.getScriptVersions.mock.calls.length
  + scriptVersions.listVersions.mock.calls.length + scriptVersions.getVersion.mock.calls.length;

describe('the script reads under an episode need a sign-in in the admin group', () => {
  test.each(READS)('signed out: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, null);
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
    expect(readerCalls()).toBe(0);
  });

  test.each(READS)('a token that is not one: GET %s is a 401 and reads nothing', async (path) => {
    expect((await get(path, 'not-a-token')).status).toBe(401);
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
    const res = await get(path, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('an id that is not a UUID is still refused before the sign-in is read, as it was', async () => {
    const res = await request(app).get('/api/v1/episodes/nope/scripts');
    expect(res.status).toBe(400);
  });
});

describe('an admin gets what the reads answered, with named fields', () => {
  const admin = token(['ADMIN']);
  const keys = (o) => Object.keys(o).sort();

  test('the kept versions and one with its text are as the readers return them', async () => {
    const list = await get('/script-versions', admin);
    expect(list.body.data).toEqual([KEPT]);
    expect(scriptVersions.listVersions).toHaveBeenCalledWith(expect.anything(), EP);
    const one = await get(`/script-versions/${VERSION}`, admin);
    expect(one.body.data.script_content).toBe(DRAFT.content);
    expect(scriptVersions.getVersion).toHaveBeenCalledWith(expect.anything(), EP, VERSION);
  });

  test('a version that is not the episode\'s is a 404', async () => {
    scriptVersions.getVersion.mockResolvedValue(null);
    expect((await get(`/script-versions/${VERSION}`, admin)).status).toBe(404);
  });

  test('the episode\'s scripts without ?includeContent: their facts, never the text, though the rows carry it', async () => {
    const res = await get('/scripts?includeAllVersions=false', admin);
    expect(scriptsService.getScriptsByEpisode).toHaveBeenCalledWith(EP, { includeAllVersions: false, includeContent: false, scriptType: undefined });
    expect(res.body.count).toBe(1);
    const row = res.body.data[0];
    expect(keys(row)).toEqual([...SCRIPT_FIELDS].sort());
    expect(row.status).toBe('draft');
    for (const k of [...SCRIPT_CONTENT_FIELDS, ...Object.keys(UNEXPECTED)]) expect(row).not.toHaveProperty(k);
    expect(JSON.stringify(res.body)).not.toContain('unpublished line');
  });

  test('?includeContent=true: the text too (the Overview reads data[0].content), and still no column that is not named', async () => {
    const res = await get('/scripts?includeContent=true&includeAllVersions=true&scriptType=main', admin);
    expect(scriptsService.getScriptsByEpisode).toHaveBeenCalledWith(EP, { includeAllVersions: true, includeContent: true, scriptType: 'main' });
    const row = res.body.data[0];
    expect(keys(row)).toEqual([...SCRIPT_FIELDS, ...SCRIPT_CONTENT_FIELDS].sort());
    expect(row.content).toBe(DRAFT.content);
    for (const k of Object.keys(UNEXPECTED)) expect(row).not.toHaveProperty(k);
    expect(JSON.stringify(res.body)).not.toContain('not for anyone');
  });

  test('only "true" asks for the text', async () => {
    for (const q of ['?includeContent=1', '?includeContent=TRUE', '?includeContent=yes', '?includeContent=']) {
      const res = await get(`/scripts${q}`, admin);
      expect(res.body.data[0]).not.toHaveProperty('content');
    }
  });

  test('a row of the simpler table sends what it has that is named, and invents none', async () => {
    scriptsService.getScriptsByEpisode.mockResolvedValue([{ id: 7, episode_id: EP, version: 1, content: 'text', status: 'draft', is_current: true, notes: 'n', deleted_at: null }]);
    expect((await get('/scripts', admin)).body.data).toEqual([{ id: 7, episode_id: EP, version: 1, status: 'draft' }]);
    expect((await get('/scripts?includeContent=true', admin)).body.data).toEqual([{ id: 7, episode_id: EP, version: 1, status: 'draft', content: 'text' }]);
  });

  test('a script type\'s versions: the version fields only, never the text', async () => {
    const res = await get('/scripts/main/versions', admin);
    expect(scriptsService.getScriptVersions).toHaveBeenCalledWith(EP, 'main');
    expect(res.body.count).toBe(1);
    expect(keys(res.body.data[0])).toEqual([...SCRIPT_VERSION_FIELDS].sort());
    for (const k of [...SCRIPT_CONTENT_FIELDS, ...Object.keys(UNEXPECTED)]) expect(res.body.data[0]).not.toHaveProperty(k);
  });
});

describe('the allowlist of a version', () => {
  test('names none of the text fields', () => {
    for (const k of SCRIPT_CONTENT_FIELDS) expect(SCRIPT_VERSION_FIELDS).not.toContain(k);
  });
});

describe('the script write under an episode is as it was', () => {
  test('signed out, POST /:episodeId/scripts is still a 401', async () => {
    expect((await request(app).post(`/api/v1/episodes/${EP}/scripts`).send({})).status).toBe(401);
  });
  test('signed in and not an admin, it is not refused for the group', async () => {
    const res = await request(app).post(`/api/v1/episodes/${EP}/scripts`).set('Authorization', `Bearer ${token(['USER'])}`).send({});
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
