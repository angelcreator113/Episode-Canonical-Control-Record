/**
 * Brands on The Pulse (Evoni, 2026-10-18; services/brandPulse), against the
 * test database, through the routes, with the AI faked:
 *   - "Give the brands their Pulse accounts" makes each brand one account,
 *     and a second click makes none
 *   - an everyday brand post goes through the gate: a passing one goes out,
 *     a flagged one waits in Review; a rep's post is signed
 *   - this week for every brand: passing posts scheduled, flagged ones in Review
 *   - a reply is drafted, never sent
 *   - a deal announcement is refused before the deal is booked and for a
 *     rep who cannot finalize; once allowed it always waits in Review
 *   - ADMIN only
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('Brands on The Pulse', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), fanPost: uuid(), dealOri: uuid(), dealVelour: uuid() };
  const savedKey = process.env.ANTHROPIC_API_KEY;
  const drafts = [];
  const scores = [];
  let admin;
  let user;
  let fan;
  let brands;
  const created = [];
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockCreate.mockImplementation(async ({ messages }) => {
      const prompt = messages[0].content;
      if (prompt.startsWith('Score how well')) return say(scores.shift() || { score: 0.9, why: 'fits' });
      return say(drafts.shift());
    });
    admin = TokenService.generateTokenPair({ id: 'test-admin-bp', email: 'evoni@bp.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-bp', email: 'user@bp.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `Brand Pulse ${tag}`, slug: `bpulse-${tag}` });
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lala_knows_of, created_at, updated_at)
      VALUES (:handle, 'pulse', 'test', 'Fan', 'lalaverse', true, NOW(), NOW()) RETURNING id`, { handle: `fan${tag}` });
    fan = row.id;
    await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, posted_at, created_at, updated_at)
               VALUES (:fanPost, :show, :fan, :handle, 'Wore Velour Atelier to the opening and felt like a decision.', 'live', NOW(), NOW(), NOW())`,
    { ...ids, fan, handle: `fan${tag}` });
    brands = Object.fromEntries((await q("SELECT id, slug, name FROM lalaverse_brands WHERE kind = 'brand'")).map((b) => [b.slug, b]));
    for (const [id, slug, status] of [[ids.dealOri, 'ori_beauty', 'negotiating'], [ids.dealVelour, 'velour_atelier', 'booked']]) {
      await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, created_at, updated_at)
                 VALUES (:id, :show, :name, 'campaign', :status, :brand, NOW(), NOW())`,
      { id, show: ids.show, name: `${brands[slug].name} campaign ${tag}`, status, brand: brands[slug].name });
    }
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedKey;
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids).catch((err) => console.error(err.message));
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids).catch((err) => console.error(err.message));
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM opportunities WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id = :fan', { fan });
    if (created.length) await run('DELETE FROM social_profiles WHERE id IN (:created)', { created });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => { mockCreate.mockClear(); drafts.length = 0; scores.length = 0; });

  it('is ADMIN only', async () => {
    expect((await as(request(app).get(`/api/v1/brand-pulse?show_id=${ids.show}`), user)).status).toBe(403);
    expect((await as(request(app).post('/api/v1/brand-pulse/accounts'), user)).status).toBe(403);
  });

  it('gives each brand one Pulse account, once', async () => {
    const first = await as(request(app).post('/api/v1/brand-pulse/accounts'));
    expect(first.status).toBe(200);
    created.push(...first.body.created.map((c) => c.id));
    const again = await as(request(app).post('/api/v1/brand-pulse/accounts'));
    expect(again.body.created).toEqual([]);
    const accounts = await q("SELECT full_profile->>'lalaverse_brand_id' AS brand_id, feed_layer, lala_knows_of FROM social_profiles WHERE deleted_at IS NULL AND full_profile->>'lalaverse_brand_id' IS NOT NULL");
    expect(accounts).toHaveLength(Object.keys(brands).length);
    expect(new Set(accounts.map((a) => a.brand_id)).size).toBe(Object.keys(brands).length);
    expect(accounts.every((a) => a.feed_layer === 'lalaverse' && a.lala_knows_of === true)).toBe(true);
    // Each account comes with a suggested posting schedule (services/postingSchedule).
    const schedules = await q("SELECT posting_schedule FROM social_profiles WHERE deleted_at IS NULL AND full_profile->>'lalaverse_brand_id' IS NOT NULL");
    expect(schedules.every((r) => r.posting_schedule && r.posting_schedule.source === 'suggested' && r.posting_schedule.days.length > 0)).toBe(true);
    // An account without one gets it on the next run; one she set is left alone.
    const [noSchedule, setByHer] = await q("SELECT id FROM social_profiles WHERE deleted_at IS NULL AND full_profile->>'lalaverse_brand_id' IS NOT NULL ORDER BY id LIMIT 2");
    const hers = { days: ['sat'], windows: [{ start: '10:00', end: '11:00' }], per_week: 1, tz_offset: 0, source: 'set' };
    await run('UPDATE social_profiles SET posting_schedule = NULL WHERE id = :id', { id: noSchedule.id });
    await run('UPDATE social_profiles SET posting_schedule = CAST(:s AS JSONB) WHERE id = :id', { id: setByHer.id, s: JSON.stringify(hers) });
    await as(request(app).post('/api/v1/brand-pulse/accounts'));
    const [refilled] = await q('SELECT posting_schedule FROM social_profiles WHERE id = :id', { id: noSchedule.id });
    expect(refilled.posting_schedule.source).toBe('suggested');
    const [kept] = await q('SELECT posting_schedule FROM social_profiles WHERE id = :id', { id: setByHer.id });
    expect(kept.posting_schedule).toEqual(hers);
    const view = await as(request(app).get(`/api/v1/brand-pulse?show_id=${ids.show}`));
    expect(view.body.accounts_missing).toBe(0);
    const velour = view.body.brands.find((b) => b.slug === 'velour_atelier');
    expect(velour.account.handle).toMatch(/^velouratelier/);
    expect(velour.reps.map((r) => r.key)).toEqual(['vivienne_laurent']);
  });

  it('an everyday post that passes the gate is scheduled at its suggested time; a rep signs hers; a flagged one waits in Review', async () => {
    drafts.push({ text: 'Nothing extraneous. Ivory, cut close.', hashtag: '#Velour' });
    const ok = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/draft`)).send({ show_id: ids.show });
    expect(ok.status).toBe(200);
    expect(ok.body.published).toBe(false);
    expect(ok.body.review).toEqual([]);
    expect(ok.body.scheduled_at).toBeTruthy();
    const [okPost] = await q('SELECT status, release_state FROM feed_posts WHERE id = :id', { id: ok.body.post.id });
    expect(okPost).toEqual({ status: 'draft', release_state: 'scheduled' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('ESTABLISHED CANON about Velour Atelier');
    expect(prompt).toContain('Never state a new fact about Velour Atelier\'s history');

    drafts.push({ text: 'Elegance is never accidental.', hashtag: null });
    scores.push({ score: 0.2, why: 'off' });
    const held = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/draft`)).send({ show_id: ids.show, rep: 'vivienne_laurent' });
    expect(held.body.published).toBe(false);
    expect(held.body.review).toEqual(['gate']);
    const [post] = await q('SELECT status, content_text FROM feed_posts WHERE id = :id', { id: held.body.post.id });
    expect(post.status).toBe('draft');
    expect(post.content_text).toBe('Elegance is never accidental.\n— Vivienne, Creative Director');

    const wrongHouse = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/draft`)).send({ show_id: ids.show, rep: 'nia_bennett' });
    expect(wrongHouse.status).toBe(400);
  });

  it('this week for every brand: passing posts are scheduled, flagged ones wait, unreadable ones fail', async () => {
    drafts.push({ posts: [
      { brand: 'the_column', rep: null, text: 'Fewer pieces, worn better.', hashtag: null },
      { brand: 'carte_blanche', rep: 'zora_vale', text: 'Tell me what you have decided.', hashtag: null },
      { brand: 'not_a_brand', rep: null, text: 'x' },
    ] });
    scores.push({ score: 0.9, why: 'fits' }, { score: 0.1, why: 'off' });
    const res = await as(request(app).post('/api/v1/brand-pulse/draft-week')).send({ show_id: ids.show });
    expect(res.status).toBe(200);
    expect(res.body.failed).toHaveLength(1);
    const [column, carte] = res.body.routed;
    expect(column.review).toEqual([]);
    expect(column.scheduled_at).toBeTruthy();
    expect(carte.review).toEqual(['gate']);
    expect(carte.rep).toBe('Zora Vale');
    const [row] = await q('SELECT status, release_state FROM feed_posts WHERE id = :id', { id: column.post_id });
    expect(row).toEqual({ status: 'draft', release_state: 'scheduled' });
  });

  it('a reply to a post naming the brand is drafted, never sent', async () => {
    const list = await as(request(app).get(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/replies?show_id=${ids.show}`));
    expect(list.body.posts.map((p) => p.id)).toContain(ids.fanPost);
    drafts.push({ text: 'A decision, worn well.' });
    const res = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/replies`)).send({ post_id: ids.fanPost });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(false);
    expect(res.body.comment.status).toBe('draft');
    const after = await as(request(app).get(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/replies?show_id=${ids.show}`));
    expect(after.body.posts.map((p) => p.id)).not.toContain(ids.fanPost);
  });

  it('a deal is announced only once booked, only by the account or the founder, and always waits in Review', async () => {
    const early = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.ori_beauty.id}/deals/${ids.dealOri}/announce`)).send({});
    expect(early.status).toBe(409);
    expect(early.body.error).toContain('The deal is negotiating');

    const deals = await as(request(app).get(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/deals?show_id=${ids.show}`));
    expect(deals.body.deals.map((d) => [d.id, d.announce.ok])).toEqual([[ids.dealVelour, true]]);
    const rep = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/deals/${ids.dealVelour}/announce`)).send({ rep: 'vivienne_laurent' });
    expect(rep.status).toBe(409);
    expect(rep.body.error).toContain('Vivienne Laurent cannot finalize a binding agreement');
    expect(mockCreate).not.toHaveBeenCalled();

    drafts.push({ text: 'A partnership that understands restraint.', hashtag: null });
    const ok = await as(request(app).post(`/api/v1/brand-pulse/brands/${brands.velour_atelier.id}/deals/${ids.dealVelour}/announce`)).send({});
    expect(ok.status).toBe(200);
    expect(ok.body.published).toBe(false);
    expect(ok.body.review).toEqual(['brand_deal']);
    const [post] = await q("SELECT status, gate_json->'review' AS review, gate_json->'brand'->>'deal_id' AS deal FROM feed_posts WHERE id = :id", { id: ok.body.post.id });
    expect(post).toEqual({ status: 'draft', review: ['brand_deal'], deal: ids.dealVelour });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('No money, no terms');
  });
});
