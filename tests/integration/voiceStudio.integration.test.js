/**
 * Voice Studio B1 on Postgres (Evoni, 2026-10-27; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, R5.5 B1-1..B1-12).
 * The six tables, the service and the routes, with only the media faked
 * (ffprobe, S3): a "file" here is JSON naming its audio and length. Real
 * audio, ffprobe and the S3 adapter: voiceStudioMedia.integration.test.js.
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
// Timeline C1's dialogue placements hold foreign keys to these tables, so its (empty) tables come down
// first and go back up after: the order a rollback runs in.
const editMigration = require('../../src/migrations/20261028100000-create-episode-edit-tables');

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
  const approveTake = async (ep, take, expected = null) => studio.approve(sequelize, {
    episodeId: ep, candidateId: take.candidate.id, candidateRevisionId: take.revision.id, scriptRevision: (await stateOf(ep)).revision,
    expectedApprovalId: expected, userId: USER,
  });
  const saveScript = (ep, text, opts = {}) => saveEpisodeScript(models, ep, { writer: 'test', compose: async () => ({ script: text }), ...opts });
  const summaryOf = (ep) => studio.summary(sequelize, { episodeId: ep });
  const stateOfApproval = async (ep, id) => (await summaryOf(ep)).approvals.find((a) => a.approval_id === id);
  const approvalRow = async (id) => (await rows('SELECT * FROM line_voice_approvals WHERE id = :id', { id }))[0];
  const versionIds = async (ep) => (await rows('SELECT id FROM episode_script_versions WHERE episode_id = :ep', { ep })).map((r) => r.id);
  // The save number is a BIGINT: compared as a decimal string, counted with BigInt.
  const plus = (seq, n) => (BigInt(seq) + BigInt(n)).toString();
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
    const [{ edit }] = await rows("SELECT to_regclass('public.timeline_items') IS NOT NULL AS edit");
    if (edit) await editMigration.down(sequelize.getQueryInterface());
    await migration.down(sequelize.getQueryInterface());
    const [{ reg }] = await rows("SELECT to_regclass('public.voice_source_assets') AS reg");
    expect(reg).toBeNull();
    await migration.up(sequelize.getQueryInterface());
    if (edit) await editMigration.up(sequelize.getQueryInterface());
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
    expect((await stateOfApproval(ep, id))).toMatchObject({ state: 'current', playable: true });
    await studio.reviseCandidate(sequelize, { episodeId: ep, candidateId: take.candidate.id, settings: { in_ms: 100 }, userId: USER });
    expect((await stateOfApproval(ep, id))).toMatchObject({ state: 'outdated_take', reason: 'take_changed', playable: false });
    // The old revision cannot be approved; the new one can.
    await expectRefusal(approveTake(ep, take, id), 409, 'NOT_LATEST_REVISION');
    const latest = (await rows('SELECT id FROM line_voice_candidate_revisions WHERE candidate_id = :c ORDER BY revision_no DESC LIMIT 1', { c: take.candidate.id }))[0];
    const again = await approveTake(ep, { ...take, revision: latest }, id);
    expect(again.superseded).toEqual([id]);
    expect(await approvalRow(id)).toMatchObject({ invalidated_reason: 'take_changed', superseded_by: again.approval_id });
    // A take with no line cannot be approved; nor can a write that does not say what it expects at the line.
    const { source } = await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(900), userId: USER });
    const loose = await studio.createCandidate(sequelize, { episodeId: ep, sourceAssetId: source.id, userId: USER });
    await expectRefusal(approveTake(ep, loose), 409, 'NOT_ASSOCIATED');
    await expectRefusal(studio.approve(sequelize, { episodeId: ep, candidateId: take.candidate.id, candidateRevisionId: latest.id, scriptRevision: (await stateOf(ep)).revision, userId: USER }), 400, 'EXPECTED_APPROVAL_REQUIRED');
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

  test('B1-7 a script save puts approvals up for review; a stale batch writes nothing; a current one confirms them', async () => {
    const ep = await makeEpisode();
    const { approval_id: idA } = await approveTake(ep, await takeAt(ep, 6, 0));
    const { approval_id: idB } = await approveTake(ep, await takeAt(ep, 6, 1));
    const stale = (await stateOf(ep)).revision;
    // Beat 8 edited: beat 6's lines unchanged.
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet, now!"'));
    const sum = await summaryOf(ep);
    expect(sum.counts).toEqual({ needs_review: 2 });
    expect(sum.approvals.map((a) => [a.reason, a.playable])).toEqual([['script_saved', false], ['script_saved', false]]);
    const items = sum.approvals.map((x) => ({ approval_id: x.approval_id, context_hash: x.context_hash }));
    await expectRefusal(studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: stale, items, userId: USER }), 409, 'SCRIPT_CHANGED');
    const [{ n }] = await rows('SELECT count(*)::int AS n FROM line_voice_reconfirmations WHERE approval_id IN (:ids)', { ids: [idA, idB] });
    expect(n).toBe(0);
    const out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: sum.script_revision, items, userId: USER });
    expect(out.confirmed.sort()).toEqual([idA, idB].sort());
    expect((await summaryOf(ep)).counts).toEqual({ current: 2 });
  });

  test('B1-7 a neighbour edited: the unchanged line is reviewed, never invalidated; the edited line is', async () => {
    const ep = await makeEpisode();
    const { approval_id: idA } = await approveTake(ep, await takeAt(ep, 6, 0));
    const { approval_id: idB } = await approveTake(ep, await takeAt(ep, 6, 1));
    // Guest's line (B) edited: A keeps its words and place, its neighbour changed.
    await saveScript(ep, SCRIPT.replace('Guest: "Love the look!"', 'Guest: "Love it!"'));
    const sum = await summaryOf(ep);
    const a = sum.approvals.find((x) => x.approval_id === idA);
    expect(a).toMatchObject({ state: 'needs_review', reason: 'neighbours_changed', playable: false });
    expect(a.context_hash).not.toBe(a.approved_context_hash);
    expect(sum.approvals.find((x) => x.approval_id === idB)).toMatchObject({ state: 'unbound', reason: 'words_changed' });
    // Shown with the line as it is now; confirmed against that context.
    const items = sum.approvals.map((x) => ({ approval_id: x.approval_id, context_hash: x.context_hash }));
    const out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: sum.script_revision, items, userId: USER });
    expect(out.confirmed).toEqual([idA]);
    expect(out.refused).toEqual([expect.objectContaining({ approval_id: idB, state: 'unbound', reason: 'words_changed' })]);
    expect(await approvalRow(idA)).toMatchObject({ invalidated_at: null, superseded_at: null, revoked_at: null });
    expect((await approvalRow(idB)).invalidated_reason).toBe('words_changed');
    expect((await stateOfApproval(ep, idA))).toMatchObject({ state: 'current', playable: true });
    // The Guest line put back: B stays invalid (recorded); A is up for review again, not invalidated.
    await saveScript(ep, SCRIPT);
    expect((await stateOfApproval(ep, idB)).state).toBe('invalid');
    // Against its approved context it is unchanged; the script was saved since its re-confirmation.
    expect((await stateOfApproval(ep, idA))).toMatchObject({ state: 'needs_review', reason: 'script_saved' });
  });

  test('B1-7 an already current approval is not confirmed again; a wrong context is refused', async () => {
    const ep = await makeEpisode();
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 6, 0));
    const confirm = async (hash) => studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: hash }], userId: USER });
    expect((await confirm((await stateOfApproval(ep, id)).context_hash)).refused).toEqual([{ approval_id: id, reason: 'already_current' }]);
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet, now!"'));
    const x = await stateOfApproval(ep, id);
    expect(x.state).toBe('needs_review');
    expect((await confirm('f'.repeat(64))).refused).toEqual([{ approval_id: id, reason: 'context_mismatch' }]);
    expect((await confirm(x.context_hash)).confirmed).toEqual([id]);
    expect((await stateOfApproval(ep, id)).state).toBe('current');
  });

  test('B1-8 A -> B -> A: the restored script has the approved revision, but the approval is not current again by itself', async () => {
    const ep = await makeEpisode();
    const B = SCRIPT.replace('This is my moment.', 'This is my time.');
    const take = await takeAt(ep, 6, 0);
    const { approval_id: id } = await approveTake(ep, take);
    const approved = await stateOf(ep);
    expect(String((await approvalRow(id)).pinned_script_seq)).toBe(approved.seq);
    // B: the line changed, and nothing observed it. Then A again.
    await saveScript(ep, B);
    await saveScript(ep, SCRIPT);
    const restored = await stateOf(ep);
    expect(restored.revision).toBe(approved.revision);
    expect(restored.seq).toBe(plus(approved.seq, 2));
    expect((await stateOfApproval(ep, id))).toMatchObject({ state: 'needs_review', reason: 'script_saved', playable: false });

    // Observed: at B, approving another take for that line records the approval invalid; A again does not revive it.
    await saveScript(ep, B);
    const other = await takeAt(ep, 6, 0);
    const { approval_id: next } = await approveTake(ep, other, id);
    await saveScript(ep, SCRIPT);
    expect(await approvalRow(id)).toMatchObject({ invalidated_reason: 'words_changed', superseded_by: next });
    const listed = (await summaryOf(ep)).approvals.filter((a) => a.beat_number === 6 && a.line_index === 0);
    expect(listed.map((a) => a.candidate_id)).toEqual([other.candidate.id]);
    const out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: 'a'.repeat(64) }], userId: USER });
    expect(out.confirmed).toEqual([]);
  });

  test('B1-8 an edited line with an identical twin is not guessed: it waits for a person, then is withdrawn and replaced', async () => {
    const ep = await makeEpisode();
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 6, 2));
    await saveScript(ep, SCRIPT.replace('Lala: Okay.\nPrime', 'Lala: Fine then.\nPrime'));
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'ambiguous', reason: 'moved_or_edited', playable: false, resolution: { candidates: [4] } });
    const other = await takeAt(ep, 6, 2);
    await expectRefusal(approveTake(ep, other, id), 409, 'LINE_HAS_UNRESOLVED_APPROVAL');
    await studio.revokeApproval(sequelize, { episodeId: ep, approvalId: id, userId: USER });
    const { approval_id: next } = await approveTake(ep, other, null);
    expect(await approvalRow(id)).toMatchObject({ superseded_by: next, invalidated_at: null });
    expect((await approvalRow(id)).revoked_at).not.toBeNull();
  });

  test('A -> empty -> A, repeated: the save number moves on each time, so an old approval never comes back by itself', async () => {
    const ep = await makeEpisode();
    // An earlier empty round trip first: after it the newest version already holds A (the case version rows missed).
    await saveScript(ep, '');
    await saveScript(ep, SCRIPT);
    const take = await takeAt(ep, 6, 2);
    const { approval_id: id } = await approveTake(ep, take);
    const approved = await stateOf(ep);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await saveScript(ep, '');
      expect((await stateOfApproval(ep, id)).state).toBe('unbound');
      await saveScript(ep, SCRIPT);
      const now = await stateOf(ep);
      expect(now.revision).toBe(approved.revision);
      expect(now.seq).toBe(plus(approved.seq, 2 * (cycle + 1)));
      expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'needs_review', reason: 'script_saved', playable: false });
    }
    expect((await studio.playableApprovals(sequelize, { episodeId: ep })).takes).toEqual([]);
    // Only a person's re-confirmation makes it current again, pinned to the new save number.
    const x = await stateOfApproval(ep, id);
    await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: x.context_hash }], userId: USER });
    expect((await stateOfApproval(ep, id)).state).toBe('current');
    const [conf] = await rows('SELECT pinned_script_seq::text AS seq FROM line_voice_reconfirmations WHERE approval_id = :id', { id });
    expect(conf.seq).toBe((await stateOf(ep)).seq);
  });

  test('version rows with the same time, or a frozen clock, do not decide anything: the save number does', async () => {
    const ep = await makeEpisode();
    await saveScript(ep, SCRIPT.replace('This is my moment.', 'This is my moment 0.'));
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 8, 0));
    // Saves with the clock frozen: their version rows all share one created_at, the approval's own version's too.
    jest.useFakeTimers({ now: new Date('2026-10-27T12:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'hrtime', 'performance'] });
    try {
      await saveScript(ep, SCRIPT.replace('This is my moment.', 'This is my moment 1.'));
      await saveScript(ep, SCRIPT.replace('This is my moment.', 'This is my moment 0.'));
    } finally {
      jest.useRealTimers();
    }
    await run('UPDATE episode_script_versions SET created_at = :t WHERE episode_id = :ep', { ep, t: '2026-10-27T12:00:00.000Z' });
    expect((await rows('SELECT DISTINCT created_at FROM episode_script_versions WHERE episode_id = :ep', { ep }))).toHaveLength(1);
    // Back to the approved text, every version at one time: still a save since, so still for review.
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'needs_review', reason: 'script_saved' });
  });

  test('saves at once around an approval: each moves the save number on, and the approval needs review after any of them', async () => {
    const ep = await makeEpisode();
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 8, 0));
    const before = (await stateOf(ep)).seq;
    await Promise.all([1, 2, 3, 4].map((n) => saveScript(ep, SCRIPT.replace('This is my moment.', `At once ${n}.`))));
    expect((await stateOf(ep)).seq).toBe(plus(before, 4));
    expect((await stateOfApproval(ep, id)).state).toBe('needs_review');
  });

  test('every save that changes the text moves the save number on (save, lock, generate, restore); nothing else does', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 8, 0);
    const seen = [];
    const step = async (fn) => { await fn(); const v = (await stateOf(ep)).seq; expect(seen).not.toContain(v); seen.push(v); };
    const line = (n) => SCRIPT.replace('This is my moment.', `This is my moment ${n}.`);
    await step(() => saveScript(ep, line(1), { source: 'save' }));
    await step(() => saveScript(ep, line(2), { source: 'lock' }));
    await step(() => saveScript(ep, line(3), { source: 'generate' }));
    const restoreTo = (await rows("SELECT id, script_content FROM episode_script_versions WHERE episode_id = :ep AND script_content = :t", { ep, t: line(1) }))[0];
    await step(() => saveEpisodeScript(models, ep, { writer: 'test', source: 'save', restoredFrom: restoreTo.id, compose: async () => ({ script: restoreTo.script_content }) }));
    const sources = (await rows('SELECT source FROM episode_script_versions WHERE episode_id = :ep', { ep })).map((r) => r.source).sort();
    expect(sources).toEqual(['generate', 'lock', 'restore', 'save']);

    // Approved now; then a lock-only save (same text) and edits to the episode that are not the script.
    const { approval_id: id } = await approveTake(ep, take);
    const pinned = (await stateOf(ep)).seq;
    await saveEpisodeScript(models, ep, { writer: 'test', source: 'lock', compose: async (row) => ({ script: row.script_content, lockedBeats: [6] }) });
    await run(`UPDATE episodes SET title = 'Renamed', episode_title = 'New', air_date = NOW(), total_income = 1200, total_expenses = 300,
      money_plan = '{"coins": 50}'::jsonb, distribution_metadata = '{"x": 1}'::jsonb, description = 'd', updated_at = NOW() WHERE id = :ep`, { ep });
    expect((await stateOf(ep)).seq).toBe(pinned);
    expect((await stateOfApproval(ep, id))).toMatchObject({ state: 'current', playable: true });
  });

  test('B1-9 two approvals sent with the same expected approval race: exactly one is saved, the other is a 409', async () => {
    for (let round = 0; round < 5; round += 1) {
      const ep = await makeEpisode();
      const a = await takeAt(ep, 6, 0);
      const b = await takeAt(ep, 6, 0);
      const results = await Promise.allSettled([approveTake(ep, a, null), approveTake(ep, b, null)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const refused = results.filter((r) => r.status === 'rejected');
      expect(refused).toHaveLength(1);
      expect(refused[0].reason).toMatchObject({ status: 409, code: 'APPROVAL_CHANGED' });
      const inForce = await rows('SELECT id FROM line_voice_approvals WHERE episode_id = :ep AND superseded_at IS NULL AND invalidated_at IS NULL AND revoked_at IS NULL', { ep });
      expect(inForce).toHaveLength(1);
      // The loser's view is stale; with the winner as its expected approval it can replace it.
      const winner = inForce[0].id;
      const loser = results[0].status === 'rejected' ? a : b;
      expect((await approveTake(ep, loser, winner)).superseded).toEqual([winner]);
    }
    // The same take sent twice at once from one view, and a made-up expected approval.
    const ep = await makeEpisode();
    const c = await takeAt(ep, 6, 0);
    const twice = await Promise.allSettled([approveTake(ep, c, null), approveTake(ep, c, null)]);
    expect(twice.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(twice.find((r) => r.status === 'rejected').reason).toMatchObject({ status: 409, code: 'APPROVAL_CHANGED' });
    await expectRefusal(approveTake(ep, c, uuid()), 409, 'APPROVAL_CHANGED');
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
    const approving = studio.approve(sequelize, { episodeId: ep, candidateId: take.candidate.id, candidateRevisionId: take.revision.id, scriptRevision: rev, expectedApprovalId: null, userId: USER });
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

  test('B1-10 a script save racing an approval waits for it; the approval keeps the save number it saw and then needs review', async () => {
    const ep = await makeEpisode();
    await saveScript(ep, SCRIPT.replace('This is my moment.', 'This is my moment!'));
    const take = await takeAt(ep, 8, 0);
    const rev = (await stateOf(ep)).revision;
    const before = (await stateOf(ep)).seq;
    // Hold the line's lock elsewhere, so the approval stops inside its transaction, after FOR SHARE on the episode.
    let releaseLine;
    const lineHeld = new Promise((r) => { releaseLine = r; });
    let held;
    const heldReady = new Promise((r) => { held = r; });
    const holder = sequelize.transaction(async (t) => {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', { replacements: { key: `voice-line:${ep}:8:0` }, transaction: t });
      held();
      await lineHeld;
    });
    await heldReady;
    const approving = studio.approve(sequelize, { episodeId: ep, candidateId: take.candidate.id, candidateRevisionId: take.revision.id, scriptRevision: rev, expectedApprovalId: null, userId: USER });
    await sleep(200);
    let saved = false;
    const saving = saveScript(ep, SCRIPT).then(() => { saved = true; });
    await sleep(300);
    expect(saved).toBe(false); // the save waits for the approval's FOR SHARE
    releaseLine();
    await holder;
    const { approval_id: id } = await approving;
    await saving;
    expect(String((await approvalRow(id)).pinned_script_seq)).toBe(before);
    expect((await stateOf(ep)).seq).toBe(plus(before, 1));
    expect((await stateOfApproval(ep, id)).state).toBe('needs_review');
  });

  test('repeated dialogue: identical lines are approved apart by index; occurrence is stored, not part of the identity', async () => {
    const REPEAT = beat(4, 'Lala: Okay.', 'Prime: Go.', 'Lala: Okay.', 'Lala: Okay.');
    const ep = await makeEpisode(REPEAT);
    const ids = {};
    for (const i of [0, 2, 3]) ids[i] = (await approveTake(ep, await takeAt(ep, 4, i))).approval_id;
    let sum = await summaryOf(ep);
    expect(sum.approvals.map((a) => [a.line_index, a.occurrence, a.state])).toEqual([[0, 1, 'current'], [2, 2, 'current'], [3, 3, 'current']]);
    // A second take for the second "Okay.": the page must name the approval it replaces.
    const second = await takeAt(ep, 4, 2);
    await expectRefusal(approveTake(ep, second, null), 409, 'APPROVAL_CHANGED');
    const replaced = await approveTake(ep, second, ids[2]);
    expect(replaced.superseded).toEqual([ids[2]]);
    sum = await summaryOf(ep);
    expect(sum.approvals.map((a) => a.approval_id)).toEqual([ids[0], replaced.approval_id, ids[3]]);
    expect(sum.counts).toEqual({ current: 3 });

    // The first "Okay." deleted: every remaining "Okay." could be any of the takes. None plays, none is invalidated.
    await saveScript(ep, beat(4, 'Prime: Go.', 'Lala: Okay.', 'Lala: Okay.'));
    sum = await summaryOf(ep);
    expect(sum.approvals.map((a) => [a.line_index, a.state, a.playable])).toEqual([[0, 'ambiguous', false], [2, 'ambiguous', false], [3, 'ambiguous', false]]);
    expect(sum.approvals[0].resolution.candidates).toEqual([1, 2]);
    expect((await studio.playableApprovals(sequelize, { episodeId: ep })).takes).toEqual([]);
    // An ambiguous take is not approved again by itself either.
    const a0 = (await rows('SELECT candidate_id, candidate_revision_id FROM line_voice_approvals WHERE id = :id', { id: ids[0] }))[0];
    await expectRefusal(studio.approve(sequelize, { episodeId: ep, candidateId: a0.candidate_id, candidateRevisionId: a0.candidate_revision_id, scriptRevision: (await stateOf(ep)).revision, expectedApprovalId: ids[0], userId: USER }), 409, 'NOT_BOUND');
    const rev = (await stateOf(ep)).revision;
    const resolve = (approvalId, lineIndex, expected = null) => studio.resolveApproval(sequelize, { episodeId: ep, approvalId, scriptRevision: rev, lineIndex, expectedApprovalId: expected, userId: USER });
    // A person picks: the first take is for the line now at 1, the second stays at 2.
    await expectRefusal(resolve(ids[0], 0), 409, 'NOT_A_CANDIDATE');
    const r0 = await resolve(ids[0], 1);
    const r2 = await resolve(replaced.approval_id, 2);
    // The third take could be for either, and both are taken.
    await expectRefusal(resolve(ids[3], 1), 409, 'APPROVAL_CHANGED');
    await expectRefusal(resolve(ids[3], 1, r0.approval_id), 409, 'LINE_ALREADY_APPROVED');
    await studio.revokeApproval(sequelize, { episodeId: ep, approvalId: ids[3], userId: USER });
    sum = await summaryOf(ep);
    expect(sum.approvals.map((a) => [a.line_index, a.state])).toEqual([[1, 'current'], [2, 'current'], [3, 'revoked']]);
    expect((await approvalRow(ids[0])).superseded_by).toBe(r0.approval_id);
    expect((await approvalRow(replaced.approval_id)).superseded_by).toBe(r2.approval_id);
  });

  test('a moved line waits for a person: not invalidated, not playable; put back it is up for review; confirmed it moves', async () => {
    const ep = await makeEpisode();
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 6, 0));
    const inserted = SCRIPT.replace('## BEAT: 6 · Beat 6\n', '## BEAT: 6 · Beat 6\nGuest: "Hi!"\n');
    await saveScript(ep, inserted);
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'moved', playable: false, resolution: { candidates: [1] } });
    // Nothing approves it where it was: the take's association is not bound now.
    const latest = (await rows('SELECT candidate_id, candidate_revision_id FROM line_voice_approvals WHERE id = :id', { id }))[0];
    await expectRefusal(studio.approve(sequelize, { episodeId: ep, candidateId: latest.candidate_id, candidateRevisionId: latest.candidate_revision_id, scriptRevision: (await stateOf(ep)).revision, expectedApprovalId: id, userId: USER }), 409, 'NOT_BOUND');
    expect((await studio.playableApprovals(sequelize, { episodeId: ep })).takes).toEqual([]);
    // Reconfirming cannot move it.
    const sum = await summaryOf(ep);
    const out = await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: sum.script_revision, items: [{ approval_id: id, context_hash: 'b'.repeat(64) }], userId: USER });
    expect(out.refused).toEqual([expect.objectContaining({ approval_id: id, state: 'moved' })]);
    // Put back: the same place again, for review (never silently current).
    await saveScript(ep, SCRIPT);
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'needs_review', reason: 'script_saved' });
    expect((await approvalRow(id)).invalidated_at).toBeNull();

    // Moved again, and a new take approved for the new line at its old place: the moved approval is resolved first.
    await saveScript(ep, inserted);
    const guest = await takeAt(ep, 6, 0);
    await expectRefusal(approveTake(ep, guest, null), 409, 'APPROVAL_CHANGED');
    await expectRefusal(approveTake(ep, guest, id), 409, 'LINE_HAS_UNRESOLVED_APPROVAL');
    const rev = (await stateOf(ep)).revision;
    const moved = await studio.resolveApproval(sequelize, { episodeId: ep, approvalId: id, scriptRevision: rev, lineIndex: 1, expectedApprovalId: null, userId: USER });
    expect(await stateOfApproval(ep, moved.approval_id)).toMatchObject({ state: 'current', line_index: 1 });
    expect(await approvalRow(id)).toMatchObject({ superseded_by: moved.approval_id, invalidated_at: null });
    await approveTake(ep, guest, null);
    expect((await summaryOf(ep)).counts).toEqual({ current: 2 });
    const history = await studio.approvalHistory(sequelize, { episodeId: ep });
    expect(history.map((h) => h.id)).toContain(id);
    expect(history).toHaveLength(3);
    // A stale page cannot confirm a move.
    await expectRefusal(studio.resolveApproval(sequelize, { episodeId: ep, approvalId: moved.approval_id, scriptRevision: rev.replace(/.$/, rev.endsWith('0') ? '1' : '0'), lineIndex: 1, expectedApprovalId: null, userId: USER }), 409, 'SCRIPT_CHANGED');
  });

  test('revoked: kept as history, never playable, once only; the line can then be approved afresh', async () => {
    const ep = await makeEpisode();
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 6, 0));
    await studio.revokeApproval(sequelize, { episodeId: ep, approvalId: id, userId: USER });
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'revoked', playable: false, revoked_by: USER });
    await expectRefusal(studio.revokeApproval(sequelize, { episodeId: ep, approvalId: id, userId: USER }), 409, 'APPROVAL_CHANGED');
    expect((await studio.playableApprovals(sequelize, { episodeId: ep })).takes).toEqual([]);
    const { approval_id: next } = await approveTake(ep, await takeAt(ep, 6, 0), null);
    expect(await approvalRow(id)).toMatchObject({ superseded_by: next });
    expect((await approvalRow(id)).revoked_at).not.toBeNull();
    expect((await summaryOf(ep)).approvals.map((a) => a.approval_id)).toEqual([next]);
  });

  test('only current approvals are playable: review, unbound, moved, ambiguous and revoked never are', async () => {
    const ep = await makeEpisode();
    const { approval_id: a0 } = await approveTake(ep, await takeAt(ep, 6, 0));
    const { approval_id: a1 } = await approveTake(ep, await takeAt(ep, 6, 1));
    const { approval_id: a4 } = await approveTake(ep, await takeAt(ep, 6, 4));
    const { approval_id: b0 } = await approveTake(ep, await takeAt(ep, 8, 0));
    expect((await studio.playableApprovals(sequelize, { episodeId: ep })).takes).toHaveLength(4);
    // Guest's words changed (a1 unbound, a0 neighbours changed); an "Okay." added after line 4 (a4 ambiguous).
    await saveScript(ep, SCRIPT.replace('Guest: "Love the look!"', 'Guest: "Wow."').replace('Lala: Okay.\n\n', 'Lala: Okay.\nLala: Okay.\n\n'));
    let sum = await summaryOf(ep);
    const stateOf2 = (id) => sum.approvals.find((x) => x.approval_id === id).state;
    expect([stateOf2(a0), stateOf2(a1), stateOf2(a4), stateOf2(b0)]).toEqual(['needs_review', 'unbound', 'ambiguous', 'needs_review']);
    expect((await studio.playableApprovals(sequelize, { episodeId: ep })).takes).toEqual([]);
    const b = sum.approvals.find((x) => x.approval_id === b0);
    await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: sum.script_revision, items: [{ approval_id: b0, context_hash: b.context_hash }], userId: USER });
    const play = await studio.playableApprovals(sequelize, { episodeId: ep });
    expect(play.takes.map((x) => x.approval_id)).toEqual([b0]);
    expect(play.takes[0]).toMatchObject({ beat_number: 8, line_index: 0, in_ms: 0, out_ms: 2000 });
    sum = await summaryOf(ep);
    expect(sum.approvals.filter((x) => x.playable).map((x) => x.approval_id)).toEqual([b0]);
  });

  test('version pruning ignores Voice Studio; an approval stays readable once every version of its day is pruned', async () => {
    const { KEEP } = require('../../src/services/scriptVersions');
    const ep = await makeEpisode();
    await saveScript(ep, SCRIPT.replace('This is my moment.', 'This is my moment 0.'));
    const ofItsDay = await versionIds(ep);
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 8, 0));
    const pinned = await approvalRow(id);
    for (let i = 1; i <= KEEP + 5; i += 1) await saveScript(ep, SCRIPT.replace('This is my moment.', `This is my moment ${i}.`));
    const kept = await versionIds(ep);
    expect(kept).toHaveLength(KEEP);
    for (const v of ofItsDay) expect(kept).not.toContain(v);
    // The approval reads as it did: what was approved, where, against which text and save number.
    expect(await approvalRow(id)).toEqual(pinned);
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'needs_review', reason: 'script_saved', words: 'Closet time.', speaker: 'Lala', beat_number: 8, line_index: 0 });
    const [hist] = await studio.approvalHistory(sequelize, { episodeId: ep });
    expect(hist).toMatchObject({ id, beat_number: 8, line_index: 0, words: 'Closet time.', speaker: 'Lala', pinned_script_seq: String(pinned.pinned_script_seq) });
    expect(hist.pinned_script_revision).toMatch(/^sr1-[0-9a-f]{40}$/);
    expect(hist).not.toHaveProperty('pinned_script_version_id');
    // A person can still re-confirm it; then withdraw it, and it stays in the history.
    const x = await stateOfApproval(ep, id);
    await studio.reconfirm(sequelize, { episodeId: ep, scriptRevision: (await stateOf(ep)).revision, items: [{ approval_id: id, context_hash: x.context_hash }], userId: USER });
    expect((await stateOfApproval(ep, id)).state).toBe('current');
    await studio.revokeApproval(sequelize, { episodeId: ep, approvalId: id, userId: USER });
    await saveScript(ep, SCRIPT.replace('This is my moment.', 'This is my moment last.'));
    expect((await studio.approvalHistory(sequelize, { episodeId: ep }))[0]).toMatchObject({ id, revoked_by: USER, words: 'Closet time.' });
  });

  test('an episode still at save number 0 is approved against 0; the text and the number are both needed for current', async () => {
    const ep = await makeEpisode();
    expect((await stateOf(ep)).seq).toBe('0');
    const { approval_id: id } = await approveTake(ep, await takeAt(ep, 8, 0));
    expect(String((await approvalRow(id)).pinned_script_seq)).toBe('0');
    expect((await stateOfApproval(ep, id)).state).toBe('current');
    // The text changed with no save number (a write around the save; guard 1 forbids it in the code): not current.
    await run('UPDATE episodes SET script_content = :t WHERE id = :ep', { ep, t: SCRIPT.replace('This is my moment.', 'Changed around the save.') });
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'needs_review', reason: 'script_saved' });
    await run('UPDATE episodes SET script_content = :t WHERE id = :ep', { ep, t: SCRIPT });
    expect((await stateOfApproval(ep, id)).state).toBe('current');
    // The same text with a later save number: not current either.
    await run('UPDATE episodes SET script_seq = script_seq + 1 WHERE id = :ep', { ep });
    expect(await stateOfApproval(ep, id)).toMatchObject({ state: 'needs_review', reason: 'script_saved' });
    // And the line context: the take's own line edited, the number and the text both new. Not current, never.
    await saveScript(ep, SCRIPT.replace('Lala: "Closet time."', 'Lala: "Closet, now."'));
    expect((await stateOfApproval(ep, id)).state).toBe('unbound');
  });

  test('migration order: without A1c the Voice Studio migration refuses and creates nothing; after A1c it runs (an isolated schema)', async () => {
    const { Sequelize } = require('sequelize');
    const a1c = require('../../src/migrations/20261027190000-add-episode-script-seq');
    const schema = `vs_order_${uuid().slice(0, 8)}`;
    await run(`CREATE SCHEMA "${schema}"`);
    const own = new Sequelize(process.env.DATABASE_URL, {
      logging: false, pool: { max: 1, min: 0 },
      hooks: { afterConnect: (conn) => conn.query(`SET search_path TO "${schema}", public`) },
    });
    // One text value, whatever row shape this connection returns.
    const tablesIn = async () => {
      const [[row]] = await own.query("SELECT coalesce(string_agg(table_name::text, ',' ORDER BY table_name), '') AS t FROM information_schema.tables WHERE table_schema = :schema", { replacements: { schema } });
      const text = Array.isArray(row) ? row[0] : row.t;
      return text ? text.split(',') : [];
    };
    try {
      // The tables the Voice Studio tables point at, as they are before A1c (no script_seq).
      await own.query('CREATE TABLE episodes (id UUID PRIMARY KEY, script_content TEXT); CREATE TABLE episode_raw_clips (id UUID PRIMARY KEY); CREATE TABLE script_voice_clips (id UUID PRIMARY KEY)');
      const before = await tablesIn();
      expect(before).toEqual(['episode_raw_clips', 'episodes', 'script_voice_clips']);
      await expect(migration.up(own.getQueryInterface())).rejects.toThrow(/needs episodes\.script_seq.*Nothing was created/);
      expect(await tablesIn()).toEqual(before);
      await a1c.up(own.getQueryInterface());
      await migration.up(own.getQueryInterface());
      expect(await tablesIn()).toEqual(expect.arrayContaining(['voice_source_assets', 'line_voice_candidates', 'line_voice_associations',
        'line_voice_candidate_revisions', 'line_voice_approvals', 'line_voice_reconfirmations']));
      // And back: Voice Studio first (empty), then A1c.
      await migration.down(own.getQueryInterface());
      expect(await tablesIn()).toEqual(before);
      await a1c.down(own.getQueryInterface());
    } finally {
      await own.close();
      await run(`DROP SCHEMA "${schema}" CASCADE`);
    }
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
    expect((await summaryOf(ep)).approvals).toEqual([]);
    expect((await rows('SELECT * FROM script_voice_clips WHERE id = :id', { id: clipId }))[0]).toEqual(before);
  });

  test('removing a take keeps its source and records its approval invalid; reassigning a take invalidates its approval', async () => {
    const ep = await makeEpisode();
    const a = await takeAt(ep, 6, 0);
    const { approval_id: idA } = await approveTake(ep, a);
    await studio.associate(sequelize, { episodeId: ep, candidateId: a.candidate.id, scriptRevision: (await stateOf(ep)).revision, beatNumber: 6, lineIndex: 2, userId: USER });
    expect((await approvalRow(idA)).invalidated_reason).toBe('take_reassigned');
    const b = await takeAt(ep, 8, 0);
    const { approval_id: idB } = await approveTake(ep, b);
    const out = await studio.removeCandidate(sequelize, { episodeId: ep, candidateId: b.candidate.id });
    expect(out.approvals_invalidated).toEqual([idB]);
    expect((await rows('SELECT deleted_at FROM voice_source_assets WHERE id = :id', { id: b.source.id }))[0].deleted_at).toBeNull();
  });

  test('routes: approve needs the expected approval; resolve, revoke, playable and history answer', async () => {
    const ep = await makeEpisode();
    const take = await takeAt(ep, 6, 0);
    const prev = process.env.VOICE_STUDIO;
    process.env.VOICE_STUDIO = 'on';
    try {
      const auth = (r) => r.set('Authorization', `Bearer ${adminToken}`);
      const body = { candidate_revision_id: take.revision.id, script_revision: (await stateOf(ep)).revision };
      const missing = await auth(request(app).post(`/api/v1/voice-studio/${ep}/candidates/${take.candidate.id}/approve`)).send(body);
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe('EXPECTED_APPROVAL_REQUIRED');
      const ok = await auth(request(app).post(`/api/v1/voice-studio/${ep}/candidates/${take.candidate.id}/approve`)).send({ ...body, expected_approval_id: null });
      expect(ok.status).toBe(200);
      const id = ok.body.data.approval_id;
      const play = await auth(request(app).get(`/api/v1/voice-studio/${ep}/playable`));
      expect(play.body.data.takes.map((t) => t.approval_id)).toEqual([id]);
      const notMoved = await auth(request(app).post(`/api/v1/voice-studio/${ep}/approvals/${id}/resolve`)).send({ script_revision: body.script_revision, line_index: 0, expected_approval_id: null });
      expect(notMoved.status).toBe(409);
      expect(notMoved.body.code).toBe('NOT_MOVED');
      const userRevoke = await request(app).post(`/api/v1/voice-studio/${ep}/approvals/${id}/revoke`).set('Authorization', `Bearer ${userToken}`);
      expect(userRevoke.status).toBe(403);
      const revoke = await auth(request(app).post(`/api/v1/voice-studio/${ep}/approvals/${id}/revoke`));
      expect(revoke.status).toBe(200);
      const history = await auth(request(app).get(`/api/v1/voice-studio/${ep}/approvals/history`));
      expect(history.body.data).toEqual([expect.objectContaining({ id, revoked_by: USER })]);
    } finally {
      if (prev === undefined) delete process.env.VOICE_STUDIO; else process.env.VOICE_STUDIO = prev;
    }
  });

  // ── B2: the page's one read ──────────────────────────────────────────────────

  test('B2 studio view: lines by beat from the one rule, takes with their audio and binding, approvals, all for one saved script', async () => {
    const ep = await makeEpisode([beat(6, 'Lala: "Hi."', 'Prime: right', '(She waves.)'), beat(15, 'Lala: "Too far."')].join('\n\n'));
    const t = await takeAt(ep, 6, 0);
    await approveTake(ep, t);
    const loose = await studio.createCandidate(sequelize, { episodeId: ep, sourceAssetId: (await studio.createSource(sequelize, { episodeId: ep, kind: 'uploaded', file: audioFile(900), userId: USER })).source.id, userId: USER });
    const v = await studio.studioView(sequelize, { episodeId: ep });
    const state = await stateOf(ep);
    expect(v).toMatchObject({ script_revision: state.revision, script_seq: state.seq, episode: { id: ep } });
    expect(v.beats.map((b) => [b.beat_number, b.usable, b.duplicate])).toEqual([[6, true, false], [15, false, false]]);
    expect(v.beats[0].lines.map((l) => [l.line_index, l.speaker_key, l.spoken, l.prime])).toEqual([[0, 'lala', true, false], [1, 'justawoman', false, true], [2, null, false, false]]);
    expect(v.beats[0].lines[0].context_hash).toMatch(/^[0-9a-f]{64}$/);
    const tied = v.takes.find((x) => x.id === t.candidate.id);
    expect(tied).toMatchObject({ binding: { status: 'bound', line_index: 0 }, revision_id: t.revision.id });
    expect(tied.audio_url).toContain(t.source.s3_key);
    expect(tied).not.toHaveProperty('s3_key');
    expect(v.takes.find((x) => x.id === loose.candidate.id).binding).toBeNull();
    expect(v.summary.approvals.map((a) => a.state)).toEqual(['current']);
  });

  test('B2 studio view after a script edit: a moved line\'s take is bound where the line is now, never at its old place', async () => {
    const ep = await makeEpisode(beat(6, 'Lala: "One."', 'Guest: "Two."'));
    const t = await takeAt(ep, 6, 0);
    await approveTake(ep, t);
    await saveScript(ep, beat(6, 'Guest: "New first."', 'Lala: "One."', 'Guest: "Two."'));
    const v = await studio.studioView(sequelize, { episodeId: ep });
    const tk = v.takes.find((x) => x.id === t.candidate.id);
    expect(tk.binding).toMatchObject({ status: 'moved', line_index: 1, candidates: [1] });
    expect(tk.line_index).toBe(0); // the stored tie is unchanged: nothing is re-tied by reading
    expect(v.summary.approvals[0]).toMatchObject({ state: 'moved', playable: false });
    expect(v.beats[0].lines[0]).toMatchObject({ speaker_key: 'guest', words: 'New first.' });
    // Duplicate beats are shown, never usable.
    await saveScript(ep, [beat(6, 'Lala: "One."'), beat(6, 'Lala: "Again."')].join('\n\n'));
    const dup = await studio.studioView(sequelize, { episodeId: ep });
    expect(dup.beats.map((b) => [b.beat_number, b.duplicate, b.usable])).toEqual([[6, true, false]]);
  });

  test('B2 routes: /status answers only while switched on; /studio says whether this person may edit; a viewer\'s write is refused', async () => {
    const ep = await makeEpisode();
    const prev = process.env.VOICE_STUDIO;
    try {
      delete process.env.VOICE_STUDIO;
      const off = await request(app).get('/api/v1/voice-studio/status').set('Authorization', `Bearer ${adminToken}`);
      expect(off.status).toBe(404);
      expect(off.body.code).toBe('VOICE_STUDIO_OFF');
      expect((await request(app).get(`/api/v1/voice-studio/${ep}/studio`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
      process.env.VOICE_STUDIO = 'on';
      const on = await request(app).get('/api/v1/voice-studio/status').set('Authorization', `Bearer ${userToken}`);
      expect(on.status).toBe(200);
      expect((await request(app).get('/api/v1/voice-studio/status')).status).toBe(401);
      const admin = await request(app).get(`/api/v1/voice-studio/${ep}/studio`).set('Authorization', `Bearer ${adminToken}`);
      expect(admin.status).toBe(200);
      expect(admin.body.data.can_edit).toBe(true);
      const viewer = await request(app).get(`/api/v1/voice-studio/${ep}/studio`).set('Authorization', `Bearer ${userToken}`);
      expect(viewer.body.data.can_edit).toBe(false);
      const refused = await request(app).post(`/api/v1/voice-studio/${ep}/reconfirm`).set('Authorization', `Bearer ${userToken}`).send({ script_revision: admin.body.data.script_revision, items: [] });
      expect(refused.status).toBe(403);
      const missing = await request(app).get(`/api/v1/voice-studio/${uuid()}/studio`).set('Authorization', `Bearer ${adminToken}`);
      expect(missing.status).toBe(404);
    } finally {
      if (prev === undefined) delete process.env.VOICE_STUDIO; else process.env.VOICE_STUDIO = prev;
    }
  });

  test('B2 studio view is read only: reading changes no row, records nothing invalid', async () => {
    const ep = await makeEpisode(beat(6, 'Lala: "One."'));
    const t = await takeAt(ep, 6, 0);
    await approveTake(ep, t);
    await saveScript(ep, beat(6, 'Lala: "Changed."'));
    const before = await rows('SELECT id, invalidated_at, superseded_at FROM line_voice_approvals WHERE episode_id = :ep', { ep });
    const v = await studio.studioView(sequelize, { episodeId: ep });
    expect(v.summary.approvals[0].state).toBe('unbound');
    expect(await rows('SELECT id, invalidated_at, superseded_at FROM line_voice_approvals WHERE episode_id = :ep', { ep })).toEqual(before);
  });

  test('a soft-deleted episode is not found', async () => {
    const ep = await makeEpisode();
    await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :ep', { ep });
    await expectRefusal(summaryOf(ep), 404);
  });
});
