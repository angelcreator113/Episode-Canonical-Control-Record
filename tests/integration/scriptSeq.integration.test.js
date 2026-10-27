/**
 * The script save number on Postgres (A1c correction, Evoni, 2026-10-27,
 * decisions 1 and 2): episodes.script_seq goes up by one on every save that
 * changes the text, whatever the clock, the version rows or how many saves
 * arrive at once, and on nothing else.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { saveEpisodeScript } = require('../../src/services/scriptSave');
const { scriptRevision } = require('../../src/utils/scriptRevision');
const migration = require('../../src/migrations/20261027190000-add-episode-script-seq');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const A = '## BEAT: 1 · Opening Ritual\nLala: "Bestie, come style me."\n\n## BEAT: 2 · Arrival\nLala: "Hi!"';

(shouldSkip ? describe.skip : describe)('Script save number (episodes.script_seq)', () => {
  const show = uuid();
  const eps = [];
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: `test-seq-${show.slice(0, 8)}`, email: 's@seq.dev', name: 'Seq', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `seq-${show.slice(0, 8)}` });
  });

  afterAll(async () => {
    if (eps.length) {
      await run('DELETE FROM episode_script_versions WHERE episode_id IN (:eps)', { eps });
      await run('DELETE FROM episodes WHERE id IN (:eps)', { eps });
    }
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  const makeEpisode = async (script = A) => {
    const ep = uuid();
    eps.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'Seq', :n, 'draft', :script, '[]'::jsonb, NOW(), NOW())`, { ep, show, n: 9000 + eps.length, script });
    return ep;
  };
  const seqOf = async (ep) => Number((await rows('SELECT script_seq FROM episodes WHERE id = :ep', { ep }))[0].script_seq);
  const save = (ep, text, opts = {}) => saveEpisodeScript(models, ep, { writer: 'test', compose: async () => ({ script: text }), ...opts });

  test('the migration is idempotent: run again, the column is as it was', async () => {
    await migration.up(sequelize.getQueryInterface());
    const [col] = await rows(`SELECT data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'episodes' AND column_name = 'script_seq'`);
    expect(col).toEqual({ data_type: 'bigint', is_nullable: 'NO', column_default: '0' });
    const ep = await makeEpisode();
    expect(await seqOf(ep)).toBe(0);
  });

  test('A -> empty -> A, again and again: every save moves it on, though the revision comes back', async () => {
    const ep = await makeEpisode();
    const seen = [];
    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (const text of ['', A]) {
        const out = await save(ep, text);
        expect(out.script_revision).toBe(scriptRevision(text));
        seen.push(out.script_seq);
      }
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await seqOf(ep)).toBe(6);
    // The same text again changes nothing, and takes no number.
    expect((await save(ep, A)).script_seq).toBeNull();
    expect(await seqOf(ep)).toBe(6);
  });

  test('a restore from History moves it on; a lock alone and edits that are not the script do not', async () => {
    const ep = await makeEpisode();
    await save(ep, `${A}\nLala: "two"`);
    await save(ep, `${A}\nLala: "three"`);
    const [v] = await rows("SELECT id, script_content FROM episode_script_versions WHERE episode_id = :ep AND script_content = :t", { ep, t: `${A}\nLala: "two"` });
    const restored = await saveEpisodeScript(models, ep, { writer: 'W1', restoredFrom: v.id, compose: async () => ({ script: v.script_content }) });
    expect(restored).toMatchObject({ version_source: 'restore', script_seq: 3 });
    const lock = await saveEpisodeScript(models, ep, { writer: 'W2', source: 'lock', compose: async (row) => ({ script: row.script_content, lockedBeats: [1] }) });
    expect(lock.script_seq).toBeNull();
    // The episode's other fields, through the API (title, air date) and directly (coins, plans, metadata).
    const put = await request(app).put(`/api/v1/episodes/${ep}`).set('Authorization', `Bearer ${token}`).send({ title: 'Renamed', air_date: '2026-11-01T00:00:00.000Z' });
    expect(put.status).toBe(200);
    await run(`UPDATE episodes SET total_income = 900, total_expenses = 100, money_plan = '{"coins": 5}'::jsonb,
      distribution_metadata = '{"x": 1}'::jsonb, description = 'd', updated_at = NOW() WHERE id = :ep`, { ep });
    expect(await seqOf(ep)).toBe(3);
  });

  test('saves at once: the row lock serialises them, each gets its own number, none is lost', async () => {
    const ep = await makeEpisode();
    const texts = Array.from({ length: 6 }, (_, i) => `${A}\nLala: "at once ${i}"`);
    const outs = await Promise.all(texts.map((t) => save(ep, t)));
    expect(outs.map((o) => o.script_seq).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await seqOf(ep)).toBe(6);
    // The last number is the text that is saved.
    const last = outs.find((o) => o.script_seq === 6);
    expect((await rows('SELECT script_content FROM episodes WHERE id = :ep', { ep }))[0].script_content).toBe(last.script_content);
  });

  test('the same clock time for every save (the clock frozen): the numbers still order the saves; the version times do not', async () => {
    const ep = await makeEpisode();
    jest.useFakeTimers({ now: new Date('2026-10-27T12:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'hrtime', 'performance'] });
    let outs;
    try {
      outs = [];
      for (const t of ['one', 'two', 'three', 'four']) outs.push(await save(ep, `${A}\n${t}`));
    } finally {
      jest.useRealTimers();
    }
    expect(outs.map((o) => o.script_seq)).toEqual([1, 2, 3, 4]);
    const times = await rows('SELECT DISTINCT created_at FROM episode_script_versions WHERE episode_id = :ep', { ep });
    expect(times).toHaveLength(1);
  });

  test('a save that fails takes no number (the save and the number roll back together)', async () => {
    const ep = await makeEpisode();
    const failing = saveEpisodeScript(models, ep, { writer: 'test', compose: async () => { throw new Error('compose failed (test)'); } });
    await expect(failing).rejects.toThrow('compose failed');
    const stale = saveEpisodeScript(models, ep, { writer: 'W1', requireRevision: true, revision: scriptRevision('not this'), compose: async () => ({ script: 'x' }) });
    await expect(stale).rejects.toMatchObject({ status: 409 });
    expect(await seqOf(ep)).toBe(0);
  });
});
