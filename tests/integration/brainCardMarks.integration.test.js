/**
 * Brain Update cards reach the generators card by card (Evoni's ruling,
 * 2026-10-08; wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md,
 * fix-list item 24). A synced card starts out of every prompt, in the
 * franchise tier. The Show Bible may mark it "In every prompt" and give it a
 * scope and show (the words stay its page's). When its page changes, Brain
 * Update replaces the entry, and the replacement keeps those marks: it used
 * to write always_inject false and the default scope, so the card silently
 * dropped out of every prompt.
 *
 * On the migrated test database through the real routes (Cultural Memory's
 * Legend Paths, a page with one-line cards).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { selectInjectedRules } = require('../../src/services/brainRules');
const { FranchiseKnowledge } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const PREFIX = 'cultural_memory:%';

(shouldSkip ? describe.skip : describe)('Brain Update keeps a card\'s Show Bible marks', () => {
  let token;
  const showId = crypto.randomUUID();
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (a) => `/api/v1/franchise-brain/sync/cultural_memory/${a}`;
  const sync = async (page) => {
    const preview = await auth(request(app).post(url('preview'))).send({ page_data: page });
    expect(preview.status).toBe(200);
    const res = await auth(request(app).post(url('apply'))).send({ page_data: page, fingerprint: preview.body.data.fingerprint });
    expect(res.status).toBe(200);
    return { preview: preview.body.data, applied: res.body.data.applied };
  };
  const activeCard = async (key) => (await rows(
    `SELECT id, title, content, always_inject, scope, show_id, status FROM franchise_knowledge
      WHERE source_key = :key AND status = 'active' AND deleted_at IS NULL`, { key }))[0];
  const page = (longGame, legacyRun = 'Ten years of showing up, every season') => ({
    LEGEND_PATHS: [
      { path: 'The Long Game', requires: longGame },
      { path: 'The Legacy Run', requires: legacyRun },
    ],
  });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-brain-marks', email: 'user@brainmarks.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await rows(`DELETE FROM franchise_knowledge WHERE source_key LIKE :p`, { p: PREFIX });
  });

  afterAll(async () => {
    await rows(`DELETE FROM franchise_knowledge WHERE source_key LIKE :p`, { p: PREFIX });
  });

  test('a new card starts out of every prompt, franchise-wide', async () => {
    const { applied } = await sync(page('A decade of showing up'));
    expect(applied).toEqual({ new: 2, changed: 0, retired: 0 });
    expect(await activeCard('cultural_memory:legend-path:the-long-game')).toMatchObject({ always_inject: false, scope: 'franchise', show_id: null });
  });

  test("the Show Bible marks a synced card; a re-sync that changes its words keeps the mark, the scope and the show", async () => {
    const card = await activeCard('cultural_memory:legend-path:the-long-game');
    const mark = await auth(request(app).patch(`/api/v1/franchise-brain/entries/${card.id}`))
      .send({ always_inject: true, scope: 'show', show_id: showId });
    expect(mark.status).toBe(200);
    // Its words are still its page's.
    expect((await auth(request(app).patch(`/api/v1/franchise-brain/entries/${card.id}`)).send({ content: 'A second copy' })).status).toBe(409);

    const { preview, applied } = await sync(page('A decade of showing up, and a public comeback'));
    expect(applied).toEqual({ new: 0, changed: 1, retired: 0 });
    expect(preview.changed[0].keep).toEqual({ always_inject: true, scope: 'show', show_id: showId });

    const now = await activeCard('cultural_memory:legend-path:the-long-game');
    expect(now.id).not.toBe(card.id);
    expect(now.content).toMatch(/public comeback/);
    expect(now).toMatchObject({ always_inject: true, scope: 'show', show_id: showId });
    const [old] = await rows('SELECT status, superseded_by, always_inject FROM franchise_knowledge WHERE id = :id', { id: card.id });
    expect(old).toEqual({ status: 'superseded', superseded_by: now.id, always_inject: true });
    // The other card was never marked, and stays out.
    expect(await activeCard('cultural_memory:legend-path:the-legacy-run')).toMatchObject({ always_inject: false, scope: 'franchise' });
  });

  test('so the marked card reaches the generators of its show, and only its show', async () => {
    const forShow = await selectInjectedRules(FranchiseKnowledge, { showId, limit: 1000 });
    const forOther = await selectInjectedRules(FranchiseKnowledge, { showId: crypto.randomUUID(), limit: 1000 });
    const title = (await activeCard('cultural_memory:legend-path:the-long-game')).title;
    expect(forShow.used.map((r) => r.title)).toContain(title);
    expect(forOther.used.map((r) => r.title)).not.toContain(title);
    expect(forShow.used.map((r) => r.title)).not.toContain((await activeCard('cultural_memory:legend-path:the-legacy-run')).title);
  });

  test('unmarking it in the Show Bible holds through the next re-sync too', async () => {
    const card = await activeCard('cultural_memory:legend-path:the-long-game');
    expect((await auth(request(app).patch(`/api/v1/franchise-brain/entries/${card.id}`)).send({ always_inject: false, scope: 'franchise', show_id: null })).status).toBe(200);
    await sync(page('A decade of showing up, a public comeback, and a book'));
    expect(await activeCard('cultural_memory:legend-path:the-long-game')).toMatchObject({ always_inject: false, scope: 'franchise', show_id: null });
  });
});
