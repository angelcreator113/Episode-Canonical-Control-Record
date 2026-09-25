// ============================================================================
// POST /api/v1/compositions — the legacy format is refused (#1884)
// ============================================================================
// The legacy body (individual asset fields: lala_asset_id, justawomen_asset_id,
// include_justawomaninherprime, …) used to reach
// CompositionService.createComposition, which called three canonicalRoles
// helpers that were never written, so every such request was a 500. Evoni's
// ruling (option c): retire the branch; a clear 400 beats a TypeError. The
// studio format (template_studio_id + asset_map/assets) is unchanged. Mocked
// models and services, no database.

const express = require('express');
const request = require('supertest');

const mockSequelizeQuery = jest.fn();
const mockModels = {
  ThumbnailTemplate: { findOne: jest.fn(), findByPk: jest.fn() },
  ThumbnailComposition: { create: jest.fn() },
  CompositionAsset: { bulkCreate: jest.fn() },
  CompositionOutput: { bulkCreate: jest.fn() },
  Asset: { findByPk: jest.fn() },
};
// Every CompositionService method the router can call. createComposition is
// absent here, as it is from the service: on main the legacy branch called it
// and got the same TypeError production did.
const mockCompositionService = {
  generateThumbnails: jest.fn(),
  getEpisodeCompositions: jest.fn(),
  getComposition: jest.fn(),
  updateComposition: jest.fn(),
  approveComposition: jest.fn(),
  setPrimary: jest.fn(),
  queueForGeneration: jest.fn(),
};

jest.mock('../../../src/models', () => ({ models: mockModels, sequelize: { query: (...a) => mockSequelizeQuery(...a) } }));
jest.mock('../../../src/services/CompositionService', () => mockCompositionService);
jest.mock('../../../src/services/ThumbnailGeneratorService', () => ({}));
jest.mock('../../../src/services/VersioningService', () => ({}));
jest.mock('../../../src/services/FilterService', () => ({}));
jest.mock('../../../src/middleware/jwtAuth', () => ({
  authenticateJWT: (_req, _res, next) => next(),
  requireGroup: () => (_req, _res, next) => next(),
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, _res, next) => {
      req.user = { id: 'u1' };
      next();
    },
  };
});

const router = require('../../../src/routes/compositions');

const app = express();
app.use(express.json());
app.use('/api/v1/compositions', router);

const EPISODE = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const TEMPLATE = '7a1c2e3f-4b5d-4c6e-8f9a-0b1c2d3e4f5a';
const STUDIO = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';
const LALA = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const JAW = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const allMocks = () => [
  ...Object.values(mockCompositionService),
  ...Object.values(mockModels).flatMap((m) => Object.values(m)),
  mockSequelizeQuery,
];

beforeEach(() => {
  allMocks().forEach((fn) => fn.mockReset());
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('legacy format', () => {
  test('a legacy-shape POST is a 400 with the studio-format message, and nothing is called', async () => {
    const res = await request(app)
      .post('/api/v1/compositions')
      .send({
        episode_id: EPISODE,
        template_id: TEMPLATE,
        lala_asset_id: LALA,
        justawomen_asset_id: JAW,
        include_justawomaninherprime: true,
        justawomaninherprime_position: { width_percent: 20, left_percent: 75, top_percent: 5 },
        selected_formats: ['YOUTUBE'],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Legacy composition format is not supported; use the studio format.',
    });
    for (const fn of allMocks()) expect(fn).not.toHaveBeenCalled();
  });

  test('a legacy body without template_id is refused before the default-template lookup', async () => {
    const res = await request(app)
      .post('/api/v1/compositions')
      .send({ episode_id: EPISODE, lala_asset_id: LALA, selected_formats: ['YOUTUBE'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Legacy composition format is not supported; use the studio format.');
    expect(mockModels.ThumbnailTemplate.findOne).not.toHaveBeenCalled();
  });
});

describe('studio format (unchanged)', () => {
  test('template_studio_id + asset_map creates the composition, its assets and outputs, and a 201', async () => {
    mockSequelizeQuery.mockResolvedValue([[{ id: STUDIO, name: 'Studio', version: 1, required_roles: ['BG.MAIN'] }]]);
    const composition = { id: 'comp-1', composition_config: {}, save: jest.fn() };
    mockModels.ThumbnailComposition.create.mockResolvedValue(composition);
    mockCompositionService.generateThumbnails.mockResolvedValue([{ format: 'YOUTUBE' }]);

    const res = await request(app)
      .post('/api/v1/compositions')
      .send({
        episode_id: EPISODE,
        template_studio_id: STUDIO,
        asset_map: { 'BG.MAIN': LALA, 'TEXT.SHOW.TITLE': 'Styling Adventures' },
        selected_formats: ['YOUTUBE'],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.thumbnails_generated).toBe(1);

    expect(mockSequelizeQuery).toHaveBeenCalledWith(expect.stringMatching(/FROM template_studio WHERE id = \$1/), {
      bind: [STUDIO],
    });
    expect(mockModels.ThumbnailComposition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        episode_id: EPISODE,
        template_studio_id: STUDIO,
        selected_formats: ['YOUTUBE'],
        status: 'PENDING',
        created_by: 'u1',
      }),
    );
    // Asset ids and text values both arrive as strings, so both become
    // composition_assets rows (existing behaviour, not changed here); the
    // TEXT.* value is also kept in composition_config.text_fields.
    expect(mockModels.CompositionAsset.bulkCreate).toHaveBeenCalledWith([
      { composition_id: 'comp-1', asset_id: LALA, asset_role: 'BG.MAIN' },
      { composition_id: 'comp-1', asset_id: 'Styling Adventures', asset_role: 'TEXT.SHOW.TITLE' },
    ]);
    expect(composition.composition_config).toEqual({ text_fields: { 'TEXT.SHOW.TITLE': 'Styling Adventures' } });
    expect(mockModels.CompositionOutput.bulkCreate).toHaveBeenCalledWith([
      { composition_id: 'comp-1', format: 'YOUTUBE', status: 'PROCESSING', generated_by: 'u1' },
    ]);
    expect(mockCompositionService.generateThumbnails).toHaveBeenCalledWith('comp-1', ['YOUTUBE']);
  });

  test('an unknown template_studio_id is still a 400', async () => {
    mockSequelizeQuery.mockResolvedValue([[]]);
    const res = await request(app)
      .post('/api/v1/compositions')
      .send({ episode_id: EPISODE, template_studio_id: STUDIO, assets: { 'BG.MAIN': LALA }, selected_formats: ['YOUTUBE'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid template_studio_id');
    expect(mockModels.ThumbnailComposition.create).not.toHaveBeenCalled();
  });
});
