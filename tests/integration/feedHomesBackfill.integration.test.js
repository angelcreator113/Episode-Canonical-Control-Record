/**
 * The one-time backfill (scripts/backfill-feed-homes.js, services/
 * feedHomeLocation backfillHomeLocations) gives each LalaVerse creator with
 * a city and no home what /generate gives one: its signature venue in its
 * city, and the city's other venues to frequent. The Feed scheduler and
 * bulk import made creators without one until #2764 and #2762.
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');
const db = require('../../src/models');
const { backfillHomeLocations } = require('../../src/services/feedHomeLocation');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: db.sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => db.sequelize.query(sql, { replacements });

const TAG = crypto.randomUUID().slice(0, 8);
const nameOf = (n) => `Home Fill ${TAG} ${n}`;
const make = (n, extra = {}) => db.SocialProfile.create({
  handle: `@homefill${TAG}${n}`, platform: 'instagram', vibe_sentence: 'Backfill test creator.',
  feed_layer: 'lalaverse', display_name: nameOf(n), content_category: 'beauty', ...extra,
});
const home = async (id) => (await q('SELECT home_location_id, frequent_venues FROM social_profiles WHERE id = :id', { id }))[0];
const venue = async (id) => (await q('SELECT name, city, location_type, venue_type FROM world_locations WHERE id = :id', { id }))[0];

(shouldSkip ? describe.skip : describe)('the one-time backfill gives LalaVerse creators a home on the DREAM map', () => {
  const p = {};
  let oldHomeId;

  beforeAll(async () => {
    ({ id: oldHomeId } = await db.WorldLocation.create({
      name: `${nameOf('c')}'s Old Place`, slug: `home-fill-${TAG}-old`, location_type: 'venue', venue_type: 'cafe', city: 'Echo Park',
    }));
    p.a = await make('a', { city: 'echo_park' });
    p.b = await make('b', { city: 'dazzle_district', content_category: 'fashion' });
    p.c = await make('c', { city: 'echo_park', home_location_id: oldHomeId });
    p.d = await make('d');
    p.r = await make('r', { feed_layer: 'real_world' });
  });

  afterAll(async () => {
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like: `@homefill${TAG}%` });
    await run('DELETE FROM world_locations WHERE name LIKE :like', { like: `%${TAG}%` });
  });

  const ids = () => Object.values(p).map((x) => x.id);

  it('a dry run lists the LalaVerse creators with a city and no home, and writes nothing', async () => {
    const { total, results } = await backfillHomeLocations(db, { dryRun: true, ids: ids() });
    expect(total).toBe(2);
    expect(results).toEqual([
      { id: p.a.id, handle: p.a.handle, city: 'echo_park', status: 'would_assign' },
      { id: p.b.id, handle: p.b.handle, city: 'dazzle_district', status: 'would_assign' },
    ]);
    expect(await home(p.a.id)).toEqual({ home_location_id: null, frequent_venues: [] });
    expect(await q("SELECT id FROM world_locations WHERE name LIKE :like AND name NOT LIKE '%Old Place'", { like: `%${TAG}%` })).toEqual([]);
  });

  it('the backfill gives each its signature venue in its city, first among the venues it frequents', async () => {
    const { results } = await backfillHomeLocations(db, { ids: ids() });
    expect(results.map((r) => [r.id, r.status, r.home_name])).toEqual([
      [p.a.id, 'assigned', `${nameOf('a')}'s Studio`],
      [p.b.id, 'assigned', `${nameOf('b')}'s Showroom`],
    ]);
    const a = await home(p.a.id);
    expect(await venue(a.home_location_id)).toEqual({ name: `${nameOf('a')}'s Studio`, city: 'Echo Park', location_type: 'venue', venue_type: 'salon' });
    expect(a.frequent_venues[0]).toBe(a.home_location_id);
    const b = await home(p.b.id);
    expect(await venue(b.home_location_id)).toEqual({ name: `${nameOf('b')}'s Showroom`, city: 'Dazzle District', location_type: 'venue', venue_type: 'boutique' });
  });

  it('a creator with a home keeps it; one with no city, or the real world, gets none', async () => {
    expect((await home(p.c.id)).home_location_id).toBe(oldHomeId);
    expect(await home(p.d.id)).toEqual({ home_location_id: null, frequent_venues: [] });
    expect(await home(p.r.id)).toEqual({ home_location_id: null, frequent_venues: [] });
  });

  it('a second run does nothing', async () => {
    const before = await home(p.a.id);
    expect(await backfillHomeLocations(db, { ids: ids() })).toEqual({ total: 0, results: [] });
    expect(await home(p.a.id)).toEqual(before);
  });

  it('the script lists on --dry-run, and with --yes gives the home', async () => {
    const e = await make('e', { city: 'radiance_row', content_category: 'fitness' });
    const script = path.join(__dirname, '../../scripts/backfill-feed-homes.js');
    const env = { ...process.env, NODE_ENV: 'test' };
    const dry = execFileSync('node', [script, '--dry-run', '--ids', String(e.id)], { env, encoding: 'utf8' });
    expect(dry).toContain(`1 LalaVerse creator(s) with a city and no home; 1 this run.`);
    expect(dry).toContain(`#${e.id} ${e.handle} (radiance_row)`);
    expect(dry).toContain('Dry run: nothing written.');
    expect((await home(e.id)).home_location_id).toBeNull();

    const applied = execFileSync('node', [script, '--ids', String(e.id), '--yes'], { env, encoding: 'utf8' });
    expect(applied).toContain(`+ #${e.id} ${e.handle}: ${nameOf('e')}'s Gym`);
    expect(applied).toContain('Assigned: 1');
    expect(await venue((await home(e.id)).home_location_id)).toEqual({ name: `${nameOf('e')}'s Gym`, city: 'Radiance Row', location_type: 'venue', venue_type: 'gym' });
  });
});
