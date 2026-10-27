/**
 * Voice Studio B1 media on real files (Evoni, 2026-10-27, item 4): a small
 * real audio file made here, the real ffprobe, the real sha256 and the
 * configured storage adapter (services/rawClipMedia uploadFile and
 * downloadFile, through the AWS SDK's S3Client). Only the network call is
 * replaced: S3Client.prototype.send keeps the objects in memory, so nothing
 * leaves this machine. A failed upload fails after the body is read, as a
 * network failure does.
 */
jest.unmock('uuid');

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Readable } = require('stream');

const ENV_KEYS = ['AWS_S3_BUCKET', 'VOICE_SOURCE_MAX_SECONDS', 'VOICE_STUDIO'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-b1-media-'));
process.env.AWS_S3_BUCKET = 'voice-b1-local-test';
process.env.VOICE_SOURCE_MAX_SECONDS = '1';

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const studio = require('../../src/services/voiceStudioService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');
const hasTools = (() => {
  try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (err) { console.error('ffprobe/ffmpeg not found:', err.message); return false; }
})();

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const filesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);

// A real WAV: 16-bit mono PCM, a 440 Hz tone.
function wav(file, { ms = 750, rate = 8000 } = {}) {
  const n = Math.round((rate * ms) / 1000);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i += 1) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
  return file;
}
const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const asUpload = (p, name = path.basename(p), mimetype = 'audio/wav') => ({ path: p, originalname: name, mimetype, size: fs.statSync(p).size });

