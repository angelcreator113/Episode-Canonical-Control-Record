// ============================================================================
// UNIT TEST — creating a registry character makes no Feed profile
// ============================================================================
// Evoni's ruling, 2026-10-08, "Only by proposal": a character gets a Feed
// profile when its Feed proposal is confirmed (characterGenerationRoutes
// POST /confirm-feed), not when the Registry page creates it. The create
// used to call feedAutoGeneration's autoCreateFeedProfile, whose insert
// always failed on the INTEGER social_profiles.registry_character_id
// column; the service is gone.

const express = require('express');
const request = require('supertest');

const mockCharacter = { id: 'rc-1', character_key: 'nia', update: jest.fn() };
jest.mock('../../../src/models', () => ({
  CharacterRegistry: { findByPk: jest.fn(async () => ({ id: 'reg-1' })) },
  RegistryCharacter: { count: jest.fn(async () => 0), create: jest.fn(async () => mockCharacter) },
  SocialProfile: { create: jest.fn(), count: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const models = require('../../../src/models');
const router = require('../../../src/routes/characterRegistry');

const app = express();
app.use(express.json());
app.use('/api/v1/character-registry', router);

test('POST /registries/:id/characters saves the character and makes no Feed profile', async () => {
  const res = await request(app).post('/api/v1/character-registry/registries/reg-1/characters')
    .send({ display_name: 'Nia Vale', character_key: 'nia', feed_layer: 'lalaverse', platform_primary: 'tiktok' });
  expect(res.status).toBe(201);
  expect(res.body.character).toMatchObject({ id: 'rc-1' });
  expect(models.SocialProfile.create).not.toHaveBeenCalled();
  expect(models.SocialProfile.count).not.toHaveBeenCalled();
  expect(mockCharacter.update).not.toHaveBeenCalledWith(expect.objectContaining({ feed_profile_id: expect.anything() }));
  for (const key of ['feedProfile', 'feedProfileSkipped', 'feedSkipReason']) expect(res.body).not.toHaveProperty(key);
});

test('the auto-create service no longer exists', () => {
  expect(() => require('../../../src/services/feedAutoGeneration')).toThrow(/Cannot find module/);
});
