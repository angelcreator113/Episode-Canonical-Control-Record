/**
 * Approving an event's document or invitation (V2-1, Evoni 2026-11-19),
 * through the routes against real Postgres:
 *  - an admin's, whichever page the request comes from (the Event Package
 *    and the episode's Overlays tab call the same routes);
 *  - who approved and when are kept, with one audit entry written in the
 *    approval's own transaction;
 *  - a version that moved on is refused; of two approvals at once, one
 *    succeeds;
 *  - drawing the overlay is a separate step: a failure is recorded, leaves
 *    the approval as it is, and can be tried again without touching a
 *    newer version.
 * Editing, drafting and reading are open to whoever could before.
 */
jest.unmock('uuid');
// One of three files (approval, drawing, invitations): the app allows 60
// writes a minute from one address, and each file is its own app.

jest.mock('../../src/services/todoListService', () => ({
  ...jest.requireActual('../../src/services/todoListService'),
  generateTasks: jest.fn(async () => [{ slot: 'dress', label: 'Find a showstopper', description: '', required: true }]),
}));
// The real drawing, which a test can make fail once or hold back.
jest.mock('../../src/services/eventDocumentOverlayService', () => {
  const real = jest.requireActual('../../src/services/eventDocumentOverlayService');
  return { ...real, makeDocumentOverlay: jest.fn((...args) => real.makeDocumentOverlay(...args)) };
});

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const overlayService = require('../../src/services/eventDocumentOverlayService');

