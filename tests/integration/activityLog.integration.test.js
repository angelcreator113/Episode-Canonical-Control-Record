/**
 * activity_logs on the migrated database: the one writer, its readers, and
 * one entry per operation (issue #1948; Evoni, 2026-11-11).
 *
 *   writer   ActivityLog.logActivity persists a row that reads back, takes a
 *            UUID, throws when it cannot write, and commits or rolls back
 *            with the caller's transaction;
 *   logger   logger.logAction (what the controllers call) never fails the
 *            request and never records a view;
 *   readers  GET /api/v1/audit-logs (ADMIN) returns what was written;
 *   no duplicates  one episode update, delete or enqueue through the real
 *            routes leaves exactly one entry.
 *
 * The table is shared with other suites, so every test names its own user id
 * or resource id and counts only those rows. The migration's own shapes are in
 * activityLogsMigration.integration.test.js.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { logger } = require('../../src/middleware/auditLog');

const { sequelize, ActivityLog } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const select = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const entriesFor = (resourceId) => select(
  'SELECT user_id, action, resource_type, resource_id, changes, created_at FROM activity_logs WHERE resource_id = :resourceId ORDER BY id', { resourceId });

(shouldSkip ? describe.skip : describe)('activity_logs: one writer, its readers, one entry per operation (issue #1948)', () => {
  jest.setTimeout(60000);
  const USER = `test-audit-${process.pid}`;
  const shows = [];
  let admin;
  let editor;
  const as = (token, r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: `${USER}-admin`, email: 'admin@audit.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: USER, email: 'editor@audit.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM activity_logs WHERE user_id LIKE :mine', { mine: `${USER}%` });
    for (const show of shows) {
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seedEpisode() {
    const ids = { show: uuid(), ep: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Audit ${ids.show.slice(0, 8)}`, slug: `audit-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Before', 1, 'draft', NOW(), NOW())`, ids);
    return ids;
  }

  describe('the table is the one the migration chain converged', () => {
    it('has production\'s columns, a text resource_id and the resource index; no enum is left', async () => {
      const columns = await select(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'activity_logs' ORDER BY column_name`);
      expect(columns).toEqual([
        { column_name: 'action', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'changes', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: 'YES' },
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'resource_id', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'resource_type', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'user_id', data_type: 'character varying', is_nullable: 'YES' },
      ]);
      const indexes = (await select("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'activity_logs' ORDER BY 1")).map((r) => r.indexname);
      expect(indexes).toEqual(['activity_logs_pkey', 'activity_logs_resource']);
      expect(await select("SELECT typname FROM pg_type WHERE typname LIKE 'enum_activity_logs%'")).toEqual([]);
    });
  });

  describe('the writer: ActivityLog.logActivity', () => {
    it('persists one row that reads back, with a UUID resource id and the changes JSON', async () => {
      const id = uuid();
      const written = await ActivityLog.logActivity({
        userId: USER, action: 'EDIT', resourceType: 'Episode', resourceId: id,
        changes: { before: { title: 'Before' }, after: { title: 'After' }, meta: { changedFields: ['title'] } },
      });
      expect(written.id).toEqual(expect.any(Number));

      const rows = await entriesFor(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        user_id: USER, action: 'edit', resource_type: 'episode', resource_id: id,
        changes: { before: { title: 'Before' }, after: { title: 'After' }, meta: { changedFields: ['title'] } },
      });
      // Set by the database, close to now.
      const [{ age }] = await select('SELECT EXTRACT(EPOCH FROM (NOW() AT TIME ZONE \'UTC\' - created_at)) AS age FROM activity_logs WHERE id = :id', { id: written.id });
      expect(Math.abs(Number(age))).toBeLessThan(120);
      // Read back through the model too.
      const [fromModel] = await ActivityLog.getResourceHistory('episode', id);
      expect(fromModel.get({ plain: true })).toMatchObject({ userId: USER, action: 'edit', resourceType: 'episode', resourceId: id });
    });

    it('nobody signed in is NULL, never a placeholder', async () => {
      const id = uuid();
      await ActivityLog.logActivity({ userId: 'anonymous', action: 'create', resourceType: 'file', resourceId: id });
      await ActivityLog.logActivity({ action: 'delete', resourceType: 'file', resourceId: id });
      expect((await entriesFor(id)).map((r) => r.user_id)).toEqual([null, null]);
    });

    it('throws when it cannot write, and writes nothing', async () => {
      const id = uuid();
      await expect(ActivityLog.logActivity({ userId: USER, action: 'view', resourceType: 'episode', resourceId: id })).rejects.toThrow(/page views are not audited/);
      await expect(ActivityLog.logActivity({ userId: USER, resourceType: 'episode', resourceId: id })).rejects.toThrow(/action is required/);
      // The database refusing the row reaches the caller as it is.
      await expect(ActivityLog.logActivity({ userId: USER, action: 'x'.repeat(101), resourceType: 'episode', resourceId: id }))
        .rejects.toMatchObject({ original: { code: '22001' } });
      expect(await entriesFor(id)).toEqual([]);
    });

    it('inside a transaction the entry commits with the work, and rolls back with it', async () => {
      const kept = uuid();
      const undone = uuid();
      await sequelize.transaction(async (transaction) => {
        await ActivityLog.logActivity({ userId: USER, action: 'edit', resourceType: 'season_slot', resourceId: kept, changes: { meta: { step: 1 } } }, { transaction });
      });
      await expect(sequelize.transaction(async (transaction) => {
        await ActivityLog.logActivity({ userId: USER, action: 'edit', resourceType: 'season_slot', resourceId: undone }, { transaction });
        // Visible inside the transaction, gone when it fails.
        const [inside] = await sequelize.query('SELECT COUNT(*)::int AS n FROM activity_logs WHERE resource_id = :id', { replacements: { id: undone }, transaction, type: sequelize.QueryTypes.SELECT });
        expect(inside.n).toBe(1);
        throw new Error('the work failed');
      })).rejects.toThrow('the work failed');
      expect(await entriesFor(kept)).toHaveLength(1);
      expect(await entriesFor(undone)).toEqual([]);
    });

    it('an audit failure inside a transaction fails the transaction: the work is not kept without its entry', async () => {
      const { ep } = await seedEpisode();
      await expect(sequelize.transaction(async (transaction) => {
        await sequelize.query("UPDATE episodes SET title = 'Changed without an entry' WHERE id = :ep", { replacements: { ep }, transaction });
        await ActivityLog.logActivity({ userId: USER, action: 'x'.repeat(101), resourceType: 'episode', resourceId: ep }, { transaction });
      })).rejects.toBeTruthy();
      expect((await select('SELECT title FROM episodes WHERE id = :ep', { ep }))[0].title).toBe('Before');
      expect(await entriesFor(ep)).toEqual([]);
    });
  });

  describe('the controllers\' call: logger.logAction', () => {
    it('writes one row; the IP address and user agent it is handed are not stored', async () => {
      const id = uuid();
      await logger.logAction(USER, 'delete', 'metadata', id, { oldValues: { tags: ['a'] }, ipAddress: '203.0.113.9', userAgent: 'Mozilla/5.0', reason: 'cleanup' });
      const rows = await entriesFor(id);
      expect(rows).toHaveLength(1);
      expect(rows[0].changes).toEqual({ before: { tags: ['a'] }, meta: { reason: 'cleanup' } });
      expect(JSON.stringify(rows[0])).not.toMatch(/203\.0\.113\.9|Mozilla/);
    });

    it('a view writes nothing; a failed write is reported and resolves to null', async () => {
      const id = uuid();
      await expect(logger.logAction(USER, 'view', 'episode', id, { episodeTitle: 'x' })).resolves.toBeNull();
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(logger.logAction(USER, 'y'.repeat(101), 'episode', id)).resolves.toBeNull();
      expect(error.mock.calls[0].join(' ')).toMatch(/\[audit\] NOT RECORDED/);
      expect(await entriesFor(id)).toEqual([]);
    });
  });

  describe('one entry per operation, through the real routes', () => {
    it('updating an episode leaves exactly one entry, with before and after', async () => {
      const { ep } = await seedEpisode();
      const res = await as(editor, request(app).put(`/api/v1/episodes/${ep}`)).send({ title: 'After' });
      expect(res.status).toBe(200);

      const rows = await entriesFor(ep);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ user_id: USER, action: 'edit', resource_type: 'episode', resource_id: ep });
      // Only what changed, with its before and after value (Evoni, 2026-11-11).
      expect(rows[0].changes).toEqual({ before: { title: 'Before' }, after: { title: 'After' }, meta: { changedFields: ['title'] } });

      // A second update is a second operation: two entries, not four or six.
      await as(editor, request(app).put(`/api/v1/episodes/${ep}`)).send({ title: 'After again' });
      expect(await entriesFor(ep)).toHaveLength(2);
    });

    it('an unrelated edit does not copy the script into the entry; a script edit is recorded by length and SHA-256', async () => {
      const { ep } = await seedEpisode();
      const script = 'INT. STUDIO - DAY\nLALA\nWe begin.\n'.repeat(120);
      await run('UPDATE episodes SET script_content = :script, description = :description WHERE id = :ep', { ep, script, description: 'An unchanged description.' });

      // 1. The title changes; the script and the description do not.
      expect((await as(editor, request(app).put(`/api/v1/episodes/${ep}`)).send({ title: 'Retitled' })).status).toBe(200);
      let rows = await entriesFor(ep);
      expect(rows).toHaveLength(1);
      expect(rows[0].changes).toEqual({ before: { title: 'Before' }, after: { title: 'Retitled' }, meta: { changedFields: ['title'] } });
      expect(JSON.stringify(rows[0].changes)).not.toMatch(/INT\. STUDIO|script_content|An unchanged description/);

      // 2. The script changes: named, with length and digest on both sides, its words in neither.
      const edited = `${script}A NEW CLOSING LINE.\n`;
      // (A script save names the revision it was written against; reading the episode gives it, and is not audited.)
      const page = await as(editor, request(app).get(`/api/v1/episodes/${ep}`));
      const saved200 = await as(editor, request(app).put(`/api/v1/episodes/${ep}`)).send({ script_content: edited, script_revision: page.body.script_revision });
      expect(saved200.status).toBe(200);
      rows = await entriesFor(ep);
      expect(rows).toHaveLength(2);
      const { before, after, meta } = rows[1].changes;
      expect(meta.changedFields).toContain('script_content');
      expect(meta.changedFields).not.toContain('title');
      const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
      expect(before.script_content).toEqual({ long_text: true, length: script.length, sha256: sha(script) });
      expect(after.script_content).toMatchObject({ long_text: true, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
      expect(after.script_content.sha256).not.toBe(before.script_content.sha256);
      // The digest is of what was actually saved.
      const [{ script_content: saved }] = await select('SELECT script_content FROM episodes WHERE id = :ep', { ep });
      expect(after.script_content).toEqual({ long_text: true, length: saved.length, sha256: sha(saved) });
      expect(JSON.stringify(rows[1].changes)).not.toMatch(/INT\. STUDIO|A NEW CLOSING LINE/);
      // The whole entry is small.
      expect(JSON.stringify(rows[1].changes).length).toBeLessThan(2000);
    });

    it('reading an episode or the episode list leaves no entry', async () => {
      const { ep, show } = await seedEpisode();
      expect((await as(editor, request(app).get(`/api/v1/episodes/${ep}`))).status).toBe(200);
      expect((await as(editor, request(app).get(`/api/v1/episodes?show_id=${show}`))).status).toBe(200);
      expect(await entriesFor(ep)).toEqual([]);
      expect(await select("SELECT 1 FROM activity_logs WHERE action = 'view'")).toEqual([]);
    });

    it('deleting an episode leaves exactly one entry', async () => {
      const { ep } = await seedEpisode();
      const res = await as(admin, request(app).delete(`/api/v1/episodes/${ep}`));
      expect(res.status).toBe(200);
      const rows = await entriesFor(ep);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ user_id: `${USER}-admin`, action: 'delete', resource_type: 'episode' });
      expect(rows[0].changes.before.title).toBe('Before');
      expect(rows[0].changes.meta.deleteType).toBe('soft');
    });

    // Evoni, 2026-11-11: creation and deletion record identifying and
    // operational metadata, not the complete row or the script.
    const SUMMARY_KEYS = ['air_date', 'categories', 'episode_number', 'has_script', 'id', 'script_length', 'season_number', 'show_id', 'status', 'title'];

    it('creating an episode records its summary: not the row, never the script', async () => {
      const { show } = await seedEpisode();
      const script = 'INT. STUDIO - DAY\nLALA\nA created script.\n'.repeat(100);
      const res = await as(editor, request(app).post('/api/v1/episodes'))
        .send({ show_id: show, title: 'Created', episode_number: 7, description: 'A PRIVATE DESCRIPTION', script_content: script });
      expect(res.status).toBe(201);
      const id = res.body.data.id;
      // The entry is written without holding the response: wait for it.
      let rows = [];
      for (let i = 0; i < 50 && !rows.length; i += 1) {
        rows = await entriesFor(id);
        if (!rows.length) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ user_id: USER, action: 'create', resource_type: 'episode', resource_id: id });
      expect(Object.keys(rows[0].changes)).toEqual(['after']);
      expect(Object.keys(rows[0].changes.after).sort()).toEqual(SUMMARY_KEYS);
      expect(rows[0].changes.after).toMatchObject({ id, show_id: show, title: 'Created', episode_number: 7, status: 'draft' });
      const [{ script_content: stored }] = await select('SELECT script_content FROM episodes WHERE id = :id', { id });
      expect(rows[0].changes.after.has_script).toBe(Boolean(stored && stored.trim()));
      expect(rows[0].changes.after.script_length).toBe((stored || '').length);
      expect(JSON.stringify(rows[0].changes)).not.toMatch(/INT\. STUDIO|A created script|PRIVATE DESCRIPTION/);
    });

    it('deleting an episode records its summary and what kind of delete it was: not the row, never the script', async () => {
      const { ep } = await seedEpisode();
      const script = 'INT. STUDIO - DAY\nLALA\nA deleted script.\n'.repeat(100);
      await run('UPDATE episodes SET script_content = :script, description = :description WHERE id = :ep', { ep, script, description: 'A PRIVATE DESCRIPTION' });
      expect((await as(admin, request(app).delete(`/api/v1/episodes/${ep}`))).status).toBe(200);

      const rows = await entriesFor(ep);
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0].changes).sort()).toEqual(['before', 'meta']);
      expect(Object.keys(rows[0].changes.before).sort()).toEqual(SUMMARY_KEYS);
      expect(rows[0].changes.before).toMatchObject({ id: ep, title: 'Before', episode_number: 1, status: 'draft', has_script: true, script_length: script.length });
      expect(rows[0].changes.meta).toEqual({ deleteType: 'soft' });
      expect(JSON.stringify(rows[0].changes)).not.toMatch(/INT\. STUDIO|A deleted script|PRIVATE DESCRIPTION/);
      expect(JSON.stringify(rows[0].changes).length).toBeLessThan(600);
      // What a soft delete leaves: the row, with its script, marked deleted.
      const [kept] = await select('SELECT deleted_at, script_content FROM episodes WHERE id = :ep', { ep });
      expect(kept.deleted_at).not.toBeNull();
      expect(kept.script_content).toBe(script);
    });

    it('a refused delete (a filmed episode) and a delete of nothing leave no entry', async () => {
      const { ep, show } = await seedEpisode();
      const clip = uuid();
      await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                 VALUES (:clip, :ep, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`, { clip, ep, show, key: `episodes/${ep}/raw-clips/x/original.mp4` });
      try {
        const refused = await as(admin, request(app).delete(`/api/v1/episodes/${ep}`));
        expect(refused.status).toBe(409);
        expect(await entriesFor(ep)).toEqual([]);
        const [still] = await select('SELECT deleted_at FROM episodes WHERE id = :ep', { ep });
        expect(still.deleted_at).toBeNull();
      } finally {
        await run('DELETE FROM episode_raw_clips WHERE id = :clip', { clip });
      }

      const nothing = uuid();
      expect((await as(admin, request(app).delete(`/api/v1/episodes/${nothing}`))).status).toBe(404);
      expect(await entriesFor(nothing)).toEqual([]);
    });

    it('a delete that fails in the database leaves no entry and the episode as it was', async () => {
      const { ep } = await seedEpisode();
      const failing = jest.spyOn(models.Episode.prototype, 'softDelete').mockRejectedValue(new Error('connection lost'));
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await as(admin, request(app).delete(`/api/v1/episodes/${ep}`));
      expect(failing).toHaveBeenCalled();
      expect(res.status).toBe(500);
      expect(await entriesFor(ep)).toEqual([]);
      const [still] = await select('SELECT deleted_at FROM episodes WHERE id = :ep', { ep });
      expect(still.deleted_at).toBeNull();
    });
  });

  describe('the readers: GET /api/v1/audit-logs (ADMIN only)', () => {
    it('refuses a visitor and a non-admin', async () => {
      expect((await request(app).get('/api/v1/audit-logs')).status).toBe(401);
      expect((await as(editor, request(app).get('/api/v1/audit-logs'))).status).toBe(403);
    });

    it('returns what was written, newest first, filtered by resource, action and user', async () => {
      const id = uuid();
      await ActivityLog.logActivity({ userId: USER, action: 'create', resourceType: 'job', resourceId: id, changes: { meta: { n: 1 } } });
      await ActivityLog.logActivity({ userId: USER, action: 'retry', resourceType: 'job', resourceId: id, changes: { meta: { n: 2 } } });

      const all = await as(admin, request(app).get(`/api/v1/audit-logs?resourceType=job&resourceId=${id}`));
      expect(all.status).toBe(200);
      expect(all.body.pagination.total).toBe(2);
      expect(all.body.data.map((e) => e.action)).toEqual(['retry', 'create']);
      expect(all.body.data[0]).toMatchObject({ userId: USER, resourceType: 'job', resourceId: id, changes: { meta: { n: 2 } } });
      expect(all.body.data[0].createdAt).toBeTruthy();
      // The names the Audit Log page (/admin/audit) reads, and the filters it sends.
      expect(all.body.data[0]).toMatchObject({ actionType: 'retry', timestamp: all.body.data[0].createdAt });
      const page = await as(admin, request(app).get(`/api/v1/audit-logs?action=create&resource=job&userId=${USER}&resourceId=${id}`));
      expect(page.body.data.map((e) => e.actionType)).toEqual(['create']);

      const retries = await as(admin, request(app).get(`/api/v1/audit-logs?resourceId=${id}&actionType=RETRY`));
      expect(retries.body.data.map((e) => e.action)).toEqual(['retry']);

      const mine = await as(admin, request(app).get(`/api/v1/audit-logs/user/${USER}?limit=500`));
      expect(mine.status).toBe(200);
      expect(mine.body.data.filter((e) => e.resourceId === id)).toHaveLength(2);

      const stats = await as(admin, request(app).get('/api/v1/audit-logs/stats'));
      expect(stats.status).toBe(200);
      expect(stats.body.data.byAction.some((r) => r.action === 'retry' && Number(r.count) >= 1)).toBe(true);
      expect(stats.body.data.byResource.some((r) => r.resourceType === 'job')).toBe(true);
      expect(stats.body.data.byUser.some((r) => r.userId === USER)).toBe(true);
    });
  });
});