(shouldSkip || !hasTools ? describe.skip : describe)('Voice Studio B1 media (real audio, ffprobe, storage adapter)', () => {
  const show = uuid();
  const episodes = [];
  const USER = 'test-b1-media';
  const objects = new Map();
  const puts = [];
  let failPut = false;
  let send;
  let adminToken;

  beforeAll(async () => {
    send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) => {
      const { Bucket, Key } = command.input;
      if (command instanceof PutObjectCommand) {
        const chunks = [];
        for await (const c of command.input.Body) chunks.push(c);
        if (failPut) throw new Error('S3 connection reset (test)');
        objects.set(`${Bucket}/${Key}`, { body: Buffer.concat(chunks), type: command.input.ContentType, length: command.input.ContentLength });
        puts.push(Key);
        return {};
      }
      if (command instanceof GetObjectCommand) {
        const o = objects.get(`${Bucket}/${Key}`);
        if (!o) { const err = new Error('NoSuchKey'); err.name = 'NoSuchKey'; throw err; }
        return { Body: Readable.from([o.body]) };
      }
      throw new Error(`unexpected S3 command ${command.constructor.name}`);
    });
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `b1m-${show.slice(0, 8)}` });
    adminToken = TokenService.generateTokenPair({ id: USER, email: 'a@b1m.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });

  afterAll(async () => {
    send?.mockRestore();
    if (episodes.length) {
      const e = { e: episodes };
      await run('DELETE FROM line_voice_candidate_revisions WHERE candidate_id IN (SELECT id FROM line_voice_candidates WHERE episode_id IN (:e))', e);
      await run('DELETE FROM line_voice_candidates WHERE episode_id IN (:e)', e);
      await run('DELETE FROM voice_source_assets WHERE episode_id IN (:e)', e);
      await run('DELETE FROM script_voice_clips WHERE episode_id IN (:e)', e);
      await run('DELETE FROM episodes WHERE id IN (:e)', e);
    }
    await run('DELETE FROM shows WHERE id = :show', { show });
    fs.rmSync(TMP, { recursive: true, force: true });
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await sequelize.close();
  });

  const makeEpisode = async () => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'B1 media', :n, 'draft', '## BEAT: 6 · Six\nLala: hi', '[]'::jsonb, NOW(), NOW())`, { ep, show, n: 7000 + episodes.length });
    return ep;
  };

  test('a real WAV: ffprobe measures it, the server hashes it, the adapter stores the same bytes under its content address', async () => {
    const ep = await makeEpisode();
    const file = wav(path.join(TMP, 'line.wav'), { ms: 750, rate: 8000 });
    const bytes = fs.readFileSync(file);
    const { source, existed } = await studio.createSource(sequelize, { episodeId: ep, kind: 'recorded', file: asUpload(file), userId: USER });
    expect(existed).toBe(false);
    expect(source).toMatchObject({ duration_ms: 750, sample_rate: 8000, channels: 1, sha256: sha(bytes), content_type: 'audio/wav', source_kind: 'recorded' });
    expect(Number(source.file_size_bytes)).toBe(bytes.length);
    expect(source.s3_key).toBe(`episodes/${ep}/voice/sources/${sha(bytes)}.wav`);
    const stored = objects.get(`voice-b1-local-test/${source.s3_key}`);
    expect(sha(stored.body)).toBe(sha(bytes));
    expect(stored).toMatchObject({ type: 'audio/wav', length: bytes.length });
    // The same bytes again: the same source, no second upload.
    const before = puts.length;
    const again = await studio.createSource(sequelize, { episodeId: ep, kind: 'recorded', file: asUpload(file, 'again.wav'), userId: USER });
    expect(again).toMatchObject({ existed: true, source: { id: source.id } });
    expect(puts.length).toBe(before);
  });

  test('other real formats: an Opus .ogg and an AAC .m4a are measured; a longer file than the limit is refused', async () => {
    const ep = await makeEpisode();
    const ogg = path.join(TMP, 'line.ogg');
    ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=0.6', '-c:a', 'libopus', ogg]);
    const { source: o } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: asUpload(ogg, 'line.ogg', 'audio/ogg'), userId: USER });
    expect(Math.abs(o.duration_ms - 600)).toBeLessThanOrEqual(30);
    expect(o.channels).toBe(1);
    const m4a = path.join(TMP, 'line.m4a');
    ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=0.8', '-c:a', 'aac', m4a]);
    const { source: m } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: asUpload(m4a, 'line.m4a', 'audio/mp4'), userId: USER });
    expect(Math.abs(m.duration_ms - 800)).toBeLessThanOrEqual(40);
    const long = wav(path.join(TMP, 'long.wav'), { ms: 1500 });
    await expect(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: asUpload(long), userId: USER })).rejects.toMatchObject({ status: 400, code: 'TOO_LONG' });
  });

  test('format checks on real files: video with no sound, a text file named .wav, a .txt; none reaches storage', async () => {
    const ep = await makeEpisode();
    const before = puts.length;
    const video = path.join(TMP, 'silent.mp4');
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=16x16:d=0.5', '-c:v', 'mpeg4', video]);
    await expect(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: asUpload(video, 'silent.mp4', 'video/mp4') })).rejects.toMatchObject({ status: 400, code: 'NO_AUDIO' });
    const fake = path.join(TMP, 'fake.wav');
    fs.writeFileSync(fake, 'this is not audio at all');
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: asUpload(fake) })).rejects.toMatchObject({ status: 400, code: 'UNREADABLE' });
    } finally { errors.mockRestore(); }
    const txt = path.join(TMP, 'notes.txt');
    fs.writeFileSync(txt, 'hello');
    await expect(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: asUpload(txt, 'notes.txt', 'text/plain') })).rejects.toMatchObject({ status: 400, code: 'BAD_TYPE' });
    expect(puts.length).toBe(before);
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM voice_source_assets WHERE episode_id = :ep', { ep });
    expect(n).toBe(0);
  });

  test('the upload route leaves no temp file, stored or refused; a failed upload to storage writes no row', async () => {
    const ep = await makeEpisode();
    process.env.VOICE_STUDIO = 'on';
    // The route's temp folder (os tmp/voice-studio): what this test leaves there, compared with before it.
    const dir = path.join(os.tmpdir(), 'voice-studio');
    const before = new Set(filesIn(dir));
    const left = () => filesIn(dir).filter((f) => !before.has(f));
    const post = (file, name) => request(app).post(`/api/v1/voice-studio/${ep}/sources`).set('Authorization', `Bearer ${adminToken}`)
      .field('kind', 'uploaded').attach('audio', file, name);
    const good = wav(path.join(TMP, 'route.wav'), { ms: 500 });
    const ok = await post(good, 'route.wav');
    expect(ok.status).toBe(201);
    expect(ok.body.data.source).toMatchObject({ duration_ms: 500, sha256: sha(fs.readFileSync(good)) });
    expect(left()).toEqual([]);
    const fake = path.join(TMP, 'route-fake.wav');
    fs.writeFileSync(fake, 'not audio');
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await post(fake, 'route-fake.wav')).status).toBe(400);
      expect(left()).toEqual([]);
      failPut = true;
      const other = wav(path.join(TMP, 'route-2.wav'), { ms: 400 });
      const down = await post(other, 'route-2.wav');
      expect(down.status).toBe(500);
      expect(left()).toEqual([]);
      const [{ n }] = await rows('SELECT count(*)::int AS n FROM voice_source_assets WHERE episode_id = :ep AND sha256 = :h', { ep, h: sha(fs.readFileSync(other)) });
      expect(n).toBe(0);
    } finally {
      failPut = false;
      errors.mockRestore();
    }
  });

  test('legacy import downloads through the adapter, measures and hashes the real file, and removes its temp copy', async () => {
    const ep = await makeEpisode();
    const file = wav(path.join(TMP, 'legacy.wav'), { ms: 650 });
    const key = `episodes/${ep}/voice-clips/${uuid()}.wav`;
    objects.set(`voice-b1-local-test/${key}`, { body: fs.readFileSync(file), type: 'audio/wav' });
    const clipId = uuid();
    await run(`INSERT INTO script_voice_clips (id, episode_id, beat_number, line_index, speaker, line_text, s3_key, url, content_type, created_at, updated_at)
      VALUES (:id, :ep, 6, 0, 'Lala', 'hi', :key, 'https://x/y', 'audio/wav', NOW(), NOW())`, { id: clipId, ep, key });
    const out = await studio.importLegacy(sequelize, { episodeId: ep, userId: USER });
    expect(out.imported).toHaveLength(1);
    const [s] = await rows('SELECT * FROM voice_source_assets WHERE legacy_voice_clip_id = :clipId', { clipId });
    expect(s).toMatchObject({ duration_ms: 650, sha256: sha(fs.readFileSync(file)), s3_key: key, source_kind: 'legacy' });
    expect(filesIn(path.join(os.tmpdir(), 'raw-clips')).filter((f) => f.includes(`legacy-${clipId}`))).toEqual([]);
  });
});
