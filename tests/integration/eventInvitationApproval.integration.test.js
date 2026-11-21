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

(shouldSkip ? describe.skip : describe)("approving an invitation is an admin's, and recorded", () => {
  const ADMIN_ID = 'test-admin-invitation';
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@approval.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token(ADMIN_ID, ['USER', 'ADMIN'], 'ADMIN');
    tokens.admin2 = token('test-admin-invitation-2', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-invitation', ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token('test-viewer-invitation', ['USER', 'VIEWER'], 'USER');
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

  // ── Invitations ──────────────────────────────────────────────────────
  describe('invitations: only an admin approves, and the approval is recorded', () => {
    async function withInvitation() {
      const ids = await seed();
      const add = async (version) => {
        const id = uuid();
        await run(`INSERT INTO assets (id, name, asset_type, asset_role, show_id, s3_url_processed, approval_status, metadata, created_at, updated_at)
                   VALUES (:id, :name, 'INVITATION_LETTER', 'UI.OVERLAY.INVITATION', :show, :url, 'pending_review', CAST(:meta AS jsonb), NOW(), NOW())`,
        { id, show: ids.show, name: `Studio Session — Invitation v${version}`, url: `https://x/inv${version}.png`, meta: JSON.stringify({ event_id: ids.event, version }) });
        return id;
      };
      ids.inv1 = await add(1);
      ids.inv2 = await add(2);
      return ids;
    }
    const approveInv = (ids, who, body) => as(who, request(app).post(`${base(ids)}/approve-invitation`)).send(body);
    const asset = async (id) => (await q('SELECT approval_status, metadata FROM assets WHERE id = :id', { id }))[0];
    const eventRow = async (ids) => (await q('SELECT invitation_asset_id FROM world_events WHERE id = :event', ids))[0];

    it.each([['editor'], ['viewer']])('a signed-in %s is refused (403); nothing is approved, linked or recorded', async (who) => {
      const ids = await withInvitation();
      expect((await approveInv(ids, who, { assetId: ids.inv1 })).status).toBe(403);
      expect((await asset(ids.inv1)).approval_status).toBe('pending_review');
      expect((await eventRow(ids)).invitation_asset_id).toBeNull();
      expect(await audit(ids, 'event_invitation_approved')).toEqual([]);
    });

    it('an admin approves: the version says who and when, the event links it, and one entry names it', async () => {
      const ids = await withInvitation();
      const res = await approveInv(ids, 'admin', { assetId: ids.inv1, expectedInvitationAssetId: null });
      expect(res.status).toBe(200);
      const row = await asset(ids.inv1);
      expect(row.approval_status).toBe('approved');
      expect(row.metadata).toMatchObject({ approved_by: { id: ADMIN_ID }, event_id: ids.event, version: 1 });
      expect(Number.isNaN(Date.parse(row.metadata.approved_at))).toBe(false);
      expect((await eventRow(ids)).invitation_asset_id).toBe(ids.inv1);
      const entries = await audit(ids, 'event_invitation_approved');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: ADMIN_ID, resource_id: ids.event });
      expect(entries[0].changes.meta).toMatchObject({ asset_id: ids.inv1, invitation_version: 1, show_id: ids.show });
    });

    it('approving the approved version again changes nothing and adds no second entry', async () => {
      const ids = await withInvitation();
      await approveInv(ids, 'admin', { assetId: ids.inv1 });
      const first = await asset(ids.inv1);
      expect((await approveInv(ids, 'admin2', { assetId: ids.inv1 })).status).toBe(200);
      const after = await asset(ids.inv1);
      expect(after.metadata.approved_by).toEqual({ id: ADMIN_ID });
      expect(after.metadata.approved_at).toBe(first.metadata.approved_at);
      expect(await audit(ids, 'event_invitation_approved')).toHaveLength(1);
    });

    it('the approved invitation changed since the sender looked: refused (409), nothing changed', async () => {
      const ids = await withInvitation();
      await approveInv(ids, 'admin', { assetId: ids.inv1 });
      // This sender still believes no invitation is approved.
      const stale = await approveInv(ids, 'admin2', { assetId: ids.inv2, expectedInvitationAssetId: null });
      expect(stale.status).toBe(409);
      expect((await eventRow(ids)).invitation_asset_id).toBe(ids.inv1);
      expect((await asset(ids.inv2)).approval_status).toBe('pending_review');
      // Having seen the first, the same approval goes through, with its own entry.
      expect((await approveInv(ids, 'admin2', { assetId: ids.inv2, expectedInvitationAssetId: ids.inv1 })).status).toBe(200);
      expect((await eventRow(ids)).invitation_asset_id).toBe(ids.inv2);
      const entries = await audit(ids, 'event_invitation_approved');
      expect(entries.map((e) => [e.user_id, e.changes.meta.asset_id, e.changes.meta.replaces_asset_id])).toEqual([
        [ADMIN_ID, ids.inv1, null], ['test-admin-invitation-2', ids.inv2, ids.inv1],
      ]);
    });

    it('two approvals of different versions at once take turns: both are recorded and the event has one of them', async () => {
      const ids = await withInvitation();
      const results = await Promise.all([approveInv(ids, 'admin', { assetId: ids.inv1 }), approveInv(ids, 'admin2', { assetId: ids.inv2 })]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect([ids.inv1, ids.inv2]).toContain((await eventRow(ids)).invitation_asset_id);
      expect(await audit(ids, 'event_invitation_approved')).toHaveLength(2);
    });
  });
});
