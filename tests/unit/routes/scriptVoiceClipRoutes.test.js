// ============================================================================
// Voice clip routes (/api/v1/script-voice-clips; Teleprompter batch 3): only
// audio is taken; the file goes to S3 the raw clips' way, under
// episodes/<episode>/voice-clips/; saving soft-deletes the line's earlier
// clip in the same transaction; before the migration every route is a 409
// and no file goes to S3. Mocked: no database, no S3.
// ============================================================================
const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a), transaction: async (fn) => fn('tx') } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); }, authorize: () => (req, _res, next) => next() };
});
jest.mock('../../../src/services/rawClipMedia', () => {
  const os = require('os');
  const path = require('path');
  return {
    TMP_DIR: path.join(os.tmpdir(), 'voice-clips-test'),
    uploadFile: jest.fn(async (_p, key) => `https://bucket/${key}`),
    removeFile: jest.fn(async () => {}),
  };
});

const media = require('../../../src/services/rawClipMedia');
const router = require('../../../src/routes/scriptVoiceClipRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/script-voice-clips', router);
const EP = '11111111-1111-4111-8111-111111111111';
const AUDIO = Buffer.from('not really audio');
let tableThere;

beforeEach(() => {
  mockQuery.mockReset();
  Object.values(media).forEach((fn) => fn?.mockClear?.());
  tableThere = true;
  mockQuery.mockImplementation(async (sql, opts = {}) => {
    if (/to_regclass/.test(sql)) return [[{ reg: tableThere ? 'script_voice_clips' : null }]];
    if (/FROM episodes WHERE id/.test(sql)) return [[{ id: EP }]];
    if (/^\s*UPDATE script_voice_clips SET deleted_at/.test(sql) && /line_index = :line/.test(sql)) return [[{ id: 'old-clip' }]];
    if (/^\s*INSERT INTO script_voice_clips/.test(sql)) return [[{ id: opts.replacements.id, beat_number: opts.replacements.beat, line_index: opts.replacements.line, duration_seconds: String(opts.replacements.duration) }]];
    return [[]];
  });
});

const upload = (fields, file = { name: 'voice.webm', type: 'audio/webm' }) => {
  let r = request(app).post(`/api/v1/script-voice-clips/${EP}`);
  Object.entries(fields).forEach(([k, v]) => { r = r.field(k, v); });
  return file ? r.attach('audio', AUDIO, { filename: file.name, contentType: file.type }) : r;
};
const LINE = { beat_number: '8', line_index: '0', speaker: 'Lala', line_text: 'Gorgeous.', duration_seconds: '2.345' };

test('an upload goes to S3 and replaces the line’s earlier clip, in one transaction', async () => {
  const res = await upload(LINE);
  expect(res.status).toBe(201);
  expect(res.body.replaced).toBe('old-clip');
  expect(res.body.data).toMatchObject({ beat_number: 8, line_index: 0, duration_seconds: 2.35 });
  expect(media.uploadFile).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(new RegExp(`^episodes/${EP}/voice-clips/[^/]+\\.webm$`)), 'audio/webm');
  const calls = mockQuery.mock.calls.map(([sql, o]) => [sql.trim().split(/\s+/).slice(0, 3).join(' '), o.transaction]);
  expect(calls).toEqual(expect.arrayContaining([['UPDATE script_voice_clips SET', 'tx'], ['INSERT INTO script_voice_clips', 'tx']]));
  const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO/.test(sql))[1].replacements;
  expect(insert).toMatchObject({ speaker: 'Lala', lineText: 'Gorgeous.', createdBy: 'u1', contentType: 'audio/webm' });
  expect(media.removeFile).toHaveBeenCalled();
});

test('only audio; fields are checked', async () => {
  const res = await upload(LINE, { name: 'notes.txt', type: 'text/plain' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/Only audio/);
  expect((await upload({ ...LINE, beat_number: '0' })).status).toBe(400);
  expect((await upload({ ...LINE, line_index: '-1' })).status).toBe(400);
  expect((await upload({ ...LINE, speaker: ' ' })).status).toBe(400);
  expect((await upload({ ...LINE, duration_seconds: '9999' })).status).toBe(400);
  expect((await upload(LINE, null)).status).toBe(400);
  expect(media.uploadFile).not.toHaveBeenCalled();
});

test('before the migration: 409 and nothing goes to S3; the list and delete say so too', async () => {
  tableThere = false;
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await upload(LINE);
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('MIGRATION_PENDING');
  expect(media.uploadFile).not.toHaveBeenCalled();
  mockQuery.mockImplementation(async () => { throw Object.assign(new Error('relation "script_voice_clips" does not exist'), { original: { code: '42P01', message: 'relation "script_voice_clips" does not exist' } }); });
  const list = await request(app).get(`/api/v1/script-voice-clips/${EP}`);
  expect(list.status).toBe(409);
  expect(list.body.error).toMatch(/database update/);
  const del = await request(app).delete(`/api/v1/script-voice-clips/${EP}/22222222-2222-4222-8222-222222222222`);
  expect(del.status).toBe(409);
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

test('list and delete; a bad id is a 404', async () => {
  mockQuery.mockImplementation(async (sql) => (/^\s*SELECT/.test(sql) ? [[{ id: 'v1', duration_seconds: '1.50', file_size_bytes: '2048' }]] : [[{ id: 'v1' }]]));
  const list = await request(app).get(`/api/v1/script-voice-clips/${EP}`);
  expect(list.body.data).toEqual([{ id: 'v1', duration_seconds: 1.5, file_size_bytes: 2048 }]);
  const del = await request(app).delete(`/api/v1/script-voice-clips/${EP}/22222222-2222-4222-8222-222222222222`);
  expect(del.status).toBe(200);
  expect((await request(app).get('/api/v1/script-voice-clips/nope')).status).toBe(404);
  expect((await request(app).delete(`/api/v1/script-voice-clips/${EP}/nope`)).status).toBe(404);
});
