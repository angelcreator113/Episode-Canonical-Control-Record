/**
 * Script History audit (2026-10-24): every writer that replaces an
 * episode's script keeps the script it replaces (H2); a restore saved from
 * History is named (H7); the list is read in the database and matches the
 * text (H10); and two saves at once keep both replaced scripts (H11).
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { listVersions, summary, snapshotScript } = require('../../src/services/scriptVersions');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;

(shouldSkip ? describe.skip : describe)('Script history: every writer, restores, the list, two saves at once', () => {
  const show = uuid();
  const eps = [];
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: `test-hist-${show.slice(0, 8)}`, email: 'h@hist.dev', name: 'Hist', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id: show, n: `hist-${show.slice(0, 8)}` });
  });

  afterAll(async () => {
    if (eps.length) {
      await run(`DELETE FROM episode_script_versions WHERE episode_id IN (:eps)`, { eps });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE id IN (:eps)`, { eps });
    }
    await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const episode = async (script) => {
    const ep = uuid();
    eps.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', :n, 'draft', :script, NOW(), NOW())`, { ep, show, n: eps.length, script });
    return ep;
  };
  const worldEvent = async () => {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, prestige, created_at, updated_at)
               VALUES (:id, :show, 'Velour Gala', 'ready', 5, NOW(), NOW())`, { id, show });
    return id;
  };
  const versions = (ep) => run(`SELECT source, script_content FROM episode_script_versions WHERE episode_id = :ep ORDER BY created_at DESC`, { ep }).then(([rows]) => rows);
  const OLD = beat(1, 'Opening Ritual', 'Lala: "the script before"');

  describe('H2: writers that replace the script keep it first', () => {
    test('generate-script with confirmOverwrite (Regenerate script on the event)', async () => {
      const ep = await episode(OLD);
      const ev = await worldEvent();
      const res = await auth(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-script`)).send({ episode_id: ep, confirmOverwrite: true });
      expect(res.status).toBe(200);
      const kept = await versions(ep);
      expect(kept).toHaveLength(1);
      expect(kept[0]).toMatchObject({ source: 'generate', script_content: OLD });
    });

    test('inject keeps the script before the event tag went in', async () => {
      const ep = await episode(OLD);
      const ev = await worldEvent();
      const res = await auth(request(app).post(`/api/v1/world/${show}/events/${ev}/inject`)).send({ episode_id: ep });
      expect(res.status).toBe(200);
      const kept = await versions(ep);
      expect(kept).toHaveLength(1);
      expect(kept[0]).toMatchObject({ source: 'generate', script_content: OLD });
    });

    test('generate-beats keeps the script it replaces', async () => {
      const ep = await episode(OLD);
      const res = await auth(request(app).post(`/api/v1/episodes/${ep}/generate-beats`)).send({});
      expect(res.status).toBe(200);
      const kept = await versions(ep);
      expect(kept.map((v) => v.source)).toEqual(['generate']);
      expect(kept[0].script_content).toBe(OLD);
    });
    // The Script Writer's generate and lock (episodeScriptWriterService,
    // episodeScriptWriterRoutes) keep the script the same way; the test
    // database's episode_scripts table predates the EpisodeScript model
    // (content, integer id), so they are not driven here.
  });

  describe('H7: a save that restores a version is named', () => {
    test('restored_from, a version of this episode, keeps the replaced script as source restore', async () => {
      const ep = await episode(OLD);
      const NEW = beat(1, 'Opening Ritual', 'Lala: "a new take"');
      expect((await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: NEW })).status).toBe(200);
      const [first] = await listVersions(models, ep);
      const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: OLD, restored_from: first.id });
      expect(res.status).toBe(200);
      expect(res.body.data.script_content).toBe(OLD);
      const list = (await auth(request(app).get(`/api/v1/episodes/${ep}/script-versions`))).body.data;
      expect(list.map((v) => [v.source, v.restore])).toEqual([['restore', true], ['save', false]]);
      expect(list[0].preview).toBe('Lala: "a new take"');
    });

    test("another episode's version, or a value that is no id, is ignored: a plain save", async () => {
      const ep = await episode(OLD);
      const other = await episode(OLD);
      await snapshotScript(models, { id: other, script_content: 'x', script_locked_beats: [] });
      const [foreign] = await listVersions(models, other);
      expect((await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 'one', restored_from: foreign.id })).status).toBe(200);
      expect((await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 'two', restored_from: 'not-an-id' })).status).toBe(200);
      expect((await versions(ep)).map((v) => v.source)).toEqual(['save', 'save']);
    });
  });

  describe('H10: the list is read in the database', () => {
    test('preview, beats and length match what the full text gives', async () => {
      const ep = await episode('seed');
      const texts = [
        '[EVENT: x]\n\n  ## beat: 1 · A\n   \n  [UI:X]\n   Lala: "hi"  \nmore',
        '##\n\nBEAT: 2\n## BEAT: 3\n[a]',
        '\r\n\tPrime: yo\r\n## BEAT: 4',
        '😀 Lala: "emoji" 💅🏽',
        '#BEAT: no\n ##  BEAT:yes',
        `## BEAT: 1\n${'L'.repeat(300)}`,
        '[ONLY TAGS]\n## BEAT: 1\n[MORE]',
      ];
      for (const text of texts) {
        // eslint-disable-next-line no-await-in-loop
        await snapshotScript(models, { id: ep, script_content: text, script_locked_beats: [] });
      }
      const listed = await listVersions(models, ep);
      const full = await models.EpisodeScriptVersion.findAll({ where: { episode_id: ep }, order: [['created_at', 'DESC']] });
      expect(listed).toHaveLength(texts.length);
      expect(listed).toEqual(full.map(summary));
      expect(listed.find((v) => v.preview.startsWith('😀')).length).toBe('😀 Lala: "emoji" 💅🏽'.length);
    });
  });

  describe('H11: two saves at once', () => {
    test('each save keeps the script it replaced; none is lost', async () => {
      const ep = await episode(OLD);
      const A = beat(1, 'Opening Ritual', 'Lala: "tab A"');
      const B = beat(1, 'Opening Ritual', 'Lala: "tab B"');
      const [ra, rb] = await Promise.all([
        auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: A }),
        auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: B }),
      ]);
      expect([ra.status, rb.status]).toEqual([200, 200]);
      const [[row]] = await run(`SELECT script_content FROM episodes WHERE id = :ep`, { ep });
      const kept = (await versions(ep)).map((v) => v.script_content);
      // The first save kept OLD; the second kept the first's script.
      const winner = row.script_content;
      const loser = winner === A ? B : A;
      expect(kept.sort()).toEqual([OLD, loser].sort());
    });

    test('a lock that saves and a save at once keep both replaced scripts', async () => {
      const ep = await episode(OLD);
      const A = beat(1, 'Opening Ritual', 'Lala: "save"');
      const B = beat(1, 'Opening Ritual', 'Lala: "lock"');
      const [ra, rb] = await Promise.all([
        auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: A }),
        auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send({ locked_beats: [], script_content: B }),
      ]);
      expect([ra.status, rb.status]).toEqual([200, 200]);
      const kept = await versions(ep);
      expect(kept).toHaveLength(2);
      expect(kept.map((v) => v.script_content)).toContain(OLD);
    });
  });

  describe('R2 over the API: a new beat under a locked number', () => {
    test('a save keeps it renumbered and names it in locked_beats_moved', async () => {
      const B1 = beat(1, 'Opening Ritual', 'A');
      const B2 = beat(2, 'Login Sequence', 'APPROVED');
      const ep = await episode(`${B1}\n\n${B2}`);
      await run(`UPDATE episodes SET script_locked_beats = '[2]'::jsonb WHERE id = :ep`, { ep });
      const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: `${B1}\n\n${B2}\n\n${beat(2, 'New scene', 'NEW LINES')}` });
      expect(res.status).toBe(200);
      expect(res.body.data.script_content).toBe(`${B1}\n\n${B2}\n\n${beat(15, 'New scene', 'NEW LINES')}`);
      expect(res.body.locked_beats_moved).toEqual([{ from: 2, to: 15, header: '## BEAT: 15 · New scene' }]);
      expect(res.body.locked_beats_kept).toBeUndefined();
    });
  });
});
