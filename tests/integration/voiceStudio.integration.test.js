/**
 * Voice Studio B1 on Postgres (Evoni, 2026-10-27; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, R5.5 B1-1..B1-12).
 * The six tables, the service and the routes, with only the media faked
 * (ffprobe, S3): a "file" here is JSON naming its audio and length.
 */
jest.unmock('uuid');

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const studio = require('../../src/services/voiceStudioService');
const { saveEpisodeScript } = require('../../src/services/scriptSave');
const migration = require('../../src/migrations/20261027200000-create-voice-studio-tables');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-b1-'));

// ── fake media: a file's JSON says whether it has audio and how long it is ──
const uploads = [];
const stored = new Map();
studio.setMedia({
  async probe(p) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { hasAudio: !!j.audio, duration_ms: j.ms || null, sample_rate: j.audio ? 48000 : null, channels: j.audio ? 1 : null };
  },
  sha256File: async (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
  async upload(p, key) { uploads.push(key); stored.set(key, fs.readFileSync(p)); return `https://s3.example/${key}`; },
  async download(key, p) { if (!stored.has(key)) throw new Error(`no such key ${key}`); fs.writeFileSync(p, stored.get(key)); },
  tmpPath: async (name) => path.join(TMP, `${name}-${uuid()}`),
  removeFile: async (p) => { try { fs.unlinkSync(p); } catch (err) { if (err.code !== 'ENOENT') console.error('remove', err.message); } },
});
const audioFile = (ms, { audio = true, name = 'take.wav', salt = uuid() } = {}) => {
  const p = path.join(TMP, `${uuid()}${path.extname(name)}`);
  fs.writeFileSync(p, JSON.stringify({ audio, ms, salt }));
  return { path: p, originalname: name, mimetype: 'audio/wav', size: fs.statSync(p).size };
};

const beat = (n, ...lines) => [`## BEAT: ${n} · Beat ${n}`, ...lines].join('\n');
const SCRIPT = [
  beat(6, 'Lala: "This is my moment."', 'Guest: "Love the look!"', 'Lala: Okay.', 'Prime: right', 'Lala: Okay.'),
  beat(8, 'Lala: "Closet time."'),
].join('\n\n');

