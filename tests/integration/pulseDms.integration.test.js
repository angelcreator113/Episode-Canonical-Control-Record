/**
 * DMs on The Pulse (Task #2984; The Pulse spec §3), against the test database
 * with the Anthropic calls mocked (the message, then the gate's voice score):
 * - opening a conversation queues its first message (a `dm` job); the
 *   request never drafts; the pair keeps one thread;
 * - the queue's handler drafts in the sender's voice from the conversation
 *   so far, with Living State only as private context, gates it, and leaves
 *   it a draft (every DM waits for Evoni);
 * - the next message defaults to the other one in the conversation;
 * - approve, edit, reject (admin only, once); with ?at= only live messages at
 *   or before the moment show, without the gate or drafts.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const dms = require('../../src/services/pulseDms');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const SECRET = 'still not over the brand deal falling through';

(shouldSkip ? describe.skip : describe)('The Pulse DMs (Task #2984)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep1: uuid() };
  const p = {};
  const c = {};
  let lala;
  let madeLala = false;
  let lalaHadVoice = false;
  let admin;
  let editor;
  let threadId;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  /** Runs the newest queued dm job's handler with a mocked message and voice score. */
  const runJob = async (jobId, text, score = 0.9) => {
    mockCreate.mockResolvedValueOnce(say({ text }));
    mockCreate.mockResolvedValueOnce(say({ score, why: 'them' }));
    return dms.handleDm(models, await models.PulseJob.findByPk(jobId));
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-dms', email: 'evoni@dms.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-dms', email: 'ed@dms.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `DMs ${tag}`, slug: `dms-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'DMs registry', :show, NOW(), NOW())`, ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    p.lala = lala;
    lalaHadVoice = Boolean(await models.PulseVoice.findOne({ where: { social_profile_id: lala } }));
    for (const key of ['marcus', 'nia']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: `${key}${tag}` });
      p[key] = row.id;
    }
    for (const key of ['lala', 'marcus']) {
      if (key === 'lala' && lalaHadVoice) continue;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, living_state, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, CAST(:state AS jsonb), NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key], state: JSON.stringify({ worry: SECRET }) });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase' },
        examples_json: [{ id: uuid(), text: 'ok but who approved beige', kind: 'pinned' }], status: 'built' });
    }
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM pulse_dm_messages WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_dm_threads WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [p.marcus, p.nia, ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('opening a conversation queues its first message and drafts nothing; the pair keeps one thread', async () => {
    const body = { show_id: ids.show, profile_a_id: p.marcus, profile_b_id: lala, sender_profile_id: lala, story_order: 17, topic: 'the gala afterparty' };
    expect((await as(editor, request(app).post('/api/v1/pulse-dms')).send(body)).status).toBe(403);
    expect((await as(admin, request(app).post('/api/v1/pulse-dms')).send({ ...body, sender_profile_id: undefined })).status).toBe(400);
    expect((await as(admin, request(app).post('/api/v1/pulse-dms')).send({ ...body, profile_b_id: p.marcus })).status).toBe(400);
    const res = await as(admin, request(app).post('/api/v1/pulse-dms')).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, engine_on: false });
    threadId = res.body.thread_id;
    const job = await models.PulseJob.findByPk(res.body.job_id);
    expect(job).toMatchObject({ kind: 'dm', status: 'queued' });
    expect(job.payload_json).toEqual({ thread_id: threadId, sender_profile_id: Number(lala), at: 17 });
    expect(mockCreate).not.toHaveBeenCalled();
    const thread = await models.PulseDmThread.findByPk(threadId);
    expect([thread.profile_a_id, thread.profile_b_id]).toEqual([Math.min(lala, p.marcus), Math.max(lala, p.marcus)]);
    expect(thread).toMatchObject({ opened_story_order: 17, topic: 'the gala afterparty' });
    // Opening again (either way round) reuses the thread.
    const again = await as(admin, request(app).post('/api/v1/pulse-dms')).send({ ...body, profile_a_id: lala, profile_b_id: p.marcus });
    expect(again.body.thread_id).toBe(threadId);

    // The handler drafts Lala's opener in her voice; it stays a draft, gated, waiting for Evoni.
    const { draftIds } = await runJob(res.body.job_id, 'u up? still thinking about tonight');
    const first = await models.PulseDmMessage.findByPk(draftIds[0]);
    expect(first).toMatchObject({ status: 'draft', sender_profile_id: Number(lala), story_order: 17, text: 'u up? still thinking about tonight', ai_generated: true });
    expect(first.gate_json).toMatchObject({ pass: true, voice: 0.9 });
    expect(first.gate_json.review).toEqual(['dm', 'lala']);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('(nothing yet: you write first)');
    expect(prompt).toContain('What the conversation is about: the gala afterparty.');
    expect(prompt).toMatch(/PRIVATE \(shapes the mood only; never state/);
  });

  test('the next message defaults to the other one, sees the conversation so far, and a flagged one is still only a draft', async () => {
    const res = await as(admin, request(app).post(`/api/v1/pulse-dms/${threadId}/next`)).send({});
    expect(res.status).toBe(201);
    const job = await models.PulseJob.findByPk(res.body.job_id);
    expect(job.payload_json.sender_profile_id).toBe(Number(p.marcus));
    const { draftIds } = await runJob(res.body.job_id, `lowkey ${SECRET}`);
    const reply = await models.PulseDmMessage.findByPk(draftIds[0]);
    expect(reply).toMatchObject({ status: 'draft', sender_profile_id: Number(p.marcus), story_order: 17 });
    expect(reply.gate_json.flags.map((f) => f.code)).toContain('private_state');
    expect(reply.gate_json.review).toEqual(['dm', 'gate']);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('Them: u up? still thinking about tonight');
    expect((await as(admin, request(app).post(`/api/v1/pulse-dms/${threadId}/next`)).send({ sender_profile_id: p.nia })).status).toBe(400);
  });

  test('a sender with no Voice Profile is refused, saying where to build one', async () => {
    const thread = await dms.openThread(models, { showId: ids.show, a: p.nia, b: p.marcus, at: 17 });
    await expect(dms.draftMessage(models, { threadId: thread.id, senderProfileId: p.nia })).rejects.toThrow(/has no Voice Profile yet/);
    await thread.destroy({ force: true });
  });

  test('Review sees drafts with the gate; ?at= shows only live messages at or before the moment', async () => {
    const director = await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}`));
    expect(director.status).toBe(200);
    const t = director.body.threads.find((x) => x.id === threadId);
    expect(t.messages.map((m) => m.status)).toEqual(['draft', 'draft']);
    expect(t.messages[0].gate).toMatchObject({ review: ['dm', 'lala'] });
    expect(t.topic).toBe('the gala afterparty');
    expect(t.profiles.map((x) => x.handle).sort()).toEqual(['lala', `marcus${tag}`].sort());
    expect((await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}&at=17`))).body.threads).toEqual([]);

    const [lalaMsg, marcusMsg] = t.messages;
    const put = (id, body, token = admin) => as(token, request(app).put(`/api/v1/pulse-dms/messages/${id}`)).send(body);
    expect((await put(lalaMsg.id, { action: 'approve' }, editor)).status).toBe(403);
    expect((await put(lalaMsg.id, { action: 'shrug' })).status).toBe(400);
    expect((await put(lalaMsg.id, { action: 'approve' })).body.message).toMatchObject({ status: 'live', decided_by: 'evoni@dms.dev' });
    expect((await put(lalaMsg.id, { action: 'approve' })).status).toBe(409);
    expect((await put(marcusMsg.id, { action: 'edit' })).status).toBe(400);
    expect((await put(marcusMsg.id, { action: 'edit', text: 'lol yes. that dj tho' })).body.message).toMatchObject({ status: 'live', text: 'lol yes. that dj tho' });

    const lalaView = await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}&at=ep:1:after_episode&profile_id=${lala}`));
    expect(lalaView.body.at).toBe(17);
    expect(lalaView.body.threads).toHaveLength(1);
    expect(lalaView.body.threads[0].messages.map((m) => m.text)).toEqual(['u up? still thinking about tonight', 'lol yes. that dj tho']);
    expect(lalaView.body.threads[0].messages[0]).not.toHaveProperty('gate');
    expect(lalaView.body.threads[0].messages[0]).not.toHaveProperty('status');
    expect(lalaView.body.threads[0]).not.toHaveProperty('topic');
    expect((await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}&at=16`))).body.threads).toEqual([]);
    expect((await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}&at=nope`))).status).toBe(400);
  });

  test('a rejected message never shows, and the next one still goes to the other side', async () => {
    const res = await as(admin, request(app).post(`/api/v1/pulse-dms/${threadId}/next`)).send({ story_order: 18 });
    expect((await models.PulseJob.findByPk(res.body.job_id)).payload_json).toMatchObject({ sender_profile_id: Number(lala), at: 18 });
    const { draftIds } = await runJob(res.body.job_id, 'wait who told you that');
    expect((await as(admin, request(app).put(`/api/v1/pulse-dms/messages/${draftIds[0]}`)).send({ action: 'reject' })).body.message.status).toBe('rejected');
    const view = await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}&at=18`));
    expect(view.body.threads[0].messages).toHaveLength(2);
    const director = await as(admin, request(app).get(`/api/v1/pulse-dms?show_id=${ids.show}`));
    expect(director.body.threads.find((x) => x.id === threadId).messages).toHaveLength(2);
  });
});
