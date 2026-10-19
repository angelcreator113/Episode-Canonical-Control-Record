/**
 * Visual Memory phase 3: variations (services/mediaVariations, POST
 * /api/v1/media/:id/variations, GET /api/v1/media/:id/family), against the
 * test database through the routes. The image tool and the storage upload are
 * faked; nothing goes to the network.
 *   - a variation is a new private draft linked to its original; the original
 *     never changes; it carries the original's tags but not its posts
 *   - adding a character tags them and sends their approved portrait; Dr.
 *     Sinclair is never added
 *   - the image budget refusing stops it with a 429 and stores nothing
 *   - ADMIN only; the family shows the original and its variations, and only
 *     what a reader may see
 */
jest.unmock('uuid');

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

(shouldSkip ? describe.skip : describe)('Visual Memory: variations', () => {
  const tag = uuid().slice(0, 8);
  const ids = { reg: uuid(), maren: uuid(), sable: uuid(), dr: uuid(), post: uuid() };
  let admin;
  let user;
  let parent;
  let child;
  let stored = 0;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const vary = (id, body, token = admin) => as(request(app).post(`/api/v1/media/${id}/variations`), token).send(body);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-vary', email: 'evoni@vary.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-vary', email: 'user@vary.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Vary registry', NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'Vary Maren', NOW(), NOW())`, { ...ids, key: `vary-maren-${tag}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, portrait_url, appearance, created_at, updated_at)
               VALUES (:sable, :reg, :key, 'Vary Sable', :portrait, CAST(:look AS JSONB), NOW(), NOW())`,
    { ...ids, key: `vary-sable-${tag}`, portrait: PNG, look: JSON.stringify({ hair: 'short silver locs' }) });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, portrait_url, extra_fields, created_at, updated_at)
               VALUES (:dr, :reg, :key, 'Vary Dr', :portrait, '{"classification":"confidential_professional"}', NOW(), NOW())`,
    { ...ids, key: `vary-dr-${tag}`, portrait: PNG });
    const [[show]] = await run('SELECT id FROM shows LIMIT 1');
    if (!show) throw new Error('the test database needs a show');
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, status, created_at, updated_at)
               VALUES (:post, :show, '@vary', 'still here. the bread is rising.', 'draft', NOW(), NOW())`, { post: ids.post, show: show.id });
    parent = (await media.createAsset(models, {
      url: `${PNG}${tag}`, // its own picture: the same URL is never stored twice caption: `Dough rising ${tag}`, status: 'approved', visibility: 'internal',
      details: { objects: ['ceramic bowl'] },
      links: [{ entity_type: 'character', entity_id: ids.maren }, { entity_type: 'post', entity_id: ids.post, role: 'owner' }],
    })).asset;

    jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/variation-${stored}.jpg`, key: `media/variations/${tag}-${stored}.jpg`, width: 1536, height: 1024 };
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await run(`DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre OR id = :parent)`, { pre: `https://cdn.test/${tag}/%`, parent: parent.id });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE id = :parent', { parent: parent.id });
    await run("DELETE FROM ai_usage_logs WHERE route_name = 'media-variation' AND created_at > NOW() - INTERVAL '1 hour'");
    await run('DELETE FROM feed_posts WHERE id = :post', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:maren, :sable, :dr)', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
  });

  it('is ADMIN only', async () => {
    expect((await vary(parent.id, { change: { kind: 'time', text: 'dusk' }, locks: [] }, user)).status).toBe(403);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('makes a new private draft linked to its original; the original never changes', async () => {
    const before = (await q('SELECT * FROM media_assets WHERE id = :id', { id: parent.id }))[0];
    const res = await vary(parent.id, { change: { kind: 'object', text: 'a tea cup instead of the bread bowl' }, locks: ['face', 'wardrobe', 'location'] });
    expect(res.status).toBe(201);
    child = res.body.asset;
    expect(child).toMatchObject({ parent_asset_id: parent.id, source: 'generated', status: 'draft', visibility: 'private' });
    expect(child.url).toBe(`https://cdn.test/${tag}/variation-1.jpg`);
    expect(child.generation).toMatchObject({ kind: 'object', locks: ['face', 'wardrobe', 'location'], model: 'gpt-image-1.5', parent_id: parent.id });
    expect(child.generation.prompt).toContain('Change the object: a tea cup instead of the bread bowl.');
    expect(child.generation.review.needs_review).toBe(true);
    expect(child.details.notes).toContain('Variation (object)');
    // It carries the character tag, not the post that uses the original.
    expect(child.links.map((l) => [l.entity_type, l.entity_id])).toEqual([['character', ids.maren]]);
    // One image call, with the original's own stored image as the reference.
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/edits');
    const after = (await q('SELECT * FROM media_assets WHERE id = :id', { id: parent.id }))[0];
    expect(after).toEqual(before);
    const [log] = await q("SELECT model_name FROM ai_usage_logs WHERE route_name = 'media-variation' ORDER BY created_at DESC LIMIT 1");
    expect(log.model_name).toBe('gpt-image-1.5');
  });

  it('adding a character tags them and sends their approved portrait; Dr. Sinclair is never added', async () => {
    const res = await vary(parent.id, { change: { kind: 'add_character', text: 'at the table', character_id: ids.sable }, locks: ['face', 'location'] });
    expect(res.status).toBe(201);
    expect(res.body.asset.links.map((l) => l.entity_id).sort()).toEqual([ids.maren, ids.sable].sort());
    expect(res.body.asset.generation.references).toEqual([parent.id, { character_id: ids.sable, url: PNG }]);
    expect(res.body.asset.generation.prompt).toContain('Add Vary Sable to the scene: at the table.');
    expect(res.body.asset.generation.prompt).toContain('short silver locs');
    expect(res.body.review.reasons[0]).toBe('A person was added: check they match their approved portraits.');

    const dr = await vary(parent.id, { change: { kind: 'add_character', character_id: ids.dr }, locks: [] });
    expect(dr.status).toBe(403);
    expect((await vary(parent.id, { change: { kind: 'object', text: 'a cup' }, locks: ['props'] })).status).toBe(400);
  });

  it('the image budget refusing stops it with a 429 and stores nothing', async () => {
    const [{ n: before }] = await q('SELECT COUNT(*)::int AS n FROM media_assets WHERE parent_asset_id = :id', { id: parent.id });
    const storedBefore = stored;
    jest.spyOn(imageCost, 'runImageCall').mockRejectedValueOnce(Object.assign(
      new Error('Daily image budget reached ($10.00 of $10.00). Image generation is paused until tomorrow (UTC).'),
      { status: 429, code: 'AI_BUDGET_EXCEEDED' },
    ));
    const res = await vary(parent.id, { change: { kind: 'weather', text: 'rain on the window' }, locks: ['face'] });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/image budget/);
    const [{ n: after }] = await q('SELECT COUNT(*)::int AS n FROM media_assets WHERE parent_asset_id = :id', { id: parent.id });
    expect(after).toBe(before);
    expect(stored).toBe(storedBefore);
  });

  it('the family shows the original and its variations, and only what the reader may see', async () => {
    const res = await as(request(app).get(`/api/v1/media/${child.id}/family`));
    expect(res.status).toBe(200);
    expect(res.body.root_id).toBe(parent.id);
    expect(res.body.items[0].id).toBe(parent.id);
    expect(res.body.items.filter((i) => i.parent_asset_id === parent.id)).toHaveLength(2);
    const member = await as(request(app).get(`/api/v1/media/${parent.id}/family`), user);
    expect(member.body.items.map((i) => i.id)).toEqual([parent.id]);
    expect((await as(request(app).get(`/api/v1/media/${child.id}/family`), user)).status).toBe(404);
  });
});
