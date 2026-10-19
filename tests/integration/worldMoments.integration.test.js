/**
 * Scheduled world moments (services/worldMoments; Evoni, 2026-10-18), with
 * the Anthropic calls mocked:
 * - ADMIN only;
 * - the plan comes from the show's calendar; Evoni's edits are checked and saved;
 * - "Draft these": a city event becomes a world_events DRAFT, a press piece
 *   and a trend post are queued for the posting engine, never drafted in the
 *   request; a drafted moment is not drafted again;
 * - the automatic run does nothing unless WORLD_MOMENTS_ENABLED is on AND the
 *   show's switch is on, and nothing once today's AI budget is used; then it
 *   drafts at most MAX_PER_RUN;
 * - the worker drafts a trend post by a creator in that city, through the
 *   gate, and schedules it on its day (never live at once); a press piece with
 *   nothing in the writer's beat that week is skipped.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');
const moments = require('../../src/services/worldMoments');
const tracker = require('../../src/services/aiCostTracker');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('Scheduled world moments', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const chars = [];
  const profiles = [];
  let admin;
  let user;
  const was = { flag: process.env.WORLD_MOMENTS_ENABLED };
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  // Monday; the next week holds every default kind.
  const monday = new Date(Date.now() + 2 * 86400000);
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7));

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-moments', email: 'evoni@moments.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-moments', email: 'user@moments.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Moments ${tag}`, slug: `moments-${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Moments registry', :show, NOW(), NOW())`, ids);
    // Two creators in Dazzle District with approved voices, one in Echo Park.
    for (const [i, city] of [['a', 'dazzle_district'], ['b', 'dazzle_district'], ['c', 'echo_park']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :city, NOW(), NOW()) RETURNING id`, { handle: `${i}${tag}`, display: `${i}${tag}`, city });
      profiles.push(row.id);
      const id = uuid();
      chars.push(id);
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id, reg: ids.reg, key: `${i}-${tag}`, name: `${i}${tag}`, feed: row.id });
      await models.PulseVoice.create({ registry_character_id: id, social_profile_id: row.id, habits_json: { temperament: 'regular' }, examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    }
  });

  afterAll(async () => {
    process.env.WORLD_MOMENTS_ENABLED = was.flag;
    if (was.flag === undefined) delete process.env.WORLD_MOMENTS_ENABLED;
    queue.unregister('moment');
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids).catch(() => {});
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids).catch(() => {});
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: chars });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: profiles });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('ADMIN only', async () => {
    const res = await as(request(app).get(`/api/v1/world-moments?show_id=${ids.show}`), user);
    expect(res.status).toBe(403);
  });

  test('the plan comes from the calendar; the automatic switch starts off and says it needs the server flag', async () => {
    const res = await as(request(app).get(`/api/v1/world-moments?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect(res.body.settings.auto_enabled).toBe(false);
    expect(res.body.settings.cities.dazzle_district.map((e) => e.id)).toEqual(['runway_thursday', 'couture_preview']);
    expect(res.body.server).toHaveProperty('world_moments_enabled');
    const kinds = new Set(res.body.plan.moments.map((m) => m.kind));
    expect(kinds.has('city_event')).toBe(true);
    expect(kinds.has('press')).toBe(true);
    expect(kinds.has('trend')).toBe(true);
  });

  test("Evoni's edits are checked, and saved without touching the show's other settings", async () => {
    await queue.saveSettings(models, ids.show, { automated_requests: 30 });
    const bad = await as(request(app).put('/api/v1/world-moments/settings')).send({ show_id: ids.show, cities: { dazzle_district: [{ label: 'X', every: 'daily', weekday: 1 }] } });
    expect(bad.status).toBe(400);
    const ok = await as(request(app).put('/api/v1/world-moments/settings')).send({
      show_id: ids.show, trends: { weekday: 2 }, press: { asha_brennan: { on: false } },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.settings.press.asha_brennan.on).toBe(false);
    expect((await queue.settingsOf(models, ids.show)).automated_requests).toBe(30);
  });

  test('Draft these: an event becomes a draft now; press and trend posts are queued, not drafted; nothing twice', async () => {
    mockCreate.mockReset();
    const { moments: plan } = await moments.planMoments(models, { showId: ids.show, from: monday, days: 7 });
    const event = plan.find((m) => m.key.startsWith('city_event:dazzle_district:runway_thursday'));
    const trend = plan.find((m) => m.kind === 'trend' && m.city === 'dazzle_district');
    const press = plan.find((m) => m.kind === 'press' && m.press === 'reyna_voss');
    const res = await as(request(app).post('/api/v1/world-moments/draft')).send({ show_id: ids.show, keys: [event.key, trend.key, press.key] });
    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.status)).toEqual(['drafted', 'queued', 'queued']);
    expect(mockCreate).not.toHaveBeenCalled();
    const [ev] = await q("SELECT name, status, category, format, location_hint, canon_consequences FROM world_events WHERE show_id = :show", ids);
    expect(ev).toMatchObject({ name: 'Runway Thursday · Dazzle District', status: 'draft', category: 'fashion', format: 'showcase', location_hint: 'Dazzle District' });
    const cc = typeof ev.canon_consequences === 'string' ? JSON.parse(ev.canon_consequences) : ev.canon_consequences;
    expect(cc.world_moment.key).toBe(event.key);
    const jobs = await q("SELECT kind, status, payload_json FROM pulse_jobs WHERE show_id = :show ORDER BY created_at", ids);
    expect(jobs.map((j) => [j.kind, j.status])).toEqual([['moment', 'queued'], ['moment', 'queued']]);
    const again = await as(request(app).post('/api/v1/world-moments/draft')).send({ show_id: ids.show, keys: [event.key] });
    expect(again.body.results).toEqual([{ key: event.key, status: 'skipped', why: 'Already drafted.' }]);
    const view = await as(request(app).get(`/api/v1/world-moments?show_id=${ids.show}`));
    expect(view.body.recent.map((r) => r.key)).toEqual(expect.arrayContaining([event.key, trend.key, press.key]));
  });

  test('the worker drafts the trend post by a creator in the city, through the gate, scheduled on its day', async () => {
    moments.registerHandlers();
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(say({ text: 'everyone is cutting their sleeves now', hashtag: '#SleeveCut', reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.9, why: 'them' }));
    const [job] = await q("SELECT id, payload_json FROM pulse_jobs WHERE show_id = :show AND payload_json->>'kind' = 'trend'", ids);
    await models.PulseJob.update({ run_after: new Date(Date.now() + 3600000) }, { where: { show_id: ids.show, status: 'queued' } });
    await models.PulseJob.update({ run_after: new Date(0) }, { where: { id: job.id } });
    const ran = await queue.runOne(models);
    expect(ran.id).toBe(job.id);
    await ran.reload();
    expect(ran.status).toBe('done');
    const post = await models.FeedPost.findByPk(ran.draft_ids[0]);
    expect(post.status).toBe('draft');
    expect(post.release_state).toBe('scheduled');
    expect(new Date(post.release_at).getTime()).toBeGreaterThanOrEqual(new Date(`${job.payload_json.date}T00:00:00Z`).getTime());
    expect(profiles.slice(0, 2).map(Number)).toContain(Number(post.social_profile_id));
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('Dazzle District');
    const entry = (await moments.calendarOf(models, ids.show)).drafted.find((d) => d.key === job.payload_json.key);
    expect(entry).toMatchObject({ status: 'scheduled', post_id: post.id, hashtag: '#SleeveCut' });
  });

  test("a press piece with nothing in the writer's beat that week is skipped, with no AI call", async () => {
    mockCreate.mockReset();
    const [job] = await q("SELECT id, payload_json FROM pulse_jobs WHERE show_id = :show AND payload_json->>'kind' = 'press'", ids);
    const out = await moments.handleMoment(models, { id: job.id, show_id: ids.show, payload_json: job.payload_json });
    expect(out.skipped).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('the automatic run: nothing without the server flag, nothing with the switch off, nothing over the budget', async () => {
    delete process.env.WORLD_MOMENTS_ENABLED;
    expect(await moments.runScheduled(models, ids.show)).toMatchObject({ ran: false });
    process.env.WORLD_MOMENTS_ENABLED = 'true';
    expect(await moments.runScheduled(models, ids.show)).toEqual({ ran: false, why: "The show's switch is off." });
    await moments.saveSettings(models, ids.show, { auto_enabled: true });
    const spend = jest.spyOn(tracker, 'getFreshDailySpend').mockResolvedValue(tracker.DAILY_BUDGET + 1);
    expect(await moments.runScheduled(models, ids.show)).toEqual({ ran: false, why: "Today's AI budget is used." });
    spend.mockRestore();
  });

  test('switched on: the run drafts what is due in the next week, at most MAX_PER_RUN, and the tick finds the show', async () => {
    process.env.WORLD_MOMENTS_ENABLED = 'true';
    jest.spyOn(tracker, 'getFreshDailySpend').mockResolvedValue(0);
    const before = (await moments.calendarOf(models, ids.show)).drafted.length;
    const out = await moments.runScheduled(models, ids.show);
    expect(out.ran).toBe(true);
    expect(out.drafted).toBeGreaterThan(0);
    expect(out.drafted).toBeLessThanOrEqual(moments.MAX_PER_RUN);
    expect((await moments.calendarOf(models, ids.show)).drafted.length).toBe(before + out.drafted);
    const ticked = await moments.tick(models);
    expect(ticked.map((t) => t.show_id)).toContain(ids.show);
    tracker.getFreshDailySpend.mockRestore();
    delete process.env.WORLD_MOMENTS_ENABLED;
  });
});
