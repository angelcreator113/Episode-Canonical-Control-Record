jest.unmock('uuid');

/**
 * Integration Tests - registry_characters JSONB writes, part 2
 *
 * F-Reg-2 Fix Plan v1.0, fix group 1, part 2: the three sites the scoping
 * note's reading pass reported and this file confirms first.
 *
 *   - POST /api/v1/character-registry/characters/:id/deep-profile/accept
 *     merges `additions` into deep_profile (fill empty fields, append to
 *     strings). Its merge reuses each existing dimension object, so additions
 *     that touch only existing dimensions edit the loaded value in place and
 *     the save writes nothing.
 *   - POST /api/v1/character-registry/characters/bulk-deep-profile merges an
 *     AI-generated profile into deep_profile (fill empty fields), with the
 *     same in-place edit, and it merges onto the value read before the AI
 *     call.
 *   - POST /api/v1/memories/story-engine-update-registry merges the AI's
 *     personality_matrix additions into the loaded object in place, and
 *     merges all three JSONB fields onto values read before the AI call.
 *
 * Each describe pins the saved state, and a concurrent write made while the
 * handler is working must survive.
 *
 * Test-only fixture, as in registryJsonWrites.integration.test.js: the
 * RegistryCharacter model declares a `world` column (ENUM 'book-1',
 * 'lalaverse', 'series-2') that production has (the 2026-09-17 canon capture)
 * but no migration creates yet (owed to F-Reg-2, Evoni's ruling recorded on
 * Task #2101). beforeAll adds it only when missing; afterAll removes only what
 * beforeAll added.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const aiText = (body) => ({ content: [{ type: 'text', text: JSON.stringify(body) }] });

async function seedCharacter(columns) {
  const ids = { registry: uuid(), rc: uuid() };
  const key = `json-writes-2-${ids.rc.slice(0, 8)}`;
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registry, 'JSON writes 2 test registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters
               (id, registry_id, character_key, display_name, status,
                deep_profile, personality_matrix, relationships_map, evolution_tracking, created_at, updated_at)
             VALUES (:rc, :registry, :key, 'JSON Writes Two', 'accepted',
                CAST(:deep AS jsonb), CAST(:pm AS jsonb), CAST(:rel AS jsonb), CAST(:evo AS jsonb), NOW(), NOW())`,
    {
      ...ids,
      key,
      deep: JSON.stringify(columns.deep_profile ?? {}),
      pm: JSON.stringify(columns.personality_matrix ?? {}),
      rel: JSON.stringify(columns.relationships_map ?? {}),
      evo: JSON.stringify(columns.evolution_tracking ?? {}),
    });
  return { ...ids, key };
}

async function column(ids, name) {
  const [row] = await q(`SELECT ${name} AS v FROM registry_characters WHERE id = :rc`, ids);
  return row.v;
}

(shouldSkip ? describe.skip : describe)('registry_characters JSONB writes are saved, part 2 (F-Reg-2 fix group 1)', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;
  let addedWorld = false;
  let addedWorldType = false;

  beforeAll(async () => {
    const [col] = await q(`SELECT 1 AS present FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = 'registry_characters' AND column_name = 'world'`);
    if (!col) {
      const [type] = await q(`SELECT 1 AS present FROM pg_type WHERE typname = 'enum_registry_characters_world'`);
      if (!type) {
        await run(`CREATE TYPE enum_registry_characters_world AS ENUM ('book-1', 'lalaverse', 'series-2')`);
        addedWorldType = true;
      }
      await run(`ALTER TABLE registry_characters ADD COLUMN world enum_registry_characters_world`);
      addedWorld = true;
    }

    token = TokenService.generateTokenPair({
      id: 'test-user-registry-json-2',
      email: 'test@registry-json-2.dev',
      name: 'Registry JSON Test 2',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    mockCreate.mockReset();
  });

  afterAll(async () => {
    for (const ids of seeded) await run(`DELETE FROM character_registries WHERE id = :registry`, ids);
    if (addedWorld) await run(`ALTER TABLE registry_characters DROP COLUMN world`);
    if (addedWorldType) await run(`DROP TYPE enum_registry_characters_world`);
  });

  describe('POST /characters/:id/deep-profile/accept', () => {
    const accept = (ids, additions) =>
      request(app).post(`/api/v1/character-registry/characters/${ids.rc}/deep-profile/accept`)
        .set('Authorization', auth()).send({ additions });

    it('saves additions to an existing dimension (fill empty, append to strings)', async () => {
      const ids = await seedCharacter({ deep_profile: { life_stage: { phase: 'early' }, the_body: { posture: 'upright' } } });
      seeded.push(ids);

      const res = await accept(ids, { life_stage: { phase: 'late', turning_point: 'the fire' } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        character_id: ids.rc,
        deep_profile: {
          life_stage: { phase: 'early — late', turning_point: 'the fire' },
          the_body: { posture: 'upright' },
        },
      });

      expect(await column(ids, 'deep_profile')).toEqual({
        life_stage: { phase: 'early — late', turning_point: 'the fire' },
        the_body: { posture: 'upright' },
      });
    });

    it('keeps both when two accepts run concurrently', async () => {
      const ids = await seedCharacter({ deep_profile: { life_stage: { phase: 'early' } } });
      seeded.push(ids);

      const [ra, rb] = await Promise.all([
        accept(ids, { life_stage: { turning_point: 'the fire' } }),
        accept(ids, { life_stage: { regret: 'the letter' } }),
      ]);
      expect(ra.status).toBe(200);
      expect(rb.status).toBe(200);

      expect(await column(ids, 'deep_profile')).toEqual({
        life_stage: { phase: 'early', turning_point: 'the fire', regret: 'the letter' },
      });
    });
  });

  describe('POST /characters/bulk-deep-profile', () => {
    const bulk = (ids) =>
      request(app).post('/api/v1/character-registry/characters/bulk-deep-profile')
        .set('Authorization', auth()).send({ ids: [ids.rc] });

    it('saves generated fields into an existing dimension without overwriting filled ones', async () => {
      const ids = await seedCharacter({ deep_profile: { life_stage: { phase: 'early', turning_point: null } } });
      seeded.push(ids);
      mockCreate.mockResolvedValue(aiText({ life_stage: { phase: 'ignored', turning_point: 'the fire' } }));

      const res = await bulk(ids);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, succeeded: 1, failed: 0, skipped: 0, errors: [] });

      expect(await column(ids, 'deep_profile')).toEqual({ life_stage: { phase: 'early', turning_point: 'the fire' } });
    });

    it('keeps a change written to deep_profile while the AI call runs', async () => {
      const ids = await seedCharacter({ deep_profile: { life_stage: { phase: 'early' } } });
      seeded.push(ids);
      mockCreate.mockImplementation(async () => {
        await run(`UPDATE registry_characters
                      SET deep_profile = jsonb_set(deep_profile, '{the_body}', '{"posture": "upright"}'::jsonb)
                    WHERE id = :rc`, ids);
        return aiText({ life_stage: { turning_point: 'the fire' } });
      });

      const res = await bulk(ids);
      expect(res.status).toBe(200);
      expect(res.body.succeeded).toBe(1);

      expect(await column(ids, 'deep_profile')).toEqual({
        life_stage: { phase: 'early', turning_point: 'the fire' },
        the_body: { posture: 'upright' },
      });
    });
  });

  describe('POST /memories/story-engine-update-registry', () => {
    const update = (ids) =>
      request(app).post('/api/v1/memories/story-engine-update-registry')
        .set('Authorization', auth())
        .send({ characterKey: ids.key, storyNumber: 7, storyTitle: 'Test story', storyText: 'Something happened.' });

    const AI_UPDATES = {
      updates: {
        relationships_map: { merge: true, data: { Nia: { status: 'strained', dynamic: 'distance' } } },
        evolution_tracking: { merge: true, data: { current_phase: 'pressure', last_story: 7 } },
        personality_matrix: { merge: true, data: { new_strengths: ['kind'], new_vulnerabilities: [], trait_shifts: ['softer'] } },
      },
      core_updates: { core_desire: null, core_fear: null, core_wound: null, belief_pressured: null },
      summary: 'She softened.',
    };

    it('saves personality_matrix additions onto an existing matrix', async () => {
      const ids = await seedCharacter({
        personality_matrix: { strengths: ['brave'], trait_shifts: ['guarded'] },
        relationships_map: { Lala: { status: 'new' } },
        evolution_tracking: { current_phase: 'establishment' },
      });
      seeded.push(ids);
      mockCreate.mockResolvedValue(aiText(AI_UPDATES));

      const res = await update(ids);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        updated: true,
        fields_updated: 3,
        summary: 'She softened.',
        updates_applied: ['relationships_map', 'evolution_tracking', 'personality_matrix'],
      });

      expect(await column(ids, 'personality_matrix')).toEqual({ strengths: ['brave', 'kind'], trait_shifts: ['guarded', 'softer'] });
      expect(await column(ids, 'relationships_map')).toEqual({ Lala: { status: 'new' }, Nia: { status: 'strained', dynamic: 'distance' } });
      expect(await column(ids, 'evolution_tracking')).toEqual({ current_phase: 'pressure', last_story: 7 });
    });

    it('keeps changes written to the three fields while the AI call runs', async () => {
      const ids = await seedCharacter({
        personality_matrix: { strengths: ['brave'] },
        relationships_map: {},
        evolution_tracking: {},
      });
      seeded.push(ids);
      mockCreate.mockImplementation(async () => {
        await run(`UPDATE registry_characters
                      SET personality_matrix = jsonb_set(personality_matrix, '{strengths}', '["brave", "loyal"]'::jsonb),
                          relationships_map = relationships_map || '{"Mira": {"status": "new"}}'::jsonb,
                          evolution_tracking = evolution_tracking || '{"growth_edges": ["trust"]}'::jsonb
                    WHERE id = :rc`, ids);
        return aiText(AI_UPDATES);
      });

      const res = await update(ids);
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(true);

      expect(await column(ids, 'personality_matrix')).toEqual({ strengths: ['brave', 'loyal', 'kind'], trait_shifts: ['softer'] });
      expect(await column(ids, 'relationships_map')).toEqual({ Mira: { status: 'new' }, Nia: { status: 'strained', dynamic: 'distance' } });
      expect(await column(ids, 'evolution_tracking')).toEqual({ growth_edges: ['trust'], current_phase: 'pressure', last_story: 7 });
    });
  });
});
