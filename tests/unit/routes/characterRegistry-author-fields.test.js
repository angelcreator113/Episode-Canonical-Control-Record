// ============================================================================
// characterRegistry PUT /characters/:id — author-only field filter (#1699)
// ============================================================================
// The filter used to test req.user.role, which no user has, so the four
// author-only fields were dropped for everyone. It now reads the Cognito admin
// group. Editors, viewers and group-less users are still filtered.

const express = require('express');
const request = require('supertest');

const mockCharacter = { save: jest.fn().mockResolvedValue(undefined) };
jest.mock('../../../src/models', () => ({
  RegistryCharacter: { findByPk: jest.fn(async () => mockCharacter) },
}));
jest.mock('../../../src/services/feedAutoGeneration', () => ({ autoCreateFeedProfile: jest.fn() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    // Test double: groups come from a header; real userInGroup stays in place.
    requireAuth: (req, _res, next) => {
      const h = req.headers['x-test-groups'];
      req.user = { id: 'u1', groups: h ? h.split(',') : [] };
      next();
    },
  };
});

const router = require('../../../src/routes/characterRegistry');

const app = express();
app.use('/api/v1/character-registry', router);

const AUTHOR_ONLY = {
  de_blind_spot: 'She cannot see it.',
  de_blind_spot_evidence: 'Everyone else can.',
  de_blind_spot_crack_condition: 'A loss.',
  de_actual_narrative_gap: 'The story she tells is not the one she lives.',
};

const put = (groups) => {
  const req = request(app).put('/api/v1/character-registry/characters/c-1');
  if (groups !== undefined) req.set('x-test-groups', groups);
  return req.send({ ...AUTHOR_ONLY, subtitle: 'kept' });
};

beforeEach(() => {
  for (const k of [...Object.keys(AUTHOR_ONLY), 'subtitle']) delete mockCharacter[k];
  mockCharacter.save.mockClear();
});

describe('PUT /characters/:id author-only fields', () => {
  test('admin-group user writes the four author-only fields', async () => {
    const res = await put('admin');
    expect(res.status).toBe(200);
    for (const [k, v] of Object.entries(AUTHOR_ONLY)) expect(mockCharacter[k]).toBe(v);
    expect(mockCharacter.subtitle).toBe('kept');
  });

  test('mixed-case admin group is accepted (case-insensitive)', async () => {
    const res = await put('Admin');
    expect(res.status).toBe(200);
    expect(mockCharacter.de_blind_spot).toBe(AUTHOR_ONLY.de_blind_spot);
  });

  test('editor-group user: author-only fields still filtered, other fields saved', async () => {
    const res = await put('editor');
    expect(res.status).toBe(200);
    for (const k of Object.keys(AUTHOR_ONLY)) expect(mockCharacter[k]).toBeUndefined();
    expect(mockCharacter.subtitle).toBe('kept');
  });

  test('user with no groups: author-only fields still filtered', async () => {
    const res = await put();
    expect(res.status).toBe(200);
    for (const k of Object.keys(AUTHOR_ONLY)) expect(mockCharacter[k]).toBeUndefined();
    expect(mockCharacter.subtitle).toBe('kept');
  });
});
