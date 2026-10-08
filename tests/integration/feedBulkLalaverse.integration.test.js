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
const PROFILE = { display_name: 'Bulk Test', archetype: 'the_peer', current_trajectory: 'rising', follower_tier: 'micro' };
const stored = async (h) => (await q('SELECT city, lala_relationship, career_pressure, feed_layer FROM social_profiles WHERE handle IN (:h, :at)', { h, at: `@${h}` }))[0];

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
  });
});
