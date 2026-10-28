/**
 * V-1 and its follow-up (Evoni, 2026-10-28): who may change a legacy voice
 * clip (/api/v1/script-voice-clips). The real app, real tokens and Postgres;
 * only S3 is faked. Recording a clip (new, or over a line's clip) is for
 * admins; removing one is for its recorder or an admin (403 NOT_CLIP_OWNER
 * otherwise); while Voice Studio is on, every write is a 409
 * VOICE_CLIPS_FROZEN. Nothing refused sends a file to S3; without a
 * sign-in, a 401.
 */
// The test setup's uuid stand-in isn't a UUID, and these ids go to UUID columns.
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));
jest.mock('../../src/services/rawClipMedia', () => {
  const actual = jest.requireActual('../../src/services/rawClipMedia');
  return {
    ...actual,
    uploadFile: jest.fn(async (_p, key) => `https://s3.example/${key}`),
    removeFile: jest.fn(async () => {}),
  };
});

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/rawClipMedia');
const voice = require('../../src/services/scriptVoiceClipsService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const AUDIO = Buffer.from('not really audio');

(shouldSkip ? describe.skip : describe)('Legacy voice clips: owner or admin (V-1, Postgres)', () => {
  const show = uuid();
  const episodes = [];
  const OWNER = 'test-v1-owner';
  const OTHER = 'test-v1-other';
  const ADMIN = 'test-v1-admin';
  const token = (id, groups) => TokenService.generateTokenPair({ id, email: `${id}@v1.dev`, name: id, groups, role: groups[0] }).accessToken;
  let owner;
  let other;
  let admin;

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `v1-${show.slice(0, 8)}` });
    owner = token(OWNER, ['USER']);
    other = token(OTHER, ['USER']);
    admin = token(ADMIN, ['ADMIN']);
  });

  afterAll(async () => {
    if (episodes.length) {
      await run('DELETE FROM script_voice_clips WHERE episode_id IN (:e)', { e: episodes });
      await run('DELETE FROM episodes WHERE id IN (:e)', { e: episodes });
    }
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  beforeEach(() => { media.uploadFile.mockClear(); });

  const makeEpisode = async () => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'V1', :n, 'draft', '', '[]'::jsonb, NOW(), NOW())`, { ep, show, n: 7000 + episodes.length });
    return ep;
  };
  const upload = (ep, tok, line = 0) => {
    let r = request(app).post(`/api/v1/script-voice-clips/${ep}`);
    if (tok) r = r.set('Authorization', `Bearer ${tok}`);
    return r.field('beat_number', '3').field('line_index', String(line)).field('speaker', 'Lala').field('line_text', 'Gorgeous.')
      .attach('audio', AUDIO, { filename: 'voice.webm', contentType: 'audio/webm' });
  };
  const remove = (ep, id, tok) => {
    const r = request(app).delete(`/api/v1/script-voice-clips/${ep}/${id}`);
    return tok ? r.set('Authorization', `Bearer ${tok}`) : r;
  };
  const live = (ep) => rows('SELECT id, line_index, created_by FROM script_voice_clips WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY line_index', { ep });

  // A clip recorded by someone who is not an admin (before recording was admin only).
  const clipBy = async (ep, who, line = 0) => {
    const id = uuid();
    await run(`INSERT INTO script_voice_clips (id, episode_id, beat_number, line_index, speaker, line_text, s3_key, url, created_by, created_at, updated_at)
      VALUES (:id, :ep, 3, :line, 'Lala', 'Gorgeous.', 'k', 'u', :who, NOW(), NOW())`, { id, ep, line, who });
    return id;
  };
  const withVoiceStudio = async (value, fn) => {
    const prev = process.env.VOICE_STUDIO;
    if (value == null) delete process.env.VOICE_STUDIO; else process.env.VOICE_STUDIO = value;
    try { return await fn(); } finally { if (prev === undefined) delete process.env.VOICE_STUDIO; else process.env.VOICE_STUDIO = prev; }
  };

  test('without a sign-in: 401 to list, upload and remove; nothing changes and nothing goes to S3', async () => {
    const ep = await makeEpisode();
    const made = await upload(ep, admin);
    expect(made.status).toBe(201);
    media.uploadFile.mockClear();
    expect((await request(app).get(`/api/v1/script-voice-clips/${ep}`)).status).toBe(401);
    expect((await upload(ep, null)).status).toBe(401);
    expect((await remove(ep, made.body.data.id, null)).status).toBe(401);
    expect(media.uploadFile).not.toHaveBeenCalled();
    expect((await live(ep)).map((c) => c.id)).toEqual([made.body.data.id]);
  });

  test('recording is for admins: anyone else gets a 403 for a new line or over a clip, and no file goes to S3', async () => {
    const ep = await makeEpisode();
    const fresh = await upload(ep, owner, 1);
    expect(fresh.status).toBe(403);
    const mine = await clipBy(ep, OWNER);
    media.uploadFile.mockClear();
    expect((await upload(ep, owner)).status).toBe(403); // not even over their own clip
    expect((await upload(ep, other)).status).toBe(403);
    expect(media.uploadFile).not.toHaveBeenCalled();
    expect(await live(ep)).toEqual([expect.objectContaining({ id: mine, created_by: OWNER })]);
  });

  test('an admin records, replaces anyone\'s clip (one with no recorder too) and removes it', async () => {
    const ep = await makeEpisode();
    const theirs = await clipBy(ep, OWNER);
    const replaced = await upload(ep, admin);
    expect(replaced.status).toBe(201);
    expect(replaced.body.replaced).toBe(theirs);
    expect(replaced.body.data.created_by).toBe(ADMIN);
    expect((await remove(ep, replaced.body.data.id, admin)).status).toBe(200);
    const orphan = await clipBy(ep, null, 2);
    expect((await remove(ep, orphan, owner)).status).toBe(403);
    expect((await remove(ep, orphan, admin)).status).toBe(200);
  });

  test('removing: the recorder may remove their own clip; another signed-in user gets a 403 and it stays', async () => {
    const ep = await makeEpisode();
    const mine = await clipBy(ep, OWNER);
    const del = await remove(ep, mine, other);
    expect(del.status).toBe(403);
    expect(del.body.code).toBe('NOT_CLIP_OWNER');
    expect(await live(ep)).toEqual([expect.objectContaining({ id: mine })]);
    expect((await remove(ep, mine, owner)).status).toBe(200);
    expect(await live(ep)).toEqual([]);
  });

  test('a removed or unknown clip is a 404 for anyone, the owner included', async () => {
    const ep = await makeEpisode();
    const mine = await clipBy(ep, OWNER);
    expect((await remove(ep, mine, owner)).status).toBe(200);
    expect((await remove(ep, mine, owner)).status).toBe(404);
    expect((await remove(ep, uuid(), other)).status).toBe(404);
  });

  test('Voice Studio on: every write is a 409 VOICE_CLIPS_FROZEN, for admins too; nothing changes; listing still answers', async () => {
    const ep = await makeEpisode();
    const mine = await clipBy(ep, OWNER);
    await withVoiceStudio('on', async () => {
      media.uploadFile.mockClear();
      const up = await upload(ep, admin);
      expect(up.status).toBe(409);
      expect(up.body.code).toBe('VOICE_CLIPS_FROZEN');
      const del = await remove(ep, mine, admin);
      expect(del.status).toBe(409);
      expect((await remove(ep, mine, owner)).status).toBe(409);
      expect(media.uploadFile).not.toHaveBeenCalled();
      const list = await request(app).get(`/api/v1/script-voice-clips/${ep}`).set('Authorization', `Bearer ${admin}`);
      expect(list.status).toBe(200);
    });
    expect(await live(ep)).toEqual([expect.objectContaining({ id: mine })]);
    // Off again: the admin workflow is as before.
    await withVoiceStudio(null, async () => { expect((await upload(ep, admin)).status).toBe(201); });
  });

  test('the check is made again in the save, on the locked row: a clip saved after the pre-check is not taken over', async () => {
    const ep = await makeEpisode();
    const theirs = await clipBy(ep, OWNER);
    const otherUser = { id: OTHER, groups: ['USER'] };
    await expect(voice.saveClip(sequelize, {
      id: uuid(), episode_id: ep, beat_number: 3, line_index: 0, speaker: 'Lala', line_text: 'Gorgeous.',
      s3_key: 'k', url: 'u', created_by: OTHER,
    }, otherUser)).rejects.toMatchObject({ status: 403, code: 'NOT_CLIP_OWNER' });
    expect(await live(ep)).toEqual([expect.objectContaining({ id: theirs, created_by: OWNER })]);
  });
});
