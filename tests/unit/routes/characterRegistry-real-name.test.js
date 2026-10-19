// ============================================================================
// UNIT TEST — a character's real name reaches their feed profile
// ============================================================================
// Evoni, 2026-10-15: "a character should have a social media name and a real
// name". The real name is the character's selected_name; on the feed it is
// the linked profile's creator_name. PUT /characters/:id with selected_name
// sets both, never on JustAWoman's locked record.

const express = require('express');
const request = require('supertest');

const mockCharacter = {
  id: 'rc-1', display_name: 'slowsift', feed_profile_id: 7, status: 'accepted',
  save: jest.fn(async () => {}),
};
jest.mock('../../../src/models', () => ({
  RegistryCharacter: { findByPk: jest.fn(async () => mockCharacter) },
  SocialProfile: { update: jest.fn(async () => [1]) },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  // An ADMIN: generating is ADMIN only (Evoni, 2026-10-19: this whole part of the site is admin only).
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: ['ADMIN'] }; next(); } };
});

const models = require('../../../src/models');
const router = require('../../../src/routes/characterRegistry');

const app = express();
app.use(express.json());
app.use('/api/v1/character-registry', router);

beforeEach(() => { models.SocialProfile.update.mockClear(); mockCharacter.save.mockClear(); });

test('saving a real name sets the feed profile\'s creator_name, never the locked record', async () => {
  const res = await request(app).put('/api/v1/character-registry/characters/rc-1').send({ selected_name: 'Maren Ellis' });
  expect(res.status).toBe(200);
  expect(mockCharacter.selected_name).toBe('Maren Ellis');
  expect(models.SocialProfile.update).toHaveBeenCalledTimes(1);
  const [values, { where }] = models.SocialProfile.update.mock.calls[0];
  expect(values).toEqual({ creator_name: 'Maren Ellis' });
  expect(where.id).toBe(7);
  expect(where.is_justawoman_record).toBeDefined();
});

test('a save that does not touch the real name leaves the feed profile alone', async () => {
  const res = await request(app).put('/api/v1/character-registry/characters/rc-1').send({ prose_overview: 'x' });
  expect(res.status).toBe(200);
  expect(models.SocialProfile.update).not.toHaveBeenCalled();
});
