/**
 * Fix 4 of the world-level audit (Evoni, 2026-10-18):
 * - the location lists the event generator, the Story Engine and the
 *   episode pitches read put a character's own places first, then a city's,
 *   and real venues before a Feed creator's own studio;
 * - "Seed Infrastructure" turns a "Lala's Penthouse" it made before into
 *   Lala's Home in Echo Park, keeping a field Evoni changed;
 * - with a home already at her address (the one "Fill in Lala's home" makes
 *   for her home and closet scene sets), it makes no second one.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { pickLocations } = require('../../src/services/locationPicks');
const { renameOldLalaHome, homeAtAddress, OLD_LALA_HOME, LALAS_HOME } = require('../../src/services/lalaHomeLocation');

const { sequelize, WorldLocation } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('location picks and Lala\'s Home', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const city = `Picktown ${tag}`;
  const loc = {};
  let profile;

  beforeAll(async () => {
    const make = (key, extra) => WorldLocation.create({ name: `${key} ${tag}`, slug: `${key}-${tag}`, location_type: 'venue', city, ...extra }).then((r) => { loc[key] = r.id; });
    await make('A Studio', {});
    await make('B Lounge', {});
    await make('C Bar', {});
    await make('Theirs', { city: 'Elsewhere', associated_characters: [`mira-${tag}`] });
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, home_location_id, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'lalaverse', :home, NOW(), NOW()) RETURNING id`, { h: `pick${tag}`, home: loc['A Studio'] });
    profile = p.id;
  });

  afterAll(async () => {
    await run('DELETE FROM social_profiles WHERE id = :profile', { profile });
    await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: Object.values(loc) });
    await run("DELETE FROM world_locations WHERE slug IN ('lala-s-penthouse', 'lala-s-home') AND street_address LIKE :t", { t: `%${tag}%` });
    await sequelize.close();
  });

  it('a city\'s real venues come before a creator\'s own studio; a character\'s own places come first', async () => {
    const inCity = (await pickLocations(models, { limit: 3, city })).map((l) => l.name);
    expect(inCity).toEqual([`B Lounge ${tag}`, `C Bar ${tag}`, `A Studio ${tag}`]);
    const theirs = await pickLocations(models, { limit: 2, city, characterKey: `mira-${tag}` });
    expect(theirs.map((l) => l.name)).toEqual([`Theirs ${tag}`, `B Lounge ${tag}`]);
  });

  it('the old penthouse becomes Lala\'s Home; a field Evoni changed stays', async () => {
    // A shared test database could hold a seeded one already; this test needs neither.
    const [[existing]] = await run("SELECT COUNT(*)::int AS n FROM world_locations WHERE slug IN ('lala-s-penthouse', 'lala-s-home') OR LOWER(TRIM(street_address)) = LOWER(:a)", { a: LALAS_HOME.street_address });
    if (existing.n) return;
    const street = `My own street ${tag}`;
    const row = await WorldLocation.create({ ...OLD_LALA_HOME.fields, slug: OLD_LALA_HOME.slug, location_type: 'property', street_address: street });
    expect(await renameOldLalaHome(WorldLocation)).toBeTruthy();
    await row.reload();
    expect(row).toMatchObject({ slug: 'lala-s-home', name: 'Lala\'s Home', city: 'Echo Park', district: null, property_type: null, street_address: street,
      description: 'Lala\'s home in Echo Park, at 246 Olddy Paveway Ln.' });
    expect(await renameOldLalaHome(WorldLocation)).toBeNull();
  });

  it('with a home already at her address (her scene sets\' one), no second Lala\'s Home and the penthouse is left', async () => {
    const [[existing]] = await run("SELECT COUNT(*)::int AS n FROM world_locations WHERE slug IN ('lala-s-penthouse', 'lala-s-home') OR LOWER(TRIM(street_address)) = LOWER(:a)", { a: LALAS_HOME.street_address });
    if (existing.n) return;
    const house = await WorldLocation.create({ name: 'Lala\'s home', location_type: 'interior', street_address: ` ${LALAS_HOME.street_address} `, city: 'Echo Park', metadata: { source: 'lala_home', tag } });
    const old = await WorldLocation.create({ ...OLD_LALA_HOME.fields, slug: OLD_LALA_HOME.slug, location_type: 'property' });
    try {
      expect((await homeAtAddress(WorldLocation)).id).toBe(house.id);
      expect(await renameOldLalaHome(WorldLocation)).toBeNull();
      await old.reload();
      expect(old.name).toBe('Lala\'s Penthouse');
    } finally {
      await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: [house.id, old.id] });
    }
  });
});
