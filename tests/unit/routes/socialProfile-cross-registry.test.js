// ============================================================================
// UNIT TEST — POST /social-profiles/:id/cross makes the registry character
// ============================================================================
// The route meant to add a crossed profile to a Character Registry, using
// the registry named or the newest one, but its guard required registry_id,
// which the page never sends: no Cross ever made a character (wiring map,
// docs/reads/2026-10-06-lalaverse-wiring-map.md §6 finding 6b, fix-list
// item 7). Now: the registry named, else the show's newest registry, else
// the newest registry; a character already under the key is linked, unless
// another profile holds it.

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

function fakeDb({ registries = [], characters = [] } = {}) {
  const profile = {
    id: 7, handle: '@Sable.Studio', display_name: 'Studio by Sable', platform: 'instagram', status: 'finalized',
    registry_character_id: null,
    async update(v) { Object.assign(this, v); return this; },
  };
  const created = [];
  const db = {
    created,
    profile,
    SocialProfile: { findByPk: async () => profile },
    CharacterRegistry: {
      findOne: async ({ where } = {}) => {
        const rows = registries.filter((r) => !where || r.show_id === where.show_id);
        return rows.sort((a, b) => b.created_at - a.created_at)[0] || null;
      },
    },
    RegistryCharacter: {
      findOne: async ({ where }) => characters.find((c) => c.registry_id === where.registry_id && c.character_key === where.character_key) || null,
      create: async (v) => { const row = { id: `rc-${created.length + 1}`, ...v }; created.push(row); return row; },
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
    expect(db.created[0]).toMatchObject({ registry_id: 'reg-new-a', character_key: 'sable_studio', display_name: 'Studio by Sable' });
    expect(db.profile.registry_character_id).toBe('rc-1');
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
    expect(db.profile.registry_character_id).toBe('rc-existing');
    expect(r.out.registry_character.id).toBe('rc-existing');

    db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-other', registry_id: 'reg-new-a', character_key: 'sable_studio', feed_profile_id: 99 }] });
    r = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(db.profile.registry_character_id).toBeNull();
    expect(r.out.registry_note).toMatch(/linked to another profile/);
    expect(db.profile.status).toBe('crossed');
  });

  test('with no registry at all it still crosses and says why no character was made', async () => {
    const db = fakeDb({ registries: [] });
    const { out } = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(out).toMatchObject({ crossed: true, registry_character: null, registry_note: 'No character registry to add this profile to yet.' });
  });

  test('a profile already linked keeps its character', async () => {
    const db = fakeDb({ registries: REGISTRIES });
    db.profile.registry_character_id = 'rc-kept';
    await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(db.profile.registry_character_id).toBe('rc-kept');
  });
});
