/**
 * A character's place described from their profile (Evoni, 2026-10-17), on
 * the migrated database through the real routes, with the AI call mocked:
 * - the home price range is a fact: set on the fact sheet, refused when it
 *   is not one of the ranges, and in the facts block every generator reads;
 * - "Write from their profile" reads their DREAM city, home location, price
 *   range, class and the gap between the life they show and the one they
 *   live, names what it lacks, and saves nothing.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261015160000-create-character-places');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('A place described from the character\'s profile', () => {
  let token;
  const saved = {};
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const tag = uuid().slice(0, 8);

  async function cast({ gap = true } = {}) {
    const showId = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: showId, name: `Describe ${showId.slice(0, 8)}`, slug: `describe-${showId.slice(0, 8)}` });
    const registry = uuid();
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:registry, 'Cast', :showId, NOW(), NOW())`, { registry, showId });
    const locationId = uuid();
    await run(`INSERT INTO world_locations (id, name, slug, district, property_type, created_at, updated_at)
               VALUES (:locationId, 'The Vale Building', :slug, 'Silk Row', 'apartment', NOW(), NOW())`, { locationId, slug: `vale-${locationId.slice(0, 8)}` });
    const [{ id: pid }] = await rows(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, home_location_id,
        lifestyle_claim, lifestyle_reality, lifestyle_gap, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', 'Sable', 'lalaverse', 'dazzle_district', :locationId, :claim, :reality, :gapKind, NOW(), NOW()) RETURNING id`, {
      handle: `sable-${tag}-${uuid().slice(0, 4)}`, locationId,
      claim: gap ? 'penthouse luxury, designer everything' : null,
      reality: gap ? 'a one-bedroom rental, borrowed clothes' : null,
      gapKind: gap ? 'massive' : 'authentic',
    });
    const id = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id,
                 de_money_origin_class, de_money_current_class, canon_facts, created_at, updated_at)
               VALUES (:id, :registry, :key, 'Sable', :pid, 'working_class', 'middle_class', :facts, NOW(), NOW())`,
    { id, registry, key: `sable-${id.slice(0, 6)}`, pid, facts: JSON.stringify({ home_price_range: 'modest' }) });
    const setId = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, canonical_description, generation_status, created_at, updated_at)
               VALUES (:setId, 'Sable''s Home', 'HOME_BASE', :showId, 'A bright loft.', 'pending', NOW(), NOW())`, { setId, showId });
    await run(`INSERT INTO character_places (id, registry_character_id, scene_set_id, role, created_at, updated_at)
               VALUES (:cp, :id, :setId, 'home', NOW(), NOW())`, { cp: uuid(), id, setId });
    return { showId, id, pid, setId };
  }
  const describeIt = (cid, setId) => auth(request(app).post(`/api/v1/cast/characters/${cid}/places/describe`)).send({ scene_set_id: setId });

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-user-describe', email: 'u@describe.dev', name: 'Editor', groups: ['USER', 'EDITOR', 'ADMIN'], role: 'ADMIN' }).accessToken;
    saved.key = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  });
  afterAll(() => {
    if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.key;
  });
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'A one-bedroom rental in Silk Row with one staged corner.' }], usage: { input_tokens: 10, output_tokens: 10 } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the home price range is a fact: set, refused when unknown, in the facts block', async () => {
    const { id } = await cast();
    const read = await auth(request(app).get(`/api/v1/cast/characters/${id}/facts`));
    expect(read.status).toBe(200);
    expect(read.body.facts.home_price_range).toMatchObject({ key: 'modest', label: expect.stringMatching(/^Modest/) });

    const bad = await auth(request(app).put(`/api/v1/cast/characters/${id}/facts`)).send({ home_price_range: 'castle' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/Home price range is one of/);

    const ok = await auth(request(app).put(`/api/v1/cast/characters/${id}/facts`)).send({ home_price_range: 'luxury' });
    expect(ok.status).toBe(200);
    expect(ok.body.facts.home_price_range.key).toBe('luxury');
    const { factsPromptBlock } = require('../../src/services/characterFacts');
    expect(factsPromptBlock(ok.body.facts)).toMatch(/their home's price range: Luxury/);
  });

  it('writes from their city, location, price range, class and the gap; saves nothing', async () => {
    const { id, setId } = await cast();
    const res = await describeIt(id, setId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ description: expect.stringMatching(/staged corner/), gap: true, current: 'A bright loft.', role: 'home' });
    const used = Object.fromEntries(res.body.data.used.map((u) => [u.label, u.value]));
    expect(used).toMatchObject({
      City: 'Dazzle District',
      'Home location': expect.stringMatching(/The Vale Building, Silk Row/),
      'Home price range': expect.stringMatching(/^Modest/),
      Class: 'grew up working class, now middle class',
      'Shown vs real': 'massive gap',
    });
    expect(res.body.data.missing).toEqual(expect.arrayContaining(['Style', 'Current life']));

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatch(/Styling Adventures with Lala/);
    expect(prompt).toMatch(/THEIR CITY: Dazzle District\. Fashion capital/);
    expect(prompt).toMatch(/THE GAP .*penthouse luxury.*one-bedroom rental/s);
    expect(prompt).toMatch(/their home's price range: Modest/);
    expect((await rows('SELECT canonical_description FROM scene_sets WHERE id = :setId', { setId }))[0].canonical_description).toBe('A bright loft.');
  });

  it('no gap on the profile: one honest place', async () => {
    const { id, setId } = await cast({ gap: false });
    const res = await describeIt(id, setId);
    expect(res.status).toBe(200);
    expect(res.body.data.gap).toBe(false);
    expect(mockCreate.mock.calls[0][0].messages[0].content).not.toMatch(/THE GAP/);
  });

  it('a bad id is a 400; an unknown set is a 404; no AI call', async () => {
    const { id } = await cast();
    expect((await describeIt(id, 'nope')).status).toBe(400);
    expect((await describeIt(id, uuid())).status).toBe(404);
    expect((await describeIt(uuid(), uuid())).status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
