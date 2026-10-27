/**
 * Every script writer through the one save (architecture A1c R1, Evoni,
 * 2026-10-27; docs/reads/2026-10-27-a1c-r1-spec.md §4.1), on Postgres.
 *
 * W1  PUT  /episodes/:id                               (Save, Restore)
 * W2  PUT  /episodes/:id/script-locks                  (Approve)
 * W3  POST /episode-scripts/:episodeId/generate        (Script Writer)
 * W4  POST /episode-scripts/:scriptId/lock             (Script Writer lock)
 * W5  POST /world/:showId/events/:eventId/inject       (event tag)
 * W6  POST /world/:showId/events/:eventId/generate-episode   (draft_script)
 * W7  POST /world/:showId/events/:eventId/generate-script    (skeleton)
 * W8  POST /world/:showId/events/generate-episode-from-many  (draft_script)
 * W9  POST /episodes/:id/generate-beats                (skeleton)
 * W10 POST /episode-brief/:episodeId/generate-script   (grounded Regenerate)
 *
 * Each writer: (a) writes the text it wrote before for the same input
 * (lock-keeping parity), (b) a forced failure of the version row leaves
 * text, locks and versions unchanged, (c) a row with line identities is
 * refused and nothing is written, (d) script_line_keys stays NULL on the
 * episode and every version, (e) script_voice_clips rows are identical
 * before and after, (f) a concurrent write is serialised by the row lock.
 *
 * Only the AI is stubbed (the Anthropic SDK and the grounded writer's model
 * call), and the Script Writer's own episode_scripts row for W3/W4: the
 * test database's episode_scripts table predates the EpisodeScript model
 * (see scriptHistoryWriters.integration.test.js). The episode, its versions
 * and every other table are the real ones.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));
// The AI limiter counts every generator call here; the limiter itself is tested elsewhere.
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
const mockGrounded = jest.fn();
jest.mock('../../src/services/groundedScriptGeneratorService', () => ({
  ...jest.requireActual('../../src/services/groundedScriptGeneratorService'),
  generateGroundedScript: (...a) => mockGrounded(...a),
}));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const scriptVersions = require('../../src/services/scriptVersions');
const episodeGenerator = require('../../src/services/episodeGeneratorService');
const { scriptKeepingLocks, splitScriptBeats } = require('../../src/utils/scriptBeatLocks');
const { scriptRevision } = require('../../src/utils/scriptRevision');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const beat = (n, name, body) => `## BEAT: ${n} · ${name}\n${body}`;

// The fixture: an approved beat 1, an unlocked STAKES beat 2, a beat 3.
const B1 = beat(1, 'Opening Ritual', 'Lala: "Bestie, come style me."\n(Lala twirls)');
const B2 = beat(2, 'STAKES_INTENTION', 'Prime: "This is the one."');
const B3 = beat(3, 'Transformation', 'Lala: "Closet time."');
const FIXTURE = `${B1}\n\n${B2}\n\n${B3}`;
const LOCKS = [1];
// What a generator writes: every beat new, beat 1 included (which is kept).
const GENERATED = [
  beat(1, 'Opening Ritual', 'Lala: "A NEW OPENING THAT MUST NOT LAND."'),
  beat(2, 'STAKES_INTENTION', 'Prime: "New stakes."'),
  beat(3, 'Transformation', 'Lala: "New closet."'),
].join('\n\n');
const EDITED = FIXTURE.replace('Closet time.', 'Closet time, edited.');

(shouldSkip ? describe.skip : describe)('A1c R1: every script writer through the one save', () => {
  const show = uuid();
  const episodes = [];
  let token;
  let scriptStub;
  let realEpisodeScript;
  // Each test from its own address (app.js trusts one proxy): the write
  // limiter (60 a minute per address) is not what is under test here.
  let testNumber = 0;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', `10.27.${Math.floor(testNumber / 250)}.${testNumber % 250 + 1}`);

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-used';
    token = TokenService.generateTokenPair({ id: `test-a1c-${show.slice(0, 8)}`, email: 'w@a1c.dev', name: 'Writers', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id: show, n: `a1c-${show.slice(0, 8)}` });
    realEpisodeScript = models.EpisodeScript;
  });

  afterAll(async () => {
    models.EpisodeScript = realEpisodeScript;
    const eps = (await rows(`SELECT id FROM episodes WHERE show_id = :show`, { show })).map((r) => r.id);
    if (eps.length) {
      for (const table of ['episode_script_versions', 'script_voice_clips', 'episode_spending_lines', 'episode_briefs', 'scene_plans']) {
        // eslint-disable-next-line no-await-in-loop
        await run(`DELETE FROM ${table} WHERE episode_id IN (:eps)`, { eps }).catch((err) => console.error(`[cleanup] ${table}:`, err.message));
      }
    }
    await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
    if (eps.length) await run(`DELETE FROM episodes WHERE id IN (:eps)`, { eps }).catch((err) => console.error('[cleanup] episodes:', err.message));
    await run(`DELETE FROM world_events WHERE show_id = :show`, { show }).catch((err) => console.error('[cleanup] world_events:', err.message));
    await run(`DELETE FROM shows WHERE id = :show`, { show }).catch((err) => console.error('[cleanup] shows:', err.message));
  });

  beforeEach(() => {
    testNumber += 1;
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ content: [{ text: GENERATED }], usage: { input_tokens: 1, output_tokens: 1 } });
    mockGrounded.mockReset();
    mockGrounded.mockResolvedValue({ script: GENERATED });
    // The Script Writer's own row (W3, W4), in memory: its table here is an older shape.
    const made = [];
    scriptStub = {
      made,
      async findOne() { return null; },
      async findByPk(id) { return made.find((s) => s.id === id) || null; },
      async create(vals) {
        const row = {
          id: uuid(), ...vals,
          async update(next) { if (scriptStub.failUpdate) throw new Error('forced script row failure'); Object.assign(row, next); return row; },
          setDataValue(k, v) { row[k] = v; },
          toJSON() { const { update, setDataValue, toJSON, ...data } = row; return data; },
        };
        made.push(row);
        return row;
      },
      failUpdate: false,
    };
    models.EpisodeScript = scriptStub;
  });
  afterEach(() => { jest.restoreAllMocks(); models.EpisodeScript = realEpisodeScript; });

  // ── fixtures and reads ───────────────────────────────────────────────────
  const makeEpisode = async ({ script = FIXTURE, locks = LOCKS, title = 'Gala Night' } = {}) => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
               VALUES (:ep, :show, :title, :n, 'draft', :script, CAST(:locks AS jsonb), NOW(), NOW())`,
    { ep, show, title, n: episodes.length + 100, script, locks: JSON.stringify(locks) });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, created_at, updated_at) VALUES (:id, :ep, :show, NOW(), NOW())`, { id: uuid(), ep, show });
    await addClip(ep);
    return ep;
  };
  const addClip = (ep) => run(`INSERT INTO script_voice_clips (id, episode_id, beat_number, line_index, speaker, line_text, s3_key, url, created_at, updated_at)
               VALUES (:id, :ep, 1, 0, 'Lala', 'Bestie, come style me.', :key, :url, NOW() - interval '1 day', NOW() - interval '1 day')`,
  { id: uuid(), ep, key: `voice/${ep}/1-0.webm`, url: `https://example.invalid/${ep}.webm` });
  const makeEvent = async (over = {}) => {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, prestige, created_at, updated_at)
               VALUES (:id, :show, :name, 'ready', 5, NOW(), NOW())`, { id, show, name: over.name || `Velour Gala ${id.slice(0, 4)}` });
    return id;
  };
  const episodeRow = async (ep) => (await rows(`SELECT script_content, script_locked_beats, script_line_keys FROM episodes WHERE id = :ep`, { ep }))[0];
  const versionRows = (ep) => rows(`SELECT source, script_content, script_line_keys FROM episode_script_versions WHERE episode_id = :ep ORDER BY created_at DESC, id DESC`, { ep });
  const clips = (ep) => rows(`SELECT * FROM script_voice_clips WHERE episode_id = :ep ORDER BY id`, { ep });
  const revisionOf = async (ep) => (await auth(request(app).get(`/api/v1/episodes/${ep}`))).body.script_revision;
  const setKeys = (ep) => run(`UPDATE episodes SET script_line_keys = CAST(:k AS jsonb) WHERE id = :ep`, { ep, k: JSON.stringify({ v: 1, text_hash: 'x', lines: [], retired: [] }) });
  const newEpisodesOf = async (before) => (await rows(`SELECT id FROM episodes WHERE show_id = :show`, { show })).map((r) => r.id).filter((id) => !before.includes(id));
  const allEpisodeIds = async () => (await rows(`SELECT id FROM episodes WHERE show_id = :show`, { show })).map((r) => r.id);

  // A version row that is written and then fails: the whole save must roll back.
  const failVersions = () => {
    const real = scriptVersions.snapshotScript;
    return jest.spyOn(scriptVersions, 'snapshotScript').mockImplementation(async (...args) => {
      await real(...args);
      throw new Error('forced version failure');
    });
  };

  // Holds the episode row (SELECT ... FOR UPDATE), writes HELD into it, and
  // commits after `ms`: a write that started meanwhile must wait, then read HELD.
  const HELD = beat(1, 'Opening Ritual', 'Lala: "Bestie, come style me."\n(Lala twirls)') + '\n\n' + beat(2, 'STAKES_INTENTION', 'Prime: "Written by the other tab."');
  const holdRow = async (ep, ms = 600) => {
    const t = await sequelize.transaction();
    await sequelize.query(`SELECT id FROM episodes WHERE id = :ep FOR UPDATE`, { replacements: { ep }, transaction: t });
    await sequelize.query(`UPDATE episodes SET script_content = :s WHERE id = :ep`, { replacements: { ep, s: HELD }, transaction: t });
    let released = false;
    const done = sleep(ms).then(async () => { released = true; await t.commit(); });
    return { done, released: () => released };
  };

  // ── the writers ──────────────────────────────────────────────────────────
  // Each: setup() → ctx; drive(ctx) → response; the episode it writes (ctx.ep
  // or, for W6/W8, the new one); the text it should write (parity), or null
  // when the writer's own input is not known to the test.
  const legacyInject = (script, injection) => {
    let s = script.replace(/\[EVENT:[^\]]*\]/gi, '').replace(/\[LOCATION_HINT:[^\]]*\]/gi, '');
    const marker = ['## BEAT: STAKES', '## BEAT: REVEAL', '## BEAT: INTERRUPTION'].find((m) => s.indexOf(m) >= 0);
    const at = marker ? s.indexOf('\n', s.indexOf(marker)) + 1 : 0;
    s = s.substring(0, at) + injection + s.substring(at);
    return s.trim();
  };
  const fixtureRow = { script_content: FIXTURE, script_locked_beats: LOCKS };

  const WRITERS = [
    {
      id: 'W1', existing: true, revisioned: true,
      drive: async (ctx) => auth(request(app).put(`/api/v1/episodes/${ctx.ep}`)).send({ script_content: EDITED, script_revision: ctx.revision }),
      expected: () => scriptKeepingLocks(fixtureRow, EDITED, { keepExtras: true }).script,
    },
    {
      id: 'W2', existing: true, revisioned: true,
      drive: async (ctx) => auth(request(app).put(`/api/v1/episodes/${ctx.ep}/script-locks`)).send({ locked_beats: [1, 3], script_content: EDITED, script_revision: ctx.revision }),
      expected: () => require('../../src/utils/scriptBeatLocks').keepLockedBeats(EDITED, FIXTURE, [1], { keepExtras: true }).script,
      locksAfter: [1, 3],
    },
    {
      id: 'W3', existing: true, generator: true,
      drive: async (ctx) => auth(request(app).post(`/api/v1/episode-scripts/${ctx.ep}/generate`)).send({ showId: show, confirmOverwrite: true }),
      expected: () => scriptKeepingLocks(fixtureRow, scriptStub.made[scriptStub.made.length - 1].script_text).script,
    },
    {
      id: 'W4', existing: true,
      setup: async (ctx) => { ctx.script = await scriptStub.create({ episode_id: ctx.ep, version: 1, status: 'draft', script_text: GENERATED }); },
      drive: async (ctx) => auth(request(app).post(`/api/v1/episode-scripts/${ctx.script.id}/lock`)).send({ confirmOverwrite: true }),
      expected: () => scriptKeepingLocks(fixtureRow, GENERATED).script,
    },
    {
      id: 'W5', existing: true,
      setup: async (ctx) => { ctx.ev = await makeEvent({ name: 'Velour Gala' }); },
      drive: async (ctx) => auth(request(app).post(`/api/v1/world/${show}/events/${ctx.ev}/inject`)).send({ episode_id: ctx.ep }),
      // The tag as the route built it (its response's event_tag), placed as before.
      expected: (res) => legacyInject(FIXTURE, `${res.body.event_tag}\n`),
    },
    {
      id: 'W6', created: true,
      setup: async (ctx) => { ctx.ev = await makeEvent(); },
      drive: async (ctx) => auth(request(app).post(`/api/v1/world/${show}/events/${ctx.ev}/generate-episode`)).send({ draft_script: true }),
      expected: null,
    },
    {
      id: 'W7', existing: true,
      setup: async (ctx) => { ctx.ev = await makeEvent(); },
      drive: async (ctx) => auth(request(app).post(`/api/v1/world/${show}/events/${ctx.ev}/generate-script`)).send({ episode_id: ctx.ep, confirmOverwrite: true }),
      expected: null,
    },
    {
      id: 'W8', created: true,
      setup: async (ctx) => { ctx.ev = await makeEvent(); },
      drive: async (ctx) => auth(request(app).post(`/api/v1/world/${show}/events/generate-episode-from-many`)).send({ event_ids: [ctx.ev], draft_script: true }),
      expected: null,
    },
    {
      id: 'W9', existing: true,
      drive: async (ctx) => auth(request(app).post(`/api/v1/episodes/${ctx.ep}/generate-beats`)).send({ confirmOverwrite: true }),
      expected: null,
    },
    {
      id: 'W10', existing: true, generator: true,
      drive: async (ctx) => auth(request(app).post(`/api/v1/episode-brief/${ctx.ep}/generate-script`)).send({ showId: show, confirmOverwrite: true }),
      expected: () => scriptKeepingLocks(fixtureRow, GENERATED).script,
    },
  ];

  // For W6/W8 the episode is made inside the request: the real generator
  // runs, then `after(episodeId)` sets the state a check needs on it.
  const onNewEpisode = (after) => {
    const real = episodeGenerator.generateEpisodeFromEvent;
    return jest.spyOn(episodeGenerator, 'generateEpisodeFromEvent').mockImplementation(async (...args) => {
      const result = await real(...args);
      await addClip(result.episode.id);
      if (after) await after(result.episode.id);
      return result;
    });
  };

  const prepare = async (w, opts = {}) => {
    const ctx = {};
    if (w.existing) {
      ctx.ep = await makeEpisode();
      ctx.revision = await revisionOf(ctx.ep);
    }
    if (w.setup) await w.setup(ctx);
    if (w.created) {
      ctx.before = await allEpisodeIds();
      onNewEpisode(opts.after || null);
    }
    return ctx;
  };
  const episodeOf = async (w, ctx) => (w.created ? (await newEpisodesOf(ctx.before))[0] : ctx.ep);

  describe.each(WRITERS)('$id', (w) => {
    test('(a) writes the text it wrote before, locked beats kept; (d) no line identity; (e) voice clips unchanged', async () => {
      const ctx = await prepare(w);
      const clipsBefore = w.existing ? await clips(ctx.ep) : null;
      const res = await w.drive(ctx);
      expect([200, 201]).toContain(res.status);
      const ep = await episodeOf(w, ctx);
      const row = await episodeRow(ep);
      if (w.expected) expect(row.script_content).toBe(w.expected(res));
      if (w.existing) {
        // The approved beat is word for word as it was.
        expect(splitScriptBeats(row.script_content).beats.find((b) => b.number === 1).text).toBe(B1);
        expect(row.script_content).not.toContain('A NEW OPENING THAT MUST NOT LAND');
        expect(row.script_locked_beats).toEqual(w.locksAfter || LOCKS);
        const kept = await versionRows(ep);
        expect(kept[0].script_content).toBe(FIXTURE);
        expect(await clips(ep)).toEqual(clipsBefore);
      } else {
        expect(String(row.script_content || '').trim()).not.toBe('');
        expect((await clips(ep))).toHaveLength(1);
      }
      expect(row.script_line_keys).toBeNull();
      for (const v of await versionRows(ep)) expect(v.script_line_keys).toBeNull();
      expect(res.body.script_revision ?? res.body.data?.script_revision).toBe(scriptRevision(row.script_content));
    });

    test('(b) a version row that fails rolls the whole save back', async () => {
      const ctx = await prepare(w);
      failVersions();
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await w.drive(ctx);
      errSpy.mockRestore(); warnSpy.mockRestore();
      const ep = await episodeOf(w, ctx);
      const row = await episodeRow(ep);
      if (w.created) {
        // The episode is made; its draft is not, and nothing says it was.
        expect(res.status).toBe(201);
        expect(res.body.script_drafted).toBe(false);
        expect(String(row.script_content || '')).toBe('');
      } else if (w.id === 'W10') {
        // Generated but not saved, as before (GATE-03): the draft comes back, saved false.
        expect(res.body).toMatchObject({ success: false, saved: false, code: 'SCRIPT_GENERATED_NOT_SAVED' });
        expect(row.script_content).toBe(FIXTURE);
      } else {
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(row.script_content).toBe(FIXTURE);
        expect(row.script_locked_beats).toEqual(LOCKS);
      }
      expect(await versionRows(ep)).toEqual([]);
      if (w.id === 'W4') expect(ctx.script.status).toBe('draft');
      if (w.id === 'W5') expect((await rows(`SELECT used_in_episode_id FROM world_events WHERE id = :ev`, { ev: ctx.ev }))[0].used_in_episode_id).toBeNull();
    });

    test('(c) an episode with line identities is refused, and nothing is written', async () => {
      const ctx = await prepare(w, { after: setKeys });
      if (w.existing) {
        await setKeys(ctx.ep);
        // The revision now includes the keys: a client sends the one it read.
        ctx.revision = await revisionOf(ctx.ep);
      }
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await w.drive(ctx);
      warnSpy.mockRestore(); errSpy.mockRestore();
      const ep = await episodeOf(w, ctx);
      const row = await episodeRow(ep);
      if (w.created) {
        expect(res.status).toBe(201);
        expect(res.body.script_drafted).toBe(false);
        expect(String(row.script_content || '')).toBe('');
      } else {
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('LINE_IDENTITY_ACTIVE');
        expect(row.script_content).toBe(FIXTURE);
      }
      expect(row.script_line_keys).toEqual({ v: 1, text_hash: 'x', lines: [], retired: [] });
      expect(await versionRows(ep)).toEqual([]);
    });

    test('(f) a write that starts while the row is held waits for it, then reads what it committed', async () => {
      let hold;
      const ctx = await prepare(w, { after: async (id) => { hold = await holdRow(id); } });
      if (w.existing) hold = await holdRow(ctx.ep);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const pending = w.drive(ctx).then((r) => ({ r, releasedFirst: hold.released() }));
      const { r: res, releasedFirst } = await pending;
      await hold.done;
      warnSpy.mockRestore();
      // It finished only after the other transaction let the row go.
      expect(releasedFirst).toBe(true);
      const ep = await episodeOf(w, ctx);
      const row = await episodeRow(ep);
      if (w.revisioned || w.generator) {
        // It read the revision before the other write; it is refused, not written over it.
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SCRIPT_CHANGED');
        expect(row.script_content).toBe(HELD);
        if (w.generator) expect(res.body.draft).toEqual(expect.any(String));
      } else if (w.created) {
        // The draft is checked under the lock: the script written meanwhile stays.
        expect(res.status).toBe(201);
        expect(res.body.script_drafted).toBe(false);
        expect(row.script_content).toBe(HELD);
      } else {
        // It writes after it, and keeps what the other write committed as the version.
        expect([200, 201]).toContain(res.status);
        expect((await versionRows(ep))[0].script_content).toBe(HELD);
      }
    });
  });

  // ── writer-specific checks ───────────────────────────────────────────────
  describe('W1 and W2: the revision', () => {
    test('a write with no revision is refused, also on an empty script; a stale one is refused with the current one', async () => {
      for (const script of [FIXTURE, '']) {
        // eslint-disable-next-line no-await-in-loop
        const ep = await makeEpisode({ script, locks: [] });
        // eslint-disable-next-line no-await-in-loop
        const missing = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 'x' });
        expect(missing.status).toBe(409);
        expect(missing.body.code).toBe('SCRIPT_REVISION_REQUIRED');
        // eslint-disable-next-line no-await-in-loop
        expect(missing.body.current_revision).toBe(await revisionOf(ep));
        // eslint-disable-next-line no-await-in-loop
        const stale = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 'x', script_revision: scriptRevision('an older script') });
        expect(stale.status).toBe(409);
        expect(stale.body.code).toBe('SCRIPT_CHANGED');
        // eslint-disable-next-line no-await-in-loop
        expect((await episodeRow(ep)).script_content).toBe(script);
      }
    });

    test('a title-only update needs no revision', async () => {
      const ep = await makeEpisode();
      const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ title: 'A new title' });
      expect(res.status).toBe(200);
      expect((await episodeRow(ep)).script_content).toBe(FIXTURE);
      expect(await versionRows(ep)).toEqual([]);
    });

    test('the initial-write contract: a new episode\'s create answer carries the revision its first script is saved with', async () => {
      const created = await auth(request(app).post('/api/v1/episodes')).send({ title: 'Brand New', show_id: show, season_number: 1, episode_number: 900, status: 'draft' });
      expect(created.status).toBe(201);
      const ep = created.body.data.id;
      episodes.push(ep);
      expect(created.body.script_revision).toBe(scriptRevision(''));
      // Another tab saves a script first: the creator's first write is refused, not written over it.
      const other = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 'OTHER TAB', script_revision: created.body.script_revision });
      expect(other.status).toBe(200);
      const late = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: 'SKELETON', script_revision: created.body.script_revision });
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('SCRIPT_CHANGED');
      expect((await episodeRow(ep)).script_content).toBe('OTHER TAB');
    });

    test('W2: a lock with no text needs the revision too, and leaves the text as it is', async () => {
      const ep = await makeEpisode();
      const missing = await auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send({ locked_beats: [1, 2] });
      expect(missing.status).toBe(409);
      expect(missing.body.code).toBe('SCRIPT_REVISION_REQUIRED');
      expect((await episodeRow(ep)).script_locked_beats).toEqual(LOCKS);
      const ok = await auth(request(app).put(`/api/v1/episodes/${ep}/script-locks`)).send({ locked_beats: [1, 2], script_revision: await revisionOf(ep) });
      expect(ok.status).toBe(200);
      const row = await episodeRow(ep);
      expect(row.script_locked_beats).toEqual([1, 2]);
      expect(row.script_content).toBe(FIXTURE);
      expect(ok.body.script_revision).toBe(scriptRevision(FIXTURE));
    });
  });

  describe('W1: a restore (C9)', () => {
    const OLD = `${B1}\n\n${beat(2, 'STAKES_INTENTION', 'Prime: "An older take."')}\n\n${B3}`;
    const versionOf = async (ep, text) => (await rows(`SELECT id FROM episode_script_versions WHERE episode_id = :ep AND script_content = :text`, { ep, text }))[0].id;

    test('the server\'s copy of the version is a restore', async () => {
      const ep = await makeEpisode({ script: OLD });
      await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: FIXTURE, script_revision: await revisionOf(ep) });
      const vid = await versionOf(ep, OLD);
      const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: OLD, restored_from: vid, script_revision: await revisionOf(ep) });
      expect(res.status).toBe(200);
      expect((await episodeRow(ep)).script_content).toBe(OLD);
      expect((await versionRows(ep))[0]).toMatchObject({ source: 'restore', script_content: FIXTURE });
    });

    test('a version edited after it was put back is an ordinary save', async () => {
      const ep = await makeEpisode({ script: OLD });
      await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: FIXTURE, script_revision: await revisionOf(ep) });
      const vid = await versionOf(ep, OLD);
      const edited = `${OLD}\nLala: "edited after restoring"`;
      const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: edited, restored_from: vid, script_revision: await revisionOf(ep) });
      expect(res.status).toBe(200);
      expect((await episodeRow(ep)).script_content).toBe(edited);
      expect((await versionRows(ep))[0]).toMatchObject({ source: 'save', script_content: FIXTURE });
    });

    test('a version whose approved beat changed since is restored with the beat as approved now', async () => {
      const ep = await makeEpisode({ script: `${beat(1, 'Opening Ritual', 'Lala: "the opening then"')}\n\n${B2}\n\n${B3}`, locks: [] });
      const then = (await episodeRow(ep)).script_content;
      await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: FIXTURE, script_revision: await revisionOf(ep) });
      await run(`UPDATE episodes SET script_locked_beats = '[1]'::jsonb WHERE id = :ep`, { ep });
      const vid = await versionOf(ep, then);
      // The page puts the version back with beat 1 as approved now (lib/scriptLocks): FIXTURE's beat 1.
      const res = await auth(request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: FIXTURE, restored_from: vid, script_revision: await revisionOf(ep) });
      expect(res.status).toBe(200);
      // Same text as now: nothing replaced, no version.
      expect((await versionRows(ep)).map((v) => v.source)).toEqual(['save']);
    });
  });

  describe('W3 and W10: the script changed while the new one was written (C3)', () => {
    test('W3: 409 with the draft, nothing saved to the episode, the Script Writer row kept', async () => {
      const ep = await makeEpisode();
      mockCreate.mockImplementation(async () => {
        await run(`UPDATE episodes SET script_content = 'CHANGED ELSEWHERE' WHERE id = :ep`, { ep });
        return { content: [{ text: GENERATED }], usage: {} };
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await auth(request(app).post(`/api/v1/episode-scripts/${ep}/generate`)).send({ showId: show, confirmOverwrite: true });
      errSpy.mockRestore();
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'SCRIPT_CHANGED', saved: false, draft: expect.any(String) });
      expect(res.body.data.id).toBe(scriptStub.made[0].id);
      expect((await episodeRow(ep)).script_content).toBe('CHANGED ELSEWHERE');
      expect(await versionRows(ep)).toEqual([]);
    });

    test('W10: 409 with the draft, nothing saved', async () => {
      const ep = await makeEpisode();
      mockGrounded.mockImplementation(async () => {
        await run(`UPDATE episodes SET script_content = 'CHANGED ELSEWHERE' WHERE id = :ep`, { ep });
        return { script: GENERATED };
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
      errSpy.mockRestore();
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'SCRIPT_CHANGED', saved: false, draft: scriptKeepingLocks({ script_content: 'CHANGED ELSEWHERE', script_locked_beats: LOCKS }, GENERATED).script });
      expect((await episodeRow(ep)).script_content).toBe('CHANGED ELSEWHERE');
    });

    test('W10: a beat approved while it was written keeps its approved words (lock-only does not change the revision)', async () => {
      const ep = await makeEpisode({ locks: [] });
      mockGrounded.mockImplementation(async () => {
        await run(`UPDATE episodes SET script_locked_beats = '[3]'::jsonb WHERE id = :ep`, { ep });
        return { script: GENERATED };
      });
      const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-script`)).send({ showId: show, confirmOverwrite: true });
      expect(res.status).toBe(200);
      const row = await episodeRow(ep);
      expect(splitScriptBeats(row.script_content).beats.find((b) => b.number === 3).text).toBe(B3);
      expect(row.script_content).toContain('A NEW OPENING THAT MUST NOT LAND');
    });
  });

  describe('W4 and W9: the overwrite guard (C6)', () => {
    test('W4: locking a Script Writer script over an episode\'s script asks first; the script stays unlocked', async () => {
      const ep = await makeEpisode();
      const script = await scriptStub.create({ episode_id: ep, version: 1, status: 'draft', script_text: GENERATED });
      const res = await auth(request(app).post(`/api/v1/episode-scripts/${script.id}/lock`)).send({});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED');
      expect(script.status).toBe('draft');
      expect((await episodeRow(ep)).script_content).toBe(FIXTURE);
    });

    test('W4: a Script Writer row that can\'t be locked rolls the episode\'s script back', async () => {
      const ep = await makeEpisode();
      const script = await scriptStub.create({ episode_id: ep, version: 1, status: 'draft', script_text: GENERATED });
      scriptStub.failUpdate = true;
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await auth(request(app).post(`/api/v1/episode-scripts/${script.id}/lock`)).send({ confirmOverwrite: true });
      errSpy.mockRestore();
      expect(res.status).toBe(500);
      expect((await episodeRow(ep)).script_content).toBe(FIXTURE);
      expect(await versionRows(ep)).toEqual([]);
    });

    test('W9: generate-beats asks before replacing a script', async () => {
      const ep = await makeEpisode();
      const res = await auth(request(app).post(`/api/v1/episodes/${ep}/generate-beats`)).send({});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED');
      expect((await episodeRow(ep)).script_content).toBe(FIXTURE);
    });
  });

  describe('W5: inject keeps its beat (C4)', () => {
    const inject = (ev, ep) => auth(request(app).post(`/api/v1/world/${show}/events/${ev}/inject`)).send({ episode_id: ep });
    // The tag goes after the first "## BEAT: STAKES|REVEAL|INTERRUPTION" header,
    // as the skeleton writers head their beats (a numbered header does not
    // match, and the tag goes at the top, as it always has). A named header
    // is its canonical beat: STAKES_INTENTION is beat 6.
    const NAMED = '## BEAT: OPENING_RITUAL\nLala: "Bestie, come style me."\n\n## BEAT: STAKES_INTENTION\nPrime: "This is the one."\n\n## BEAT: TRANSFORMATION\nLala: "Closet time."';

    test('the intended beat approved: refused, naming the beat; nothing linked', async () => {
      const ep = await makeEpisode({ script: NAMED, locks: [1, 6] });
      const ev = await makeEvent();
      const res = await inject(ev, ep);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'intended_beat_locked', beat_number: 6, beat_label: 'STAKES_INTENTION' });
      expect(res.body.error).toContain('Beat 6 · STAKES_INTENTION is approved');
      expect((await episodeRow(ep)).script_content).toBe(NAMED);
      expect((await rows(`SELECT used_in_episode_id FROM world_events WHERE id = :ev`, { ev }))[0].used_in_episode_id).toBeNull();
    });

    test('an old tag in an approved beat: refused, naming that beat', async () => {
      const tagged = `${beat(1, 'Opening Ritual', '[EVENT: name="Old"]\nLala: "hi"')}\n\n${B2}`;
      const ep = await makeEpisode({ script: tagged, locks: [1] });
      const res = await inject(await makeEvent(), ep);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'old_tag_in_locked_beat', beat_number: 1 });
      expect((await episodeRow(ep)).script_content).toBe(tagged);
    });

    test('numbered headers: the tag goes at the top, before the approved beat, as before', async () => {
      const ep = await makeEpisode();
      const res = await inject(await makeEvent(), ep);
      expect(res.status).toBe(200);
      const row = await episodeRow(ep);
      expect(row.script_content.startsWith(res.body.event_tag)).toBe(true);
      expect(splitScriptBeats(row.script_content).beats.find((b) => b.number === 1).text).toBe(B1);
    });

    test('a script with no beat headers and an approved beat: refused', async () => {
      const ep = await makeEpisode({ script: 'Lala: "no headers here"', locks: [1] });
      const res = await inject(await makeEvent(), ep);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'INJECT_BLOCKED_BY_LOCK', reason: 'headerless_locked', beat_number: null });
    });

    test('a successful inject puts the tag where it always went and links the event', async () => {
      const ep = await makeEpisode({ script: NAMED, locks: [1] });
      const ev = await makeEvent({ name: 'Velour Gala' });
      const res = await inject(ev, ep);
      expect(res.status).toBe(200);
      const row = await episodeRow(ep);
      expect(row.script_content).toBe(legacyInject(NAMED, `${res.body.event_tag}\n`));
      expect(splitScriptBeats(row.script_content).beats.find((b) => b.number === 6).text).toContain('[EVENT: name="Velour Gala"');
      expect((await rows(`SELECT used_in_episode_id FROM world_events WHERE id = :ev`, { ev }))[0].used_in_episode_id).toBe(ep);
      expect(res.body.script_revision).toBe(scriptRevision(row.script_content));
    });
  });

  describe('W6, W7 and W8: the response is what was saved (C8)', () => {
    test('W6: the episode in the answer has the drafted script', async () => {
      const ev = await makeEvent();
      const before = await allEpisodeIds();
      const res = await auth(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`)).send({ draft_script: true });
      expect(res.status).toBe(201);
      const [ep] = await newEpisodesOf(before);
      const row = await episodeRow(ep);
      expect(res.body.script_drafted).toBe(true);
      expect(res.body.data.episode.script_content).toBe(row.script_content);
      expect(res.body.data.script_revision).toBe(scriptRevision(row.script_content));
    });

    test('W7: the script in the answer is the saved one, the approved beat kept', async () => {
      const ep = await makeEpisode();
      const res = await auth(request(app).post(`/api/v1/world/${show}/events/${await makeEvent()}/generate-script`)).send({ episode_id: ep, confirmOverwrite: true });
      expect(res.status).toBe(200);
      const row = await episodeRow(ep);
      expect(res.body.script).toBe(row.script_content);
      expect(splitScriptBeats(res.body.script).beats.find((b) => b.number === 1).text).toBe(B1);
      expect(res.body.line_count).toBe(row.script_content.split('\n').length);
    });

    test('W8: the answer says it drafted, with the saved script\'s revision', async () => {
      const ev = await makeEvent();
      const before = await allEpisodeIds();
      const res = await auth(request(app).post(`/api/v1/world/${show}/events/generate-episode-from-many`)).send({ event_ids: [ev], draft_script: true });
      expect(res.status).toBe(201);
      const [ep] = await newEpisodesOf(before);
      const row = await episodeRow(ep);
      expect(res.body.script_drafted).toBe(true);
      expect(res.body.script_revision).toBe(scriptRevision(row.script_content));
    });
  });
});
