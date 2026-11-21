/**
 * An approved document's presentations and the overlay they stand beside
 * (V2-2a-2, Evoni 2026-11-20), through the routes against real Postgres,
 * with the object storage stood in for in memory.
 *
 * Here: the check against the canonical overlay (what it was drawn from
 * changing; an overlay from before its hash was kept; one that cannot be
 * read), the recovery that redraws it on purpose, each presentation's own
 * readiness, a removed panel coming back as itself, a making that fails
 * leaving the approval and the overlay alone, and the V2-2a-1 protections
 * on the rows this makes. Making, retrying and storage are in
 * eventDocumentPresentations.integration.test.js.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = 'test-presentations';

jest.mock('@aws-sdk/client-s3', () => require('../helpers/objectStorageDouble').module());
jest.mock('../../src/services/todoListService', () => ({
  ...jest.requireActual('../../src/services/todoListService'),
  generateTasks: jest.fn(async () => [{ slot: 'dress', label: 'Find a showstopper', description: '', required: true }]),
}));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const overlays = require('../../src/services/eventDocumentOverlayService');
const storage = require('@aws-sdk/client-s3').__storage;

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the presentations and the overlay they stand beside', () => {
  const ADMIN_ID = 'test-admin-present-state';
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@present.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token(ADMIN_ID, ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-present-state', ['USER', 'EDITOR'], 'USER');
  });

  afterEach(() => { jest.restoreAllMocks(); });

  afterAll(async () => {
    for (const show of shows) {
      const events = '(SELECT id::text FROM world_events WHERE show_id = :show)';
      await run(`DELETE FROM activity_logs WHERE resource_type = 'world_event' AND resource_id IN ${events}`, { show }).catch((err) => console.error('cleanup activity_logs:', err.message));
      await run('DELETE FROM assets WHERE show_id = :show', { show }).catch((err) => console.error('cleanup assets:', err.message));
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}`;
  const as = (who, req) => req.set('Authorization', `Bearer ${tokens[who]}`);
  const approve = (ids, who, body = {}) => as(who, request(app).post(`${base(ids)}/documents/shopping_list/approve`)).send(body);
  const present = (ids, body = {}) => approve(ids, 'admin', { intent: 'present', version: 1, ...body });
  const stored = async (ids) => {
    const [row] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    const cc = typeof row.canon_consequences === 'string' ? JSON.parse(row.canon_consequences) : row.canon_consequences;
    return cc?.documents?.shopping_list || null;
  };
  const setStored = (ids, change) => stored(ids).then((doc) => run(
    `UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{documents,shopping_list}', CAST(:doc AS jsonb)) WHERE id = :event`,
    { ...ids, doc: JSON.stringify(change(doc)) }));
  const panels = (ids) => q(
    `SELECT id, deleted_at, metadata->'document_presentation' AS about FROM assets
      WHERE show_id = :show AND asset_type = 'DOCUMENT_PRESENTATION' ORDER BY metadata->'document_presentation'->>'presentation', (metadata->'document_presentation'->>'panel_index')::int, created_at`, ids);
  const canonical = (ids) => q(`SELECT id, s3_url_processed AS url, deleted_at FROM assets WHERE show_id = :show AND asset_type = 'DOCUMENT_OVERLAY' ORDER BY created_at`, ids);
  const readiness = async (ids) => (await as('editor', request(app).get(`${base(ids)}/documents`))).body.data.presentation_readiness.shopping_list;
  const audit = (ids, action) => q(
    `SELECT user_id, changes FROM activity_logs WHERE resource_type = 'world_event' AND resource_id = :event AND action = :action ORDER BY id`, { ...ids, action });
  /** Everything a making must leave alone: the approval, the overlay, its row and its file. */
  const standing = async (ids) => {
    const doc = await stored(ids);
    const rows = await canonical(ids);
    return {
      status: doc.status, version: doc.version, approved_at: doc.approved_at, approved_by: doc.approved_by, overlay: doc.overlay, overlay_render: doc.overlay_render,
      rows, files: rows.map((r) => (storage.objects.get(storage.keyOf(r.url)) || Buffer.alloc(0)).toString('base64').length),
    };
  };
  async function approved() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Present ${ids.show.slice(0, 8)}`, slug: `present-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'invite', '{}'::jsonb, 'ready', NOW(), NOW())`, ids);
    expect((await as('editor', request(app).post(`${base(ids)}/documents/shopping_list/draft`)).send({})).status).toBe(200);
    expect((await approve(ids, 'admin', { version: 1, intent: 'approve' })).status).toBe(200);
    expect((await stored(ids)).presentations).toMatchObject({ floating: { status: 'ok' }, reading: { status: 'ok' } });
    return ids;
  }
  /** What the page is drawn from changes after the overlay was drawn (the event is renamed; the page prints its name). */
  const rename = (ids) => run(`UPDATE world_events SET name = 'Studio Session, moved to Friday' WHERE id = :event`, ids);

  describe('the overlay must be the page as it draws now', () => {
    it('what it is drawn from changed since: nothing is made, the reason is said, and the overlay is not drawn again', async () => {
      const ids = await approved();
      await rename(ids);
      const before = { standing: await standing(ids), panels: await panels(ids), kept: (await stored(ids)).presentations };
      const draw = jest.spyOn(overlays, 'makeDocumentOverlay');
      const made = jest.spyOn(overlays, 'drawPresentations');
      const res = await present(ids);
      expect(res.status).toBe(200);
      expect(res.body.data.presentation_render).toMatchObject({ status: 'mismatch', code: 'CANONICAL_INPUTS_CHANGED' });
      expect(res.body.data.presentation_render.message).toMatch(/Redraw the overlay/);
      expect(draw).not.toHaveBeenCalled();
      expect(made).not.toHaveBeenCalled();
      expect(await standing(ids)).toEqual(before.standing);
      expect(await panels(ids)).toEqual(before.panels);
      expect((await stored(ids)).presentations).toEqual(before.kept);
    });

    it('an overlay from before its hash was kept is read from storage and checked: when it is the page as it draws, they are made', async () => {
      const ids = await approved();
      const ready = (await panels(ids)).map((r) => r.id);
      await setStored(ids, (doc) => { const overlay = { ...doc.overlay }; delete overlay.content_sha256; return { ...doc, overlay, presentations: undefined, presentation_render: undefined }; });
      await run(`DELETE FROM assets WHERE show_id = :show AND asset_type = 'DOCUMENT_PRESENTATION'`, ids);
      const reads = storage.log.length;
      const res = await present(ids);
      expect(res.body.data.presentation_render).toMatchObject({ status: 'done' });
      const doc = await stored(ids);
      expect(doc.overlay.content_sha256).toBeUndefined();
      expect(doc.presentations.canonical_sha256).toMatch(/^[0-9a-f]{64}$/);
      // The same overlay and the same page: the same panels as before, by their ids.
      expect((await panels(ids)).map((r) => r.id).sort()).toEqual(ready.sort());
      const [overlay] = await canonical(ids);
      expect(storage.log.slice(reads).some((e) => e.op === 'read' && e.key === storage.keyOf(overlay.url))).toBe(true);
    });

    it('such an overlay that is not the page as it draws now, or cannot be read: nothing is made, and each is said', async () => {
      const ids = await approved();
      await setStored(ids, (doc) => { const overlay = { ...doc.overlay }; delete overlay.content_sha256; return { ...doc, overlay }; });
      await rename(ids);
      const before = await standing(ids);
      const made = jest.spyOn(overlays, 'drawPresentations');
      expect((await present(ids)).body.data.presentation_render).toMatchObject({ status: 'mismatch', code: 'CANONICAL_NOT_REPRODUCIBLE' });
      const [overlay] = await canonical(ids);
      const key = storage.keyOf(overlay.url);
      const file = storage.objects.get(key);
      storage.objects.delete(key);
      expect((await present(ids)).body.data.presentation_render).toMatchObject({ status: 'mismatch', code: 'CANONICAL_UNREADABLE' });
      storage.objects.set(key, file);
      expect(made).not.toHaveBeenCalled();
      expect(await standing(ids)).toEqual(before);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true }, reading: { ready: true } });
    });

    it('an overlay that was never drawn: nothing is made', async () => {
      const ids = await approved();
      await setStored(ids, (doc) => ({ ...doc, overlay: null, presentations: undefined }));
      expect((await present(ids)).body.data.presentation_render).toMatchObject({ status: 'mismatch', code: 'CANONICAL_NOT_DRAWN' });
      expect(await readiness(ids)).toMatchObject({ floating: { ready: false, state: 'mismatch', code: 'CANONICAL_NOT_DRAWN' }, reading: { ready: false, state: 'mismatch' } });
    });
  });

  describe('redrawing the overlay on purpose (the recovery)', () => {
    const redraw = (ids, who, body) => approve(ids, who, { intent: 'redraw_canonical', ...body });

    it('needs an admin, confirm: true, the version and the overlay it replaces; without each nothing happens', async () => {
      const ids = await approved();
      await rename(ids);
      const doc = await stored(ids);
      const before = { standing: await standing(ids), panels: await panels(ids) };
      const ok = { confirm: true, version: 1, expected_canonical_asset_id: doc.overlay.asset_id };
      expect((await redraw(ids, 'editor', ok)).status).toBe(403);
      expect((await redraw(ids, 'admin', { ...ok, confirm: undefined })).status).toBe(400);
      expect((await redraw(ids, 'admin', { ...ok, confirm: 'true' })).status).toBe(400);
      expect((await redraw(ids, 'admin', { ...ok, version: undefined })).status).toBe(400);
      expect((await redraw(ids, 'admin', { confirm: true, version: 1 })).status).toBe(400);
      expect((await redraw(ids, 'admin', { ...ok, expected_canonical_asset_id: 7 })).status).toBe(400);
      expect((await redraw(ids, 'admin', { ...ok, version: 2 })).status).toBe(409);
      expect((await redraw(ids, 'admin', { ...ok, expected_canonical_asset_id: uuid() })).status).toBe(409);
      expect((await redraw(ids, 'admin', { ...ok, expected_canonical_asset_id: null })).status).toBe(409);
      expect(await standing(ids)).toEqual(before.standing);
      expect(await panels(ids)).toEqual(before.panels);
      expect(await audit(ids, 'event_document_canonical_redrawn')).toEqual([]);
    });

    it('redraws it, records who and what it replaced, keeps the earlier overlay, and makes the presentations beside the new one', async () => {
      const ids = await approved();
      await rename(ids);
      expect((await present(ids)).body.data.presentation_render.status).toBe('mismatch');
      const was = await stored(ids);
      const oldPanels = await panels(ids);
      const [oldOverlay] = await canonical(ids);
      const oldFile = Buffer.from(storage.objects.get(storage.keyOf(oldOverlay.url)));

      const res = await redraw(ids, 'admin', { confirm: true, version: 1, expected_canonical_asset_id: was.overlay.asset_id });
      expect(res.status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', version: 1, approved_at: was.approved_at, approved_by: was.approved_by, overlay_render: { status: 'ok' }, presentation_render: { status: 'done' } });
      expect(doc.overlay.asset_id).not.toBe(was.overlay.asset_id);
      expect(doc.overlay.content_sha256).not.toBe(was.overlay.content_sha256);
      // Who, and what it replaced, in the audit log.
      const entries = await audit(ids, 'event_document_canonical_redrawn');
      expect(entries).toHaveLength(1);
      expect(entries[0].user_id).toBe(ADMIN_ID);
      expect(JSON.stringify(entries[0].changes)).toContain(was.overlay.asset_id);
      // The earlier overlay: its row is kept (set aside, as every redraw does) and its file is as it was.
      const rows = await canonical(ids);
      expect(rows.map((r) => [r.id, r.deleted_at === null])).toEqual([[was.overlay.asset_id, false], [doc.overlay.asset_id, true]]);
      expect(storage.objects.get(storage.keyOf(oldOverlay.url)).equals(oldFile)).toBe(true);
      // New presentations beside the new overlay; the earlier ones kept, marked as replaced.
      const now = await panels(ids);
      const current = now.filter((r) => r.about.canonical_asset_id === doc.overlay.asset_id);
      const earlier = now.filter((r) => r.about.canonical_asset_id === was.overlay.asset_id);
      expect(earlier.map((r) => r.id).sort()).toEqual(oldPanels.map((r) => r.id).sort());
      expect(earlier.every((r) => r.deleted_at === null && r.about.superseded_at && r.about.superseded_by_set)).toBe(true);
      expect(current.length).toBe(doc.presentations.floating.panel_count + doc.presentations.reading.panel_count);
      expect(current.every((r) => r.deleted_at === null && !r.about.superseded_at)).toBe(true);
      expect(doc.presentations.canonical_asset_id).toBe(doc.overlay.asset_id);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true }, reading: { ready: true } });
      // Every earlier panel's file is still there too.
      for (const row of oldPanels) expect(storage.objects.has(row.about.storage_key)).toBe(true);
    });
  });

  describe('each presentation is ready, or not, on its own', () => {
    it('a reading panel removed: reading is not ready and floating still is; making them again brings that panel back as itself', async () => {
      const ids = await approved();
      const all = await panels(ids);
      const gone = all.find((r) => r.about.presentation === 'reading');
      await run('UPDATE assets SET deleted_at = NOW() WHERE id = :id', { id: gone.id });
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true, state: 'ready' }, reading: { ready: false, state: 'incomplete', missing: 1 } });
      const files = storage.objects.size;
      expect((await present(ids)).body.data.presentation_render.status).toBe('done');
      const after = await panels(ids);
      expect(after.map((r) => r.id)).toEqual(all.map((r) => r.id));
      expect(after.every((r) => r.deleted_at === null)).toBe(true);
      expect(storage.objects.size).toBe(files);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true }, reading: { ready: true } });
    });

    it('a floating panel removed leaves reading ready', async () => {
      const ids = await approved();
      const floating = (await panels(ids)).find((r) => r.about.presentation === 'floating');
      await run('UPDATE assets SET deleted_at = NOW() WHERE id = :id', { id: floating.id });
      expect(await readiness(ids)).toMatchObject({ floating: { ready: false, state: 'incomplete', missing: 1 }, reading: { ready: true, state: 'ready' } });
    });

    it('reading that cannot be kept whole or cannot be read is not published; floating is, with a warning when its text is small', async () => {
      const ids = await approved();
      await run(`DELETE FROM assets WHERE show_id = :show AND asset_type = 'DOCUMENT_PRESENTATION'`, ids);
      const real = overlays.presentDocument;
      // The drawing as it is, but with the reading set unreadably small and the floating page small too.
      jest.spyOn(overlays, 'drawPresentations').mockImplementation((type, data) => ['floating', 'reading'].map((presentation) => {
        const drawn = real(type, data, { presentation });
        if (presentation === 'reading') return { presentation, ok: false, code: 'READING_NOT_READABLE', message: 'The reading panels would be 19 px on screen.' };
        return { presentation, ok: true, readable: false, body_px_on_screen: 19, past_page: 0, panels: drawn.panels.map((p) => ({ index: p.index, count: p.of, buffer: p.buffer, sha256: overlays.sha256(p.buffer), rect: p.rect, source: p.source })) };
      }));
      const res = await present(ids);
      expect(res.body.data.presentation_render.status).toBe('done');
      const doc = await stored(ids);
      expect(doc.presentations.reading).toMatchObject({ status: 'failed', code: 'READING_NOT_READABLE' });
      expect(doc.presentations.floating).toMatchObject({ status: 'ok', readable: false, warning: 'TEXT_SMALL' });
      expect((await panels(ids)).map((r) => r.about.presentation)).toEqual(['floating']);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true, state: 'ready', warning: 'TEXT_SMALL' }, reading: { ready: false, state: 'failed', code: 'READING_NOT_READABLE' } });
    });

    it('published for another version, another overlay or another revision reads as stale, not ready', async () => {
      const ids = await approved();
      await setStored(ids, (doc) => ({ ...doc, presentations: { ...doc.presentations, revision: doc.presentations.revision + 1 } }));
      expect(await readiness(ids)).toMatchObject({ floating: { ready: false, state: 'stale' }, reading: { ready: false, state: 'stale' } });
      await setStored(ids, (doc) => ({ ...doc, presentations: { ...doc.presentations, revision: doc.presentations.revision - 1, canonical_asset_id: uuid() } }));
      expect(await readiness(ids)).toMatchObject({ floating: { ready: false, state: 'stale' }, reading: { ready: false, state: 'stale' } });
    });
  });

  describe('a making that fails', () => {
    it('leaves the approval and the overlay exactly as they were, and says it failed', async () => {
      const ids = await approved();
      const before = await standing(ids);
      jest.spyOn(overlays, 'drawPresentations').mockImplementation(() => { throw new Error('the drawing fell over'); });
      const res = await present(ids);
      expect(res.status).toBe(200);
      expect(res.body.data.presentation_render).toMatchObject({ status: 'failed', code: 'PRESENTATION_FAILED', message: 'the drawing fell over' });
      expect(await standing(ids)).toEqual(before);
    });

    it('at approval: the document is approved and its overlay drawn all the same', async () => {
      const ids = { show: uuid(), event: uuid() };
      shows.push(ids.show);
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Present ${ids.show.slice(0, 8)}`, slug: `present-${ids.show.slice(0, 8)}` });
      await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at) VALUES (:event, :show, 'Studio Session', 'invite', '{}'::jsonb, 'ready', NOW(), NOW())`, ids);
      await as('editor', request(app).post(`${base(ids)}/documents/shopping_list/draft`)).send({});
      jest.spyOn(overlays, 'storePresentationPanel').mockRejectedValue(new Error('the network went away'));
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', overlay_render: { status: 'ok' }, presentation_render: { status: 'failed', code: 'PRESENTATION_FAILED' } });
      expect(doc.overlay.asset_id).toBeTruthy();
      expect(await audit(ids, 'event_document_approved')).toHaveLength(1);
      expect(await panels(ids)).toEqual([]);
    });
  });

  describe('the rows this makes are kept as V2-2a-1 says', () => {
    it('they cannot be deleted or changed through the asset API, are in no default list, and a canonical overlay is listed as before', async () => {
      const ids = await approved();
      const [panel] = await panels(ids);
      const doc = await stored(ids);
      expect((await as('editor', request(app).delete(`/api/v1/assets/${panel.id}`))).status).toBe(409);
      expect((await as('editor', request(app).put(`/api/v1/assets/${panel.id}`)).send({ name: 'Mine now' })).status).toBe(409);
      expect((await as('admin', request(app).post('/api/v1/assets/bulk/delete')).send({ assetIds: [panel.id] })).status).toBe(409);
      expect((await request(app).get(`/api/v1/assets/${panel.id}`)).status).toBe(404);
      const listed = (await request(app).get('/api/v1/assets').query({ show_id: ids.show, limit: 500 })).body.data.map((a) => a.id);
      expect(listed).toContain(doc.overlay.asset_id);
      for (const row of await panels(ids)) expect(listed).not.toContain(row.id);
      expect((await panels(ids)).every((r) => r.deleted_at === null)).toBe(true);
    });
  });
});
