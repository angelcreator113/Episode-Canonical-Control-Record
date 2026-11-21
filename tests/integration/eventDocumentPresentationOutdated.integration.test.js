/**
 * The presentations follow the overlay they stand beside (V2-2a-2, Evoni
 * 2026-11-20: "presentation readiness must follow the canonical document's
 * outdated state"). When the overlay is out of date, by the one
 * calculation that says so (overlayState, through currentOverlayState),
 * neither presentation is ready, however whole it is; nothing is removed;
 * and when the overlay is current again readiness is worked out afresh.
 * Real Postgres, storage stood in for in memory. (Its own file: the app
 * allows 60 writes a minute from one address.)
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

(shouldSkip ? describe.skip : describe)('the presentations follow the overlay they stand beside', () => {
  const ADMIN_ID = 'test-admin-present-outdated';
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@present.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token(ADMIN_ID, ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-present-outdated', ['USER', 'EDITOR'], 'USER');
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

  describe('the overlay goes out of date after they are published (readiness follows the overlay)', () => {
    // The one calculation of "out of date" is overlayState: for a shopping
    // list, the look's total recorded with the overlay against the look's
    // total now. Here the recorded total is moved, as a changed look moves it.
    const drift = (ids, by) => setStored(ids, (doc) => ({ ...doc, overlay: { ...doc.overlay, look_total: Number(doc.overlay.look_total || 0) + by } }));

    it('neither presentation is ready while it is out of date, though every panel is there; nothing is removed, and what is kept is still said', async () => {
      const ids = await approved();
      const before = { panels: await panels(ids), kept: (await stored(ids)).presentations };
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true }, reading: { ready: true } });
      await drift(ids, 500);
      const now = await readiness(ids);
      for (const presentation of ['floating', 'reading']) {
        expect(now[presentation]).toMatchObject({
          ready: false, state: 'canonical_outdated', code: 'CANONICAL_OUTDATED',
          panels: { kept: true, panel_count: before.kept[presentation].panel_count, missing: 0, complete: true },
        });
        expect(now[presentation].message).toMatch(/out of date/);
      }
      // Reading it changed nothing: the same rows, live, and the same record.
      expect(await panels(ids)).toEqual(before.panels);
      expect((await stored(ids)).presentations).toEqual(before.kept);
    });

    it('a panel missing while it is out of date is still said, per presentation', async () => {
      const ids = await approved();
      const gone = (await panels(ids)).find((r) => r.about.presentation === 'reading');
      await run('UPDATE assets SET deleted_at = NOW() WHERE id = :id', { id: gone.id });
      await drift(ids, 500);
      expect(await readiness(ids)).toMatchObject({
        floating: { ready: false, state: 'canonical_outdated', panels: { complete: true, missing: 0 } },
        reading: { ready: false, state: 'canonical_outdated', panels: { complete: false, missing: 1 } },
      });
    });

    it('current again without anything being made (the look back as it was): readiness is worked out afresh from the same document and rows', async () => {
      const ids = await approved();
      const before = await panels(ids);
      await drift(ids, 500);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: false }, reading: { ready: false } });
      await drift(ids, -500);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true, state: 'ready' }, reading: { ready: true, state: 'ready' } });
      expect(await panels(ids)).toEqual(before);
    });

    it("making them while it is out of date is refused; the admin's redraw makes the overlay current, and both are ready again beside it", async () => {
      const ids = await approved();
      const first = await panels(ids);
      await drift(ids, 500);
      expect((await present(ids)).body.data.presentation_render).toMatchObject({ status: 'mismatch', code: 'CANONICAL_INPUTS_CHANGED' });
      expect(await readiness(ids)).toMatchObject({ floating: { ready: false, state: 'canonical_outdated' }, reading: { ready: false, state: 'canonical_outdated' } });
      const doc = await stored(ids);
      const res = await approve(ids, 'admin', { intent: 'redraw_canonical', confirm: true, version: 1, expected_canonical_asset_id: doc.overlay.asset_id });
      expect(res.status).toBe(200);
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true, state: 'ready' }, reading: { ready: true, state: 'ready' } });
      // The page drew the same, so the panels are the same panels by their
      // content; they are kept under the new overlay's set, and the first are still there.
      const now = await panels(ids);
      expect(first.every((r) => now.some((n) => n.id === r.id && n.deleted_at === null))).toBe(true);
      expect((await stored(ids)).presentations.canonical_asset_id).not.toBe(doc.overlay.asset_id);
    });

    it("the explicit 'render' draws an out-of-date overlay again, as it always did, and they are ready beside it", async () => {
      const ids = await approved();
      await drift(ids, 500);
      const res = await approve(ids, 'admin', { intent: 'render', version: 1 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ overlay_render: { status: 'ok' }, presentation_render: { status: 'done' } });
      expect(await readiness(ids)).toMatchObject({ floating: { ready: true }, reading: { ready: true } });
    });
  });
});
