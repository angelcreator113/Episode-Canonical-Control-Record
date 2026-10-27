/**
 * Character voices that learn (Evoni, 2026-10-25), on the test database:
 * the migration (up twice, down twice), the lock that never fails and is a
 * no-op before the migration, approved lines and edits kept on lock, the
 * rewrite signal, learning (grouping, small and major, auto-apply,
 * growth, undo; the AI mocked), the review API, the writers' block, and
 * the book's lines and edits.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } }));
  Anthropic.default = Anthropic;
  return Anthropic;
});

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const cv = require('../../src/services/characterVoice');
const migration = require('../../src/migrations/20261025200000-character-voice-learning');
const { CANONICAL_BEATS } = require('../../src/constants/canonicalBeats');
const { beatHeader } = require('../../src/utils/canonicalScriptBeats');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const TAG = uuid().slice(0, 8);
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const H = (n) => beatHeader(CANONICAL_BEATS[n - 1]);
const until = async (check, ms = 5000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
};

const AI_SCRIPT = [
  H(1), 'Me: Hello my lovely besties and welcome back to the show, I am so happy you are here today.',
  'Lala: Oh my goodness bestie, I have been waiting all day long for this moment, let us get started right now.',
  H(2), 'Me: Let me log in.',
  H(12), 'Marcus Reed: I did not think that you would actually come to the gala tonight.',
  'Lala: Of course I came, I would never miss something like this.',
].join('\n');
const HER_SCRIPT = [
  H(1), 'Me: Hi besties, welcome back.',
  'Lala: "Bestie. Finally. Let\'s go."',
  'Lala: (twirls)',
  H(2), 'Me: Let me log in.',
  H(12), 'Marcus Reed: You came.',
  'Lala: Of course I came, I would never miss something like this.',
  'Guest: Hello!',
].join('\n');

const columns = async (table) => (await q(
  'SELECT column_name FROM information_schema.columns WHERE table_name = :table', { table })).map((r) => r.column_name);

/** The AI's reply to a learning prompt: rules(ids) gets the signal ids the prompt shows. */
const learnReply = (rules) => async ({ messages }) => {
  const prompt = messages[0].content;
  const ids = [...prompt.matchAll(/^#(\d+) /gm)].map((m) => Number(m[1]));
  const body = { signals: ids.map((id) => ({ id, pattern_tag: 'shorter', confidence: 0.9, diff_summary: 'made it shorter' })), rules: rules(ids, prompt) };
  return { content: [{ type: 'text', text: JSON.stringify(body) }] };
};
const defaultAi = async ({ messages }) => {
  const prompt = messages[0].content;
  if (/detect voice patterns/.test(prompt)) {
    return { content: [{ text: JSON.stringify({ diff_summary: 'tighter', pattern_tag: 'tighter_prose', pattern_confidence: 0.4, rule_hypothesis: 'Be tighter.', character_name: null }) }] };
  }
  if (/learning how a character speaks/.test(prompt)) return learnReply(() => [])({ messages });
  return { content: [{ text: '{}' }] };
};

(shouldSkip ? describe.skip : describe)('Character voices that learn', () => {
  const show = uuid();
  const ep = uuid();
  const ep2 = uuid();
  const reg = uuid();
  const marcus = uuid();
  const tester = uuid();
  const MARCUS = `marcus-${TAG}`;
  const KEY = `voice-test-${TAG}`;
  const book = uuid();
  const chapter = uuid();
  const bookLine = uuid();
  const editLine = uuid();
  let token;
  let userToken;
  let start;
  const auth = (r, t = token) => r.set('Authorization', `Bearer ${t}`);
  // With the script revision the page read (A1c R1).
  const lock = async (beats, body = {}) => {
    const revision = (await auth(request(app).get(`/api/v1/episodes/${ep}`))).body.script_revision;
    return auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send({ locked_beats: beats, script_revision: revision, ...body });
  };

  beforeAll(async () => {
    await migration.down(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-admin-voice', email: 'admin@voice.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-user-voice', email: 'user@voice.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    const [[s]] = await run('SELECT COALESCE(MAX(id), 0) AS sig FROM voice_signals');
    const [[r]] = await run('SELECT COALESCE(MAX(id), 0) AS rule FROM voice_rules');
    start = { sig: Number(s.sig), rule: Number(r.rule) };
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Voices ${TAG}`, slug: `voices-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at) VALUES
      (:ep, :show, 'Voices', 5, 'draft', :script, CAST('[]' AS jsonb), NOW(), NOW()),
      (:ep2, :show, 'Voices two', 7, 'draft', '', CAST('[]' AS jsonb), NOW(), NOW())`, { ep, ep2, show, script: AI_SCRIPT });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())`, { reg, t: `Voices ${TAG}`, show });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, voice_signature, created_at, updated_at) VALUES
      (:marcus, :reg, :mk, 'Marcus Reed', CAST(:vs AS jsonb), NOW(), NOW()),
      (:tester, :reg, :tk, 'Voice Tester', CAST('{}' AS jsonb), NOW(), NOW())`,
    { marcus, tester, reg, mk: MARCUS, tk: KEY, vs: JSON.stringify({ speech_pattern: 'clipped, dry', vocabulary_tone: '', catchphrases: ['you came'] }) });
    // The script before Generate: the first version kept after it is what the AI wrote.
    await run(`INSERT INTO episode_script_versions (episode_id, script_content, source, created_at, updated_at)
      VALUES (:ep, 'the script before Generate', 'generate', NOW() - interval '10 minutes', NOW() - interval '10 minutes')`, { ep });
    await run(`INSERT INTO storyteller_books (id, show_id, title, status, created_at, updated_at) VALUES (:book, :show, :t, 'draft', NOW(), NOW())`, { book, show, t: `Before Lala ${TAG}` })
      .catch(() => run(`INSERT INTO storyteller_books (id, show_id, status, created_at, updated_at) VALUES (:book, :show, 'draft', NOW(), NOW())`, { book, show }));
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, title, chapter_type, created_at, updated_at) VALUES (:chapter, :book, 1, 'One', 'cutscene', NOW(), NOW())`, { chapter, book });
    await run(`INSERT INTO storyteller_lines (id, chapter_id, text, status, sort_order, created_at, updated_at) VALUES
      (:bookLine, :chapter, 'The kitchen light was still on when I came home.', 'pending', 1, NOW(), NOW()),
      (:editLine, :chapter, 'I felt very very sad and also tired that night.', 'pending', 2, NOW(), NOW())`, { bookLine, editLine, chapter });
  });
  beforeEach(() => {
    cv._reset();
    mockCreate.mockReset();
    mockCreate.mockImplementation(defaultAi);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => { await cv.settled(); jest.restoreAllMocks(); });
  afterAll(async () => {
    await cv.settled();
    if (await cv.schemaReady(models)) {
      await run('DELETE FROM character_voice_lines WHERE episode_id IN (:eps) OR book_id = :book OR character_key IN (:keys)', { eps: [ep, ep2], book, keys: [MARCUS, KEY] });
    }
    await run('DELETE FROM voice_signals WHERE id > :id', { id: start.sig });
    await run('DELETE FROM voice_rules WHERE id > :id', { id: start.rule });
    await run('DELETE FROM storyteller_lines WHERE chapter_id = :chapter', { chapter });
    await run('DELETE FROM storyteller_chapters WHERE id = :chapter', { chapter });
    await run('DELETE FROM storyteller_books WHERE id = :book', { book });
    await run('DELETE FROM episode_script_versions WHERE episode_id IN (:eps)', { eps: [ep, ep2] });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', { reg });
    await run('DELETE FROM character_registries WHERE id = :reg', { reg });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  describe('before the migration', () => {
    test('a lock saves and the capture is a logged no-op', async () => {
      const res = await lock([2]);
      expect(res.status).toBe(200);
      expect(res.body.data.script_locked_beats).toEqual([2]);
      await cv.settled();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('lock capture skipped'));
      const back = await lock([]);
      expect(back.status).toBe(200);
    });

    test('the writes and the voice page answer 409; the drift check reads empty', async () => {
      const sig = await auth(request(app).post('/api/v1/voice/signals')).send({ episodeId: ep, beatNumber: 1, speaker: 'Lala', original: 'a b c', edited: 'a' });
      expect(sig.status).toBe(409);
      expect(sig.body.code).toBe('VOICE_SCHEMA_MISSING');
      expect((await auth(request(app).get('/api/v1/voice/characters/lala'))).status).toBe(409);
      expect((await auth(request(app).post('/api/v1/voice/rules/1/approve'))).status).toBe(409);
      expect((await auth(request(app).post('/api/v1/voice/learn/lala'))).status).toBe(409);
      const rules = await auth(request(app).get(`/api/v1/voice/episode/${ep}/rules`));
      expect(rules.status).toBe(200);
      expect(rules.body).toMatchObject({ rules: [], schema_pending: true });
      expect(await cv.voicePromptBlock(models, { characterKeys: [MARCUS], context: 'cutscene', showId: show })).toContain('Speech pattern: clipped, dry');
    });
  });

  describe('the migration', () => {
    test('runs up twice and down twice, then up', async () => {
      const qi = sequelize.getQueryInterface();
      await migration.up(qi, Sequelize);
      await migration.up(qi, Sequelize);
      expect(await columns('voice_rules')).toEqual(expect.arrayContaining(['character_key', 'context', 'episode_id', 'beat_number', 'source', 'size', 'auto_applied', 'from_episode_number', 'check_json', 'supersedes_rule_id']));
      expect(await columns('voice_signals')).toEqual(expect.arrayContaining(['character_key', 'context', 'episode_id', 'beat_number', 'source']));
      expect(await columns('character_voice_lines')).toEqual(expect.arrayContaining(['id', 'character_key', 'show_id', 'episode_id', 'beat_number', 'book_id', 'chapter_id', 'context', 'text', 'text_hash', 'source', 'deleted_at']));
      await migration.down(qi, Sequelize);
      await migration.down(qi, Sequelize);
      expect(await columns('character_voice_lines')).toEqual([]);
      expect(await columns('voice_rules')).not.toContain('check_json');
      await migration.up(qi, Sequelize);
      expect(await cv.schemaReady(models)).toBe(true);
    });
  });

  describe('on lock', () => {
    test("approved lines and what she changed are kept, each with the beat's context", async () => {
      const res = await lock([1, 12], { script_content: HER_SCRIPT });
      expect(res.status).toBe(200);
      await cv.settled();
      const lines = await q('SELECT character_key, context, beat_number, text, source FROM character_voice_lines WHERE episode_id = :ep ORDER BY beat_number, character_key, text', { ep });
      expect(lines).toEqual([
        { character_key: 'justawoman', context: 'gameplay', beat_number: 1, text: 'Hi besties, welcome back.', source: 'edited' },
        { character_key: 'lala', context: 'gameplay', beat_number: 1, text: "Bestie. Finally. Let's go.", source: 'edited' },
        { character_key: 'lala', context: 'cutscene', beat_number: 12, text: 'Of course I came, I would never miss something like this.', source: 'approved' },
        { character_key: MARCUS, context: 'cutscene', beat_number: 12, text: 'You came.', source: 'edited' },
      ]);
      const signals = await q(`SELECT character_key, context, beat_number, original_text, edited_text, source, status FROM voice_signals
        WHERE episode_id = :ep ORDER BY beat_number, character_key`, { ep });
      expect(signals).toEqual([
        { character_key: 'justawoman', context: 'gameplay', beat_number: 1, original_text: 'Hello my lovely besties and welcome back to the show, I am so happy you are here today.', edited_text: 'Hi besties, welcome back.', source: 'episode_edit', status: 'raw' },
        { character_key: 'lala', context: 'gameplay', beat_number: 1, original_text: 'Oh my goodness bestie, I have been waiting all day long for this moment, let us get started right now.', edited_text: "Bestie. Finally. Let's go.", source: 'episode_edit', status: 'raw' },
        { character_key: MARCUS, context: 'cutscene', beat_number: 12, original_text: 'I did not think that you would actually come to the gala tonight.', edited_text: 'You came.', source: 'episode_edit', status: 'raw' },
      ]);
      // One signal each: under three, nobody learns yet.
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('locking the same beats again keeps nothing twice', async () => {
      expect((await lock([])).status).toBe(200);
      expect((await lock([1, 12])).status).toBe(200);
      await cv.settled();
      const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM character_voice_lines WHERE episode_id = :ep', { ep });
      const [{ s }] = await q('SELECT COUNT(*)::int AS s FROM voice_signals WHERE episode_id = :ep', { ep });
      expect([n, s]).toEqual([4, 3]);
    });

    test('a capture that throws never fails the lock', async () => {
      expect((await lock([])).status).toBe(200);
      jest.spyOn(cv, 'background').mockImplementation(() => { throw new Error('boom'); });
      expect((await lock([1])).status).toBe(200);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('voice capture could not start'), 'boom');
      cv.background.mockRestore();
      jest.spyOn(cv, 'captureOnLock').mockRejectedValue(new Error('kaboom'));
      const res = await lock([1, 12]);
      expect(res.status).toBe(200);
      expect(res.body.data.script_locked_beats).toEqual([1, 12]);
      await cv.settled();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('lock capture failed'), 'kaboom');
    });
  });

  describe('POST /voice/signals', () => {
    const body = (n) => ({ episodeId: ep, beatNumber: 3, speaker: 'Lala', original: `Hello everyone, it is so wonderful to see all of you here ${n}.`, edited: `Hi. ${n}` });

    test('a rewrite she accepted is a signal; the third for a character starts learning', async () => {
      const a = await auth(request(app).post('/api/v1/voice/signals'), userToken).send({ ...body(1), direction: 'Punchier' });
      expect(a.status).toBe(201);
      expect(a.body.signal).toMatchObject({ character_key: 'lala', context: 'gameplay', beat_number: 3, source: 'episode_rewrite' });
      const [row] = await q('SELECT diff_summary, status FROM voice_signals WHERE id = :id', { id: a.body.signal.id });
      expect(row).toEqual({ diff_summary: 'Rewrite direction: Punchier', status: 'raw' });
      // The same again is kept once.
      expect((await auth(request(app).post('/api/v1/voice/signals')).send({ ...body(1), direction: 'Punchier' })).body).toMatchObject({ skipped: true, reason: 'already recorded' });
      expect((await auth(request(app).post('/api/v1/voice/signals')).send({ ...body(2), edited: body(2).original })).body).toEqual({ skipped: true, reason: 'no change' });
      expect((await auth(request(app).post('/api/v1/voice/signals')).send({ ...body(2), speaker: 'Stranger' })).body).toEqual({ skipped: true, reason: 'unknown speaker' });
      await cv.settled();
      expect(mockCreate).not.toHaveBeenCalled();
      // Lala's beat-1 edit from the lock, and this: two. A third starts learning.
      expect((await auth(request(app).post('/api/v1/voice/signals')).send(body(3))).status).toBe(201);
      await cv.settled();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
      const left = await q("SELECT status FROM voice_signals WHERE character_key = 'lala' AND id > :id", { id: start.sig });
      expect(left.every((s) => s.status === 'analyzed')).toBe(true);
    });
  });

  describe('learning', () => {
    const add = async (n, { context = 'gameplay', episodeId = ep, prefix = 'line' } = {}) => {
      const ids = [];
      for (let i = 0; i < n; i += 1) {
        const [[r]] = await run(`INSERT INTO voice_signals (original_text, edited_text, character_key, context, episode_id, beat_number, source, status, created_at, updated_at)
          VALUES (:o, :e, :k, :c, :ep, 3, 'episode_edit', 'raw', NOW(), NOW()) RETURNING id`,
        { o: `A long ${prefix} that goes on and on, number ${i}, with more words.`, e: `Short ${prefix} ${i}.`, k: KEY, c: context, ep: episodeId });
        ids.push(r.id);
      }
      return ids;
    };
    const rule = async (id) => (await q('SELECT * FROM voice_rules WHERE id = :id', { id }))[0];
    let small;
    let major;

    test('three alike make a SMALL rule that applies by itself; two are not enough', async () => {
      const ids = await add(3);
      const two = await add(2, { prefix: 'other' });
      mockCreate.mockImplementation(learnReply(() => [
        { rule_text: 'At most two sentences.', rule_type: 'line_length', context: 'gameplay', signal_ids: ids, check: { type: 'max_sentences', n: 2 } },
        { rule_text: 'Never says "honestly".', rule_type: 'banned_word', context: 'gameplay', signal_ids: two, check: { type: 'banned_word', word: 'honestly' } },
      ]));
      const res = await auth(request(app).post(`/api/v1/voice/learn/${KEY}`)).send({});
      expect(res.status).toBe(200);
      expect(res.body.rules).toHaveLength(1);
      small = res.body.rules[0].id;
      expect(await rule(small)).toMatchObject({
        character_key: KEY, rule_type: 'line_length', context: 'gameplay', status: 'active', size: 'small', auto_applied: true,
        confirmed_by_author: false, from_episode_number: 5, check_json: { type: 'max_sentences', n: 2 }, signal_count: 3, supersedes_rule_id: null,
      });
      const sigs = await q('SELECT id, status, proposed_rule_id, pattern_tag FROM voice_signals WHERE id IN (:ids) ORDER BY id', { ids: [...ids, ...two] });
      expect(sigs.slice(0, 3).every((s) => s.status === 'promoted' && s.proposed_rule_id === small)).toBe(true);
      expect(sigs.slice(3).every((s) => s.status === 'analyzed' && s.proposed_rule_id === null && s.pattern_tag === 'shorter')).toBe(true);
      // The two analysed ones are read again with the next new signals.
      expect(mockCreate.mock.calls[0][0].messages[0].content).toContain(`#${two[0]} [gameplay]`);
    });

    test('one strong, explicit banned word is enough', async () => {
      const [one] = await add(1, { prefix: 'banned' });
      mockCreate.mockImplementation(learnReply(() => [
        { rule_text: 'Never says "literally".', rule_type: 'banned_word', context: 'all', signal_ids: [one], strong: true, check: { type: 'banned_word', word: 'literally' } },
      ]));
      const out = await cv.learnVoice(models, { characterKey: KEY });
      expect(out.rules).toHaveLength(1);
      expect(await rule(out.rules[0].id)).toMatchObject({ status: 'active', size: 'small', context: 'all', check_json: { type: 'banned_word', word: 'literally' } });
    });

    test('a MAJOR rule waits for her Approve', async () => {
      const ids = await add(3, { prefix: 'warm' });
      mockCreate.mockImplementation(learnReply((all) => [
        { rule_text: 'Softer with Lala than with anyone.', rule_type: 'relationship', context: 'gameplay', signal_ids: all.filter((id) => ids.includes(id)) },
      ]));
      const out = await cv.learnVoice(models, { characterKey: KEY });
      major = out.rules[0].id;
      expect(await rule(major)).toMatchObject({ status: 'proposed', size: 'major', auto_applied: false });
      const ok = await auth(request(app).post(`/api/v1/voice/rules/${major}/approve`));
      expect(ok.status).toBe(200);
      expect(ok.body.rule).toMatchObject({ id: major, status: 'active', confirmed_by_author: true });
    });

    test('a newer rule supersedes the older one (growth); Undo puts the older back', async () => {
      const ids = await add(3, { prefix: 'shorter', episodeId: ep2 });
      mockCreate.mockImplementation(learnReply((all, prompt) => {
        expect(prompt).toContain(`R${small} [gameplay] line_length: At most two sentences.`);
        return [{ rule_text: 'One sentence, always.', rule_type: 'line_length', context: 'gameplay', signal_ids: ids, supersedes: small, check: { type: 'max_sentences', n: 1 } }];
      }));
      const out = await cv.learnVoice(models, { characterKey: KEY });
      const grown = out.rules[0].id;
      expect(await rule(grown)).toMatchObject({ status: 'active', auto_applied: true, supersedes_rule_id: small, from_episode_number: 7 });
      expect((await rule(small)).status).toBe('superseded');

      // The drift check reads the live one only.
      const view = await auth(request(app).get(`/api/v1/voice/characters/${KEY}`));
      expect(view.status).toBe(200);
      expect(view.body.rules.map((r) => [r.id, r.status])).toEqual(expect.arrayContaining([[grown, 'active'], [small, 'superseded'], [major, 'active']]));

      const undo = await auth(request(app).post(`/api/v1/voice/rules/${grown}/undo`));
      expect(undo.status).toBe(200);
      expect(undo.body.rule).toMatchObject({ id: grown, status: 'dismissed' });
      expect(undo.body.restored).toMatchObject({ id: small, status: 'active' });
      // Undo is for a rule that applied by itself.
      expect((await auth(request(app).post(`/api/v1/voice/rules/${major}/undo`))).status).toBe(409);
      expect((await auth(request(app).post('/api/v1/voice/rules/999999999/approve'))).status).toBe(404);
    });

    test('Dismiss stops a rule; a refused budget changes nothing', async () => {
      const ids = await add(3, { prefix: 'cold' });
      mockCreate.mockImplementation(learnReply(() => [{ rule_text: 'Distrusts every brand.', rule_type: 'values', signal_ids: ids }]));
      const out = await cv.learnVoice(models, { characterKey: KEY });
      const d = await auth(request(app).post(`/api/v1/voice/rules/${out.rules[0].id}/dismiss`));
      expect(d.body.rule.status).toBe('dismissed');

      const raw = await add(3, { prefix: 'budget' });
      mockCreate.mockReset();
      mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
      expect(await cv.learnVoice(models, { characterKey: KEY })).toMatchObject({ skipped: 'budget', rules: [] });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const still = await q('SELECT status FROM voice_signals WHERE id IN (:raw)', { raw });
      expect(still.every((s) => s.status === 'raw')).toBe(true);
    });

    test('the voice page: profile, rules, lines, counts', async () => {
      const res = await auth(request(app).get(`/api/v1/voice/characters/${MARCUS}?showId=${show}`));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ characterKey: MARCUS, name: 'Marcus Reed', profile_voice: { speech_pattern: 'clipped, dry' } });
      expect(res.body.lines).toEqual([expect.objectContaining({ text: 'You came.', context: 'cutscene', episode_id: ep, episode_number: 5, beat_number: 12, source: 'edited' })]);
      expect(res.body.counts).toMatchObject({ lines: 1, signals: 1, signals_waiting: 1, rules_active: 0 });
      const mine = await auth(request(app).get(`/api/v1/voice/characters/${KEY}`));
      expect(mine.body.rules[0]).toEqual(expect.objectContaining({
        id: expect.any(Number), rule_text: expect.any(String), rule_type: expect.any(String), context: expect.any(String), status: expect.any(String),
        size: expect.any(String), auto_applied: expect.any(Boolean), signal_count: expect.any(Number), created_at: expect.any(String),
      }));
      expect(mine.body.counts).toMatchObject({ rules_active: 3, rules_dismissed: 2, rules_superseded: 0 });
      expect((await auth(request(app).get('/api/v1/voice/characters/Not A Key'))).status).toBe(400);
    });
  });

  describe("the Script tab's reads", () => {
    test("GET /voice/speakers: each script speaker's character", async () => {
      const res = await auth(request(app).get(`/api/v1/voice/speakers?episodeId=${ep}`));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { speaker: 'Prime', labels: ['Me'], characterKey: 'justawoman', name: 'JustAWoman' },
        { speaker: 'Lala', labels: ['Lala'], characterKey: 'lala', name: 'Lala' },
        { speaker: 'Marcus Reed', labels: ['Marcus Reed'], characterKey: MARCUS, name: 'Marcus Reed' },
        { speaker: 'Guest', labels: ['Guest'], characterKey: null, name: null },
      ]);
    });

    test("GET /voice/episode/:id/rules: everyone's live rules with their checks", async () => {
      await run(`INSERT INTO voice_rules (character_key, rule_text, rule_type, context, status, size, auto_applied, check_json, created_at, updated_at) VALUES
        (:k, 'Marcus never says more than five words.', 'line_length', 'cutscene', 'active', 'small', true, CAST('{"type":"max_words","n":5}' AS jsonb), NOW(), NOW()),
        (:k, 'Marcus is proposed.', 'attitude', 'all', 'proposed', 'major', false, NULL, NOW(), NOW())`, { k: MARCUS });
      const res = await auth(request(app).get(`/api/v1/voice/episode/${ep}/rules`));
      expect(res.status).toBe(200);
      expect(res.body.rules.filter((r) => r.character_key === MARCUS)).toEqual([expect.objectContaining({
        character_key: MARCUS, name: 'Marcus Reed', rule_text: 'Marcus never says more than five words.', context: 'cutscene', check_json: { type: 'max_words', n: 5 }, auto_applied: true,
      })]);
    });

    test("the writers' block: Marcus's cutscene voice, the profile, his rule and his line", async () => {
      const block = await cv.voicePromptBlock(models, { characterKeys: ['lala', MARCUS], context: 'cutscene', showId: show });
      expect(block).toContain('HOW MARCUS REED REALLY SOUNDS');
      expect(block).toContain('Speech pattern: clipped, dry');
      expect(block).toContain('- Marcus never says more than five words.');
      expect(block).not.toContain('Marcus is proposed.');
      expect(block).toContain('- "You came."');
      expect(block).toContain('HOW LALA REALLY SOUNDS');
      expect(block).toContain('- "Of course I came, I would never miss something like this."');
      expect(block).toContain('the learned voice wins');
    });
  });

  describe('the book', () => {
    test('an approved line is the narrator\'s, with the scene\'s context', async () => {
      const res = await auth(request(app).put(`/api/v1/storyteller/lines/${bookLine}`)).send({ status: 'approved' });
      expect(res.status).toBe(200);
      await cv.settled();
      const rows = await q('SELECT character_key, context, source, book_id, chapter_id, text FROM character_voice_lines WHERE book_id = :book', { book });
      expect(rows).toEqual([{ character_key: 'justawoman', context: 'cutscene', source: 'book', book_id: book, chapter_id: chapter, text: 'The kitchen light was still on when I came home.' }]);
    });

    test('a narration line by default, and an edit is a signal with its character and context', async () => {
      await run("UPDATE storyteller_chapters SET chapter_type = 'chapter' WHERE id = :chapter", { chapter });
      expect(await cv.captureBookLine(models, { book: { id: book, show_id: show }, chapter: { id: chapter, chapter_type: 'chapter' }, line: { text: 'Prose, plain.', chapter_id: chapter } })).toBeTruthy();
      const [row] = await q("SELECT context FROM character_voice_lines WHERE book_id = :book AND text = 'Prose, plain.'", { book });
      expect(row.context).toBe('narration');

      const res = await auth(request(app).put(`/api/v1/storyteller/lines/${editLine}`)).send({ text: 'I was tired.' });
      expect(res.status).toBe(200);
      const sig = await until(async () => (await q(`SELECT character_key, context, source, status, scene_context, book_id FROM voice_signals
        WHERE edited_text = 'I was tired.' AND id > :id`, { id: start.sig }))[0]);
      expect(sig).toMatchObject({ character_key: 'justawoman', context: 'narration', source: 'book_edit', status: 'raw', book_id: null });
      expect(sig.scene_context.length).toBeLessThanOrEqual(100);
    });

    test("the novel writer reads the narrator's learned rules, labelled by context", async () => {
      await run(`INSERT INTO voice_rules (character_key, rule_text, rule_type, context, status, size, auto_applied, created_at, updated_at) VALUES
        ('justawoman', 'Short declaratives when she is tired.', 'line_length', 'narration', 'active', 'small', true, NOW(), NOW())`);
      const { loadVoiceRules } = require('../../src/routes/storyEvaluationRoutes');
      expect(await loadVoiceRules(['justawoman'])).toContain('[justawoman · narration (prose)] line_length: Short declaratives when she is tired.');
      const block = await cv.voicePromptBlock(models, { characterKeys: ['justawoman'], context: 'narration' });
      expect(block).toContain('- Short declaratives when she is tired.');
    });
  });
});
