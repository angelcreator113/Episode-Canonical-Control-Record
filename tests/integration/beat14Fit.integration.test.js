/**
 * Beat 14's candidates ranked by fit with the episode's event, and "Suggest
 * one" (Evoni, 2026-10-25: "Yes build the weekly release and beat 14
 * ranking"). On the test database.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261019140000-opportunity-offered-in-episode');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const TAG = uuid().slice(0, 8);
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("Beat 14's ranking and Suggest one", () => {
  const show = uuid();
  const ep = uuid();
  const bare = uuid();
  const ev = uuid();
  const host = uuid();
  const guestBrand = uuid();
  const opp = { brand: uuid(), runway: uuid(), guest: uuid(), none: uuid() };
  const profiles = {};
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (e = ep) => `/api/v1/opportunities/${show}/episode/${e}/beat14`;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-admin-b14fit', email: 'admin@b14fit.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Beat 14 fit ${TAG}`, slug: `b14fit-${TAG}` });
    await run(`INSERT INTO lalaverse_brands (id, slug, name, created_at, updated_at) VALUES
      (:host, :hs, :hn, NOW(), NOW()), (:guestBrand, :gs, :gn, NOW(), NOW())`,
    { host, hs: `maison-${TAG}`, hn: `Maison ${TAG}`, guestBrand, gs: `velour-${TAG}`, gn: `Velour ${TAG}` });
    for (const who of ['host', 'guest', 'outsider']) {
      const fp = who === 'guest' ? { lalaverse_brand_id: guestBrand } : {};
      const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, full_profile, created_at, updated_at)
        VALUES (:h, 'instagram', 'test', :name, 'lalaverse', CAST(:fp AS jsonb), NOW(), NOW()) RETURNING id`,
      { h: `${who}${TAG}`, name: `${who[0].toUpperCase()}${who.slice(1)} ${TAG}`, fp: JSON.stringify(fp) });
      profiles[who] = p.id;
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep, :show, 'The Runway', 5, 'draft', NOW(), NOW()), (:bare, :show, 'No Event', 6, 'draft', NOW(), NOW())`, { ep, bare, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, format, host_brand, prestige, status, used_in_episode_id, source_profile_id, canon_consequences, created_at, updated_at)
      VALUES (:ev, :show, 'Spring Showcase', 'invite', 'showcase', :brand, 7, 'used', :ep, :host, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ev, show, ep, brand: `Maison ${TAG}`, host: profiles.host, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: profiles.guest }] } }) });
    // Oldest first, so created_at order (newest first) is none, guest, runway, brand.
    const ins = (id, name, type, prestige, extra, minutes) => run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, prestige, company_id, brand_or_company, status_history, created_at, updated_at)
      VALUES (:id, :show, :name, :type, 'offered', :prestige, :company, :bname, CAST('[]' AS jsonb), NOW() - (:m || ' minutes')::interval, NOW())`,
    { id, show, name, type, prestige, company: extra.company || null, bname: extra.bname || null, m: String(minutes) });
    await ins(opp.brand, 'Maison Campaign', 'campaign', 2, { company: host }, 40);
    await ins(opp.runway, 'Runway Walk', 'runway', 7, {}, 30);
    await ins(opp.guest, 'Velour Gifting', 'pr_gifting', 2, { bname: `Velour ${TAG}` }, 20);
    await ins(opp.none, 'Podcast Chat', 'podcast', 2, {}, 10);
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM opportunities WHERE show_id = :show', { show });
    await run('DELETE FROM world_events WHERE id = :ev', { ev });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(profiles) });
    await run('DELETE FROM lalaverse_brands WHERE id IN (:ids)', { ids: [host, guestBrand] });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  test('the candidates come best fit first, each with its reasons; the rest keep their order below', async () => {
    const res = await auth(request(app).get(url()));
    expect(res.status).toBe(200);
    const c = res.body.data.candidates;
    expect(c.map((x) => x.name)).toEqual(['Maison Campaign', 'Velour Gifting', 'Runway Walk', 'Podcast Chat']);
    expect(c[0].fit).toEqual({ score: 5, best: true, reasons: [{ kind: 'brand', text: 'Same brand as the host' }] });
    expect(c[1].fit.reasons).toEqual([{ kind: 'brand', text: `Same brand as a guest, Guest ${TAG}` }]);
    expect(c[1].fit).toMatchObject({ score: 4, best: false });
    expect(c[2].fit.reasons.map((r) => r.text)).toEqual(['Runway suits a showcase', "Prestige 7, as the event's"]);
    expect(c[2].fit.best).toBe(false);
    expect(c[3].fit).toEqual({ score: 0, best: false, reasons: [] });
  });

  test('Suggest one drafts from the host by default, or from the guest picked, and saves nothing', async () => {
    const before = (await run('SELECT COUNT(*)::int AS n FROM opportunities WHERE show_id = :show', { show }))[0][0].n;
    const res = await auth(request(app).get(`${url()}/suggest`));
    expect(res.status).toBe(200);
    expect(res.body.data.draft).toMatchObject({
      name: `Maison ${TAG} runway booking`,
      opportunity_type: 'runway',
      connector_profile_id: profiles.host,
      brand: `Maison ${TAG}`,
    });
    expect(res.body.data.draft.pitch).toBe(`Host ${TAG} hosted Spring Showcase and wants Lala for a runway booking with Maison ${TAG}.`);
    const guest = await auth(request(app).get(`${url()}/suggest?from=${profiles.guest}`));
    expect(guest.status).toBe(200);
    expect(guest.body.data.draft).toMatchObject({ name: `Velour ${TAG} runway booking`, connector_profile_id: profiles.guest });
    const after = (await run('SELECT COUNT(*)::int AS n FROM opportunities WHERE show_id = :show', { show }))[0][0].n;
    expect(after).toBe(before);
  });

  test('Suggest one: signed out is 401, an unknown episode 404, someone not at the event 400, an episode with no event 400', async () => {
    expect((await request(app).get(`${url()}/suggest`)).status).toBe(401);
    expect((await auth(request(app).get(`${url(uuid())}/suggest`))).status).toBe(404);
    expect((await auth(request(app).get(`${url()}/suggest?from=${profiles.outsider}`))).status).toBe(400);
    expect((await auth(request(app).get(`${url(bare)}/suggest`))).status).toBe(400);
    expect((await auth(request(app).get(`/api/v1/opportunities/${show}/episode/nope/beat14/suggest`))).status).toBe(400);
  });
});
