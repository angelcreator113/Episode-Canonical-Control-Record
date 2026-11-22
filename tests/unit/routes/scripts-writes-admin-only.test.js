/**
 * The script library's writes are an ADMIN's (Evoni, 2026-11-22;
 * docs/audit/F-AUTH-1_ScriptWrites_AdminOnly_Amendment3_2026-11-22.md):
 * POST /api/v1/scripts/bulk-delete, PATCH and DELETE /:scriptId, POST
 * /:scriptId/set-primary, /:scriptId/restore and /:scriptId/parse-scenes.
 * They answered any signed-in account, and PATCH with no editable field
 * answered with the whole row, its text included.
 *
 * The real router, auth middleware, controller and error handler; the
 * scripts service is a stand-in with every method it has, so no database is
 * read or written. The service is the controller's only way to the database,
 * so "no method was called" is "nothing was read or changed". Its rows carry
 * a script's text, to show that a refusal does not send it.
 *
 * The seventh write, POST /api/v1/episodes/:episodeId/scripts, is in
 * episodes-script-reads-admin-only.test.js, beside that router's reads.
 */
jest.mock('../../../src/services/scriptsService', () => ({
  getScriptsByEpisode: jest.fn(),
  getScriptById: jest.fn(),
  getScriptVersions: jest.fn(),
  createScript: jest.fn(),
  updateScript: jest.fn(),
  setPrimary: jest.fn(),
  restoreVersion: jest.fn(),
  deleteScript: jest.fn(),
  bulkDelete: jest.fn(),
  searchScripts: jest.fn(),
  getEditHistory: jest.fn(),
  logEdit: jest.fn(),
  parseScriptAndCreateScenes: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const scriptsService = require('../../../src/services/scriptsService');
const { errorHandler } = require('../../../src/middleware/errorHandler');

// As src/app.js: the JSON body parser ahead of the router, the error handler after it.
const app = express();
app.use(express.json({ limit: '10mb', type: 'application/json' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/v1/scripts', require('../../../src/routes/scripts'));
app.use(errorHandler);

const token = (groups) => TokenService.generateTokenPair({
  id: `scripts-${groups.join('-') || 'none'}`, email: 'scripts@test.dev', name: 'scripts', groups, role: groups[0],
}).accessToken;
const send = (method, path, auth, body) => {
  let r = request(app)[method](`/api/v1/scripts${path}`);
  if (auth) r = r.set('Authorization', `Bearer ${auth}`);
  return body === undefined ? r : r.send(body);
};

const MARKER = 'The unpublished line';
const ROW = {
  id: 'sc-1', episode_id: 'ep-1', script_type: 'main', version_number: 3, status: 'draft', is_primary: true, is_latest: true,
  content: `INT. LOFT - DAY\nLala: ${MARKER}.`, script_text: `Me: ${MARKER}, as written`, script_json: [{ beat_number: 1, line: MARKER }],
  current_revision: 7, script_revision: 7, internal_notes: 'not for anyone',
};
const PARSED = { scenesCreated: 2, scenes: [{ id: 'scene-1', title: 'INT. LOFT - DAY' }] };

// [method, path, a body an admin would send, the service method the handler calls]
const WRITES = [
  ['post', '/bulk-delete', { scriptIds: ['sc-1', 'sc-2'] }, 'bulkDelete'],
  ['patch', '/sc-1', { status: 'approved', content: 'new text' }, 'updateScript'],
  ['delete', '/sc-1', undefined, 'deleteScript'],
  ['post', '/sc-1/set-primary', undefined, 'setPrimary'],
  ['post', '/sc-1/restore', undefined, 'restoreVersion'],
  ['post', '/sc-1/parse-scenes', undefined, 'parseScriptAndCreateScenes'],
];
const NOT_ADMIN = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []];

const serviceCalls = () => Object.values(scriptsService).reduce((n, fn) => n + fn.mock.calls.length, 0);
// Nothing of a script in a refusal: not its text, not a field that would carry it.
const NEVER_SENT = [MARKER, 'content', 'script_text', 'script_json', 'current_revision', 'script_revision', 'internal_notes', 'sc-1', 'ep-1', 'scenesCreated'];
const expectNothingOfAScript = (res) => {
  const sent = JSON.stringify(res.body) + (res.text || '');
  for (const word of NEVER_SENT) expect(sent).not.toContain(word);
  expect(res.body.data).toBeUndefined();
  expect(res.body.success).toBeUndefined();
};
const SIGNED_OUT = { error: 'Authorization required', message: 'This action requires a signed-in user.', code: 'AUTH_REQUIRED' };
const NOT_IN_GROUP = { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' };

beforeEach(() => {
  jest.clearAllMocks();
  scriptsService.bulkDelete.mockResolvedValue({ success: true, message: '2 scripts deleted successfully', deletedCount: 2 });
  scriptsService.updateScript.mockResolvedValue(ROW);
  scriptsService.deleteScript.mockResolvedValue({ success: true, message: 'Script deleted successfully' });
  scriptsService.setPrimary.mockResolvedValue(ROW);
  scriptsService.restoreVersion.mockResolvedValue({ ...ROW, id: 'sc-9', version_number: 4 });
  scriptsService.parseScriptAndCreateScenes.mockResolvedValue(PARSED);
  scriptsService.getScriptById.mockResolvedValue(ROW);
});

describe('the six writes need a sign-in in the admin group', () => {
  test.each(WRITES)('signed out: %s %s is a 401; nothing is called, nothing of a script is sent', async (method, path, body) => {
    const res = await send(method, path, null, body);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(SIGNED_OUT);
    expectNothingOfAScript(res);
    expect(serviceCalls()).toBe(0);
  });

  test.each(WRITES)('a token that is not one: %s %s is a 401; nothing is called', async (method, path, body) => {
    const res = await send(method, path, 'not-a-token', body);
    expect(res.status).toBe(401);
    expectNothingOfAScript(res);
    expect(serviceCalls()).toBe(0);
  });

  test.each(WRITES)('a header that is not a bearer token: %s %s is a 401; nothing is called', async (method, path, body) => {
    const r = request(app)[method](`/api/v1/scripts${path}`).set('Authorization', 'Basic abc');
    const res = await (body === undefined ? r : r.send(body));
    expect(res.status).toBe(401);
    expectNothingOfAScript(res);
    expect(serviceCalls()).toBe(0);
  });

  test.each(WRITES)('signed in but not an admin: %s %s is a 403; nothing is called, nothing of a script is sent', async (method, path, body) => {
    for (const groups of NOT_ADMIN) {
      const res = await send(method, path, token(groups), body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(NOT_IN_GROUP);
      expectNothingOfAScript(res);
    }
    expect(serviceCalls()).toBe(0);
  });
});

describe('a request that changes nothing, or is malformed, tells a caller who is not an admin nothing', () => {
  // [what it is, method, path, body]
  const PROBES = [
    ['a PATCH with no field', 'patch', '/sc-1', {}],
    ['a PATCH with no body', 'patch', '/sc-1', undefined],
    ['a PATCH of fields the service does not edit', 'patch', '/sc-1', { nope: 1, id: 'sc-2', deleted_at: null }],
    ['a PATCH whose body is an array', 'patch', '/sc-1', [{ status: 'approved' }]],
    ['a PATCH of the wrong types', 'patch', '/sc-1', { status: { $ne: null }, content: 12, scene_markers: 'x' }],
    ['a PATCH of a script that does not exist', 'patch', '/00000000-0000-4000-8000-000000000000', {}],
    ['a bulk delete with no ids', 'post', '/bulk-delete', {}],
    ['a bulk delete of an empty list', 'post', '/bulk-delete', { scriptIds: [] }],
    ['a bulk delete whose ids are not a list', 'post', '/bulk-delete', { scriptIds: 'sc-1' }],
    ['a bulk delete of ids that are not ids', 'post', '/bulk-delete', { scriptIds: [null, {}, "' OR 1=1 --", 12] }],
    ['a restore of a script that does not exist', 'post', '/00000000-0000-4000-8000-000000000000/restore', undefined],
    ['a restore of an id that is not one', 'post', '/not-an-id/restore', undefined],
    ['a set-primary of a script that does not exist', 'post', '/00000000-0000-4000-8000-000000000000/set-primary', undefined],
    ['a set-primary of an id that is not one', 'post', '/not-an-id/set-primary', undefined],
    ['a delete of a script that does not exist', 'delete', '/00000000-0000-4000-8000-000000000000', undefined],
    ['a parse of a script that does not exist', 'post', '/00000000-0000-4000-8000-000000000000/parse-scenes', undefined],
  ];

  test.each(PROBES)('signed out, %s is a 401', async (_what, method, path, body) => {
    const res = await send(method, path, null, body);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(SIGNED_OUT);
    expectNothingOfAScript(res);
    expect(serviceCalls()).toBe(0);
  });

  test.each(PROBES)('signed in and not an admin, %s is a 403', async (_what, method, path, body) => {
    for (const groups of NOT_ADMIN) {
      const res = await send(method, path, token(groups), body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(NOT_IN_GROUP);
      expectNothingOfAScript(res);
    }
    expect(serviceCalls()).toBe(0);
  });

  // A body sent as text or as a form is not parsed as JSON; the sign-in is still read first.
  test.each([
    ['text/plain', 'status=approved'],
    ['application/x-www-form-urlencoded', 'status=approved&content=x'],
    ['application/octet-stream', Buffer.from([0, 1, 2])],
  ])('a PATCH sent as %s: 401 signed out, 403 for an account that is not an admin', async (type, body) => {
    const out = await request(app).patch('/api/v1/scripts/sc-1').set('Content-Type', type).send(body);
    expect(out.status).toBe(401);
    expectNothingOfAScript(out);
    const user = await request(app).patch('/api/v1/scripts/sc-1').set('Authorization', `Bearer ${token(['USER'])}`).set('Content-Type', type).send(body);
    expect(user.status).toBe(403);
    expectNothingOfAScript(user);
    expect(serviceCalls()).toBe(0);
  });

  // The body parser is mounted ahead of every router (src/app.js), so JSON
  // that does not parse is refused before the sign-in is read, for anyone.
  // Its answer names the fault and nothing else.
  test.each(WRITES.filter(([m]) => m !== 'delete'))('JSON that does not parse: %s %s is refused by the body parser; nothing is called, nothing of a script is sent', async (method, path) => {
    for (const auth of [null, token(['USER']), token(['ADMIN'])]) {
      let r = request(app)[method](`/api/v1/scripts${path}`).set('Content-Type', 'application/json');
      if (auth) r = r.set('Authorization', `Bearer ${auth}`);
      const res = await r.send('{"status": "approved"');
      expect(res.status).toBe(422);
      expect(res.body.message).toBe('Invalid JSON in request body');
      expectNothingOfAScript(res);
    }
    expect(serviceCalls()).toBe(0);
  });
});

describe('an admin: each write reaches the service as it did, and answers as it did', () => {
  const admin = token(['ADMIN']);
  // What the controller passes as the editor: req.user.username || req.user.id.
  const WHO = 'scripts-ADMIN';

  test('POST /bulk-delete', async () => {
    const res = await send('post', '/bulk-delete', admin, { scriptIds: ['sc-1', 'sc-2'] });
    expect(res.status).toBe(200);
    expect(scriptsService.bulkDelete).toHaveBeenCalledWith(['sc-1', 'sc-2'], WHO);
    expect(res.body).toEqual({ success: true, message: '2 scripts deleted successfully', deletedCount: 2 });
    expect(serviceCalls()).toBe(1);
  });

  test.each([[{}], [{ scriptIds: [] }], [{ scriptIds: 'sc-1' }]])('POST /bulk-delete of %j is a 422, and deletes nothing', async (body) => {
    const res = await send('post', '/bulk-delete', admin, body);
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('scriptIds must be a non-empty array');
    expect(serviceCalls()).toBe(0);
  });

  test('PATCH /:scriptId', async () => {
    const res = await send('patch', '/sc-1', admin, { status: 'approved', content: 'new text' });
    expect(res.status).toBe(200);
    expect(scriptsService.updateScript).toHaveBeenCalledWith('sc-1', { status: 'approved', content: 'new text' }, WHO);
    expect(res.body).toEqual({ success: true, data: ROW, message: 'Script updated successfully' });
    expect(serviceCalls()).toBe(1);
  });

  // Pinned as it is: with no editable field the service changes nothing and
  // returns the row it read, text included, and the handler sends it. That
  // answer is an ADMIN's alone now; an admin may read a script.
  test('PATCH /:scriptId with no field answers with the row, to an admin only', async () => {
    const res = await send('patch', '/sc-1', admin, {});
    expect(res.status).toBe(200);
    expect(scriptsService.updateScript).toHaveBeenCalledWith('sc-1', {}, WHO);
    expect(res.body).toEqual({ success: true, data: ROW, message: 'Script updated successfully' });
    expect(res.body.data.content).toContain(MARKER);
  });

  test('DELETE /:scriptId', async () => {
    const res = await send('delete', '/sc-1', admin);
    expect(res.status).toBe(200);
    expect(scriptsService.deleteScript).toHaveBeenCalledWith('sc-1', WHO);
    expect(res.body).toEqual({ success: true, message: 'Script deleted successfully' });
    expect(serviceCalls()).toBe(1);
  });

  test('POST /:scriptId/set-primary', async () => {
    const res = await send('post', '/sc-1/set-primary', admin);
    expect(res.status).toBe(200);
    expect(scriptsService.setPrimary).toHaveBeenCalledWith('sc-1', WHO);
    expect(res.body).toEqual({ success: true, data: ROW, message: 'Script set as primary successfully' });
    expect(serviceCalls()).toBe(1);
  });

  test('POST /:scriptId/restore', async () => {
    const res = await send('post', '/sc-1/restore', admin);
    expect(res.status).toBe(200);
    expect(scriptsService.restoreVersion).toHaveBeenCalledWith('sc-1', WHO);
    expect(res.body).toEqual({ success: true, data: { ...ROW, id: 'sc-9', version_number: 4 }, message: 'Script version restored successfully' });
    expect(serviceCalls()).toBe(1);
  });

  test('POST /:scriptId/parse-scenes', async () => {
    const res = await send('post', '/sc-1/parse-scenes', admin);
    expect(res.status).toBe(200);
    expect(scriptsService.parseScriptAndCreateScenes).toHaveBeenCalledWith('sc-1');
    expect(res.body).toEqual({ success: true, data: PARSED });
    expect(serviceCalls()).toBe(1);
  });

  test.each(WRITES)('the admin group is matched whatever its case: %s %s', async (method, path, body, called) => {
    for (const groups of [['admin'], ['Viewer', 'Admin']]) {
      const res = await send(method, path, token(groups), body);
      expect(res.status).toBe(200);
    }
    expect(scriptsService[called]).toHaveBeenCalledTimes(2);
    expect(serviceCalls()).toBe(2);
  });
});

describe('when the service fails, the error an admin gets carries nothing of the script', () => {
  const admin = token(['ADMIN']);
  // As a driver error may: the row it was working on, attached to the error.
  const failure = () => Object.assign(new Error('Script not found'), { row: ROW, before: ROW, detail: ROW.content, parameters: [ROW.content] });
  const env = process.env.NODE_ENV;
  let errorLog;
  beforeEach(() => { errorLog = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { process.env.NODE_ENV = env; errorLog.mockRestore(); });

  test.each(WRITES)('%s %s: a 500 with the message, never what the error carried', async (method, path, body, called) => {
    scriptsService[called].mockRejectedValue(failure());
    const res = await send(method, path, admin, body);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('Script not found');
    expect(Object.keys(res.body).sort()).toEqual(['code', 'details', 'error', 'message', 'timestamp']);
    expect(Object.keys(res.body.details)).toEqual(['stack']);
    const sent = JSON.stringify(res.body);
    for (const word of [MARKER, 'script_text', 'script_json', 'current_revision', 'script_revision', 'internal_notes']) expect(sent).not.toContain(word);
  });

  test.each(WRITES)('%s %s in production: "Internal server error", no message and no stack', async (method, path, body, called) => {
    // The sign-in is read as in a test run (a test token is not one in
    // production); the error handler reads NODE_ENV when it answers.
    scriptsService[called].mockImplementation(async () => { process.env.NODE_ENV = 'production'; throw failure(); });
    const res = await send(method, path, admin, body);
    expect(res.status).toBe(500);
    expect(Object.keys(res.body).sort()).toEqual(['code', 'error', 'message', 'timestamp']);
    expect(res.body.message).toBe('Internal server error');
    expectNothingOfAScript(res);
  });

  test.each(WRITES)('%s %s: a failure is not reached by a caller who is not an admin', async (method, path, body, called) => {
    scriptsService[called].mockRejectedValue(failure());
    expect((await send(method, path, null, body)).status).toBe(401);
    const res = await send(method, path, token(['EDITOR']), body);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(NOT_IN_GROUP);
    expect(serviceCalls()).toBe(0);
  });
});
