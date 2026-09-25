// ============================================================================
// UNIT TESTS — hair and makeup POST /generate with replace_existing (Task #1876)
// ============================================================================
// The AI response is parsed and validated before any destroy, and the destroy
// plus every create run in one transaction. No database: the models are
// mocked, but their rawAttributes come from the real model definitions so the
// column-length checks are exercised against the real schema.

const path = require('path');
const express = require('express');
const request = require('supertest');
const { Sequelize } = require('sequelize');

const SRC = path.join(__dirname, '..', '..', '..', 'src');

const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: (...args) => mockAnthropicCreate(...args) },
  }))
);
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({
  aiRateLimiter: (req, res, next) => next(),
}));

const mockDb = {};
jest.mock('../../../src/models', () => mockDb);

// Real model definitions on a Sequelize instance that never connects.
const offline = new Sequelize('postgres://u:p@127.0.0.1:1/none', { logging: false });
const RealHair = require(path.join(SRC, 'models', 'HairLibrary'))(offline);
const RealMakeup = require(path.join(SRC, 'models', 'MakeupLibrary'))(offline);

const SHOW_ID = '11111111-1111-4111-8111-111111111111';

const validHair = (i) => ({
  name: `Silk Press ${i}`,
  description: 'Sleek and pressed.',
  vibe_tags: ['sleek'],
  occasion_tags: ['gala'],
  event_types: ['industry'],
  color_state: 'natural black',
  length: 'shoulder',
  texture: 'silk press',
  career_echo_potential: null,
  is_justAWoman_style: true,
  sort_order: i,
});

const validMakeup = (i) => ({
  name: `Soft Glam ${i}`,
  description: 'Soft and luminous.',
  mood_tag: 'soft',
  occasion_tags: ['date'],
  event_types: ['dating'],
  aesthetic_tags: ['glam'],
  skin_finish: 'dewy',
  eye_look: 'soft smoky',
  lip_look: 'nude gloss',
  career_echo_potential: null,
  is_justAWoman_style: false,
  featured_brand: null,
  sort_order: i,
});

const LIBRARIES = [
  {
    label: 'hair',
    route: 'hairLibraryRoutes',
    modelName: 'HairLibrary',
    Real: RealHair,
    valid: validHair,
    lengthField: 'texture',
  },
  {
    label: 'makeup',
    route: 'makeupLibraryRoutes',
    modelName: 'MakeupLibrary',
    Real: RealMakeup,
    valid: validMakeup,
    lengthField: 'lip_look',
  },
];

function aiReturns(text) {
  mockAnthropicCreate.mockResolvedValue({ content: [{ text }] });
}

describe.each(LIBRARIES)('$label POST /generate replace_existing (Task #1876)', (lib) => {
  let app;
  let model;
  let tx;

  beforeAll(() => {
    const router = require(path.join(SRC, 'routes', lib.route));
    app = express();
    app.use(express.json());
    app.use('/', router);
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAnthropicCreate.mockReset();
    tx = { commit: jest.fn().mockResolvedValue(), rollback: jest.fn().mockResolvedValue() };
    let n = 0;
    model = {
      rawAttributes: lib.Real.rawAttributes,
      count: jest.fn().mockResolvedValue(0),
      destroy: jest.fn().mockResolvedValue(3),
      create: jest.fn().mockImplementation(async (row) => ({ id: `row-${n++}`, ...row })),
    };
    for (const k of Object.keys(mockDb)) delete mockDb[k];
    mockDb[lib.modelName] = model;
    mockDb.sequelize = { transaction: jest.fn().mockResolvedValue(tx) };
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  const post = () =>
    request(app).post('/generate').send({ show_id: SHOW_ID, count: 3, replace_existing: true });

  test('the length check reads the real model column length', () => {
    expect(lib.Real.rawAttributes[lib.lengthField].type._length).toBe(255);
  });

  test('invalid JSON: no destroy, error returned', async () => {
    aiReturns('this is not json');
    const res = await post();
    expect(res.status).toBe(500);
    expect(model.destroy).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  test('empty array: no destroy, error returned', async () => {
    aiReturns('[]');
    const res = await post();
    expect(res.status).toBe(500);
    expect(model.destroy).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  test('non-array JSON: no destroy, error returned', async () => {
    aiReturns(JSON.stringify({ items: [lib.valid(0)] }));
    const res = await post();
    expect(res.status).toBe(500);
    expect(model.destroy).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  test('valid JSON with an item missing its name: no destroy', async () => {
    const bad = lib.valid(1);
    delete bad.name;
    aiReturns(JSON.stringify([lib.valid(0), bad, lib.valid(2)]));
    const res = await post();
    expect(res.status).toBe(500);
    expect(res.body.problems.join(' ')).toMatch(/item 1: name is required/);
    expect(model.destroy).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
    expect(mockDb.sequelize.transaction).not.toHaveBeenCalled();
  });

  test('valid JSON with an item over the column length: no destroy', async () => {
    const bad = lib.valid(1);
    bad[lib.lengthField] = 'x'.repeat(256);
    aiReturns(JSON.stringify([lib.valid(0), bad]));
    const res = await post();
    expect(res.status).toBe(500);
    expect(res.body.problems.join(' ')).toMatch(new RegExp(`item 1: ${lib.lengthField} exceeds 255`));
    expect(model.destroy).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  test('an insert failing part-way rolls the transaction back and never commits', async () => {
    aiReturns(JSON.stringify([lib.valid(0), lib.valid(1), lib.valid(2)]));
    model.create
      .mockImplementationOnce(async (row) => ({ id: 'a', ...row }))
      .mockImplementationOnce(async () => {
        throw new Error('insert failed');
      });
    const res = await post();
    expect(res.status).toBe(500);
    expect(mockDb.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(model.destroy).toHaveBeenCalledWith({ where: { show_id: SHOW_ID }, transaction: tx });
    for (const call of model.create.mock.calls) {
      expect(call[1]).toEqual({ transaction: tx });
    }
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });

  test('a clean run destroys and creates inside one transaction and commits', async () => {
    aiReturns(JSON.stringify([lib.valid(0), lib.valid(1), lib.valid(2)]));
    const res = await post();
    expect(res.status).toBe(201);
    expect(res.body.generated).toBe(3);
    expect(res.body.items).toHaveLength(3);
    expect(mockDb.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(model.destroy).toHaveBeenCalledWith({ where: { show_id: SHOW_ID }, transaction: tx });
    expect(model.create).toHaveBeenCalledTimes(3);
    for (const call of model.create.mock.calls) {
      expect(call[1]).toEqual({ transaction: tx });
      expect(call[0].show_id).toBe(SHOW_ID);
    }
    expect(tx.commit).toHaveBeenCalledTimes(1);
    expect(tx.rollback).not.toHaveBeenCalled();
  });
});
