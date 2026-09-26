// ============================================================================
// GET /ui-overlays/:showId keeps is_episode_override (Task #1920). With
// ?episode_id= an episode's own screen replaces the show default that shares
// its name; the response now says so, per overlay type. Mocked, no database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';
const EP = 'ep-1';

// Rows as the asset query returns them (episode_id NULL = show default).
const mockAssetRows = [
  { id: 'a-cam-ep', name: 'UI Overlay: Camera', episode_id: EP, s3_url_processed: 'https://x/cam-ep.png', s3_url_raw: null, metadata_text: JSON.stringify({ overlay_type: 'camera' }) },
  { id: 'a-cam', name: 'UI Overlay: Camera', episode_id: null, s3_url_processed: 'https://x/cam.png', s3_url_raw: null, metadata_text: JSON.stringify({ overlay_type: 'camera' }) },
  { id: 'a-home', name: 'UI Overlay: Home', episode_id: null, s3_url_processed: 'https://x/home.png', s3_url_raw: null, metadata_text: JSON.stringify({ overlay_type: 'home' }) },
];

jest.mock('../../../src/models', () => ({
  sequelize: {
    query: jest.fn(async (sql, { replacements }) => {
      const rows = replacements.episodeId && /episode_id = :episodeId/.test(sql)
        ? mockAssetRows.filter((r) => r.episode_id === null || r.episode_id === replacements.episodeId)
        : mockAssetRows.filter((r) => r.episode_id === null);
      return [rows];
    }),
  },
}));
jest.mock('../../../src/services/uiOverlayService', () => ({
  getAllOverlayTypes: jest.fn(async () => [
    { id: 'camera', name: 'Camera', category: 'phone' },
    { id: 'home', name: 'Home', category: 'phone' },
  ]),
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/uiOverlayRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/ui-overlays', router);

const byId = (body) => Object.fromEntries(body.data.map((t) => [t.id, t]));

describe('GET /ui-overlays/:showId — is_episode_override (Task #1920)', () => {
  test('with episode_id, the episode\'s override is served and marked; defaults are not', async () => {
    const res = await request(app).get(`/api/v1/ui-overlays/${SHOW}?episode_id=${EP}`);
    expect(res.status).toBe(200);
    const t = byId(res.body);
    expect(t.camera.asset_id).toBe('a-cam-ep');
    expect(t.camera.is_episode_override).toBe(true);
    expect(t.home.asset_id).toBe('a-home');
    expect(t.home.is_episode_override).toBe(false);
  });

  test('without episode_id, nothing is marked as an override', async () => {
    const res = await request(app).get(`/api/v1/ui-overlays/${SHOW}`);
    expect(res.status).toBe(200);
    const t = byId(res.body);
    expect(t.camera.asset_id).toBe('a-cam');
    expect(t.camera.is_episode_override).toBe(false);
    expect(t.home.is_episode_override).toBe(false);
  });
});
