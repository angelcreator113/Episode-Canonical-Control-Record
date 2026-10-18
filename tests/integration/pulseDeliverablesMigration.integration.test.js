/**
 * Deliverables on The Pulse (Evoni, 2026-10-18: "brand deals ... are
 * currently pointing at Instagram, TikTok, and all those, when now we only
 * have things that Lalaverse has"; "merge tiktok into pulse video")
 * (20261018130000-pulse-deliverables.js).
 *
 * Against the test database: rows written with the D15 keys (as production
 * holds them) become the Pulse formats on The Pulse, their labels too, their
 * fees untouched; a hand-written description and free text are left alone;
 * the drafted copies follow, so a drafted row still reads Auto-drafted; the
 * rate card's components are renamed and the TikTok anchors retired; stored
 * tasks are on The Pulse; down undoes the renames.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261018130000-pulse-deliverables');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

// A rate card version of its own, so the shared ones are not disturbed.
const VERSION = 900 + Math.floor(Math.random() * 90);

(shouldSkip ? describe.skip : describe)('deliverables on The Pulse: migration', () => {
  const ids = {
    show: uuid(), ep: uuid(), event: uuid(), todo: uuid(),
    reel: uuid(), tiktok: uuid(), stories: uuid(), bio: uuid(), ugc: uuid(), post: uuid(), free: uuid(),
  };
  const TASKS = [
    { slot: 'presence', label: 'Post from the launch', platform: 'instagram', task_source: 'goal' },
    { slot: 'teaser', label: 'Tease the night', platform: 'tiktok', task_source: 'goal' },
    { slot: 'mood', label: 'Mood board', platform: 'pulse', task_source: 'goal' },
  ];

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'Pulse deliverables show', :slug, NOW(), NOW())`,
      { show: ids.show, slug: `pulse-deliv-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Pulse deliverables episode', 1, 'draft', NOW(), NOW())`, ids);
    const cc = {
      automation: {
        auto_drafted: { deliverables: 'deal' },
        drafted_values: {
          deliverables: {
            [ids.reel]: { type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 225, description: 'Instagram Reel', required: true },
            [ids.stories]: { type: 'instagram_stories', platform: 'instagram', quantity: 3, fee: 110, description: 'Instagram Stories (×3)', required: true },
          },
        },
        social_tasks: TASKS,
      },
    };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, career_tier, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Pulse launch', 'brand_deal', 'paid_deliverables', 3, :cc, 'ready', NOW(), NOW())`,
    { ...ids, cc: JSON.stringify(cc) });
    const row = (id, type, platform, quantity, description, fee) => run(
      `INSERT INTO event_deliverables (id, event_id, description, deliverable_type, platform, quantity, required, owed_to, fee, status, created_at, updated_at)
       VALUES (:id, :event, :description, :type, :platform, :quantity, true, 'host', :fee, 'pending', NOW(), NOW())`,
      { id, event: ids.event, type, platform, quantity, description, fee });
    await row(ids.reel, 'instagram_reel', 'instagram', 1, 'Instagram Reel', 225); // drafted, unedited
    await row(ids.tiktok, 'tiktok_video', 'tiktok', 2, 'TikTok video (×2)', 250);
    await row(ids.stories, 'instagram_stories', 'instagram', 3, 'Instagram Stories (×3)', 110); // drafted, unedited
    await row(ids.bio, 'link_in_bio', 'tiktok', 7, 'Link in bio (7 days)', 40);
    await row(ids.ugc, 'ugc', null, 1, 'Content for the brand (UGC)', 100);
    await row(ids.post, 'instagram_post', 'instagram', 1, 'Feed post in the coat', 90); // hand-written description
    await row(ids.free, 'Sponsored story', null, 1, 'A story mention', null); // opportunity free text
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, status, created_at, updated_at)
               VALUES (:todo, :ep, :show, :event, '[]'::jsonb, CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
    { ...ids, tasks: JSON.stringify(TASKS) });
    for (const [component, amount] of [['reel', 225], ['stories_3', 110], ['instagram_post', 115], ['tiktok_video', 225]]) {
      await run(`INSERT INTO deal_rate_anchors (id, version, component, career_tier, amount, created_at, updated_at)
                 VALUES (gen_random_uuid(), :v, :component, 3, :amount, NOW(), NOW())`,
      { v: VERSION, component, amount });
    }
    // The rows above are written after the migration has run on this
    // database; it is run again to carry them.
    await migration.up(sequelize.getQueryInterface(), Sequelize);
  });

  afterAll(async () => {
    await run('DELETE FROM deal_rate_anchors WHERE version = :v', { v: VERSION });
    await run('DELETE FROM episode_todo_lists WHERE id = :todo', ids);
    await run('DELETE FROM event_deliverables WHERE event_id = :event', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const byId = async () => Object.fromEntries((await q(
    `SELECT id, deliverable_type, platform, quantity, description, fee FROM event_deliverables WHERE event_id = :event`, ids,
  )).map((r) => [r.id, r]));

  it('carries each D15 key to its Pulse format on The Pulse, relabelled; fees untouched', async () => {
    const r = await byId();
    expect(r[ids.reel]).toMatchObject({ deliverable_type: 'pulse_video', platform: 'pulse', quantity: 1, description: 'Pulse video', fee: 225 });
    expect(r[ids.tiktok]).toMatchObject({ deliverable_type: 'pulse_video', platform: 'pulse', quantity: 2, description: 'Pulse video (×2)', fee: 250 });
    expect(r[ids.stories]).toMatchObject({ deliverable_type: 'pulse_stories', platform: 'pulse', quantity: 3, description: 'Pulse stories (×3)', fee: 110 });
    expect(r[ids.bio]).toMatchObject({ deliverable_type: 'link_in_bio', platform: 'pulse', quantity: 7, description: 'Profile link (7 days)', fee: 40 });
    expect(r[ids.ugc]).toMatchObject({ deliverable_type: 'ugc', platform: null, description: 'Content for the brand (UGC)', fee: 100 });
    expect(r[ids.post]).toMatchObject({ deliverable_type: 'pulse_post', platform: 'pulse', description: 'Feed post in the coat', fee: 90 });
    expect(r[ids.free]).toMatchObject({ deliverable_type: 'Sponsored story', platform: null, description: 'A story mention' });
  });

  it('rewrites the drafted copies, so a drafted row still reads Auto-drafted', async () => {
    const [ev] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    const records = asJson(ev.canon_consequences).automation.drafted_values.deliverables;
    expect(records[ids.reel]).toEqual({ type: 'pulse_video', platform: 'pulse', quantity: 1, fee: 225, description: 'Pulse video', required: true });
    expect(records[ids.stories]).toEqual({ type: 'pulse_stories', platform: 'pulse', quantity: 3, fee: 110, description: 'Pulse stories (×3)', required: true });
  });

  it('renames the rate card components and retires the TikTok anchor', async () => {
    const live = await q(`SELECT component, amount FROM deal_rate_anchors WHERE version = :v AND deleted_at IS NULL ORDER BY component`, { v: VERSION });
    expect(live).toEqual([
      { component: 'pulse_post', amount: 115 },
      { component: 'pulse_stories_3', amount: 110 },
      { component: 'pulse_video', amount: 225 },
    ]);
    const retired = await q(`SELECT component FROM deal_rate_anchors WHERE version = :v AND deleted_at IS NOT NULL`, { v: VERSION });
    expect(retired).toEqual([{ component: 'tiktok_video' }]);
  });

  it('puts stored tasks on The Pulse, in the task list and the event\'s own copy', async () => {
    const [list] = await q('SELECT social_tasks FROM episode_todo_lists WHERE id = :todo', ids);
    expect(asJson(list.social_tasks).map((t) => t.platform)).toEqual(['pulse', 'pulse', 'pulse']);
    const [ev] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    expect(asJson(ev.canon_consequences).automation.social_tasks.map((t) => t.platform)).toEqual(['pulse', 'pulse', 'pulse']);
  });

  it('running up again changes nothing', async () => {
    const before = await byId();
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect(await byId()).toEqual(before);
  });

  it('down restores the D15 keys, labels and anchors; up carries them forward again', async () => {
    await migration.down(sequelize.getQueryInterface(), Sequelize);
    const b = await byId();
    expect(b[ids.reel]).toMatchObject({ deliverable_type: 'instagram_reel', platform: 'instagram', description: 'Instagram Reel' });
    // Which videos were TikTok's is not kept: both come back as Reels.
    expect(b[ids.tiktok]).toMatchObject({ deliverable_type: 'instagram_reel', description: 'Instagram Reel (×2)' });
    expect(b[ids.stories]).toMatchObject({ deliverable_type: 'instagram_stories', description: 'Instagram Stories (×3)' });
    expect(b[ids.bio]).toMatchObject({ deliverable_type: 'link_in_bio', description: 'Link in bio (7 days)' });
    expect(b[ids.post]).toMatchObject({ deliverable_type: 'instagram_post', description: 'Feed post in the coat' });
    const [ev] = await q('SELECT canon_consequences FROM world_events WHERE id = :event', ids);
    expect(asJson(ev.canon_consequences).automation.drafted_values.deliverables[ids.reel])
      .toMatchObject({ type: 'instagram_reel', platform: 'instagram', description: 'Instagram Reel' });
    const anchors = await q(`SELECT component FROM deal_rate_anchors WHERE version = :v AND deleted_at IS NULL ORDER BY component`, { v: VERSION });
    expect(anchors.map((a) => a.component)).toEqual(['instagram_post', 'reel', 'stories_3', 'tiktok_video']);

    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect((await byId())[ids.stories]).toMatchObject({ deliverable_type: 'pulse_stories', platform: 'pulse', description: 'Pulse stories (×3)' });
  });
});
