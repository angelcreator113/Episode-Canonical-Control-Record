/**
 * Ruling D15 (Evoni, 2026-09-30): the pre-D15 deliverable types become the
 * influencer formats, and rate card v2 adds their anchors
 * (20261001160000-add-deliverable-formats.js).
 *
 * Against the test database: rows written with the old keys (as production
 * holds them) are carried to their formats with a platform and quantity,
 * their fees untouched; a drafted row keeps reading Auto-drafted; free text
 * is left alone; down restores the old keys; up again is a no-op on v2.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261001160000-add-deliverable-formats');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('D15: deliverable formats migration', () => {
  const ids = { show: uuid(), event: uuid(), reel: uuid(), stories: uuid(), post: uuid(), photos: uuid(), free: uuid() };

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'D15 show', :slug, NOW(), NOW())`,
      { show: ids.show, slug: `d15-${ids.show.slice(0, 8)}` });
    const drafted = {
      automation: {
        auto_drafted: { deliverables: 'deal' },
        drafted_values: {
          deliverables: {
            [ids.reel]: { type: 'reel', fee: 225, description: 'Reel', required: true },
            [ids.stories]: { type: 'story_set_3', fee: 110, description: 'Story Set (3)', required: true },
          },
        },
      },
    };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'D15 launch', 'brand_deal', 'paid_deliverables', 3, :cc, 'ready', NOW(), NOW())`,
    { ...ids, cc: JSON.stringify(drafted) });
    const row = (id, type, description, fee) => run(
      `INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, created_at, updated_at)
       VALUES (:id, :event, :description, :type, true, 'host', :fee, 'pending', NOW(), NOW())`,
      { id, event: ids.event, type, description, fee });
    await row(ids.reel, 'reel', 'Reel', 225); // drafted, unedited
    await row(ids.stories, 'story_set_3', 'Story Set (3)', 110); // drafted, unedited
    await row(ids.post, 'post', 'Feed post in the coat', 90); // hand-written description
    await row(ids.photos, 'photo_set', 'Photo Set', null);
    await row(ids.free, 'Sponsored story', 'A story mention', null); // opportunity free text
    // The rows above are written after the migration has run on this
    // database; the migration is run again to carry them.
    await migration.up(sequelize.getQueryInterface(), Sequelize);
  });

  afterAll(async () => {
    await run('DELETE FROM event_deliverables WHERE event_id = :event', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const rows = () => q(`SELECT id, deliverable_type, platform, quantity, description, fee FROM event_deliverables
                         WHERE event_id = :event ORDER BY created_at, id`, ids);
  const byId = async () => Object.fromEntries((await rows()).map((r) => [r.id, r]));

  it('carries each old key to its format, with platform and quantity; fees untouched', async () => {
    const r = await byId();
    expect(r[ids.reel]).toMatchObject({ deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, description: 'Instagram Reel', fee: 225 });
    expect(r[ids.stories]).toMatchObject({ deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, description: 'Instagram Stories (×3)', fee: 110 });
    expect(r[ids.post]).toMatchObject({ deliverable_type: 'instagram_post', platform: 'instagram', quantity: 1, description: 'Feed post in the coat', fee: 90 });
    expect(r[ids.photos]).toMatchObject({ deliverable_type: 'carousel_post', platform: 'instagram', quantity: 1, description: 'Carousel post', fee: null });
    expect(r[ids.free]).toMatchObject({ deliverable_type: 'Sponsored story', platform: null, quantity: 1, description: 'A story mention' });
  });

  it('rewrites the drafted copies, so a drafted row still reads Auto-drafted', async () => {
    const [ev] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    const records = asJson(ev.canon_consequences).automation.drafted_values.deliverables;
    expect(records[ids.reel]).toEqual({ type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 225, description: 'Instagram Reel', required: true });
    expect(records[ids.stories]).toEqual({ type: 'instagram_stories', platform: 'instagram', quantity: 3, fee: 110, description: 'Instagram Stories (×3)', required: true });
  });

  it('rate card v2 holds v1 unchanged plus the formats, and running up again adds nothing', async () => {
    const count = async () => (await q('SELECT COUNT(*)::int AS n FROM deal_rate_anchors WHERE version = 2 AND deleted_at IS NULL'))[0].n;
    expect(await count()).toBe(65);
    const v1 = await q(`SELECT component, career_tier, amount FROM deal_rate_anchors WHERE version = 1 AND deleted_at IS NULL ORDER BY component, career_tier`);
    const v2Old = await q(`SELECT component, career_tier, amount FROM deal_rate_anchors
                            WHERE version = 2 AND deleted_at IS NULL AND component IN (SELECT DISTINCT component FROM deal_rate_anchors WHERE version = 1)
                            ORDER BY component, career_tier`);
    expect(v2Old).toEqual(v1);
    const post = await q(`SELECT career_tier, amount FROM deal_rate_anchors WHERE version = 2 AND component = 'instagram_post' ORDER BY career_tier`);
    expect(post.map((p) => p.amount)).toEqual([40, 65, 115, 165, 225]);
    const premiums = (v) => q('SELECT kind, key, percent FROM deal_rate_premiums WHERE version = :v AND deleted_at IS NULL ORDER BY kind, key', { v });
    expect(await premiums(2)).toEqual(await premiums(1));
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect(await count()).toBe(65);
  });

  it('down restores the old keys and labels; up carries them forward again', async () => {
    await migration.down(sequelize.getQueryInterface(), Sequelize);
    const back = await q(`SELECT id, deliverable_type, description FROM event_deliverables WHERE event_id = :event`, ids);
    const b = Object.fromEntries(back.map((r) => [r.id, r]));
    expect(b[ids.reel]).toMatchObject({ deliverable_type: 'reel', description: 'Reel' });
    expect(b[ids.stories]).toMatchObject({ deliverable_type: 'story_set_3', description: 'Story Set (3)' });
    expect(b[ids.post]).toMatchObject({ deliverable_type: 'post', description: 'Feed post in the coat' });
    const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM deal_rate_anchors WHERE version = 2');
    expect(n).toBe(0);

    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const r = await byId();
    expect(r[ids.stories]).toMatchObject({ deliverable_type: 'instagram_stories', quantity: 3, description: 'Instagram Stories (×3)' });
  });
});
