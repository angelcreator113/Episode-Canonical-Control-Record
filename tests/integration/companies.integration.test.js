/**
 * Brand and company profiles (Evoni, 2026-10-18; services/brandProfile,
 * routes/companyRoutes, migration 20261019100000-company-kinds). Against the
 * test database, through the routes:
 *   - the migration: every company is a 'brand' unless said otherwise, the
 *     press outlets are added, deals are linked by name (a name no company
 *     has stays as typed), and the down takes it all back out
 *   - a brand's profile has its seven tabs, an outlet and a venue theirs
 *   - Evoni adds and edits companies (ADMIN only; reads need a sign-in)
 *   - a deal made with a typed name is linked to that company
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261019100000-company-kinds');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const columns = async (table) => (await q('SELECT column_name FROM information_schema.columns WHERE table_name = :table', { table })).map((c) => c.column_name);

(shouldSkip ? describe.skip : describe)('Brands and companies', () => {
  let admin;
  let user;
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), velourDeal: uuid(), strangerDeal: uuid(), madeDeal: null, venue: null, event: uuid() };
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-co', email: 'evoni@co.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-co', email: 'user@co.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Companies ${tag}`, slug: `companies-${tag}` });
  });

  afterAll(async () => {
    await run('DELETE FROM opportunities WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run(`DELETE FROM lalaverse_brands WHERE slug LIKE :like`, { like: `%${tag}%` });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('the migration: kinds, the press outlets, deals linked by name; the down takes it back out', async () => {
    await migration.down(sequelize.getQueryInterface());
    expect(await columns('lalaverse_brands')).not.toContain('kind');
    expect(await columns('opportunities')).not.toContain('company_id');
    expect(await q("SELECT 1 FROM lalaverse_brands WHERE slug = 'the_real_rate'")).toHaveLength(0);

    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, created_at, updated_at)
               VALUES (:velourDeal, :show, 'Velour cover', 'editorial', 'offered', '  velour   ATELIER ', NOW(), NOW()),
                      (:strangerDeal, :show, 'Maison deal', 'campaign', 'offered', 'Maison Belle', NOW(), NOW())`, ids);
    await migration.up(sequelize.getQueryInterface());

    expect(await columns('lalaverse_brands')).toContain('kind');
    const kinds = await q("SELECT slug, kind FROM lalaverse_brands WHERE deleted_at IS NULL AND slug IN ('velour_atelier', 'the_real_rate', 'undressed', 'first_look', 'the_cost_of_wanting_more')");
    expect(Object.fromEntries(kinds.map((k) => [k.slug, k.kind]))).toEqual({
      velour_atelier: 'brand', the_real_rate: 'outlet', undressed: 'outlet', first_look: 'outlet', the_cost_of_wanting_more: 'outlet',
    });
    const [velour] = await q("SELECT id FROM lalaverse_brands WHERE slug = 'velour_atelier'");
    const deals = await q('SELECT id, company_id, brand_or_company FROM opportunities WHERE show_id = :show ORDER BY name', ids);
    expect(deals.find((d) => d.id === ids.velourDeal)).toMatchObject({ company_id: velour.id, brand_or_company: '  velour   ATELIER ' });
    expect(deals.find((d) => d.id === ids.strangerDeal)).toMatchObject({ company_id: null, brand_or_company: 'Maison Belle' });

    // Run again: nothing doubles.
    await migration.up(sequelize.getQueryInterface());
    expect(await q("SELECT 1 FROM lalaverse_brands WHERE slug = 'the_real_rate'")).toHaveLength(1);
    // A new row is a brand unless it says otherwise.
    await run(`INSERT INTO lalaverse_brands (id, slug, name, created_at, updated_at) VALUES (:id, :slug, :name, NOW(), NOW())`, { id: uuid(), slug: `plain_${tag}`, name: `Plain ${tag}` });
    const [plain] = await q('SELECT kind FROM lalaverse_brands WHERE slug = :slug', { slug: `plain_${tag}` });
    expect(plain.kind).toBe('brand');
  });

  it('reads need a sign-in; adding and editing are ADMIN only', async () => {
    expect((await request(app).get('/api/v1/companies')).status).toBe(401);
    expect((await as(request(app).get('/api/v1/companies'), user)).status).toBe(200);
    expect((await as(request(app).post('/api/v1/companies'), user).send({ name: `Nope ${tag}` })).status).toBe(403);
    expect((await as(request(app).put('/api/v1/companies/velour_atelier'), user).send({ description: 'x' })).status).toBe(403);
  });

  it('the list: brands first, then the press', async () => {
    const res = await as(request(app).get('/api/v1/companies'), user);
    const kinds = res.body.companies.map((c) => c.kind);
    expect(kinds.indexOf('outlet')).toBeGreaterThan(kinds.lastIndexOf('brand'));
    expect(res.body.companies.find((c) => c.slug === 'velour_atelier')).toMatchObject({ kind_label: 'Fashion brand', defining_principle: 'Nothing extraneous' });
    const press = await as(request(app).get('/api/v1/companies?kind=outlet'), user);
    expect(press.body.companies.every((c) => c.kind === 'outlet')).toBe(true);
    expect((await as(request(app).get('/api/v1/companies?kind=bank'), user)).status).toBe(400);
  });

  it('a brand\'s profile: its eight tabs, identity in three layers, its deal and its relationships', async () => {
    const res = await as(request(app).get('/api/v1/companies/velour_atelier'), user);
    expect(res.status).toBe(200);
    expect(res.body.sections.map((s) => s.key)).toEqual(['identity', 'people', 'pulse', 'business', 'pictures', 'wardrobe', 'press', 'relationships']);
    expect(res.body.identity.beliefs.find((f) => f.key === 'defining_principle').value).toBe('Nothing extraneous');
    expect(res.body.people.people.find((p) => p.key === 'vivienne_laurent')).toMatchObject({ title: 'Creative Director', authority: { finalize: 'none' } });
    expect(res.body.business.find((d) => d.id === ids.velourDeal)).toMatchObject({ linked: true, name: 'Velour cover', event_id: null });
    expect(res.body.relationships.map((r) => r.slug)).toContain('carte_blanche');
    expect(res.body.wardrobe).toEqual(expect.any(Array));
    expect(res.body.press).toMatchObject({ coverage: expect.any(Array), posts: expect.any(Array), events: expect.any(Array) });
    expect((await as(request(app).get('/api/v1/companies/no_such_company'), user)).status).toBe(404);
  });

  it('Evoni adds a venue; its profile shows the events held there; an outlet has its own tabs', async () => {
    const made = await as(request(app).post('/api/v1/companies')).send({ name: `The Glass Room ${tag}`, kind: 'venue', description: 'A rooftop.' });
    expect(made.status).toBe(201);
    expect(made.body.company).toMatchObject({ kind: 'venue', kind_label: 'Venue' });
    expect(made.body.sections.map((s) => s.key)).toEqual(['identity', 'business', 'pictures', 'press']);
    ids.venue = made.body.company.slug;
    expect((await as(request(app).post('/api/v1/companies')).send({ name: ` the glass  room ${tag} ` })).status).toBe(409);
    expect((await as(request(app).post('/api/v1/companies')).send({ name: 'X', kind: 'bank' })).status).toBe(400);

    await run(`INSERT INTO world_events (id, show_id, name, venue_name, created_at, updated_at) VALUES (:event, :show, 'Rooftop gala', :venue, NOW(), NOW())`, { ...ids, venue: `The Glass Room ${tag}` });
    const venue = await as(request(app).get(`/api/v1/companies/${ids.venue}`), user);
    expect(venue.body.press.events.map((e) => e.name)).toEqual(['Rooftop gala']);
    expect(venue.body.people).toBeNull();

    const outlet = await as(request(app).get('/api/v1/companies/the_real_rate'), user);
    expect(outlet.body.sections.map((s) => s.key)).toEqual(['identity', 'people', 'pulse', 'business', 'pictures', 'press']);
    expect(outlet.body.identity.history.find((f) => f.key === 'founder').value).toBe('Reyna Voss');
  });

  it('Evoni edits a company\'s identity: its history and its beliefs, kept apart', async () => {
    const res = await as(request(app).put(`/api/v1/companies/${ids.venue}`)).send({ niche: 'Late dinners.', defining_principle: 'The view is the point', earns_trust: 'Arriving on time\nTipping well' });
    expect(res.status).toBe(200);
    expect(res.body.identity.history.find((f) => f.key === 'niche').value).toBe('Late dinners.');
    expect(res.body.identity.beliefs.find((f) => f.key === 'earns_trust').value).toEqual(['Arriving on time', 'Tipping well']);
    expect((await as(request(app).put(`/api/v1/companies/${ids.venue}`)).send({ name: 'Velour Atelier' })).status).toBe(409);
    expect((await as(request(app).put(`/api/v1/companies/${ids.venue}`)).send({})).status).toBe(400);
  });

  it('a deal made with a typed company name is linked to it; a picked company fills its name', async () => {
    const typed = await as(request(app).post(`/api/v1/opportunities/${ids.show}`)).send({ name: 'Glass dinner', opportunity_type: 'editorial', brand_or_company: `the glass room ${tag}` });
    expect(typed.status).toBe(201);
    const [venue] = await q('SELECT id FROM lalaverse_brands WHERE slug = :slug', { slug: ids.venue });
    expect(typed.body.opportunity.company_id).toBe(venue.id);
    const picked = await as(request(app).post(`/api/v1/opportunities/${ids.show}`)).send({ name: 'Picked', opportunity_type: 'editorial', company_id: venue.id });
    expect(picked.body.opportunity).toMatchObject({ company_id: venue.id, brand_or_company: `The Glass Room ${tag}` });
    const retyped = await as(request(app).put(`/api/v1/opportunities/${ids.show}/${typed.body.opportunity.id}`)).send({ brand_or_company: 'Someone else' });
    expect(retyped.body.opportunity.company_id).toBeNull();
    expect((await as(request(app).post(`/api/v1/opportunities/${ids.show}`)).send({ name: 'Bad', company_id: uuid() })).status).toBe(400);
  });

  // Evoni, 2026-10-19: a brand's page shows its library pictures and each deal's deliverable progress.
  it('its Pictures read the library with its visibility rules, and a deal with an event carries its progress', async () => {
    const media = require('../../src/services/mediaLibrary');
    const models = require('../../src/models');
    const [velour] = await q("SELECT id FROM lalaverse_brands WHERE slug = 'velour_atelier'");
    const link = [{ entity_type: 'brand', entity_id: velour.id, role: 'owner' }];
    const made = [];
    const dealEvent = uuid();
    try {
      for (const [caption, status, visibility] of [['Velour lookbook', 'approved', 'internal'], ['Velour private', 'approved', 'private'], ['Velour draft', 'draft', 'internal']]) {
        made.push((await media.createAsset(models, { url: `https://img.test/${caption.replace(/\s/g, '-')}-${tag}.png`, caption, status, visibility, links: link })).asset.id);
      }
      const url = `/api/v1/media?entity_type=brand&entity_id=${velour.id}`;
      const asUser = (await as(request(app).get(url), user)).body.items.map((a) => a.caption);
      expect(asUser).toContain('Velour lookbook');
      expect(asUser).not.toContain('Velour private');
      expect(asUser).not.toContain('Velour draft');
      const asAdmin = (await as(request(app).get(url))).body.items.map((a) => a.caption);
      expect(asAdmin).toEqual(expect.arrayContaining(['Velour lookbook', 'Velour private', 'Velour draft']));

      await run(`INSERT INTO world_events (id, show_id, name, created_at, updated_at) VALUES (:dealEvent, :show, 'Velour cover shoot', NOW(), NOW())`, { ...ids, dealEvent });
      await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, quantity, owed_to, created_at, updated_at)
                 VALUES (:id, :dealEvent, 'Three stories from the shoot', 'pulse_stories', 3, 'brand', NOW(), NOW())`, { id: uuid(), dealEvent });
      await run('UPDATE opportunities SET event_id = :dealEvent WHERE id = :velourDeal', { ...ids, dealEvent });
      const profile = await as(request(app).get('/api/v1/companies/velour_atelier'), user);
      expect(profile.body.sections.map((s) => s.key)).toContain('pictures');
      expect(profile.body.business.find((d) => d.id === ids.velourDeal)).toMatchObject({ event_id: dealEvent });
      const progress = await as(request(app).get(`/api/v1/deliverable-progress/opportunities/${ids.velourDeal}`), user);
      expect(progress.status).toBe(200);
      expect(progress.body).toMatchObject({ countable: 1, done: 0, all_done: false });
    } finally {
      if (made.length) {
        await run('DELETE FROM media_asset_links WHERE asset_id IN (:made)', { made });
        await run('DELETE FROM media_assets WHERE id IN (:made)', { made });
      }
      await run('UPDATE opportunities SET event_id = NULL WHERE id = :velourDeal', ids);
      await run('DELETE FROM event_deliverables WHERE event_id = :dealEvent', { dealEvent });
      await run('DELETE FROM world_events WHERE id = :dealEvent', { dealEvent });
    }
  });
});
