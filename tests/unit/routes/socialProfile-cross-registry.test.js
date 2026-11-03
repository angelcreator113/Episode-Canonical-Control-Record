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
//
// Task #3209: the character and the crossing go together, in one
// transaction. With no character made (no registry, or the key held by
// another profile) nothing is marked: 422 with the reason, the profile as it
// was. A profile whose character was archived is crossed again and gets that
// character back (restored, not replaced: archiving is a soft delete).

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

const updatable = (row) => Object.assign(row, {
  async update(v) { Object.assign(this, v); return this; },
  isSoftDeleted() { return this.deleted_at != null; },
  async restore() { this.deleted_at = null; return this; },
});

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
    // The crossing runs in one transaction; the fake just runs it.
    sequelize: { transaction: async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }) },
    RegistryCharacter: {
      // By the link (feed_profile_id) or by registry and key. Archived rows
      // (deleted_at set) are skipped unless paranoid: false; a where on
      // deleted_at asks for archived ones only.
      findOne: async ({ where, paranoid = true }) => {
        const live = rows.filter((c) => ('deleted_at' in where ? c.deleted_at != null : (!paranoid || c.deleted_at == null)));
        return ('feed_profile_id' in where
          ? live.find((c) => c.feed_profile_id === where.feed_profile_id)
          : live.find((c) => c.registry_id === where.registry_id && c.character_key === where.character_key)) || null;
      },
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
    expect(r.code).toBe(422);
    expect(r.out).toMatchObject({ crossed: false, code: 'NO_CHARACTER_CREATED' });
    expect(r.out.error).toMatch(/linked to another profile/);
    expect(r.out.registry_note).toBe(r.out.error);
    expect(db.profile.status).toBe('finalized'); // not crossed: no character
  });

  test('with no registry at all nothing is crossed, and it says why (422)', async () => {
    const db = fakeDb({ registries: [] });
    const timeline = jest.spyOn(db.WorldTimelineEvent, 'create');
    const { out, code } = await cross(db, { show_id: SHOW_A });
    expect(code).toBe(422);
    expect(db.created).toHaveLength(0);
    expect(out).toMatchObject({ crossed: false, registry_note: 'No character registry to add this profile to yet.' });
    expect(db.profile.status).toBe('finalized');
    expect(db.profile.crossed_at).toBeUndefined();
    expect(timeline).not.toHaveBeenCalled();
  });

  test('a crossed profile whose character was archived is crossed again and gets that character back', async () => {
    const db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-archived', registry_id: 'reg-old-a', character_key: 'sable_studio', feed_profile_id: 7, deleted_at: new Date() }] });
    db.profile.status = 'crossed';
    const { out, code } = await cross(db, { show_id: SHOW_A });
    expect(code).toBeUndefined();
    expect(db.created).toHaveLength(0);
    expect(out).toMatchObject({ crossed: true, restored: true });
    expect(out.registry_character.id).toBe('rc-archived');
    expect(db.characters[0].deleted_at).toBeNull();

    const again = await cross(db, { show_id: SHOW_A });
    expect(again.code).toBe(409); // restored, so crossed with a live character
  });

  test('an archived, unlinked character under the same key is restored and linked, not a duplicate key', async () => {
    const db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-old', registry_id: 'reg-new-a', character_key: 'sable_studio', feed_profile_id: null, deleted_at: new Date() }] });
    const { out, code } = await cross(db, { show_id: SHOW_A });
    expect(code).toBeUndefined();
    expect(db.created).toHaveLength(0);
    expect(out).toMatchObject({ crossed: true, restored: true });
    expect(db.characters[0]).toMatchObject({ feed_profile_id: 7, deleted_at: null });
  });

  test('a profile already linked (a registry entry\'s feed_profile_id) keeps its character', async () => {
    const db = fakeDb({ registries: REGISTRIES, characters: [{ id: 'rc-kept', registry_id: 'reg-old-a', character_key: 'kept', feed_profile_id: 7 }] });
    const { out } = await cross(db, { show_id: SHOW_A });
    expect(db.created).toHaveLength(0);
    expect(out.registry_character.id).toBe('rc-kept');
    expect(db.profile.status).toBe('crossed');
  });

  // A profile crossed before Cross made characters has none (finding 6b):
  // "Create character" on The cast used to answer 409 "Already crossed".
  test('a crossed profile with no character gets one now; one with a character is refused', async () => {
    const db = fakeDb({ registries: REGISTRIES });
    db.profile.status = 'crossed';
    db.profile.creator_name = 'Sable Okafor';
    db.profile.feed_layer = 'lalaverse';
    const timeline = jest.spyOn(db.WorldTimelineEvent, 'create');
    const { out, code } = await cross(db, { show_id: SHOW_A });
    expect(code).toBeUndefined();
    expect(out.registry_character).toMatchObject({
      feed_profile_id: 7, selected_name: 'Sable Okafor', display_name: 'Studio by Sable', world: 'lalaverse', social_presence: true,
    });
    expect(timeline).not.toHaveBeenCalled(); // crossed before: logged then

    const again = await cross(db, { show_id: SHOW_A });
    expect(again.code).toBe(409);
  });
});

