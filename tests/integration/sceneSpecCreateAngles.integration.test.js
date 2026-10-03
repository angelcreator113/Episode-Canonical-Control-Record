/**
 * POST /api/v1/scene-sets/:id/spec/create-angles (audit SCENE-01/02,
 * 2026-10-03): every contract's view is tried; the ones that fail are named
 * with a reason and the ones that succeed stay; a retry with `labels`
 * creates only the named views; the label is the idempotent key; each new
 * angle carries its zone kind. And the backfill migration gives legacy
 * rows their kind from their label. Through the real route on the
 * migrated database.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { contractAngleRows } = require('../../src/routes/sceneSetRoutes');
const backfill = require('../../src/migrations/20261003140000-scene-angles-backfill-kind-from-label');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const CONTRACTS = [
  { angle: 'ESTABLISHING', description: 'The entrance from the street', kind: 'front' },
  { angle: 'WIDE', description: 'The whole room from the door' },
  { angle: 'CLOSE', description: 'The vanity mirror', kind: 'extra' },
];

describe('contractAngleRows', () => {
  test('one row per missing contract, with its kind; existing labels are reported, not re-made; `only` narrows', () => {
    const { rows, existing } = contractAngleRows(CONTRACTS, []);
    expect(rows.map((r) => [r.angle_label, r.angle_kind])).toEqual([['ESTABLISHING', 'front'], ['WIDE', 'inside'], ['CLOSE', 'extra']]);
    expect(existing).toEqual([]);
    const again = contractAngleRows(CONTRACTS, ['establishing', 'WIDE']);
    expect(again.rows.map((r) => r.angle_label)).toEqual(['CLOSE']);
    expect(again.existing).toEqual(['ESTABLISHING', 'WIDE']);
    expect(contractAngleRows(CONTRACTS, [], { only: ['close'] }).rows.map((r) => r.angle_label)).toEqual(['CLOSE']);
    // A contract kind the planner does not know falls back to the label's; an unknown label has none.
    expect(contractAngleRows([{ angle: 'DOORWAY', kind: 'sideways' }, { angle: 'OVERHEAD' }], []).rows.map((r) => r.angle_kind)).toEqual(['front', null]);
  });
});

(shouldSkip ? describe.skip : describe)('POST /scene-sets/:id/spec/create-angles', () => {
  const setId = uuid();
  let token;
  const post = (body = {}) => request(app).post(`/api/v1/scene-sets/${setId}/spec/create-angles`).set('Authorization', `Bearer ${token}`).send(body);
  const labelsInDb = async () => (await models.SceneAngle.findAll({ where: { scene_set_id: setId }, order: [['angle_label', 'ASC']] })).map((a) => [a.angle_label, a.angle_kind]);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-spec-angles', email: 'user@specangles.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, scene_spec, created_at, updated_at)
      VALUES (:id, 'Spec angles set', 'HOME_BASE', 'complete', :spec::jsonb, NOW(), NOW())`,
    { id: setId, spec: JSON.stringify({ version: '2.0', camera_contracts: CONTRACTS }) });
  });

  afterEach(() => jest.restoreAllMocks());

  test('one of three fails: two stay, the failed view is named; a retry creates only that view; then nothing is left to make', async () => {
    const realCreate = models.SceneAngle.create.bind(models.SceneAngle);
    jest.spyOn(models.SceneAngle, 'create').mockImplementation((row, opts) => {
      if (row.angle_label === 'CLOSE') return Promise.reject(new Error('disk full'));
      return realCreate(row, opts);
    });
    const first = await post();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ success: false, code: 'ANGLES_PARTIAL', error: '1 of 3 views could not be created' });
    expect(first.body.data.created.map((a) => [a.angle_label, a.angle_kind])).toEqual([['ESTABLISHING', 'front'], ['WIDE', 'inside']]);
    expect(first.body.data.failed).toEqual([{ angle_label: 'CLOSE', reason: 'disk full' }]);
    expect(first.body.data).toMatchObject({ existing: [], angles_created: 2, total: 2 });
    expect(await labelsInDb()).toEqual([['ESTABLISHING', 'front'], ['WIDE', 'inside']]);

    jest.restoreAllMocks();
    const retry = await post({ labels: ['CLOSE'] });
    expect(retry.body).toMatchObject({ success: true });
    expect(retry.body.data.created.map((a) => a.angle_label)).toEqual(['CLOSE']);
    expect(retry.body.data.existing).toEqual([]);
    expect(await labelsInDb()).toEqual([['CLOSE', 'extra'], ['ESTABLISHING', 'front'], ['WIDE', 'inside']]);

    const third = await post();
    expect(third.body).toMatchObject({ success: true, data: { created: [], existing: ['ESTABLISHING', 'WIDE', 'CLOSE'], failed: [], angles_created: 0, total: 3 } });
    expect((await labelsInDb()).length).toBe(3);
  });

  test('the backfill gives a legacy row its kind from its label, and leaves the rest alone', async () => {
    const legacySet = uuid();
    const wide = uuid(); const vanity = uuid(); const keyed = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, created_at, updated_at) VALUES (:id, 'Legacy set', 'HOME_BASE', 'complete', NOW(), NOW())`, { id: legacySet });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, angle_kind, generation_status, created_at, updated_at) VALUES
      (:wide, :set, 'WIDE', 'Wide', NULL, 'pending', NOW(), NOW()),
      (:vanity, :set, 'VANITY', 'Vanity', NULL, 'pending', NOW(), NOW()),
      (:keyed, :set, 'WIDE', 'Wide again', 'back', 'pending', NOW(), NOW())`, { wide, vanity, keyed, set: legacySet });
    await backfill.up(sequelize.getQueryInterface());
    const rows = await models.SceneAngle.findAll({ where: { scene_set_id: legacySet }, order: [['angle_name', 'ASC']] });
    expect(rows.map((r) => [r.angle_name, r.angle_kind])).toEqual([['Vanity', null], ['Wide', 'inside'], ['Wide again', 'back']]);
  });
});