(shouldSkip ? describe.skip : describe)('Voice Studio B1 (Postgres)', () => {
  const show = uuid();
  const episodes = [];
  const USER = 'test-b1-admin';
  let adminToken;
  let userToken;

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `b1-${show.slice(0, 8)}` });
    adminToken = TokenService.generateTokenPair({ id: USER, email: 'a@b1.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-b1-user', email: 'u@b1.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
  });

  afterAll(async () => {
    if (episodes.length) {
      const e = { e: episodes };
      await run(`DELETE FROM line_voice_reconfirmations WHERE approval_id IN (SELECT id FROM line_voice_approvals WHERE episode_id IN (:e))`, e);
      await run('UPDATE line_voice_approvals SET superseded_by = NULL WHERE episode_id IN (:e)', e);
      await run('DELETE FROM line_voice_approvals WHERE episode_id IN (:e)', e);
      await run('DELETE FROM line_voice_candidate_revisions WHERE candidate_id IN (SELECT id FROM line_voice_candidates WHERE episode_id IN (:e))', e);
      await run('UPDATE line_voice_associations SET superseded_by = NULL WHERE episode_id IN (:e)', e);
      await run('DELETE FROM line_voice_associations WHERE episode_id IN (:e)', e);
      await run('DELETE FROM line_voice_candidates WHERE episode_id IN (:e)', e);
      await run('DELETE FROM voice_source_assets WHERE episode_id IN (:e)', e);
      await run('DELETE FROM script_voice_clips WHERE episode_id IN (:e)', e);
      await run('DELETE FROM episode_script_versions WHERE episode_id IN (:e)', e);
      await run('DELETE FROM episodes WHERE id IN (:e)', e);
    }
    await run('DELETE FROM shows WHERE id = :show', { show });
    fs.rmSync(TMP, { recursive: true, force: true });
    await sequelize.close();
  });

  const makeEpisode = async (script = SCRIPT) => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'B1', :n, 'draft', :script, '[]'::jsonb, NOW(), NOW())`, { ep, show, n: 5000 + episodes.length, script });
    return ep;
  };
  const stateOf = (ep) => studio.episodeState(sequelize, ep);
  // A take tied to (beat, index) and its latest revision.
  const takeAt = async (ep, b, i, { ms = 2000 } = {}) => {
    const { source } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(ms), userId: USER });
    const { candidate, revision } = await studio.createCandidate(sequelize, { episodeId: ep, sourceAssetId: source.id, userId: USER });
    const { revision: rev } = await stateOf(ep);
    await studio.associate(sequelize, { episodeId: ep, candidateId: candidate.id, scriptRevision: rev, beatNumber: b, lineIndex: i, userId: USER });
    return { source, candidate, revision };
  };
  const approveTake = async (ep, take) => studio.approve(sequelize, {
    episodeId: ep, candidateId: take.candidate.id, candidateRevisionId: take.revision.id, scriptRevision: (await stateOf(ep)).revision, userId: USER,
  });
  const saveScript = (ep, text) => saveEpisodeScript(models, ep, { writer: 'test', compose: async () => ({ script: text }) });
  const stateOfApproval = async (ep, id) => (await studio.summary(sequelize, { episodeId: ep })).approvals.find((a) => a.approval_id === id);
  const expectRefusal = async (promise, status, code) => {
    await expect(promise).rejects.toMatchObject({ status, ...(code ? { code } : {}) });
  };

  test('B1-1 migration: down refuses while a table has a row; empty, it drops and up recreates', async () => {
    const ep = await makeEpisode();
    await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(1000), userId: USER });
    await expect(migration.down(sequelize.getQueryInterface())).rejects.toThrow(/Refusing to drop voice_source_assets/);
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM voice_source_assets WHERE episode_id = :ep', { ep });
    expect(n).toBe(1);
    // Empty the tables (only this suite writes them), then down and up.
    await run('DELETE FROM line_voice_candidate_revisions'); await run('DELETE FROM line_voice_candidates'); await run('DELETE FROM voice_source_assets');
    await migration.down(sequelize.getQueryInterface());
    const [{ reg }] = await rows("SELECT to_regclass('public.voice_source_assets') AS reg");
    expect(reg).toBeNull();
    await migration.up(sequelize.getQueryInterface());
    for (const table of ['voice_source_assets', 'line_voice_candidates', 'line_voice_associations', 'line_voice_candidate_revisions', 'line_voice_approvals', 'line_voice_reconfirmations']) {
      const [{ reg: there }] = await rows('SELECT to_regclass(:name)::text AS reg', { name: `public.${table}` });
      expect(there).toBe(table);
    }
  });

  test('B1-2 upload: bad type and no audio refused before S3; duration from the probe; sha256 stored', async () => {
    const ep = await makeEpisode();
    const before = uploads.length;
    await expectRefusal(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(1000, { name: 'take.txt' }) }), 400, 'BAD_TYPE');
    await expectRefusal(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(1000, { audio: false }) }), 400, 'NO_AUDIO');
    await expectRefusal(studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(601000) }), 400, 'TOO_LONG');
    expect(uploads.length).toBe(before);
    const file = audioFile(1234);
    const { source } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file, userId: USER });
    expect(source.duration_ms).toBe(1234);
    expect(source.sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'));
    expect(source.s3_key).toBe(`episodes/${ep}/voice/sources/${source.sha256}.wav`);
    // The same file again is the same source, not a second upload.
    const again = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file, userId: USER });
    expect(again).toMatchObject({ existed: true, source: { id: source.id } });
    expect(uploads.length).toBe(before + 1);
  });

  test('B1-2 routes: off unless switched on; writes need ADMIN; the upload goes through multipart', async () => {
    const ep = await makeEpisode();
    const prev = process.env.VOICE_STUDIO;
    try {
      delete process.env.VOICE_STUDIO;
      const off = await request(app).get(`/api/v1/voice-studio/${ep}/summary`).set('Authorization', `Bearer ${adminToken}`);
      expect(off.status).toBe(404);
      expect(off.body.code).toBe('VOICE_STUDIO_OFF');
      process.env.VOICE_STUDIO = 'on';
      const read = await request(app).get(`/api/v1/voice-studio/${ep}/summary`).set('Authorization', `Bearer ${userToken}`);
      expect(read.status).toBe(200);
      const f = audioFile(1500);
      const forbidden = await request(app).post(`/api/v1/voice-studio/${ep}/sources`).set('Authorization', `Bearer ${userToken}`)
        .field('kind', 'uploaded').attach('audio', f.path, 'line.wav');
      expect(forbidden.status).toBe(403);
      const ok = await request(app).post(`/api/v1/voice-studio/${ep}/sources`).set('Authorization', `Bearer ${adminToken}`)
        .field('kind', 'uploaded').attach('audio', f.path, 'line.wav');
      expect(ok.status).toBe(201);
      expect(ok.body.data.source.duration_ms).toBe(1500);
      const badType = await request(app).post(`/api/v1/voice-studio/${ep}/sources`).set('Authorization', `Bearer ${adminToken}`)
        .field('kind', 'uploaded').attach('audio', f.path, 'line.exe');
      expect(badType.status).toBe(400);
    } finally {
      if (prev === undefined) delete process.env.VOICE_STUDIO; else process.env.VOICE_STUDIO = prev;
    }
  });

  test('B1-3 a second take for the same line leaves the first and its source untouched', async () => {
    const ep = await makeEpisode();
    const first = await takeAt(ep, 6, 0);
    const srcBefore = (await rows('SELECT * FROM voice_source_assets WHERE id = :id', { id: first.source.id }))[0];
    const second = await takeAt(ep, 6, 0);
    expect(second.candidate.id).not.toBe(first.candidate.id);
    const takes = await studio.listTakes(sequelize, { episodeId: ep });
    expect(takes.filter((t) => t.beat_number === 6 && t.line_index === 0)).toHaveLength(2);
    expect((await rows('SELECT * FROM voice_source_assets WHERE id = :id', { id: first.source.id }))[0]).toEqual(srcBefore);
  });

  test('B1-4 associate: stale or missing revision 409; mismatched line, Prime line, beat out of range refused', async () => {
    const ep = await makeEpisode();
    const { source } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(1000), userId: USER });
    const { candidate } = await studio.createCandidate(sequelize, { episodeId: ep, sourceAssetId: source.id, userId: USER });
    const stale = (await stateOf(ep)).revision;
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet!"'));
    const args = { episodeId: ep, candidateId: candidate.id, beatNumber: 6, lineIndex: 0, userId: USER };
    await expectRefusal(studio.associate(sequelize, { ...args, scriptRevision: stale }), 409, 'SCRIPT_CHANGED');
    await expectRefusal(studio.associate(sequelize, { ...args, scriptRevision: undefined }), 409, 'SCRIPT_REVISION_REQUIRED');
    const rev = (await stateOf(ep)).revision;
    await expectRefusal(studio.associate(sequelize, { ...args, scriptRevision: rev, lineIndex: 3 }), 409, 'PRIME_LINE');
    await expectRefusal(studio.associate(sequelize, { ...args, scriptRevision: rev, lineIndex: 40 }), 409, 'NO_SUCH_LINE');
    await expectRefusal(studio.associate(sequelize, { ...args, scriptRevision: rev, beatNumber: 15 }), 400, 'BAD_BEAT');
    await expectRefusal(studio.associate(sequelize, { ...args, scriptRevision: rev, beatNumber: 7 }), 409, 'NO_SUCH_LINE');
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM line_voice_associations WHERE candidate_id = :c', { c: candidate.id });
    expect(n).toBe(0);
    // Another episode's take is not found here.
    const other = await makeEpisode();
    await expectRefusal(studio.associate(sequelize, { ...args, episodeId: other, scriptRevision: (await stateOf(other)).revision }), 404);
  });

  test('B1-6 approve needs bound, current association and latest revision; a re-trim makes it outdated_take', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 6, 2);
    const { approval_id: id } = await approveTake(ep, take);
    expect((await stateOfApproval(ep, id)).state).toBe('valid');
    await studio.reviseCandidate(sequelize, { episodeId: ep, candidateId: take.candidate.id, settings: { in_ms: 100 }, userId: USER });
    expect((await stateOfApproval(ep, id))).toMatchObject({ state: 'outdated_take', reason: 'take_changed' });
    // The old revision cannot be approved; the new one can.
    await expectRefusal(approveTake(ep, take), 409, 'NOT_LATEST_REVISION');
    const latest = (await rows('SELECT id FROM line_voice_candidate_revisions WHERE candidate_id = :c ORDER BY revision_no DESC LIMIT 1', { c: take.candidate.id }))[0];
    const again = await approveTake(ep, { ...take, revision: latest });
    expect(again.superseded).toEqual([id]);
    // A take with no line cannot be approved.
    const { source } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(900), userId: USER });
    const loose = await studio.createCandidate(sequelize, { episodeId: ep, sourceAssetId: source.id, userId: USER });
    await expectRefusal(approveTake(ep, loose), 409, 'NOT_ASSOCIATED');
  });

  test('B1-6 revision ranges are checked against the probed source length', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 6, 0, { ms: 1000 });
    const revise = (settings) => studio.reviseCandidate(sequelize, { episodeId: ep, candidateId: take.candidate.id, settings, userId: USER });
    await expectRefusal(revise({ out_ms: 1001 }), 400, 'BAD_RANGE');
    await expectRefusal(revise({ in_ms: 500, out_ms: 500 }), 400, 'BAD_RANGE');
    await expectRefusal(revise({ gain_db: 13 }), 400, 'BAD_GAIN');
    await expectRefusal(revise({ fade_in_ms: 600, fade_out_ms: 600 }), 400, 'BAD_FADE');
    const { revision } = await revise({ gain_db: 0.3, fade_in_ms: 40 });
    expect(revision).toMatchObject({ revision_no: 2, gain_db: '0.3', fade_in_ms: 40, in_ms: 0, out_ms: 1000 });
  });

  test('B1-7 a script save makes approvals need re-confirming; a stale batch writes nothing; a current one confirms matching items', async () => {
    const ep = await makeEpisode();
    const a = await takeAt(ep, 6, 0);
    const b = await takeAt(ep, 6, 1);
    const { approval_id: idA } = await approveTake(ep, a);
    const { approval_id: idB } = await approveTake(ep, b);
    const stale = (await stateOf(ep)).revision;
    // Beat 8 edited: beat 6's lines unchanged.
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet, now!"'));
    let sum = await studio.summary(sequelize, { episodeId: ep });
    expect(sum.counts).toEqual({ needs_reconfirm: 2 });
    expect(sum.beats['6']).toEqual({ needs_reconfirm: 2 });
    const items = sum.approvals.map((x) => ({ approval_id: x.approval_id, context_hash: x.context_hash }));
    await expectRefusal(studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: stale, items, userId: USER }), 409, 'SCRIPT_CHANGED');
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM line_voice_reconfirmations WHERE approval_id IN (:ids)', { ids: [idA, idB] });
    expect(n).toBe(0);
    // Now edit Guest's line: A (line 0) keeps its words but its neighbour changed; B (the Guest line) changed.
    await saveScript(ep, SCRIPT.replace('Guest: "Love the look!"', 'Guest: "Love it!"').replace('Lala: "Closet time."', 'Lala: "Closet, now!"'));
    sum = await studio.summary(sequelize, { episodeId: ep });
    const out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: sum.script_revision, items, userId: USER });
    expect(out.confirmed).toEqual([]);
    expect(out.refused.map((r) => r.reason).sort()).toEqual(['moved', 'words_changed']);
    // Refused for a broken line: recorded invalid, for good.
    expect((await stateOfApproval(ep, idA)).state).toBe('invalid');
  });

  test('B1-7 re-confirming unchanged lines makes them valid; an already valid one is not confirmed again', async () => {
    const ep = await makeEpisode();
    const a = await takeAt(ep, 6, 0);
    const { approval_id: id } = await approveTake(ep, a);
    let out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: (await stateOfApproval(ep, id)).context_hash }], userId: USER });
    expect(out.refused).toEqual([{ approval_id: id, reason: 'already_valid' }]);
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet, now!"'));
    const x = await stateOfApproval(ep, id);
    expect(x.state).toBe('needs_reconfirm');
    out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: 'f'.repeat(64) }], userId: USER });
    expect(out.refused).toEqual([{ approval_id: id, reason: 'context_mismatch' }]);
    out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: x.context_hash }], userId: USER });
    expect(out.confirmed).toEqual([id]);
    expect((await stateOfApproval(ep, id)).state).toBe('valid');
  });

  test('B1-8 A -> B -> A: a restored script never makes an approval valid by itself', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 6, 2);
    const { approval_id: id } = await approveTake(ep, take);
    const approvedRevision = (await stateOf(ep)).revision;
    // B: the line changed, and nothing observed it.
    await saveScript(ep, SCRIPT.replace('Lala: Okay.\nPrime', 'Lala: Fine then.\nPrime'));
    // A again: the revision hash is the approved one, but the approval is not silently valid.
    await saveScript(ep, SCRIPT);
    expect((await stateOf(ep)).revision).toBe(approvedRevision);
    expect((await stateOfApproval(ep, id)).state).toBe('needs_reconfirm');

    // Observed: B with an approval attempt for another take at that line records the approval invalid.
    await saveScript(ep, SCRIPT.replace('Lala: Okay.\nPrime', 'Lala: Fine then.\nPrime'));
    const other = await takeAt(ep, 6, 2);
    await approveTake(ep, other);
    await saveScript(ep, SCRIPT);
    // Recorded invalid when the approval of the other take observed the broken line, and superseded by that
    // approval; the script back at A does not change either. The summary lists the line once.
    const [row] = await rows('SELECT invalidated_at, superseded_at FROM line_voice_approvals WHERE id = :id', { id });
    expect(row.invalidated_at).not.toBeNull();
    expect(row.superseded_at).not.toBeNull();
    const listed = (await studio.summary(sequelize, { episodeId: ep })).approvals.filter((a) => a.beat_number === 6 && a.line_index === 2);
    expect(listed).toHaveLength(1);
    expect(listed[0].candidate_id).toBe(other.candidate.id);
    // It cannot be re-confirmed; only a new approval of the take makes the line valid.
    const out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: 'a'.repeat(64) }], userId: USER });
    expect(out.confirmed).toEqual([]);
  });

  test('B1-9 two approvals for one line at the same moment: one wins, the other gets 409', async () => {
    const ep = await makeEpisode();
    const a = await takeAt(ep, 6, 0);
    const b = await takeAt(ep, 6, 0);
    const results = await Promise.allSettled([approveTake(ep, a), approveTake(ep, b)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');
    expect(ok.length + refused.length).toBe(2);
    // Either both serialised (the second superseding the first) or one 409 for the race.
    if (refused.length) expect(refused[0].reason).toMatchObject({ status: 409, code: 'APPROVAL_RACE' });
    const current = await rows(`SELECT id FROM line_voice_approvals WHERE episode_id = :ep AND superseded_at IS NULL AND invalidated_at IS NULL`, { ep });
    expect(current).toHaveLength(1);
  });

  test('B1-10 an approval racing a script save waits for it, then is refused against the new revision', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 6, 0);
    const rev = (await stateOf(ep)).revision;
    let release;
    const gate = new Promise((r) => { release = r; });
    // The save holds the episode row (FOR UPDATE) while it composes.
    const saving = saveEpisodeScript(models, ep, { writer: 'test', compose: async () => { await gate; return { script: SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet!"') }; } });
    await sleep(150);
    const approving = studio.approve(sequelize, { episodeId: ep, candidateId: take.candidate.id, candidateRevisionId: take.revision.id, scriptRevision: rev, userId: USER });
    let settled = false;
    approving.then(() => { settled = true; }, () => { settled = true; });
    await sleep(300);
    expect(settled).toBe(false); // waiting on the save's row lock
    release();
    await saving;
    await expectRefusal(approving, 409, 'SCRIPT_CHANGED');
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM line_voice_approvals WHERE episode_id = :ep', { ep });
    expect(n).toBe(0);
  });

  test('B1-11 legacy import twice: one set of rows, none associated, none approved; old rows untouched', async () => {
    const ep = await makeEpisode();
    const clipKey = `episodes/${ep}/voice-clips/${uuid()}.webm`;
    stored.set(clipKey, Buffer.from(JSON.stringify({ audio: true, ms: 3200 })));
    const clipId = uuid();
    await run(`INSERT INTO script_voice_clips (id, episode_id, beat_number, line_index, speaker, line_text, s3_key, url, content_type, created_at, updated_at)
      VALUES (:id, :ep, 6, 0, 'Lala', 'This is my moment.', :key, 'https://x/y', 'audio/webm', NOW(), NOW())`, { id: clipId, ep, key: clipKey });
    const before = (await rows('SELECT * FROM script_voice_clips WHERE id = :id', { id: clipId }))[0];
    const first = await studio.importLegacy(sequelize, { episodeId: ep, userId: USER });
    expect(first.imported).toHaveLength(1);
    const second = await studio.importLegacy(sequelize, { episodeId: ep, userId: USER });
    expect(second.imported).toHaveLength(0);
    expect(second.legacy_sources).toBe(1);
    const takes = await studio.listTakes(sequelize, { episodeId: ep });
    expect(takes).toHaveLength(1);
    expect(takes[0]).toMatchObject({ source_kind: 'legacy', association_id: null, source_duration_ms: 3200 });
    expect((await studio.summary(sequelize, { episodeId: ep })).approvals).toEqual([]);
    expect((await rows('SELECT * FROM script_voice_clips WHERE id = :id', { id: clipId }))[0]).toEqual(before);
  });

  test('removing a take keeps its source and records its approval invalid; reassigning a take invalidates its approval', async () => {
    const ep = await makeEpisode();
    const a = await takeAt(ep, 6, 0);
    const { approval_id: idA } = await approveTake(ep, a);
    await studio.associate(sequelize, { episodeId: ep, candidateId: a.candidate.id, scriptRevision: (await stateOf(ep)).revision, beatNumber: 6, lineIndex: 2, userId: USER });
    expect((await rows('SELECT invalidated_reason FROM line_voice_approvals WHERE id = :id', { id: idA }))[0].invalidated_reason).toBe('take_reassigned');
    const b = await takeAt(ep, 8, 0);
    const { approval_id: idB } = await approveTake(ep, b);
    const out = await studio.removeCandidate(sequelize, { episodeId: ep, candidateId: b.candidate.id });
    expect(out.approvals_invalidated).toEqual([idB]);
    expect((await rows('SELECT deleted_at FROM voice_source_assets WHERE id = :id', { id: b.source.id }))[0].deleted_at).toBeNull();
  });

  test('an episode row with no updated_at (allowed in production) can still be approved; any later save asks for re-confirming', async () => {
    const ep = await makeEpisode();
    await run('UPDATE episodes SET updated_at = NULL WHERE id = :ep', { ep });
    const take = await takeAt(ep, 6, 0);
    const { approval_id: id } = await approveTake(ep, take);
    expect((await stateOfApproval(ep, id)).state).toBe('valid');
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet!"'));
    expect((await stateOfApproval(ep, id)).state).toBe('needs_reconfirm');
  });

  test('an edit to the episode that is not the script also asks for re-confirming (known cost of E1 without E2)', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 6, 0);
    const { approval_id: id } = await approveTake(ep, take);
    await sleep(5);
    await run("UPDATE episodes SET title = 'Renamed', updated_at = NOW() WHERE id = :ep", { ep });
    expect((await stateOfApproval(ep, id)).state).toBe('needs_reconfirm');
  });

  test('a soft-deleted episode is not found', async () => {
    const ep = await makeEpisode();
    await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :ep', { ep });
    await expectRefusal(studio.summary(sequelize, { episodeId: ep }), 404);
  });
});
