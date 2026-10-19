/**
 * The rate card editor (services/rateCard, routes/dealPricing; Evoni,
 * 2026-10-19). Through the real routes: an ADMIN edits a price, which writes
 * the next version and records who and what; a new draft is priced from it
 * and records the rate row, the amount then and the band; a deal whose
 * terms are locked keeps its numbers; an agreed deal's frozen price
 * snapshot (services/dealPriceSnapshot) is taken at Start Episode and no
 * later card edit changes it. The versions this suite writes are
 * removed afterwards, so the card the other suites read stays at its seeded
 * version.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('The editable rate card', () => {
  let admin;
  let user;
  let baseline;
  const shows = [];

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-rates', email: 'evoni@rates.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-rates', email: 'user@rates.dev', name: 'User', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    const [row] = await q('SELECT MAX(version) AS v FROM deal_rate_anchors WHERE deleted_at IS NULL');
    baseline = Number(row.v);
  });

  afterAll(async () => {
    for (const t of ['deal_rate_anchors', 'deal_rate_premiums', 'deal_rate_card_versions']) {
      await run(`DELETE FROM ${t} WHERE version > :baseline`, { baseline });
    }
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM deal_price_snapshots WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const as = (token, r) => r.set('Authorization', `Bearer ${token}`);

  async function seed({ dealType, tier, deliverables = [] }) {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Rates ${ids.show.slice(0, 8)}`, slug: `rates-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', :dealType, :tier, 'ready', NOW(), NOW())`, { ...ids, dealType, tier });
    ids.d = {};
    for (const d of deliverables) {
      const res = await as(user, request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables`)).send(d);
      expect(res.status).toBe(201);
      ids.d[d.deliverable_type] = res.body.deliverable.id;
    }
    return ids;
  }

  const propose = (ids) => as(user, request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/propose-terms`)).send({});
  const save = (token, body) => as(token, request(app).put('/api/v1/deal-rates')).send(body);
  const dealOf = async (ids) => {
    const [ev] = await q('SELECT appearance_fee, pricing_version, canon_consequences FROM world_events WHERE id = :event', ids);
    const fees = await q('SELECT id, deliverable_type, fee FROM event_deliverables WHERE event_id = :event AND deleted_at IS NULL', ids);
    return { ...ev, automation: asJson(ev.canon_consequences)?.automation || {}, fees };
  };

  it('reads the card as a table with its versions, for any signed-in person', async () => {
    const res = await as(user, request(app).get('/api/v1/deal-rates/editor'));
    expect(res.status).toBe(200);
    expect(res.body.table.version).toBe(baseline);
    expect(res.body.table.tiers.map((t) => t.label)).toEqual(['Emerging', 'Rising', 'Established', 'Influential', 'Elite']);
    const video = res.body.table.anchors.find((a) => a.component === 'pulse_video');
    expect(video).toMatchObject({ label: 'Pulse video', amounts: { 3: 225 } });
    expect(res.body.versions.map((v) => v.version)).toContain(baseline);
  });

  it('only an ADMIN saves, and a save that changes nothing or is out of date is refused', async () => {
    const edit = { based_on: baseline, changes: { anchors: [{ component: 'pulse_video', career_tier: 3, amount: 250 }] } };
    expect((await save(user, edit)).status).toBe(403);
    const same = await save(admin, { based_on: baseline, changes: { anchors: [{ component: 'pulse_video', career_tier: 3, amount: 225 }] } });
    expect(same.status).toBe(400);
    expect(same.body.error).toBe('Nothing changed.');
    const bad = await save(admin, { based_on: baseline, changes: { anchors: [{ component: 'pulse_video', career_tier: 3, amount: -1 }] } });
    expect(bad.status).toBe(400);
    const stale = await save(admin, { ...edit, based_on: baseline - 1 });
    expect(stale.status).toBe(409);
    const [row] = await q('SELECT MAX(version) AS v FROM deal_rate_anchors WHERE deleted_at IS NULL');
    expect(Number(row.v)).toBe(baseline);
  });

  it('an edit writes the next version; a new draft uses it and records the rate; a locked deal keeps its numbers', async () => {
    // A deal agreed before the edit: priced, then its episode started (the terms lock).
    const agreed = await seed({ dealType: 'appearance_plus_deliverables', tier: 3, deliverables: [
      { description: 'One video in the coat', deliverable_type: 'pulse_video', owed_to: 'brand' },
    ] });
    expect((await propose(agreed)).status).toBe(200);
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Episode 1', 1, 'draft', NOW(), NOW())`, { ep, show: agreed.show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:brief, :ep, :show, :event, 'draft', NOW(), NOW())`,
      { brief: uuid(), ep, show: agreed.show, event: agreed.event });
    const before = await dealOf(agreed);
    expect(before.pricing_version).toBe(baseline);
    expect(before.appearance_fee).toBe(450);
    expect(before.fees[0].fee).toBe(225);

    const res = await save(admin, {
      based_on: baseline,
      note: 'Pulse video up at Established',
      changes: {
        anchors: [{ component: 'pulse_video', career_tier: 3, amount: 260 }, { component: 'paid_appearance', career_tier: 3, amount: 500 }],
        premiums: [{ kind: 'paid_ad', key: 'whitelisting', percent: 30 }],
      },
    });
    expect(res.status).toBe(200);
    const next = baseline + 1;
    expect(res.body.saved.version).toBe(next);
    expect(res.body.table.version).toBe(next);
    expect(res.body.table.anchors.find((a) => a.component === 'pulse_video').amounts[3]).toBe(260);
    // Every other cell is copied unchanged.
    expect(res.body.table.anchors.find((a) => a.component === 'pulse_video').amounts[4]).toBe(325);
    expect(res.body.versions[0]).toMatchObject({
      version: next, note: 'Pulse video up at Established', created_by_name: 'Evoni',
      changes: { anchors: [
        { component: 'pulse_video', career_tier: 3, from: 225, to: 260 },
        { component: 'paid_appearance', career_tier: 3, from: 450, to: 500 },
      ], premiums: [{ kind: 'paid_ad', key: 'whitelisting', from: null, to: 30 }] },
    });
    // The version it was edited from is still there, unchanged.
    const [old] = await q(`SELECT amount FROM deal_rate_anchors WHERE version = :v AND component = 'pulse_video' AND career_tier = 3 AND deleted_at IS NULL`, { v: baseline });
    expect(old.amount).toBe(225);

    // A new draft is priced from the edited card and records what priced it.
    const draft = await seed({ dealType: 'appearance_plus_deliverables', tier: 3, deliverables: [
      { description: 'One video in the coat', deliverable_type: 'pulse_video', owed_to: 'brand' },
    ] });
    expect((await propose(draft)).status).toBe(200);
    const priced = await dealOf(draft);
    expect(priced.pricing_version).toBe(next);
    expect(priced.appearance_fee).toBe(500);
    expect(priced.fees[0].fee).toBe(260);
    expect(priced.automation.priced_from).toMatchObject({
      version: next, career_tier: 3, band: 'Established',
      components: { appearance_fee: { rate: { version: next, component: 'paid_appearance', career_tier: 3 }, anchor: 500, fee: 500 } },
      deliverables: { [draft.d.pulse_video]: { rate: { version: next, component: 'pulse_video', career_tier: 3 }, anchor: 260, fee: 260 } },
    });

    // The agreed deal: Propose terms is refused while locked, and nothing moved.
    expect((await propose(agreed)).status).toBe(409);
    const after = await dealOf(agreed);
    expect(after.pricing_version).toBe(baseline);
    expect(after.appearance_fee).toBe(450);
    expect(after.fees[0].fee).toBe(225);
  });

  const snapshotOf = (ids) => q(
    `SELECT line_kind, line_key, deliverable_type, band, career_tier, unit_price, quantity, total, rate_anchor_id, rate_version, taken_at, reason
       FROM deal_price_snapshots WHERE event_id = :event AND deleted_at IS NULL ORDER BY line_kind, line_key`, ids);

  it('Start Episode freezes the agreed prices, and a later card edit never changes them', async () => {
    const ids = await seed({ dealType: 'appearance_plus_deliverables', tier: 3, deliverables: [
      { description: 'Three stories', deliverable_type: 'pulse_stories', quantity: 3, owed_to: 'brand' },
    ] });
    expect((await propose(ids)).status).toBe(200);
    // Not agreed yet: no snapshot.
    expect(await snapshotOf(ids)).toEqual([]);
    const started = await as(user, request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/generate-episode`)).send({});
    expect(started.status).toBeLessThan(300);

    const frozen = await snapshotOf(ids);
    // The card it was priced from: the newest version (the earlier test edited it).
    const [{ v: current }] = await q('SELECT MAX(version) AS v FROM deal_rate_anchors WHERE deleted_at IS NULL');
    const rowOf = async (component) => (await q(
      `SELECT id, amount FROM deal_rate_anchors WHERE version = :v AND component = :component AND career_tier = 3 AND deleted_at IS NULL`,
      { v: current, component }))[0];
    const stories = await rowOf('pulse_stories_3');
    const appearance = await rowOf('paid_appearance');
    expect(frozen).toEqual([
      expect.objectContaining({ line_kind: 'component', line_key: 'appearance_fee', band: 'Established', career_tier: 3, unit_price: appearance.amount, quantity: 1, total: appearance.amount, rate_anchor_id: appearance.id, rate_version: current, reason: 'start_episode' }),
      expect.objectContaining({ line_kind: 'deliverable', line_key: ids.d.pulse_stories, deliverable_type: 'pulse_stories', band: 'Established', unit_price: stories.amount, quantity: 3, total: stories.amount, rate_anchor_id: stories.id, rate_version: current }),
    ]);
    expect(frozen[0].taken_at).toBeTruthy();
    const read = await as(user, request(app).get(`/api/v1/world/${ids.show}/events/${ids.event}/price-snapshot`));
    expect(read.status).toBe(200);
    expect(read.body.snapshot).toHaveLength(2);

    // The card changes under it: the snapshot does not.
    const edited = await save(admin, { changes: { anchors: [
      { component: 'paid_appearance', career_tier: 3, amount: 999 }, { component: 'pulse_stories_3', career_tier: 3, amount: 500 },
    ] } });
    expect(edited.status).toBe(200);
    expect(await snapshotOf(ids)).toEqual(frozen);

    // Locking again (a relock with nothing changed) keeps it as it was, row for row.
    const { takePriceSnapshot } = require('../../src/services/dealPriceSnapshot');
    const again = await takePriceSnapshot(sequelize, ids.event, { reason: 'relocked' });
    expect(again).toMatchObject({ taken: false, kept: true });
    expect(await snapshotOf(ids)).toEqual(frozen);
    expect(await q(`SELECT count(*)::int AS n FROM deal_price_snapshots WHERE event_id = :event`, ids)).toEqual([{ n: 2 }]);

    // And the deal itself is not repriced: Propose terms is refused while agreed.
    expect((await propose(ids)).status).toBe(409);
  });
});
