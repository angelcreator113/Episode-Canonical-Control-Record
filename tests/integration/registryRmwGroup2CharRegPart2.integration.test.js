/**
 * F-Reg-2 fix group 2 (v1.2 R2), characterRegistry.js part 2: rows 34, 35,
 * 37, 38 and 39 of the scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2).
 * Part 1 is #2179 (rows 18, 19, 20, 30, 33).
 *
 * Each test sets a column between the handler's read and its write,
 * deterministically: during a (mocked) AI call, or right after the
 * character backfill's reload. On origin/main that value is overwritten;
 * with the fix it is kept.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const BASE = '/api/v1/character-registry';
const text = (t) => ({ content: [{ text: t }] });

const ARRAY_MAP = [{ type: 'support', target: 'Ava', feels: 'safe' }];
const FULL = { a: 'x' }; // a section with data, so the handlers leave it alone

// One character. Unless given, every JSONB section has data, so each test
// opens only the gaps it needs.
async function seed({ relationshipsMap = FULL, extraFields = { plot_threads: [{ id: 'pt-x', title: 'existing' }] }, empty = [], coreFear = 'known fear' } = {}) {
  const ids = { reg: uuid(), rc: uuid() };
  const sections = {};
  for (const s of ['career_status', 'aesthetic_dna', 'voice_signature', 'story_presence', 'evolution_tracking', 'living_context']) {
    sections[s] = empty.includes(s) ? null : JSON.stringify(FULL);
  }
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'RMW part 2 registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, core_fear,
               career_status, aesthetic_dna, voice_signature, story_presence, evolution_tracking, living_context,
               relationships_map, extra_fields, created_at, updated_at)
             VALUES (:rc, :reg, :key, 'RMW Character', :coreFear,
               CAST(:career_status AS jsonb), CAST(:aesthetic_dna AS jsonb), CAST(:voice_signature AS jsonb),
               CAST(:story_presence AS jsonb), CAST(:evolution_tracking AS jsonb), CAST(:living_context AS jsonb),
               CAST(:rm AS jsonb), CAST(:ef AS jsonb), NOW(), NOW())`,
    { ...ids, ...sections, key: `rmw2-${ids.rc.slice(0, 8)}`, coreFear,
      rm: JSON.stringify(relationshipsMap), ef: JSON.stringify(extraFields) });
  return ids;
}

async function cleanup(ids) {
  await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
}

const rowOf = async (ids, cols) => {
  const [row] = await q(`SELECT ${cols} FROM registry_characters WHERE id = :rc`, ids);
  return row;
};

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, characterRegistry.js part 2: a value set meanwhile is not overwritten', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-rmw-part-2',
      email: 'test@rmw-part-2.dev',
      name: 'RMW Part 2 Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  beforeEach(() => mockCreate.mockReset());
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const ids of seeded) await cleanup(ids);
  });

  it('row 34: character backfill keeps a relationships_map written after its read instead of flattening the stale array', async () => {
    // core_fear empty so the handler runs; the AI fills nothing.
    const ids = await seed({ relationshipsMap: ARRAY_MAP, coreFear: null });
    seeded.push(ids);
    mockCreate.mockResolvedValue(text('{}'));

    const original = models.RegistryCharacter.prototype.reload;
    jest.spyOn(models.RegistryCharacter.prototype, 'reload').mockImplementation(async function (...args) {
      const result = await original.apply(this, args);
      await run(`UPDATE registry_characters SET relationships_map = CAST(:m AS jsonb) WHERE id = :rc`,
        { ...ids, m: JSON.stringify({ allies: 'set meanwhile' }) });
      return result;
    });

    const res = await request(app).post(`${BASE}/characters/${ids.rc}/backfill-sections`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((await rowOf(ids, 'relationships_map')).relationships_map).toEqual({ allies: 'set meanwhile' });
    expect(res.body.filled).not.toContain('relationships_map_normalized');
  });

  it('row 35: character backfill keeps an extra_fields change made during the plot-thread AI call', async () => {
    const ids = await seed({ extraFields: {}, coreFear: null });
    seeded.push(ids);
    mockCreate
      .mockResolvedValueOnce(text('{}'))
      .mockImplementationOnce(async () => {
        await run(`UPDATE registry_characters SET extra_fields = CAST(:ef AS jsonb) WHERE id = :rc`,
          { ...ids, ef: JSON.stringify({ other_key: 'set meanwhile' }) });
        return text('[{"thread": "new thread", "status": "open"}]');
      });

    const res = await request(app).post(`${BASE}/characters/${ids.rc}/backfill-sections`).set('Authorization', auth());
    expect(res.status).toBe(200);
    const { extra_fields: ef } = await rowOf(ids, 'extra_fields');
    expect(ef.other_key).toBe('set meanwhile');
    expect(ef.plot_threads.map((t) => t.title)).toEqual(['new thread']);
  });

  it('row 37: backfill-all keeps a section filled during the AI call and fills the rest', async () => {
    const ids = await seed({ empty: ['career_status', 'aesthetic_dna'] });
    seeded.push(ids);
    mockCreate.mockImplementationOnce(async () => {
      await run(`UPDATE registry_characters SET career_status = CAST(:v AS jsonb) WHERE id = :rc`,
        { ...ids, v: JSON.stringify({ profession: 'set meanwhile' }) });
      return text(JSON.stringify({ career_status: { profession: 'ai profession' }, aesthetic_dna: { color_palette: 'ai palette' } }));
    });

    const res = await request(app).post(`${BASE}/registries/${ids.reg}/backfill-all`).set('Authorization', auth());
    expect(res.status).toBe(200);
    const row = await rowOf(ids, 'career_status, aesthetic_dna');
    expect(row).toEqual({ career_status: { profession: 'set meanwhile' }, aesthetic_dna: { color_palette: 'ai palette' } });
    expect(res.body.results[0].filled).toEqual(['aesthetic_dna']);
  });

  it('row 38: backfill-all keeps a relationships_map written during the AI call instead of flattening the stale array', async () => {
    const ids = await seed({ empty: ['career_status'], relationshipsMap: ARRAY_MAP });
    seeded.push(ids);
    mockCreate.mockImplementationOnce(async () => {
      await run(`UPDATE registry_characters SET relationships_map = CAST(:m AS jsonb) WHERE id = :rc`,
        { ...ids, m: JSON.stringify({ allies: 'set meanwhile' }) });
      return text('{}');
    });

    const res = await request(app).post(`${BASE}/registries/${ids.reg}/backfill-all`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((await rowOf(ids, 'relationships_map')).relationships_map).toEqual({ allies: 'set meanwhile' });
  });

  it('row 39: backfill-all keeps an extra_fields change made during the plot-thread AI call', async () => {
    const ids = await seed({ empty: ['career_status'], extraFields: {} });
    seeded.push(ids);
    mockCreate
      .mockResolvedValueOnce(text('{}'))
      .mockImplementationOnce(async () => {
        await run(`UPDATE registry_characters SET extra_fields = CAST(:ef AS jsonb) WHERE id = :rc`,
          { ...ids, ef: JSON.stringify({ other_key: 'set meanwhile' }) });
        return text('[{"thread": "new thread", "status": "open"}]');
      });

    const res = await request(app).post(`${BASE}/registries/${ids.reg}/backfill-all`).set('Authorization', auth());
    expect(res.status).toBe(200);
    const { extra_fields: ef } = await rowOf(ids, 'extra_fields');
    expect(ef.other_key).toBe('set meanwhile');
    expect(ef.plot_threads.map((t) => t.title)).toEqual(['new thread']);
  });
});
