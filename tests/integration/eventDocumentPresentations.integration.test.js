/**
 * An approved document's presentations are made, kept and published
 * (V2-2a-2, Evoni 2026-11-20), through the routes against real Postgres,
 * with the object storage stood in for in memory
 * (tests/helpers/objectStorageDouble.js): the real drawing, the real
 * storing code, nothing leaving the process.
 *
 * Here: what approving makes; making again; two at once; the claim and its
 * token; an edit while they are made; what storage may and may not do.
 * The check against the canonical overlay, the recovery, readiness and the
 * protections are in eventDocumentPresentationState.integration.test.js
 * (the app allows 60 writes a minute from one address).
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
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

(shouldSkip ? describe.skip : describe)("an approved document's presentations", () => {
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@present.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token('test-admin-present', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-present', ['USER', 'EDITOR'], 'USER');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    storage.control.conditional = 'honoured';
    storage.control.before = null;
    process.env.S3_PRIMARY_BUCKET = 'test-presentations';
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

  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}`;
  const as = (who, req) => req.set('Authorization', `Bearer ${tokens[who]}`);
  const approve = (ids, who, body = {}) => as(who, request(app).post(`${base(ids)}/documents/shopping_list/approve`)).send(body);
  const present = (ids, who = 'admin', body = {}) => approve(ids, who, { intent: 'present', ...body });
  const stored = async (ids) => {
    const [row] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    const cc = typeof row.canon_consequences === 'string' ? JSON.parse(row.canon_consequences) : row.canon_consequences;
    return cc?.documents?.shopping_list || null;
  };
  const panels = (ids) => q(
    `SELECT id, name, asset_type, asset_role, asset_scope, category, episode_id, show_id, approval_status, width, height,
            s3_url_processed AS url, deleted_at, metadata
       FROM assets WHERE show_id = :show AND asset_type = 'DOCUMENT_PRESENTATION' ORDER BY name`, ids);
  const canonical = (ids) => q(`SELECT id, s3_url_processed AS url, deleted_at FROM assets WHERE show_id = :show AND asset_type = 'DOCUMENT_OVERLAY' ORDER BY created_at`, ids);
  const keysOf = (ids) => [...storage.objects.keys()].filter((k) => k.includes(`/${ids.event}/`));
  /** A drafted shopping list (version 1). */
  async function drafted() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Present ${ids.show.slice(0, 8)}`, slug: `present-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'invite', '{}'::jsonb, 'ready', NOW(), NOW())`, ids);
    const res = await as('editor', request(app).post(`${base(ids)}/documents/shopping_list/draft`)).send({});
    expect(res.status).toBe(200);
    return ids;
  }
  /** Drafted and approved, with its overlay and its presentations. */
  async function approved() {
    const ids = await drafted();
    const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
    expect(res.status).toBe(200);
    return ids;
  }

  describe('approving makes them, after the approval and the overlay', () => {
    it('both presentations are published: rows that say whose they are, files named by their bytes, and the document says what it has', async () => {
      const ids = await drafted();
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', version: 1, overlay_render: { status: 'ok' }, presentation_render: { status: 'done', version: 1 } });
      expect(doc.presentation_render.token).toBeUndefined();
      expect(doc.overlay.content_sha256).toMatch(/^[0-9a-f]{64}$/);
      const kept = doc.presentations;
      expect(kept).toMatchObject({ version: 1, revision: overlays.PRESENTATION_REVISION, canonical_asset_id: doc.overlay.asset_id, canonical_sha256: doc.overlay.content_sha256 });
      expect(kept.floating).toMatchObject({ status: 'ok', panel_count: 1 });
      expect(kept.reading.status).toBe('ok');
      expect(kept.reading.panel_count).toBeGreaterThanOrEqual(1);
      expect(kept.reading.readable).toBe(true);

      const rows = await panels(ids);
      expect(rows).toHaveLength(1 + kept.reading.panel_count);
      for (const row of rows) {
        const about = row.metadata.document_presentation;
        expect(row).toMatchObject({ asset_type: 'DOCUMENT_PRESENTATION', asset_scope: 'SHOW', category: 'overlay', episode_id: null, show_id: ids.show, approval_status: 'approved', width: 1920, height: 1080, deleted_at: null });
        expect(row.asset_role).toBe('DOCUMENT.PRESENTATION.SHOPPING_LIST');
        expect(row.name).toMatch(/^Studio Session · Shopping list · (Floating|Reading) \d+ of \d+ · v1$/);
        // It names its event inside its own record only (Start Episode matches metadata.event_id).
        expect(row.metadata.event_id).toBeUndefined();
        expect(about).toMatchObject({ event_id: ids.event, document_type: 'shopping_list', document_version: 1, render_key: kept.render_key, revision: overlays.PRESENTATION_REVISION, canonical_asset_id: doc.overlay.asset_id });
        // Its id is who it is: the set, and its place in the set.
        const setId = overlays.presentationSetId({ eventId: ids.event, type: 'shopping_list', version: 1, renderKey: kept.render_key, presentation: about.presentation });
        expect(about.set_id).toBe(setId);
        expect(row.id).toBe(overlays.presentationPanelId(setId, about.panel_index, about.panel_count));
        // Its file is what was drawn, under a key that carries its hash.
        const key = storage.keyOf(row.url);
        const bytes = storage.objects.get(key);
        expect(bytes.subarray(1, 4).toString()).toBe('PNG');
        expect(sha(bytes)).toBe(about.content_sha256);
        expect(key).toBe(`overlays/event-documents/${ids.event}/presentations/shopping_list-v1-${about.presentation}-${about.panel_index}of${about.panel_count}-${about.content_sha256}.png`);
        expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1920, 1080]);
      }
      expect(kept.floating.asset_ids.concat(kept.reading.asset_ids).sort()).toEqual(rows.map((r) => r.id).sort());
      // Every panel was written once, only where nothing was.
      const writes = storage.log.filter((e) => e.key && e.key.includes(`/${ids.event}/presentations/`) && e.op !== 'read');
      expect(writes.every((e) => e.op === 'write' && e.conditional)).toBe(true);
      expect(writes).toHaveLength(rows.length);
    });

    it('the canonical overlay is the page as it is drawn, and making the presentations did not touch it', async () => {
      const ids = await approved();
      const doc = await stored(ids);
      const [overlay] = await canonical(ids);
      expect(overlay).toMatchObject({ id: doc.overlay.asset_id, deleted_at: null });
      expect(sha(storage.objects.get(storage.keyOf(overlay.url)))).toBe(doc.overlay.content_sha256);
      expect(storage.log.filter((e) => e.key === storage.keyOf(overlay.url) && e.op !== 'read').map((e) => e.op)).toEqual(['write']);
    });

    it('the readiness the Event Package reads says both are ready', async () => {
      const ids = await approved();
      const res = await as('editor', request(app).get(`${base(ids)}/documents`));
      expect(res.status).toBe(200);
      expect(res.body.data.presentation_readiness.shopping_list).toMatchObject({ floating: { ready: true, state: 'ready', panel_count: 1 }, reading: { ready: true, state: 'ready' } });
      expect(res.body.data.presentation_readiness.offer_letter).toMatchObject({ floating: { ready: false, state: 'not_approved' }, reading: { ready: false, state: 'not_approved' } });
    });
  });

  describe('making them again', () => {
    it("intent 'present' on a published document makes nothing new: the same rows, the same files, the overlay not drawn again", async () => {
      const ids = await approved();
      const before = { rows: await panels(ids), keys: keysOf(ids).sort(), overlay: await canonical(ids), doc: await stored(ids) };
      const draw = jest.spyOn(overlays, 'makeDocumentOverlay');
      for (let i = 0; i < 2; i += 1) {
        const res = await present(ids, 'admin', { version: 1 });
        expect(res.status).toBe(200);
        expect(res.body.data.presentation_render).toMatchObject({ status: 'done' });
      }
      expect(draw).not.toHaveBeenCalled();
      const after = { rows: await panels(ids), keys: keysOf(ids).sort(), overlay: await canonical(ids), doc: await stored(ids) };
      expect(after.rows.map((r) => [r.id, r.url, r.deleted_at])).toEqual(before.rows.map((r) => [r.id, r.url, r.deleted_at]));
      expect(after.keys).toEqual(before.keys);
      expect(after.overlay).toEqual(before.overlay);
      expect(after.doc.overlay).toEqual(before.doc.overlay);
      expect(after.doc.presentations.floating.asset_ids).toEqual(before.doc.presentations.floating.asset_ids);
      expect(after.doc.presentations.reading.asset_ids).toEqual(before.doc.presentations.reading.asset_ids);
      // Nothing was written to storage a second time.
      const writes = storage.log.filter((e) => e.key && e.key.includes(`/${ids.event}/`) && ['write', 'overwrite'].includes(e.op));
      expect(writes).toHaveLength(before.rows.length + 1);
      expect(storage.log.some((e) => e.key && e.key.includes(`/${ids.event}/`) && e.op === 'overwrite')).toBe(false);
    });

    it('approving the approved document again is refused, and makes nothing', async () => {
      const ids = await approved();
      const before = [await panels(ids), keysOf(ids).length];
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(409);
      expect([await panels(ids), keysOf(ids).length]).toEqual(before);
    });

    it("it is an admin's, of an approved document, at the version named", async () => {
      const ids = await drafted();
      expect((await present(ids, 'editor')).status).toBe(403);
      expect((await present(ids, 'admin')).status).toBe(409);
      await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect((await present(ids, 'admin', { version: 7 })).status).toBe(409);
      expect((await approve(ids, 'admin', { intent: 'something else' })).status).toBe(400);
    });
  });

  describe('two at once, and the claim', () => {
    it('two makings asked for together publish one set', async () => {
      const ids = await approved();
      const before = (await panels(ids)).map((r) => r.id);
      const [a, b] = await Promise.all([present(ids, 'admin', { version: 1 }), present(ids, 'admin', { version: 1 })]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect((await panels(ids)).map((r) => r.id)).toEqual(before);
      expect((await stored(ids)).presentation_render.status).toBe('done');
    });

    it('while one is being made another does nothing; a claim left by a crash is taken over after two minutes', async () => {
      const ids = await approved();
      const setRender = async (render) => {
        const doc = await stored(ids);
        await run(`UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{documents,shopping_list}', CAST(:doc AS jsonb)) WHERE id = :event`,
          { ...ids, doc: JSON.stringify({ ...doc, presentation_render: render }) });
      };
      await setRender({ status: 'rendering', version: 1, token: 'someone-else', started_at: new Date().toISOString() });
      const draw = jest.spyOn(overlays, 'drawPresentations');
      const busy = await present(ids, 'admin', { version: 1 });
      expect(busy.status).toBe(200);
      expect(busy.body.data.presentation_render).toMatchObject({ status: 'rendering', token: 'someone-else' });
      expect(draw).not.toHaveBeenCalled();
      const waiting = await as('editor', request(app).get(`${base(ids)}/documents`));
      expect(waiting.body.data.presentation_readiness.shopping_list).toMatchObject({ floating: { ready: false, state: 'making' }, reading: { ready: false, state: 'making' } });
      // The same claim, three minutes old: nobody is making them any more.
      await setRender({ status: 'rendering', version: 1, token: 'someone-else', started_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() });
      const taken = await present(ids, 'admin', { version: 1 });
      expect(taken.body.data.presentation_render).toMatchObject({ status: 'done' });
      expect(draw).toHaveBeenCalledTimes(1);
    });

    it('a making that was overtaken does not publish: only the holder of the claim does', async () => {
      const ids = await drafted();
      // Hold the first making at its first panel, then let another claim take its place.
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      const realStore = overlays.storePresentationPanel;
      let first = true;
      jest.spyOn(overlays, 'storePresentationPanel').mockImplementation(async (...args) => {
        if (first) { first = false; await held; }
        return realStore(...args);
      });
      const pending = approve(ids, 'admin', { version: 1, intent: 'approve' }).then((r) => r);
      for (let i = 0; i < 200 && (await stored(ids))?.presentation_render?.status !== 'rendering'; i += 1) await new Promise((r) => { setTimeout(r, 25); });
      const doc = await stored(ids);
      expect(doc.presentation_render.status).toBe('rendering');
      await run(`UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{documents,shopping_list,presentation_render,token}', '"the-one-that-took-over"') WHERE id = :event`, ids);
      release();
      expect((await pending).status).toBe(200);
      // Nothing of the overtaken making is in the registry or on the document.
      expect(await panels(ids)).toEqual([]);
      const after = await stored(ids);
      expect(after.presentations).toBeUndefined();
      expect(after.presentation_render).toMatchObject({ status: 'rendering', token: 'the-one-that-took-over' });
      expect(after).toMatchObject({ status: 'approved', overlay_render: { status: 'ok' } });
    });

    it('edited while they are made: nothing is published for the old version, and the new version carries none of it', async () => {
      const ids = await drafted();
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      const realStore = overlays.storePresentationPanel;
      let first = true;
      jest.spyOn(overlays, 'storePresentationPanel').mockImplementation(async (...args) => {
        if (first) { first = false; await held; }
        return realStore(...args);
      });
      const pending = approve(ids, 'admin', { version: 1, intent: 'approve' }).then((r) => r);
      for (let i = 0; i < 200 && (await stored(ids))?.presentation_render?.status !== 'rendering'; i += 1) await new Promise((r) => { setTimeout(r, 25); });
      const edit = await as('editor', request(app).put(`${base(ids)}/documents/shopping_list`)).send({ items: [{ slot: 'dress', label: 'Edited while they were made' }] });
      expect(edit.status).toBe(200);
      release();
      expect((await pending).status).toBe(200);
      expect(await panels(ids)).toEqual([]);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'draft', version: 2 });
      expect(doc.presentations).toBeUndefined();
      expect(doc.presentation_render).toBeUndefined();
    });
  });

  describe('what storage may and may not do', () => {
    it('a file already where a panel belongs, with other bytes, is not written over: that presentation fails, the other is published', async () => {
      const ids = await approved();
      const doc = await stored(ids);
      const [reading] = (await panels(ids)).filter((r) => r.metadata.document_presentation.presentation === 'reading');
      const key = storage.keyOf(reading.url);
      const other = Buffer.from('not this panel');
      storage.objects.set(key, other);
      const res = await present(ids, 'admin', { version: 1 });
      expect(res.status).toBe(200);
      const after = await stored(ids);
      expect(after.presentations.reading).toMatchObject({ status: 'failed', code: 'STORAGE_CONFLICT' });
      expect(after.presentations.floating).toMatchObject({ status: 'ok', asset_ids: doc.presentations.floating.asset_ids });
      // What was there is still there.
      expect(storage.objects.get(key).equals(other)).toBe(true);
      expect(storage.log.some((e) => e.key === key && e.op === 'overwrite')).toBe(false);
      expect(after).toMatchObject({ status: 'approved', overlay: doc.overlay });
      const ready = (await as('editor', request(app).get(`${base(ids)}/documents`))).body.data.presentation_readiness.shopping_list;
      expect(ready).toMatchObject({ floating: { ready: true }, reading: { ready: false, state: 'failed', code: 'STORAGE_CONFLICT' } });
    });

    it('another request wrote the same panel between the look and the write: it is reused, not written twice', async () => {
      const ids = await drafted();
      // The store answers "nothing there" to the first look at each panel, though the panel is then there.
      const racing = new Set();
      const stash = new Map();
      storage.control.before = (kind, input) => {
        if (!input.Key.includes('/presentations/')) return;
        if (kind === 'GetObjectCommand' && !racing.has(input.Key) && !storage.objects.has(input.Key)) racing.add(input.Key);
        else if (kind === 'PutObjectCommand' && racing.has(input.Key) && !stash.has(input.Key)) {
          // The other request's write lands first, with the very same bytes.
          stash.set(input.Key, true);
          storage.objects.set(input.Key, Buffer.from(input.Body));
        }
      };
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      const doc = await stored(ids);
      expect(doc.presentations).toMatchObject({ floating: { status: 'ok' }, reading: { status: 'ok' } });
      expect(storage.log.filter((e) => e.key && e.key.includes(`/${ids.event}/presentations/`) && e.op === 'refused').length).toBe((await panels(ids)).length);
      expect(storage.log.some((e) => e.key && e.key.includes(`/${ids.event}/presentations/`) && e.op === 'overwrite')).toBe(false);
    });

    it('storage that cannot promise a file is written once is not used: nothing is published, the approval and the overlay stand', async () => {
      const ids = await drafted();
      storage.control.conditional = 'unsupported';
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', overlay_render: { status: 'ok' }, presentation_render: { status: 'done' } });
      expect(doc.presentations).toMatchObject({ floating: { status: 'failed', code: 'STORAGE_NOT_IMMUTABLE' }, reading: { status: 'failed', code: 'STORAGE_NOT_IMMUTABLE' } });
      expect(await panels(ids)).toEqual([]);
      expect(keysOf(ids).filter((k) => k.includes('/presentations/'))).toEqual([]);
      // With the storage as it should be, a retry publishes them.
      storage.control.conditional = 'honoured';
      await present(ids, 'admin', { version: 1 });
      expect((await stored(ids)).presentations).toMatchObject({ floating: { status: 'ok' }, reading: { status: 'ok' } });
    });

    it('with no storage configured they are not made, and that is said; the approval and the overlay stand', async () => {
      const ids = await drafted();
      delete process.env.S3_PRIMARY_BUCKET;
      const res = await approve(ids, 'admin', { version: 1, intent: 'approve' });
      expect(res.status).toBe(200);
      const doc = await stored(ids);
      expect(doc).toMatchObject({ status: 'approved', overlay_render: { status: 'ok' }, presentation_render: { status: 'unavailable', code: 'STORAGE_NOT_CONFIGURED' } });
      expect(doc.overlay.url).toMatch(/^data:image\/png;base64,/);
      expect(doc.presentations).toBeUndefined();
      expect(await panels(ids)).toEqual([]);
      const ready = (await as('editor', request(app).get(`${base(ids)}/documents`))).body.data.presentation_readiness.shopping_list;
      expect(ready).toMatchObject({ floating: { ready: false, state: 'unavailable', code: 'STORAGE_NOT_CONFIGURED' }, reading: { ready: false, state: 'unavailable' } });
    });
  });
});
