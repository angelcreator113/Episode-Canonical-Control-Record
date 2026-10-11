/**
 * Lala's profile column on the Feed page (Task #2747): her profile through
 * her registry link, her portrait, the show's home city, her career level
 * and the LalaVerse profiles she knows directly. Every value is the data's
 * own, or null.
 */
jest.unmock('uuid');

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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Lala\'s Feed profile column (Task #2747)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: uuid(), bare: uuid(), reg: uuid(), rc: uuid() };
  const profiles = {};
  let token;

  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
  const profile = async (key, handle, display, layer, rel) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lala_relationship, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :display, :layer, :rel, NOW(), NOW()) RETURNING id`, { handle, display, layer, rel });
    profiles[key] = row.id;
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-lala-feed', email: 'evoni@lala-feed.dev', name: 'Lala Feed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
      VALUES (:show, :name, :slug, CAST(:meta AS jsonb), NOW(), NOW())`,
    { show: ids.show, name: `Feed ${tag}`, slug: `feed-${tag}`, meta: JSON.stringify({ lala_home: { address: '246 Olddy Paveway Ln', neighbourhood: null, city: 'Echo Park' } }) });
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:bare, :name, :slug, NOW(), NOW())`,
      { bare: ids.bare, name: `Bare ${tag}`, slug: `bare-${tag}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
      VALUES (:id, :show, 'lala', 0, 3, 0, 0, 0, NOW(), NOW())`, { id: uuid(), show: ids.show });

    await profile('lala', `lala-${tag}`, 'Lala', 'lalaverse', null);
    await profile('friendA', `aaa-friend-a-${tag}`, `AAA Friend A ${tag}`, 'lalaverse', 'direct');
    await profile('friendB', `aaa-friend-b-${tag}`, `AAA Friend B ${tag}`, 'lalaverse', 'direct');
    await profile('aware', `aaa-aware-${tag}`, `AAA Aware ${tag}`, 'lalaverse', 'aware');
    await profile('realWorld', `aaa-real-${tag}`, `AAA Real ${tag}`, 'real_world', 'direct');

    // Lala's registry character links her profile; it is the newest, so it is hers here.
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Lala feed registry', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, portrait_url, created_at, updated_at)
      VALUES (:rc, :reg, 'lala', 'Lala', :feed, 'https://example.test/lala.png', NOW(), NOW() + INTERVAL '1 day')`, { ...ids, feed: profiles.lala });
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE id = :rc', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(profiles) });
    await run('DELETE FROM character_state WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id IN (:show, :bare)', ids);
  });

  it('needs a signed-in user and a show id', async () => {
    expect((await request(app).get(`/api/v1/social-profiles/lala?show_id=${ids.show}`)).status).toBe(401);
    expect((await get('/api/v1/social-profiles/lala?show_id=nope')).status).toBe(400);
  });

  it('reads each value from its owner', async () => {
    const res = await get(`/api/v1/social-profiles/lala?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.profile).toMatchObject({ id: profiles.lala, handle: `lala-${tag}` });
    expect(d.portrait_url).toBe('https://example.test/lala.png');
    expect(d.home_city).toBe('Echo Park');
    expect(d.career).toEqual({ tier: 2, label: 'Rising' });
    // Friends: the LalaVerse profiles she knows directly; not her, not "aware", not real-world.
    const names = d.friends.list.map((p) => p.display_name);
    expect(names).toEqual(expect.arrayContaining([`AAA Friend A ${tag}`, `AAA Friend B ${tag}`]));
    expect(names).not.toContain(`AAA Aware ${tag}`);
    expect(names).not.toContain(`AAA Real ${tag}`);
    expect(d.friends.list.map((p) => p.id)).not.toContain(profiles.lala);
    expect(d.friends.total).toBeGreaterThanOrEqual(2);
  });

  it('?friends=all lists every friend, beyond the column\'s six (Task #2761)', async () => {
    const extra = [];
    for (let i = 0; i < 6; i += 1) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lala_relationship, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', 'direct', NOW(), NOW()) RETURNING id`, { handle: `aaa-more-${i}-${tag}`, display: `AAA More ${i} ${tag}` });
      extra.push(row.id); profiles[`more${i}`] = row.id;
    }
    const six = (await get(`/api/v1/social-profiles/lala?show_id=${ids.show}`)).body.data.friends;
    const all = (await get(`/api/v1/social-profiles/lala?show_id=${ids.show}&friends=all`)).body.data.friends;
    expect(six.list).toHaveLength(6);
    expect(all.list.length).toBe(Math.min(all.total, 200));
    expect(all.list.map((p) => p.id)).toEqual(expect.arrayContaining([...extra, profiles.friendA, profiles.friendB]));
    expect(all.list[0]).toHaveProperty('handle');
  });

  it('a show with no home city and no state says so with nulls', async () => {
    const d = (await get(`/api/v1/social-profiles/lala?show_id=${ids.bare}`)).body.data;
    expect(d.home_city).toBeNull();
    expect(d.career).toBeNull();
  });
});
