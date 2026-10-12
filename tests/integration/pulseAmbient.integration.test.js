/**
 * Ambient posts (Task #2971; The Pulse spec §7; Evoni, 2026-10-12: off until
 * she turns it on), with the Anthropic calls mocked:
 * - nothing is planned while the engine or the show's ambient switch is off;
 * - switched on, a window's jobs are queued once, at the present story
 *   moment, skipping anyone who posted in the last day, within the day's
 *   ambient share of the cap;
 * - the hourly tick plans only shows with ambient on;
 * - the handler drafts in voice through the gate.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');
const ambient = require('../../src/services/pulseAmbient');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const HOUR = 60 * 60 * 1000;

(shouldSkip ? describe.skip : describe)('The Pulse ambient posts (Task #2971)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), quiet: uuid(), reg: uuid() };
  const c = {};
  const p = {};
  const was = process.env.PULSE_ENGINE_ENABLED;
  // A moment inside one window, and one a window later.
  const t0 = new Date(Date.UTC(2026, 9, 12, 13, 0, 0));
  const t1 = new Date(t0.getTime() + ambient.WINDOW_HOURS * HOUR);

  beforeAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    for (const show of [ids.show, ids.quiet]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
        { show, name: `Ambient ${show.slice(0, 8)}`, slug: `ambient-${show.slice(0, 8)}` });
    }
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Ambient registry', :show, NOW(), NOW())`, ids);
    // Five oversharers, so a window always has someone to pick.
    for (let i = 0; i < 5; i += 1) {
      const key = `o${i}`;
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: `${key}${tag}` });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { temperament: 'oversharer' }, examples_json: [], status: 'built' });
    }
  });

  afterEach(async () => {
    await run('DELETE FROM pulse_jobs WHERE show_id IN (:show, :quiet)', ids);
  });

  afterAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = was;
    queue.unregister('ambient');
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id IN (:show, :quiet)', ids);
  });

  test('nothing while the engine is off, or while the show\'s ambient switch is off (the default)', async () => {
    expect(await ambient.planAmbient(models, ids.show, t0)).toEqual([]);
    process.env.PULSE_ENGINE_ENABLED = 'false';
    await queue.saveSettings(models, ids.show, { ambient_enabled: true });
    expect(await ambient.planAmbient(models, ids.show, t0)).toEqual([]);
    process.env.PULSE_ENGINE_ENABLED = 'true';
  });

  test('switched on: a window\'s jobs once, at the present moment; the next window plans again', async () => {
    await queue.saveSettings(models, ids.show, { ambient_enabled: true, daily_draft_cap: 30 });
    const jobs = await ambient.planAmbient(models, ids.show, t0);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.length).toBeLessThanOrEqual(ambient.PER_WINDOW);
    for (const j of jobs) {
      expect(j).toMatchObject({ kind: 'ambient', status: 'queued' });
      expect(j.payload_json).toMatchObject({ moment: 7, window: String(ambient.windowOf(t0)) });
    }
    expect(await ambient.planAmbient(models, ids.show, new Date(t0.getTime() + HOUR))).toEqual([]);
    expect((await ambient.planAmbient(models, ids.show, t1)).length).toBeGreaterThan(0);
  });

  test("the day's ambient share of the cap: with a cap of 2, one ambient draft a day at most", async () => {
    await queue.saveSettings(models, ids.show, { ambient_enabled: true, daily_draft_cap: 2 });
    expect(await ambient.planAmbient(models, ids.show, t0)).toHaveLength(1);
    expect(await ambient.planAmbient(models, ids.show, t1)).toEqual([]);
    await queue.saveSettings(models, ids.show, { daily_draft_cap: 30 });
  });

  test('anyone who posted in the last day is skipped', async () => {
    for (const key of Object.keys(p)) {
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, created_at, updated_at)
                 VALUES (:id, :show, :h, :pid, 'hi', 'live', NOW(), NOW())`, { id: uuid(), show: ids.show, h: key, pid: p[key] });
    }
    expect(await ambient.planAmbient(models, ids.show, new Date())).toEqual([]);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
  });

  test('the hourly tick plans only shows with ambient on', async () => {
    await queue.saveSettings(models, ids.show, { ambient_enabled: true });
    const jobs = await ambient.tick(models, t0);
    expect(jobs.length).toBeGreaterThan(0);
    expect(new Set(jobs.map((j) => j.show_id))).toEqual(new Set([ids.show]));
  });

  test('the handler drafts in voice through the gate, with no event', async () => {
    ambient.registerHandlers();
    await queue.saveSettings(models, ids.show, { ambient_enabled: true });
    const [job] = await ambient.planAmbient(models, ids.show, t0);
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(say({ text: 'quiet sunday, new playlist', hashtag: null, reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.88, why: 'them' }));
    // Run this job (other queued jobs from the plan wait).
    await models.PulseJob.update({ run_after: new Date(Date.now() + HOUR) }, { where: { show_id: ids.show, status: 'queued' } });
    await job.update({ run_after: new Date(0) });
    const ran = await queue.runOne(models);
    expect(ran.id).toBe(job.id);
    await ran.reload();
    expect(ran.status).toBe('done');
    const post = await models.FeedPost.findByPk(ran.draft_ids[0]);
    expect(post).toMatchObject({ status: 'live', story_order: 7, episode_id: null, content_text: 'quiet sunday, new playlist' });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('an ordinary day');
  });
});
