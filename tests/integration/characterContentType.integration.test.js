/**
 * What a character is known for on The Pulse (Evoni, 2026-10-17: "sometimes
 * a persons content can be different than what they do for work"),
 * /api/v1/cast/characters/:id/content-type and /api/v1/cast/content-types/*,
 * the Anthropic call mocked. Dana is a nurse whose feed profile has no
 * content type yet.
 * - GET: none yet, the Society tab's list, and her job;
 * - suggest: one call over her character file and the list, her job named
 *   as different from her content; the answer must be on the list (502
 *   otherwise); nothing saved;
 * - PUT: a name on the list is saved on her feed profile (one off the list
 *   is a 400; null clears it); ADMIN only; no feed profile is a 409;
 * - the character file and her post prompt then carry KNOWN FOR ON THE PULSE
 *   next to her job;
 * - the batch: suggestions for profiles with none, then apply.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('content type: what they are known for on The Pulse', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), loose: crypto.randomUUID() };
  let pid;
  let pid2;
  let admin;
  let editor;
  const base = (id = ids.char) => `/api/v1/cast/characters/${id}/content-type`;
  const auth = (r, token = admin) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-content', email: 'evoni@content.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-content', email: 'e@content.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Content ${tag}`, slug: `content-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Content', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, content_persona, created_at, updated_at)
      VALUES (:h, 'pulse', 'Night shift jokes.', 'Dana', 'lalaverse', 'PERSONA-${tag}: comedy skits about the night shift', NOW(), NOW()) RETURNING id`, { h: `@cont${tag}` });
    pid = p.id;
    const [[p2]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, content_persona, created_at, updated_at)
      VALUES (:h, 'pulse', 'Old dresses.', 'Rue', 'lalaverse', 'Vintage fashion history threads', NOW(), NOW()) RETURNING id`, { h: `@rue${tag}` });
    pid2 = p2.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Dana', :pid, CAST(:facts AS jsonb), NOW(), NOW())`,
    { ...ids, key: `cont-${tag}`, pid, facts: JSON.stringify({ occupation: 'ICU nurse' }) });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
      VALUES (:loose, :reg, :key, 'Loose', NOW(), NOW())`, { ...ids, key: `loose-${tag}` });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:pids)', { pids: [pid, pid2] });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('says she has none yet, with the list and her job', async () => {
    const res = await auth(request(app).get(base()));
    expect(res.status).toBe(200);
    expect(res.body.current).toBeNull();
    expect(res.body.occupation).toBe('ICU nurse');
    expect(res.body.list.map((a) => a.name)).toContain('The Entertainer');
    expect(res.body.profile).toMatchObject({ id: pid, display_name: 'Dana' });
  });

  it('suggests one from her character file, her job kept apart, and saves nothing', async () => {
    mockCreate.mockResolvedValue(reply({ society_archetype: 'the entertainer', why: 'Her persona is comedy skits.', differs_from_job: true, tension: 'She jokes about the job that is wearing her down.' }));
    const res = await auth(request(app).post(`${base()}/suggest`));
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toEqual({ name: 'The Entertainer', why: 'Her persona is comedy skits.', differs_from_job: true, tension: 'She jokes about the job that is wearing her down.' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    for (const part of ['Their job: ICU nurse.', 'THE CHARACTER FILE for Dana', `PERSONA-${tag}`, 'The Viral Wildcard', 'This is not their job.']) expect(prompt).toContain(part);
    const [[row]] = await run('SELECT society_archetype FROM social_profiles WHERE id = :pid', { pid });
    expect(row.society_archetype).toBeNull();
  });

  it('refuses an answer that is not on the list', async () => {
    mockCreate.mockResolvedValue(reply({ society_archetype: 'The Night Nurse', why: 'x', differs_from_job: false }));
    const res = await auth(request(app).post(`${base()}/suggest`));
    expect(res.status).toBe(502);
  });

  it('saves a name on the list (ADMIN only), refuses one off it, and clears', async () => {
    expect((await auth(request(app).put(base()), editor).send({ name: 'The Entertainer' })).status).toBe(403);
    expect((await auth(request(app).put(base())).send({ name: 'The Night Nurse' })).status).toBe(400);
    const res = await auth(request(app).put(base())).send({ name: 'entertainer' });
    expect(res.status).toBe(200);
    expect(res.body.current).toMatchObject({ name: 'The Entertainer' });
    const cleared = await auth(request(app).put(base())).send({ name: null });
    expect(cleared.body.current).toBeNull();
    await auth(request(app).put(base())).send({ name: 'The Entertainer' });
  });

  it('is a 409 for a character with no feed profile', async () => {
    expect((await auth(request(app).put(base(ids.loose))).send({ name: 'The Entertainer' })).status).toBe(409);
    expect((await auth(request(app).post(`${base(ids.loose)}/suggest`))).status).toBe(409);
  });

  it('puts KNOWN FOR ON THE PULSE in her character file and her post prompt, next to her job', async () => {
    const { characterFilePrompt } = require('../../src/services/characterFile');
    const character = await db.RegistryCharacter.findByPk(ids.char);
    const { block } = await characterFilePrompt(db, { character, publicOnly: true });
    expect(block).toContain('KNOWN FOR ON THE PULSE');
    expect(block).toContain('The Entertainer');
    expect(block).toContain('Their job is ICU nurse');

    const { buildPrompt } = require('../../src/services/characterPosts');
    const prompt = buildPrompt({
      character: { display_name: 'Dana' }, profile: { handle: '@dana', display_name: 'Dana' }, voice: {},
      facts: { occupation: 'ICU nurse', undecided: [] }, mask: 'm', wound: {}, known: '', hosting: '', recent: [], count: 1,
      contentType: { name: 'The Entertainer', content: 'Comedy, skits' },
    });
    expect(prompt).toContain('KNOWN FOR ON THE PULSE');
    expect(prompt).toContain('Their job is ICU nurse');
  });

  it('gives a post idea in her lane and one where her job meets her content', async () => {
    const res = await auth(request(app).get(`/api/v1/cast/characters/${ids.char}/posts/ideas`));
    expect(res.status).toBe(200);
    const keys = res.body.ideas.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['known_for', 'job_meets_content']));
  });

  it('suggests for profiles with none in a batch, then applies the ones kept', async () => {
    mockCreate.mockResolvedValue(reply({ society_archetype: 'The Archivist', why: 'Fashion history threads.', differs_from_job: false }));
    const res = await auth(request(app).post('/api/v1/cast/content-types/suggest-unset')).send({ profile_ids: [pid, pid2] });
    expect(res.status).toBe(200);
    expect(res.body.unset).toBe(1);
    expect(res.body.suggestions).toEqual([expect.objectContaining({ profile_id: pid2, display_name: 'Rue', name: 'The Archivist', character_id: null })]);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    expect((await auth(request(app).post('/api/v1/cast/content-types/apply'), editor).send({ items: [{ profile_id: pid2, name: 'The Archivist' }] })).status).toBe(403);
    const applied = await auth(request(app).post('/api/v1/cast/content-types/apply')).send({ items: [{ profile_id: pid2, name: 'The Archivist' }, { profile_id: pid2, name: 'Nope' }] });
    expect(applied.status).toBe(200);
    expect(applied.body.saved).toEqual([{ profile_id: pid2, name: 'The Archivist' }]);
    expect(applied.body.skipped).toHaveLength(1);
    const [[row]] = await run('SELECT society_archetype FROM social_profiles WHERE id = :pid', { pid: pid2 });
    expect(row.society_archetype).toBe('The Archivist');
    expect((await auth(request(app).post('/api/v1/cast/content-types/apply')).send({ items: [] })).status).toBe(400);
  });
});
