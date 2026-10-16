/**
 * Locked script beats (Evoni, 2026-10-08: "yes start with lock then drag
 * and drop"). Approving a beat locks it on the episode; Save can't change
 * it, and Regenerate rewrites only the unlocked beats.
 */
jest.unmock('uuid');
jest.mock('../../src/services/groundedScriptGeneratorService', () => ({
  generateGroundedScript: jest.fn(),
}));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateGroundedScript } = require('../../src/services/groundedScriptGeneratorService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;
const script = (...beats) => beats.join('\n\n');
const ORIGINAL = script(beat(1, 'Opening Ritual', 'Prime: "Hey besties"'), beat(2, 'Login Sequence', 'Lala: "Logging in"'), beat(3, 'Welcome', 'Lala: "Welcome back"'));

(shouldSkip ? describe.skip : describe)('Script beat locks', () => {
  const show = uuid();
  const ep = uuid();
  let token;
  const keyBefore = process.env.ANTHROPIC_API_KEY;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: `test-locks-${show.slice(0, 8)}`, email: 'l@locks.dev', name: 'Locks', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id: show, n: `locks-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', :script, NOW(), NOW())`, { ep, show, script: ORIGINAL });
    await run(`INSERT INTO episode_briefs (id, episode_id, status, created_at, updated_at) VALUES (:id, :ep, 'draft', NOW(), NOW())`, { id: uuid(), ep });
    process.env.ANTHROPIC_API_KEY = 'test-key-not-called';
  });

  afterAll(async () => {
    if (keyBefore === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = keyBefore;
    await run(`DELETE FROM episode_briefs WHERE episode_id = :ep`, { ep });
    await run(`DELETE FROM episodes WHERE id = :ep`, { ep });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const locks = (body) => auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send(body);
  const stored = async () => (await run(`SELECT script_content, script_locked_beats FROM episodes WHERE id = :ep`, { ep }))[0][0];

  test('approving a beat keeps the lock on the episode, and the episode returns it', async () => {
    const res = await locks({ locked_beats: [2] });
    expect(res.status).toBe(200);
    expect(res.body.data.script_locked_beats).toEqual([2]);
    const got = await auth(request(app).get(`/api/v1/episodes/${ep}`));
    expect(got.body.data.script_locked_beats).toEqual([2]);
  });

  test('a lock that is not a list of beat numbers is refused', async () => {
    expect((await locks({ locked_beats: 2 })).status).toBe(400);
    expect((await locks({ locked_beats: [2, 99] })).status).toBe(400);
    expect((await stored()).script_locked_beats).toEqual([2]);
  });

  test("Save can't change a locked beat: it is put back and named", async () => {
    const edited = ORIGINAL.replace('Logging in', 'Changed while locked').replace('Welcome back', 'Welcome, besties');
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: edited });
    expect(res.status).toBe(200);
    expect(res.body.locked_beats_kept).toEqual([2]);
    const row = await stored();
    expect(row.script_content).toContain('Lala: "Logging in"');
    expect(row.script_content).toContain('Welcome, besties');
  });

  test('locking with unsaved edits saves them, and the new beat locks as shown', async () => {
    const { script_content: current } = await stored();
    const res = await locks({ locked_beats: [2, 3], script_content: current.replace('Welcome, besties', 'Welcome to the gala') });
    expect(res.status).toBe(200);
    expect(res.body.data.script_locked_beats).toEqual([2, 3]);
    expect((await stored()).script_content).toContain('Welcome to the gala');
  });

  test('Regenerate rewrites only the unlocked beats', async () => {
    generateGroundedScript.mockResolvedValueOnce(script(
      beat(1, 'Opening Ritual', 'Prime: "Brand new opening"'),
      beat(2, 'Login Sequence', 'Lala: "Brand new login"'),
      beat(3, 'Welcome', 'Lala: "Brand new welcome"'),
    ));
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(res.status).toBe(200);
    expect(res.body.locked_kept).toEqual([2, 3]);
    const row = await stored();
    expect(row.script_content).toBe(script(
      beat(1, 'Opening Ritual', 'Prime: "Brand new opening"'),
      beat(2, 'Login Sequence', 'Lala: "Logging in"'),
      beat(3, 'Welcome', 'Lala: "Welcome to the gala"'),
    ));
    expect(res.body.script).toBe(row.script_content);
  });

  test('a beat approved while Regenerate is writing keeps its approved words', async () => {
    // Script tab audit (2026-10-15): the writing takes minutes, and the page
    // can approve a beat (with its unsaved edit) before it comes back.
    generateGroundedScript.mockImplementationOnce(async () => {
      const { script_content: now } = await stored();
      const approved = await locks({ locked_beats: [1, 2, 3], script_content: now.replace('Brand new opening', 'Approved while writing') });
      expect(approved.status).toBe(200);
      return script(
        beat(1, 'Opening Ritual', 'Prime: "Newer opening"'),
        beat(2, 'Login Sequence', 'Lala: "Newer login"'),
        beat(3, 'Welcome', 'Lala: "Newer welcome"'),
      );
    });
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(res.status).toBe(200);
    expect(res.body.locked_kept).toEqual([1, 2, 3]);
    const row = await stored();
    expect(row.script_content).toContain('Prime: "Approved while writing"');
    expect(row.script_content).not.toContain('Newer opening');
    expect(row.script_locked_beats).toEqual([1, 2, 3]);
  });

  test('the response says what the saved script still does not cover', async () => {
    // Evoni, 2026-10-15: "is it making sure everything is being done within the script?"
    generateGroundedScript.mockResolvedValueOnce({
      script: script(beat(1, 'Opening Ritual', 'Prime: "Hi"'), beat(2, 'Login Sequence', 'Lala: "x"'), beat(3, 'Welcome', 'Lala: "y"')),
      coverage: { missing: [], fixed_beats: [1] },
      facts: { deliverables: [{ description: 'TikTok outfit reveal' }], goals: [], forwardHook: '', lockedPieces: [] },
    });
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(res.status).toBe(200);
    expect(res.body.coverage.fixed_beats).toEqual([1]);
    expect(res.body.coverage.missing).toEqual(expect.arrayContaining([{ kind: 'deliverable', label: 'TikTok outfit reveal', target: 12 }]));
    expect(res.body.script).toContain('## BEAT: 1');
  });

  // Script tab re-audit (2026-10-15).
  test('a first draft too short to be a script is not saved over the script', async () => {
    const before = (await stored()).script_content;
    generateGroundedScript.mockRejectedValueOnce(Object.assign(new Error('The writer sent back 0 of the 14 beats, too few to finish; nothing was saved. Try again.'), { code: 'DRAFT_INCOMPLETE' }));
    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ saved: false, code: 'SCRIPT_DRAFT_INCOMPLETE' });
    expect((await stored()).script_content).toBe(before);
  });

  test('nothing is written for a brief whose episode is gone', async () => {
    const gone = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at, deleted_at)
               VALUES (:gone, :show, 'Gone', 2, 'draft', NOW(), NOW(), NOW())`, { gone, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, status, created_at, updated_at) VALUES (:id, :gone, 'draft', NOW(), NOW())`, { id: uuid(), gone });
    try {
      generateGroundedScript.mockClear();
      const res = await auth(request(app).post(`/api/v1/episode-brief/${gone}/generate-script`)).send({ showId: show });
      expect(res.status).toBe(404);
      expect(generateGroundedScript).not.toHaveBeenCalled();
      const one = await auth(request(app).post(`/api/v1/episode-brief/${gone}/regenerate-beat`)).send({ showId: show, beatNumber: 3, script: '' });
      expect(one.status).toBe(404);
    } finally {
      await run(`DELETE FROM episode_briefs WHERE episode_id = :gone`, { gone });
      await run(`DELETE FROM episodes WHERE id = :gone`, { gone });
    }
  });

  test('clearing the script keeps the locked beats', async () => {
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: null });
    expect(res.status).toBe(200);
    expect(res.body.locked_beats_kept).toEqual([1, 2, 3]);
    expect((await stored()).script_content).toContain('Lala: "Logging in"');
    expect((await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 42 })).status).toBe(400);
  });

  test('an approved beat whose header names no beat reaches the writer with its number', async () => {
    // Re-audit 2 (2026-10-15): read by its place, it was saved twice.
    const other = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
               VALUES (:other, :show, 'Bonus', 3, 'draft', :script, '[2]'::jsonb, NOW(), NOW())`, { other, show, script: script(beat(1, 'Opening Ritual', 'Me: hi'), '## BEAT: Bonus scene\nLala: "approved bonus"') });
    await run(`INSERT INTO episode_briefs (id, episode_id, status, created_at, updated_at) VALUES (:id, :other, 'draft', NOW(), NOW())`, { id: uuid(), other });
    try {
      generateGroundedScript.mockClear();
      generateGroundedScript.mockResolvedValueOnce(script(beat(2, 'Login Sequence', 'Lala: "new"')));
      const res = await auth(request(app).post(`/api/v1/episode-brief/${other}/generate-script`)).send({ showId: show, confirmOverwrite: true });
      expect(res.status).toBe(200);
      expect(generateGroundedScript.mock.calls[0][3].lockedBeats).toEqual([{ number: 2, text: '## BEAT: 2 · Bonus scene\nLala: "approved bonus"' }]);
      expect(res.body.script.match(/approved bonus/g)).toHaveLength(1);
    } finally {
      await run(`DELETE FROM episode_briefs WHERE episode_id = :other`, { other });
      await run(`DELETE FROM episodes WHERE id = :other`, { other });
    }
  });

  test('unlocking lets Save change the beat again', async () => {
    expect((await locks({ locked_beats: [] })).body.data.script_locked_beats).toEqual([]);
    const { script_content: current } = await stored();
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: current.replace('Logging in', 'Logged in') });
    expect(res.body.locked_beats_kept).toBeUndefined();
    expect((await stored()).script_content).toContain('Logged in');
  });
});
