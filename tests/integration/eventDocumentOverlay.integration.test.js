/**
 * The event's documents as overlays (Evoni, 2026-10-07: "i want both the
 * shopping list and career list and invitations as overlays"; "none of the
 * overlays should be beats for now"): approving a shopping list or a career
 * plan draws it as a PNG, recorded as a DOCUMENT_OVERLAY asset and on the
 * document as overlay { asset_id, url, version }. An edit makes it outdated;
 * approving again draws a new one and retires the old. Nothing is placed on
 * a beat. Real Postgres; the image is a data URL (no bucket in tests).
 */
jest.unmock('uuid');
jest.mock('../../src/services/todoListService', () => ({
  ...jest.requireActual('../../src/services/todoListService'),
  generateTasks: jest.fn(async () => [
    { slot: 'dress', label: 'Find a showstopper', description: '', required: true },
  ]),
  generateCareerTasks: jest.fn(async () => [
    { slot: 'net_1', label: 'Follow up with STUDIO BY SABLE', description: '', required: false },
  ]),
}));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { drawingAvailable, overlayState } = require('../../src/services/eventDocumentOverlayService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test') ||
  !drawingAvailable();

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const PNG = 'data:image/png;base64,iVBORw0KGgo';

(shouldSkip ? describe.skip : describe)('event documents as overlays', () => {
  let token;
  const shows = [];
  const savedBucket = { a: process.env.S3_PRIMARY_BUCKET, b: process.env.AWS_S3_BUCKET };

  beforeAll(() => {
    delete process.env.S3_PRIMARY_BUCKET;
    delete process.env.AWS_S3_BUCKET;
    token = TokenService.generateTokenPair({
      id: 'test-user-doc-overlays', email: 'test@docoverlays.dev', name: 'Doc Overlays', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    if (savedBucket.a !== undefined) process.env.S3_PRIMARY_BUCKET = savedBucket.a;
    if (savedBucket.b !== undefined) process.env.AWS_S3_BUCKET = savedBucket.b;
    for (const show of shows) {
      await run(`DELETE FROM assets WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `DocOv ${ids.show.slice(0, 8)}`, slug: `docov-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, host_brand, event_date, outfit_pieces, status, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'invite', 'Studio by Sable', '2026-11-12', :pieces, 'ready', NOW(), NOW())`,
      { ...ids, pieces: JSON.stringify([{ name: 'Sculpted Dress', category: 'dress', coin_cost: 420, is_owned: false }]) });
    return ids;
  }

  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}/documents`;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const overlays = (ids, type) => q(
    `SELECT id, asset_type, asset_role, episode_id, deleted_at, metadata FROM assets
      WHERE show_id = :show AND metadata->>'document_type' = :type ORDER BY created_at`,
    { ...ids, type });

  it.each(['shopping_list', 'career_plan'])('approving the %s draws its overlay; an edit outdates it; approving again redraws it', async (type) => {
    const ids = await seed();
    expect((await auth(request(app).post(`${base(ids)}/${type}/draft`))).status).toBe(200);

    const approved = await auth(request(app).post(`${base(ids)}/${type}/approve`));
    expect(approved.status).toBe(200);
    const doc = approved.body.data;
    expect(doc).toMatchObject({ status: 'approved', version: 1, overlay: { version: 1 } });
    expect(doc.overlay.url.startsWith(PNG)).toBe(true);
    expect(overlayState(doc)).toBe('current');

    const [asset] = await overlays(ids, type);
    expect(asset).toMatchObject({
      id: doc.overlay.asset_id, asset_type: 'DOCUMENT_OVERLAY', asset_role: `UI.OVERLAY.${type.toUpperCase()}`,
      episode_id: null, deleted_at: null,
    });
    expect(asset.metadata).toMatchObject({ source: 'event_document', event_id: ids.event, document_version: 1 });
    // Not on a beat.
    const placed = await q(`SELECT COUNT(*)::int AS n FROM timeline_placements WHERE asset_id = :id`, { id: asset.id })
      .catch(() => [{ n: 0 }]);
    expect(placed[0].n).toBe(0);

    // GET carries it.
    const got = await auth(request(app).get(base(ids)));
    expect(got.body.data[type].overlay.asset_id).toBe(asset.id);

    // An edit keeps the old image, now outdated.
    const edited = await auth(request(app).put(`${base(ids)}/${type}`)).send({ items: [{ slot: 'shoes', label: 'Gold heels' }] });
    expect(edited.body.data).toMatchObject({ status: 'draft', version: 2, overlay: { asset_id: asset.id, version: 1 } });
    expect(overlayState(edited.body.data)).toBe('outdated');

    // Approving the new version draws a new one and retires the first.
    const again = await auth(request(app).post(`${base(ids)}/${type}/approve`));
    expect(again.body.data.overlay).toMatchObject({ version: 2 });
    expect(again.body.data.overlay.asset_id).not.toBe(asset.id);
    const rows = await overlays(ids, type);
    expect(rows.map((r) => [r.id, r.deleted_at === null])).toEqual([[asset.id, false], [again.body.data.overlay.asset_id, true]]);

    // Approving it once more is a no-op: the overlay is current.
    const same = await auth(request(app).post(`${base(ids)}/${type}/approve`));
    expect(same.body.data.overlay.asset_id).toBe(again.body.data.overlay.asset_id);
    expect(await overlays(ids, type)).toHaveLength(2);
  });

  it('an approved document without an overlay gets one on approve (Make overlay)', async () => {
    const ids = await seed();
    const now = new Date().toISOString();
    const doc = { type: 'shopping_list', status: 'approved', version: 3, source: 'edited', items: [{ slot: 'dress', label: 'A dress' }], approved_at: now, history: [] };
    await run(`UPDATE world_events SET canon_consequences = :cc WHERE id = :event`,
      { ...ids, cc: JSON.stringify({ documents: { shopping_list: doc } }) });
    const res = await auth(request(app).post(`${base(ids)}/shopping_list/approve`));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'approved', version: 3, approved_at: now, overlay: { version: 3 } });
    expect(await overlays(ids, 'shopping_list')).toHaveLength(1);
  });
});
