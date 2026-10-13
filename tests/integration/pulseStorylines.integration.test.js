/**
 * Storylines on The Pulse (Task #2989; The Pulse spec §4), against the test
 * database with the Anthropic calls mocked:
 * - a storyline (optionally following one of the show's threads) and its
 *   beats, admin only; a poster needs a Voice Profile;
 * - a beat whose moment has come is queued once as a `storyline` job; later
 *   beats wait until the present reaches them;
 * - the handler drafts the beat's post through the gate; a payoff always
 *   goes to Review; the storyline runs, then is paid off;
 * - a dropped storyline's beat is skipped; Suggest proposes beats and saves
 *   nothing.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const storylines = require('../../src/services/pulseStorylines');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('The Pulse storylines (Task #2989)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), other: uuid(), reg: uuid(), ep1: uuid(), ep2: uuid(), thread: uuid(), foreign: uuid() };
  const p = {};
  const c = {};
  let admin;
  let editor;
  let lineId;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const runJob = async (job, text, score = 0.9) => {
    mockCreate.mockResolvedValueOnce(say({ text, hashtag: null, reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score, why: 'them' }));
    return storylines.handleStoryline(models, await models.PulseJob.findByPk(job));
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-story', email: 'evoni@story.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-story', email: 'ed@story.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const [id, slug] of [[ids.show, 'story'], [ids.other, 'story-other']]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`, { id, name: `${slug} ${tag}`, slug: `${slug}-${tag}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO show_story_threads (id, show_id, title, created_at, updated_at) VALUES
      (:thread, :show, 'The rival house', NOW(), NOW()), (:foreign, :other, 'Elsewhere', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Story registry', :show, NOW(), NOW())`, ids);
    for (const key of ['marcus', 'kim', 'nia']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      if (key !== 'nia') {
        await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' }, examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });  // approved: the worker posts only for approved voices (Task #3029)
      }
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_storyline_beats WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_storylines WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM show_story_threads WHERE id IN (:a)', { a: [ids.thread, ids.foreign] });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id IN (:a)', { a: [ids.show, ids.other] });
  });

  test('a storyline, following one of the show\'s threads; admin only; a title; only this show\'s threads', async () => {
    const body = { show_id: ids.show, title: 'The rival house', premise: 'A rival label is quietly copying Lala\'s looks.', show_story_thread_id: ids.thread };
    expect((await as(editor, request(app).post('/api/v1/pulse-storylines')).send(body)).status).toBe(403);
    expect((await as(admin, request(app).post('/api/v1/pulse-storylines')).send({ ...body, title: ' ' })).status).toBe(400);
    expect((await as(admin, request(app).post('/api/v1/pulse-storylines')).send({ ...body, show_story_thread_id: ids.foreign })).status).toBe(400);
    const res = await as(admin, request(app).post('/api/v1/pulse-storylines')).send(body);
    expect(res.status).toBe(201);
    expect(res.body.storyline).toMatchObject({ title: 'The rival house', status: 'planned', show_story_thread_id: ids.thread });
    lineId = res.body.storyline.id;
  });

  test('beats: one whose moment has come is queued at once; later ones wait; a poster needs a voice; only a planned beat can go', async () => {
    const add = (b) => as(admin, request(app).post(`/api/v1/pulse-storylines/${lineId}/beats`)).send(b);
    expect((await add({ kind: 'twist', story_order: 15, poster_profile_id: p.marcus, brief: 'x' })).status).toBe(400);
    expect((await add({ kind: 'plant', story_order: 15, poster_profile_id: p.nia, brief: 'x' })).status).toBe(400);
    expect((await add({ kind: 'plant', story_order: 15, poster_profile_id: p.marcus, brief: '' })).status).toBe(400);
    const plant = await add({ kind: 'plant', story_order: 15, poster_profile_id: p.marcus, brief: 'notice a familiar silhouette in a shop window' });
    expect(plant.status).toBe(201);
    expect(plant.body).toMatchObject({ queued: true, engine_on: false, beat: { status: 'queued' } });
    const job = await models.PulseJob.findByPk(plant.body.beat.job_id);
    expect(job).toMatchObject({ kind: 'storyline', status: 'queued' });
    expect(job.payload_json).toEqual({ beat_id: plant.body.beat.id });
    const build = await add({ kind: 'build', story_order: 25, poster_profile_id: p.kim, brief: 'ask who designed that copycat dress' });
    expect(build.body).toMatchObject({ queued: false, beat: { status: 'planned', job_id: null } });
    const payoff = await add({ kind: 'payoff', story_order: 27, poster_profile_id: p.marcus, brief: 'reveal the rival label stole the sketches' });
    expect(payoff.body.beat.status).toBe('planned');
    const spare = await add({ kind: 'build', story_order: 26, poster_profile_id: p.kim, brief: 'spare' });
    expect((await as(admin, request(app).delete(`/api/v1/pulse-storylines/${lineId}/beats/${plant.body.beat.id}`))).status).toBe(409);
    expect((await as(admin, request(app).delete(`/api/v1/pulse-storylines/${lineId}/beats/${spare.body.beat.id}`))).status).toBe(200);
    // Queuing again changes nothing.
    expect(await storylines.queueDueBeats(models, ids.show)).toEqual([]);
  });

  test('the plant is drafted through the gate at its moment and published; the storyline runs', async () => {
    const beat = await models.PulseStorylineBeat.findOne({ where: { storyline_id: lineId, kind: 'plant' } });
    const { draftIds } = await runJob(beat.job_id, 'is it just me or is that dress everywhere now');
    await beat.reload();
    expect(beat).toMatchObject({ status: 'drafted', post_id: draftIds[0] });
    const post = await models.FeedPost.findByPk(draftIds[0]);
    expect(post).toMatchObject({ status: 'live', story_order: 15, social_profile_id: p.marcus });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("A rival label is quietly copying Lala's looks. This post should: notice a familiar silhouette in a shop window");
    expect((await models.PulseStoryline.findByPk(lineId)).status).toBe('running');
  });

  test('when the present reaches them the later beats are queued; the payoff always waits in Review; the storyline is paid off', async () => {
    await run(`UPDATE episodes SET status = 'published' WHERE id = :ep2`, ids);
    const jobs = await storylines.queueDueBeats(models, ids.show);
    expect(jobs).toHaveLength(2);
    const payoff = await models.PulseStorylineBeat.findOne({ where: { storyline_id: lineId, kind: 'payoff' } });
    const { draftIds } = await runJob(payoff.job_id, 'so the sketches were never theirs');
    const post = await models.FeedPost.findByPk(draftIds[0]);
    expect(post.status).toBe('draft');
    expect(post.gate_json.review).toContain('storyline_payoff');
    expect((await models.PulseStoryline.findByPk(lineId)).status).toBe('paid_off');
    expect((await as(admin, request(app).post(`/api/v1/pulse-storylines/${lineId}/beats`)).send({ kind: 'build', story_order: 28, poster_profile_id: p.kim, brief: 'late' })).status).toBe(409);
  });

  test("a dropped storyline's queued beat is skipped, drafting nothing", async () => {
    const res = await as(admin, request(app).post('/api/v1/pulse-storylines')).send({ show_id: ids.show, title: 'Dropped one' });
    const add = await as(admin, request(app).post(`/api/v1/pulse-storylines/${res.body.storyline.id}/beats`)).send({ kind: 'plant', story_order: 20, poster_profile_id: p.kim, brief: 'something' });
    expect(add.body.beat.status).toBe('queued');
    expect((await as(admin, request(app).put(`/api/v1/pulse-storylines/${res.body.storyline.id}`)).send({ status: 'gone' })).status).toBe(400);
    await as(admin, request(app).put(`/api/v1/pulse-storylines/${res.body.storyline.id}`)).send({ status: 'dropped' });
    const out = await storylines.handleStoryline(models, await models.PulseJob.findByPk(add.body.beat.job_id));
    expect(out).toEqual({ draftIds: [] });
    expect(mockCreate).not.toHaveBeenCalled();
    expect((await models.PulseStorylineBeat.findByPk(add.body.beat.id)).status).toBe('skipped');
  });

  test('Suggest proposes beats by characters with a voice and saves nothing; GET shows the storylines, beats, threads and the present', async () => {
    mockCreate.mockResolvedValueOnce(say({ beats: [
      { kind: 'plant', story_order: 31, handle: `@marcus${tag}`, brief: 'a blurry photo of a sketchbook' },
      { kind: 'payoff', story_order: 37, handle: `@kim${tag}`, brief: 'the label apologises' },
      { kind: 'plant', story_order: 32, handle: '@nobody', brief: 'not a poster' },
      { kind: 'twist', story_order: 33, handle: `@kim${tag}`, brief: 'not a kind' },
    ] }));
    const sug = await as(admin, request(app).post(`/api/v1/pulse-storylines/${lineId}/suggest`));
    expect(sug.status).toBe(200);
    expect(sug.body.suggestions).toEqual([
      { kind: 'plant', story_order: 31, poster_profile_id: Number(p.marcus), handle: `marcus${tag}`, brief: 'a blurry photo of a sketchbook' },
      { kind: 'payoff', story_order: 37, poster_profile_id: Number(p.kim), handle: `kim${tag}`, brief: 'the label apologises' },
    ]);
    expect(await models.PulseStorylineBeat.count({ where: { storyline_id: lineId, story_order: 31 } })).toBe(0);
    expect((await as(admin, request(app).post(`/api/v1/pulse-storylines/${uuid()}/suggest`))).status).toBe(404);

    const res = await as(editor, request(app).get(`/api/v1/pulse-storylines?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect(res.body.present).toBe(27);
    expect(res.body.threads.map((t) => t.title)).toEqual(['The rival house']);
    const line = res.body.storylines.find((s) => s.id === lineId);
    expect(line.beats.map((b) => [b.kind, b.label, b.handle, b.status])).toEqual([
      ['plant', 'During Ep 1', `marcus${tag}`, 'drafted'],
      ['build', 'During Ep 2', `kim${tag}`, 'queued'],
      ['payoff', 'After Ep 2', `marcus${tag}`, 'drafted'],
    ]);
    expect(line.beats[0].post).toMatchObject({ status: 'live' });
    expect(line.beats[2].post).toMatchObject({ status: 'draft' });
  });
});
