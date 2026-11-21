/**
 * The safeguards around making an approved document's presentations that
 * the two other files do not reach on their own (V2-2a-2, Evoni
 * 2026-11-20): the overlay replaced while they are made; the look's total
 * or the terms recorded with the overlay no longer the document's; a panel
 * already kept with other contents; a store that takes "write only if
 * nothing is there" and writes over all the same; a making that cannot
 * even start. Real Postgres, storage stood in for in memory.
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
const documents = require('../../src/services/eventDocumentsService');
const storage = require('@aws-sdk/client-s3').__storage;

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("the safeguards around a document's presentations", () => {
  const tokens = {};
  const shows = [];

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@present.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token('test-admin-present-guards', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-present-guards', ['USER', 'EDITOR'], 'USER');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    storage.control.conditional = 'honoured';
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
  const approve = (ids, body = {}) => as('admin', request(app).post(`${base(ids)}/documents/shopping_list/approve`)).send(body);
  const present = (ids) => approve(ids, { intent: 'present', version: 1 });
  const stored = async (ids) => {
    const [row] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    const cc = typeof row.canon_consequences === 'string' ? JSON.parse(row.canon_consequences) : row.canon_consequences;
    return cc?.documents?.shopping_list || null;
  };
  const setStored = (ids, change) => stored(ids).then((doc) => run(
    `UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{documents,shopping_list}', CAST(:doc AS jsonb)) WHERE id = :event`,
    { ...ids, doc: JSON.stringify(change(doc)) }));
  const panels = (ids) => q(
    `SELECT id, s3_url_processed AS url, deleted_at, metadata->'document_presentation' AS about FROM assets
      WHERE show_id = :show AND asset_type = 'DOCUMENT_PRESENTATION' ORDER BY id`, ids);
  async function drafted() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Present ${ids.show.slice(0, 8)}`, slug: `present-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'invite', '{}'::jsonb, 'ready', NOW(), NOW())`, ids);
    expect((await as('editor', request(app).post(`${base(ids)}/documents/shopping_list/draft`)).send({})).status).toBe(200);
    return ids;
  }
  async function approved() {
    const ids = await drafted();
    expect((await approve(ids, { version: 1, intent: 'approve' })).status).toBe(200);
    return ids;
  }

  it('the overlay replaced while they are made (the claim still held): nothing is published beside the wrong overlay', async () => {
    const ids = await drafted();
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const realStore = overlays.storePresentationPanel;
    let first = true;
    jest.spyOn(overlays, 'storePresentationPanel').mockImplementation(async (...args) => {
      if (first) { first = false; await held; }
      return realStore(...args);
    });
    const pending = approve(ids, { version: 1, intent: 'approve' }).then((r) => r);
    for (let i = 0; i < 200 && (await stored(ids))?.presentation_render?.status !== 'rendering'; i += 1) await new Promise((r) => { setTimeout(r, 25); });
    // Another overlay takes its place; the claim and its token are left as they are.
    const other = uuid();
    await run(`UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{documents,shopping_list,overlay,asset_id}', to_jsonb(CAST(:other AS text))) WHERE id = :event`, { ...ids, other });
    release();
    expect((await pending).status).toBe(200);
    expect(await panels(ids)).toEqual([]);
    const doc = await stored(ids);
    expect(doc.presentations).toBeUndefined();
    expect(doc.overlay.asset_id).toBe(other);
  });

  it("the look's total recorded with the overlay is no longer the document's: nothing is made, though the page's bytes are the same", async () => {
    const ids = await approved();
    const before = await panels(ids);
    await setStored(ids, (doc) => ({ ...doc, overlay: { ...doc.overlay, look_total: Number(doc.overlay.look_total || 0) + 500 } }));
    const made = jest.spyOn(overlays, 'drawPresentations');
    const res = await present(ids);
    expect(res.body.data.presentation_render).toMatchObject({ status: 'mismatch', code: 'CANONICAL_INPUTS_CHANGED' });
    expect(res.body.data.presentation_render.message).toMatch(/the look's total/);
    expect(made).not.toHaveBeenCalled();
    expect(await panels(ids)).toEqual(before);
  });

  it('a panel already kept under its id with other contents: none of that set is written, and the row is left as it is', async () => {
    const ids = await approved();
    const rows = await panels(ids);
    const reading = rows.filter((r) => r.about.presentation === 'reading');
    const odd = reading[0];
    await run(`UPDATE assets SET metadata = jsonb_set(metadata, '{document_presentation,content_sha256}', '"0000"') WHERE id = :id`, { id: odd.id });
    // Its other panels gone, so a careless publish would put them back beside the odd one.
    const others = reading.slice(1).map((r) => r.id);
    if (others.length) await run('DELETE FROM assets WHERE id IN (:others)', { others });
    const res = await present(ids);
    expect(res.status).toBe(200);
    const doc = await stored(ids);
    expect(doc.presentations.reading).toMatchObject({ status: 'failed', code: 'PANEL_CONFLICT' });
    expect(doc.presentations.floating.status).toBe('ok');
    const after = await panels(ids);
    expect(after.find((r) => r.id === odd.id).about.content_sha256).toBe('0000');
    expect(after.filter((r) => others.includes(r.id))).toEqual([]);
  });

  it('a store that takes "only if nothing is there" and writes over all the same: what is there is looked at first, and is not written over', async () => {
    const ids = await approved();
    const [row] = (await panels(ids)).filter((r) => r.about.presentation === 'floating');
    const key = storage.keyOf(row.url);
    const other = Buffer.from('not this panel');
    storage.objects.set(key, other);
    storage.control.conditional = 'ignored';
    const res = await present(ids);
    expect(res.status).toBe(200);
    expect((await stored(ids)).presentations.floating).toMatchObject({ status: 'failed', code: 'STORAGE_CONFLICT' });
    expect(storage.objects.get(key).equals(other)).toBe(true);
    expect(storage.log.some((e) => e.key === key && e.op === 'overwrite')).toBe(false);
  });

  it('a making that cannot even start does not fail the approval: the document is approved and its overlay drawn', async () => {
    const ids = await drafted();
    // The database stops answering just as the presentations' claim is taken
    // (the second transaction after the overlay was drawn: its result, then the claim).
    let after = -1;
    const realDraw = overlays.makeDocumentOverlay;
    jest.spyOn(overlays, 'makeDocumentOverlay').mockImplementation(async (...args) => { const drawn = await realDraw(...args); after = 0; return drawn; });
    const realTransaction = sequelize.transaction.bind(sequelize);
    jest.spyOn(sequelize, 'transaction').mockImplementation((...args) => {
      if (after >= 0) { after += 1; if (after === 2) return Promise.reject(new Error('the database stopped answering')); }
      return realTransaction(...args);
    });
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await approve(ids, { version: 1, intent: 'approve' });
    expect(res.status).toBe(200);
    expect(logged.mock.calls.some(([line]) => /presentations could not be started/.test(String(line)))).toBe(true);
    const doc = await stored(ids);
    expect(doc).toMatchObject({ status: 'approved', overlay_render: { status: 'ok' } });
    expect(doc.overlay.asset_id).toBeTruthy();
    expect(doc.presentation_render).toBeUndefined();
    expect(await panels(ids)).toEqual([]);
  });

  it('asked of the service with no admin named: refused, and nothing is made', async () => {
    const ids = await approved();
    const before = await stored(ids);
    for (const actor of [undefined, null, {}, { id: null }]) {
      await expect(documents.approveDocument(models, { showId: ids.show, eventId: ids.event, type: 'shopping_list', intent: 'present', actor })).rejects.toMatchObject({ status: 403 });
      await expect(documents.approveDocument(models, { showId: ids.show, eventId: ids.event, type: 'shopping_list', intent: 'redraw_canonical', version: 1, confirm: true, expectedCanonicalAssetId: before.overlay.asset_id, actor })).rejects.toMatchObject({ status: 403 });
    }
    expect(await stored(ids)).toEqual(before);
  });

  it('a reading set that cannot be read is not kept at all, and a floating page too small is kept and says so (the drawing stood in for)', async () => {
    const real = overlays.presentDocument;
    const small = (type, data, opts) => { const drawn = real(type, data, opts); return { ...drawn, readable: false, text: { ...drawn.text, body_px_on_screen: 19.5 } }; };
    const data = { doc: { version: 1, status: 'approved', items: [{ slot: 'dress', label: 'Find a showstopper', required: true }] }, event: { name: 'Studio Session' }, balance: null, pieces: null, terms: [] };
    const [floating, reading] = overlays.drawPresentations('shopping_list', data, small);
    expect(floating).toMatchObject({ presentation: 'floating', ok: true, readable: false, body_px_on_screen: 19.5 });
    expect(floating.panels).toHaveLength(1);
    expect(reading).toMatchObject({ presentation: 'reading', ok: false, code: 'READING_NOT_READABLE' });
    expect(reading.panels).toBeUndefined();
    // As it is really drawn, both are kept and reading reads.
    const [, really] = overlays.drawPresentations('shopping_list', data);
    expect(really).toMatchObject({ ok: true, readable: true });
    // A drawing that cannot keep its text whole is that presentation's failure, not an error.
    const broken = (type, d, opts) => { if (opts.presentation === 'reading') throw new overlays.DocumentPresentationError('NO_SAFE_PANEL_BOUNDARY', 'No panel boundary keeps every line of text whole.'); return real(type, d, opts); };
    expect(overlays.drawPresentations('shopping_list', data, broken).map((p) => [p.presentation, p.ok, p.code])).toEqual([['floating', true, undefined], ['reading', false, 'NO_SAFE_PANEL_BOUNDARY']]);
  });

  it('the same set made again has the same ids; another version, overlay, input or revision is another set', () => {
    const one = { eventId: 'e1', type: 'shopping_list', version: 3, renderKey: 'k', presentation: 'reading' };
    const id = overlays.presentationSetId(one);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(overlays.presentationSetId({ ...one })).toBe(id);
    for (const change of [{ eventId: 'e2' }, { type: 'offer_letter' }, { version: 4 }, { renderKey: 'k2' }, { presentation: 'floating' }]) {
      expect(overlays.presentationSetId({ ...one, ...change })).not.toBe(id);
    }
    expect(overlays.presentationPanelId(id, 1, 3)).toBe(overlays.presentationPanelId(id, 1, 3));
    expect(new Set([overlays.presentationPanelId(id, 1, 3), overlays.presentationPanelId(id, 2, 3), overlays.presentationPanelId(id, 1, 2)]).size).toBe(3);
    const key = { version: 3, lookTotal: 120, termsKey: null, canonicalSha256: 'abc' };
    const k = overlays.presentationRenderKey(key);
    expect(overlays.presentationRenderKey({ ...key })).toBe(k);
    for (const change of [{ version: 4 }, { lookTotal: 121 }, { termsKey: 't' }, { canonicalSha256: 'abd' }, { revision: overlays.PRESENTATION_REVISION + 1 }]) {
      expect(overlays.presentationRenderKey({ ...key, ...change })).not.toBe(k);
    }
  });
});
