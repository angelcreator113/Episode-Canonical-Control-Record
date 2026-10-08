/**
 * The Feed also uses the Society tab's archetypes (Evoni's ruling,
 * 2026-10-08, "Feed also uses your 15"; the wiring map's fix-list item 26).
 * Each new LalaVerse Feed profile gets one of the Society tab's archetypes,
 * from the list Evoni saved there, in social_profiles.society_archetype,
 * beside the Feed's own ten; a real-world (JustAWoman's Feed) profile gets
 * none; the Feed's composition counts them.
 *
 * The AI is stubbed; the database is the local migrated test DB. The saved
 * list is this test's own, one archetype long so every pick is known, and
 * the list there before is put back afterwards.
 *
 * A registry character's profile and a confirmed proposal are not here:
 * they write social_profiles.registry_character_id, a registry id (UUID),
 * and the column is INTEGER in the migrations and in canon
 * (docs/CHARACTER_REGISTRY_READ.md §2.1), so neither insert succeeds on a
 * migrated database. Their archetype is pinned by
 * tests/unit/services/societyArchetypes.paths.test.js.
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

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptOf = (call) => call[0].messages[0].content;

const TAG = crypto.randomUUID().slice(0, 8);
const ONLY = `Society test ${TAG}: The Night Owl`;
const handle = (n) => `@soctest${TAG}${n}`;
const stored = async (h) => (await q('SELECT society_archetype FROM social_profiles WHERE handle = :h', { h }))[0]?.society_archetype;
const PROFILE = { display_name: 'Society Test', follower_tier: 'micro', archetype: 'the_peer', current_trajectory: 'rising' };

(shouldSkip ? describe.skip : describe)('the Feed also uses the Society tab\'s archetypes', () => {
  let token;
  let saved;

  const create = (h, extra = {}) => db.SocialProfile.create({ handle: h, platform: 'instagram', vibe_sentence: 'Society test creator', status: 'generated', feed_layer: 'lalaverse', ...extra });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-society-archetypes', email: 'test@society-archetypes.dev', name: 'Society Archetypes Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    [saved] = await q(`SELECT data FROM page_content WHERE page_name = 'influencer_systems' AND constant_key = 'ARCHETYPES'`);
    // As the Society tab saves it: the whole list, here Evoni's own edit.
    const list = JSON.stringify([{ num: '01', name: ONLY, icon: '🦉', content: 'Posts at 3am', audience: 'Insomniacs', narrative: 'Sees what others miss.' }]);
    await run(`INSERT INTO page_content (id, page_name, constant_key, data, created_at, updated_at)
               VALUES (gen_random_uuid(), 'influencer_systems', 'ARCHETYPES', CAST(:list AS jsonb), NOW(), NOW())
               ON CONFLICT (page_name, constant_key) DO UPDATE SET data = EXCLUDED.data`, { list });
  });

  afterAll(async () => {
    const mine = `SELECT id FROM social_profiles WHERE handle LIKE :like`;
    const like = `@soctest${TAG}%`;
    await run(`DELETE FROM social_profile_followers WHERE social_profile_id IN (${mine})`, { like });
    await run(`DELETE FROM world_locations WHERE id IN (SELECT home_location_id FROM social_profiles WHERE handle LIKE :like)`, { like });
    await run(`DELETE FROM social_profiles WHERE handle LIKE :like`, { like });
    if (saved) await run(`UPDATE page_content SET data = CAST(:data AS jsonb) WHERE page_name = 'influencer_systems' AND constant_key = 'ARCHETYPES'`, { data: JSON.stringify(saved.data) });
    else await run(`DELETE FROM page_content WHERE page_name = 'influencer_systems' AND constant_key = 'ARCHETYPES'`);
  });

  beforeEach(() => mockCreate.mockReset());

  const generate = (body) => request(app).post('/api/v1/social-profiles/generate').set('Authorization', `Bearer ${token}`)
    .send({ platform: 'instagram', vibe_sentence: 'Posts at 3am about the city.', ...body });

  it('a profile generated from a spark: the AI\'s pick from the saved list, as the list spells it', async () => {
    mockCreate.mockResolvedValue(reply({ ...PROFILE, society_archetype: `  society test ${TAG}: THE NIGHT OWL ` }));
    const res = await generate({ handle: handle('gen'), feed_layer: 'lalaverse', city: 'dazzle_district' });
    expect(res.status).toBe(200);
    expect(await stored(handle('gen'))).toBe(ONLY);
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain('SOCIETY ARCHETYPE: what the LalaVerse knows this creator for');
    expect(prompt).toContain(`- ${ONLY}: Posts at 3am`);
    // The defaults are not offered once Evoni has saved her own list.
    expect(prompt).not.toContain('The Main Character');
  });

  it('a pick off the list takes the least used; a real-world profile gets none, and no list', async () => {
    mockCreate.mockResolvedValue(reply({ ...PROFILE, society_archetype: 'polished_curator' }));
    expect((await generate({ handle: handle('off'), feed_layer: 'lalaverse', city: 'echo_park' })).status).toBe(200);
    expect(await stored(handle('off'))).toBe(ONLY);

    mockCreate.mockClear();
    mockCreate.mockResolvedValue(reply({ ...PROFILE, society_archetype: ONLY }));
    expect((await generate({ handle: handle('real') })).status).toBe(200);
    expect(await stored(handle('real'))).toBeNull();
    expect(promptOf(mockCreate.mock.calls[0])).not.toContain('SOCIETY ARCHETYPE');
  });

  it('regenerate keeps the archetype a profile has, and gives one to a profile made before', async () => {
    const kept = await create(handle('kept'), { society_archetype: 'The Old Name' });
    mockCreate.mockResolvedValue(reply({ ...PROFILE, society_archetype: ONLY }));
    const a = await request(app).post(`/api/v1/social-profiles/${kept.id}/regenerate`).set('Authorization', `Bearer ${token}`).send({});
    expect(a.status).toBe(200);
    expect(await stored(handle('kept'))).toBe('The Old Name');
    expect(promptOf(mockCreate.mock.calls[0])).toContain('SOCIETY ARCHETYPE: The Old Name');

    const before = await create(handle('before'), { city: 'radiance_row' });
    mockCreate.mockClear();
    const b = await request(app).post(`/api/v1/social-profiles/${before.id}/regenerate`).set('Authorization', `Bearer ${token}`).send({});
    expect(b.status).toBe(200);
    expect(await stored(handle('before'))).toBe(ONLY);
    expect(promptOf(mockCreate.mock.calls[0])).toContain(`- ${ONLY}`);
  });

  it('the scheduler builds each spark around an archetype, and its profile keeps it', async () => {
    mockCreate.mockResolvedValue(reply([
      { handle: handle('sparka'), platform: 'tiktok', vibe_sentence: 'Night shift diarist.', archetype: 'the_watcher', follower_tier: 'micro', society_archetype: ONLY },
      { handle: handle('sparkb'), platform: 'instagram', vibe_sentence: 'Dawn runner.', archetype: 'the_peer', follower_tier: 'mid' },
    ]));
    const sparks = await generateSmartSparks(db, 'lalaverse', 2);
    expect(sparks.map((s) => s.society_archetype)).toEqual([ONLY, ONLY]);
    const sparkPrompt = promptOf(mockCreate.mock.calls[0]);
    expect(sparkPrompt).toContain('SOCIETY ARCHETYPES');
    expect(sparkPrompt).toContain(`1. ${ONLY}: Posts at 3am\n2. ${ONLY}: Posts at 3am`);

    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply(PROFILE));
    const profile = await generateAndSaveProfile(db, { ...sparks[0], city: 'ascent_tower' }, 'lalaverse');
    expect(profile.society_archetype).toBe(ONLY);
    expect(await stored(handle('sparka'))).toBe(ONLY);
    expect(promptOf(mockCreate.mock.calls[0])).toContain(`SOCIETY ARCHETYPE: ${ONLY}, what the LalaVerse knows this creator for`);
    expect(promptOf(mockCreate.mock.calls[0])).toContain('What they post: Posts at 3am.');

    mockCreate.mockClear();
    const real = await generateAndSaveProfile(db, { handle: handle('sched'), platform: 'youtube', vibe_sentence: 'Real world.', society_archetype: ONLY }, 'real_world');
    expect(real.society_archetype).toBeNull();
    expect(promptOf(mockCreate.mock.calls[0])).not.toContain('SOCIETY ARCHETYPE');
  });

  it('the Feed\'s composition counts each archetype, and the profiles with none apart', async () => {
    const A = `Society count ${TAG} A`;
    const B = `Society count ${TAG} B`;
    await create(handle('ca1'), { society_archetype: A });
    await create(handle('ca2'), { society_archetype: A });
    await create(handle('cb1'), { society_archetype: B });
    await create(handle('cnone'));
    await create(handle('creal'), { society_archetype: A, feed_layer: 'real_world' });
    const res = await request(app).get('/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.society_archetypes[A]).toBe(2);
    expect(res.body.society_archetypes[B]).toBe(1);
    expect(res.body.society_archetypes).not.toHaveProperty('null');
    expect(res.body.society_archetype_unset).toBeGreaterThanOrEqual(1);
    // The ten are counted as before.
    expect(res.body.archetypes).toBeTruthy();
  });
});
