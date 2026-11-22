/**
 * Reading an episode's voice clips is for admins (Evoni, 2026-11-22). GET
 * /api/v1/script-voice-clips/:episodeId answered any signed-in account with
 * each clip's script line (line_text) and its audio URL. It now needs a
 * sign-in in the admin group, as recording a clip already did.
 *
 * The real router, auth middleware and service; the database is a stand-in.
 * (scriptVoiceClipRoutes.test.js covers the routes' behaviour with the auth
 * middleware stood in.)
 */
const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a), transaction: async (fn) => fn('tx') } }));
jest.mock('../../../src/services/rawClipMedia', () => ({ TMP_DIR: require('os').tmpdir(), uploadFile: jest.fn(), removeFile: jest.fn() }));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/v1/script-voice-clips', require('../../../src/routes/scriptVoiceClipRoutes'));

const EP = '11111111-1111-4111-8111-111111111111';
const CLIP_ID = '22222222-2222-4222-8222-222222222222';
const token = (groups) => TokenService.generateTokenPair({
  id: `clips-${groups.join('-') || 'none'}`, email: 'clips@test.dev', name: 'clips', groups, role: groups[0],
}).accessToken;
const list = (auth, ep = EP) => {
  const r = request(app).get(`/api/v1/script-voice-clips/${ep}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const CLIP = {
  id: CLIP_ID, episode_id: EP, beat_number: 8, line_index: 0, speaker: 'Lala', line_text: 'The unpublished line.',
  url: 'https://bucket/episodes/ep/voice-clips/v1.webm', content_type: 'audio/webm', duration_seconds: '1.50', file_size_bytes: '2048',
  created_by: 'sub-123', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql) => (/^\s*SELECT/.test(sql) ? [[CLIP]] : [[]]));
});

describe('GET /api/v1/script-voice-clips/:episodeId needs a sign-in in the admin group', () => {
  test('signed out: a 401, and nothing is read', async () => {
    expect((await list(null)).status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('signed in but not an admin: a 403, and nothing is read', async () => {
    for (const groups of [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []]) {
      const res = await list(token(groups));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('unpublished line');
    }
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('an admin: the episode\'s live clips, by named columns, as they were', async () => {
    const res = await list(token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ ...CLIP, duration_seconds: 1.5, file_size_bytes: 2048 }] });
    const [sql, options] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).not.toMatch(/SELECT\s+\*/);
    expect(options.replacements).toEqual({ episodeId: EP });
  });

  test('an admin, an id that is not an episode\'s: still a 404', async () => {
    expect((await list(token(['ADMIN']), 'nope')).status).toBe(404);
  });
});

describe('removing a clip is as it was: its recorder may, admin or not', () => {
  test('signed out is a 401; a signed-in account that is not an admin is not refused for the group', async () => {
    const del = (auth) => {
      const r = request(app).delete(`/api/v1/script-voice-clips/${EP}/${CLIP_ID}`);
      return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
    };
    expect((await del(null)).status).toBe(401);
    mockQuery.mockImplementation(async () => [[]]);
    const res = await del(token(['USER']));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Voice clip not found');
  });
});
