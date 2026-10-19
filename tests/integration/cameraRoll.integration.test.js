/**
 * A character's camera roll (Evoni, 2026-10-19: one official headshot, and
 * every other photo a moment from an actual life with a purpose;
 * services/cameraRoll, /api/v1/camera-roll), against the test database
 * through the routes. The text AI, the image tool and the storage upload are
 * faked; nothing goes to the network.
 *   - how many: Lala 24, the main show's cast 12, anyone else 6
 *   - never Dr. Sinclair, JustAWoman or a Before Lala character
 *   - a plan keeps to the target and the rules (at most a third show a face,
 *     a photographer only for work and events, known values only)
 *   - keep, drop and edit; a face photo needs the official headshot and is
 *     made from it; a photo with no face is made from words alone
 *   - posted photos are public, every other photo private; a member sees only
 *     what is not private; a private photo is never suggested for a post or
 *     made public by approving a post's pictures
 *   - a budget refusal is a 429 and stores nothing; the AI down is a 502
 *   - every write is ADMIN only
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
const imageCost = require('../../src/services/imageCostService');
const pulseImage = require('../../src/services/pulseImageService');
const postMedia = require('../../src/services/postMedia');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const answer = (moments) => ({ content: [{ type: 'text', text: JSON.stringify({ moments }) }], usage: { input_tokens: 10, output_tokens: 10 } });

// Fourteen moments, nine with a face, one photographer at breakfast, one unknown purpose.
const PLAN = [
  { moment: 'First loaf out of the oven at 6am', purpose: 'private', taken_by: 'selfie', shows_face: true, album: 'everyday', place: 'Home kitchen' },
  { moment: 'Flour on her hands', purpose: 'posted', taken_by: 'friend', shows_face: true, album: 'objects' },
  { moment: 'Breakfast on the balcony', purpose: 'memory', taken_by: 'photographer', shows_face: true, album: 'everyday' },
  { moment: 'Mirror check before the market', purpose: 'sent', taken_by: 'mirror', shows_face: true, album: 'fashion' },
  { moment: 'Stall set up at the market', purpose: 'work', taken_by: 'photographer', shows_face: true, album: 'work' },
  { moment: 'Coffee and a notebook', purpose: 'nonsense', taken_by: 'drone', shows_face: true, album: 'nowhere' },
  { moment: 'Sunset from the bridge', purpose: 'posted', taken_by: 'friend', shows_face: true, album: 'travel' },
  { moment: 'Dinner with the girls', purpose: 'posted', taken_by: 'timer', shows_face: true, album: 'social', people: ['Lala'] },
  { moment: 'A screenshot of the order list', purpose: 'screenshot', taken_by: 'selfie', shows_face: true, album: 'work' },
  { moment: 'Rain on the bakery window', purpose: 'private', taken_by: 'friend', shows_face: false, album: 'everyday' },
  { moment: 'New apron', purpose: 'posted', taken_by: 'friend', shows_face: false, album: 'fashion' },
  { moment: 'Sourdough starter jar', purpose: 'private', taken_by: 'friend', shows_face: false, album: 'objects' },
  { moment: 'An extra one past the target', purpose: 'private', taken_by: 'friend', shows_face: false, album: 'everyday' },
  { moment: '', purpose: 'private' },
];

(shouldSkip ? describe.skip : describe)('The camera roll', () => {
  const tag = uuid().slice(0, 8);
  const ids = {
    main: uuid(), other: uuid(), mainReg: uuid(), otherReg: uuid(), bookReg: uuid(),
    maren: uuid(), lala: uuid(), side: uuid(), dr: uuid(), jaw: uuid(), bookie: uuid(), set: uuid(), post: uuid(),
  };
  let admin;
  let member;
  let pid;
  let stored = 0;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const get = (id, token = admin) => as(request(app).get(`/api/v1/camera-roll/characters/${id}`), token);
  const plan = (id, body = {}, token = admin) => as(request(app).post(`/api/v1/camera-roll/characters/${id}/plan`), token).send(body);
  const make = (momentId, token = admin) => as(request(app).post(`/api/v1/camera-roll/moments/${momentId}/make`), token).send({});
  const moments = (id) => q('SELECT * FROM camera_roll_moments WHERE character_id = :id AND deleted_at IS NULL ORDER BY created_at, id', { id });
  const pictures = () => q('SELECT COUNT(*)::int AS n FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
  const posted = () => axios.post.mock.calls.map((c) => c[0]);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-cr', email: 'evoni@cr.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    member = TokenService.generateTokenPair({ id: 'test-user-cr', email: 'user@cr.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES
      (:main, 'Styling Adventures with Lala', 'styling-adventures-with-lala', NOW(), NOW()), (:other, :otherName, :otherSlug, NOW(), NOW())`,
    { ...ids, otherName: `CR other ${tag}`, otherSlug: `cr-other-${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, book_tag, created_at, updated_at) VALUES
      (:mainReg, 'CR main', :main, NULL, NOW(), NOW()), (:otherReg, 'CR other', :other, NULL, NOW(), NOW()),
      (:bookReg, 'CR book', NULL, 'Book 1', NOW(), NOW())`, ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'CR Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `crmaren${tag}` });
    pid = p.id;
    const char = (id, reg, key, name, extra = '') => run(
      `INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, portrait_url, feed_profile_id, extra_fields, created_at, updated_at)
       VALUES (:id, :reg, :key, :name, CAST(:world AS enum_registry_characters_world), :portrait, :pid, CAST(:extra AS JSONB), NOW(), NOW())`,
      { id, reg, key, name, world: reg === ids.bookReg ? null : 'lalaverse', portrait: id === ids.maren ? `https://cdn.test/${tag}/old-portrait.jpg` : null,
        pid: id === ids.maren ? pid : null, extra: extra || '{}' });
    await char(ids.maren, ids.mainReg, `cr-maren-${tag}`, 'CR Maren');
    await char(ids.lala, ids.mainReg, 'lala', 'Lala');
    await char(ids.side, ids.otherReg, `cr-side-${tag}`, 'CR Side');
    await char(ids.dr, ids.mainReg, `cr-dr-${tag}`, 'CR Dr', '{"classification":"confidential_professional"}');
    await char(ids.jaw, ids.otherReg, 'justawoman', 'JustAWoman');
    await char(ids.bookie, ids.bookReg, `cr-book-${tag}`, 'CR Book');
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, created_at, updated_at)
               VALUES (:set, 'Home kitchen', 'HOME_BASE', :main, NOW(), NOW())`, ids);
    await run("INSERT INTO character_places (registry_character_id, scene_set_id, role) VALUES (:maren, :set, 'home')", ids);

    jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/photo-${stored}.jpg`, key: `characters/${tag}-${stored}.jpg`, width: 1536, height: 1024 };
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    const chars = [ids.maren, ids.lala, ids.side, ids.dr, ids.jaw, ids.bookie];
    await run('DELETE FROM camera_roll_moments WHERE character_id IN (:chars)', { chars });
    await run('DELETE FROM media_asset_sources WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run("DELETE FROM ai_usage_logs WHERE route_name = 'camera-roll' AND created_at > NOW() - INTERVAL '1 hour'");
    await run('DELETE FROM feed_posts WHERE id = :post', ids);
    await run('DELETE FROM character_places WHERE scene_set_id = :set', ids);
    await run('DELETE FROM scene_sets WHERE id = :set', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:chars)', { chars });
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM character_registries WHERE id IN (:mainReg, :otherReg, :bookReg)', ids);
    await run('DELETE FROM shows WHERE id IN (:main, :other)', ids);
  });

  beforeEach(() => { mockCreate.mockReset(); axios.post.mockClear(); });

  it('reads an empty camera roll: the target, no headshot yet (a suggestion, nothing written), seven empty albums', async () => {
    const res = await get(ids.maren);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({ eligible: true, target: 12, headshot: null, headshot_suggestion: { url: `https://cdn.test/${tag}/old-portrait.jpg` }, moments: [], photos: [] });
    expect(d.albums.map((a) => [a.key, a.count])).toEqual([
      ['everyday', 0], ['work', 0], ['travel', 0], ['events', 0], ['social', 0], ['fashion', 0], ['objects', 0]]);
    expect(d.albums[0].label).toBe('Everyday Life');
    expect((await get(ids.lala)).body.data.target).toBe(24);
    expect((await get(ids.side)).body.data.target).toBe(6);
    expect(await q("SELECT 1 FROM media_asset_links WHERE entity_id = :id AND role = 'headshot'", { id: ids.maren })).toHaveLength(0);
  });

  it('never Dr. Sinclair, JustAWoman or a Before Lala character, and no AI call is made for them', async () => {
    const dr = await get(ids.dr);
    expect(dr.body.data).toMatchObject({ eligible: false, target: 0 });
    expect(dr.body.data.reason).toMatch(/confidential/);
    expect((await plan(ids.dr)).status).toBe(403);
    const jaw = await plan(ids.jaw);
    expect(jaw.status).toBe(403);
    expect(jaw.body.error).toMatch(/JustAWoman/);
    const book = await plan(ids.bookie);
    expect(book.status).toBe(409);
    expect(book.body.error).toMatch(/LalaWorld characters only/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('every write is ADMIN only, and nothing changes', async () => {
    const body = {};
    const writes = [
      as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`), member).send({ url: `https://cdn.test/${tag}/x.jpg` }),
      plan(ids.maren, body, member),
      as(request(app).post(`/api/v1/camera-roll/characters/${ids.maren}/make-kept`), member).send(body),
      as(request(app).patch(`/api/v1/camera-roll/moments/${uuid()}`), member).send({ moment: 'x' }),
      as(request(app).post(`/api/v1/camera-roll/moments/${uuid()}/keep`), member).send(body),
      as(request(app).post(`/api/v1/camera-roll/moments/${uuid()}/drop`), member).send(body),
      make(uuid(), member),
    ];
    for (const res of await Promise.all(writes)) expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await moments(ids.maren)).toHaveLength(0);
    expect((await request(app).get(`/api/v1/camera-roll/characters/${ids.maren}`)).status).toBe(401);
  });

  it('a plan keeps to the target and the rules', async () => {
    mockCreate.mockResolvedValueOnce(answer(PLAN));
    const res = await plan(ids.maren, { idea: 'her first month at the bakery' });
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatch(/Plan 12 photos/);
    expect(prompt).toMatch(/Home kitchen/);
    expect(prompt).toMatch(/her first month at the bakery/);

    const list = res.body.data.moments;
    expect(list).toHaveLength(12);
    expect(list.every((m) => m.status === 'proposed')).toBe(true);
    expect(list.filter((m) => m.shows_face).length).toBeLessThanOrEqual(4);
    for (const m of list) {
      if (m.taken_by === 'photographer') expect(m.purpose === 'work' || ['work', 'events'].includes(m.album)).toBe(true);
    }
    const byText = Object.fromEntries(list.map((m) => [m.moment, m]));
    expect(byText['Breakfast on the balcony'].taken_by).toBe('friend');            // no photographer at breakfast
    expect(byText['Stall set up at the market'].taken_by).toBe('photographer');   // work: allowed
    expect(byText['Coffee and a notebook']).toMatchObject({ purpose: 'private', taken_by: 'friend', album: 'everyday' });
    expect(byText['A screenshot of the order list'].shows_face).toBe(false);
    expect(byText['Dinner with the girls'].people).toEqual([{ character_id: ids.lala, name: 'Lala' }]);
    const [row] = (await moments(ids.maren)).filter((m) => m.moment.startsWith('First loaf'));
    expect(row.place_ref).toEqual({ type: 'scene_set', id: ids.set });
    expect(row.outfit).toBe('at_home');
    expect(byText['An extra one past the target']).toBeUndefined();

    // Full: no second call.
    const again = await plan(ids.maren);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/12 of 12/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('keep, drop and edit', async () => {
    const list = await moments(ids.maren);
    const rain = list.find((m) => m.moment.startsWith('Rain'));
    const jar = list.find((m) => m.moment.startsWith('Sourdough'));
    expect((await as(request(app).post(`/api/v1/camera-roll/moments/${rain.id}/keep`)).send({})).body.data.moment.status).toBe('kept');
    expect((await as(request(app).post(`/api/v1/camera-roll/moments/${jar.id}/drop`)).send({})).body.data.moment.status).toBe('dropped');
    const edited = await as(request(app).patch(`/api/v1/camera-roll/moments/${rain.id}`)).send({ moment: 'Rain on the bakery window, the first customer outside', purpose: 'posted', taken_by: 'photographer' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.moment).toMatchObject({ moment: 'Rain on the bakery window, the first customer outside', purpose: 'posted', taken_by: 'friend', outfit: 'going_out' });
    expect((await as(request(app).patch(`/api/v1/camera-roll/moments/${jar.id}`)).send({ moment: 'x' })).status).toBe(409);
    // A dropped moment frees a place: the member read has no moments at all.
    const asMember = await get(ids.maren, member);
    expect(asMember.body.data.moments).toEqual([]);
  });

  it('a face photo needs the official headshot, and is made from it; a photo with no face from words alone', async () => {
    const list = await moments(ids.maren);
    const loaf = list.find((m) => m.moment.startsWith('First loaf'));
    const blocked = await make(loaf.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/headshot first/);
    expect(axios.post).not.toHaveBeenCalled();

    const set = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)).send({ url: `https://cdn.test/${tag}/old-portrait.jpg` });
    expect(set.status).toBe(200);
    expect(set.body.data.headshot.url).toBe(`https://cdn.test/${tag}/old-portrait.jpg`);
    const read = (await get(ids.maren)).body.data;
    expect(read.headshot.asset_id).toBe(set.body.data.headshot.asset_id);
    expect(read.headshot_suggestion).toBeNull();

    const made = await make(loaf.id);
    expect(made.status).toBe(201);
    expect(posted()).toEqual(['https://api.openai.com/v1/images/edits']);
    expect(made.body.data.moment).toMatchObject({ status: 'made', asset_id: made.body.data.photo.asset_id });
    expect(made.body.data.photo).toMatchObject({ album: 'everyday', purpose: 'private', taken_by: 'selfie', moment_id: loaf.id });
    const [asset] = await q('SELECT * FROM media_assets WHERE id = :id', { id: made.body.data.photo.asset_id });
    expect(asset).toMatchObject({ source: 'generated', status: 'approved', visibility: 'private' });
    expect(asset.generation.camera_roll).toMatchObject({ moment_id: loaf.id, purpose: 'private' });
    expect(asset.generation.prompt).toMatch(/candid phone photo/);
    expect(asset.generation.prompt).toMatch(/not a studio/);
    expect(asset.generation.prompt).toMatch(/No text, no letters, no logos/);
    const links = await q('SELECT entity_type, entity_id, role FROM media_asset_links WHERE asset_id = :id AND deleted_at IS NULL ORDER BY entity_type', { id: asset.id });
    expect(links).toEqual(expect.arrayContaining([
      { entity_type: 'character', entity_id: ids.maren, role: 'pictured' },
      { entity_type: 'scene_set', entity_id: ids.set, role: 'location' }]));
    const [source] = await q('SELECT role, source_asset_id FROM media_asset_sources WHERE asset_id = :id', { id: asset.id });
    expect(source).toEqual({ role: 'portrait', source_asset_id: set.body.data.headshot.asset_id });

    axios.post.mockClear();
    const rain = list.find((m) => m.moment.startsWith('Rain'));
    const posted2 = await make(rain.id);
    expect(posted2.status).toBe(201);
    expect(posted()).toEqual(['https://api.openai.com/v1/images/generations']);
    const [pub] = await q('SELECT visibility FROM media_assets WHERE id = :id', { id: posted2.body.data.photo.asset_id });
    expect(pub.visibility).toBe('public');
    expect((await make(rain.id)).status).toBe(409);
  });

  it('a member sees only the photos that are not private; an ADMIN sees every photo and moment', async () => {
    const adminRead = (await get(ids.maren)).body.data;
    expect(adminRead.photos).toHaveLength(2);
    expect(adminRead.moments.filter((m) => m.status === 'made').every((m) => m.url)).toBe(true);
    expect(adminRead.albums.find((a) => a.key === 'everyday').count).toBe(2);
    const memberRead = (await get(ids.maren, member)).body.data;
    expect(memberRead.photos).toHaveLength(1);
    expect(memberRead.photos[0].purpose).toBe('posted');
    expect(memberRead.headshot).not.toBeNull();
  });

  it('a private photo is never suggested for a post or made public by approving its pictures; marking it posted does', async () => {
    const [loaf] = (await moments(ids.maren)).filter((m) => m.moment.startsWith('First loaf'));
    const [asset] = await q('SELECT url FROM media_assets WHERE id = :id', { id: loaf.asset_id });
    await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, image_url, created_at, updated_at)
      VALUES (:post, :main, :pid, :h, 'first loaf out of the oven', 'draft', :url, NOW(), NOW())`, { ...ids, pid, h: `@crmaren${tag}`, url: asset.url });
    const offered = await postMedia.suggestFor(models, ids.post);
    expect(offered.suggestions.map((s) => s.id)).not.toContain(loaf.asset_id);
    await expect(postMedia.approvePictures(models, ids.post)).rejects.toMatchObject({ status: 409 });
    const [still] = await q('SELECT visibility FROM media_assets WHERE id = :id', { id: loaf.asset_id });
    expect(still.visibility).toBe('private');

    const res = await as(request(app).patch(`/api/v1/camera-roll/moments/${loaf.id}`)).send({ purpose: 'posted', moment: 'not allowed once made' });
    expect(res.status).toBe(200);
    expect(res.body.data.moment.moment).toMatch(/^First loaf/);
    const [now] = await q('SELECT visibility, generation FROM media_assets WHERE id = :id', { id: loaf.asset_id });
    expect(now.visibility).toBe('public');
    expect(now.generation.camera_roll.purpose).toBe('posted');
    expect((await as(request(app).patch(`/api/v1/camera-roll/moments/${loaf.id}`)).send({ moment: 'only words' })).status).toBe(400);
  });

  it('a budget refusal is a 429 and stores nothing; make-kept stops there', async () => {
    const list = await moments(ids.maren);
    const apron = list.find((m) => m.moment === 'New apron');
    await as(request(app).post(`/api/v1/camera-roll/moments/${apron.id}/keep`)).send({});
    const before = (await pictures())[0].n;
    const storedBefore = stored;
    const refusal = () => Object.assign(new Error('Daily image budget reached ($10.00 of $10.00).'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
    jest.spyOn(imageCost, 'runImageCall').mockRejectedValueOnce(refusal());
    const res = await make(apron.id);
    expect(res.status).toBe(429);
    expect((await pictures())[0].n).toBe(before);
    expect(stored).toBe(storedBefore);
    expect((await moments(ids.maren)).find((m) => m.id === apron.id).status).toBe('kept');

    jest.spyOn(imageCost, 'runImageCall').mockRejectedValueOnce(refusal());
    const batch = await as(request(app).post(`/api/v1/camera-roll/characters/${ids.maren}/make-kept`)).send({});
    expect(batch.status).toBe(200);
    expect(batch.body.data).toEqual({ made: 0, failed: 0, stopped_for_budget: true });

    const again = await as(request(app).post(`/api/v1/camera-roll/characters/${ids.maren}/make-kept`)).send({});
    expect(again.body.data).toEqual({ made: 1, failed: 0, stopped_for_budget: false });
  });

  it('the AI down is a 502 with nothing saved; a budget refusal on the plan is a 429', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' }));
    const down = await plan(ids.side);
    expect(down.status).toBe(502);
    expect(down.body.error).toBe('The AI could not be reached; nothing was spent.');
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('AI daily budget exceeded.'), { code: 'AI_BUDGET_EXCEEDED' }));
    expect((await plan(ids.side)).status).toBe(429);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(await moments(ids.side)).toHaveLength(0);
  });

  it('a new headshot replaces the old one, which stays a picture of them', async () => {
    const before = (await get(ids.maren)).body.data.headshot;
    const res = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)).send({ url: `https://cdn.test/${tag}/new-headshot.jpg` });
    expect(res.status).toBe(200);
    const rows = await q("SELECT asset_id, role FROM media_asset_links WHERE entity_type = 'character' AND entity_id = :id AND deleted_at IS NULL AND asset_id IN (:a)",
      { id: ids.maren, a: [before.asset_id, res.body.data.headshot.asset_id] });
    expect(rows).toEqual(expect.arrayContaining([
      { asset_id: before.asset_id, role: 'pictured' }, { asset_id: res.body.data.headshot.asset_id, role: 'headshot' }]));
    // The generic tag route cannot make a headshot.
    const tagIt = await as(request(app).post(`/api/v1/media/${before.asset_id}/links`)).send({ entity_type: 'character', entity_id: ids.side, role: 'headshot' });
    expect(tagIt.status).toBe(400);
  });
});
