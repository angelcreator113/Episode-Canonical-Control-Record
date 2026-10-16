/**
 * New characters' follower facts agree (Character Consistency Engine step 5c),
 * with the Anthropic calls mocked.
 * - confirming a spark character's Feed proposal writes its whole-number count
 *   as the profile's label and tier, and as the starting row of the follower
 *   ledger; an old tier-word proposal invents no count;
 * - generating a profile keeps the count, the tier, full_profile and the
 *   primary platform presence in agreement (the tier read from the count);
 * - regenerating a profile with no character does the same;
 * - the spark prompt asks for a whole-number count in the six tiers.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('new characters: follower facts agree', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID() };
  const handle = (n) => `@newfacts${TAG}${n}`;
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const character = async (key) => {
    const id = crypto.randomUUID();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, created_at, updated_at)
      VALUES (:id, :reg, :key, :name, 'support', 'draft', NOW(), NOW())`, { id, reg: ids.reg, key: `newfacts-${key}-${TAG}`, name: `New ${key}` });
    return id;
  };
  const profileOf = async (h) => (await run('SELECT * FROM social_profiles WHERE handle = :h', { h }))[0][0];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-admin-newfacts', email: 'evoni@newfacts.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `NewFacts ${TAG}`, slug: `newfacts-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `NewFacts ${TAG}` });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    const like = `@newfacts${TAG}%`;
    const mine = 'SELECT id FROM social_profiles WHERE handle LIKE :like';
    await run(`DELETE FROM pulse_followers WHERE social_profile_id IN (${mine})`, { like });
    await run(`DELETE FROM character_entanglements WHERE profile_id IN (${mine})`, { like });
    await run(`DELETE FROM social_profile_followers WHERE social_profile_id IN (${mine})`, { like });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('confirm-feed: the proposed count is the label, the tier and the ledger start', async () => {
    const rc = await character('spark');
    const res = await as(request(app).post('/api/v1/character-generation/confirm-feed'))
      .send({ character_id: rc, feed_layer: 'lalaverse', feed_proposal: { handle: handle('spark'), display_name: 'Spark', follower_count: 2000000, starting_state: 'rising' } });
    expect(res.status).toBe(201);
    const p = await profileOf(handle('spark'));
    expect(p).toMatchObject({ follower_count_approx: '2M', follower_tier: 'mega' });
    const [[row]] = await run('SELECT cause, count_after, show_id FROM pulse_followers WHERE social_profile_id = :pid', { pid: p.id });
    expect(row).toMatchObject({ cause: 'start', count_after: 2000000, show_id: ids.show });
  });

  it('confirm-feed: an old tier-word proposal gives the tier and no invented count', async () => {
    const rc = await character('old');
    const res = await as(request(app).post('/api/v1/character-generation/confirm-feed'))
      .send({ character_id: rc, feed_layer: 'lalaverse', feed_proposal: { handle: handle('old'), display_name: 'Old', follower_range: 'micro (10k-100k)' } });
    expect(res.status).toBe(201);
    const p = await profileOf(handle('old'));
    expect(p).toMatchObject({ follower_count_approx: null, follower_tier: 'micro' });
    const [rows] = await run('SELECT id FROM pulse_followers WHERE social_profile_id = :pid', { pid: p.id });
    expect(rows).toHaveLength(0);
  });

  it('generate: the count, the tier, full_profile and the primary platform agree', async () => {
    mockCreate.mockResolvedValue(reply({
      display_name: 'Gen', follower_tier: 'micro', follower_count_approx: '1.2M followers', archetype: 'the_peer', current_trajectory: 'rising',
      platform_presences: { pulse: { handle: handle('gen'), followers: '800k', is_primary: true } },
    }));
    const res = await as(request(app).post('/api/v1/social-profiles/generate'))
      .send({ handle: handle('gen'), platform: 'instagram', vibe_sentence: 'Slow fashion.', feed_layer: 'real_world' });
    expect(res.status).toBeLessThan(300);
    const p = await profileOf(handle('gen'));
    expect(p).toMatchObject({ follower_count_approx: '1.2M', follower_tier: 'mega' });
    expect(p.full_profile.follower_count_approx).toBe('1.2M');
    expect(p.full_profile.platform_presences.pulse.followers).toBe('1.2M');
  });

  it('regenerate with no character: the answer\'s count and tier agree', async () => {
    const [[p0]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, follower_tier, status, created_at, updated_at)
      VALUES (:h, 'instagram', 'Slow.', 'real_world', '5k', 'nano', 'generated', NOW(), NOW()) RETURNING id`, { h: handle('regen') });
    mockCreate.mockResolvedValue(reply({ display_name: 'Regen', follower_tier: 'mega', follower_count_approx: '47k', archetype: 'the_peer', current_trajectory: 'rising' }));
    const res = await as(request(app).post(`/api/v1/social-profiles/${p0.id}/regenerate`)).send({});
    expect(res.status).toBe(200);
    expect(await profileOf(handle('regen'))).toMatchObject({ follower_count_approx: '47k', follower_tier: 'micro' });
  });

  it('the spark prompt asks for a whole-number count in the six tiers', async () => {
    mockCreate.mockResolvedValue(reply({ handle: 'x', follower_count: 12000 }));
    await require('../../src/services/characterGenerationService').generateFeedProfile({ name: 'X', vibe: 'v', role: 'r', worldString: 'w', interior: {} });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('"follower_count": a whole number of followers');
    expect(prompt).toContain('mega 1,000,000+');
    expect(prompt).not.toContain('follower_range');
  });
});
