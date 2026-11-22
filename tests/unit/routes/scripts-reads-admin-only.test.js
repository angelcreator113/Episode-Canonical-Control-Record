/**
 * The scripts read routes are an ADMIN's (Evoni, 2026-11-21). GET
 * /api/v1/scripts, /search, /:scriptId and /:scriptId/history answered
 * anyone, signed in or not: every latest script (drafts included), a script's
 * text for ?includeContent=true (SELECT *), and its edit history with the
 * editor's IP address and user agent. They now need a sign-in in the admin
 * group, and answer with named fields only (services/scriptReadFields).
 *
 * The real router, auth middleware and controller; the scripts service is a
 * stand-in, so no database is read. Its rows carry columns the routes must
 * never send, to show that a column is not sent because it is there.
 */
jest.mock('../../../src/services/scriptsService', () => ({
  searchScripts: jest.fn(),
  getScriptById: jest.fn(),
  getEditHistory: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const scriptsService = require('../../../src/services/scriptsService');
const {
  SCRIPT_LIST_FIELDS, SCRIPT_FIELDS, SCRIPT_CONTENT_FIELDS, HISTORY_FIELDS, pick,
} = require('../../../src/services/scriptReadFields');

const app = express();
app.use(express.json());
app.use('/api/v1/scripts', require('../../../src/routes/scripts'));

const token = (groups) => TokenService.generateTokenPair({
  id: `scripts-${groups.join('-') || 'none'}`, email: 'scripts@test.dev', name: 'scripts', groups, role: groups[0],
}).accessToken;
const get = (path, auth) => {
  const r = request(app).get(`/api/v1/scripts${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

// A column no allowlist names, as a table may gain one later.
const UNEXPECTED = { internal_notes: 'not for anyone', financial_context: { balance: 12 }, author_notes: 'private', secret_token: 'abc' };
const DRAFT = {
  id: 'sc-1', episode_id: 'ep-1', script_type: 'main', version: 3, version_number: 3, version_label: 'Draft 3',
  author: 'Evoni', status: 'draft', duration: 600, scene_count: 14, file_format: 'fountain',
  file_url: 'https://files.example/script.fountain', file_size: 1234, is_primary: true, is_latest: true,
  scene_markers: [{ scene: 1 }], created_by: 'sub-123', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
  content: 'INT. LOFT - DAY\nLala: The unpublished line.', title: 'Episode 4', script_text: 'Me: the writer text', script_json: [{ beat_number: 1 }],
  ...UNEXPECTED,
};
const LISTED = { ...DRAFT, episode_title: 'The Gala', episode_number: 4 };
const ENTRY = {
  id: 7, script_id: 'sc-1', user_id: 'sub-123', edit_type: 'update', created_at: '2026-11-02T00:00:00Z',
  changes: { before: { content: 'old' }, after: { content: 'new' } },
  ip_address: '203.0.113.9', user_agent: 'Mozilla/5.0 (test)', ...UNEXPECTED,
};

const READS = ['/', '/search', '/sc-1', '/sc-1?includeContent=true', '/sc-1/history'];
const NOT_ADMIN = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []];

beforeEach(() => {
  jest.clearAllMocks();
  scriptsService.searchScripts.mockResolvedValue([LISTED]);
  scriptsService.getScriptById.mockResolvedValue(DRAFT);
  scriptsService.getEditHistory.mockResolvedValue([ENTRY]);
});
const serviceCalls = () => scriptsService.searchScripts.mock.calls.length
  + scriptsService.getScriptById.mock.calls.length + scriptsService.getEditHistory.mock.calls.length;

describe('the scripts reads need a sign-in in the admin group', () => {
  test.each(READS)('signed out: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, null);
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('unpublished line');
    expect(serviceCalls()).toBe(0);
  });

  test.each(READS)('a token that is not one: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, 'not-a-token');
    expect(res.status).toBe(401);
    expect(serviceCalls()).toBe(0);
  });

  test.each(READS)('signed in but not an admin: GET %s is a 403 and reads nothing', async (path) => {
    for (const groups of NOT_ADMIN) {
      const res = await get(path, token(groups));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('unpublished line');
    }
    expect(serviceCalls()).toBe(0);
  });

  test.each(READS)('an admin: GET %s is a 200', async (path) => {
    const res = await get(path, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('the admin group is matched whatever its case, as authorize() does', async () => {
    expect((await get('/', token(['admin']))).status).toBe(200);
    expect((await get('/', token(['Viewer', 'Admin']))).status).toBe(200);
  });
});

describe('an admin gets named fields only', () => {
  const admin = token(['ADMIN']);
  const keys = (o) => Object.keys(o).sort();

  test('the list and the search: a draft is listed; only the list fields', async () => {
    for (const path of ['/', '/search?scriptType=main']) {
      const res = await get(path, admin);
      expect(res.body.count).toBe(1);
      const row = res.body.data[0];
      expect(row.status).toBe('draft');
      expect(row.episode_title).toBe('The Gala');
      expect(keys(row)).toEqual([...SCRIPT_LIST_FIELDS].sort());
      // Not in a list: its text, its file, who made it.
      for (const k of ['content', 'script_text', 'script_json', 'file_url', 'created_by', ...Object.keys(UNEXPECTED)]) expect(row).not.toHaveProperty(k);
    }
  });

  test('one script without ?includeContent: its facts, never its text, though the row carries it', async () => {
    const res = await get('/sc-1', admin);
    expect(scriptsService.getScriptById).toHaveBeenCalledWith('sc-1', false);
    expect(keys(res.body.data)).toEqual([...SCRIPT_FIELDS].sort());
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.file_url).toBe(DRAFT.file_url);
    for (const k of [...SCRIPT_CONTENT_FIELDS, ...Object.keys(UNEXPECTED)]) expect(res.body.data).not.toHaveProperty(k);
    expect(JSON.stringify(res.body)).not.toContain('unpublished line');
  });

  test('?includeContent=true: its text too, and still no column that is not named', async () => {
    const res = await get('/sc-1?includeContent=true', admin);
    expect(scriptsService.getScriptById).toHaveBeenCalledWith('sc-1', true);
    expect(keys(res.body.data)).toEqual([...SCRIPT_FIELDS, ...SCRIPT_CONTENT_FIELDS].sort());
    expect(res.body.data.content).toBe(DRAFT.content);
    for (const k of Object.keys(UNEXPECTED)) expect(res.body.data).not.toHaveProperty(k);
    expect(JSON.stringify(res.body)).not.toContain('not for anyone');
  });

  test('only "true" asks for the text', async () => {
    for (const q of ['?includeContent=1', '?includeContent=TRUE', '?includeContent=yes', '?includeContent=']) {
      const res = await get(`/sc-1${q}`, admin);
      expect(res.body.data).not.toHaveProperty('content');
    }
  });

  test('the edit history: what changed and when, never the IP address or the user agent', async () => {
    const res = await get('/sc-1/history', admin);
    expect(res.body.count).toBe(1);
    const entry = res.body.data[0];
    expect(keys(entry)).toEqual([...HISTORY_FIELDS].sort());
    expect(entry.edit_type).toBe('update');
    expect(entry.changes).toEqual(ENTRY.changes);
    expect(entry).not.toHaveProperty('ip_address');
    expect(entry).not.toHaveProperty('user_agent');
    const sent = JSON.stringify(res.body);
    expect(sent).not.toContain('203.0.113.9');
    expect(sent).not.toContain('Mozilla');
    for (const k of Object.keys(UNEXPECTED)) expect(entry).not.toHaveProperty(k);
  });

  test('a row with fewer columns than the allowlist sends what it has, and invents none', async () => {
    scriptsService.getScriptById.mockResolvedValue({ id: 'sc-2', status: 'approved', surprise: 1 });
    const res = await get('/sc-2?includeContent=true', admin);
    expect(res.body.data).toEqual({ id: 'sc-2', status: 'approved' });
  });
});

describe('the allowlists', () => {
  test('no history field names where an edit was sent from', () => {
    expect(HISTORY_FIELDS).not.toContain('ip_address');
    expect(HISTORY_FIELDS).not.toContain('user_agent');
  });
  test('a script\'s text is in the content fields only', () => {
    for (const k of SCRIPT_CONTENT_FIELDS) {
      expect(SCRIPT_FIELDS).not.toContain(k);
      expect(SCRIPT_LIST_FIELDS).not.toContain(k);
    }
  });
  test('pick: own values of the named fields; null for no row; inherited names are not picked', () => {
    expect(pick(null, ['id'])).toBeNull();
    expect(pick({ id: 1, x: 2 }, ['id', 'missing'])).toEqual({ id: 1 });
    expect(pick(Object.create({ id: 9 }), ['id'])).toEqual({});
  });
});

// The six writes of this router are an ADMIN's as well (Evoni, 2026-11-22;
// docs/audit/F-AUTH-1_ScriptWrites_AdminOnly_Amendment3_2026-11-22.md). How
// they behave is in scripts-writes-admin-only.test.js.
describe('the writes are an ADMIN\'s too', () => {
  test('signed out, a write is a 401', async () => {
    const res = await request(app).post('/api/v1/scripts/sc-1/set-primary');
    expect(res.status).toBe(401);
  });
  test('signed in and not an admin, a write is a 403', async () => {
    const res = await request(app).post('/api/v1/scripts/sc-1/set-primary').set('Authorization', `Bearer ${token(['USER'])}`);
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });
});
