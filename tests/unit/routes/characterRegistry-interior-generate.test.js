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
  // An ADMIN unless the request says otherwise: generating and applying are
  // ADMIN only (Evoni, 2026-10-19: this whole part of the site is admin only).
  return { ...actual, requireAuth: (req, _res, next) => {
    const h = req.headers['x-test-groups'];
    req.user = { id: 'u1', groups: h === undefined ? ['ADMIN'] : (h ? h.split(',') : []) };
    next();
  } };
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

// The profile audit, 2026-10-19: the AI down or without a key is a plain 502.
test('the AI unreachable is a plain 502 that says nothing was spent, not the SDK\'s text', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGenerateMissingInterior.mockRejectedValue(new Error('Could not resolve authentication method. Expected either apiKey or authToken to be set.'));
  const res = await request(app).post(url).send({});
  expect(res.status).toBe(502);
  expect(res.body.error).toBe('The AI could not be reached; nothing was spent.');
  expect(JSON.stringify(res.body)).not.toMatch(/authentication method/);
  expect(mockLocked.update).not.toHaveBeenCalled();
});

test('a budget refusal stays a 429', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGenerateMissingInterior.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded'), { code: 'AI_BUDGET_EXCEEDED' }));
  const res = await request(app).post(url).send({});
  expect(res.status).toBe(429);
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


// Step 3 (Evoni, 2026-10-17): Generate All shows what it would fill before
// anything is saved; the author saves the values she keeps.
describe('preview, then apply', () => {
  const applyUrl = '/api/v1/character-registry/characters/rc-1/interior/apply';

  test('a preview writes nothing and returns what it would fill', async () => {
    mockGenerateMissingInterior.mockResolvedValue({ want_architecture: { surface_want: 'a' }, experience_of_joy: 'Fittings' });
    const res = await request(app).post(url).send({ preview: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ preview: true, proposed: { want_architecture: { surface_want: 'a' }, experience_of_joy: 'Fittings' } });
    expect(res.body.missing).not.toContain('wound');
    expect(mockLocked.update).not.toHaveBeenCalled();
  });

  test('a preview is refused to anyone but the author, so the blind spot never reaches them', async () => {
    mockGenerateMissingInterior.mockResolvedValue({ blind_spot: 'She keeps score.', self_narrative: 'Me' });
    const res = await request(app).post(url).set('x-test-groups', 'editor').send({ preview: true, fields: ['blind_spot', 'self_narrative'] });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/keeps score/);
    expect(mockGenerateMissingInterior).not.toHaveBeenCalled();
  });

  test('the author\'s preview carries the blind spot', async () => {
    mockGenerateMissingInterior.mockResolvedValue({ blind_spot: 'She keeps score.', self_narrative: 'Me' });
    const res = await request(app).post(url).send({ preview: true, fields: ['blind_spot', 'self_narrative'] });
    expect(res.status).toBe(200);
    expect(res.body.proposed).toEqual({ blind_spot: 'She keeps score.', self_narrative: 'Me' });
  });

  test('apply writes the chosen values into empty fields only, and says what it skipped', async () => {
    const res = await request(app).post(applyUrl).send({
      values: { experience_of_joy: ' Fittings ', wound: { description: 'generated' }, time_orientation: 'future_obsessed' },
    });
    expect(res.status).toBe(200);
    expect(res.body.filled.sort()).toEqual(['experience_of_joy', 'time_orientation']);
    expect(res.body.skipped).toEqual(['wound']);
    expect(mockLocked.update.mock.calls[0][0]).toMatchObject({ experience_of_joy: 'Fittings', time_orientation: 'future_oriented' });
    expect(mockLocked.wound).toEqual({ description: 'kept' });
    expect(mockGenerateMissingInterior).not.toHaveBeenCalled();
  });

  test('apply drops a value the field does not take', async () => {
    const res = await request(app).post(applyUrl).send({ values: { want_architecture: 'not an object' } });
    expect(res.status).toBe(200);
    expect(res.body.filled).toEqual([]);
    expect(res.body.skipped).toEqual(['want_architecture']);
  });

  test('apply never writes the blind spot for anyone but the author: they are refused', async () => {
    const res = await request(app).post(applyUrl).set('x-test-groups', 'editor').send({ values: { blind_spot: 'Written by an editor' } });
    expect(res.status).toBe(403);
    expect(mockLocked.update).not.toHaveBeenCalled();
    expect(mockLocked.blind_spot).toBeUndefined();
  });

  test('apply refuses unknown fields, an empty body and a finalized character', async () => {
    expect((await request(app).post(applyUrl).send({ values: { description: 'x' } })).status).toBe(400);
    expect((await request(app).post(applyUrl).send({})).status).toBe(400);
    mockStored.status = 'finalized';
    expect((await request(app).post(applyUrl).send({ values: { experience_of_joy: 'x' } })).status).toBe(409);
  });
});
