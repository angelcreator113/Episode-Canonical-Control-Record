/**
 * Backfill of deal price snapshots (Evoni, 2026-10-19: "backfill the
 * snapshots"; 20261019170000-backfill-deal-price-snapshots.js).
 *
 * Against the test database: an agreed deal with no snapshot gets one equal
 * to its locked numbers, reason 'backfill', taken when its terms locked; an
 * agreed deal that already has a snapshot is untouched; a draft and a
 * reopened deal are skipped; a second run adds nothing; down removes only
 * the backfill rows.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261019170000-backfill-deal-price-snapshots');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Backfill deal price snapshots migration', () => {
  const show = uuid();
  const ev = { agreed: uuid(), snapped: uuid(), draft: uuid(), reopened: uuid() };
  const d = { video: uuid(), post: uuid() };
  const ep = { agreed: uuid(), snapped: uuid(), reopened: uuid() };
  const briefAt = '2026-10-02T15:00:00.000Z';
  const qi = () => sequelize.getQueryInterface();

  const snapshotOf = (event) => q(
    `SELECT line_kind, line_key, deliverable_type, career_tier, unit_price, quantity, total, rate_anchor_id, rate_version, reason, taken_at
       FROM deal_price_snapshots WHERE event_id = :event AND deleted_at IS NULL ORDER BY line_kind, line_key`, { event });

  async function deal(id, { name, appearanceFee, cc = null }) {
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, appearance_fee, canon_consequences, status, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'appearance_plus_deliverables', 3, :fee, :cc, 'ready', NOW(), NOW())`,
    { id, show, name, fee: appearanceFee, cc: cc ? JSON.stringify(cc) : null });
  }
  async function lock(event, episode, at = null) {
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Backfill episode', 1, 'draft', NOW(), NOW())`, { episode, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (:brief, :episode, :show, :event, 'draft', COALESCE(:at::timestamptz, NOW()), NOW())`,
    { brief: uuid(), episode, show, event, at });
  }

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'Backfill show', :slug, NOW(), NOW())`,
      { show, slug: `backfill-${show.slice(0, 8)}` });

    // 1. Agreed before the snapshot existed: locked fee 480 (Evoni's edit) and a 240 video.
    await deal(ev.agreed, { name: 'Velour Launch', appearanceFee: 480 });
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, created_at, updated_at)
               VALUES (:id, :event, 'One video in the coat', 'pulse_video', true, 'brand', 240, 'pending', NOW(), NOW())`,
    { id: d.video, event: ev.agreed });
    await lock(ev.agreed, ep.agreed, briefAt);

    // 2. Agreed, already snapshotted.
    await deal(ev.snapped, { name: 'Maison Dinner', appearanceFee: 450 });
    await lock(ev.snapped, ep.snapped);
    await run(`INSERT INTO deal_price_snapshots (event_id, line_kind, line_key, career_tier, band, unit_price, quantity, total, premiums, taken_at, reason)
               VALUES (:event, 'component', 'appearance_fee', 3, 'Established', 450, 1, 450, '[]', '2026-10-10T10:00:00Z', 'start_episode')`,
    { event: ev.snapped });

    // 3. A draft: never started.
    await deal(ev.draft, { name: 'Draft Gala', appearanceFee: 450 });

    // 4. Locked, but reopened right now.
    await deal(ev.reopened, { name: 'Open Brunch', appearanceFee: 450, cc: { terms_reopen: { at: '2026-10-15T10:00:00Z', by: { id: 'x', name: 'Evoni' } } } });
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, created_at, updated_at)
               VALUES (:id, :event, 'A post', 'pulse_post', true, 'brand', 115, 'pending', NOW(), NOW())`,
    { id: d.post, event: ev.reopened });
    await lock(ev.reopened, ep.reopened);
  });

  afterAll(async () => {
    await run(`DELETE FROM deal_price_snapshots WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
    await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
    await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
    await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
    await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  it('snapshots an agreed deal from its own locked numbers and skips the rest', async () => {
    const snappedBefore = await snapshotOf(ev.snapped);
    const counts = await migration.up(qi(), Sequelize);
    expect(counts.backfilled).toBeGreaterThanOrEqual(1);

    const rows = await snapshotOf(ev.agreed);
    expect(rows.map((r) => [r.line_kind, r.line_key, r.deliverable_type, r.quantity, r.total, r.reason])).toEqual([
      ['component', 'appearance_fee', null, 1, 480, 'backfill'],
      ['deliverable', d.video, 'pulse_video', 1, 240, 'backfill'],
    ]);
    // No priced_from on the deal: which card row priced it is not known, so none is claimed.
    for (const r of rows) {
      expect(r).toMatchObject({ career_tier: 3, unit_price: null, rate_anchor_id: null, rate_version: null });
      expect(new Date(r.taken_at).toISOString()).toBe(briefAt);
    }

    expect(await snapshotOf(ev.snapped)).toEqual(snappedBefore);
    expect(await snapshotOf(ev.draft)).toEqual([]);
    expect(await snapshotOf(ev.reopened)).toEqual([]);
  });

  it('a second run adds nothing', async () => {
    const before = await q(`SELECT count(*)::int AS n FROM deal_price_snapshots WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
    await migration.up(qi(), Sequelize);
    const after = await q(`SELECT count(*)::int AS n FROM deal_price_snapshots WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
    expect(after).toEqual(before);
    expect(before).toEqual([{ n: 3 }]);
  });

  it('records the rate row when priced_from names the version and band', async () => {
    const [anchor] = await q(`SELECT id, amount, version FROM deal_rate_anchors
                               WHERE component = 'paid_appearance' AND career_tier = 3 AND deleted_at IS NULL ORDER BY version DESC LIMIT 1`);
    await run(`DELETE FROM deal_price_snapshots WHERE event_id = :event`, { event: ev.agreed });
    await run(`UPDATE world_events SET canon_consequences = :cc WHERE id = :event`,
      { event: ev.agreed, cc: JSON.stringify({ automation: { priced_from: { version: anchor.version, career_tier: 3 } } }) });
    await migration.up(qi(), Sequelize);
    const [appearance] = await snapshotOf(ev.agreed);
    expect(appearance).toMatchObject({ line_key: 'appearance_fee', total: 480, unit_price: Number(anchor.amount), rate_anchor_id: anchor.id, rate_version: anchor.version });
  });

  it('down removes only the backfill rows', async () => {
    const snappedBefore = await snapshotOf(ev.snapped);
    await migration.down(qi(), Sequelize);
    expect(await snapshotOf(ev.agreed)).toEqual([]);
    expect(await snapshotOf(ev.snapped)).toEqual(snappedBefore);
    expect(snappedBefore).toHaveLength(1);
  });

  it('lockedAt prefers the latest relock, then the brief', () => {
    const cc = { terms_history: [
      { action: 'terms_reopened', at: '2026-10-05T00:00:00Z' },
      { action: 'terms_relocked', at: '2026-10-06T00:00:00Z' },
      { action: 'terms_relocked', at: '2026-10-08T00:00:00Z' },
    ] };
    expect(migration.lockedAt(cc, briefAt).toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(migration.lockedAt({}, briefAt).toISOString()).toBe(briefAt);
    expect(migration.lockedAt({}, null)).toBeNull();
  });
});
