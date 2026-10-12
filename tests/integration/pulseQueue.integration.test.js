/**
 * The Pulse's posting queue and daily draft cap (Task #2968; The Pulse spec
 * §7; Evoni, 2026-10-12):
 * - jobs are claimed once, even by two workers at the same moment;
 * - a job past the day's draft cap is skipped with a reason, never run;
 * - a failing job backs off and retries, then fails;
 * - the cap and the ambient switch (off by default) live in the show's
 *   metadata.pulse_engine, and saving them keeps every other metadata key;
 * - settings are admin only; the state read shows today's drafts.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse posting queue (Task #2968)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), other: uuid() };
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const later = new Date(Date.now() + 60 * 60 * 1000);

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-queue', email: 'evoni@queue.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-queue', email: 'ed@queue.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const show of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST(:meta AS json), NOW(), NOW())`,
        { show, name: `Queue ${show.slice(0, 8)}`, slug: `queue-${show.slice(0, 8)}`, meta: JSON.stringify({ pulse_cover: { url: 'cover.jpg' }, tagline: 'keep me' }) });
    }
  });

  afterEach(async () => {
    for (const kind of queue.KINDS) queue.unregister(kind);
    await run('DELETE FROM pulse_jobs WHERE show_id IN (:show, :other)', ids);
  });

  afterAll(async () => {
    await run('DELETE FROM shows WHERE id IN (:show, :other)', ids);
  });

  test('settings: defaults (cap 30, ambient off); saving keeps the other metadata; admin only; checked', async () => {
    expect(await queue.settingsOf(models, ids.show)).toEqual({ daily_draft_cap: 30, ambient_enabled: false });
    expect((await request(app).get(`/api/v1/pulse-engine?show_id=${ids.show}`)).status).toBe(401);
    const put = (body, token = admin) => as(token, request(app).put('/api/v1/pulse-engine')).send({ show_id: ids.show, ...body });
    expect((await put({ daily_draft_cap: 5 }, editor)).status).toBe(403);
    expect((await put({ daily_draft_cap: -1 })).status).toBe(400);
    expect((await put({ daily_draft_cap: 501 })).status).toBe(400);
    expect((await put({ ambient_enabled: 'yes' })).status).toBe(400);
    expect((await put({ daily_draft_cap: 5 }, admin)).body).toMatchObject({ settings: { daily_draft_cap: 5, ambient_enabled: false } });
    const res = await put({ ambient_enabled: true });
    expect(res.body).toMatchObject({ settings: { daily_draft_cap: 5, ambient_enabled: true }, drafts_today: 0, cap_left: 5, worker_enabled: false });
    const [[{ metadata }]] = await run('SELECT metadata FROM shows WHERE id = :show', ids);
    expect(metadata).toMatchObject({ pulse_cover: { url: 'cover.jpg' }, tagline: 'keep me', pulse_engine: { daily_draft_cap: 5, ambient_enabled: true } });
    expect((await as(admin, request(app).put('/api/v1/pulse-engine')).send({ show_id: uuid(), daily_draft_cap: 3 })).status).toBe(404);
    await queue.saveSettings(models, ids.show, { daily_draft_cap: 30, ambient_enabled: false });
  });

  test('a job runs its handler once, records its drafts, and counts toward today', async () => {
    const seen = [];
    queue.register('event', async (db, job) => { seen.push(job.payload_json.who); return { draftIds: [uuid()] }; });
    const job = await queue.enqueue(models, { showId: ids.show, kind: 'event', payload: { who: 'marcus' } });
    expect(job.status).toBe('queued');
    const ran = await queue.runOne(models);
    expect(ran.id).toBe(job.id);
    await ran.reload();
    expect(ran).toMatchObject({ status: 'done', attempts: 1, error: null });
    expect(ran.draft_ids).toHaveLength(1);
    expect(seen).toEqual(['marcus']);
    expect(await queue.draftsToday(models, ids.show)).toBe(1);
    expect(await queue.runOne(models)).toBeNull();
    const state = await as(editor, request(app).get(`/api/v1/pulse-engine?show_id=${ids.show}`));
    expect(state.body).toMatchObject({ drafts_today: 1, cap_left: 29 });
    expect(state.body.jobs[0]).toMatchObject({ id: job.id, kind: 'event', status: 'done', drafts: 1 });
  });

  test('two workers at the same moment never take the same job', async () => {
    const a = await queue.enqueue(models, { showId: ids.show, kind: 'event' });
    const b = await queue.enqueue(models, { showId: ids.show, kind: 'event' });
    const claimed = await Promise.all([queue.claimNext(models), queue.claimNext(models), queue.claimNext(models)]);
    const got = claimed.filter(Boolean).map((j) => j.id).sort();
    expect(got).toEqual([a.id, b.id].sort());
  });

  test('the daily cap: a job past it is skipped with a reason and its handler never runs', async () => {
    await queue.saveSettings(models, ids.show, { daily_draft_cap: 2 });
    let calls = 0;
    queue.register('ambient', async () => { calls += 1; return { draftIds: [uuid()] }; });
    for (let i = 0; i < 3; i += 1) await queue.enqueue(models, { showId: ids.show, kind: 'ambient' });
    const jobs = [await queue.runOne(models), await queue.runOne(models), await queue.runOne(models)];
    for (const j of jobs) await j.reload();
    expect(jobs.map((j) => j.status)).toEqual(['done', 'done', 'skipped']);
    expect(jobs[2].error).toBe('The daily draft cap (2) was reached for today.');
    expect(calls).toBe(2);
    // Another show's cap is its own.
    await queue.enqueue(models, { showId: ids.other, kind: 'ambient' });
    expect((await (await queue.runOne(models)).reload()).status).toBe('done');
    await queue.saveSettings(models, ids.show, { daily_draft_cap: 30 });
  });

  test('a failing job backs off and retries, then fails; a kind with no handler fails at once', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let tries = 0;
    queue.register('comment', async () => { tries += 1; throw new Error(`boom ${tries}`); });
    const job = await queue.enqueue(models, { showId: ids.show, kind: 'comment', maxAttempts: 2 });
    const t0 = new Date();
    await queue.runOne(models, { now: t0 });
    await job.reload();
    expect(job).toMatchObject({ status: 'queued', attempts: 1, error: 'boom 1' });
    expect(new Date(job.run_after).getTime()).toBe(t0.getTime() + queue.BACKOFF_MS);
    expect(await queue.runOne(models, { now: t0 })).toBeNull();
    await queue.runOne(models, { now: later });
    await job.reload();
    expect(job).toMatchObject({ status: 'failed', attempts: 2, error: 'boom 2' });

    const orphan = await queue.enqueue(models, { showId: ids.show, kind: 'event' });
    await queue.runOne(models);
    await orphan.reload();
    expect(orphan).toMatchObject({ status: 'failed', error: 'No handler for event jobs yet.' });
    console.error.mockRestore();
  });

  test('a job lost mid-run goes back in the queue; only known kinds are queued', async () => {
    const job = await queue.enqueue(models, { showId: ids.show, kind: 'event' });
    await job.update({ status: 'running', started_at: new Date(Date.now() - queue.STALE_MS - 1000) });
    expect(await queue.requeueStale(models)).toBe(1);
    expect((await job.reload()).status).toBe('queued');
    await expect(queue.enqueue(models, { showId: ids.show, kind: 'poll' })).rejects.toThrow('kind must be one of event, ambient, comment, dm, storyline.');
    expect(() => queue.register('poll', () => {})).toThrow('Unknown Pulse job kind: poll');
  });
});
