/**
 * Voice from footage, V2 (Evoni, 2026-10-30): the pure pieces, without a
 * database. Failures are sorted into transient (retried) and permanent
 * (wait for Prepare Voice), in plain words; extraction reads only the
 * sound; the disk check sizes the audio, not the video; only Lala's lane
 * is eligible; the worker records a running job as interrupted when it is
 * stopped, and records each result through the job service only.
 */
const jobs = require('../../../src/services/voiceFootageJobs');
const extract = require('../../../src/services/voiceFootageExtract');
const worker = require('../../../src/workers/voiceFootageWorker');

describe('eligibility and the flag', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env.VOICE_FROM_FOOTAGE = saved.VOICE_FROM_FOOTAGE; process.env.VOICE_STUDIO = saved.VOICE_STUDIO; });

  test("only Lala's lane, for now; JustAWoman and Guest are not prepared", () => {
    expect(jobs.footageExtractionEnabledFor('lala')).toBe(true);
    expect(jobs.footageExtractionEnabledFor('LALA')).toBe(true);
    expect(jobs.footageExtractionEnabledFor('justawoman')).toBe(false);
    expect(jobs.footageExtractionEnabledFor('guest')).toBe(false);
    expect(jobs.footageExtractionEnabledFor(null)).toBe(false);
  });

  test('on only with VOICE_FROM_FOOTAGE=on and VOICE_STUDIO=on (off by default)', () => {
    process.env.VOICE_FROM_FOOTAGE = ''; process.env.VOICE_STUDIO = 'on';
    expect(jobs.enabled()).toBe(false);
    process.env.VOICE_FROM_FOOTAGE = 'on'; process.env.VOICE_STUDIO = '';
    expect(jobs.enabled()).toBe(false);
    process.env.VOICE_FROM_FOOTAGE = 'ON'; process.env.VOICE_STUDIO = 'on';
    expect(jobs.enabled()).toBe(true);
    process.env.VOICE_FROM_FOOTAGE = 'true';
    expect(jobs.enabled()).toBe(false);
  });

  test('a clip is keyed by itself and its original, so one original is prepared once', () => {
    expect(jobs.extractKey({ id: 'c1', s3_key_raw: 'episodes/e/raw-clips/c1/original.mp4' })).toBe('extract:c1:episodes/e/raw-clips/c1/original.mp4');
  });
});

describe('extraction pieces', () => {
  test('ffmpeg takes the first audio stream only: mono 48 kHz FLAC, no video', () => {
    const args = extract.extractArgs('http://127.0.0.1:1/x', '/tmp/o.flac', ['-reconnect', '1']);
    expect(args).toEqual(['-hide_banner', '-y', '-reconnect', '1', '-i', 'http://127.0.0.1:1/x', '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-c:a', 'flac', '/tmp/o.flac']);
  });

  test('the disk check sizes the sound, not the 4K video: 4481.mp4 (3:04) needs about 550 MB', () => {
    const mbOf = (n) => Math.round(n / (1024 * 1024));
    expect(mbOf(extract.audioRoomNeeded(184))).toBe(550);
    expect(mbOf(extract.audioRoomNeeded(10))).toBe(550); // the 50 MB floor plus the 500 MB kept free
    expect(mbOf(extract.audioRoomNeeded(3600))).toBe(1220);
    expect(extract.audioRoomNeeded(null)).toBe(extract.audioRoomNeeded(600));
  });

  test('failures sorted: storage and network trouble is retried; the rest waits for Prepare Voice; plain words', () => {
    const c = (err) => extract.classify(err);
    const retried = [
      Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
      Object.assign(new Error('x'), { $metadata: { httpStatusCode: 503 } }),
      new Error('ffmpeg failed: Error opening input: Server returned 500 Internal Server Error'),
      Object.assign(new Error('pool'), { name: 'SequelizeConnectionError' }),
    ];
    for (const e of retried) expect(c(e)).toMatchObject({ code: 'STORAGE_TROUBLE', retryable: true });
    expect(c(new Error('ENOSPC: no space left on device'))).toMatchObject({ code: 'NO_ROOM', retryable: false });
    expect(c(Object.assign(new Error('nf'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }))).toMatchObject({ code: 'ORIGINAL_MISSING', retryable: false });
    expect(c(new Error('ffmpeg failed: took too long and was stopped'))).toMatchObject({ code: 'TIMEOUT', retryable: false });
    expect(c(new Error('ffmpeg is not installed on the server'))).toMatchObject({ code: 'NO_FFMPEG', retryable: false });
    expect(c(new Error('ffmpeg failed: Invalid data found when processing input'))).toMatchObject({ code: 'EXTRACT_FAILED', retryable: false });
    const own = new jobs.FootageJobError('NO_AUDIO', 'This clip has no sound, so there is no voice to prepare.');
    expect(c(own)).toBe(own);
    for (const e of [...retried, new Error('ENOSPC'), new Error('weird')]) expect(c(e).message).not.toMatch(/ENOSPC|ECONNRESET|Sequelize|ffmpeg failed/);
  });
});

describe('the worker loop (job service stubbed)', () => {
  const job = { id: 'j1', raw_clip_id: 'c1', attempt: 1 };
  let spies;
  beforeEach(() => {
    spies = {
      claim: jest.spyOn(jobs, 'claimNext'),
      succeed: jest.spyOn(jobs, 'succeed').mockResolvedValue({ ...job, status: 'succeeded' }),
      fail: jest.spyOn(jobs, 'fail').mockImplementation(async (s, id, w, err) => ({ job: { ...job, status: 'failed', error_code: err.code, retryable: err.retryable } })),
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });
  afterEach(() => jest.restoreAllMocks());

  test('nothing due: nothing runs', async () => {
    spies.claim.mockResolvedValue(null);
    const run = jest.fn();
    expect(await worker.runOnce({ sequelize: {}, workerId: 'w', run })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  test('a job that works is recorded as succeeded with its source', async () => {
    spies.claim.mockResolvedValue(job);
    const out = await worker.runOnce({ sequelize: {}, workerId: 'w', run: async () => ({ source: { id: 's1' }, existed: false }) });
    expect(spies.succeed).toHaveBeenCalledWith({}, 'j1', 'w', 's1');
    expect(out.status).toBe('succeeded');
  });

  test('a raw error is sorted before it is recorded: storage trouble is retryable, the raw text is only logged', async () => {
    spies.claim.mockResolvedValue(job);
    const out = await worker.runOnce({ sequelize: {}, workerId: 'w', run: async () => { throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }); } });
    expect(spies.fail.mock.calls[0][3]).toMatchObject({ code: 'STORAGE_TROUBLE', retryable: true });
    expect(out).toMatchObject({ status: 'failed', retryable: true });
    expect(spies.error).toHaveBeenCalledWith(expect.stringContaining('clip c1 failed (STORAGE_TROUBLE, will retry)'), 'ECONNRESET', 'socket hang up');
  });

  test('stopped mid-job: the running job is recorded as interrupted (retried as a new attempt), and nothing more is claimed', async () => {
    let release;
    spies.claim.mockResolvedValueOnce(job);
    const running = worker.runOnce({ sequelize: {}, workerId: 'w', run: () => new Promise((r) => { release = r; }) });
    await new Promise((r) => setImmediate(r));
    await worker.stop({}, 'SIGTERM');
    expect(spies.fail).toHaveBeenCalledWith({}, 'j1', 'w', expect.objectContaining({ code: 'INTERRUPTED', retryable: true }));
    release({ source: { id: 's1' } });
    await running;
  });
});
