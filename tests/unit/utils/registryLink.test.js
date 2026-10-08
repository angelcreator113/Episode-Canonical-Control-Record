/**
 * utils/registryLink — the one link between a Feed profile and its registry
 * character, on the registry entry (registry_characters.feed_profile_id;
 * Evoni's ruling C3, docs/navigation-architecture.md, and 2026-10-08 "One
 * link, per C3"). social_profiles.registry_character_id is not read.
 */
const { linkedCharacter, withRegistryLinks, LINKED_CHARACTER_JOIN } = require('../../../src/utils/registryLink');

describe('linkedCharacter', () => {
  test('the registry entry whose feed_profile_id is the profile, the newest first', async () => {
    const RegistryCharacter = { findOne: jest.fn(async () => ({ id: 'rc-1' })) };
    expect(await linkedCharacter({ RegistryCharacter }, 7, ['id'])).toEqual({ id: 'rc-1' });
    expect(RegistryCharacter.findOne).toHaveBeenCalledWith({ where: { feed_profile_id: 7 }, attributes: ['id'], order: [['updated_at', 'DESC']] });
    await linkedCharacter({ RegistryCharacter }, 7);
    expect(RegistryCharacter.findOne.mock.calls[1][0]).not.toHaveProperty('attributes');
  });

  test('no model, or no profile: null, and nothing is asked', async () => {
    const RegistryCharacter = { findOne: jest.fn() };
    expect(await linkedCharacter({}, 7)).toBeNull();
    expect(await linkedCharacter(null, 7)).toBeNull();
    expect(await linkedCharacter({ RegistryCharacter }, null)).toBeNull();
    expect(RegistryCharacter.findOne).not.toHaveBeenCalled();
  });
});

describe('withRegistryLinks', () => {
  test('each profile carries its registry entry\'s id, the newest entry should two claim it; unlinked ones carry null', async () => {
    const RegistryCharacter = { findAll: jest.fn(async () => [
      { id: 'rc-new', feed_profile_id: 1 }, { id: 'rc-old', feed_profile_id: 1 }, { id: 'rc-2', feed_profile_id: 2 },
    ]) };
    const instance = { toJSON: () => ({ id: 2, handle: '@two' }) };
    const out = await withRegistryLinks({ RegistryCharacter }, [{ id: 1, handle: '@one' }, instance, { id: 3, handle: '@three' }]);
    expect(out).toEqual([
      { id: 1, handle: '@one', registry_character_id: 'rc-new' },
      { id: 2, handle: '@two', registry_character_id: 'rc-2' },
      { id: 3, handle: '@three', registry_character_id: null },
    ]);
    expect(RegistryCharacter.findAll).toHaveBeenCalledWith({
      where: { feed_profile_id: [1, 2, 3] }, attributes: ['id', 'feed_profile_id'], order: [['updated_at', 'DESC']], raw: true,
    });
  });

  test('a stored registry_character_id is never what a profile carries', async () => {
    const RegistryCharacter = { findAll: jest.fn(async () => []) };
    const [p] = await withRegistryLinks({ RegistryCharacter }, [{ id: 4, registry_character_id: 999 }]);
    expect(p.registry_character_id).toBeNull();
  });

  test('no profiles: no query; no model: every link null', async () => {
    const RegistryCharacter = { findAll: jest.fn() };
    expect(await withRegistryLinks({ RegistryCharacter }, [])).toEqual([]);
    expect(await withRegistryLinks({ RegistryCharacter }, null)).toEqual([]);
    expect(RegistryCharacter.findAll).not.toHaveBeenCalled();
    expect(await withRegistryLinks({}, [{ id: 5 }])).toEqual([{ id: 5, registry_character_id: null }]);
  });
});

test('the raw SQL join reads the registry entry\'s link, live entries only, one per profile', () => {
  expect(LINKED_CHARACTER_JOIN).toMatch(/r\.feed_profile_id = sp\.id/);
  expect(LINKED_CHARACTER_JOIN).toMatch(/r\.deleted_at IS NULL/);
  expect(LINKED_CHARACTER_JOIN).toMatch(/LIMIT 1/);
  expect(LINKED_CHARACTER_JOIN).not.toMatch(/registry_character_id/);
});
