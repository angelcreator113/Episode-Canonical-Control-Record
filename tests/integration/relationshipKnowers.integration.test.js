/**
 * Who knows about a relationship (Evoni, 2026-10-23), against the test
 * database: the migration adds known_by and public_state and backfills them
 * from The Pulse and the old "knows" notes, and goes down and up again;
 * PUT /relationships/:id writes them (admin only) and GET returns them;
 * whoKnows / addKnower (services/relationshipKnowers); the script writer's
 * lines and the Pulse drafter's private knowledge.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261024100000-relationship-known-by');
const knowers = require('../../src/services/relationshipKnowers');
const { relationshipSecrecyBlock } = require('../../src/services/episodeScriptWriterService');
const { privateKnowledge } = require('../../src/services/pulseKnowledge');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) => (await run(sql, replacements))[0][0];

(shouldSkip ? describe.skip : describe)('who knows about a relationship (2026-10-23)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep: uuid() };
  const c = {};
  const p = {};
  const rel = {};
  let admin;
  let editor;
  const qi = () => sequelize.getQueryInterface();

  const profile = async (key) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
    p[key] = row.id;
    return row.id;
  };
  const person = async (key, name, { selected = null, withProfile = true } = {}) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :selected, 'support', :profile, NOW(), NOW())`,
    { id: c[key], reg: ids.reg, key: key === 'lala' ? 'lala' : `${key}-${tag}`, name, selected, profile: withProfile ? await profile(key) : null });
  };
  const relate = async (key, a, b, f = {}) => {
    rel[key] = uuid();
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic,
                 source_knows, target_knows, reader_knows, created_at, updated_at)
               VALUES (:id, :a, :b, :type, true, :romantic, :sk, :tk, :rk, NOW() + (:n || ' seconds')::interval, NOW())`,
    { id: rel[key], a: c[a], b: c[b], type: f.type || 'friend', romantic: !!f.romantic, sk: f.sk || null, tk: f.tk || null, rk: f.rk || null, n: String(Object.keys(rel).length) });
  };
  const pulse = (a, b, kind, visibility) => run(
    `INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, public_visibility, created_at, updated_at)
     VALUES (:a, :b, :kind, :visibility, NOW(), NOW())`, { a: p[a], b: p[b], kind, visibility });
  const row = (key) => one('SELECT known_by, public_state FROM character_relationships WHERE id = :id', { id: rel[key] });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-relknow', email: 'evoni@relknow.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-user-relknow', email: 'user@relknow.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Know ${tag}`, slug: `know-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Knowers', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 4, 'draft', NOW(), NOW())`, ids);
    await person('lala', 'Lala');
    await person('marcus', `Truthville ${tag}`, { selected: `Marcus Hale ${tag}` });
    await person('jade', `Jade Monroe ${tag}`);
    await person('dre', `Dre ${tag}`);
    await person('nia', `Nia ${tag}`, { withProfile: false });

    // A romance hidden on the Pulse (and a public collab between them, which a romantic row does not read).
    await relate('lm', 'lala', 'marcus', { type: 'love_interest', romantic: true, rk: `Jade caught them on the balcony and told Dre ${tag}.` });
    await pulse('lala', 'marcus', 'couple', 'hidden');
    await pulse('lala', 'marcus', 'collab', 'public');
    // A rivalry the Pulse only whispers about.
    await relate('jd', 'jade', 'dre', { type: 'rival', sk: `Marcus Hale ${tag} told her everything` });
    await pulse('jade', 'dre', 'rival', 'rumored');
    // Nothing on the Pulse, nobody named.
    await relate('ln', 'lala', 'nia', { type: 'mentor', sk: 'She knows Nia is struggling.' });
  });

  afterAll(async () => {
    const all = Object.values(c);
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:all) OR character_id_b IN (:all)', { all });
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM registry_characters WHERE id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(p) });
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the migration backfills from the Pulse and the old notes, and goes down and up again', async () => {
    // The rows were written with the columns' defaults; down and up runs the backfill on them.
    await migration.down(qi(), Sequelize);
    const cols = await qi().describeTable('character_relationships');
    expect(cols.known_by).toBeUndefined();
    expect(cols.public_state).toBeUndefined();
    await migration.up(qi(), Sequelize);
    await migration.up(qi(), Sequelize); // a re-run changes nothing it should not

    const lm = await row('lm');
    expect(lm.public_state).toBe('secret');
    // "Jade" (her first name, only she has it) and Dre are named in the reader's notes.
    expect(lm.known_by.map((k) => k.registry_character_id).sort()).toEqual([c.jade, c.dre].sort());
    expect(lm.known_by[0].how).toBe('Named in the "Reader knows" notes');
    const jd = await row('jd');
    expect(jd.public_state).toBe('rumoured');
    expect(jd.known_by).toEqual([{ registry_character_id: c.marcus, how: `Named in the "Jade Monroe ${tag} knows" notes` }]);
    // Nia is one of the pair: never listed as knowing her own relationship.
    expect(await row('ln')).toEqual({ known_by: [], public_state: 'known' });

    await expect(run("UPDATE character_relationships SET public_state = 'whispered' WHERE id = :id", { id: rel.ln })).rejects.toThrow();
  });

  test('PUT writes known_by and public_state (admin only); GET returns them', async () => {
    const put = (token, body) => request(app).put(`/api/v1/relationships/${rel.lm}`).set('Authorization', `Bearer ${token}`).send(body);
    expect((await put(editor, { public_state: 'known' })).status).toBe(403);
    expect((await request(app).put(`/api/v1/relationships/${rel.lm}`).send({ public_state: 'known' })).status).toBe(401);
    expect((await row('lm')).public_state).toBe('secret');

    const res = await put(admin, {
      public_state: 'secret',
      known_by: [c.jade, { registry_character_id: c.jade }, { registry_character_id: c.lala }, { profile_id: p.dre, since_episode_id: ids.ep, how: 'saw the photo' }, { name: 'The doorman' }],
    });
    expect(res.status).toBe(200);
    // One entry each; Lala, one of the two, is left out.
    expect(res.body.relationship.known_by).toEqual([
      { registry_character_id: c.jade },
      { profile_id: p.dre, since_episode_id: ids.ep, how: 'saw the photo' },
      { name: 'The doorman' },
    ]);
    expect(res.body.relationship.public_state).toBe('secret');

    expect((await put(admin, { public_state: 'whispered' })).body.error).toMatch(/secret, rumoured or known/);
    expect((await put(admin, { known_by: [uuid()] })).status).toBe(400);
    expect((await put(admin, { known_by: [{ profile_id: 99999999 }] })).body.error).toMatch(/not a Feed profile/);
    expect((await put(admin, { known_by: 'Jade' })).status).toBe(400);
    expect((await put(admin, { known_by: [{ registry_character_id: c.jade, name: 'Jade' }] })).status).toBe(400);
    // A field not sent stays; other fields still save alongside.
    const other = await put(admin, { situation: 'Meeting after hours' });
    expect(other.status).toBe(200);
    expect(other.body.relationship.known_by).toHaveLength(3);

    const cast = await request(app).get(`/api/v1/relationships/character/${c.lala}`).set('Authorization', `Bearer ${admin}`);
    const lm = cast.body.relationships.find((r) => r.id === rel.lm);
    expect(lm.public_state).toBe('secret');
    expect(lm.known_by).toHaveLength(3);
  });

  test('whoKnows names everyone; addKnower adds once, never one of the two', async () => {
    const map = await knowers.whoKnows(sequelize, [rel.lm, 'not-an-id']);
    const lm = map.get(rel.lm);
    expect(lm.public_state).toBe('secret');
    expect(lm.kind).toBe('romance');
    expect(lm.pair.map((x) => x.name)).toEqual(['Lala', `Marcus Hale ${tag}`]);
    // A profile reads as its character's name; the episode as its number.
    expect(lm.knowers.map((k) => k.name)).toEqual([`Jade Monroe ${tag}`, `Dre ${tag}`, 'The doorman']);
    expect(lm.knowers[1].since_episode_number).toBe(4);
    expect((await knowers.whoKnows(sequelize, [])).size).toBe(0);

    expect((await knowers.addKnower(sequelize, rel.ln, c.jade, { episodeId: ids.ep, how: 'overheard at the gala' })).added).toBe(true);
    expect((await row('ln')).known_by).toEqual([{ registry_character_id: c.jade, since_episode_id: ids.ep, how: 'overheard at the gala' }]);
    expect((await knowers.addKnower(sequelize, rel.ln, { registry_character_id: c.jade })).added).toBe(false);
    expect((await knowers.addKnower(sequelize, rel.ln, c.nia)).added).toBe(false);
    expect((await knowers.addKnower(sequelize, rel.ln, 'Her therapist')).added).toBe(true);
    expect((await row('ln')).known_by).toHaveLength(2);
    await expect(knowers.addKnower(sequelize, rel.ln, uuid())).rejects.toThrow(/not a character/);
    await expect(knowers.addKnower(sequelize, uuid(), c.jade)).rejects.toMatchObject({ status: 404 });
  });

  test('the script writer is told who may mention each relationship: secret, rumoured, known', async () => {
    const lines = await knowers.relationshipSecrecyLines(sequelize, [c.jade, c.nia]);
    // Secrets first, then rumours, then the known ones.
    expect(lines).toEqual([
      `Lala and Marcus Hale ${tag}'s romance is SECRET: only Jade Monroe ${tag}, Dre ${tag} and The doorman know. Nobody else mentions it.`,
      `Jade Monroe ${tag} and Dre ${tag}'s relationship (rival) is RUMOURED: Marcus Hale ${tag} knows for sure; everyone else has only heard talk, so they may hint at it or ask, never state it as fact.`,
      `Lala and Nia ${tag}'s relationship (mentor) is KNOWN: anyone may mention it.`,
    ]);
    expect(await knowers.relationshipSecrecyLines(sequelize, [])).toEqual([]);

    // Lala is at every episode: her relationships are there with nobody else named.
    const block = await relationshipSecrecyBlock(sequelize, []);
    expect(block).toContain('═══ WHO KNOWS ABOUT WHOM ═══');
    expect(block).toContain(`- Lala and Marcus Hale ${tag}'s romance is SECRET: only Jade Monroe ${tag}, Dre ${tag} and The doorman know.`);
  });

  test('the Pulse drafter: the secret goes in the private knowledge of those who know it, nobody else', async () => {
    const secret = { person: `Lala and Marcus Hale ${tag}`, knows: 'Their romance is a secret: never post, reveal or hint at it.' };
    const rumour = { person: `Jade Monroe ${tag} and Dre ${tag}`, knows: 'Their relationship (rival) is only a rumour: never confirm it.' };
    expect(await knowers.secretsKnownBy(sequelize, c.marcus)).toEqual([secret, rumour]);
    expect(await knowers.secretsKnownBy(sequelize, c.jade)).toEqual([secret, rumour]);
    // Dre is listed by his Feed profile.
    expect(await knowers.secretsKnownBy(sequelize, c.dre)).toEqual([secret, rumour]);
    expect(await knowers.secretsKnownBy(sequelize, c.nia)).toEqual([]);
    // Through privateKnowledge, after their own notes.
    const marcus = await privateKnowledge(models, c.marcus);
    expect(marcus[marcus.length - 2]).toEqual(secret);
    expect(await privateKnowledge(models, c.nia)).toEqual([]);
  });
});
