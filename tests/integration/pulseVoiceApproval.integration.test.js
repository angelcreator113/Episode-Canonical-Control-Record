/**
 * Evoni approves a voice before automated posting (Task #3029; Evoni,
 * 2026-10-12: "Approve their voice before automated posting starts"), with
 * the Anthropic calls mocked:
 * - approve and unapprove are ADMIN only; her edits keep an approval; a
 *   rebuild clears it;
 * - the ambient planner picks only approved voices;
 * - a queued job whose voice is not approved (or no longer is) is skipped
 *   with the reason, drafting nothing and calling no AI;
 * - a storyline beat waits, still planned, until its poster's voice is
 *   approved, and goes back to planned if approval is withdrawn after it
 *   was queued.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');
const ambient = require('../../src/services/pulseAmbient');
const storylines = require('../../src/services/pulseStorylines');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });
const HOUR = 60 * 60 * 1000;

(shouldSkip ? describe.skip : describe)('The Pulse voice approval (Task #3029)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const c = {};
  const p = {};
  const v = {};
  const was = process.env.PULSE_ENGINE_ENABLED;
  const t0 = new Date(Date.UTC(2026, 9, 12, 13, 0, 0));
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const voiceUrl = (key, action) => `/api/v1/pulse-voices/${v[key]}/${action}`;

  beforeAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-approve', email: 'evoni@approve.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-approve', email: 'ed@approve.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Approve ${tag}`, slug: `approve-${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Approve registry', :show, NOW(), NOW())`, ids);
    for (const key of ['ama', 'bo']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      const voice = await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { temperament: 'oversharer' }, examples_json: [], status: 'built' });
      v[key] = voice.id;
    }
  });

  afterEach(async () => {
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
  });

  afterAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = was;
    queue.unregister('ambient');
    queue.unregister('storyline');
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_storyline_beats WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_storylines WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('approve and unapprove are ADMIN only; edits keep the approval; a rebuild clears it', async () => {
    expect((await request(app).post(voiceUrl('ama', 'approve'))).status).toBe(401);
    expect((await as(editor, request(app).post(voiceUrl('ama', 'approve')))).status).toBe(403);
    expect((await as(editor, request(app).post(voiceUrl('ama', 'unapprove')))).status).toBe(403);

    const approved = await as(admin, request(app).post(voiceUrl('ama', 'approve')));
    expect(approved.status).toBe(200);
    expect(approved.body.voice).toMatchObject({ approved_by: 'evoni@approve.dev' });
    expect(approved.body.voice.approved_at).toBeTruthy();
    const listed = await as(admin, request(app).get(`/api/v1/pulse-voices?show_id=${ids.show}`));
    expect(listed.body.characters.find((r) => r.registry_character_id === c.ama).voice.approved_at).toBeTruthy();

    const edited = await as(admin, request(app).put(`/api/v1/pulse-voices/${v.ama}`)).send({ habits: { case: 'lowercase', temperament: 'oversharer' } });
    expect(edited.body.voice).toMatchObject({ status: 'edited', approved_by: 'evoni@approve.dev' });

    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(say({ case: 'lowercase', temperament: 'oversharer', topics: ['music'] }));
    const rebuilt = await as(admin, request(app).post(`/api/v1/pulse-voices/${c.ama}/build`));
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.voice).toMatchObject({ status: 'built', approved_at: null, approved_by: null });

    await as(admin, request(app).post(voiceUrl('ama', 'approve')));
    const withdrawn = await as(admin, request(app).post(voiceUrl('ama', 'unapprove')));
    expect(withdrawn.body.voice).toMatchObject({ approved_at: null, approved_by: null });
  });

  test('the ambient planner picks only approved voices', async () => {
    await queue.saveSettings(models, ids.show, { ambient_enabled: true, daily_draft_cap: 30 });
    expect(await ambient.planAmbient(models, ids.show, t0)).toEqual([]);
    await as(admin, request(app).post(voiceUrl('bo', 'approve')));
    const jobs = await ambient.planAmbient(models, ids.show, t0);
    expect(jobs.length).toBeGreaterThan(0);
    expect(new Set(jobs.map((j) => j.payload_json.character_id))).toEqual(new Set([c.bo]));
    await as(admin, request(app).post(voiceUrl('bo', 'unapprove')));
  });

  test('a queued job whose voice is not approved is skipped with the reason, drafting nothing', async () => {
    ambient.registerHandlers();
    const job = await queue.enqueue(models, { showId: ids.show, kind: 'ambient', payload: { character_id: c.ama, moment: 7, window: 'x' } });
    mockCreate.mockReset();
    const ran = await queue.runOne(models);
    expect(ran.id).toBe(job.id);
    await ran.reload();
    expect(ran.status).toBe('skipped');
    expect(ran.error).toBe("ama's voice is waiting for approval in Admin › The Pulse › Voices.");
    expect(mockCreate).not.toHaveBeenCalled();
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM feed_posts WHERE show_id = :show', ids);
    expect(n).toBe(0);
  });

  test('a storyline beat waits, planned, until its poster is approved; withdrawn after queueing, it goes back to planned', async () => {
    storylines.registerHandlers();
    const story = await models.PulseStoryline.create({ show_id: ids.show, title: 'The rumour', status: 'running' });
    const beat = await models.PulseStorylineBeat.create({
      storyline_id: story.id, show_id: ids.show, kind: 'plant', story_order: 0, poster_profile_id: p.ama, brief: 'hint at it', status: 'planned',
    });
    expect(await storylines.queueDueBeats(models, ids.show)).toEqual([]);
    expect((await beat.reload()).status).toBe('planned');

    await as(admin, request(app).post(voiceUrl('ama', 'approve')));
    const [job] = await storylines.queueDueBeats(models, ids.show);
    expect(job).toBeTruthy();
    expect((await beat.reload()).status).toBe('queued');

    await as(admin, request(app).post(voiceUrl('ama', 'unapprove')));
    mockCreate.mockReset();
    await models.PulseJob.update({ run_after: new Date(Date.now() + HOUR) }, { where: { show_id: ids.show, status: 'queued', id: { [require('sequelize').Op.ne]: job.id } } });
    const ran = await queue.runOne(models);
    expect(ran.id).toBe(job.id);
    await ran.reload();
    expect(ran.status).toBe('skipped');
    expect(ran.error).toMatch(/waiting for approval/);
    expect(mockCreate).not.toHaveBeenCalled();
    expect((await beat.reload())).toMatchObject({ status: 'planned', job_id: null });
  });
});
