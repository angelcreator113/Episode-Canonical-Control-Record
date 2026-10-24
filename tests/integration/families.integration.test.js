/**
 * Family (Evoni, 2026-10-23: "how can we give family to characters?"; "I
 * want them all"), against the test database: the family_kind backfill, the
 * direction rule (one row, both roles), the family routes (ADMIN writes),
 * Make them a character, Import family, the Pulse family link, and the
 * writers' family lines.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { familyLines } = require('../../src/services/familyTies');
const { storyFamilyBlock } = require('../../src/services/storyGenerationService');
const { loadCharacterFile } = require('../../src/services/characterFile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('family ties and named families', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const c = {};
  const p = {};
  let admin;
  let viewer;
  const as = (token) => (req) => req.set('Authorization', `Bearer ${token}`);
  const auth = (req) => as(admin)(req);

  const profile = async (key) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :name, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, name: `${key} ${tag}` });
    p[key] = row.id;
    return row.id;
  };
  const person = async (key, name, { gender = null, profileId = null, world = null, tree = null, charKey = null } = {}) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, gender, feed_profile_id, world, family_tree, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :name, 'support', :gender, :profileId, :world, CAST(:tree AS jsonb), NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: charKey || `${key}-${tag}`, name, gender, profileId, world, tree: tree ? JSON.stringify(tree) : null });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-family', email: 'evoni@family.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    viewer = TokenService.generateTokenPair({ id: 'test-viewer-family', email: 'viewer@family.dev', name: 'Viewer', groups: [], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Fam ${tag}`, slug: `fam-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Fam', :show, NOW(), NOW())", ids);
    await person('jade', `Jade Monroe ${tag}`, { gender: 'female', profileId: await profile('jade') });
    await person('dre', `Dre Coleman${tag}`, { gender: 'male', profileId: await profile('dre') });
    await person('kim', `Kim Ash ${tag}`);
    await person('jaw', `JustAWoman ${tag}`, { world: 'book-1' });
    await person('nia', `Nia Vale ${tag}`, {
      gender: 'female',
      tree: {
        members: [
          { name: `Kim Ash ${tag}`, relation: 'cousin', personality_sketch: 'loud' },
          { name: `Ruth Vale ${tag}`, relation: 'grandmother', personality_sketch: 'keeps the recipes' },
          { name: `Omar Vale ${tag}`, relation: 'father' },
        ],
        generational_wound: 'nobody leaves',
      },
    });
    await profile('cousinonly'); // a Pulse profile with no character
  });

  afterAll(async () => {
    const all = Object.values(c);
    const made = (await q('SELECT id FROM registry_characters WHERE registry_id = :reg', ids)).map((r) => r.id);
    const everyone = [...new Set([...all, ...made])];
    await run('DELETE FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE registry_character_id IN (:everyone) OR role_of_character_id IN (:everyone))', { everyone });
    await run("DELETE FROM families WHERE id NOT IN (SELECT family_id FROM family_members) AND (show_id = :show OR name LIKE :like)", { show: ids.show, like: `%${tag}%` });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:everyone) OR character_id_b IN (:everyone)', { everyone });
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM registry_characters WHERE id IN (:everyone)', { everyone });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the migration backfills family_kind from is_blood_relation and the role', async () => {
    const legacy = {};
    const old = async (key, a, b, role, blood) => {
      legacy[key] = uuid();
      await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, family_role, is_blood_relation, created_at, updated_at)
                 VALUES (:id, :a, :b, :type, :role, :blood, NOW(), NOW())`, { id: legacy[key], a: c[a], b: c[b], type: `legacy-${key}`, role, blood });
    };
    await old('blood', 'kim', 'jaw', 'aunt', true);
    await old('step', 'jaw', 'kim', 'stepsister', true);
    await old('none', 'kim', 'nia', null, false);
    const migration = require('../../src/migrations/20261024000000-add-family-kind-to-character-relationships');
    await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
    const rows = await q('SELECT id, family_kind FROM character_relationships WHERE id IN (:ids)', { ids: Object.values(legacy) });
    const kind = (id) => rows.find((r) => r.id === id).family_kind;
    expect(kind(legacy.blood)).toBe('blood');
    expect(kind(legacy.step)).toBe('step');
    expect(kind(legacy.none)).toBeNull();
    await run('DELETE FROM character_relationships WHERE id IN (:ids)', { ids: Object.values(legacy) });
  });

  test('every write is ADMIN only; reads are signed-in', async () => {
    const asViewer = as(viewer);
    expect((await asViewer(request(app).post('/api/v1/families').send({ name: 'No' }))).status).toBe(403);
    expect((await asViewer(request(app).post('/api/v1/families/ties').send({ character_id: c.dre, other_character_id: c.jade, role: 'sister' }))).status).toBe(403);
    expect((await asViewer(request(app).post('/api/v1/families/make-character').send({ character_id: c.nia, tree_index: 1 }))).status).toBe(403);
    expect((await asViewer(request(app).post(`/api/v1/families/import/${c.nia}`))).status).toBe(403);
    expect((await asViewer(request(app).get(`/api/v1/families/character/${c.dre}`))).status).toBe(200);
    expect((await request(app).get('/api/v1/families')).status).toBe(401);
  });

  test('+ Add family with a character: one row, both roles, the kind, and the Pulse link', async () => {
    const res = await auth(request(app).post('/api/v1/families/ties')
      .send({ character_id: c.dre, other_character_id: c.jade, role: 'sister', tension: 'healing' }));
    expect(res.status).toBe(201);
    const [row] = await q('SELECT * FROM character_relationships WHERE id = :id', { id: res.body.tie_id });
    expect(row).toMatchObject({ character_id_a: c.jade, character_id_b: c.dre, family_role: 'sister', reverse_family_role: 'brother', family_kind: 'blood', is_blood_relation: true, confirmed: true, is_romantic: false, relationship_type: 'family' });
    expect(res.body.ties).toEqual([expect.objectContaining({ other_id: c.jade, role: 'sister', my_role: 'brother', kind: 'blood', tension: 'healing' })]);

    // The Pulse: their family link, the role in its description.
    expect(res.body.pulse).toEqual(expect.objectContaining({ created: true }));
    const links = await q("SELECT * FROM social_profile_relationships WHERE relationship_type = 'family' AND source_profile_id IN (:p) AND target_profile_id IN (:p)", { p: [p.jade, p.dre] });
    expect(links).toHaveLength(1);
    expect(links[0].description).toBe(`Jade Monroe ${tag} is Dre Coleman${tag}'s sister.`);

    // Saved again from the other side: the same row, read the other way; no second link.
    const again = await auth(request(app).post('/api/v1/families/ties')
      .send({ character_id: c.jade, other_character_id: c.dre, role: 'stepbrother' }));
    expect(again.body.tie_id).toBe(res.body.tie_id);
    const [turned] = await q('SELECT family_role, reverse_family_role, family_kind, is_blood_relation FROM character_relationships WHERE id = :id', { id: res.body.tie_id });
    expect(turned).toEqual({ family_role: 'stepsister', reverse_family_role: 'stepbrother', family_kind: 'step', is_blood_relation: false });
    expect(again.body.pulse).toEqual(expect.objectContaining({ created: false, id: links[0].id }));

    // Back to blood sisters for the rest.
    await auth(request(app).post('/api/v1/families/ties').send({ character_id: c.dre, other_character_id: c.jade, role: 'sister', kind: 'blood' }));
  });

  test('a Pulse profile shows its family', async () => {
    const res = await auth(request(app).get(`/api/v1/families/profile/${p.dre}`));
    expect(res.status).toBe(200);
    expect(res.body.family).toEqual([expect.objectContaining({ name: `Jade Monroe ${tag}`, role: 'sister', kind: 'blood', profile_id: p.jade })]);
    const jade = await auth(request(app).get(`/api/v1/families/profile/${p.jade}`));
    expect(jade.body.family).toEqual([expect.objectContaining({ name: `Dre Coleman${tag}`, role: 'brother' })]);
  });

  test('a partner is romance, not a family tie', async () => {
    const res = await auth(request(app).post('/api/v1/families/ties').send({ character_id: c.dre, other_character_id: c.kim, role: 'wife' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/romance/);
  });

  test('+ Add family with a name or a Pulse profile only: their family is made and they join it', async () => {
    const ghost = await auth(request(app).post('/api/v1/families/ties').send({ character_id: c.dre, ghost_name: `Aunt Bee ${tag}`, role: 'aunt' }));
    expect(ghost.status).toBe(201);
    expect(ghost.body.families).toHaveLength(1);
    const fam = ghost.body.families[0];
    expect(fam.name).toBe(`The Coleman${tag}s`);
    const bee = fam.members.find((m) => m.kind === 'ghost');
    expect(bee).toEqual(expect.objectContaining({ name: `Aunt Bee ${tag}`, role: 'aunt', role_of_character_id: c.dre, generation: -1 }));
    expect(fam.members.find((m) => m.registry_character_id === c.dre).generation).toBe(0);

    const prof = await auth(request(app).post('/api/v1/families/ties').send({ character_id: c.dre, social_profile_id: p.cousinonly, role: 'cousin' }));
    expect(prof.status).toBe(201);
    const cousin = prof.body.families[0].members.find((m) => m.kind === 'profile');
    expect(cousin).toEqual(expect.objectContaining({ social_profile_id: p.cousinonly, role: 'cousin', generation: 0 }));

    // A profile with a character is tied as that character.
    const viaProfile = await auth(request(app).post('/api/v1/families/ties').send({ character_id: c.kim, social_profile_id: p.jade, role: 'cousin' }));
    expect(viaProfile.body.ties.map((t) => t.other_id)).toContain(c.jade);

    // The cousin-only profile's family on The Pulse.
    const pulse = await auth(request(app).get(`/api/v1/families/profile/${p.cousinonly}`));
    expect(pulse.body.family.map((x) => x.name)).toEqual(expect.arrayContaining([`Dre Coleman${tag}`, `Aunt Bee ${tag}`]));
  });

  test('Make them a character: a ghost and a Pulse-only member become characters, tied in one step', async () => {
    const before = await auth(request(app).get(`/api/v1/families/character/${c.dre}`));
    const fam = before.body.families[0];
    const bee = fam.members.find((m) => m.kind === 'ghost');
    const res = await auth(request(app).post('/api/v1/families/make-character').send({ character_id: c.dre, member_id: bee.id }));
    expect(res.status).toBe(201);
    const [made] = await q('SELECT * FROM registry_characters WHERE id = :id', { id: res.body.character.id });
    expect(made).toMatchObject({ registry_id: ids.reg, selected_name: `Aunt Bee ${tag}`, created_from: 'promote_ghost', gender: 'female' });
    expect(res.body.ties).toEqual(expect.arrayContaining([expect.objectContaining({ other_id: made.id, role: 'aunt', my_role: 'nephew', kind: 'blood' })]));
    const member = res.body.families[0].members.find((m) => m.id === bee.id);
    expect(member).toEqual(expect.objectContaining({ kind: 'character', registry_character_id: made.id }));
    // Twice is refused.
    expect((await auth(request(app).post('/api/v1/families/make-character').send({ character_id: c.dre, member_id: bee.id }))).status).toBe(409);

    const cousin = fam.members.find((m) => m.kind === 'profile');
    const fromProfile = await auth(request(app).post('/api/v1/families/make-character').send({ character_id: c.dre, member_id: cousin.id }));
    expect(fromProfile.status).toBe(201);
    const [linked] = await q('SELECT feed_profile_id FROM registry_characters WHERE id = :id', { id: fromProfile.body.character.id });
    expect(linked.feed_profile_id).toBe(p.cousinonly);
    // Both on The Pulse now: their family link was made.
    expect(fromProfile.body.pulse).toEqual(expect.objectContaining({ created: true }));
  });

  test('Make them a character from the old family tree marks the JSON', async () => {
    const res = await auth(request(app).post('/api/v1/families/make-character').send({ character_id: c.nia, tree_index: 2 }));
    expect(res.status).toBe(201);
    const [nia] = await q('SELECT family_tree FROM registry_characters WHERE id = :id', { id: c.nia });
    expect(nia.family_tree.members[2]).toEqual(expect.objectContaining({ promoted: true, promoted_id: res.body.character.id }));
    expect(res.body.ties).toEqual([expect.objectContaining({ other_name: `Omar Vale ${tag}`, role: 'father', my_role: 'daughter' })]);
    expect(res.body.family_tree.members[2].matched_character_id).toBe(res.body.character.id);
  });

  test('Import family, once: ghosts in a named family, ties for the ones who are characters', async () => {
    const res = await auth(request(app).post(`/api/v1/families/import/${c.nia}`));
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(3);
    const fam = res.body.families[0];
    expect(fam.name).toBe(`The ${tag}s`);
    const byName = Object.fromEntries(fam.members.map((m) => [m.name, m]));
    expect(byName[`Ruth Vale ${tag}`]).toEqual(expect.objectContaining({ kind: 'ghost', role: 'grandmother', generation: -2, notes: 'keeps the recipes' }));
    expect(byName[`Kim Ash ${tag}`]).toEqual(expect.objectContaining({ kind: 'character', registry_character_id: c.kim, generation: 0 }));
    expect(byName[`Omar Vale ${tag}`]).toEqual(expect.objectContaining({ kind: 'character', generation: -1 }));
    expect(res.body.ties.map((t) => t.other_id)).toEqual(expect.arrayContaining([c.kim]));
    expect(res.body.family_tree.imported_family_id).toBe(fam.id);
    expect((await auth(request(app).post(`/api/v1/families/import/${c.nia}`))).status).toBe(409);
  });

  test('named families: make, rename, add and take out members, delete', async () => {
    const made = await auth(request(app).post('/api/v1/families').send({ name: `The Monroes ${tag}`, home_city: 'Velour City', show_id: ids.show }));
    expect(made.status).toBe(201);
    const fid = made.body.family.id;
    const renamed = await auth(request(app).put(`/api/v1/families/${fid}`).send({ notes: 'old money' }));
    expect(renamed.body.family).toEqual(expect.objectContaining({ name: `The Monroes ${tag}`, home_city: 'Velour City', notes: 'old money' }));
    const added = await auth(request(app).post(`/api/v1/families/${fid}/members`).send({ registry_character_id: c.jade, generation: 1 }));
    expect(added.status).toBe(201);
    const mom = await auth(request(app).post(`/api/v1/families/${fid}/members`).send({ ghost_name: 'Mama Monroe', role: 'mother', role_of_character_id: c.jade }));
    expect(mom.body.family.members.find((m) => m.name === 'Mama Monroe').generation).toBe(0);
    expect((await auth(request(app).post(`/api/v1/families/${fid}/members`).send({ role: 'nobody' }))).status).toBe(400);
    const changed = await auth(request(app).put(`/api/v1/families/${fid}/members/${added.body.member_id}`).send({ role: 'eldest daughter' }));
    expect(changed.body.family.members.find((m) => m.id === added.body.member_id).role).toBe('eldest daughter');
    const out = await auth(request(app).delete(`/api/v1/families/${fid}/members/${added.body.member_id}`));
    expect(out.body.family.members.map((m) => m.id)).not.toContain(added.body.member_id);
    const list = await auth(request(app).get('/api/v1/families'));
    expect(list.body.families.map((f) => f.id)).toContain(fid);
    expect((await auth(request(app).delete(`/api/v1/families/${fid}`))).status).toBe(200);
    const after = await auth(request(app).get('/api/v1/families'));
    expect(after.body.families.map((f) => f.id)).not.toContain(fid);
  });

  test('the Family tab\'s edit writes the reverse role and keeps is_blood_relation in step', async () => {
    const [tie] = await q("SELECT id FROM character_relationships WHERE character_id_a = :a AND character_id_b = :b AND relationship_type = 'family'", { a: c.jade, b: c.dre });
    const res = await auth(request(app).put(`/api/v1/relationships/${tie.id}/family`).send({ family_role: 'half-sister', family_kind: 'blood' }));
    expect(res.status).toBe(200);
    expect(res.body.relationship).toEqual(expect.objectContaining({ family_role: 'half-sister', reverse_family_role: 'half-brother', family_kind: 'blood', is_blood_relation: true }));
    const chosen = await auth(request(app).put(`/api/v1/relationships/${tie.id}/family`).send({ family_kind: 'chosen' }));
    expect(chosen.body.relationship).toEqual(expect.objectContaining({ family_kind: 'chosen', is_blood_relation: false }));
    expect((await auth(request(app).put(`/api/v1/relationships/${tie.id}/family`).send({ family_kind: 'cousinish' }))).status).toBe(400);
    await auth(request(app).put(`/api/v1/relationships/${tie.id}/family`).send({ family_role: 'sister', family_kind: 'blood' }));
  });

  test('the writers read family: lines, JustAWoman\'s family kept out of Lala\'s world, the character file', async () => {
    await auth(request(app).post('/api/v1/families/ties').send({ character_id: c.dre, other_character_id: c.jaw, role: 'cousin' }));
    const lines = await familyLines(sequelize, [c.dre]);
    expect(lines).toEqual(expect.arrayContaining([
      `Dre Coleman${tag}: Jade Monroe ${tag}'s brother (blood; healing)`,
      `Dre Coleman${tag}: JustAWoman ${tag}'s cousin (blood)`,
    ]));
    const story = await storyFamilyBlock(sequelize, [c.dre]);
    expect(story).toContain(`Jade Monroe ${tag}'s brother`);
    expect(story).not.toContain('JustAWoman');

    const file = await loadCharacterFile(models, { character: { id: c.dre }, feedProfile: null });
    expect(file.relationships).toEqual(expect.arrayContaining([expect.objectContaining({ person: `Jade Monroe ${tag}`, kind: 'sister' })]));
  });

  test('taking the family off a tie', async () => {
    const [tie] = await q("SELECT id FROM character_relationships WHERE character_id_b = :b AND character_id_a = :a AND relationship_type = 'family' AND deleted_at IS NULL", { a: c.jaw, b: c.dre });
    const res = await auth(request(app).delete(`/api/v1/families/ties/${tie.id}`));
    expect(res.status).toBe(200);
    const after = await auth(request(app).get(`/api/v1/families/character/${c.dre}`));
    expect(after.body.ties.map((t) => t.other_id)).not.toContain(c.jaw);
  });
});
