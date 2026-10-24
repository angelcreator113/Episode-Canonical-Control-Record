/**
 * Heritage in the family trees (Evoni, 2026-10-24: "how can we be sure race
 * makes sense in the family trees?"; "I want them all"), against the test
 * database: heritage tags read and written (ADMIN), the exact-match-only
 * backfill, the gentle check (blood ties only; mixed heritage is fine; step,
 * adoptive and chosen family never; missing tags go to the gap list; "This is
 * intended" stays until someone's tags change), Propose Family's prompt, Make
 * them a character's suggestion, and the appearance suggestion's family block.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261024210000-add-heritage-tags-to-registry-characters');
const { appearanceFamilyBlock } = require('../../src/services/familyHeritage');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('heritage in the family trees', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), family: uuid() };
  const c = {};
  const p = {};
  const rel = {};
  let admin;
  let viewer;
  const as = (token) => (req) => req.set('Authorization', `Bearer ${token}`);
  const auth = (req) => as(admin)(req);
  const api = '/api/v1/families';

  const profile = async (key) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
    p[key] = row.id;
    return row.id;
  };
  const person = async (key, name, { tags = null, ethnicity = null, gender = null, cast = false, look = null } = {}) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, gender, ethnicity, heritage_tags,
                 feed_profile_id, appearance, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :name, 'support', :gender, :ethnicity, CAST(:tags AS jsonb), :profile, CAST(:look AS jsonb), NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name, gender, ethnicity, tags: tags ? JSON.stringify(tags) : null,
      profile: cast ? await profile(key) : null, look: look ? JSON.stringify(look) : null });
  };
  // "a is b's role", confirmed.
  const tie = async (key, a, b, role, kind = 'blood') => {
    rel[key] = uuid();
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role,
                 family_kind, is_blood_relation, connection_mode, lala_connection, status, created_at, updated_at)
               VALUES (:id, :a, :b, 'family', true, false, :role, :kind, :blood, 'IRL', 'none', 'Active', NOW(), NOW())`,
    { id: rel[key], a: c[a], b: c[b], role, kind, blood: kind === 'blood' });
  };
  const report = async (query) => (await auth(request(app).get(`${api}/heritage`).query(query))).body;
  const keysOf = (r) => r.flags.map((f) => f.key).sort();

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-heritage', email: 'evoni@heritage.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    viewer = TokenService.generateTokenPair({ id: 'test-viewer-heritage', email: 'viewer@heritage.dev', name: 'Viewer', groups: [], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Her ${tag}`, slug: `her-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Her', :show, NOW(), NOW())", ids);

    await person('gran', `Gran Coleman ${tag}`, { tags: ['Black'], gender: 'female' });
    await person('ruth', `Ruth Coleman ${tag}`, { tags: ['Black'], ethnicity: 'Black', gender: 'female', cast: true, look: { summary: 'tall, silver locs', hair: 'silver locs' } });
    await person('omar', `Omar Coleman ${tag}`, { tags: ['Black'], gender: 'male', cast: true });
    await person('dre', `Dre Coleman ${tag}`, { tags: ['Korean'], gender: 'male', cast: true });
    await person('mina', `Mina Park ${tag}`, { tags: ['Korean'], gender: 'female' });
    await person('kai', `Kai Park ${tag}`, { tags: ['Black', 'Korean'], gender: 'male' });
    await person('jade', `Jade Park ${tag}`, { tags: ['Irish'], gender: 'female' });
    await person('ana', `Ana Coleman ${tag}`, { tags: ['Filipino'], gender: 'female' });
    await person('sam', `Sam Ruiz ${tag}`, { tags: ['Mexican'], gender: 'male' });
    await person('lee', `Lee Ash ${tag}`, { tags: ['White'], gender: 'male' });
    await person('nia', `Nia Coleman ${tag}`, { gender: 'female', ethnicity: 'Mixed-race' });
    await person('bea', `Bea Coleman ${tag}`, { gender: 'female' });

    await tie('ruthDre', 'ruth', 'dre', 'mother');
    await tie('omarDre', 'omar', 'dre', 'father');
    await tie('omarKai', 'omar', 'kai', 'father');
    await tie('minaKai', 'mina', 'kai', 'mother');
    await tie('jadeKai', 'jade', 'kai', 'sister');
    await tie('anaRuth', 'ana', 'ruth', 'adopted daughter', 'adoptive');
    await tie('samDre', 'sam', 'dre', 'stepfather', 'step');
    await tie('leeDre', 'lee', 'dre', 'chosen family', 'chosen');
    await tie('niaRuth', 'nia', 'ruth', 'daughter');
    await tie('granDre', 'gran', 'dre', 'grandmother');

    await run('INSERT INTO families (id, show_id, name, created_at, updated_at) VALUES (:family, :show, :name, NOW(), NOW())', { ...ids, name: `The Colemans ${tag}` });
    for (const k of ['ruth', 'omar', 'dre', 'nia', 'ana', 'bea']) {
      await run(`INSERT INTO family_members (id, family_id, registry_character_id, generation, created_at, updated_at)
                 VALUES (gen_random_uuid(), :f, :c, 0, NOW(), NOW())`, { f: ids.family, c: c[k] });
    }
    await run(`INSERT INTO family_members (id, family_id, ghost_name, role, role_of_character_id, created_at, updated_at)
               VALUES (gen_random_uuid(), :f, :name, 'son', :of, NOW(), NOW())`, { f: ids.family, name: `Eli Coleman ${tag}`, of: c.ruth });
  });

  afterAll(async () => {
    const made = (await q('SELECT id FROM registry_characters WHERE registry_id = :reg', ids)).map((r) => r.id);
    const everyone = [...new Set([...Object.values(c), ...made])];
    await run('DELETE FROM family_members WHERE family_id = :family', ids);
    await run('DELETE FROM families WHERE id = :family', ids);
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:everyone) OR character_id_b IN (:everyone)', { everyone });
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM registry_characters WHERE id IN (:everyone)', { everyone });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('heritage tags: read on the family readouts, written by ADMIN only, cleaned on the way in', async () => {
    expect((await as(viewer)(request(app).put(`${api}/heritage/${c.bea}`)).send({ heritage_tags: ['Black'] })).status).toBe(403);
    const res = await auth(request(app).put(`${api}/heritage/${c.bea}`)).send({ heritage_tags: [' black', 'Gullah Geechee', 'BLACK'], ethnicity: 'Black, Gullah' });
    expect(res.status).toBe(200);
    expect(res.body.person).toMatchObject({ heritage_tags: ['Black', 'Gullah Geechee'], ethnicity: 'Black, Gullah' });

    // The character page's family reads them on each tie and family member.
    const fam = await auth(request(app).get(`${api}/character/${c.dre}`));
    expect(fam.body.ties.find((t) => t.other_id === c.ruth)).toMatchObject({ other_heritage_tags: ['Black'], other_ethnicity: 'Black' });
    const members = fam.body.families[0].members;
    expect(members.find((m) => m.registry_character_id === c.bea).heritage_tags).toEqual(['Black', 'Gullah Geechee']);
    expect(members.find((m) => m.kind === 'ghost').heritage_tags).toBeNull();

    // The registry's own character PUT (ADMIN) takes them too.
    const put = await auth(request(app).put(`/api/v1/character-registry/characters/${c.bea}`)).send({ heritage_tags: [] });
    expect(put.status).toBe(200);
    const [row] = await q('SELECT heritage_tags, ethnicity FROM registry_characters WHERE id = :id', { id: c.bea });
    expect(row).toEqual({ heritage_tags: null, ethnicity: 'Black, Gullah' });
    expect((await as(viewer)(request(app).put(`/api/v1/character-registry/characters/${c.bea}`)).send({ heritage_tags: ['x'] })).status).toBe(403);
  });

  test('the backfill tags exact matches only and leaves the rest for Evoni', async () => {
    const k = {};
    for (const [key, ethnicity] of [['b1', 'Black'], ['b2', 'korean'], ['b3', 'Mixed-race'], ['b4', 'Black and Korean'], ['b5', 'Korean-ish']]) {
      await person(key, `Back ${key} ${tag}`, { ethnicity });
      k[key] = c[key];
    }
    await sequelize.transaction((transaction) => migration.backfill(sequelize, transaction));
    const rows = await q('SELECT id, heritage_tags FROM registry_characters WHERE id IN (:ids)', { ids: Object.values(k) });
    const tagsOf = (key) => rows.find((r) => r.id === k[key]).heritage_tags;
    expect(tagsOf('b1')).toEqual(['Black']);
    expect(tagsOf('b2')).toEqual(['Korean']);
    expect(tagsOf('b3')).toBeNull();
    expect(tagsOf('b4')).toEqual(['Black', 'Korean']);
    expect(tagsOf('b5')).toBeNull();
    // Someone with tags already is never touched.
    const [ruth] = await q('SELECT heritage_tags FROM registry_characters WHERE id = :id', { id: c.ruth });
    expect(ruth.heritage_tags).toEqual(['Black']);
  });

  test('the gentle check: blood only, mixed is fine, step/adoptive/chosen never, missing tags are gaps', async () => {
    const r = await report({ family_id: ids.family });
    // Dre shares nothing with either blood parent; Jade and Kai are full
    // siblings sharing nothing; Gran and Dre have a parent between them
    // (Ruth is not Gran's child yet, so: no parent between) — flagged too.
    expect(keysOf(r)).toEqual([`grand-${rel.granDre}`, `parents-${c.dre}`, `siblings-${rel.jadeKai}`].sort());
    const dre = r.flags.find((f) => f.key === `parents-${c.dre}`);
    expect(dre.sentence).toBe(`Dre Coleman ${tag} is Ruth Coleman ${tag} and Omar Coleman ${tag}'s son by blood, but their heritage shares nothing: Ruth — Black; Omar — Black; Dre — Korean.`);
    // Kai (Black, Korean) shares with both parents: mixed heritage, not a flag.
    expect(r.flags.some((f) => f.people.includes(c.kai) && f.type === 'parents')).toBe(false);
    // Adopted Ana, stepfather Sam and chosen-family Lee are never flagged.
    const flagged = r.flags.flatMap((f) => f.people);
    for (const k of ['ana', 'sam', 'lee']) expect(flagged).not.toContain(c[k]);
    // Nia (no tags, "Mixed-race" in her words) is a gap, not a flag; so is Bea.
    expect(r.gaps.map((g) => g.id)).toEqual(expect.arrayContaining([c.nia, c.bea]));
    expect(r.gaps.find((g) => g.id === c.nia).ethnicity).toBe('Mixed-race');
    expect(flagged).not.toContain(c.nia);
    expect(r.starter_tags).toContain('Korean');

    // With the parent between them known, the grandparent line is the parent check's.
    await tie('granRuth', 'gran', 'ruth', 'mother');
    expect(keysOf(await report({ family_id: ids.family }))).not.toContain(`grand-${rel.granDre}`);

    // A character's own report: the flags that name them, gaps among their family.
    const mine = await report({ character_id: c.dre });
    expect(keysOf(mine)).toEqual([`parents-${c.dre}`]);
    expect(mine.gaps.map((g) => g.id)).toEqual(expect.arrayContaining([c.nia]));
  });

  test('"This is intended" keeps a flag quiet until either person\'s tags change', async () => {
    const key = `siblings-${rel.jadeKai}`;
    expect((await as(viewer)(request(app).post(`${api}/heritage/intended/${key}`))).status).toBe(403);
    const marked = await auth(request(app).post(`${api}/heritage/intended/${key}`));
    expect(marked.status).toBe(200);
    let r = await report({});
    expect(keysOf(r)).not.toContain(key);
    expect(r.intended.map((f) => f.key)).toContain(key);
    const [row] = await q('SELECT heritage_ok FROM character_relationships WHERE id = :id', { id: rel.jadeKai });
    expect(row.heritage_ok).toMatchObject({ by: 'evoni@heritage.dev', a_tags: ['irish'], b_tags: ['black', 'korean'] });

    // Jade's tags change (still sharing nothing): the note comes back.
    await auth(request(app).put(`${api}/heritage/${c.jade}`)).send({ heritage_tags: ['Irish', 'Italian'] });
    r = await report({});
    expect(keysOf(r)).toContain(key);

    // Undo works too.
    await auth(request(app).post(`${api}/heritage/intended/${key}`));
    expect(keysOf(await report({}))).not.toContain(key);
    expect((await auth(request(app).delete(`${api}/heritage/intended/${key}`))).status).toBe(200);
    expect(keysOf(await report({}))).toContain(key);
    // A key that is not a flag now is a 404, so a stale page cannot mark the wrong tie.
    expect((await auth(request(app).post(`${api}/heritage/intended/siblings-${rel.ruthDre}`))).status).toBe(404);
  });

  test('Make them a character suggests the union of the blood parents\' tags, and saves only what is sent', async () => {
    // A new son of Omar: Omar, and the one other parent of his blood children? He has two (Ruth, Mina): none is picked.
    let s = (await auth(request(app).get(`${api}/make-character/suggestion`).query({ character_id: c.omar, role: 'son' }))).body.suggestion;
    expect(s.heritage_tags).toEqual(['Black']);
    // A new daughter of Mina: Mina and Omar (Kai's other parent): mixed, the union.
    s = (await auth(request(app).get(`${api}/make-character/suggestion`).query({ character_id: c.mina, role: 'daughter' }))).body.suggestion;
    expect(s.heritage_tags.sort()).toEqual(['Black', 'Korean']);
    expect(s.from.map((f) => f.id).sort()).toEqual([c.mina, c.omar].sort());
    // A new full sister of Kai: his blood parents, Omar and Mina.
    s = (await auth(request(app).get(`${api}/make-character/suggestion`).query({ character_id: c.kai, role: 'sister' }))).body.suggestion;
    expect(s.heritage_tags.sort()).toEqual(['Black', 'Korean']);
    // Step, adoptive and chosen family: no suggestion (they can differ).
    for (const role of ['stepdaughter', 'adopted son', 'chosen family', 'mother']) {
      s = (await auth(request(app).get(`${api}/make-character/suggestion`).query({ character_id: c.mina, role }))).body.suggestion;
      expect(s).toBeNull();
    }

    const [ghost] = await q("SELECT id FROM family_members WHERE family_id = :family AND ghost_name IS NOT NULL", ids);
    const made = await auth(request(app).post(`${api}/make-character`)).send({ character_id: c.ruth, member_id: ghost.id, heritage_tags: ['black', 'Korean'], ethnicity: 'Black and Korean' });
    expect(made.status).toBe(201);
    const [row] = await q('SELECT heritage_tags, ethnicity FROM registry_characters WHERE id = :id', { id: made.body.character.id });
    expect(row).toEqual({ heritage_tags: ['Black', 'Korean'], ethnicity: 'Black and Korean' });
    // Without heritage sent, nothing is filled in silently.
    const plain = await auth(request(app).post(`${api}/make-character`)).send({ character_id: c.ruth, name: `Zed ${tag}`, role: 'son' });
    const [z] = await q('SELECT heritage_tags, ethnicity FROM registry_characters WHERE id = :id', { id: plain.body.character.id });
    expect(z).toEqual({ heritage_tags: null, ethnicity: null });
  });

  test('Propose Family hands the AI each person\'s heritage and the rule; a suggestion only lands in the seed notes', async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply({ family_bonds: [] }));
    // Clear Omar's tags so there is someone "not set" to suggest for.
    await auth(request(app).put(`${api}/heritage/${c.omar}`)).send({ heritage_tags: [] });
    // Ruth→Omar has no tie yet: the AI proposes one and suggests Omar's heritage.
    mockCreate.mockResolvedValueOnce(reply({ family_bonds: [{
      character_a_id: c.ruth, character_b_id: c.omar, family_role: 'sister', is_blood_relation: true, is_romantic: false,
      relationship_type: `siblings ${tag}`, notes: 'they raised Dre together',
      suggested_heritage: { [c.omar]: ['Black'], [c.ruth]: ['Korean'] },
    }] }));
    const res = await auth(request(app).post('/api/v1/relationships/generate-family')).send({});
    expect(res.status).toBe(201);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`Ruth Coleman ${tag} [id=${c.ruth}]: Black (in their words: "Black")`);
    expect(prompt).toContain(`Omar Coleman ${tag} [id=${c.omar}]: heritage not set`);
    expect(prompt).toContain('Blood relatives share heritage with their blood parents (mixed when the parents differ); step, adoptive, married-in and chosen family can differ.');
    expect(prompt).toContain('suggested_heritage');

    // Propose Family is Generate aimed at family (services/relationshipSeeds): the seed is filed under its role.
    const [seed] = await q(`SELECT notes, confirmed, seed_source FROM character_relationships
      WHERE character_id_a = :a AND character_id_b = :b AND deleted_at IS NULL`, { a: c.ruth, b: c.omar });
    expect(seed.seed_source).toBe('family');
    expect(seed.confirmed).toBe(false);
    // Only Omar (not set) gets a suggestion; Ruth's own tags are never second-guessed.
    expect(seed.notes).toBe(`they raised Dre together Suggested heritage (not saved to anyone): Omar Coleman ${tag}: Black.`);
    const [omar] = await q('SELECT heritage_tags FROM registry_characters WHERE id = :id', { id: c.omar });
    expect(omar.heritage_tags).toBeNull();
  });

  test('the appearance suggestion reads the blood family\'s heritage and look, not step or chosen family', async () => {
    const block = await appearanceFamilyBlock(sequelize, c.dre);
    expect(block).toContain('Their heritage, as they describe it: Korean.');
    expect(block).toContain(`Ruth Coleman ${tag}, their mother by blood. Heritage: Black. Their saved look: summary: tall, silver locs; hair: silver locs.`);
    expect(block).not.toContain('Sam Ruiz');
    expect(block).not.toContain('Lee Ash');
    expect(block).toContain('no stereotypes');
  });
});
