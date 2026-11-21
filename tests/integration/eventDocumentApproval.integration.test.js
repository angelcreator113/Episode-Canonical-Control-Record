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

(shouldSkip ? describe.skip : describe)("approving a document is an admin's, recorded, and one at a time", () => {
  const ADMIN_ID = 'test-admin-approval';
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@approval.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token(ADMIN_ID, ['USER', 'ADMIN'], 'ADMIN');
    tokens.admin2 = token('test-admin-approval-2', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-approval', ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token('test-viewer-approval', ['USER', 'VIEWER'], 'USER');
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

  // ── Who may approve ──────────────────────────────────────────────────
  describe('documents: only an admin approves', () => {
    it.each([['editor'], ['viewer']])('a signed-in %s is refused (403) on a direct call, and nothing is approved, drawn or recorded', async (who) => {
      const ids = await drafted();
      for (const body of [{}, { version: 1 }, { version: 1, intent: 'approve' }, { intent: 'render' }]) {
        const res = await approve(ids, who, body);
        expect(res.status).toBe(403);
      }
      expect(await stored(ids)).toMatchObject({ status: 'draft', version: 1, approved_at: null });
      expect((await stored(ids)).approved_by).toBeUndefined();
      expect(overlayService.makeDocumentOverlay).not.toHaveBeenCalled();
      expect(await overlays(ids)).toEqual([]);
      expect(await audit(ids)).toEqual([]);
    });

    it('no token at all is refused (401)', async () => {
      const ids = await drafted();
      expect((await request(app).post(`${base(ids)}/documents/shopping_list/approve`).send({})).status).toBe(401);
      expect(await stored(ids)).toMatchObject({ status: 'draft' });
    });

    it('an editor still reads, edits and drafts as before; only approving changed', async () => {
      const ids = await drafted();
      expect((await as('editor', request(app).get(`${base(ids)}/documents`))).status).toBe(200);
      const edited = await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'A red gown' }] });
      expect(edited.status).toBe(200);
      expect(edited.body.data).toMatchObject({ status: 'draft', version: 2 });
      expect((await as('editor', request(app).post(`${base(ids)}/documents/shopping_list/restore`)).send({ fromVersion: 1 })).status).toBe(200);
    });
  });

  // ── What an approval records ────────────────────────────────────────
  describe('documents: an approval says who and when, with one audit entry', () => {
    it('an admin approves: status, time and approver on the document, and one entry naming the event, the document and its version', async () => {
      const ids = await drafted();
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'approved', version: 1, approved_by: { id: ADMIN_ID } });
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', version: 1, approved_by: { id: ADMIN_ID } });
      expect(Number.isNaN(Date.parse(doc.approved_at))).toBe(false);
      const entries = await audit(ids);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: ADMIN_ID, action: 'event_document_approved', resource_type: 'world_event', resource_id: ids.event });
      expect(entries[0].changes.meta).toMatchObject({ document_type: 'shopping_list', document_version: 1, show_id: ids.show });
      // The entry holds no words of the document.
      expect(JSON.stringify(entries[0].changes)).not.toContain('showstopper');
    });

    it('a later edit makes a new draft with no approver; the approved version in history keeps its own', async () => {
      const ids = await drafted();
      await approve(ids, 'admin', { version: 1, intent: 'approve' });
      await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'Another gown' }] });
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'draft', version: 2, approved_at: null });
      expect(doc.approved_by).toBeUndefined();
      expect(doc.overlay_render).toBeUndefined();
      expect(doc.history[0]).toMatchObject({ version: 1, status: 'approved', approved_by: { id: ADMIN_ID } });
      // Approving the new version is a second approval, with its own entry.
      expect((await approve(ids, 'admin2', { version: 2, intent: 'approve' })).status).toBe(200);
      const entries = await audit(ids);
      expect(entries.map((e) => [e.user_id, e.changes.meta.document_version])).toEqual([[ADMIN_ID, 1], ['test-admin-approval-2', 2]]);
    });

    it('if the audit entry cannot be written, the approval is not written either', async () => {
      const ids = await drafted();
      const spy = jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValueOnce(new Error('audit table unavailable'));
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      spy.mockRestore();
      expect(res.status).toBe(500);
      expect(await stored(ids)).toMatchObject({ status: 'draft', version: 1, approved_at: null });
      expect(overlayService.makeDocumentOverlay).not.toHaveBeenCalled();
      expect(await audit(ids)).toEqual([]);
    });
  });

  // ── Stale and simultaneous approvals ─────────────────────────────────
  describe('documents: a stale or second approval', () => {
    it('a version that moved on is refused (409): nothing approved, drawn or recorded', async () => {
      const ids = await drafted();
      await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'Edited meanwhile' }] });
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/changed since you opened it/);
      expect(await stored(ids)).toMatchObject({ status: 'draft', version: 2 });
      expect(overlayService.makeDocumentOverlay).not.toHaveBeenCalled();
      expect(await audit(ids)).toEqual([]);
    });

    it('approving what is already approved is refused (409) and leaves the first approval as it was', async () => {
      const ids = await drafted();
      expect((await approve(ids, 'admin', { version: 1, intent: 'approve' })).status).toBe(200);
      const first = await stored(ids);
      const again = await approve(ids, 'admin2', { version: 1, intent: 'approve' });
      expect(again.status).toBe(409);
      expect(again.body.error).toMatch(/already approved/);
      const after = await stored(ids);
      expect(after.approved_by).toEqual({ id: ADMIN_ID });
      expect(after.approved_at).toBe(first.approved_at);
      expect(await audit(ids)).toHaveLength(1);
    });

    it('two approvals of the same version sent at once: exactly one succeeds, one is refused, one entry, one overlay', async () => {
      const ids = await drafted();
      const results = await Promise.all([
        approve(ids, 'admin', { version: 1, intent: 'approve' }),
        approve(ids, 'admin2', { version: 1, intent: 'approve' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', version: 1, overlay: { version: 1 }, overlay_render: { status: 'ok', version: 1 } });
      const winner = results.find((r) => r.status === 200).body.data.approved_by.id;
      expect(doc.approved_by).toEqual({ id: winner });
      const entries = await audit(ids);
      expect(entries).toHaveLength(1);
      expect(entries[0].user_id).toBe(winner);
      expect(overlayService.makeDocumentOverlay).toHaveBeenCalledTimes(1);
      expect((await overlays(ids)).filter((a) => !a.deleted_at)).toHaveLength(1);
    });

    it('an intent that is not one is refused (400); drawing a draft is refused (409)', async () => {
      const ids = await drafted();
      expect((await approve(ids, 'admin', { intent: 'publish' })).status).toBe(400);
      const res = await approve(ids, 'admin', { intent: 'render' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Approve the shopping list before drawing/);
      expect(await stored(ids)).toMatchObject({ status: 'draft' });
    });

    it('with no intent the call does what it always did: approve a draft, then draw again only when the overlay is not current', async () => {
      const ids = await drafted();
      expect((await approve(ids, 'admin')).body.data).toMatchObject({ status: 'approved', overlay: { version: 1 } });
      expect((await approve(ids, 'admin')).status).toBe(200);
      expect(overlayService.makeDocumentOverlay).toHaveBeenCalledTimes(1);
      expect(await audit(ids)).toHaveLength(1);
    });
  });
});
