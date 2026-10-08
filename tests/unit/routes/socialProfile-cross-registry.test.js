// ============================================================================
// UNIT TEST — POST /social-profiles/:id/cross makes the registry character
// ============================================================================
// The route meant to add a crossed profile to a Character Registry, using
// the registry named or the newest one, but its guard required registry_id,
// which the page never sends: no Cross ever made a character (wiring map,
// docs/reads/2026-10-06-lalaverse-wiring-map.md §6 finding 6b, fix-list
// item 7). Now: the registry named, else the show's newest registry, else
// the newest registry; a character already under the key is linked, unless
// another profile holds it. The link is the registry entry's
// feed_profile_id, the one link (Evoni's ruling C3; 2026-10-08): nothing
// writes social_profiles.registry_character_id.

jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

const router = require('../../../src/routes/socialProfileRoutes');

function crossHandler() {
  const layer = router.stack.find((l) => l.route && l.route.path === '/:id/cross' && l.route.methods.post);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

const SHOW_A = '11111111-1111-1111-1111-111111111111';

const updatable = (row) => Object.assign(row, { async update(v) { Object.assign(this, v); return this; } });

function fakeDb({ registries = [], characters = [] } = {}) {
  const profile = updatable({
    id: 7, handle: '@Sable.Studio', display_name: 'Studio by Sable', platform: 'instagram', status: 'finalized',
  });
  const created = [];
  const rows = characters.map(updatable);
  const db = {
    created,
    profile,
    characters: rows,
    SocialProfile: { findByPk: async () => profile },
    CharacterRegistry: {
      findOne: async ({ where } = {}) => {
        const regs = registries.filter((r) => !where || r.show_id === where.show_id);
        return regs.sort((a, b) => b.created_at - a.created_at)[0] || null;
      },
    },
    RegistryCharacter: {
      // By the link (feed_profile_id) or by registry and key.
      findOne: async ({ where }) => ('feed_profile_id' in where
        ? rows.find((c) => c.feed_profile_id === where.feed_profile_id)
        : rows.find((c) => c.registry_id === where.registry_id && c.character_key === where.character_key)) || null,
      create: async (v) => { const row = updatable({ id: `rc-${created.length + 1}`, ...v }); created.push(row); rows.push(row); return row; },
    },
    WorldTimelineEvent: { create: async () => ({}) },
  };
  return db;
}

async function cross(db, body = {}) {
  let out;
  const res = { status(code) { this.code = code; return this; }, json(v) { out = v; return this; } };
  await crossHandler()({ params: { id: '7' }, body, app: { locals: { db } } }, res);
  return { out, code: res.code };
}

const REGISTRIES = [
  { id: 'reg-old-a', show_id: SHOW_A, created_at: 1 },
  { id: 'reg-new-b', show_id: 'other-show', created_at: 3 },
  { id: 'reg-new-a', show_id: SHOW_A, created_at: 2 },
];

describe('POST /:id/cross registry character', () => {
  beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  test("with the show, the character lands in that show's newest registry", async () => {
    const db = fakeDb({ registries: REGISTRIES });
    const { out } = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(1);
    expect(db.created[0]).toMatchObject({ registry_id: 'reg-new-a', character_key: 'sable_studio', display_name: 'Studio by Sable', feed_profile_id: 7 });
    expect(db.profile).not.toHaveProperty('registry_character_id');
    expect(db.profile.status).toBe('crossed');
    expect(out).toMatchObject({ crossed: true, registry_note: null });
  });

  test('without a show (or with a malformed one) it uses the newest registry; a named registry wins', async () => {
    let db = fakeDb({ registries: REGISTRIES });
    await cross(db, {});
    expect(db.created[0].registry_id).toBe('reg-new-b');
    db = fakeDb({ registries: REGISTRIES });
    await cross(db, { show_id: "x' OR 1=1" });
    expect(db.created[0].registry_id).toBe('reg-new-b');
    db = fakeDb({ registries: REGISTRIES });
    await cross(db, { registry_id: 'reg-old-a', show_id: SHOW_A });
    expect(db.created[0].registry_id).toBe('reg-old-a');
  });

  test('a character already under the key is linked, not duplicated; one held by another profile is left alone', async () => {
    let db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-existing', registry_id: 'reg-new-a', character_key: 'sable_studio', feed_profile_id: null }] });
    let r = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(db.characters[0].feed_profile_id).toBe(7);
    expect(r.out.registry_character.id).toBe('rc-existing');

    db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-other', registry_id: 'reg-new-a', character_key: 'sable_studio', feed_profile_id: 99 }] });
    r = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(db.characters[0].feed_profile_id).toBe(99);
    expect(r.out.registry_character).toBeNull();
    expect(r.out.registry_note).toMatch(/linked to another profile/);
    expect(db.profile.status).toBe('crossed');
  });

  test('with no registry at all it still crosses and says why no character was made', async () => {
    const db = fakeDb({ registries: [] });
    const { out } = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(out).toMatchObject({ crossed: true, registry_character: null, registry_note: 'No character registry to add this profile to yet.' });
  });

  test('a profile already linked (a registry entry\'s feed_profile_id) keeps its character', async () => {
    const db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-kept', registry_id: 'reg-old-a', character_key: 'kept', feed_profile_id: 7 }] });
    const { out } = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(out.registry_character.id).toBe('rc-kept');
    expect(db.profile.status).toBe('crossed');
  });
});
