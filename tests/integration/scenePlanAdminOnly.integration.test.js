/**
 * apply-scene-plan and parse-script are an ADMIN's (Evoni, 2026-11-22),
 * against the test database.
 *
 * src/routes/scriptParse.js is mounted twice (src/app.js: /api/v1/scripts and
 * /api/v1/episodes), so each route answers on two paths:
 *
 *   POST .../:id/apply-scene-plan  builds scenes from the episode's script;
 *     with clearExisting it first hard-deletes every scene of the episode
 *     (Scene.destroy, force: true), soft-deleted rows included.
 *   POST .../:id/parse-script      answers with a scene plan built from the
 *     episode's script: its beat titles, tags, UI actions and location hints.
 *
 * Both asked for a sign-in only. Now: no token 401; a signed-in account
 * outside the admin group 403, refused before the handler, so no scene row
 * is changed and nothing of the script is sent; an ADMIN as before.
 * POST /api/v1/scripts/parse reads only the text its caller posts and still
 * asks for a sign-in only.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('apply-scene-plan and parse-script are an ADMIN\'s', () => {
  const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const show = crypto.randomUUID();
  const ep = crypto.randomUUID();
  // Distinctive text in the script, one marker per thing the parser reads out of it.
  const M = {
    beat: `ZZBEAT${tag}`,
    beat2: `ZZBEATB${tag}`,
    beat3: `ZZBEATC${tag}`,
    line: `ZZLINE${tag}`,
    ui: `ZZUI${tag}`,
    mail: `ZZMAIL${tag}`,
    event: `ZZEVENT${tag}`,
    loc: `ZZLOC${tag}`,
    title: `ZZEPTITLE${tag}`,
    old: `ZZOLDSCENE${tag}`,
    own: `ZZOWNTEXT${tag}`,
  };
  const SCRIPT = [
    `[EVENT: name="${M.event} gala" prestige=7]`,
    `## BEAT: OPENING ${M.beat}`,
    `[LOCATION_HINT: "${M.loc} atelier"]`,
    '(Lala walks in.)',
    `Lala: "${M.line} hello"`,
    `[UI:POST ${M.ui} teaser]`,
    `[MAIL: type=invitation from="${M.mail} Maison"]`,
    '',
    `## BEAT: CLOSET ${M.beat2}`,
    'Lala: "second"',
    '',
    `## BEAT: CLOSE ${M.beat3}`,
    'Lala: "third"',
    '',
  ].join('\n');
  // A caller's own text: two beats, none of the episode's markers.
  const OWN = `## BEAT: OPENING ${M.own}\nLala: "mine"\n\n## BEAT: CLOSE ${M.own}\nLala: "mine too"\n`;
  const EPISODE_MARKS = [M.beat, M.beat2, M.beat3, M.line, M.ui, M.mail, M.event, M.loc, M.title, M.old];

  const NON_ADMINS = ['editor', 'viewer', 'nogroup'];
  const MOUNTS = ['/api/v1/episodes', '/api/v1/scripts'];
  const BODIES = [['no body fields', {}], ['clearExisting', { clearExisting: true }], ['posted content', { content: OWN }]];
  const tokens = {};
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const post = (who, path, body) => {
    ipN += 1;
    const r = request(app).post(path).set('X-Forwarded-For', `198.51.181.${(ipN % 200) + 1}`);
    return (tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r).send(body);
  };
  // Every scene row of the episode, soft-deleted ones included, every column.
  const scenes = async () => (await run('SELECT * FROM scenes WHERE episode_id = :ep ORDER BY id', { ep }))[0];
  const episodeRow = async () => (await run('SELECT script_content, updated_at FROM episodes WHERE id = :ep', { ep }))[0][0];
  const seed = async () => {
    await run('DELETE FROM scenes WHERE episode_id = :ep', { ep });
    for (const [n, deleted] of [[1, false], [2, false], [3, true]]) {
      // eslint-disable-next-line no-await-in-loop
      await run(`INSERT INTO scenes (id, episode_id, scene_number, title, description, created_at, updated_at, deleted_at)
                 VALUES (gen_random_uuid(), :ep, :n, :title, 'kept', NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`,
      { ep, n, title: `${M.old} ${n}` });
    }
  };
  // No marker of the episode's script, title or scenes, in any letter case
  // (the parser re-cases beat titles).
  const carriesNothing = (res, marks = EPISODE_MARKS) => {
    const text = res.text.toLowerCase();
    for (const mark of marks) expect(text).not.toContain(mark.toLowerCase());
    for (const key of ['scenePlan', 'scenes', 'beats', 'ui_actions', 'episodeTitle']) expect(res.body[key]).toBeUndefined();
  };
  const spies = () => [
    jest.spyOn(models.Episode, 'findByPk'), jest.spyOn(models.EpisodeScript, 'findOne'),
    jest.spyOn(models.Scene, 'destroy'), jest.spyOn(models.Scene, 'create'),
  ];

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@sceneplan.dev`, name: id, groups, role }).accessToken;
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.nogroup = token(`nogroup-${tag}`, [], undefined);
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())', { show, n: `sceneplan-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, :title, 1, 'draft', :script, NOW(), NOW())`, { ep, show, title: `${M.title} episode`, script: SCRIPT });
  });

  beforeEach(async () => {
    await seed();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM scenes WHERE episode_id = :ep', { ep }).catch((err) => console.error('[cleanup] scenes:', err.message));
    await run('DELETE FROM episodes WHERE id = :ep', { ep }).catch((err) => console.error('[cleanup] episodes:', err.message));
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('[cleanup] shows:', err.message));
  });

  test('the fixture: three scene rows, one of them soft-deleted, and a script the parser reads three beats from', async () => {
    const rows = await scenes();
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.deleted_at !== null)).toHaveLength(1);
    expect((await episodeRow()).script_content).toBe(SCRIPT);
  });

  describe.each(MOUNTS)('POST %s/:id/apply-scene-plan', (mount) => {
    const path = `${mount}/${ep}/apply-scene-plan`;

    test.each(BODIES)('signed out, %s: a 401, no scene row changed, nothing of the script sent', async (_name, body) => {
      const before = await scenes();
      const watched = spies();
      const res = await post(null, path, body);
      expect(res.status).toBe(401);
      carriesNothing(res);
      for (const spy of watched) expect(spy).not.toHaveBeenCalled();
      expect(await scenes()).toEqual(before);
    });

    test.each(BODIES)('signed in and not an admin, %s: a 403, no scene row changed, nothing of the script sent', async (_name, body) => {
      const before = await scenes();
      const episodeBefore = await episodeRow();
      for (const who of NON_ADMINS) {
        const watched = spies();
        // eslint-disable-next-line no-await-in-loop
        const res = await post(who, path, body);
        expect({ who, status: res.status, code: res.body.code }).toEqual({ who, status: 403, code: 'AUTH_GROUP_REQUIRED' });
        carriesNothing(res, [...EPISODE_MARKS, M.own]);
        for (const spy of watched) expect(spy).not.toHaveBeenCalled();
        // eslint-disable-next-line no-await-in-loop
        expect(await scenes()).toEqual(before);
        jest.restoreAllMocks();
      }
      expect(await episodeRow()).toEqual(episodeBefore);
    });

    test('an admin, no body fields: the script\'s three scenes are added and the rows that were there stay', async () => {
      const before = await scenes();
      const res = await post('admin', path, {});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, episodeId: ep, episodeTitle: `${M.title} episode`, scenesCreated: 3, scenesExpected: 3 });
      expect(res.body.scenes).toHaveLength(3);
      expect(res.body.scenePlan.scenes).toHaveLength(3);
      const after = await scenes();
      expect(after).toHaveLength(6);
      // The three earlier rows, the soft-deleted one too, are untouched.
      expect(after.filter((r) => before.some((b) => b.id === r.id))).toEqual(before);
      const created = after.filter((r) => !before.some((b) => b.id === r.id));
      expect(created.map((r) => r.id).sort()).toEqual(res.body.scenes.map((s) => s.id).sort());
      expect(created.map((r) => r.title.toLowerCase()).sort()).toEqual(
        [`opening ${M.beat}`, `closet ${M.beat2}`, `close ${M.beat3}`].map((t) => t.toLowerCase()).sort(),
      );
      expect(created.map((r) => r.scene_number).sort()).toEqual([1, 2, 3]);
      for (const r of created) expect(r.deleted_at).toBeNull();
    });

    test('an admin, clearExisting: every earlier row is gone for good, the soft-deleted one too, and the script\'s three exist', async () => {
      const before = await scenes();
      const res = await post('admin', path, { clearExisting: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, episodeId: ep, scenesCreated: 3, scenesExpected: 3 });
      const after = await scenes();
      expect(after).toHaveLength(3);
      for (const b of before) expect(after.some((r) => r.id === b.id)).toBe(false);
      expect(after.map((r) => r.id).sort()).toEqual(res.body.scenes.map((s) => s.id).sort());
      expect(JSON.stringify(after)).not.toContain(M.old);
    });

    test('an admin, posted content: the scenes come from the posted text, not the episode\'s script, and are added', async () => {
      const before = await scenes();
      const res = await post('admin', path, { content: OWN });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, episodeId: ep, scenesCreated: 2, scenesExpected: 2 });
      const after = await scenes();
      expect(after).toHaveLength(5);
      expect(after.filter((r) => before.some((b) => b.id === r.id))).toEqual(before);
      const created = after.filter((r) => !before.some((b) => b.id === r.id));
      for (const r of created) expect(r.title.toLowerCase()).toContain(M.own.toLowerCase());
      expect((await episodeRow()).script_content).toBe(SCRIPT);
    });

    test('an admin, no such episode: the same 404 as before', async () => {
      const res = await post('admin', `${mount}/${crypto.randomUUID()}/apply-scene-plan`, {});
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Episode not found' });
    });
  });

  describe.each(MOUNTS)('POST %s/:id/parse-script (a read of the episode\'s script)', (mount) => {
    const path = `${mount}/${ep}/parse-script`;

    test('signed out: a 401, and no beat title, tag, UI action or location hint of the script', async () => {
      const watched = spies();
      const res = await post(null, path, {});
      expect(res.status).toBe(401);
      carriesNothing(res);
      for (const spy of watched) expect(spy).not.toHaveBeenCalled();
    });

    test('signed in and not an admin: a 403, the episode is not read, and nothing of its script is sent', async () => {
      const before = await scenes();
      for (const who of NON_ADMINS) {
        const watched = spies();
        // eslint-disable-next-line no-await-in-loop
        const res = await post(who, path, {});
        expect({ who, status: res.status, code: res.body.code }).toEqual({ who, status: 403, code: 'AUTH_GROUP_REQUIRED' });
        carriesNothing(res);
        expect(Object.keys(res.body).sort()).toEqual(['code', 'error', 'message']);
        for (const spy of watched) expect(spy).not.toHaveBeenCalled();
        jest.restoreAllMocks();
      }
      expect(await scenes()).toEqual(before);
    });

    test('an admin: a 200 and the plan read from the script, as before, with no scene written', async () => {
      const before = await scenes();
      const res = await post('admin', path, {});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, episodeId: ep, episodeTitle: `${M.title} episode` });
      const plan = res.body.scenePlan;
      expect(plan.success).toBe(true);
      expect(plan.beats.map((b) => b.title.toLowerCase())).toEqual(
        [`opening ${M.beat}`, `closet ${M.beat2}`, `close ${M.beat3}`].map((t) => t.toLowerCase()),
      );
      expect(plan.scenes).toHaveLength(3);
      expect(plan.scenes[0].location_hint).toBe(`${M.loc} atelier`);
      expect(plan.scenes[0].ui_expected).toEqual([`post:${M.ui} teaser`]);
      expect(plan.ui_actions.map((a) => a.target)).toEqual([`${M.ui} teaser`]);
      const text = res.text.toLowerCase();
      // The beat header, the UI tag, the EVENT tag and the location hint are all in the answer.
      for (const mark of [M.beat, M.ui, M.event, M.loc]) expect(text).toContain(mark.toLowerCase());
      expect(await scenes()).toEqual(before);
    });
  });

  describe('POST /api/v1/scripts/parse (the caller\'s own text) is as it was', () => {
    test('signed out: a 401', async () => {
      expect((await post(null, '/api/v1/scripts/parse', { content: OWN })).status).toBe(401);
    });

    test('signed in and not an admin: a 200 with the plan of the posted text, and no episode or script is read', async () => {
      for (const who of NON_ADMINS) {
        const watched = spies();
        // eslint-disable-next-line no-await-in-loop
        const res = await post(who, '/api/v1/scripts/parse', { content: OWN });
        expect({ who, status: res.status }).toEqual({ who, status: 200 });
        expect(res.body.success).toBe(true);
        expect(res.body.scenePlan.scenes).toHaveLength(2);
        expect(res.text.toLowerCase()).toContain(M.own.toLowerCase());
        const text = res.text.toLowerCase();
        for (const mark of EPISODE_MARKS) expect(text).not.toContain(mark.toLowerCase());
        for (const spy of watched) expect(spy).not.toHaveBeenCalled();
        jest.restoreAllMocks();
      }
    });
  });
});
