/**
 * Voice Profiles (Task #2967; The Pulse spec §7; Evoni, 2026-10-12):
 * - the show's posting characters are those at active or alive with a Feed
 *   profile, not hidden from Lala now; each with their voice or none;
 * - Build makes one AI call (mocked here) from the public face only and
 *   saves the cleaned habits; a rebuild keeps the examples;
 * - Evoni edits habits, pins posts and edits as examples, removes them;
 * - writes are admin only.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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
const reply = (obj) => ({ content: [{ type: 'text', text: `Here you go:\n${JSON.stringify(obj)}` }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('The Pulse Voice Profiles (Task #2967)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const c = {};
  const p = {};
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-voices', email: 'evoni@voices.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-voices', email: 'ed@voices.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Voices ${tag}`, slug: `voices-${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Voices registry', :show, NOW(), NOW())`, ids);
    for (const key of ['marcus', 'nia', 'hidden', 'sparked', 'nofeed']) {
      if (key !== 'nofeed') {
        const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, posting_voice, created_at, updated_at)
          VALUES (:handle, 'instagram', 'dry wit', :display, 'lalaverse', 'all lowercase', NOW(), NOW()) RETURNING id`, { handle: `${key}-${tag}`, display: key });
        p[key] = row.id;
      }
      c[key] = uuid();
      const depth = { marcus: 'active', nia: 'alive', hidden: 'alive', sparked: 'sparked', nofeed: 'alive' }[key];
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, the_mask, wound, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, CAST(:depth AS enum_registry_characters_depth_level), :feed,
                   CAST('{"face":"effortless"}' AS jsonb), CAST(:wound AS jsonb), NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, depth, feed: p[key] ?? null, wound: JSON.stringify({ core: `PRIVATE-WOUND-${tag}` }) });
    }
    // "hidden" is not revealed to Lala until long after now.
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'character', item_id: String(p.hidden), moment: 'story_time', story_order: 999, mode: 'hidden', source: 'set' });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:ids)', { ids: Object.values(c) });
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => mockCreate.mockReset());

  test('the posting characters: active or alive, with a Feed profile, not hidden; reads need a sign-in', async () => {
    expect((await request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`)).status).toBe(401);
    expect((await as(editor, request(app).get('/api/v1/pulse-voices?show_id=x'))).status).toBe(400);
    const res = await as(editor, request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect(res.body.characters.map((x) => x.display_name)).toEqual(['marcus', 'nia']);
    expect(res.body.characters[0]).toMatchObject({ depth_level: 'active', handle: `marcus-${tag}`, voice: null, needs_rebuild: true });
    // Lala has not met "hidden" yet: listed apart, so the voice can be built before the meeting.
    expect(res.body.not_met.map((x) => x.display_name)).toEqual(['hidden']);
    expect(res.body.not_met[0]).toMatchObject({ depth_level: 'alive', voice: null, meets_in: null });
    // On the feed below Active: listed so they can be moved up; no feed, not listed.
    expect(res.body.not_posting).toEqual([{ registry_character_id: c.sparked, display_name: 'sparked', depth_level: 'sparked', handle: `sparked-${tag}` }]);
    expect(res.body.banned_phrases).toContain('delve');
  });

  test('a voice can be built for a character Lala has not met yet; they still do not post', async () => {
    mockCreate.mockResolvedValueOnce(reply({ case: 'sentence', punctuation: '', emoji: { use: 'never', favorites: [] },
      sentence_length: 'short', topics: ['linen'], never_says: [], signature_phrases: [] }));
    const res = await as(admin, request(app).post(`/api/v1/pulse-voices/${c.hidden}/build`));
    expect(res.status).toBe(200);
    const listed = await as(editor, request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(listed.body.not_met[0]).toMatchObject({ display_name: 'hidden', voice: { id: res.body.voice.id } });
    const { eligible } = require('../../src/services/pulseVoices');
    expect((await eligible(models, ids.show)).map((r) => r.character.display_name)).toEqual(['marcus', 'nia']);
    expect((await eligible(models, ids.show, { stage: 'alive' })).map((r) => r.character.display_name)).toEqual(['nia']);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :id', { id: c.hidden });
  });

  test('Build: one AI call from the public face only; the habits cleaned and saved; admin only', async () => {
    expect((await as(editor, request(app).post(`/api/v1/pulse-voices/${c.marcus}/build`))).status).toBe(403);
    expect((await as(admin, request(app).post(`/api/v1/pulse-voices/${c.sparked}/build`))).status).toBe(409);
    expect((await as(admin, request(app).post(`/api/v1/pulse-voices/${c.nofeed}/build`))).status).toBe(409);
    expect((await as(admin, request(app).post(`/api/v1/pulse-voices/${uuid()}/build`))).status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();

    mockCreate.mockResolvedValueOnce(reply({ case: 'lowercase', punctuation: 'no full stops', emoji: { use: 'rarely', favorites: ['🙄'] },
      sentence_length: 'short', topics: ['fits', 'gossip'], never_says: ['synergy'], signature_phrases: ['ok but why', 'a testament to drip'] }));
    const res = await as(admin, request(app).post(`/api/v1/pulse-voices/${c.marcus}/build`));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('effortless');
    expect(prompt).not.toContain(`PRIVATE-WOUND-${tag}`);
    expect(res.body.voice).toMatchObject({ status: 'built', social_profile_id: p.marcus, habits: { case: 'lowercase', signature_phrases: ['ok but why'] } });

    const listed = await as(editor, request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(listed.body.characters[0]).toMatchObject({ needs_rebuild: false, voice: { id: res.body.voice.id } });
    // A changed public face shows the voice needs a rebuild.
    await run(`UPDATE registry_characters SET the_mask = CAST('{"face":"guarded"}' AS jsonb) WHERE id = :id`, { id: c.marcus });
    const after = await as(editor, request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(after.body.characters[0].needs_rebuild).toBe(true);
  });

  test('an unreadable answer is a 502 and saves nothing', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'sorry, no' }] });
    const res = await as(admin, request(app).post(`/api/v1/pulse-voices/${c.nia}/build`));
    expect(res.status).toBe(502);
    expect(await models.PulseVoice.findOne({ where: { registry_character_id: c.nia } })).toBeNull();
  });

  test('Evoni edits habits and pins examples; a rebuild keeps the examples', async () => {
    const voice = await models.PulseVoice.findOne({ where: { registry_character_id: c.marcus } });
    const put = (body, token = admin) => as(token, request(app).put(`/api/v1/pulse-voices/${voice.id}`)).send(body);
    expect((await put({ habits: { case: 'mixed' } }, editor)).status).toBe(403);
    expect((await put({ habits: 'x' })).status).toBe(400);
    const edited = await put({ habits: { case: 'mixed', topics: ['sneakers'], bogus: 1 } });
    expect(edited.status).toBe(200);
    expect(edited.body.voice).toMatchObject({ status: 'edited', edited_by: 'evoni@voices.dev', habits: { case: 'mixed', topics: ['sneakers'] } });
    expect(edited.body.voice.habits.bogus).toBeUndefined();

    const add = (body, token = admin) => as(token, request(app).post(`/api/v1/pulse-voices/${voice.id}/examples`)).send(body);
    expect((await add({ text: 'x' }, editor)).status).toBe(403);
    expect((await add({ text: '  ' })).status).toBe(400);
    expect((await add({ text: 'x', kind: 'other' })).status).toBe(400);
    const postId = uuid();
    const pinned = await add({ text: 'ok but why is everyone in beige', post_id: postId });
    expect(pinned.status).toBe(201);
    expect(pinned.body.example).toMatchObject({ kind: 'pinned', post_id: postId, added_by: 'evoni@voices.dev' });
    expect((await add({ text: 'again', post_id: postId })).status).toBe(409);
    const edit = await add({ text: 'not the beige again', kind: 'edit' });
    expect(edit.body.voice.examples.map((e) => e.kind)).toEqual(['edit', 'pinned']);

    mockCreate.mockResolvedValueOnce(reply({ case: 'lowercase' }));
    const rebuilt = await as(admin, request(app).post(`/api/v1/pulse-voices/${c.marcus}/build`));
    expect(rebuilt.body.voice).toMatchObject({ status: 'built', habits: { case: 'lowercase' } });
    expect(rebuilt.body.voice.examples).toHaveLength(2);

    const removed = await as(admin, request(app).delete(`/api/v1/pulse-voices/${voice.id}/examples/${pinned.body.example.id}`));
    expect(removed.body.voice.examples.map((e) => e.kind)).toEqual(['edit']);
    expect((await as(admin, request(app).delete(`/api/v1/pulse-voices/${voice.id}/examples/${pinned.body.example.id}`))).status).toBe(404);
  });

  test('Pin a post as an example of its poster\'s voice (Task #2972): admin only, once, and only with a voice', async () => {
    const postId = uuid();
    const otherId = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, created_at, updated_at) VALUES
      (:postId, :show, :h, :pid, 'beige again? ok', 'live', NOW(), NOW()),
      (:otherId, :show, :h2, :pid2, 'no voice here', 'live', NOW(), NOW())`,
    { postId, otherId, show: ids.show, h: `marcus-${tag}`, pid: p.marcus, h2: `nia-${tag}`, pid2: p.nia });
    const pin = (body, token = admin) => as(token, request(app).post('/api/v1/pulse-voices/pin')).send(body);
    expect((await pin({ post_id: postId }, editor)).status).toBe(403);
    expect((await pin({ post_id: 'x' })).status).toBe(400);
    expect((await pin({ post_id: uuid() })).status).toBe(404);
    const res = await pin({ post_id: postId });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ handle: `marcus-${tag}`, example: { kind: 'pinned', post_id: postId, text: 'beige again? ok' } });
    expect((await pin({ post_id: postId })).status).toBe(409);
    const noVoice = await pin({ post_id: otherId });
    expect(noVoice.status).toBe(409);
    expect(noVoice.body.error).toBe(`@nia-${tag} has no Voice Profile yet. Build it in Voices first.`);
    await run('DELETE FROM feed_posts WHERE id IN (:postId, :otherId)', { postId, otherId });
  });

  test('Make Active (the registry edit) moves one up from not posting to the posting characters', async () => {
    const put = await as(admin, request(app).put(`/api/v1/character-registry/characters/${c.sparked}`)).send({ depth_level: 'active' });
    expect(put.status).toBe(200);
    const res = await as(editor, request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(res.body.not_posting).toEqual([]);
    expect(res.body.characters.map((x) => x.display_name)).toContain('sparked');
  });
});
