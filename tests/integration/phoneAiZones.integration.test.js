/**
 * AI "Add zones" (Evoni, 2026-10-07: "start the rest of lalas phone"). Its
 * context named peer screens by asset UUID, but a zone's target is the
 * screen's type key, so every AI link was dead; icons and production
 * overlays were offered as targets; zones could run off the screen.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { buildPhoneContext } = require('../../src/services/phoneContextBuilder');
const { clampZone } = require('../../src/routes/phoneAIRoutes');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

describe('clampZone', () => {
  test('a zone stays inside the screen, and a target naming no screen is left empty', () => {
    const ids = new Set(['scr_chat']);
    const z = clampZone({ x: 90, y: 95, w: 30, h: 20, target: 'scr_chat' }, ids);
    expect(z.x + z.w).toBeLessThanOrEqual(100);
    expect(z.y + z.h).toBeLessThanOrEqual(100);
    expect(z.target).toBe('scr_chat');
    expect(clampZone({ x: 1, y: 1, w: 10, h: 10, target: '6f1c-uuid' }, ids).target).toBe('');
  });
});

(shouldSkip ? describe.skip : describe)('AI zones context', () => {
  const show = uuid();
  const home = uuid();

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `aiz-${show.slice(0, 8)}` });
    const asset = (id, name, meta) => run(
      `INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
       VALUES (:id, :name, 'UI_OVERLAY', :show, 'https://x/a.png', CAST(:meta AS jsonb), NOW(), NOW())`,
      { id, name, show, meta: JSON.stringify(meta) });
    await asset(home, 'UI Overlay: Home', { overlay_type: 'scr_home', overlay_category: 'phone',
      screen_links: [{ id: 'z1', x: 1, y: 1, w: 5, h: 5, actions: [{ type: 'set_state', key: 'met_lala', value: true }] }] });
    await asset(uuid(), 'UI Overlay: Chat', { overlay_type: 'scr_chat', overlay_category: 'phone' });
    await asset(uuid(), 'UI Overlay: Chat icon', { overlay_type: 'icon_chat', overlay_category: 'phone_icon' });
    await asset(uuid(), 'UI Overlay: Lower Third', { overlay_type: 'lower_third', overlay_category: 'production' });
  });

  afterAll(async () => {
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  test('peer screens are named by type key, screens only; state keys in use are found', async () => {
    const ctx = await buildPhoneContext({ showId: show, assetId: home });
    expect(ctx.peer_screens).toEqual([{ id: 'scr_chat', name: 'UI Overlay: Chat', category: 'phone' }]);
    expect(ctx.state_keys_in_use).toContain('met_lala');
  });
});
