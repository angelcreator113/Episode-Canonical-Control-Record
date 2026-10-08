/**
 * services/registrySyncService finds a profile's registry character by the
 * one link, on the registry entry: registry_characters.feed_profile_id
 * (Evoni's ruling C3; 2026-10-08, "One link, per C3"). It read
 * social_profiles.registry_character_id, which no write ever filled, so no
 * profile ever synced to its character.
 */
const { Op } = require('sequelize');
const { syncProfileToRegistry, syncAllLinkedProfiles } = require('../../../src/services/registrySyncService');

const profile = (id, extra = {}) => ({ id, handle: `@p${id}`, platform: 'instagram', follower_tier: 'mid', ...extra });

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('syncProfileToRegistry', () => {
  test('the character is the registry entry linked to the profile, whatever the profile itself holds', async () => {
    const character = { id: 'rc-1', display_name: 'Nia', aesthetic_dna: {}, update: jest.fn(async () => {}) };
    const RegistryCharacter = { findOne: jest.fn(async () => character) };
    const out = await syncProfileToRegistry(profile(7, { registry_character_id: null }), { RegistryCharacter });
    expect(RegistryCharacter.findOne.mock.calls[0][0].where).toEqual({ feed_profile_id: 7 });
    expect(character.update).toHaveBeenCalledWith(expect.objectContaining({ feed_profile_id: 7, social_presence: true }));
    // The profile's platform is not the registry's platform_primary (how the
    // character appears: lalaverse_main, multi_platform, ...): writing it
    // failed every sync.
    expect(character.update.mock.calls[0][0]).not.toHaveProperty('platform_primary');
    expect(out).toMatchObject({ synced: true, characterId: 'rc-1' });
  });

  test('no linked entry: nothing is written', async () => {
    const RegistryCharacter = { findOne: jest.fn(async () => null) };
    expect(await syncProfileToRegistry(profile(8, { registry_character_id: 'rc-stale' }), { RegistryCharacter }))
      .toEqual({ synced: false, reason: 'No linked registry character' });
    expect(await syncProfileToRegistry(profile(8), {})).toEqual({ synced: false, reason: 'RegistryCharacter model not loaded' });
  });
});

describe('syncAllLinkedProfiles', () => {
  test('syncs the profiles the registry entries link to', async () => {
    const characters = { 7: { id: 'rc-7', aesthetic_dna: {}, update: jest.fn(async () => {}) }, 9: { id: 'rc-9', aesthetic_dna: {}, update: jest.fn(async () => {}) } };
    const RegistryCharacter = {
      findAll: jest.fn(async () => [{ feed_profile_id: 7 }, { feed_profile_id: 9 }, { feed_profile_id: 7 }]),
      findOne: jest.fn(async ({ where }) => characters[where.feed_profile_id] || null),
    };
    const SocialProfile = { findAll: jest.fn(async () => [profile(7), profile(9)]) };
    expect(await syncAllLinkedProfiles({ RegistryCharacter, SocialProfile })).toEqual({ synced: 2, total: 2 });
    const { where, attributes } = SocialProfile.findAll.mock.calls[0][0];
    expect(where.id[Op.in]).toEqual([7, 9]);
    expect(attributes).not.toContain('registry_character_id');
    expect(characters[7].update).toHaveBeenCalled();
    expect(characters[9].update).toHaveBeenCalled();
  });

  test('no entry links a profile: no profile query', async () => {
    const RegistryCharacter = { findAll: jest.fn(async () => []) };
    const SocialProfile = { findAll: jest.fn() };
    expect(await syncAllLinkedProfiles({ RegistryCharacter, SocialProfile })).toEqual({ synced: 0, total: 0 });
    expect(SocialProfile.findAll).not.toHaveBeenCalled();
  });
});
