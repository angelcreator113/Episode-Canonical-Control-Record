/**
 * Visual Memory phase 4: picture suggestions for a caption
 * (services/pictureSuggestions, POST /api/v1/post-media/posts/:id/suggestions
 * and .../suggestions/run), against the test database through the routes.
 * The text AI, the image tool and the storage upload are faked; nothing goes
 * to the network.
 *   - the reading is one text call, kept in post_picture_suggestions apart
 *     from the post's review notes: asking again costs nothing, and a
 *     re-review that rewrites gate_json neither erases it nor pays again
 *   - Maren's dough comes first; a picture with Dr. Sinclair in it is never
 *     suggested
 *   - 'create' stores a private draft with its provenance and does not put it
 *     on the post; 'edit' is a phase-3 variation of one of their pictures
 *   - a made picture keeps a structured record of what it was made from
 *     (media_asset_sources: the place, the portraits, the parent)
 *   - an optional person is left out unless she includes them
 *   - use, edit, create and upload are always offered; what she chose is
 *     recorded and summarised
 *   - a budget refusal (text or image) is a 429 and stores nothing
 *   - ADMIN only
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/mediaLibrary');
const imageCost = require('../../src/services/imageCostService');
const pulseImage = require('../../src/services/pulseImageService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const answer = (reading) => ({ content: [{ type: 'text', text: JSON.stringify(reading) }], usage: { input_tokens: 10, output_tokens: 10 } });
const BREAD = {
  subject: 'bread dough rising', activity: 'baking bread', mood: 'quiet, hopeful', setting: 'home kitchen',
  person_in_frame: 'optional', objects: ['dough', 'ceramic bowl'], avoid: ['unrelated outfits', 'evening gown'],
};
const CANDLE = {
  subject: 'a candle on the windowsill', activity: '', mood: 'calm', setting: 'home kitchen',
  person_in_frame: 'no', objects: ['candle', 'windowsill'], avoid: ['people'],
};

(shouldSkip ? describe.skip : describe)('Visual Memory phase 4: picture suggestions', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), dr: uuid(), set: uuid(), bread: uuid(), candle: uuid(), broke: uuid(), garbled: uuid() };
  const url = (name) => `https://cdn.test/${tag}/${name}.jpg`;
  const pics = {};
  let admin;
  let user;
  let pid;
  let stored = 0;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const suggest = (postId, token = admin) => as(request(app).post(`/api/v1/post-media/posts/${postId}/suggestions`), token).send({});
  const runIt = (postId, choice, token = admin) => as(request(app).post(`/api/v1/post-media/posts/${postId}/suggestions/run`), token).send({ choice });
  const sources = (assetId) => q('SELECT role, source_asset_id, character_id, source_url FROM media_asset_sources WHERE asset_id = :id AND deleted_at IS NULL ORDER BY role', { id: assetId });
  const row = async (postId) => (await q('SELECT * FROM post_picture_suggestions WHERE post_id = :id AND deleted_at IS NULL', { id: postId }))[0];
  const count = async () => (await q('SELECT COUNT(*)::int AS n FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` }))[0].n;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-ps', email: 'evoni@ps.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-ps', email: 'user@ps.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `PS ${tag}`, slug: `ps-${tag}` });
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'PS registry', NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'PS Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `psmaren${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'PS Maren', :pid, NOW(), NOW())`, { ...ids, key: `ps-maren-${tag}`, pid });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, extra_fields, created_at, updated_at)
               VALUES (:dr, :reg, :key, 'PS Dr', '{"classification":"confidential_professional"}', NOW(), NOW())`, { ...ids, key: `ps-dr-${tag}` });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, created_at, updated_at)
               VALUES (:set, 'Home kitchen', 'HOME_BASE', :show, NOW(), NOW())`, ids);
    await run('INSERT INTO character_places (registry_character_id, scene_set_id) VALUES (:maren, :set)', ids);
    const post = (id, text, gate = null) => run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, gate_json, created_at, updated_at)
      VALUES (:id, :show, :pid, :h, :text, 'draft', CAST(:gate AS JSONB), NOW(), NOW())`,
    { id, show: ids.show, pid, h: `@psmaren${tag}`, text, gate: gate ? JSON.stringify(gate) : null });
    await post(ids.bread, 'still here. the bread is rising.', { review: ['schedule'], pillar: 'home' });
    await post(ids.candle, 'lit one for the long week.');
    await post(ids.broke, 'payday. finally.');
    await post(ids.garbled, 'new week, same me.');

    const add = async (name, fields) => { pics[name] = (await media.createAsset(models, { url: url(name), status: 'approved', visibility: 'internal', ...fields })).asset; };
    await add('dough', { caption: 'Dough rising in a ceramic bowl', details: { objects: ['ceramic bowl', 'dough'] }, links: [{ entity_type: 'character', entity_id: ids.maren, role: 'owner' }] });
    await add('gown', { caption: 'Maren in an evening gown', details: { wardrobe: ['evening gown'] }, links: [{ entity_type: 'character', entity_id: ids.maren }] });
    await add('kitchen', { url: PNG + tag, caption: 'Home kitchen', source: 'scene_set', links: [{ entity_type: 'scene_set', entity_id: ids.set, role: 'location' }] });
    await add('session', { caption: 'Dough and a ceramic bowl in a session room', links: [{ entity_type: 'character', entity_id: ids.maren }, { entity_type: 'character', entity_id: ids.dr }] });

    jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
    // Reading a stored picture back (the edit's original): no network.
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/made-${stored}.jpg`, key: `media/suggestions/${tag}-${stored}.jpg`, width: 1536, height: 1024 };
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await run('DELETE FROM media_asset_sources WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre OR url = :png)', { pre: `https://cdn.test/${tag}/%`, png: PNG + tag });
    await run('DELETE FROM post_picture_suggestions WHERE post_id IN (SELECT id FROM feed_posts WHERE show_id = :show)', ids);
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre OR url = :png)', { pre: `https://cdn.test/${tag}/%`, png: PNG + tag });
    await run('DELETE FROM media_assets WHERE url LIKE :pre OR url = :png', { pre: `https://cdn.test/${tag}/%`, png: PNG + tag });
    await run("DELETE FROM ai_usage_logs WHERE route_name IN ('picture-suggestion', 'media-variation') AND created_at > NOW() - INTERVAL '1 hour'");
    await run('DELETE FROM character_places WHERE scene_set_id = :set', ids);
    await run('DELETE FROM scene_sets WHERE id = :set', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:maren, :dr)', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('is ADMIN only', async () => {
    expect((await suggest(ids.bread, user)).status).toBe(403);
    expect((await runIt(ids.bread, { action: 'create' }, user)).status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("reads the caption once, keeps it apart from the review notes, and puts Maren's dough first; Dr. Sinclair's picture is never suggested", async () => {
    mockCreate.mockResolvedValueOnce(answer(BREAD));
    const res = await suggest(ids.bread);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: false, fallback: false, reading: BREAD, poster: { id: ids.maren } });
    expect(res.body.ranked[0].id).toBe(pics.dough.id);
    expect(res.body.ranked.map((r) => r.id)).not.toContain(pics.session.id);
    expect(res.body.ranked.map((r) => r.id)).toContain(pics.kitchen.id);
    expect(res.body.plan).toMatchObject({ recommended: 'use', use: { asset_id: pics.dough.id } });
    // The character file went with it.
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('THE CHARACTER FILE for PS Maren');

    const again = await suggest(ids.bread);
    expect(again.body).toMatchObject({ cached: true, reading: BREAD });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    // Its own row, with the plan; the post's review notes are untouched.
    const kept = await row(ids.bread);
    expect(kept).toMatchObject({ reading: BREAD, model: 'claude-sonnet-4-6', recommended_action: 'use', recommended_asset_id: pics.dough.id, chosen_action: null });
    expect(kept.score).toBe(res.body.plan.score);
    const [post] = await q('SELECT gate_json FROM feed_posts WHERE id = :id', { id: ids.bread });
    expect(post.gate_json).toEqual({ review: ['schedule'], pillar: 'home' });
  });

  it('a re-review that rewrites the gate notes keeps the reading and costs no new call', async () => {
    await run(`UPDATE feed_posts SET gate_json = '{"review":["voice"]}'::jsonb WHERE id = :id`, { id: ids.bread });
    const res = await suggest(ids.bread);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: true, reading: BREAD });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('use, edit, create and upload are always offered; a new picture when a fitting one exists says what it costs', async () => {
    const res = await suggest(ids.bread);
    expect(res.body.plan).toMatchObject({
      recommended: 'use', actions: ['use', 'edit', 'create', 'upload'],
      create_note: 'A fitting picture already exists; generating costs about $0.20.',
      person: { name: 'PS Maren', in_frame: 'optional', included: false, portraits: 0 },
      thresholds: { use: 10, edit: 4 },
    });
    // Every ranked picture comes with the edit that would bring it to the caption.
    expect(res.body.ranked.find((r) => r.id === pics.kitchen.id).edit).toMatchObject({ change: { kind: 'object' } });
    expect(res.body.plan.create.blocked).toBeNull();
  });

  it("'create' stores a private draft with its provenance and does not put it on the post", async () => {
    expect((await runIt(ids.candle, { action: 'create' })).status).toBe(409); // not read yet
    mockCreate.mockResolvedValueOnce(answer(CANDLE));
    const res = await suggest(ids.candle);
    // Their kitchen is nearly right (an edit adding the candle); a new picture is the other choice.
    expect(res.body.plan.recommended).toBe('edit');
    expect(res.body.plan.edit).toMatchObject({ asset_id: pics.kitchen.id, change: { kind: 'object', text: 'add candle and windowsill' }, locks: ['face', 'wardrobe', 'location'] });
    expect(res.body.plan.create.references.map((r) => r.kind)).toEqual(['place']);
    expect(axios.post).not.toHaveBeenCalled(); // nothing is made at plan time

    const made = await runIt(ids.candle, { action: 'create' });
    expect(made.status).toBe(201);
    const { asset } = made.body;
    expect(asset).toMatchObject({ source: 'generated', status: 'draft', visibility: 'private', parent_asset_id: null });
    expect(asset.generation).toMatchObject({
      action: 'create', model: 'gpt-image-1.5', post_id: ids.candle, reading: CANDLE,
      references: [{ kind: 'place', asset_id: pics.kitchen.id }],
    });
    expect(asset.generation.prompt).toContain('No people in the frame.');
    expect(asset.generation.review.needs_review).toBe(true);
    expect(asset.links.map((l) => [l.entity_type, l.entity_id, l.role]).sort())
      .toEqual([['character', ids.maren, 'owner'], ['scene_set', ids.set, 'location']].sort());
    // One image call, the kitchen as its reference, logged under its own route.
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/edits');
    const [log] = await q("SELECT model_name FROM ai_usage_logs WHERE route_name = 'picture-suggestion' ORDER BY created_at DESC LIMIT 1");
    expect(log.model_name).toBe('gpt-image-1.5');
    // Not on the post, not linked to it.
    const [post] = await q('SELECT photos, image_url FROM feed_posts WHERE id = :id', { id: ids.candle });
    expect(post.image_url).toBeNull();
    expect(post.photos === null || (Array.isArray(post.photos) && post.photos.length === 0)).toBe(true);
    expect(asset.links.some((l) => l.entity_type === 'post')).toBe(false);
    // Made from the kitchen, kept as a structured source (not a variation of it).
    expect(await sources(asset.id)).toEqual([{ role: 'place', source_asset_id: pics.kitchen.id, character_id: null, source_url: null }]);
    expect(made.body.sources).toMatchObject([{ role: 'place', source_asset_id: pics.kitchen.id, caption: 'Home kitchen' }]);
    const read = await as(request(app).get(`/api/v1/media/${asset.id}/sources`));
    expect(read.status).toBe(200);
    expect(read.body.items).toMatchObject([{ role: 'place', source_asset_id: pics.kitchen.id }]);
    expect(await row(ids.candle)).toMatchObject({ recommended_action: 'edit', chosen_action: 'create', result_asset_id: asset.id });
  });

  it("'edit' is a phase-3 variation of one of their pictures, and only theirs", async () => {
    const res = await runIt(ids.bread, { action: 'edit', asset_id: pics.dough.id, change: { kind: 'time', text: 'early morning' }, locks: ['face', 'wardrobe', 'location', 'props'] });
    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({ parent_asset_id: pics.dough.id, status: 'draft', visibility: 'private', source: 'generated' });
    expect(res.body.asset.generation).toMatchObject({ kind: 'time', locks: ['face', 'wardrobe', 'location', 'props'], parent_id: pics.dough.id });
    const [log] = await q("SELECT route_name FROM ai_usage_logs WHERE route_name IN ('picture-suggestion', 'media-variation') ORDER BY created_at DESC LIMIT 1");
    expect(log.route_name).toBe('media-variation');
    expect(await sources(res.body.asset.id)).toEqual([{ role: 'parent', source_asset_id: pics.dough.id, character_id: null, source_url: null }]);
    expect(await row(ids.bread)).toMatchObject({ chosen_action: 'edit', chosen_asset_id: pics.dough.id, result_asset_id: res.body.asset.id });
    const calls = axios.post.mock.calls.length;
    const dr = await runIt(ids.bread, { action: 'edit', asset_id: pics.session.id, change: { kind: 'time', text: 'dusk' }, locks: [] });
    expect(dr.status).toBe(400);
    expect(axios.post.mock.calls.length).toBe(calls);
  });

  it('an optional person is left out unless she includes them, and then their approved portrait holds the face', async () => {
    // No approved portrait yet: including them is refused before any image call.
    const calls = axios.post.mock.calls.length;
    const none = await runIt(ids.bread, { action: 'create', include_person: true });
    expect(none.status).toBe(409);
    expect(none.body.error).toMatch(/no approved portrait of PS Maren/);
    expect(axios.post.mock.calls.length).toBe(calls);

    const left = await runIt(ids.bread, { action: 'create' });
    expect(left.status).toBe(201);
    expect(left.body.asset.generation).toMatchObject({ include_person: false });
    expect(left.body.asset.generation.prompt).toContain('No people in the frame.');
    expect((await sources(left.body.asset.id)).map((r) => r.role)).toEqual(['place']);

    await run('UPDATE registry_characters SET portrait_url = :u WHERE id = :maren', { u: url('face'), maren: ids.maren });
    const plan = await suggest(ids.bread);
    expect(plan.body.plan.person).toMatchObject({ included: false, portraits: 1 });
    const inc = await runIt(ids.bread, { action: 'create', include_person: true });
    expect(inc.status).toBe(201);
    expect(inc.body.asset.generation.include_person).toBe(true);
    expect(inc.body.asset.generation.references.map((r) => r.kind)).toEqual(['place', 'portrait']);
    expect(inc.body.asset.links.find((l) => l.entity_type === 'character')).toMatchObject({ entity_id: ids.maren, role: 'pictured' });
    expect(await sources(inc.body.asset.id)).toEqual([
      { role: 'place', source_asset_id: pics.kitchen.id, character_id: null, source_url: null },
      { role: 'portrait', source_asset_id: null, character_id: ids.maren, source_url: url('face') },
    ]);

    // An edit that includes them adds them to a picture they are not in yet.
    const edit = await runIt(ids.bread, { action: 'edit', asset_id: pics.dough.id, change: { kind: 'object', text: 'add a tea towel' }, locks: ['face', 'wardrobe', 'location'], include_person: true });
    expect(edit.status).toBe(201);
    expect(edit.body.asset.generation).toMatchObject({ kind: 'add_character', added_character_id: ids.maren });
    expect((await sources(edit.body.asset.id)).map((r) => r.role).sort()).toEqual(['parent', 'portrait']);
  });

  it('a later picture of the place keeps the kitchen earlier pictures kept', async () => {
    // Another approved kitchen picture, newer; the one already kept still comes first.
    await (async () => { pics.kitchen2 = (await media.createAsset(models, { url: url('kitchen2'), caption: 'Home kitchen, by the window', source: 'scene_set', status: 'approved', visibility: 'internal', links: [{ entity_type: 'scene_set', entity_id: ids.set, role: 'location' }] })).asset; })();
    const res = await suggest(ids.candle);
    expect(res.body.plan.create.references.find((r) => r.kind === 'place').asset_id).toBe(pics.kitchen.id);
  });

  it('what she chose is recorded and summarised by recommendation', async () => {
    const used = await as(request(app).post(`/api/v1/post-media/posts/${ids.bread}/suggestions/choice`)).send({ action: 'use', asset_id: pics.dough.id });
    expect(used.body).toMatchObject({ success: true, recorded: true });
    expect(await row(ids.bread)).toMatchObject({ chosen_action: 'use', chosen_asset_id: pics.dough.id });
    // Not theirs (Dr. Sinclair is in it): refused.
    const dr = await as(request(app).post(`/api/v1/post-media/posts/${ids.bread}/suggestions/choice`)).send({ action: 'use', asset_id: pics.session.id });
    expect(dr.status).toBe(400);

    const summary = async () => (await as(request(app).get('/api/v1/post-media/suggestions/acceptance'))).body;
    const before = await summary();
    expect(before.by_recommendation.use.accepted).toBeGreaterThanOrEqual(1);

    // An upload instead: tagged with them, recorded as the result.
    const up = (await media.createAsset(models, { url: url('upload'), caption: 'Her own photo', links: [{ entity_type: 'character', entity_id: ids.maren, role: 'owner' }] })).asset;
    const rec = await as(request(app).post(`/api/v1/post-media/posts/${ids.bread}/suggestions/choice`)).send({ action: 'upload', result_asset_id: up.id });
    expect(rec.body.recorded).toBe(true);
    expect(await row(ids.bread)).toMatchObject({ chosen_action: 'upload', result_asset_id: up.id });
    const after = await summary();
    expect(after.by_recommendation.use.accepted).toBe(before.by_recommendation.use.accepted - 1);
    expect(after.by_recommendation.use.instead.upload).toBe((before.by_recommendation.use.instead.upload || 0) + 1);
    expect(after.thresholds).toEqual({ use: 10, edit: 4 });
    expect((await as(request(app).get('/api/v1/post-media/suggestions/acceptance'), user)).status).toBe(403);
  });

  it('a budget refusal is a 429 and stores nothing', async () => {
    const before = await count();
    const storedBefore = stored;
    jest.spyOn(imageCost, 'runImageCall').mockRejectedValueOnce(Object.assign(
      new Error('Daily image budget reached ($10.00 of $10.00). Image generation is paused until tomorrow (UTC).'),
      { status: 429, code: 'AI_BUDGET_EXCEEDED' },
    ));
    const res = await runIt(ids.candle, { action: 'create' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/image budget.*Nothing was made/);
    expect(await count()).toBe(before);
    expect(stored).toBe(storedBefore);

    // The text budget refusing the reading: a 429, and no reading is saved.
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const text = await suggest(ids.broke);
    expect(text.status).toBe(429);
    expect(mockCreate).toHaveBeenCalledTimes(3); // no second attempt after a budget refusal
    expect(await row(ids.broke)).toBeUndefined();
  });

  it('an unreadable answer gives a plainer reading from the caption, not cached', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Sorry, I cannot do JSON today.' }] });
    const res = await suggest(ids.garbled);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fallback: true, cached: false });
    expect(res.body.reading.person_in_frame).toBe('yes'); // "same me"
    expect(await row(ids.garbled)).toBeUndefined();
  });
});
