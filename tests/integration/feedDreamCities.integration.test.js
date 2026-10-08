/**
 * The LalaVerse Feed is in the five DREAM cities. The July unification
 * (migration 20260725000000-unify-dream-cities) renamed the old five, but
 * the Feed scheduler kept offering them (nova_prime, velour_city, the_drift,
 * solenne, cascade_row), so every LalaVerse profile it made since carried
 * one. Now the scheduler offers the DREAM cities, an old name is read as
 * July mapped it (utils/feedCities), and migration
 * 20261008140000-feed-profiles-dream-cities renames the stored ones.
 *
 * The AI is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');
const { generateSmartSparks, generateAndSaveProfile } = require('../../src/services/feedScheduler');
const migration = require('../../src/migrations/20261008140000-feed-profiles-dream-cities');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptOf = (call) => call[0].messages[0].content;

const DREAM = ['dazzle_district', 'radiance_row', 'echo_park', 'ascent_tower', 'maverick_harbor'];
const OLD = /nova.prime|velour.city|the.drift|solenne|cascade.row/i;
const TAG = crypto.randomUUID().slice(0, 8);
const handle = (n) => `@citytest${TAG}${n}`;
const storedCity = async (h) => (await q('SELECT city FROM social_profiles WHERE handle = :h', { h }))[0]?.city;
const PROFILE = { display_name: 'City Test', follower_tier: 'micro', archetype: 'the_peer', current_trajectory: 'rising' };

(shouldSkip ? describe.skip : describe)('the LalaVerse Feed is in the DREAM cities', () => {
  let token;

  const create = (h, extra = {}) => db.SocialProfile.create({ handle: h, platform: 'instagram', vibe_sentence: 'City test creator', status: 'generated', feed_layer: 'lalaverse', ...extra });

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-feed-dream-cities', email: 'test@feed-dream-cities.dev', name: 'Feed DREAM Cities Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    const like = `@citytest${TAG}%`;
    const mine = 'SELECT id FROM social_profiles WHERE handle LIKE :like';
    await run(`DELETE FROM social_profile_followers WHERE social_profile_id IN (${mine})`, { like });
    await run('DELETE FROM world_locations WHERE id IN (SELECT home_location_id FROM social_profiles WHERE handle LIKE :like)', { like });
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like });
  });

  beforeEach(() => mockCreate.mockReset());

  const generate = (body) => request(app).post('/api/v1/social-profiles/generate').set('Authorization', `Bearer ${token}`)
    .send({ platform: 'instagram', vibe_sentence: 'Posts from the city at night.', feed_layer: 'lalaverse', ...body });

  it('the scheduler offers the DREAM cities, and reads a spark\'s old city as July\'s mapping does', async () => {
    mockCreate.mockResolvedValue(reply([
      { handle: handle('sparka'), platform: 'tiktok', vibe_sentence: 'Runway rat.', archetype: 'the_watcher', follower_tier: 'micro', city: 'nova_prime' },
      { handle: handle('sparkb'), platform: 'instagram', vibe_sentence: 'Club diarist.', archetype: 'the_peer', follower_tier: 'mid', city: 'Echo Park' },
      { handle: handle('sparkc'), platform: 'youtube', vibe_sentence: 'Nowhere native.', archetype: 'the_peer', follower_tier: 'mid', city: 'gotham' },
    ]));
    const sparks = await generateSmartSparks(db, 'lalaverse', 3);
    const byHandle = Object.fromEntries(sparks.map((s) => [s.handle, s.city]));
    expect(byHandle[handle('sparka')]).toBe('dazzle_district');
    expect(byHandle[handle('sparkb')]).toBe('echo_park');
    expect(DREAM).toContain(byHandle[handle('sparkc')]);

    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain(`city (one of: ${DREAM.join(', ')})`);
    expect(prompt).not.toMatch(OLD);
  });

  it('a profile the scheduler saves from an old-city spark is in its DREAM city', async () => {
    mockCreate.mockResolvedValue(reply(PROFILE));
    const profile = await generateAndSaveProfile(db, { handle: handle('sched'), platform: 'instagram', vibe_sentence: 'Club diarist.', city: 'velour_city' }, 'lalaverse');
    expect(profile.city).toBe('echo_park');
    expect(await storedCity(handle('sched'))).toBe('echo_park');
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain('LALAVERSE: Lives in echo park — Entertainment & nightlife hub.');
    expect(prompt).not.toMatch(OLD);
  });

  it('/generate saves an old city as its DREAM city, and refuses a city that is not one', async () => {
    mockCreate.mockResolvedValue(reply(PROFILE));
    const ok = await generate({ handle: handle('gen'), city: 'nova_prime' });
    expect(ok.status).toBe(200);
    expect(await storedCity(handle('gen'))).toBe('dazzle_district');
    expect(promptOf(mockCreate.mock.calls[0])).toContain('This creator lives in dazzle district — Fashion capital of the LalaVerse.');

    mockCreate.mockClear();
    const refused = await generate({ handle: handle('nowhere'), city: 'gotham' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe(`city must be one of the DREAM cities: ${DREAM.join(', ')}`);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await storedCity(handle('nowhere'))).toBeUndefined();
  });

  it('regenerate reads a profile\'s old city as its DREAM city', async () => {
    const before = await create(handle('regen'), { city: 'solenne' });
    mockCreate.mockResolvedValue(reply(PROFILE));
    const res = await request(app).post(`/api/v1/social-profiles/${before.id}/regenerate`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain('This creator lives in radiance row — Beauty & wellness heartland.');
    expect(prompt).not.toMatch(OLD);
  });

  it('the migration renames the old cities as July did and leaves the rest', async () => {
    const rows = [
      ['nova', 'nova_prime', 'dazzle_district'],
      ['solenne', 'solenne', 'radiance_row'],
      ['velour', 'velour_city', 'echo_park'],
      ['cascade', 'cascade_row', 'ascent_tower'],
      ['drift', 'the_drift', 'maverick_harbor'],
      ['dream', 'echo_park', 'echo_park'],
    ];
    for (const [n, city] of rows) await create(handle(`mig${n}`), { city });
    await create(handle('mignone'));
    const deleted = await create(handle('migdeleted'), { city: 'the_drift' });
    await deleted.destroy();

    await migration.up(sequelize.getQueryInterface());
    for (const [n, , to] of rows) expect(await storedCity(handle(`mig${n}`))).toBe(to);
    expect(await storedCity(handle('mignone'))).toBeNull();
    // As July's, every row, a deleted one too.
    expect(await storedCity(handle('migdeleted'))).toBe('maverick_harbor');

    // Running it again changes nothing; down changes nothing.
    await migration.up(sequelize.getQueryInterface());
    await migration.down(sequelize.getQueryInterface());
    for (const [n, , to] of rows) expect(await storedCity(handle(`mig${n}`))).toBe(to);
  });
});
