/**
 * Voice from footage, V2 (Evoni, 2026-10-30), on the real database:
 *
 *   - jobs: one live job per clip (idempotent), Lala's lane only, flag off
 *     means nothing is queued;
 *   - claiming is atomic and one at a time across workers;
 *   - a silent running job is recovered as interrupted and retried after
 *     a wait, at most MAX_ATTEMPTS; a permanent failure waits for Prepare
 *     Voice, which queues a new attempt;
 *   - the routes are admin only and off with the flag;
 *   - with the real ffmpeg: the worker extracts the clip's sound through
 *     the storage reader into an 'extracted' source tied to the clip; the
 *     original's bytes are unchanged; a clip with no sound fails plainly.
 *
 * Storage is a stand-in (S3Client.prototype.send keeps objects in memory
 * and serves byte ranges); nothing leaves this machine.
 */
jest.unmock('uuid');

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Readable } = require('stream');

const ENV_KEYS = ['AWS_S3_BUCKET', 'VOICE_STUDIO', 'VOICE_FROM_FOOTAGE'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-v2-'));
process.env.AWS_S3_BUCKET = 'voice-v2-local-test';
process.env.VOICE_STUDIO = 'on';
process.env.VOICE_FROM_FOOTAGE = 'on';

const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clips = require('../../src/services/rawClipsService');
const jobs = require('../../src/services/voiceFootageJobs');
const extract = require('../../src/services/voiceFootageExtract');
const worker = require('../../src/workers/voiceFootageWorker');

const { sequelize } = models;
const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('amazonaws.com') || !process.env.DATABASE_URL.includes('episode_metadata_test');
const hasTools = (() => {
  try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (err) { return false; }
})();

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BUCKET = 'voice-v2-local-test';

(shouldSkip ? describe.skip : describe)('Voice from footage V2 (database)', () => {
  const show = uuid();
  const episodes = [];
  const objects = new Map();
  let send;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) => {
      const { Key } = command.input;
      const id = `${BUCKET}/${Key}`;
      if (command instanceof PutObjectCommand) {
        const chunks = [];
        for await (const c of command.input.Body) chunks.push(c);
        objects.set(id, Buffer.concat(chunks));
        return {};
      }
      const body = objects.get(id);
      if (!body) throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      if (command instanceof HeadObjectCommand) return { ContentLength: body.length, ContentType: 'video/mp4' };
      if (command instanceof GetObjectCommand) {
        const m = /^bytes=(\d+)-(\d+)$/.exec(command.input.Range || '');
        const part = m ? body.subarray(Number(m[1]), Number(m[2]) + 1) : body;
        return { Body: Readable.from([part]) };
      }
      throw new Error(`unexpected S3 command ${command.constructor.name}`);
    });
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `v2-${show.slice(0, 8)}` });
    adminToken = TokenService.generateTokenPair({ id: 'v2-admin', email: 'a@v2.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'v2-user', email: 'u@v2.dev', name: 'User', groups: ['editor'], role: 'USER' }).accessToken;
  });

  afterAll(async () => {
    send?.mockRestore();
    if (episodes.length) {
      const e = { e: episodes };
      await run('DELETE FROM voice_footage_jobs WHERE episode_id IN (:e)', e);
      await run('DELETE FROM voice_source_assets WHERE episode_id IN (:e)', e);
      await run('DELETE FROM episode_raw_clips WHERE episode_id IN (:e)', e);
      await run('DELETE FROM episodes WHERE id IN (:e)', e);
    }
    await run('DELETE FROM shows WHERE id = :show', { show });
    fs.rmSync(TMP, { recursive: true, force: true });
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await sequelize.close();
  });

  afterEach(async () => {
    // Each test starts with no job running or queued (claiming is global).
    if (episodes.length) await run(`UPDATE voice_footage_jobs SET status = 'cancelled', updated_at = NOW() WHERE status IN ('queued', 'running') AND episode_id IN (:e)`, { e: episodes });
    process.env.VOICE_FROM_FOOTAGE = 'on';
  });

  const makeEpisode = async () => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'V2', :n, 'draft', '## BEAT: 1 · One\nLala: hi', '[]'::jsonb, NOW(), NOW())`, { ep, show, n: 8100 + episodes.length });
    return ep;
  };
  const makeClip = async (ep, { performer = 'lala', key = null, duration = 3 } = {}) => {
    const id = uuid();
    return clips.createClip(sequelize, {
      id, episode_id: ep, show_id: show, performer, label: 'take', original_filename: 'take.mp4', content_type: 'video/mp4',
      duration_seconds: duration, s3_key_raw: key || `episodes/${ep}/raw-clips/${id}/original.mp4`, url_raw: 'https://x/o.mp4',
    }).then((row) => ({ ...row, s3_key_raw: key || `episodes/${ep}/raw-clips/${id}/original.mp4` }));
  };
  const jobsOf = (clipId) => rows('SELECT * FROM voice_footage_jobs WHERE raw_clip_id = :clipId ORDER BY created_at', { clipId });

  describe('queueing', () => {
    test('a new Lala clip gets exactly one job, however often it is asked; other lanes and the flag off get none', async () => {
      const ep = await makeEpisode();
      const lala = await makeClip(ep);
      const [a, b] = await Promise.all([jobs.onClipUploaded(sequelize, lala), jobs.onClipUploaded(sequelize, lala)]);
      expect(a.id).toBe(b.id);
      expect(await jobsOf(lala.id)).toHaveLength(1);
      expect((await jobsOf(lala.id))[0]).toMatchObject({ status: 'queued', attempt: 1, kind: 'extract', trigger: 'upload', performer: 'lala', input_ref: lala.s3_key_raw });

      for (const performer of ['justawoman', 'guest']) {
        // eslint-disable-next-line no-await-in-loop
        const other = await makeClip(ep, { performer });
        // eslint-disable-next-line no-await-in-loop
        expect(await jobs.onClipUploaded(sequelize, other)).toBeNull();
        // eslint-disable-next-line no-await-in-loop
        expect(await jobsOf(other.id)).toHaveLength(0);
      }
      process.env.VOICE_FROM_FOOTAGE = '';
      const off = await makeClip(ep);
      expect(await jobs.onClipUploaded(sequelize, off)).toBeNull();
      expect(await jobsOf(off.id)).toHaveLength(0);
    });
  });

  describe('claiming, heartbeats and recovery', () => {
    test('two workers claim at once: one gets the job, the other nothing; while it runs, nothing else is claimed', async () => {
      const ep = await makeEpisode();
      const c1 = await makeClip(ep);
      const c2 = await makeClip(ep);
      await jobs.onClipUploaded(sequelize, c1);
      await jobs.onClipUploaded(sequelize, c2);
      const [x, y] = await Promise.all([jobs.claimNext(sequelize, 'w-a'), jobs.claimNext(sequelize, 'w-b')]);
      const claimed = [x, y].filter(Boolean);
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({ status: 'running', raw_clip_id: c1.id });
      // One at a time: c2 waits while c1 runs with a fresh heartbeat.
      expect(await jobs.claimNext(sequelize, 'w-c')).toBeNull();
      expect(await jobs.heartbeat(sequelize, claimed[0].id, claimed[0].worker_id)).toBe(true);
      expect(await jobs.heartbeat(sequelize, claimed[0].id, 'someone-else')).toBe(false);
      await jobs.fail(sequelize, claimed[0].id, claimed[0].worker_id, new jobs.FootageJobError('X', 'test', { retryable: false }));
      const next = await jobs.claimNext(sequelize, 'w-c');
      expect(next).toMatchObject({ raw_clip_id: c2.id, worker_id: 'w-c' });
    });

    test('a running job whose worker went silent is failed as interrupted and retried after a wait, at most three attempts', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      await jobs.onClipUploaded(sequelize, clip);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        await run(`UPDATE voice_footage_jobs SET run_after = NOW() - INTERVAL '1 second' WHERE raw_clip_id = :id AND status = 'queued'`, { id: clip.id });
        // eslint-disable-next-line no-await-in-loop
        const job = await jobs.claimNext(sequelize, `w-${attempt}`);
        expect(job).toMatchObject({ attempt });
        // The worker vanishes: its heartbeat goes stale.
        // eslint-disable-next-line no-await-in-loop
        await run(`UPDATE voice_footage_jobs SET heartbeat_at = NOW() - INTERVAL '10 minutes' WHERE id = :id`, { id: job.id });
        // eslint-disable-next-line no-await-in-loop
        await jobs.claimNext(sequelize, 'w-recover');
      }
      const all = await jobsOf(clip.id);
      expect(all.map((j) => [j.attempt, j.status, j.error_code])).toEqual([[1, 'failed', 'INTERRUPTED'], [2, 'failed', 'INTERRUPTED'], [3, 'failed', 'INTERRUPTED']]);
      expect(all.every((j) => j.retryable === true)).toBe(true);
      // The retries waited: attempt 2 after a minute, attempt 3 after five.
      expect(all[1].trigger).toBe('retry');
      // No fourth attempt by itself: Prepare Voice is needed.
      const status = (await jobs.statusForEpisode(sequelize, ep))[clip.id];
      expect(status).toMatchObject({ status: 'failed', attempt: 3, needs_action: true });
    });

    test('a retry waits: it is not claimable before its time', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      await jobs.onClipUploaded(sequelize, clip);
      const job = await jobs.claimNext(sequelize, 'w');
      const { retry } = await jobs.fail(sequelize, job.id, 'w', new jobs.FootageJobError('STORAGE_TROUBLE', 'later', { retryable: true }));
      expect(retry).toMatchObject({ attempt: 2, status: 'queued', trigger: 'retry' });
      expect(new Date(retry.run_after).getTime()).toBeGreaterThan(Date.now() + 30 * 1000);
      expect(await jobs.claimNext(sequelize, 'w2')).toBeNull();
    });

    test('a permanent failure is not retried; Prepare Voice queues a new attempt and keeps the history', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      await jobs.onClipUploaded(sequelize, clip);
      const job = await jobs.claimNext(sequelize, 'w');
      const { retry } = await jobs.fail(sequelize, job.id, 'w', new jobs.FootageJobError('NO_AUDIO', 'This clip has no sound', { retryable: false }));
      expect(retry).toBeNull();
      const again = await jobs.prepare(sequelize, clip, { userId: 'v2-admin' });
      expect(again).toMatchObject({ created: true, job: { attempt: 2, trigger: 'retry', status: 'queued' } });
      expect((await jobsOf(clip.id)).map((j) => j.status)).toEqual(['failed', 'queued']);
    });
  });

  describe('routes (admin only, flag-gated)', () => {
    test('Prepare Voice: admin queues once (202, then 200 with the same job); others are refused; other lanes 409; flag off 404', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      const url = `/api/v1/voice-footage/${ep}/clips/${clip.id}/prepare`;
      const first = await request(app).post(url).set('Authorization', `Bearer ${adminToken}`);
      expect(first.status).toBe(202);
      const second = await request(app).post(url).set('Authorization', `Bearer ${adminToken}`);
      expect(second.status).toBe(200);
      expect(second.body.data.id).toBe(first.body.data.id);
      expect((await request(app).post(url).set('Authorization', `Bearer ${userToken}`)).status).toBe(403);
      expect((await request(app).post(url)).status).toBe(401);
      const jaw = await makeClip(ep, { performer: 'justawoman' });
      const refused = await request(app).post(`/api/v1/voice-footage/${ep}/clips/${jaw.id}/prepare`).set('Authorization', `Bearer ${adminToken}`);
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('NOT_ELIGIBLE');
      const status = await request(app).get(`/api/v1/voice-footage/${ep}/status`).set('Authorization', `Bearer ${adminToken}`);
      expect(status.body.data[clip.id]).toMatchObject({ status: 'queued', attempt: 1 });
      expect((await request(app).get(`/api/v1/voice-footage/${ep}/status`).set('Authorization', `Bearer ${userToken}`)).status).toBe(403);
      process.env.VOICE_FROM_FOOTAGE = '';
      const off = await request(app).post(url).set('Authorization', `Bearer ${adminToken}`);
      expect(off.status).toBe(404);
      expect(off.body.code).toBe('VOICE_FROM_FOOTAGE_OFF');
    });
  });

  (hasTools ? describe : describe.skip)('extraction with the real ffmpeg', () => {
    const makeVideo = (file, { sound = true, seconds = 3 } = {}) => {
      const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x00B140:s=320x240:r=25:d=${seconds}`];
      if (sound) args.push('-f', 'lavfi', '-i', `sine=frequency=330:duration=${seconds}`);
      args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
      if (sound) args.push('-c:a', 'aac', '-shortest');
      args.push(file);
      execFileSync('ffmpeg', args);
      return fs.readFileSync(file);
    };

    test('the worker turns a Lala clip into an extracted source through the storage reader; the original is untouched; Prepare Voice again changes nothing', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      const original = makeVideo(path.join(TMP, 'with-sound.mp4'));
      objects.set(`${BUCKET}/${clip.s3_key_raw}`, original);
      await jobs.onClipUploaded(sequelize, clip);
      const done = await worker.runOnce({ sequelize, workerId: 'w-real', run: (job) => extract.runExtract(job, { sequelize }) });
      expect(done).toMatchObject({ status: 'succeeded', raw_clip_id: clip.id });
      const [src] = await rows('SELECT * FROM voice_source_assets WHERE source_raw_clip_id = :id', { id: clip.id });
      expect(src).toMatchObject({ source_kind: 'extracted', source_in_ms: 0, channels: 1, sample_rate: 48000, content_type: 'audio/flac' });
      expect(Math.abs(src.duration_ms - 3000)).toBeLessThan(100);
      expect(src.source_out_ms).toBe(src.duration_ms);
      expect(done.output_source_id).toBe(src.id);
      expect(objects.has(`${BUCKET}/${src.s3_key}`)).toBe(true);
      // The original's bytes are exactly as they were.
      expect(sha(objects.get(`${BUCKET}/${clip.s3_key_raw}`))).toBe(sha(original));
      // Prepare Voice on a prepared clip returns its job: no second job, no second source.
      const again = await jobs.prepare(sequelize, clip);
      expect(again).toMatchObject({ created: false, job: { id: done.id, status: 'succeeded' } });
      expect(await rows('SELECT id FROM voice_source_assets WHERE source_raw_clip_id = :id', { id: clip.id })).toHaveLength(1);
      // The public upload route still refuses the 'extracted' kind.
      const refused = await request(app).post(`/api/v1/voice-studio/${ep}/sources`).set('Authorization', `Bearer ${adminToken}`)
        .field('kind', 'extracted').attach('audio', Buffer.from('x'), 'x.wav');
      expect(refused.status).toBe(400);
    });

    test('a clip with no sound fails plainly, is not retried, and waits for Prepare Voice', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      objects.set(`${BUCKET}/${clip.s3_key_raw}`, makeVideo(path.join(TMP, 'silent.mp4'), { sound: false }));
      await jobs.onClipUploaded(sequelize, clip);
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
      const done = await worker.runOnce({ sequelize, workerId: 'w-real', run: (job) => extract.runExtract(job, { sequelize }) });
      errors.mockRestore();
      expect(done).toMatchObject({ status: 'failed', error_code: 'NO_AUDIO', retryable: false });
      expect(done.error_message).toBe('This clip has no sound, so there is no voice to prepare.');
      expect(await jobsOf(clip.id)).toHaveLength(1);
      expect(await rows('SELECT id FROM voice_source_assets WHERE source_raw_clip_id = :id', { id: clip.id })).toHaveLength(0);
    });

    test('the original missing from storage: a plain, permanent failure', async () => {
      const ep = await makeEpisode();
      const clip = await makeClip(ep);
      await jobs.onClipUploaded(sequelize, clip);
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
      const done = await worker.runOnce({ sequelize, workerId: 'w-real', run: (job) => extract.runExtract(job, { sequelize }) });
      errors.mockRestore();
      expect(done).toMatchObject({ status: 'failed', error_code: 'ORIGINAL_MISSING', retryable: false });
    });
  });
});
