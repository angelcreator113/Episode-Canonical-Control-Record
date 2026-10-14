/**
 * The stats panel, the audience's overlay (Task #3164), against the test
 * database:
 * - its number boxes are saved on one of the show's overlay images, checked,
 *   and listed with the overlay; `spots: null` makes it ordinary again;
 * - an episode's numbers are "before → after": going into the episode, and
 *   with its own changes;
 * - the PNG is the master with each number drawn, 1920 × 220 or 3840 × 440;
 * - without a panel, the episode read says how to set one up.
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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

/** A small PNG as a data URL, so nothing is fetched from the network. */
function pngDataUrl(width, height, fill) {
  const { createCanvas } = require('canvas');
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

(shouldSkip ? describe.skip : describe)('Stats panel overlay (Task #3164)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), ep2: uuid(), panel: uuid(), coin: uuid(), bare: uuid(), bareEp: uuid() };
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-stats-panel', email: 'ed@stats-panel.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const [id, name] of [[ids.show, 'Panel'], [ids.bare, 'NoPanel']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())',
        { id, name: `${name} ${tag}`, slug: `${name.toLowerCase()}-${tag}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'published', NOW(), NOW()),
      (:bareEp, :bare, 'Bare', 1, 'draft', NOW(), NOW())`, ids);
    const tx = (episode, type, amount) => run(
      `INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status)
       VALUES (:id, :show, :episode, :type, 'test', :amount, 'executed')`, { id: uuid(), show: ids.show, episode, type, amount });
    await tx(null, 'income', 500);
    await tx(ids.ep1, 'income', 200);
    await tx(ids.ep2, 'expense', 100);
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 600, 5, 3, 4, 0, NOW(), NOW())`, { id: uuid(), show: ids.show });
    const history = (episode, deltas, after, minutes) => run(
      `INSERT INTO character_state_history (id, show_id, character_key, episode_id, source, deltas_json, state_after_json, created_at)
       VALUES (:id, :show, 'lala', :episode, 'computed', CAST(:deltas AS jsonb), CAST(:after AS jsonb), NOW() + make_interval(mins => :minutes))`,
      { id: uuid(), show: ids.show, episode, deltas: JSON.stringify(deltas), after: JSON.stringify(after), minutes });
    await history(ids.ep1, { reputation: 1, influence: 1 }, { reputation: 3, influence: 2 }, 1);
    await history(ids.ep2, { reputation: 2, influence: 2 }, { reputation: 5, influence: 4 }, 2);

    // The panel art and a coin icon: two of the show's production overlays.
    await run(`INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, prompt, sort_order, created_at, updated_at)
               VALUES (gen_random_uuid(), :show, 'stats_art', 'Stats panel', 'production', 'p', 1, NOW(), NOW()),
                      (gen_random_uuid(), :show, 'coin_icon', 'Coin icon', 'production', 'p', 2, NOW(), NOW())`, ids);
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:panel, 'UI Overlay: Stats panel', 'UI_OVERLAY', :show, :art, '{"overlay_type":"stats_art","overlay_category":"production"}'::jsonb, NOW(), NOW()),
                      (:coin, 'UI Overlay: Coin icon', 'UI_OVERLAY', :show, :icon, '{"overlay_type":"coin_icon","overlay_category":"production"}'::jsonb, NOW(), NOW())`,
      { ...ids, art: pngDataUrl(192, 22, 'rgba(0,0,0,0.5)'), icon: pngDataUrl(16, 16, '#B8962E') });
  });

  afterAll(async () => {
    for (const show of [ids.show, ids.bare]) {
      await run('DELETE FROM assets WHERE show_id = :show', { show });
      await run('DELETE FROM ui_overlay_types WHERE show_id = :show', { show });
      await run('DELETE FROM character_state_history WHERE show_id = :show', { show });
      await run('DELETE FROM character_state WHERE show_id = :show', { show });
      await run('DELETE FROM financial_transactions WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :id', { id: show });
    }
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const SPOTS = [
    { id: 'c', stat: 'coins', x: 10, y: 20, w: 25, h: 60, icon: 'coin_icon', color: '#FFFFFF' },
    { id: 'r', stat: 'reputation', x: 40, y: 20, w: 20, h: 60, icon: null, color: null },
    { id: 'f', stat: 'followers', x: 70, y: 20, w: 20, h: 60, icon: null, color: null },
  ];

  test('without a panel, the episode read says how to set one up', async () => {
    const res = await auth(request(app).get(`/api/v1/ui-overlays/${ids.bare}/stats-panel/episode/${ids.bareEp}`));
    expect([res.status, res.body.code]).toEqual([404, 'NO_PANEL']);
    expect(res.body.error).toMatch(/Assets → Overlays/);
  });

  test('the boxes are saved on the art, checked, and listed with the overlay', async () => {
    const put = (spots) => auth(request(app).put(`/api/v1/ui-overlays/${ids.show}/stats-panel/${ids.panel}`)).send({ spots });
    expect((await request(app).put(`/api/v1/ui-overlays/${ids.show}/stats-panel/${ids.panel}`).send({ spots: [] })).status).toBe(401);
    const bad = await put([{ ...SPOTS[0], stat: 'stress' }]);
    expect([bad.status, bad.body.code]).toEqual([400, 'INVALID_SPOTS']);
    const ok = await put(SPOTS);
    expect(ok.status).toBe(200);
    expect(ok.body.data.spots).toHaveLength(3);
    const list = await auth(request(app).get(`/api/v1/ui-overlays/${ids.show}`));
    expect(list.body.data.find((o) => o.id === 'stats_art').stats_panel).toEqual({ spots: SPOTS });
    expect(list.body.data.find((o) => o.id === 'coin_icon').stats_panel).toBeNull();
    const elsewhere = await auth(request(app).put(`/api/v1/ui-overlays/${ids.bare}/stats-panel/${ids.panel}`)).send({ spots: SPOTS });
    expect(elsewhere.status).toBe(404);   // another show's image is never written
  });

  test("an episode's numbers are before → after; followers are left out without her numbers", async () => {
    const res = await auth(request(app).get(`/api/v1/ui-overlays/${ids.show}/stats-panel/episode/${ids.ep2}`));
    expect(res.status).toBe(200);
    expect(res.body.data.spots.map((s) => [s.id, s.text])).toEqual([['c', '700 → 600'], ['r', '3/10 → 5/10']]);
    expect(res.body.data.before).toMatchObject({ coins: 700, reputation: 3, influence: 2 });
    expect(res.body.data.after).toMatchObject({ coins: 600, reputation: 5, influence: 4 });
  });

  test('the PNG: the master at 1920 × 220 or 3840 × 440, as a download', async () => {
    const { loadImage } = require('canvas');
    for (const [size, w, h] of [['1080p', 1920, 220], ['4k', 3840, 440]]) {
      const res = await auth(request(app).get(`/api/v1/ui-overlays/${ids.show}/stats-panel/episode/${ids.ep1}/png?size=${size}`))
        .buffer(true).parse((r, cb) => { const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-disposition']).toBe(`attachment; filename="stats-panel-episode-01-${size}.png"`);
      const img = await loadImage(res.body);
      expect([img.width, img.height]).toEqual([w, h]);
    }
    const bad = await auth(request(app).get(`/api/v1/ui-overlays/${ids.show}/stats-panel/episode/${ids.ep1}/png?size=8k`));
    expect([bad.status, bad.body.code]).toEqual([400, 'INVALID_SIZE']);
  });

  test('spots: null makes the art an ordinary overlay again', async () => {
    const res = await auth(request(app).put(`/api/v1/ui-overlays/${ids.show}/stats-panel/${ids.panel}`)).send({ spots: null });
    expect(res.body.data.spots).toBeNull();
    const again = await auth(request(app).get(`/api/v1/ui-overlays/${ids.show}/stats-panel/episode/${ids.ep1}`));
    expect(again.body.code).toBe('NO_PANEL');
  });
});
