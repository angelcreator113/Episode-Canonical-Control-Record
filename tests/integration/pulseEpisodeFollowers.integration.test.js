/**
 * The episode follower change (Task #2956; The Pulse spec §8; Evoni,
 * 2026-10-12): completing an episode proposes Lala's follower change in
 * the follower ledger, from its result (its posts count through their own
 * rows since Task #3086, so a like counts once); it waits
 * for Evoni. Accepted (or adjusted with a reason) it is in the ledger and,
 * as a character_state_history row ({ followers: N }, source override),
 * in the Decision Log. Completion never fails because of it, and an
 * episode is proposed once.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const ledger = require('../../src/services/pulseFollowers');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse episode follower change (Task #2956)', () => {
  const shows = [];
  let lala;
  let madeLala = false;
  let admin;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);

  /** A show with Lala's state, an episode 2 ready to complete, and (unless told not to) her accepted 100,000 followers. */
  async function seed({ start = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
    { show, name: `Followers ep ${show.slice(0, 8)}`, slug: `fep-${show.slice(0, 8)}`, metadata: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 2, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'used', :ep, 0, 5, NOW(), NOW())`, { id: uuid(), show, ep });
    // One of the episode's posts, with 50,000 accepted likes.
    const post = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, episode_id, poster_handle, content_text, status, created_at, updated_at)
               VALUES (:post, :show, :ep, 'rival', 'Wow', 'live', NOW(), NOW())`, { post, show, ep });
    await models.PulsePostNumber.create({ post_id: post, show_id: show, proposed_likes: 50000, proposed_shares: 0, seed: 1, status: 'accepted', final_likes: 50000, final_shares: 0 });
    if (start) {
      await models.PulseFollower.create({ show_id: show, social_profile_id: lala, story_order: 0, change: 100000, count_after: 100000, cause: 'start', status: 'accepted', decided_at: new Date() });
    }
    return { show, ep };
  }

  const proposalOf = (show) => models.PulseFollower.findAll({ where: { show_id: show, cause: 'episode' } });
  const historyOf = (show) => sequelize.query(
    `SELECT source::text AS source, episode_id, deltas_json, notes FROM character_state_history WHERE show_id = :show AND source = 'override'`,
    { replacements: { show }, type: sequelize.QueryTypes.SELECT });

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-epf', email: 'evoni@epf.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    for (const show of shows) {
      await run('DELETE FROM franchise_knowledge WHERE show_id = :show', { show });
      for (const t of ['pulse_followers', 'pulse_post_numbers', 'feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'world_events', 'episodes']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show });
      }
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    if (madeLala) await run('DELETE FROM social_profiles WHERE id = :lala', { lala });
  });

  it('completing an episode proposes Lala\'s change from its result; it waits for Evoni; once per episode', async () => {
    const { show, ep } = await seed();
    const result = await completeEpisode(ep, show, sequelize);
    const [row] = await proposalOf(show);
    expect(row).toMatchObject({ social_profile_id: Number(lala), cause: 'episode', cause_id: ep, status: 'proposed', story_order: 27 });
    const { tier, score } = result.evaluation;
    const expected = ledger.episodeChangeFrom({ followers: 100000, tier, score });
    expect(row.change).toBe(expected.change);
    expect(row.count_after).toBe(100000 + expected.change);
    expect(row.factors_json).toMatchObject({ tier, followers: 100000, followers_known: true, from_result: expected.from_result });
    expect(row.factors_json).not.toHaveProperty('from_posts');
    expect(result.follower_proposal).toMatchObject({ id: row.id, status: 'proposed' });
    expect(await historyOf(show)).toEqual([]);

    await ledger.proposeEpisodeChange(models, { showId: show, episodeId: ep });
    expect(await proposalOf(show)).toHaveLength(1);
  });

  it('completion succeeds even if the proposal fails', async () => {
    const { show, ep } = await seed();
    jest.spyOn(ledger, 'proposeEpisodeChange').mockRejectedValue(new Error('boom'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await completeEpisode(ep, show, sequelize);
    expect(result.evaluation.tier).toBeTruthy();
    expect(result.follower_proposal).toBeNull();
    expect(errors).toHaveBeenCalledWith('[EpisodeCompletion] Follower change proposal failed (non-blocking):', 'boom');
    const [[{ status }]] = await run('SELECT evaluation_status AS status FROM episodes WHERE id = :ep', { ep });
    expect(status).toBe('accepted');
  });

  it('Accept writes the ledger and the Decision Log row; deciding again is refused', async () => {
    const { show, ep } = await seed();
    await completeEpisode(ep, show, sequelize);
    const [row] = await proposalOf(show);
    const listed = await as(request(app).get(`/api/v1/pulse-followers?show_id=${show}`));
    expect(listed.body.proposed.find((p) => p.id === row.id)).toMatchObject({ cause: 'episode', factors: { followers: 100000 } });

    const res = await as(request(app).put(`/api/v1/pulse-followers/${row.id}/accept`));
    expect(res.status).toBe(200);
    expect(res.body.change).toMatchObject({ status: 'accepted', change: row.change, count_after: 100000 + row.change, decided_by: 'evoni@epf.dev' });
    expect(await ledger.countAt(models, show, lala, 27)).toBe(100000 + row.change);
    const [history] = await historyOf(show);
    expect(history).toMatchObject({ source: 'override', episode_id: ep, deltas_json: { followers: row.change } });
    expect(history.notes).toMatch(/^Followers [+-]?[\d,]+ \(Episode 2 [A-Z]+\) \| Accepted as proposed$/);
    expect((await as(request(app).put(`/api/v1/pulse-followers/${row.id}/accept`))).status).toBe(409);
    expect(await historyOf(show)).toHaveLength(1);
  });

  it('Adjust takes the change and a one-line reason, and writes both rows with it', async () => {
    const { show, ep } = await seed();
    await completeEpisode(ep, show, sequelize);
    const [row] = await proposalOf(show);
    expect((await as(request(app).put(`/api/v1/pulse-followers/${row.id}/adjust`)).send({ change: 1200 })).status).toBe(400);
    expect((await as(request(app).put(`/api/v1/pulse-followers/${row.id}/adjust`)).send({ change: 1.5, reason: 'x' })).status).toBe(400);
    const res = await as(request(app).put(`/api/v1/pulse-followers/${row.id}/adjust`)).send({ change: 1200, reason: 'The clip went round.' });
    expect(res.status).toBe(200);
    expect(res.body.change).toMatchObject({ change: 1200, count_after: 101200, reason: 'The clip went round.' });
    const [history] = await historyOf(show);
    expect(history.deltas_json).toEqual({ followers: 1200 });
    expect(history.notes).toMatch(/\| Adjusted: The clip went round\.$/);
  });

  it("an episode change waits until Lala's starting count is accepted", async () => {
    const { show, ep } = await seed({ start: false });
    await completeEpisode(ep, show, sequelize);
    const [row] = await proposalOf(show);
    expect(row.factors_json).toMatchObject({ followers: 0, followers_known: false });
    expect(row.count_after).toBeNull();
    const res = await as(request(app).put(`/api/v1/pulse-followers/${row.id}/accept`));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Accept the starting follower count first.');
    expect(await historyOf(show)).toEqual([]);
  });
});
