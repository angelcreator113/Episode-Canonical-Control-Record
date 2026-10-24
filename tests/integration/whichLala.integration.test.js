/**
 * One Lala for the Relationships page and the writers (services/whichLala,
 * 2026-10-24), against the test database. Two registries each hold a Lala:
 * the big one holds most of the cast (its Lala is found only by her name),
 * the small one's Lala has the 'lala' key, a Pulse profile and the newest
 * edit (the writers used to take her). Everyone now names the big one:
 * GET /relationships/cast, relationshipTruth's Lala ties, and the script
 * writer's lalaRomances.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const whichLala = require('../../src/services/whichLala');
const truth = require('../../src/services/relationshipTruth');
const { lalaRomances } = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('which Lala (services/whichLala)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { big: uuid(), small: uuid() };
  const c = {};
  const profiles = [];
  const rels = [];
  let admin;

  const profile = async (key) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}` });
    profiles.push(row.id);
    return row.id;
  };
  const person = async (key, { reg, name, charKey = `${key}-${tag}`, withProfile = false, ago = 60 }) => {
    c[key] = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :charKey, :name, 'support', :profile, NOW(), NOW() - (:ago || ' minutes')::interval)`,
    { id: c[key], reg, charKey, name, profile: withProfile ? await profile(key) : null, ago: String(ago) });
  };
  const romance = async (a, b) => {
    const id = uuid();
    rels.push(id);
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, confirmed, is_romantic, situation, created_at, updated_at)
               VALUES (:id, :a, :b, 'love_interest', true, true, :note, NOW(), NOW())`, { id, a: c[a], b: c[b], note: `with ${a}` });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-whichlala', email: 'evoni@whichlala.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:big, 'Big', NOW(), NOW()), (:small, 'Small', NOW(), NOW())", ids);
    // The big registry: three of the cast, and a Lala known only by her name.
    await person('bigLala', { reg: ids.big, name: 'Lala', ago: 120 });
    for (const k of ['marcus', 'jade', 'dre']) await person(k, { reg: ids.big, name: `${k} ${tag}`, withProfile: true });
    // The small registry: one of the cast, and the Lala the writers used to pick.
    await person('smallLala', { reg: ids.small, name: 'Lala', charKey: 'lala', withProfile: true, ago: 0 });
    await person('sable', { reg: ids.small, name: `sable ${tag}`, withProfile: true });
    await romance('bigLala', 'marcus');
    await romance('smallLala', 'jade');
  });

  afterAll(async () => {
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:p) OR target_profile_id IN (:p)', { p: profiles });
    await run('DELETE FROM character_relationships WHERE id IN (:rels)', { rels });
    await run('DELETE FROM registry_characters WHERE registry_id IN (:big, :small)', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: profiles });
    await run('DELETE FROM character_registries WHERE id IN (:big, :small)', ids);
  });

  test('the Lala of the registry holding most of the cast, over the newer keyed one with a profile', async () => {
    expect(await whichLala.lalaId(models)).toBe(c.bigLala);
    expect(await whichLala.lalaId(sequelize)).toBe(c.bigLala);
  });

  test('the page shows that Lala', async () => {
    const res = await request(app).get('/api/v1/relationships/cast').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.lala_id).toBe(c.bigLala);
    // Lala first; the other one (her own Pulse profile makes her one of the cast) is not Lala.
    expect(res.body.characters[0].id).toBe(c.bigLala);
  });

  test("the writers read the same Lala's ties and romances, not the other's", async () => {
    const ties = await truth.lalaStoryTies(models, [c.marcus, c.jade]);
    expect([...ties.keys()]).toEqual([c.marcus]);
    const romances = await lalaRomances(sequelize, [c.marcus, c.jade]);
    expect([...romances]).toEqual([[c.marcus, 'with bigLala']]);
  });
});