const { sequelize } = models;
const realOverlay = jest.requireActual('../../src/services/eventDocumentOverlayService');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("an approved document's overlay is drawn separately, and its failure is said", () => {
  const ADMIN_ID = 'test-admin-render';
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@approval.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token(ADMIN_ID, ['USER', 'ADMIN'], 'ADMIN');
    tokens.admin2 = token('test-admin-render-2', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-render', ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token('test-viewer-render', ['USER', 'VIEWER'], 'USER');
  });

  beforeEach(() => {
    overlayService.makeDocumentOverlay.mockReset();
    overlayService.makeDocumentOverlay.mockImplementation((...args) => realOverlay.makeDocumentOverlay(...args));
  });

  afterAll(async () => {
    for (const show of shows) {
      const events = '(SELECT id::text FROM world_events WHERE show_id = :show)';
      await run(`DELETE FROM activity_logs WHERE resource_type = 'world_event' AND resource_id IN ${events}`, { show }).catch((err) => console.error('cleanup activity_logs:', err.message));
      await run('DELETE FROM assets WHERE show_id = :show', { show }).catch((err) => console.error('cleanup assets:', err.message));
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Approval ${ids.show.slice(0, 8)}`, slug: `approval-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'invite', '{}'::jsonb, 'ready', NOW(), NOW())`, ids);
    return ids;
  }
  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}`;
  const as = (who, req) => req.set('Authorization', `Bearer ${tokens[who]}`);
  const approve = (ids, who, body = {}, type = 'shopping_list') => as(who, request(app).post(`${base(ids)}/documents/${type}/approve`)).send(body);
  const stored = async (ids, type = 'shopping_list') => {
    const [row] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    const cc = typeof row.canon_consequences === 'string' ? JSON.parse(row.canon_consequences) : row.canon_consequences;
    return cc?.documents?.[type] || null;
  };
  const audit = (ids, action = 'event_document_approved') => q(
    'SELECT user_id, action, resource_type, resource_id, changes FROM activity_logs WHERE resource_type = \'world_event\' AND resource_id = :event AND action = :action ORDER BY id',
    { ...ids, action });
  const overlays = (ids) => q('SELECT id, deleted_at FROM assets WHERE show_id = :show AND asset_type = \'DOCUMENT_OVERLAY\' ORDER BY created_at', ids);
  /** A drafted shopping list (version 1), written by an editor. */
  async function drafted() {
    const ids = await seed();
    const res = await as('editor', request(app).post(`${base(ids)}/documents/shopping_list/draft`)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'draft', version: 1 });
    return ids;
  }

  // ── Drawing is separate from approving ───────────────────────────────
  describe('documents: the overlay is drawn after the approval, and its failure is said', () => {
    it('the drawing fails: the approval stands, the failure is recorded with why, and nothing reads as ready', async () => {
      const ids = await drafted();
      overlayService.makeDocumentOverlay.mockRejectedValueOnce(new Error('storage refused the upload'));
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'approved', version: 1, approved_by: { id: ADMIN_ID }, overlay_render: { status: 'failed', version: 1, error: 'storage refused the upload' } });
      const doc = await stored(ids);
      expect(doc.status).toBe('approved');
      expect(doc.overlay).toBeNull();
      expect(realOverlay.overlayState(doc)).toBe('not_made');
      expect(await overlays(ids)).toEqual([]);
      expect(await audit(ids)).toHaveLength(1);
    });

    it('trying again draws it: the failure is replaced by the overlay, with no second approval', async () => {
      const ids = await drafted();
      overlayService.makeDocumentOverlay.mockRejectedValueOnce(new Error('storage refused the upload'));
      await approve(ids, 'admin', { version: 1, intent: 'approve' });
      const before = await stored(ids);
      const retry = await approve(ids, 'admin2', { version: 1, intent: 'render' });
      expect(retry.status).toBe(200);
      expect(retry.body.data).toMatchObject({ status: 'approved', version: 1, overlay: { version: 1 }, overlay_render: { status: 'ok', version: 1 } });
      const doc = await stored(ids);
      expect(doc.approved_by).toEqual({ id: ADMIN_ID });
      expect(doc.approved_at).toBe(before.approved_at);
      expect(doc.overlay_render.error).toBeUndefined();
      expect(await audit(ids)).toHaveLength(1);
      // And again, with the overlay now current: nothing more is drawn.
      const calls = overlayService.makeDocumentOverlay.mock.calls.length;
      expect((await approve(ids, 'admin', { version: 1, intent: 'render' })).status).toBe(200);
      expect(overlayService.makeDocumentOverlay).toHaveBeenCalledTimes(calls);
      expect((await overlays(ids)).filter((a) => !a.deleted_at)).toHaveLength(1);
    });

    it('where drawing is not available on the server, that is recorded as a failure, not left silent', async () => {
      const ids = await drafted();
      overlayService.makeDocumentOverlay.mockResolvedValueOnce(null);
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.body.data).toMatchObject({ status: 'approved', overlay_render: { status: 'failed', error: 'Drawing is not available on this server.' } });
    });

    it('a retry cannot touch a newer version: after an edit the old version is not drawn and the draft is not approved', async () => {
      const ids = await drafted();
      overlayService.makeDocumentOverlay.mockRejectedValueOnce(new Error('storage refused the upload'));
      await approve(ids, 'admin', { version: 1, intent: 'approve' });
      await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'Newer words' }] });
      const calls = overlayService.makeDocumentOverlay.mock.calls.length;
      // The retry still names version 1.
      expect((await approve(ids, 'admin', { version: 1, intent: 'render' })).status).toBe(409);
      // And one naming the new version cannot draw a draft.
      expect((await approve(ids, 'admin', { version: 2, intent: 'render' })).status).toBe(409);
      expect(overlayService.makeDocumentOverlay).toHaveBeenCalledTimes(calls);
      expect(await stored(ids)).toMatchObject({ status: 'draft', version: 2, items: [{ label: 'Newer words' }] });
    });

    it('a drawing that finishes after the document was edited is not written onto the newer version', async () => {
      const ids = await drafted();
      let finish;
      overlayService.makeDocumentOverlay.mockImplementationOnce(() => new Promise((resolve) => {
        finish = () => resolve({ asset_id: uuid(), url: 'https://x/late.png', version: 1, made_at: new Date().toISOString() });
      }));
      const pending = approve(ids, 'admin', { version: 1, intent: 'approve' }).then((r) => r);
      // The drawing is under way (claimed on the document) when the edit lands.
      for (let i = 0; i < 100 && !finish; i += 1) await new Promise((r) => { setTimeout(r, 20); });
      expect(typeof finish).toBe('function');
      expect((await stored(ids)).overlay_render).toMatchObject({ status: 'rendering', version: 1 });
      await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'Edited while drawing' }] });
      finish();
      expect((await pending).status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'draft', version: 2 });
      expect(doc.overlay).toBeNull();
      expect(doc.overlay_render).toBeUndefined();
    });

    it('a drawing that fails after the document was edited leaves no failure on the newer version', async () => {
      const ids = await drafted();
      let fail;
      overlayService.makeDocumentOverlay.mockImplementationOnce(() => new Promise((_resolve, reject) => {
        fail = () => reject(new Error('storage refused the upload'));
      }));
      const pending = approve(ids, 'admin', { version: 1, intent: 'approve' }).then((r) => r);
      for (let i = 0; i < 100 && !fail; i += 1) await new Promise((r) => { setTimeout(r, 20); });
      expect(typeof fail).toBe('function');
      await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'Edited while drawing' }] });
      fail();
      expect((await pending).status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'draft', version: 2 });
      expect(doc.overlay_render).toBeUndefined();
    });

    it('while one drawing is under way a second request draws nothing; a claim left by a crash is taken over after two minutes', async () => {
      const ids = await drafted();
      await approve(ids, 'admin', { version: 1, intent: 'approve' });
      const setRender = async (render) => {
        const doc = await stored(ids);
        await run(`UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{documents,shopping_list}', CAST(:doc AS jsonb)) WHERE id = :event`,
          { ...ids, doc: JSON.stringify({ ...doc, overlay: null, overlay_render: render }) });
      };
      // Another request claimed the drawing a moment ago.
      await setRender({ status: 'rendering', version: 1, started_at: new Date().toISOString() });
      const calls = overlayService.makeDocumentOverlay.mock.calls.length;
      const busy = await approve(ids, 'admin', { version: 1, intent: 'render' });
      expect(busy.status).toBe(200);
      expect(busy.body.data.overlay_render).toMatchObject({ status: 'rendering' });
      expect(overlayService.makeDocumentOverlay).toHaveBeenCalledTimes(calls);
      // The same claim, three minutes old: nobody is drawing any more.
      await setRender({ status: 'rendering', version: 1, started_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() });
      const taken = await approve(ids, 'admin', { version: 1, intent: 'render' });
      expect(taken.body.data).toMatchObject({ overlay: { version: 1 }, overlay_render: { status: 'ok' } });
      expect(overlayService.makeDocumentOverlay).toHaveBeenCalledTimes(calls + 1);
    });
  });
});
