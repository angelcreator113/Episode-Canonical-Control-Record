/**
 * The daily update (automation step 2; services/dailyUpdate, GET
 * /api/v1/daily-update). Against the test database, through the routes:
 *   - since yesterday: a post that went live (the gate's own marked auto), a
 *     draft scheduled, a new character, a fact change, a voice built, a
 *     finding fixed
 *   - waiting: a draft, an unapproved voice, a candidate secret, an offered
 *     deal and open findings; each decided through its own endpoint leaves
 *     the list (voice approve, secret keep, deal decline, draft publish)
 *   - coming up: a scheduled post, an episode airing and its event, a deal's
 *     shoot date; today's AI spend and where it went
 *   - Dr. Sinclair (a confidential professional) is in none of it
 *   - ADMIN only; since must be before now
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const HOUR = 60 * 60 * 1000;

(shouldSkip ? describe.skip : describe)('The daily update', () => {
  let admin;
  let user;
  const ids = {
    show: uuid(), reg: uuid(), maren: uuid(), dr: uuid(), episode: uuid(), event: uuid(),
    live: uuid(), autoLive: uuid(), draft: uuid(), scheduled: uuid(), voice: uuid(), drVoice: uuid(),
    secret: uuid(), drSecret: uuid(), deal: uuid(), dealSoon: uuid(),
  };
  const tag = ids.show.slice(0, 8);
  const later = (h) => new Date(Date.now() + h * HOUR);
  const get = (token = admin, q = '') => request(app).get(`/api/v1/daily-update${q}`).set('Authorization', `Bearer ${token}`);
  const group = (body, key) => body.waiting.find((g) => g.key === key);
  const has = (list, id) => list.some((x) => x.id === id);

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-daily', email: 'evoni@daily.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-daily', email: 'user@daily.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    const r = { ...ids, tag, soon: later(5), air: later(30), shoot: later(40).toISOString().slice(0, 10) };
    await run("INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())", { ...r, name: `Daily ${tag}`, slug: `daily-${tag}` });
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Daily registry', NOW(), NOW())", r);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'Daily Maren', 'lalaverse', NOW(), NOW())`, { ...r, key: `daily-maren-${tag}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, extra_fields, created_at, updated_at)
               VALUES (:dr, :reg, :key, 'Daily Dr. Sinclair', 'lalaverse', '{"classification":"confidential_professional"}', NOW(), NOW())`, { ...r, key: `daily-dr-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, episode_number, title, air_date, created_at, updated_at)
               VALUES (:episode, :show, 901, 'Daily episode', :air, NOW(), NOW())`, r);
    await run(`INSERT INTO world_events (id, show_id, name, used_in_episode_id, created_at, updated_at)
               VALUES (:event, :show, 'Daily gala', :episode, NOW(), NOW())`, r);
    const post = (id, extra) => run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, status, ai_generated, gate_json, release_state, release_at, posted_at, created_at, updated_at)
      VALUES (:id, :show, '@dailymaren', :text, :status, :ai, CAST(:gate AS JSONB), :rs, :ra, :pa, NOW(), NOW())`,
      { id, show: ids.show, text: `Post ${id.slice(0, 4)}`, status: 'draft', ai: false, gate: null, rs: null, ra: null, pa: null, ...extra });
    await post(ids.live, { status: 'live', pa: new Date() });
    await post(ids.autoLive, { status: 'live', ai: true, gate: JSON.stringify({ pass: true }), pa: new Date() });
    await post(ids.draft, {});
    await post(ids.scheduled, { rs: 'scheduled', ra: r.soon });
    await run('INSERT INTO pulse_voices (id, registry_character_id, built_at, created_at, updated_at) VALUES (:voice, :maren, NOW(), NOW(), NOW())', r);
    await run('INSERT INTO pulse_voices (id, registry_character_id, built_at, created_at, updated_at) VALUES (:drVoice, :dr, NOW(), NOW(), NOW())', r);
    await run("INSERT INTO character_secrets (id, registry_character_id, text, status, created_at, updated_at) VALUES (:secret, :maren, 'She rehearses what she will say.', 'candidate', NOW(), NOW())", r);
    await run("INSERT INTO character_secrets (id, registry_character_id, text, status, created_at, updated_at) VALUES (:drSecret, :dr, 'A client confided.', 'candidate', NOW(), NOW())", r);
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, payment_amount, created_at, updated_at)
               VALUES (:deal, :show, 'Velour cover', 'editorial', 'offered', 'Velour', 1200, NOW(), NOW())`, r);
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, shoot_date, created_at, updated_at)
               VALUES (:dealSoon, :show, 'Aura campaign', 'campaign', 'booked', :shoot, NOW(), NOW())`, r);
    await run(`INSERT INTO consistency_flag_log (registry_character_id, registry_id, flag_id, check_key, status)
               VALUES (:maren, :reg, 'aaaaaaaaaaaa', 'followers', 'open'), (:maren, :reg, 'bbbbbbbbbbbb', 'handle', 'open'),
                      (:maren, :reg, 'cccccccccccc', 'income', 'fixed'), (:dr, :reg, 'dddddddddddd', 'handle', 'open')`, r);
    await run(`UPDATE consistency_flag_log SET resolved_at = NOW() WHERE registry_character_id = :maren AND status = 'fixed'`, r);
    await run(`INSERT INTO character_fact_changes (registry_character_id, show_id, fact_key, before_value, after_value, reason, source)
               VALUES (:maren, :show, 'occupation', NULL, '"Designer"', 'Suggested from their profile', 'fact_sheet')`, r);
    await run("INSERT INTO ai_usage_logs (route_name, model_name, cost_usd, created_at) VALUES ('daily-test-feature', 'claude-sonnet-4-6', 0.25, NOW())");
  });

  afterAll(async () => {
    const r = ids;
    await run('DELETE FROM ai_usage_logs WHERE route_name = \'daily-test-feature\'');
    await run('DELETE FROM character_fact_changes WHERE registry_character_id IN (:maren, :dr)', r);
    await run('DELETE FROM consistency_flag_log WHERE registry_character_id IN (:maren, :dr)', r);
    await run('DELETE FROM opportunities WHERE id IN (:deal, :dealSoon)', r);
    await run('DELETE FROM character_secrets WHERE registry_character_id IN (:maren, :dr)', r);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:maren, :dr)', r);
    await run('DELETE FROM feed_posts WHERE show_id = :show', r);
    await run('DELETE FROM world_events WHERE id = :event', r);
    await run('DELETE FROM episodes WHERE id = :episode', r);
    await run('DELETE FROM registry_characters WHERE id IN (:maren, :dr)', r);
    await run('DELETE FROM character_registries WHERE id = :reg', r);
    await run('DELETE FROM shows WHERE id = :show', r);
  });

  it('is ADMIN only', async () => {
    expect((await get(user)).status).toBe(403);
  });

  it('since must be before now', async () => {
    const res = await get(admin, `?since=${encodeURIComponent(later(1).toISOString())}`);
    expect(res.status).toBe(400);
  });

  it('since yesterday: what went live (the gate\'s own marked auto), what was scheduled, who is new, what changed on its own', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const s = res.body.since_yesterday;
    const live = s.went_live.items;
    expect(has(live, ids.live)).toBe(true);
    expect(live.find((p) => p.id === ids.autoLive).auto).toBe(true);
    expect(live.find((p) => p.id === ids.live).auto).toBe(false);
    expect(live.find((p) => p.id === ids.live).show).toBe(`Daily ${tag}`);
    expect(has(s.scheduled.items, ids.scheduled)).toBe(true);
    expect(has(s.new_characters.items, ids.maren)).toBe(true);
    expect(has(s.new_characters.items, ids.dr)).toBe(false);
    const fact = s.automatic.facts.find((f) => f.character_id === ids.maren);
    expect(fact).toMatchObject({ fact: 'occupation', to: 'Designer', name: 'Daily Maren' });
    expect(s.automatic.voices_built.some((v) => v.character_id === ids.maren)).toBe(true);
    expect(s.automatic.voices_built.some((v) => v.character_id === ids.dr)).toBe(false);
    expect(s.automatic.findings_resolved.fixed).toBeGreaterThanOrEqual(1);
  });

  it('waiting: drafts, voices, secrets, deals and findings, with Dr. Sinclair in none of them', async () => {
    const { body } = await get();
    expect(body.waiting.map((g) => g.key)).toEqual(['drafts', 'voices', 'secrets', 'deals', 'findings']);
    const drafts = group(body, 'drafts').items;
    expect(has(drafts, ids.draft)).toBe(true);
    expect(has(drafts, ids.scheduled)).toBe(false);
    expect(has(group(body, 'voices').items, ids.voice)).toBe(true);
    expect(has(group(body, 'voices').items, ids.drVoice)).toBe(false);
    expect(group(body, 'secrets').items.find((x) => x.id === ids.secret)).toMatchObject({ character_id: ids.maren, text: 'She rehearses what she will say.' });
    expect(has(group(body, 'secrets').items, ids.drSecret)).toBe(false);
    expect(group(body, 'deals').items.find((x) => x.id === ids.deal)).toMatchObject({ brand: 'Velour', amount: 1200, show: `Daily ${tag}` });
    expect(group(body, 'deals').link).toBe('/admin?tab=opportunities');
    const findings = group(body, 'findings');
    expect(findings.read_only).toBe(true);
    expect(findings.items.find((x) => x.character_id === ids.maren).open).toBe(2);
    expect(findings.items.some((x) => x.character_id === ids.dr)).toBe(false);
    expect(group(body, 'voices').total).toBeGreaterThanOrEqual(1);
  });

  it('coming up: the scheduled post, the episode airing and its event, a deal\'s shoot date', async () => {
    const { body } = await get();
    const c = body.coming_up;
    expect(has(c.posts, ids.scheduled)).toBe(true);
    expect(c.episodes.find((e) => e.id === ids.episode)).toMatchObject({ number: 901, title: 'Daily episode' });
    expect(c.events.find((e) => e.id === ids.event)).toMatchObject({ name: 'Daily gala', episode_number: 901 });
    expect(c.deals.find((d) => d.id === ids.dealSoon).dates.map((d) => d.kind)).toEqual(['Shoot']);
  });

  it('cost: today\'s spend against the budget, and where it went', async () => {
    const { body } = await get();
    expect(body.cost.budget_usd).toBeGreaterThan(0);
    expect(typeof body.cost.spent_usd).toBe('number');
    expect(body.cost.features.find((f) => f.feature === 'daily-test-feature')).toMatchObject({ calls: 1 });
  });

  it('deciding through each item\'s own endpoint takes it off the list', async () => {
    const auth = { Authorization: `Bearer ${admin}` };
    expect((await request(app).post(`/api/v1/pulse-voices/${ids.voice}/approve`).set(auth)).status).toBe(200);
    expect((await request(app).put(`/api/v1/cast/characters/${ids.maren}/secrets/${ids.secret}`).set(auth).send({ status: 'confirmed' })).status).toBe(200);
    expect((await request(app).post(`/api/v1/opportunities/${ids.show}/${ids.deal}/advance`).set(auth).send({ to_status: 'declined' })).status).toBe(200);
    expect((await request(app).put(`/api/v1/feed-posts/${ids.draft}`).set(auth).send({ status: 'live' })).status).toBe(200);
    const { body } = await get();
    expect(has(group(body, 'voices').items, ids.voice)).toBe(false);
    expect(has(group(body, 'secrets').items, ids.secret)).toBe(false);
    expect(has(group(body, 'deals').items, ids.deal)).toBe(false);
    expect(has(group(body, 'drafts').items, ids.draft)).toBe(false);
    expect(has(body.since_yesterday.went_live.items, ids.draft)).toBe(true);
  });
});
