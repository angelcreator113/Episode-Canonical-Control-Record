/**
 * The Feed scheduler gives a LalaVerse creator it makes a place on the DREAM
 * map, as /generate and bulk import do (services/feedHomeLocation): a
 * signature venue in its city, and the city's other venues as places it
 * frequents. It made them with none.
 *
 * The AI is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const db = require('../../src/models');
const { generateAndSaveProfile } = require('../../src/services/feedScheduler');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: db.sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => db.sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });

const TAG = crypto.randomUUID().slice(0, 8);
const spark = (n, extra = {}) => ({
  handle: `@schedtest${TAG}${n}`, platform: 'instagram', vibe_sentence: 'Sunrise reformer classes.',
  archetype: 'the_peer', follower_tier: 'micro', ...extra,
});
const made = async (id) => (await q('SELECT city, home_location_id, frequent_venues FROM social_profiles WHERE id = :id', { id }))[0];

(shouldSkip ? describe.skip : describe)('the Feed scheduler gives a LalaVerse creator a home on the DREAM map', () => {
  let seedId;

  beforeAll(async () => {
    // One more of the city's venues, for the creator to frequent.
    ({ id: seedId } = await db.WorldLocation.create({
      name: `Sched Seed ${TAG} Cafe`, slug: `sched-seed-${TAG}-cafe`, location_type: 'venue', venue_type: 'cafe', city: 'Radiance Row',
    }));
  });

  afterAll(async () => {
    const like = `%schedtest${TAG}%`;
    await run('DELETE FROM social_profile_followers WHERE social_profile_id IN (SELECT id FROM social_profiles WHERE handle LIKE :like)', { like });
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like });
    await run('DELETE FROM world_locations WHERE name LIKE :name', { name: `%${TAG}%` });
  });

  beforeEach(() => mockCreate.mockReset());

  it('a LalaVerse creator gets its signature venue in its city, and frequents the city\'s venues', async () => {
    mockCreate.mockResolvedValue(reply({ display_name: `Sched Home ${TAG}`, content_category: 'fitness' }));
    const profile = await generateAndSaveProfile(db, spark('a', { city: 'radiance_row' }), 'lalaverse');
    const row = await made(profile.id);
    expect(row.city).toBe('radiance_row');

    const [home] = await q('SELECT name, city, location_type, venue_type FROM world_locations WHERE id = :id', { id: row.home_location_id });
    expect(home).toEqual({ name: `Sched Home ${TAG}'s Gym`, city: 'Radiance Row', location_type: 'venue', venue_type: 'gym' });

    // Its home first, then up to three of the city's other venues.
    expect(row.frequent_venues[0]).toBe(row.home_location_id);
    const others = row.frequent_venues.slice(1);
    expect(others.length).toBeGreaterThanOrEqual(1);
    expect(await q('SELECT DISTINCT city, location_type FROM world_locations WHERE id IN (:ids)', { ids: others }))
      .toEqual([{ city: 'Radiance Row', location_type: 'venue' }]);
  });

  it('a real-world creator gets none', async () => {
    mockCreate.mockResolvedValue(reply({ display_name: `Sched Real ${TAG}`, content_category: 'fitness' }));
    const profile = await generateAndSaveProfile(db, spark('r'), 'real_world');
    expect(await made(profile.id)).toEqual({ city: null, home_location_id: null, frequent_venues: [] });
  });

  it('a LalaVerse spark with no city still gets no city, so no home', async () => {
    mockCreate.mockResolvedValue(reply({ display_name: `Sched None ${TAG}`, content_category: 'fitness' }));
    const profile = await generateAndSaveProfile(db, spark('n'), 'lalaverse');
    expect(await made(profile.id)).toEqual({ city: null, home_location_id: null, frequent_venues: [] });
  });
});
