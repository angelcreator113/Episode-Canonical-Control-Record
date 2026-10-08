/**
 * The registry writers that save what an AI returns write values the
 * registry's ENUMs take (utils/registryDemographics). The character
 * generator's prompt asked for its own words (destitute, two_parent_stable,
 * only, partnered, a platform name) and /commit saved them as they came;
 * the section fill-in asked for others (nuclear, eldest, upward, Instagram,
 * mid-tier, an age range). Each one off its column's list failed the whole
 * save. Now both prompts ask for the registry's values, an old word is read
 * as the value it means, and one the registry cannot take is left empty.
 *
 * The AI is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { REGISTRY_ENUMS } = require('../../src/utils/registryDemographics');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const text = (body) => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] });

const TAG = crypto.randomUUID().slice(0, 8);
const DEMO = 'class_origin, current_class, class_mobility_direction, family_structure, sibling_position, relationship_status, platform_primary, follower_tier, current_city';

(shouldSkip ? describe.skip : describe)('the registry writers that save an AI\'s values write ones the registry takes', () => {
  let token;
  const registryId = uuid();
  const auth = () => `Bearer ${token}`;

  const seedCharacter = async (name, cols = {}) => {
    const id = uuid();
    const names = Object.keys(cols);
    await run(
      `INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, created_at, updated_at${names.map((n) => `, ${n}`).join('')})
       VALUES (:id, :registryId, :key, :name, :name, NOW(), NOW()${names.map((n) => `, :${n}`).join('')})`,
      { id, registryId, key: `vocab-${id.slice(0, 8)}`, name, ...cols });
    return id;
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-registry-vocab', email: 'test@registry-vocab.dev', name: 'Registry Vocab Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registryId, :title, NOW(), NOW())`,
      { registryId, title: `Registry vocab ${TAG}` });
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :registryId', { registryId });
    await run('DELETE FROM character_registries WHERE id = :registryId', { registryId });
  });

  beforeEach(() => mockCreate.mockReset());

  it('the lists are the database\'s: every value they give is one its column takes', async () => {
    for (const [field, values] of Object.entries(REGISTRY_ENUMS)) {
      const rows = await q(
        `SELECT e.enumlabel FROM pg_attribute a JOIN pg_enum e ON e.enumtypid = a.atttypid
          WHERE a.attrelid = 'registry_characters'::regclass AND a.attname = :field ORDER BY e.enumsortorder`, { field });
      const labels = rows.map((r) => r.enumlabel);
      expect({ field, missing: values.filter((v) => !labels.includes(v)) }).toEqual({ field, missing: [] });
      // current_city's type keeps the five cities migration 20261008150000
      // renamed from; every other list is its column's, exactly.
      if (field !== 'current_city') expect({ field, values: [...values].sort() }).toEqual({ field, values: [...labels].sort() });
    }
  });

  it('/commit saves a character in the generator\'s old words, read as the registry reads them, and reports what it could not read', async () => {
    const name = `Vocab Commit ${TAG}`;
    const res = await request(app).post('/api/v1/character-generator/commit').set('Authorization', auth()).send({
      registryId,
      character: {
        name, role_type: 'friend', layer: 'real-world', age: 31, current_city: 'outside_lalaverse',
        class_origin: 'destitute', current_class: 'middle', class_mobility_direction: 'ascending',
        family_structure: 'two_parent_stable', sibling_position: 'only', relationship_status: 'partnered',
        platform_primary: 'instagram', follower_tier: 'micro',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.skipped_values).toEqual([{ field: 'platform_primary', value: 'instagram' }]);
    const [row] = await q(`SELECT ${DEMO}, age FROM registry_characters WHERE id = :id`, { id: res.body.character_id });
    expect(row).toEqual({
      class_origin: 'poverty', current_class: 'middle_class', class_mobility_direction: 'ascending',
      family_structure: 'two_parents_intact', sibling_position: 'only_child', relationship_status: 'committed',
      platform_primary: null, follower_tier: 'micro', current_city: 'outside_lalaverse', age: 31,
    });
  });

  it('generate-section\'s demographics save the fill-in\'s old words as the registry reads them, and a whole number for an age range', async () => {
    const id = await seedCharacter(`Vocab Section ${TAG}`);
    mockCreate.mockResolvedValue(text({
      gender: 'Female', age: '25-30', sibling_count: '2', has_children: 'no', current_city: 'Echo Park',
      class_origin: 'working_class', current_class: 'upper_middle', class_mobility_direction: 'upward',
      family_structure: 'nuclear', sibling_position: 'eldest', relationship_status: 'married',
      platform_primary: 'Instagram', follower_tier: 'mid-tier',
    }));
    const res = await request(app).post(`/api/v1/character-registry/characters/${id}/generate-section`)
      .set('Authorization', auth()).send({ section: 'demographics' });
    expect(res.status).toBe(200);
    expect(res.body.updated).not.toContain('platform_primary');
    const [row] = await q(`SELECT ${DEMO}, gender, age, sibling_count, has_children FROM registry_characters WHERE id = :id`, { id });
    expect(row).toEqual({
      class_origin: 'working_class', current_class: 'upper_middle', class_mobility_direction: 'ascending',
      family_structure: 'two_parents_intact', sibling_position: 'oldest', relationship_status: 'married',
      platform_primary: null, follower_tier: 'mid', current_city: 'echo_park',
      gender: 'Female', age: 25, sibling_count: 2, has_children: false,
    });

    // The schema it sends asks for the registry's values.
    const { system } = mockCreate.mock.calls[0][0];
    expect(system).toContain('"family_structure": "ENUM — must be one of: two_parents_intact, single_mother,');
    expect(system).toContain('"platform_primary": "ENUM, how they are present online, not a platform name — must be one of: lalaverse_main,');
    expect(system).not.toMatch(/nuclear, single parent|eldest, middle|nano, micro, mid-tier/);
  });

  it('backfill-sections reads an old class word and an old city as the registry does', async () => {
    const id = await seedCharacter(`Vocab Backfill ${TAG}`);
    mockCreate.mockImplementation(async ({ system }) => (system?.includes('filling in missing profile sections')
      ? text({ class_origin: 'destitute', current_city: 'Velour City' })
      : text('[]')));
    const res = await request(app).post(`/api/v1/character-registry/characters/${id}/backfill-sections`).set('Authorization', auth());
    expect(res.status).toBe(200);
    const [row] = await q('SELECT class_origin, current_city FROM registry_characters WHERE id = :id', { id });
    expect(row).toEqual({ class_origin: 'poverty', current_city: 'echo_park' });
  });

  it('/generate-batch asks for the registry\'s values, counts the roster by them, and checks a poverty origin\'s coherence', async () => {
    await seedCharacter(`Vocab Single ${TAG}`, { family_structure: 'single_mother', class_origin: 'poverty' });
    await seedCharacter(`Vocab Foster ${TAG}`, { family_structure: 'foster_or_adopted' });
    mockCreate.mockResolvedValue(text([{ name: `Vocab Batch ${TAG}`, class_origin: 'poverty', money_behavior_pattern: 'performs_wealth' }]));
    const res = await request(app).post('/api/v1/character-generator/generate-batch').set('Authorization', auth()).send({ batch_size: 1 });
    expect(res.status).toBe(200);

    const { system } = mockCreate.mock.calls[0][0];
    expect(system).toContain('family_structure ENUM: two_parents_intact | single_mother | single_father');
    expect(system).toContain('class_origin     ENUM: poverty | working_class | lower_middle | middle_class');
    expect(system).toContain('lalaverse_main | multi_platform | live_first | archive_heavy');
    expect(system).not.toMatch(/two_parent_stable|working_poor|instagram \| tiktok|partnered/);

    // The roster holds a single mother, a foster child and a poverty origin: none is a gap.
    const { gaps } = res.body.demographic_snapshot;
    expect(gaps.filter((g) => /single parent|fostered|poverty|destitute/.test(g))).toEqual([]);
    expect(res.body.coherence_warnings.map((w) => w.rule)).toContain('poverty_performs_wealth');
  });
});
