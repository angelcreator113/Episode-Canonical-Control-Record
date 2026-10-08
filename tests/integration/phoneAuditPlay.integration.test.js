/**
 * Lala's Phone audit, batch 1 — broken play and security (Evoni,
 * 2026-10-07: "lala phone doesnt really need a redesign as much as it needs
 * an audit"; "lets do it in the best order").
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

(shouldSkip ? describe.skip : describe)("Lala's Phone audit: play and security", () => {
  const show = uuid();
  const other = uuid();
  const ep = uuid();
  const home = uuid();
  const chat = uuid();
  const foreign = uuid();
  let token;
  let userId;

  const asset = (id, showId, name, meta) => run(
    `INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
     VALUES (:id, :name, 'UI_OVERLAY', :showId, 'https://x/a.png', CAST(:meta AS jsonb), NOW(), NOW())`,
    { id, name, showId, meta: JSON.stringify(meta) });

  beforeAll(async () => {
    userId = `test-audit-${show.slice(0, 8)}`;
    token = TokenService.generateTokenPair({ id: userId, email: 'a@audit.dev', name: 'Audit', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const id of [show, other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id, n: `audit-${id.slice(0, 8)}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, { ep, show });
    // Two screens with a zone of the same id, each setting its own flag.
    await asset(home, show, 'UI Overlay: Home', { overlay_type: 'home', overlay_category: 'phone', screen_links: [
      { id: 'z1', x: 1, y: 1, w: 5, h: 5, actions: [{ type: 'set_state', key: 'from_home', value: true }] },
      { id: 'za', x: 10, y: 1, w: 5, h: 5, actions: [{ type: 'set_state', key: 'tap_a', value: true }] },
      { id: 'zb', x: 20, y: 1, w: 5, h: 5, actions: [{ type: 'set_state', key: 'tap_b', value: true }] },
    ] });
    await asset(chat, show, 'UI Overlay: Messages', { overlay_type: 'mail_panel', overlay_category: 'phone', wardrobe_price: 450, wardrobe_brand: 'Maison Reve', screen_links: [
      { id: 'z1', x: 1, y: 1, w: 5, h: 5, actions: [{ type: 'set_state', key: 'from_chat', value: true }] },
    ] });
    await asset(foreign, other, 'UI Overlay: Home', { overlay_type: 'home', overlay_category: 'phone' });
    for (const [typeKey, name] of [['home', 'Home'], ['mail_panel', 'Mail']]) {
      await run(`INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, beat, description, prompt, sort_order, created_at, updated_at)
                 VALUES (:id, :show, :typeKey, :name, 'phone', '', '', '', 1, NOW(), NOW())`, { id: uuid(), show, typeKey, name });
    }
  });

  afterAll(async () => {
    await run(`DELETE FROM phone_playthrough_state WHERE episode_id = :ep`, { ep });
    await run(`DELETE FROM phone_missions WHERE show_id = :show`, { show });
    await run(`DELETE FROM assets WHERE show_id IN (:ids)`, { ids: [show, other] });
    await run(`DELETE FROM ui_overlay_types WHERE show_id = :show`, { show });
    await run(`DELETE FROM episodes WHERE id = :ep`, { ep });
    await run(`DELETE FROM shows WHERE id IN (:ids)`, { ids: [show, other] });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const missions = `/api/v1/ui-overlays/${show}/missions`;
  const phoneState = `/api/v1/episodes/${ep}/phone-state`;
  const reset = () => auth(request(app).post(`${phoneState}/reset`));

  test('a mission saves with no start condition and with a "visited this screen" objective', async () => {
    const created = await auth(request(app).post(missions)).send({
      name: 'Open the messages', episode_id: ep, start_condition: null,
      objectives: [{ id: 'o1', label: 'Opened Messages', condition: [{ key: `visited:messages`, op: 'eq', value: true }] }],
    });
    expect(created.status).toBe(201);
    const id = created.body.mission.id;
    // The Missions tab's Active toggle sends the mission back with start_condition null.
    const toggled = await auth(request(app).put(`${missions}/${id}`)).send({
      name: 'Open the messages', episode_id: ep, start_condition: null, is_active: false,
      objectives: created.body.mission.objectives, reward_actions: [], display_order: 3,
    });
    expect(toggled.status).toBe(200);
    expect(toggled.body.mission).toMatchObject({ is_active: false, display_order: 3 });
    await run(`DELETE FROM phone_missions WHERE id = :id`, { id });
  });

  test("a tap runs the zone on the screen it was tapped on, not another screen's zone with the same id", async () => {
    await reset();
    const res = await auth(request(app).post(`${phoneState}/tap`)).send({ zone_id: 'z1', screen_asset_id: chat });
    expect(res.status).toBe(200);
    expect(res.body.state.state_flags).toEqual({ from_chat: true });
  });

  test('two taps at once both keep their flags', async () => {
    await reset();
    const [a, b] = await Promise.all([
      auth(request(app).post(`${phoneState}/tap`)).send({ zone_id: 'za', screen_asset_id: home }),
      auth(request(app).post(`${phoneState}/tap`)).send({ zone_id: 'zb', screen_asset_id: home }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const after = await auth(request(app).get(phoneState));
    expect(after.body.state.state_flags).toMatchObject({ tap_a: true, tap_b: true });
  });

  test('landing on a screen completes a "visited" mission and fires its reward', async () => {
    await reset();
    const created = await auth(request(app).post(missions)).send({
      name: 'Read the messages', episode_id: ep,
      objectives: [{ id: 'o1', label: 'Opened Messages', condition: [{ key: 'visited:messages', op: 'eq', value: true }] }],
      reward_actions: [{ type: 'set_state', key: 'read_messages', value: true }, { type: 'show_toast', text: 'Done', tone: 'success' }],
    });
    expect(created.status).toBe(201);
    const res = await auth(request(app).put(`${phoneState}/screen`)).send({ screen_id: 'messages' });
    expect(res.status).toBe(200);
    expect(res.body.state.completed_mission_ids).toEqual([created.body.mission.id]);
    expect(res.body.state.state_flags).toEqual({ read_messages: true });
    expect(res.body.effects.toasts).toEqual([{ text: 'Done', tone: 'success' }]);
    expect(res.body.newly_completed_missions).toEqual([{ id: created.body.mission.id, name: 'Read the messages' }]);
  });

  test("the screen list carries the show and the wardrobe price/brand content zones read", async () => {
    const res = await auth(request(app).get(`/api/v1/ui-overlays/${show}`));
    const messages = res.body.data.find((o) => o.id === 'mail_panel');
    expect(messages).toMatchObject({ show_id: show, metadata: { wardrobe_price: 450, wardrobe_brand: 'Maison Reve' } });
  });

  test("remove background can't reach another show's image", async () => {
    const before = process.env.REMOVEBG_API_KEY;
    process.env.REMOVEBG_API_KEY = 'test-key-not-called';
    try {
      const res = await auth(request(app).post(`/api/v1/ui-overlays/${show}/remove-bg/${foreign}`));
      expect(res.status).toBe(404);
      const [[row]] = await run(`SELECT metadata::text AS m FROM assets WHERE id = :foreign`, { foreign });
      expect(JSON.parse(row.m).bg_removed).toBeUndefined();
    } finally {
      if (before === undefined) delete process.env.REMOVEBG_API_KEY; else process.env.REMOVEBG_API_KEY = before;
    }
  });

  test('an upload that is not an image is refused with the reason', async () => {
    const res = await auth(request(app).post(`/api/v1/ui-overlays/${show}/upload/mail_panel`))
      .attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'x.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only PNG, JPEG, WebP or GIF images can be uploaded.');
  });
});
