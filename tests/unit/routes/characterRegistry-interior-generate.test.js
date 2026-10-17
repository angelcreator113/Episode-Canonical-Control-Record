// ============================================================================
// UNIT TEST — POST /characters/:id/interior/generate
// ============================================================================
// A character who came from the feed has no inner life, and the character
// page's Generate links did nothing. This fills in what is missing, built
// from what the character already is, and never overwrites what is there.

const express = require('express');
const request = require('supertest');

const mockGenerateMissingInterior = jest.fn();
jest.mock('../../../src/services/characterGenerationService', () => {
  const actual = jest.requireActual('../../../src/services/characterGenerationService');
  return { ...actual, generateMissingInterior: (...args) => mockGenerateMissingInterior(...args) };
});

const mockRow = (data) => ({
  ...data,
  toJSON() { const { toJSON, update, ...rest } = this; return rest; },
  update: jest.fn(async function (patch) { Object.assign(this, patch); return this; }),
});

let mockStored;
let mockFeedProfile;
let mockLocked;
jest.mock('../../../src/models', () => ({
  RegistryCharacter: { findByPk: jest.fn(async (_id, opts) => (opts?.lock ? mockLocked : mockStored)) },
  SocialProfile: {
    findByPk: jest.fn(async () => mockFeedProfile),
    update: jest.fn(async () => [1]),
  },
  sequelize: { transaction: jest.fn(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })) },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const router = require('../../../src/routes/characterRegistry');
const gen = jest.requireActual('../../../src/services/characterGenerationService');

const app = express();
app.use(express.json());
app.use('/api/v1/character-registry', router);
const url = '/api/v1/character-registry/characters/rc-1/interior/generate';

beforeEach(() => {
  mockGenerateMissingInterior.mockReset();
  require('../../../src/models').SocialProfile.update.mockClear();
  mockFeedProfile = { id: 7, handle: 'slowsift', vibe_sentence: 'linen on a line' };
  mockStored = mockRow({ id: 'rc-1', display_name: 'slowsift', feed_profile_id: 7, depth_level: null, wound: { description: 'kept' } });
  mockLocked = mockRow({ ...mockStored.toJSON() });
});

test('fills only the missing fields, from the character and their feed profile, and raises the depth level', async () => {
  mockGenerateMissingInterior.mockResolvedValue({ want_architecture: { surface_want: 'a', real_want: 'b', forbidden_want: 'c' } });
  const res = await request(app).post(url).send({ fields: ['want_architecture', 'wound'] });

  expect(res.status).toBe(200);
  expect(res.body.filled).toEqual(['want_architecture']);
  const call = mockGenerateMissingInterior.mock.calls[0][0];
  expect(call.fields).toEqual(['want_architecture']); // wound is already there
  expect(call.feedProfile).toMatchObject({ handle: 'slowsift' });
  expect(mockLocked.update).toHaveBeenCalledWith(
    expect.objectContaining({ want_architecture: expect.any(Object), depth_level: 'active' }),
    expect.anything(),
  );
  expect(mockLocked.update.mock.calls[0][0]).not.toHaveProperty('wound');
});

test('never overwrites a field written while the generation ran', async () => {
  mockLocked.want_architecture = { surface_want: 'written by Evoni meanwhile' };
  mockGenerateMissingInterior.mockResolvedValue({ want_architecture: { surface_want: 'generated' } });
  const res = await request(app).post(url).send({ fields: ['want_architecture'] });
  expect(res.status).toBe(200);
  expect(res.body.filled).toEqual([]);
  expect(mockLocked.want_architecture).toEqual({ surface_want: 'written by Evoni meanwhile' });
});

test('nothing missing: no AI call', async () => {
  const res = await request(app).post(url).send({ fields: ['wound'] });
  expect(res.status).toBe(200);
  expect(res.body.filled).toEqual([]);
  expect(mockGenerateMissingInterior).not.toHaveBeenCalled();
});

test('an unknown field is refused', async () => {
  const res = await request(app).post(url).send({ fields: ['description'] });
  expect(res.status).toBe(400);
  expect(mockGenerateMissingInterior).not.toHaveBeenCalled();
});

test('a finalized character is refused', async () => {
  mockStored.status = 'finalized';
  const res = await request(app).post(url).send({});
  expect(res.status).toBe(409);
  expect(mockGenerateMissingInterior).not.toHaveBeenCalled();
});

test('an empty answer is an error, not a silent success', async () => {
  mockGenerateMissingInterior.mockResolvedValue({});
  const res = await request(app).post(url).send({});
  expect(res.status).toBe(502);
  expect(res.body.error).toMatch(/Try again/);
});

describe('interiorUpdates', () => {
  test('keeps only values each column takes', () => {
    const out = gen.interiorUpdates({
      time_orientation: 'Future obsessed',
      triggers: ['being ignored', ''],
      blind_spot: { not: 'text' },
      wound: 'not an object',
      self_narrative: '  she earned this  ',
      dilemma: { central_tension: 'x' },
      extra: 'never asked for',
    }, ['time_orientation', 'triggers', 'blind_spot', 'wound', 'self_narrative', 'dilemma']);
    expect(out).toEqual({
      // An old name takes its new one (the five times since the depth merge, 2026-10-17).
      time_orientation: 'future_oriented',
      triggers: ['being ignored'],
      self_narrative: 'she earned this',
      dilemma: { central_tension: 'x' },
    });
  });

  test('an unknown time orientation is dropped', () => {
    expect(gen.interiorUpdates({ time_orientation: 'sometimes' }, ['time_orientation'])).toEqual({});
  });
});

test('missingInteriorFields treats empty objects and arrays as missing', () => {
  const missing = gen.missingInteriorFields({ wound: {}, triggers: [], the_mask: { description: 'x' } }, ['wound', 'triggers', 'the_mask']);
  expect(missing).toEqual(['wound', 'triggers']);
});

describe('their real name', () => {
  test("a real name the feed profile already has is copied, not invented", async () => {
    mockFeedProfile.creator_name = 'Maren Ellis';
    const res = await request(app).post(url).send({ fields: ['selected_name'] });
    expect(res.status).toBe(200);
    expect(res.body.filled).toEqual(['selected_name']);
    expect(mockGenerateMissingInterior).not.toHaveBeenCalled();
    expect(mockLocked.selected_name).toBe('Maren Ellis');
  });

  test('a suggested real name is written to the feed profile too (never the locked JustAWoman record)', async () => {
    mockGenerateMissingInterior.mockResolvedValue({ selected_name: 'Maren Ellis' });
    const res = await request(app).post(url).send({ fields: ['selected_name'] });
    expect(res.status).toBe(200);
    const models = require('../../../src/models');
    expect(models.SocialProfile.update).toHaveBeenCalledWith(
      { creator_name: 'Maren Ellis' },
      { where: { id: 7, is_justawoman_record: expect.anything() } },
    );
  });

  test('the generator asks for real_name and reads it back as selected_name', () => {
    expect(gen.interiorUpdates({ real_name: '  Maren Ellis ' }, ['selected_name'])).toEqual({ selected_name: 'Maren Ellis' });
    expect(gen.interiorUpdates({ selected_name: '@slowsift' }, ['selected_name'])).toEqual({});
  });
});

