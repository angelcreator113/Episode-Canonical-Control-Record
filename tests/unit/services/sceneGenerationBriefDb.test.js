/**
 * The Scene Brief's database handle (S1 follow-up). The generation worker,
 * the refinement queue and the angle regenerate route pass only
 * { SceneSet, SceneAngle }; the brief must still read the set's World
 * Location and chosen event through the models' own connection, not
 * fail on `undefined.query`.
 */
jest.mock('sharp', () => jest.fn());
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

const STOP = new Error('stop after the brief');
const mockPrepare = jest.fn(async () => { throw STOP; });
jest.mock('../../../src/services/sceneBriefService', () => ({
  ...jest.requireActual('../../../src/services/sceneBriefService'),
  prepareSceneBrief: (...args) => mockPrepare(...args),
}));

const sceneGen = require('../../../src/services/sceneGenerationService');

describe('the Scene Brief reads through the models\' connection', () => {
  // S6: generateBaseScene first asks, through the same connection, whether
  // the set's base is an approved base; here none is.
  const db = { query: jest.fn(async () => [[]]) };
  const SceneSet = { sequelize: db, update: jest.fn(async () => [1]), increment: jest.fn() };
  const SceneAngle = { sequelize: db, update: jest.fn(async () => [1]) };
  const set = { id: 'set-1', show_id: 'show-1', world_location_id: 'loc-1', base_still_url: 'https://img/base.png' };
  const angle = { id: 'angle-1', angle_label: 'WIDE', angle_name: 'Wide' };

  beforeEach(() => {
    mockPrepare.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('briefDb: models.sequelize, else the model\'s own connection, else null', () => {
    const own = { query: jest.fn() };
    expect(sceneGen.briefDb({ sequelize: own, SceneSet })).toBe(own);
    expect(sceneGen.briefDb({ SceneSet, SceneAngle })).toBe(db);
    expect(sceneGen.briefDb({ SceneAngle })).toBe(db);
    expect(sceneGen.briefDb({})).toBeNull();
    expect(sceneGen.briefDb(undefined)).toBeNull();
  });

  test('generateBaseScene with { SceneSet, SceneAngle } (the worker) passes the connection', async () => {
    await expect(sceneGen.generateBaseScene(set, { SceneSet, SceneAngle })).rejects.toBe(STOP);
    expect(mockPrepare.mock.calls[0][0]).toBe(db);
    expect(db.query.mock.calls[0][0]).toMatch(/approved_base_scene_set_id = :id/);
  });

  test('regenerateAngleRefined with { SceneAngle, SceneSet } (the queue and the route) passes the connection', async () => {
    await expect(sceneGen.regenerateAngleRefined(angle, set, ['blur'], { SceneAngle, SceneSet })).rejects.toBe(STOP);
    expect(mockPrepare.mock.calls[0][0]).toBe(db);
  });
});
