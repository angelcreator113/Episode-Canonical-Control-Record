/**
 * Task #1909 — "Save draft" in the Layout Editor kept nothing.
 *
 * POST /api/v1/compositions/:id/save-draft wrote draft_overrides,
 * draft_updated_at, draft_updated_by and has_unsaved_changes on a loaded
 * ThumbnailComposition. None of them was declared (or in canon), so
 * Sequelize dropped all four and the route answered "Draft saved
 * successfully". apply-draft then read a draft_overrides that was never
 * stored, and its layout_overrides write was dropped the same way.
 *
 * The composition here is the real model, defined on a never-connected
 * Sequelize instance (tests/unit/helpers/schemaCheckedModel.js). The loaded
 * row is a recording fake that does what Sequelize does with an instance
 * update: it keeps a key only when the model declares it and drops the rest
 * with no error. describeTable is stubbed, so each test says which columns
 * the live table has. No database.
 */
const express = require('express');
const request = require('supertest');

const DRAFT_COLUMNS = ['draft_overrides', 'draft_updated_at', 'draft_updated_by', 'has_unsaved_changes', 'layout_overrides'];
const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** A loaded row whose update() keeps declared keys only, as Sequelize does. */
function recordingInstance(Model, row) {
  const inst = { ...row };
  const stored = [];
  const dropped = [];
  inst.update = jest.fn(async (values) => {
    const kept = {};
    for (const [k, v] of Object.entries(values)) {
      if (has(Model.rawAttributes, k)) { kept[k] = v; inst[k] = v; } else dropped.push(k);
    }
    stored.push(kept);
    return inst;
  });
  inst.toJSON = () => Object.fromEntries(Object.entries(inst).filter(([, v]) => typeof v !== 'function'));
  Object.defineProperty(inst, 'stored', { value: stored });
  Object.defineProperty(inst, 'dropped', { value: dropped });
  return inst;
}

/**
 * @param {object} opts
 * @param {boolean} opts.declared — does the model declare the five draft columns?
 * @param {string[]} opts.tableHas — draft columns the live table has
 */
function harness({ declared, tableHas = [], row = { id: ID, current_version: 1, version_history: {} } }) {
  const { loadModel } = require('../helpers/schemaCheckedModel');
  const Model = loadModel('ThumbnailComposition');
  if (!declared) for (const c of DRAFT_COLUMNS) if (has(Model.rawAttributes, c)) Model.removeAttribute(c);

  const baseColumns = Object.values(Model.rawAttributes)
    .map((a) => a.field)
    .filter((c) => !DRAFT_COLUMNS.includes(c));
  const table = { cols: new Set([...baseColumns, ...tableHas]) };
  const describeTable = jest
    .spyOn(Model.sequelize.getQueryInterface(), 'describeTable')
    .mockImplementation(async () => Object.fromEntries([...table.cols].map((c) => [c, {}])));

  const instance = recordingInstance(Model, row);
  const findByPk = jest.spyOn(Model, 'findByPk').mockImplementation(async () => instance);

  jest.doMock('../../../src/models', () => ({ models: { ThumbnailComposition: Model, CompositionOutput: {} } }));
  jest.doMock('../../../src/services/CompositionService', () => ({}));
  jest.doMock('../../../src/services/ThumbnailGeneratorService', () => ({}));
  jest.doMock('../../../src/services/VersioningService', () => ({}));
  jest.doMock('../../../src/services/FilterService', () => ({}));
  jest.doMock('../../../src/middleware/jwtAuth', () => ({
    authenticateJWT: (_q, _s, next) => next(),
    requireGroup: () => (_q, _s, next) => next(),
  }));
  jest.doMock('../../../src/middleware/auth', () => {
    const actual = jest.requireActual('../../../src/middleware/auth');
    return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/compositions', require('../../../src/routes/compositions'));
  return { app, Model, instance, findByPk, describeTable, table };
}

const DRAFT = { roles: { lala: { x: 120, y: 40, scale: 1.1 } } };

describe('the model does not declare the draft columns', () => {
  test('save-draft answers 501, never "saved", and touches no row', async () => {
    const { app, instance, findByPk, describeTable } = harness({ declared: false });

    const res = await request(app).post(`/api/v1/compositions/${ID}/save-draft`).send({ draft_overrides: DRAFT });

    // On main this was 200 "Draft saved successfully" with all four keys dropped.
    expect(res.status).toBe(501);
    expect(res.body).toMatchObject({ status: 'ERROR', code: 'DRAFT_COLUMNS_MISSING' });
    expect(JSON.stringify(res.body)).not.toMatch(/saved successfully/i);
    expect(findByPk).not.toHaveBeenCalled();
    expect(instance.update).not.toHaveBeenCalled();
    // Undeclared columns are dropped whatever the table has: no schema query.
    expect(describeTable).not.toHaveBeenCalled();
  });

  test('save-draft still answers 501 when the table has the columns but the model does not declare them', async () => {
    const { app, instance } = harness({ declared: false, tableHas: DRAFT_COLUMNS });

    const res = await request(app).post(`/api/v1/compositions/${ID}/save-draft`).send({ draft_overrides: DRAFT });

    expect(res.status).toBe(501);
    expect(instance.update).not.toHaveBeenCalled();
  });

  test('apply-draft answers 501 and writes nothing', async () => {
    const { app, instance, findByPk } = harness({
      declared: false,
      row: { id: ID, current_version: 1, version_history: {}, draft_overrides: DRAFT },
    });

    const res = await request(app).post(`/api/v1/compositions/${ID}/apply-draft`).send({});

    // On main this was 200 "Draft applied successfully (v2)" with layout_overrides dropped.
    expect(res.status).toBe(501);
    expect(res.body.code).toBe('DRAFT_COLUMNS_MISSING');
    expect(findByPk).not.toHaveBeenCalled();
    expect(instance.update).not.toHaveBeenCalled();
  });
});
