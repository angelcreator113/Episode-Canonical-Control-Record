/**
 * Phone round step 1 (Evoni, 2026-10-25: "Yes do them all"), against a
 * database:
 *   D1 — deleting a screen also removes Go to actions and mission rewards
 *        that opened it; missions that ask for a visit to it are kept and
 *        named.
 *   D3 — editing a type that matches nothing is a 404 and never unsets the
 *        show's home; making a screen home moves the home in one step.
 *   D7 — the AI context finds the show's screens however many other images
 *        it has, prefers the episode's own, and knows the missions' state keys.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { buildPhoneContext } = require('../../src/services/phoneContextBuilder');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Phone round step 1', () => {
  const show = uuid();
  const episode = uuid();
  const home = uuid();
  const homeType = uuid();
  const dmsType = uuid();
  const closetType = uuid();
  const visitMission = uuid();
  const rewardMission = uuid();
  let token;

  const type = (id, key, name, isHome, category = 'phone') => run(
    `INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, beat, description, prompt, sort_order, is_home, created_at, updated_at)
     VALUES (:id, :show, :key, :name, :category, '', '', '', 1, :isHome, NOW(), NOW())`, { id, show, key, name, category, isHome });
  const asset = (id, name, meta, episodeId = null) => run(
    `INSERT INTO assets (id, name, asset_type, show_id, episode_id, s3_url_processed, metadata, created_at, updated_at)
     VALUES (:id, :name, 'UI_OVERLAY', :show, :episodeId, 'https://x/a.png', CAST(:meta AS jsonb), NOW(), NOW())`,
    { id, name, show, episodeId, meta: JSON.stringify(meta) });
  const mission = (id, name, objectives, rewards) => run(
    `INSERT INTO phone_missions (id, show_id, episode_id, name, objectives, reward_actions, display_order, is_active, created_at, updated_at)
     VALUES (:id, :show, :episode, :name, CAST(:objectives AS jsonb), CAST(:rewards AS jsonb), 0, true, NOW(), NOW())`,
    { id, show, episode, name, objectives: JSON.stringify(objectives), rewards: JSON.stringify(rewards) });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-round1', email: 'r@round.dev', name: 'Round', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `round1-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, episode_number, title, created_at, updated_at) VALUES (:episode, :show, 1, 'Round one', NOW(), NOW())`, { episode, show });
    await type(homeType, 'home', 'Home', true);
    await type(dmsType, 'dms', 'DMs', false);
    await type(closetType, 'closet', 'Closet', false);
    await asset(home, 'UI Overlay: Home', { overlay_type: 'home', overlay_category: 'phone', screen_links: [
      { id: 'z-dms', x: 1, y: 1, w: 5, h: 5, target: 'dms' },
      // Its target is fine, but its own Go to action opens DMs.
      { id: 'z-closet', x: 10, y: 1, w: 5, h: 5, target: 'closet', actions: [{ type: 'set_state', key: 'opened', value: true }, { type: 'navigate', target: 'dms' }] },
      // Only a Go to action to DMs: nothing left once it goes.
      { id: 'z-only', x: 20, y: 1, w: 5, h: 5, actions: [{ type: 'navigate', target: 'dms' }] },
      { id: 'z-keep', x: 30, y: 1, w: 5, h: 5, target: 'closet' },
    ] });
    await asset(uuid(), 'UI Overlay: DMs', { overlay_type: 'dms', overlay_category: 'phone' });
    await asset(uuid(), 'UI Overlay: Closet', { overlay_type: 'closet', overlay_category: 'phone' });
    await mission(visitMission, 'Read the DMs', [{ id: 'o1', label: 'Open the DMs', condition: [{ key: 'visited:dms', op: 'eq', value: true }] }], []);
    await mission(rewardMission, 'Get dressed', [{ id: 'o2', label: 'Dress', condition: [{ key: 'dressed', op: 'eq', value: true }] }],
      [{ type: 'show_toast', text: 'Done' }, { type: 'navigate', target: 'dms' }]);
  });

  afterAll(async () => {
    await run(`DELETE FROM phone_missions WHERE show_id = :show`, { show });
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    await run(`DELETE FROM ui_overlay_types WHERE show_id = :show`, { show });
    await run(`DELETE FROM episodes WHERE id = :episode`, { episode });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  describe('D7: the AI context', () => {
    test("finds the show's screens past 40 other images, the episode's own first, and the missions' keys", async () => {
      // 45 icons sort before every screen by name; they used to fill the 40.
      for (let i = 0; i < 45; i += 1) {
        await asset(uuid(), `A icon ${String(i).padStart(2, '0')}`, { overlay_type: `icon_${i}`, overlay_category: 'phone_icon' });
      }
      await asset(uuid(), 'UI Overlay: Closet (episode)', { overlay_type: 'closet', overlay_category: 'phone' }, episode);
      const ctx = await buildPhoneContext({ showId: show, episodeId: episode, assetId: home });
      expect(ctx.peer_screens).toEqual([
        { id: 'closet', name: 'UI Overlay: Closet (episode)', category: 'phone' },
        { id: 'dms', name: 'UI Overlay: DMs', category: 'phone' },
      ]);
      const showWide = await buildPhoneContext({ showId: show, assetId: home });
      expect(showWide.peer_screens.map((p) => p.name)).toEqual(['UI Overlay: Closet', 'UI Overlay: DMs']);
      expect(ctx.state_keys_in_use).toEqual(expect.arrayContaining(['opened', 'visited:dms', 'dressed']));
      await run(`DELETE FROM assets WHERE show_id = :show AND (metadata->>'overlay_category' = 'phone_icon' OR episode_id IS NOT NULL)`, { show });
    });
  });

  describe('D3: editing a type', () => {
    test("an id that matches nothing is a 404, and the show's home stays", async () => {
      const res = await auth(request(app).put(`/api/v1/ui-overlays/${show}/types/${uuid()}`)).send({ is_home: true });
      expect(res.status).toBe(404);
      const [[row]] = await run(`SELECT is_home FROM ui_overlay_types WHERE id = :homeType`, { homeType });
      expect(row.is_home).toBe(true);
    });

    test('making a screen home moves the home', async () => {
      const res = await auth(request(app).put(`/api/v1/ui-overlays/${show}/types/${closetType}`)).send({ is_home: true });
      expect(res.status).toBe(200);
      const [rows] = await run(`SELECT type_key FROM ui_overlay_types WHERE show_id = :show AND is_home AND deleted_at IS NULL`, { show });
      expect(rows.map((r) => r.type_key)).toEqual(['closet']);
      await auth(request(app).put(`/api/v1/ui-overlays/${show}/types/${homeType}`)).send({ is_home: true });
    });
  });

  describe('D1: deleting a screen', () => {
    test('removes zones and Go to actions to it, and mission rewards that open it; names missions that need it', async () => {
      const res = await auth(request(app).delete(`/api/v1/ui-overlays/${show}/types/${dmsType}`));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        deletedKey: 'dms',
        zonesRemoved: 2,
        navigateActionsRemoved: 2,
        missionRewardsRemoved: 1,
        missionsFlagged: [{ id: visitMission, name: 'Read the DMs', episode_id: episode, objectives: ['Open the DMs'], start_condition: false }],
      });
      const [[h]] = await run(`SELECT metadata::text AS m FROM assets WHERE id = :home`, { home });
      const zones = JSON.parse(h.m).screen_links;
      expect(zones.map((z) => z.id)).toEqual(['z-closet', 'z-keep']);
      expect(zones[0].actions).toEqual([{ type: 'set_state', key: 'opened', value: true }]);
      const [[rm]] = await run(`SELECT reward_actions::text AS r FROM phone_missions WHERE id = :rewardMission`, { rewardMission });
      expect(JSON.parse(rm.r)).toEqual([{ type: 'show_toast', text: 'Done' }]);
      // The objective that needs the screen is kept, not deleted.
      const [[vm]] = await run(`SELECT objectives::text AS o FROM phone_missions WHERE id = :visitMission`, { visitMission });
      expect(JSON.parse(vm.o)[0].condition[0].key).toBe('visited:dms');
    });
  });
});
