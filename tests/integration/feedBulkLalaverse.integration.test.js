/**
 * The Feed's bulk import makes LalaVerse creators as /generate does. It
 * built them from the real-world prompt alone: no city (saved empty), no
 * relationship to Lala or career position, nothing telling the AI the
 * creator lives in Lala's world and knows nothing of JustAWoman, and no
 * Show Bible. Now a bulk LalaVerse creator gets the LalaVerse context, the
 * DREAM city the AI picks for it (utils/feedCities), and the Show Bible.
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
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptOf = (call) => call[0].messages[0].content;

const DREAM = ['dazzle_district', 'radiance_row', 'echo_park', 'ascent_tower', 'maverick_harbor'];
const TAG = crypto.randomUUID().slice(0, 8);
const handle = (n) => `bulktest${TAG}${n}`;
// Named for this run: a LalaVerse creator's signature venue carries its name.
const PROFILE = { display_name: `Bulk Test ${TAG}`, archetype: 'the_peer', current_trajectory: 'rising', follower_tier: 'micro' };
const stored = async (h) => (await q('SELECT city, lala_relationship, career_pressure, feed_layer FROM social_profiles WHERE handle IN (:h, :at)', { h, at: `@${h}` }))[0];
const row = async (h, cols) => (await q(`SELECT ${cols} FROM social_profiles WHERE handle IN (:h, :at)`, { h, at: `@${h}` }))[0];
// The relationships a creator's known associates made, by target handle.
const links = (h) => q(
  `SELECT t.handle AS target, r.relationship_type, r.drama_level, r.auto_generated
     FROM social_profile_relationships r
     JOIN social_profiles s ON s.id = r.source_profile_id
     JOIN social_profiles t ON t.id = r.target_profile_id
    WHERE s.handle IN (:h, :at) ORDER BY r.id`, { h, at: `@${h}` });

(shouldSkip ? describe.skip : describe)('bulk import makes LalaVerse creators as /generate does', () => {
  let token;
  let ruleId;
  const RULE = `Bulk test rule ${TAG}`;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-feed-bulk-lalaverse', email: 'test@feed-bulk-lalaverse.dev', name: 'Feed Bulk LalaVerse Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    // One Show Bible rule in every prompt, the franchise's own.
    [{ id: ruleId }] = await q(
      `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, source_document, status, scope, show_id, created_at, updated_at)
       VALUES (:title, 'Every city has its own weather.', 'franchise_law', 'critical', true, 'bulk-test', 'active', 'franchise', NULL, NOW(), NOW())
       RETURNING id`, { title: RULE });
  });

  afterAll(async () => {
    const like = `%bulktest${TAG}%`;
    await run('DELETE FROM social_profile_followers WHERE social_profile_id IN (SELECT id FROM social_profiles WHERE handle LIKE :like)', { like });
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like });
    await run('DELETE FROM world_locations WHERE name LIKE :name', { name: `%${TAG}%` });
    await run('DELETE FROM franchise_knowledge WHERE id = :id', { id: ruleId });
  });

  beforeEach(() => mockCreate.mockReset());

  // One at a time, so each creator gets the reply stubbed for it.
  const bulk = (feedLayer, creators) => request(app).post('/api/v1/social-profiles/bulk/generate')
    .set('Authorization', `Bearer ${token}`).send({ feed_layer: feedLayer, creators, concurrency: 1 });

  it('a LalaVerse creator gets the LalaVerse context, the DREAM city the AI picks, and the Show Bible', async () => {
    const before = (await q('SELECT injection_count FROM franchise_knowledge WHERE id = :id', { id: ruleId }))[0].injection_count || 0;
    mockCreate.mockResolvedValue(reply({ ...PROFILE, city: 'Echo Park' }));
    const res = await bulk('lalaverse', [{ handle: handle('a'), platform: 'instagram', vibe_sentence: 'Club diarist who posts at 3am.' }]);
    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe('success');
    expect(await stored(handle('a'))).toEqual({ city: 'echo_park', lala_relationship: 'mutual_unaware', career_pressure: 'level', feed_layer: 'lalaverse' });

    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain('LALAVERSE CONTEXT:');
    expect(prompt).toContain('Pick the one their content fits, and return its key as "city"');
    for (const key of DREAM) expect(prompt).toContain(`- ${key}: `);
    expect(prompt).toContain('Do not reference JustAWoman or the real world in any generated content.');
    expect(prompt).toContain('SHOW BIBLE: ALWAYS TRUE');
    expect(prompt).toContain(`${RULE}: Every city has its own weather.`);
    const after = (await q('SELECT injection_count FROM franchise_knowledge WHERE id = :id', { id: ruleId }))[0].injection_count;
    expect(after).toBe(before + 1);
  });

  it('an old city the AI gives reads as July mapped it; none, or one that is not a city, gets one at random', async () => {
    mockCreate.mockResolvedValueOnce(reply({ ...PROFILE, city: 'velour_city' }))
      .mockResolvedValueOnce(reply({ ...PROFILE, city: 'gotham' }))
      .mockResolvedValueOnce(reply(PROFILE));
    const res = await bulk('lalaverse', [
      { handle: handle('b'), platform: 'tiktok', vibe_sentence: 'Old city.' },
      { handle: handle('c'), platform: 'tiktok', vibe_sentence: 'Not a city.' },
      { handle: handle('d'), platform: 'tiktok', vibe_sentence: 'No city.' },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.summary.succeeded).toBe(3);
    expect((await stored(handle('b'))).city).toBe('echo_park');
    expect(DREAM).toContain((await stored(handle('c'))).city);
    expect(DREAM).toContain((await stored(handle('d'))).city);
  });

  it('a real-world creator gets none of it', async () => {
    mockCreate.mockResolvedValue(reply({ ...PROFILE, city: 'echo_park' }));
    const res = await bulk('real_world', [{ handle: handle('r'), platform: 'youtube', vibe_sentence: 'Real-world creator.' }]);
    expect(res.status).toBe(200);
    expect(await stored(handle('r'))).toEqual({ city: null, lala_relationship: null, career_pressure: null, feed_layer: 'real_world' });
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).not.toContain('LALAVERSE CONTEXT');
    expect(prompt).not.toContain('SHOW BIBLE');
    expect((await row(handle('r'), 'home_location_id')).home_location_id).toBeNull();
  });

  it('a bulk creator saves every field /generate saves (utils/generatedProfileFields)', async () => {
    mockCreate.mockResolvedValue(reply({
      ...PROFILE, follower_tier: 'nano', content_category: 'beauty', age_range: '25-34', geographic_base: 'Atlanta',
      platform_metrics: { avg_views: 12000 }, revenue_streams: ['brand deals'], creator_name: 'Bea Tester', world_exists: true,
    }));
    const res = await bulk('real_world', [{ handle: handle('f'), platform: 'instagram', vibe_sentence: 'Skincare at dawn.' }]);
    expect(res.status).toBe(200);
    expect(await row(handle('f'), 'follower_tier, content_category, age_range, geographic_base, platform_metrics, revenue_streams, creator_name, world_exists, generation_model')).toEqual({
      follower_tier: 'mid', // 'nano' is not a tier
      content_category: 'beauty',
      age_range: '25-34',
      geographic_base: 'Atlanta',
      platform_metrics: { avg_views: 12000 },
      revenue_streams: ['brand deals'],
      creator_name: 'Bea Tester',
      world_exists: true,
      generation_model: 'claude-sonnet-4-6',
    });
  });

  it('a LalaVerse bulk creator gets a home on the DREAM map, as /generate gives one (services/feedHomeLocation)', async () => {
    mockCreate.mockResolvedValue(reply({ ...PROFILE, display_name: `Home Test ${TAG}`, content_category: 'beauty', city: 'echo_park' }));
    const res = await bulk('lalaverse', [{ handle: handle('h'), platform: 'tiktok', vibe_sentence: 'Glow salon owner.' }]);
    expect(res.status).toBe(200);
    const made = await row(handle('h'), 'home_location_id, frequent_venues');
    expect(made.home_location_id).toBeTruthy();
    const [home] = await q('SELECT name, city, location_type, venue_type FROM world_locations WHERE id = :id', { id: made.home_location_id });
    expect(home).toEqual({ name: `Home Test ${TAG}'s Studio`, city: 'Echo Park', location_type: 'venue', venue_type: 'salon' });
    expect(made.frequent_venues[0]).toBe(made.home_location_id);
  });

  it('/generate still gives its LalaVerse creator a home, through the same helper', async () => {
    mockCreate.mockResolvedValue(reply({ ...PROFILE, display_name: `Gen Home ${TAG}`, content_category: 'fashion' }));
    const res = await request(app).post('/api/v1/social-profiles/generate').set('Authorization', `Bearer ${token}`)
      .send({ handle: handle('g'), platform: 'instagram', vibe_sentence: 'Runway diarist.', feed_layer: 'lalaverse', city: 'dazzle_district' });
    expect(res.status).toBe(200);
    const made = await row(handle('g'), 'home_location_id, content_category');
    expect(made.content_category).toBe('fashion');
    const [home] = await q('SELECT name, city, venue_type FROM world_locations WHERE id = :id', { id: made.home_location_id });
    expect(home).toEqual({ name: `Gen Home ${TAG}'s Showroom`, city: 'Dazzle District', venue_type: 'boutique' });
  });

  it('a bulk creator\'s known associates are linked to the profiles that exist, as /generate links them', async () => {
    mockCreate.mockResolvedValueOnce(reply(PROFILE))
      .mockResolvedValueOnce(reply({ ...PROFILE, known_associates: [
        { handle: `@${handle('x')}`, relationship_type: 'rival', drama_level: 7 },
        { handle: `@bulktest${TAG}_`, relationship_type: 'collab' }, // an _ is not a wildcard
        { handle: '@nobody-by-this-handle', relationship_type: 'ex' },
      ] }));
    const res = await bulk('real_world', [
      { handle: handle('x'), platform: 'instagram', vibe_sentence: 'Launched first.' },
      { handle: handle('y'), platform: 'instagram', vibe_sentence: 'Launched the same week.' },
    ]);
    expect(res.body.summary.succeeded).toBe(2);
    expect(await links(handle('y'))).toEqual([{ target: handle('x'), relationship_type: 'rival', drama_level: 7, auto_generated: true }]);
  });

  it('/generate links an associate that bulk import saved without its @', async () => {
    mockCreate.mockResolvedValueOnce(reply(PROFILE))
      .mockResolvedValueOnce(reply({ ...PROFILE, known_associates: [{ handle: `@${handle('k')}`, relationship_type: 'bestie', drama_level: 2 }] }));
    await bulk('real_world', [{ handle: handle('k'), platform: 'tiktok', vibe_sentence: 'Saved without its @.' }]);
    expect((await row(handle('k'), 'handle')).handle).toBe(handle('k'));
    const res = await request(app).post('/api/v1/social-profiles/generate').set('Authorization', `Bearer ${token}`)
      .send({ handle: handle('z'), platform: 'tiktok', vibe_sentence: 'Names a friend.', feed_layer: 'real_world' });
    expect(res.status).toBe(200);
    expect(await links(handle('z'))).toEqual([{ target: handle('k'), relationship_type: 'bestie', drama_level: 2, auto_generated: true }]);
  });
});
