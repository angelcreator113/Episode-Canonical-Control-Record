/**
 * The Relationships page's data fixes (Evoni, 2026-10-24: "I want them all"),
 * against the test database:
 *   - an Inspector Save (PUT /:id) leaves the family role to the Family tab,
 *     and family does not become a romance there either;
 *   - Add with a family type (Mother, Sister …) saves a family tie both ways,
 *     on the Family tab, the character page's family, the writers' lines and
 *     The Pulse;
 *   - the writers' who-knows lines leave confidential characters out;
 *   - GET /:id and GET /person/:id, for links to someone outside the cast;
 *   - Delete keeps the Pulse pair, the drift report lists it, Undo puts the
 *     story pair back to it, and the fix takes it off The Pulse;
 *   - Lala's tie words and the character page read family from the right side;
 *   - the character file names people by their chosen name;
 *   - Propose Family says why the AI failed.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { familyLines } = require('../../src/services/familyTies');
const { relationshipSecrecyLines } = require('../../src/services/relationshipKnowers');
const { lalaStoryTies, driftReport } = require('../../src/services/relationshipTruth');
const { loadCharacterFile } = require('../../src/services/characterFile');
const { personPage } = require('../../src/services/personPage');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const one = async (sql, replacements = {}) => (await q(sql, replacements))[0];
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('the Relationships page data fixes (2026-10-24)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { reg: uuid() };
  const c = {};
  const p = {};
  const rel = {};
  let admin;
  const auth = (req) => req.set('Authorization', `Bearer ${admin}`);
  const api = '/api/v1/relationships';

  const profile = async (key) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
    p[key] = row.id;
    return row.id;
  };
  const person = async (key, { name, selected = null, gender = null, withProfile = false, extra = null, charKey = null }) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, gender, role_type, feed_profile_id,
                 extra_fields, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :selected, :gender, 'support', :profile, CAST(:extra AS jsonb), NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: charKey || `${key}-${tag}`, name, selected, gender, profile: withProfile ? await profile(key) : null, extra: JSON.stringify(extra || {}) });
  };
  const relate = async (key, a, b, f = {}) => {
    rel[key] = uuid();
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, family_role,
                 reverse_family_role, family_kind, known_by, public_state, deleted_at, created_at, updated_at)
               VALUES (:id, :a, :b, :type, :confirmed, :romantic, :family, :reverse, :kind, CAST(:known AS jsonb), :state,
                 CASE WHEN :deleted THEN NOW() ELSE NULL END, NOW(), NOW())`,
    { id: rel[key], a: c[a], b: c[b], type: f.type || 'friend', confirmed: f.confirmed !== false, romantic: !!f.romantic,
      family: f.family || null, reverse: f.reverse || null, kind: f.kind || null, known: JSON.stringify(f.known || []),
      state: f.state || 'known', deleted: !!f.deleted });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-relfix', email: 'evoni@relfix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Relfix', NOW(), NOW())", ids);
    await person('jade', { name: `Jade ${tag}`, gender: 'female', withProfile: true });
    await person('dre', { name: `dre_handle_${tag}`, selected: `Dre Coleman ${tag}`, gender: 'male', withProfile: true });
    await person('nia', { name: `Nia ${tag}`, gender: 'female' });
    await person('kai', { name: `Kai ${tag}` });
    // A confidential professional, by classification (utils/confidentialCharacters).
    await person('amara', { name: `Dr. Amara ${tag}`, extra: { classification: 'confidential_professional' } });

    await relate('aunt', 'jade', 'nia', { type: 'family', family: 'aunt', reverse: 'niece', kind: 'blood' });
    await relate('spouse', 'nia', 'kai', { type: 'married', family: 'wife', reverse: 'husband', kind: 'married' });
    await relate('seed', 'nia', 'kai', { type: 'rival', confirmed: false });
    await relate('gone', 'jade', 'kai', { type: 'mentor', deleted: true });
    await relate('secret', 'jade', 'kai', { type: 'confidant', state: 'secret', known: [{ registry_character_id: c.amara }, { name: 'Mo' }] });
    await relate('therapy', 'amara', 'nia', { type: 'therapist', state: 'secret' });
  });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all))', { all });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM family_members WHERE registry_character_id IN (:all)', { all });
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
  });

  beforeEach(() => mockCreate.mockReset());

  test('1. PUT /:id leaves the family role (and its reverse) as the Family tab set it; family cannot be made romantic', async () => {
    // The Family tab changed it; the Inspector then saves its whole form with the old role.
    const fam = await auth(request(app).put(`${api}/${rel.aunt}/family`)).send({ family_role: 'great-aunt' });
    expect(fam.status).toBe(200);
    const save = await auth(request(app).put(`${api}/${rel.aunt}`)).send({ family_role: 'mother', tension_state: 'simmering', is_romantic: false });
    expect(save.status).toBe(200);
    expect(save.body.relationship).toMatchObject({ family_role: 'great-aunt', reverse_family_role: 'great-niece', tension_state: 'simmering' });

    const romance = await auth(request(app).put(`${api}/${rel.aunt}`)).send({ is_romantic: true, situation: 'x' });
    expect(romance.status).toBe(409);
    expect(romance.body.error).toBe('They are family (great-aunt), so this cannot be a romance. Change the family role on the Family tab first.');
    expect(await one('SELECT is_romantic, situation FROM character_relationships WHERE id = :id', { id: rel.aunt })).toEqual({ is_romantic: false, situation: null });

    // A spouse role is the one family role a romance carries.
    const wife = await auth(request(app).put(`${api}/${rel.spouse}`)).send({ is_romantic: true });
    expect(wife.status).toBe(200);
    expect(wife.body.relationship).toMatchObject({ is_romantic: true, family_role: 'wife' });
  });

  test('2. Add with "mother" saves the family tie both ways, on the Family tab, the family readout, the writers and The Pulse', async () => {
    const res = await auth(request(app).post(api)).send({
      character_id_a: c.jade, character_id_b: c.dre, relationship_type: 'mother', is_romantic: false,
      connection_mode: 'IRL', status: 'Active', tension_state: 'healing', situation: 'She raised him alone',
    });
    expect(res.status).toBe(201);
    expect(res.body.family).toBe(true);
    expect(res.body.relationship).toMatchObject({
      character_id_a: c.jade, character_id_b: c.dre, relationship_type: 'family', confirmed: true, is_romantic: false,
      family_role: 'mother', reverse_family_role: 'son', family_kind: 'blood', is_blood_relation: true,
      tension_state: 'healing', situation: 'She raised him alone',
    });
    const id = res.body.relationship.id;

    // The character page's family (GET /families/character/:id), from his side.
    const fam = await auth(request(app).get(`/api/v1/families/character/${c.dre}`));
    expect(fam.status).toBe(200);
    expect(fam.body.ties).toEqual([expect.objectContaining({ id, other_id: c.jade, role: 'mother', my_role: 'son', kind: 'blood' })]);
    // The writers' family lines, both ways, by the chosen name.
    expect(await familyLines(sequelize, [c.dre])).toEqual([`Dre Coleman ${tag}: Jade ${tag}'s son (blood; healing)`]);
    expect(await familyLines(sequelize, [c.jade])).toContain(`Jade ${tag}: Dre Coleman ${tag}'s mother (blood; healing)`);
    // The Pulse family link, linked to the tie.
    const pulse = await one(`SELECT relationship_type::text AS type, character_relationship_id AS story, description FROM social_profile_relationships
                              WHERE source_profile_id = :a AND target_profile_id = :b`, { a: p.jade, b: p.dre });
    expect(pulse).toEqual({ type: 'family', story: id, description: `Jade ${tag} is Dre Coleman ${tag}'s mother.` });

    // A family type cannot be romantic, as on the Family tab.
    const bad = await auth(request(app).post(api)).send({ character_id_a: c.nia, character_id_b: c.kai, relationship_type: 'sister', is_romantic: true });
    expect(bad.status).toBe(409);
    // A type that is not a family role is a plain relationship, as before.
    const plain = await auth(request(app).post(api)).send({ character_id_a: c.nia, character_id_b: c.kai, relationship_type: 'collaborator' });
    expect(plain.status).toBe(201);
    expect(plain.body.relationship).toMatchObject({ relationship_type: 'collaborator', family_role: null });
    expect(plain.body.family).toBeUndefined();
  });

  test("3. the writers' who-knows lines leave a confidential character out, as one of the two or as a knower", async () => {
    const lines = await relationshipSecrecyLines(sequelize, [c.jade, c.kai, c.nia]);
    const joined = lines.join('\n');
    expect(joined).toContain(`Jade ${tag} and Kai ${tag}'s relationship (confidant) is SECRET: only Mo knows.`);
    expect(joined).not.toContain('Amara');
    // Asked about her directly, still nothing (familyLines does the same).
    expect((await relationshipSecrecyLines(sequelize, [c.amara])).join('\n')).not.toContain('Amara');
  });

  test('4. GET /:id and GET /person/:id, for a link to someone outside the cast', async () => {
    const got = await auth(request(app).get(`${api}/${rel.aunt}`));
    expect(got.status).toBe(200);
    expect(got.body.relationship).toMatchObject({ id: rel.aunt, character_a_name: `Jade ${tag}` });
    expect(got.body.characters.map((x) => x.id).sort()).toEqual([c.jade, c.nia].sort());

    const missing = "That relationship was deleted or isn't confirmed";
    expect((await auth(request(app).get(`${api}/${rel.gone}`))).body).toEqual({ error: missing });
    expect((await auth(request(app).get(`${api}/${rel.seed}`))).status).toBe(404);
    expect((await auth(request(app).get(`${api}/${rel.seed}`).query({ seeds: 'true' }))).status).toBe(200);
    expect((await auth(request(app).get(`${api}/${uuid()}`))).status).toBe(404);
    expect((await auth(request(app).get(`${api}/not-an-id`))).status).toBe(404);
    expect((await request(app).get(`${api}/${rel.aunt}`)).status).toBe(401);
    // The routes before it still answer.
    expect((await auth(request(app).get(`${api}/drift`))).status).toBe(200);
    // (/pending is gone: nothing called it, 2026-10-24 polish.)
    expect((await auth(request(app).get(`${api}/cast`))).status).toBe(200);

    const who = await auth(request(app).get(`${api}/person/${c.nia}`));
    expect(who.status).toBe(200);
    expect(who.body.character).toMatchObject({ id: c.nia });
    const relIds = who.body.relationships.map((r) => r.id);
    expect(relIds).toEqual(expect.arrayContaining([rel.aunt, rel.spouse]));
    expect(relIds).not.toContain(rel.seed);
    expect(who.body.characters.map((x) => x.id)).toEqual(expect.arrayContaining([c.nia, c.jade, c.kai]));
    expect((await auth(request(app).get(`${api}/person/${uuid()}`))).status).toBe(404);
  });

  test('6. Delete keeps the Pulse pair and its link; the drift report lists it; Undo clears it; the fix takes it off The Pulse', async () => {
    const story = await one(`SELECT id FROM character_relationships WHERE character_id_a = :a AND character_id_b = :b AND relationship_type = 'family'`, { a: c.jade, b: c.dre });
    const pulse = await one('SELECT id FROM social_profile_relationships WHERE character_relationship_id = :id', { id: story.id });
    const key = `pulse_story_deleted:${pulse.id}`;
    const mine = (items) => items.filter((i) => i.key === key);

    const del = await auth(request(app).delete(`${api}/${story.id}`));
    expect(del.status).toBe(200);
    expect(del.body.pulse_kept).toEqual([pulse.id]);
    expect(await one('SELECT character_relationship_id AS story FROM social_profile_relationships WHERE id = :id', { id: pulse.id })).toEqual({ story: story.id });
    const [item] = mine(await driftReport(sequelize));
    expect(item).toMatchObject({
      kind: 'pulse_story_deleted',
      says: [{ store: 'Story (Relationships)', value: 'deleted (was mother)' }, { store: 'The Pulse', value: 'family' }],
      fix: { label: `Take @jade${tag} and @dre${tag}'s family off The Pulse`, pulse_id: pulse.id, story_id: story.id },
    });

    const undo = await auth(request(app).post(`${api}/${story.id}/restore`));
    expect(undo.status).toBe(200);
    expect(undo.body.pulse).toEqual({ pulse_relationship_id: pulse.id, made: false });
    expect(mine(await driftReport(sequelize))).toEqual([]);

    await auth(request(app).delete(`${api}/${story.id}`));
    const fix = await auth(request(app).post(`${api}/drift/${encodeURIComponent(key)}/fix`));
    expect(fix.status).toBe(200);
    expect(await one('SELECT id FROM social_profile_relationships WHERE id = :id', { id: pulse.id })).toBeUndefined();
    expect(mine(await driftReport(sequelize))).toEqual([]);
    // Undo after that: the story pair is back, and so is a Pulse family pair for it.
    const back = await auth(request(app).post(`${api}/${story.id}/restore`));
    expect(back.body.pulse).toMatchObject({ made: true });
  });

  test("8. Lala's tie words and the character page read family from the other person's side, both ways", async () => {
    await person('lala', { name: 'Lala', charKey: 'lala', gender: 'female', withProfile: true });
    await person('mom', { name: `Mom ${tag}`, gender: 'female' });
    await person('auntie', { name: `Auntie ${tag}`, gender: 'female' });
    // "Lala is Mom's daughter" (Lala on the A side) and "Auntie is Lala's aunt" (Lala on the B side).
    await relate('lalaMom', 'lala', 'mom', { type: 'family', family: 'daughter', reverse: 'mother', kind: 'blood' });
    await relate('auntLala', 'auntie', 'lala', { type: 'family', family: 'aunt', kind: 'blood' });
    // Another live Lala would be picked; the newest live one is ours.
    await run('UPDATE registry_characters SET updated_at = NOW() + interval \'1 hour\' WHERE id = :id', { id: c.lala });

    const ties = await lalaStoryTies(sequelize, [c.mom, c.auntie]);
    expect(ties.get(c.mom).words).toBe('mother');
    expect(ties.get(c.auntie).words).toBe('aunt');

    // Mom's page: Lala is her daughter; Lala's page: Mom is her mother, Auntie her aunt.
    const momPage = await personPage(sequelize, c.mom);
    expect(momPage.relationships.find((r) => r.id === rel.lalaMom)).toMatchObject({ kind: 'daughter', words: 'daughter' });
    const lalaPage = await personPage(sequelize, c.lala);
    expect(lalaPage.relationships.find((r) => r.id === rel.lalaMom)).toMatchObject({ kind: 'mother' });
    expect(lalaPage.relationships.find((r) => r.id === rel.auntLala)).toMatchObject({ kind: 'aunt' });
  });

  test('10. the character file names the people in their life by their chosen name, not the feed handle', async () => {
    await relate('fileRel', 'kai', 'dre', { type: 'rival' });
    const file = await loadCharacterFile(models, { character: await models.RegistryCharacter.findByPk(c.kai), feedProfile: null });
    const people = file.relationships.map((r) => r.person);
    expect(people).toContain(`Dre Coleman ${tag}`);
    expect(people).not.toContain(`dre_handle_${tag}`);
  });

  test('12. Propose Family says why the AI failed: the budget, the credit, the rate limit', async () => {
    // The cast is the live LalaVerse profiles' characters: Jade and Dre are in it.
    const budget = Object.assign(new Error('AI daily budget exceeded ($9.00 / $5). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
    mockCreate.mockRejectedValueOnce(budget);
    const a = await auth(request(app).post(`${api}/generate-family`)).send({});
    expect(a.status).toBe(429);
    expect(a.body).toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(a.body.error).toMatch(/Today's AI budget is used up, so Propose Family cannot run until tomorrow/);

    mockCreate.mockRejectedValueOnce(Object.assign(new Error('Your credit balance is too low'), { status: 400 }));
    const b = await auth(request(app).post(`${api}/generate-family`)).send({});
    expect(b.status).toBe(402);
    expect(b.body.error).toMatch(/AI credits exhausted/);

    mockCreate.mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 500 }));
    const d = await auth(request(app).post(`${api}/generate-family`)).send({});
    expect(d.status).toBe(502);
    expect(d.body.error).toBe('AI service unavailable. overloaded');

    // Generate answers a budget refusal the same way (it used to say "rate limit").
    mockCreate.mockRejectedValueOnce(budget);
    const g = await auth(request(app).post(`${api}/generate`)).send({});
    expect(g.status).toBe(429);
    expect(g.body.error).toMatch(/so Generate cannot run until tomorrow/);
    mockCreate.mockResolvedValue(reply({ family_bonds: [] }));
  });
});
