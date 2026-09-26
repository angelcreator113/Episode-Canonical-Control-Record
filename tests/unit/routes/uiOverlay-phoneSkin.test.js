// ============================================================================
// Lala's Phone skin is saved per show on the server (Task #1964):
// PUT /ui-overlays/:showId/phone-skin validates and upserts a PageContent row,
// GET /ui-overlays/:showId/frame returns it as phone_skin. Mocked, no database.
// PageContent is mocked with only the attributes its model declares
// (page_name, constant_key, data).
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';
const mockRows = new Map(); // `${page_name}|${constant_key}` -> row
const mockModels = {};

const mockPageContent = {
  findOne: jest.fn(async ({ where }) => mockRows.get(`${where.page_name}|${where.constant_key}`) || null),
  upsert: jest.fn(async (row) => {
    mockRows.set(`${row.page_name}|${row.constant_key}`, { ...row });
    return [row, true];
  }),
};

jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/uiOverlayRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/ui-overlays', router);

const putSkin = (body) => request(app).put(`/api/v1/ui-overlays/${SHOW}/phone-skin`).send(body);
const getFrame = () => request(app).get(`/api/v1/ui-overlays/${SHOW}/frame`);

beforeEach(() => {
  mockRows.clear();
  jest.clearAllMocks();
  mockModels.PageContent = mockPageContent;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('PUT /ui-overlays/:showId/phone-skin (Task #1964)', () => {
  test('saves the skin as the show\'s PHONE_SKIN row', async () => {
    const res = await putSkin({ phone_skin: 'midnight' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, phone_skin: 'midnight' });
    expect(mockPageContent.upsert).toHaveBeenCalledWith(
      { page_name: `phone_hub_${SHOW}`, constant_key: 'PHONE_SKIN', data: { phone_skin: 'midnight' } },
      { conflictFields: ['page_name', 'constant_key'] }
    );
  });

  test.each([
    ['missing', {}],
    ['not a string', { phone_skin: 7 }],
    ['empty', { phone_skin: '' }],
    ['uppercase', { phone_skin: 'Midnight' }],
    ['spaces', { phone_skin: 'rose gold' }],
    ['too long', { phone_skin: 'a'.repeat(33) }],
    ['markup', { phone_skin: '<script>' }],
  ])('rejects a skin that is %s with 400 and saves nothing', async (_label, body) => {
    const res = await putSkin(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockPageContent.upsert).not.toHaveBeenCalled();
  });

  test('returns 500, not a silent success, when PageContent is not loaded', async () => {
    delete mockModels.PageContent;
    const res = await putSkin({ phone_skin: 'midnight' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test('returns 500 and logs when the upsert fails', async () => {
    mockPageContent.upsert.mockRejectedValueOnce(new Error('db down'));
    const res = await putSkin({ phone_skin: 'midnight' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'db down' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('GET /ui-overlays/:showId/frame returns phone_skin (Task #1964)', () => {
  test('null when no skin is saved', async () => {
    const res = await getFrame();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, frame_url: null, global_fit: null, phone_skin: null });
  });

  test('the saved skin after a PUT', async () => {
    await putSkin({ phone_skin: 'midnight' });
    const res = await getFrame();
    expect(res.status).toBe(200);
    expect(res.body.phone_skin).toBe('midnight');
  });
});
