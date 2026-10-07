/**
 * Integration Tests - episode task list approval and task-list overlay
 * (Task #2395, ruling P14; 20261001150000-add-task-list-approval-and-overlay).
 *
 * P14 (Evoni, 2026-09-30), verbatim: "An episode's task list can be
 * approved; approving offers "Design task-list overlay" (cost shown) in the
 * event's visual direction; it becomes an episode overlay placed on the
 * tasks/deadline beat, replacing an earlier one."
 *
 * Against the test database, through the app. The image provider is mocked
 * (imageGenerationService.generateImageUrl) and so are the I/O seams
 * (episodeTaskListOverlayService._io: storage check, background fetch,
 * upload); the compositing itself is real (canvas + sharp), with the font
 * download stubbed. The test database has no timeline_placements table
 * (only a dead migration tree creates it), so this suite creates it with the
 * model's columns when missing and drops it afterwards only if it created
 * it (the P10 suite's pattern).
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const imageGen = require('../../src/services/imageGenerationService');
const invitationCompositing = require('../../src/services/invitationCompositingService');
const taskListOverlay = require('../../src/services/episodeTaskListOverlayService');
const migration = require('../../src/migrations/20261001150000-add-task-list-approval-and-overlay');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const one = async (sql, replacements = {}) => (await q(sql, replacements))[0];
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v || {});

const TASKS = [
  { slot: 'deliverable_d1', label: 'Post the sponsored reel', description: 'Reel', deliverable_id: uuid(), owed_to: 'brand', required: true, completed: false, task_source: 'brand_deliverable' },
  { slot: 'grwm', label: 'Film the GRWM', description: 'Feature the gown', task_source: 'goal', required: false, completed: false },
  { slot: 'career_network', label: 'Meet the editor', description: '', task_source: 'optional', generated_by: 'career', required: false, completed: false },
];

// These cover placing overlays on beats, off for now (Evoni, 2026-10-07:
// "none of the overlays should be beats for now"); the rule is kept for
// when it is turned back on.
const { setOverlaysOnBeats } = require('../../src/services/episodeBeatPlacement');
beforeAll(() => setOverlaysOnBeats(true));
afterAll(() => setOverlaysOnBeats(false));

(shouldSkip ? describe.skip : describe)('Episode task list approval + task-list overlay (P14)', () => {
  const shows = [];
  let token;
  let createdPlacementsTable = false;
  let background;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await migration.up(sequelize.getQueryInterface(), Sequelize); // guarded: a re-run is a no-op
    token = TokenService.generateTokenPair({
      id: 'test-user-p14', email: 'test@p14.dev', name: 'P14', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    const [{ exists }] = await q(`SELECT to_regclass('public.timeline_placements') IS NOT NULL AS exists`);
    if (!exists) {
      await run(`CREATE TABLE timeline_placements (
        id UUID PRIMARY KEY, episode_id UUID NOT NULL, placement_type TEXT NOT NULL, asset_id UUID,
        wardrobe_item_id UUID, scene_id UUID, attachment_point TEXT, offset_seconds DECIMAL(10,3),
        absolute_timestamp DECIMAL(10,3), track_number INTEGER, duration DECIMAL(10,3), z_index INTEGER,
        properties JSONB DEFAULT '{}'::jsonb, character VARCHAR(100), label VARCHAR(255), visual_role TEXT,
        created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ)`);
      createdPlacementsTable = true;
    }
    background = await sharp({ create: { width: 288, height: 512, channels: 3, background: '#f3e4e6' } }).png().toBuffer();
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM timeline_placements WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup placements:', err.message));
      await run('DELETE FROM assets WHERE show_id = :show', { show }).catch((err) => console.warn('cleanup assets:', err.message));
      for (const t of ['scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run('DELETE FROM ui_overlay_types WHERE show_id = :show', { show }).catch((err) => console.warn('cleanup types:', err.message));
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    if (createdPlacementsTable) await run('DROP TABLE IF EXISTS timeline_placements');
    await sequelize.close();
  });

  async function seed({ withType = true, withBeat = true } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), list: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, style_prefix, created_at, updated_at)
               VALUES (:show, :name, :slug, 'SHOW STYLE: pastel watercolour, hand-drawn.', NOW(), NOW())`,
    { ...ids, name: `P14 ${ids.show.slice(0, 8)}`, slug: `p14-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, theme, color_palette,
                 created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'used', :ep, 9, 'soft glam', CAST('["blush","rose gold"]' AS jsonb), NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, status, created_at, updated_at)
               VALUES (:list, :ep, :show, :event, '[]', CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
    { ...ids, tasks: JSON.stringify(TASKS) });
    if (withType) {
      await run(`INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, prompt, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :show, 'mail_panel', 'Mail Panel', 'phone', 'p', 1, NOW(), NOW()),
                        (gen_random_uuid(), :show, 'todo_list', 'To-Do List', 'phone', 'p', 2, NOW(), NOW())`, ids);
    }
    if (withBeat) {
      ids.beat9 = uuid();
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, created_at, updated_at)
                 VALUES (:beat9, :ep, 9, 'Reminder/Deadline', 9, NOW(), NOW()),
                        (gen_random_uuid(), :ep, 5, 'Reveal', 5, NOW(), NOW())`, ids);
    }
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const getState = (ids) => auth(request(app).get(`/api/v1/episodes/${ids.ep}/task-list-overlay`));
  const approve = (ids, body = {}) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/task-list/approve`)).send(body);
  const design = (ids) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/task-list-overlay`));
  const liveOverlays = (ids) => q(
    `SELECT id, asset_type, show_id, episode_id, metadata FROM assets
      WHERE episode_id = :ep AND asset_role = 'UI.OVERLAY.TASK_LIST' AND deleted_at IS NULL`, ids);
  const placements = (ids) => q(
    `SELECT id, asset_id, scene_id, label, properties, deleted_at FROM timeline_placements
      WHERE episode_id = :ep ORDER BY created_at`, ids);
  const overlays = (ids, withEpisode = true) => auth(request(app)
    .get(`/api/v1/ui-overlays/${ids.show}${withEpisode ? `?episode_id=${ids.ep}` : ''}`));

  let genSpy;
  let uploadSpy;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    genSpy = jest.spyOn(imageGen, 'generateImageUrl').mockImplementation(async () => `https://img.test/bg-${uuid()}.png`);
    jest.spyOn(invitationCompositing, 'checkFonts').mockResolvedValue(true); // no font download
    jest.spyOn(taskListOverlay._io, 'storageConfigured').mockReturnValue(true);
    jest.spyOn(taskListOverlay._io, 'fetchImage').mockImplementation(async () => background);
    uploadSpy = jest.spyOn(taskListOverlay._io, 'uploadPng').mockImplementation(async () => `https://bucket.test/tl-${uuid()}.png`);
  });
  afterEach(() => jest.restoreAllMocks());

  it('the four columns exist on episode_todo_lists and are nullable', async () => {
    const cols = await q(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'episode_todo_lists' AND column_name IN
          ('task_list_approved_at','task_list_approved_hash','task_overlay_asset_id','task_overlay_hash')
        ORDER BY column_name`);
    expect(cols).toEqual([
      { column_name: 'task_list_approved_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'task_list_approved_hash', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'task_overlay_asset_id', data_type: 'uuid', is_nullable: 'YES' },
      { column_name: 'task_overlay_hash', data_type: 'text', is_nullable: 'YES' },
    ]);
  });

  it('design before approval is refused (409 TASK_LIST_NOT_APPROVED) and no image is generated', async () => {
    const ids = await seed();
    const res = await design(ids);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TASK_LIST_NOT_APPROVED');
    expect(genSpy).not.toHaveBeenCalled();
    expect(await liveOverlays(ids)).toHaveLength(0);
  });

  it('approve → offer; design → an episode UI_OVERLAY on beat 9, listed in the episode\'s overlays; an edit outdates it; redesign replaces it', async () => {
    const ids = await seed();

    const before = await getState(ids);
    expect(before.status).toBe(200);
    expect(before.body.data).toMatchObject({ exists: true, task_count: 3, approved: false, overlay: null, offer: { offered: false } });
    const { hash } = before.body.data;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // A stale hash is refused; the current one approves and offers the design.
    const stale = await approve(ids, { hash: 'f'.repeat(64) });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('TASK_LIST_CHANGED');
    const ap = await approve(ids, { hash });
    expect(ap.status).toBe(200);
    expect(ap.body.task_list_overlay_offer).toEqual({
      offered: true, kind: 'design', requires_approval: false,
      estimate: { usd: 0.04, priced: true, unit: 'megapixel', units: 1, model: 'fal-ai/flux-pro/v1.1' },
    });
    const row = await one('SELECT task_list_approved_at, task_list_approved_hash FROM episode_todo_lists WHERE id = :list', ids);
    expect(row.task_list_approved_at).not.toBeNull();
    expect(row.task_list_approved_hash).toBe(hash);

    // Design.
    const d1 = await design(ids);
    expect(d1.status).toBe(200);
    expect(genSpy).toHaveBeenCalledTimes(1);
    const [prompt, options] = genSpy.mock.calls[0];
    expect(options).toEqual({ size: 'portrait', quality: 'hd', useCase: 'overlay' });
    expect(prompt.startsWith('SHOW STYLE: pastel watercolour, hand-drawn.')).toBe(true);
    expect(prompt).toContain('(soft glam theme)');
    expect(prompt).toContain('Color palette emphasis: blush, rose gold.');
    expect(prompt).toContain('NO TEXT anywhere on the image');
    // The composited PNG is what is stored, at the background's size.
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [png, uploadEpisode] = uploadSpy.mock.calls[0];
    expect(uploadEpisode).toBe(ids.ep);
    expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 288, height: 512 });

    const o1 = await liveOverlays(ids);
    expect(o1).toHaveLength(1);
    expect(o1[0]).toMatchObject({ id: d1.body.data.assetId, asset_type: 'UI_OVERLAY', show_id: ids.show, episode_id: ids.ep });
    expect(asJson(o1[0].metadata)).toMatchObject({
      overlay_type: 'todo_list', episode_task_list: true, task_list_hash: hash, task_count: 3, tasks_drawn: 3,
      event_id: ids.event, theme: 'soft glam', beat_number: 9,
    });
    const list1 = await one('SELECT task_overlay_asset_id, task_overlay_hash FROM episode_todo_lists WHERE id = :list', ids);
    expect(list1).toEqual({ task_overlay_asset_id: d1.body.data.assetId, task_overlay_hash: hash });

    // Placed on the tasks/deadline beat.
    expect(d1.body.data.placement).toMatchObject({ anchor: 'beat', beat_number: 9, label: 'Task List — Beat 9: Reminder/Deadline' });
    const p1 = await placements(ids);
    expect(p1).toHaveLength(1);
    expect(p1[0]).toMatchObject({ asset_id: d1.body.data.assetId, scene_id: null, label: 'Task List — Beat 9: Reminder/Deadline', deleted_at: null });
    expect(asJson(p1[0].properties)).toMatchObject({ kind: 'task_list', anchor: 'beat', beat_number: 9, scene_plan_id: ids.beat9, screen_action: 'TODO_LIST' });
    expect(d1.body.data.state).toMatchObject({ approved: true, overlay: { outdated: false }, offer: { offered: false } });

    // The episode's overlays list it; the Phone Hub (no episode) does not.
    const epList = await overlays(ids);
    expect(epList.status).toBe(200);
    expect(epList.body.data.find((o) => o.id === 'todo_list')).toMatchObject({
      generated: true, asset_id: d1.body.data.assetId, is_episode_override: true, is_episode_task_list: true,
    });
    const hub = await overlays(ids, false);
    expect(hub.body.data.find((o) => o.id === 'todo_list')).toMatchObject({ generated: false, asset_id: null });

    // Ticking a task done is not an edit: still approved, not outdated.
    const tick = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/todo/complete-social/grwm`)).send({ completed: true });
    expect(tick.status).toBe(200);
    expect((await getState(ids)).body.data).toMatchObject({ approved: true, overlay: { outdated: false }, offer: { offered: false } });

    // Rewording a task outdates the overlay and un-approves the list.
    const edited = TASKS.map((t) => (t.slot === 'grwm' ? { ...t, label: 'Film the GRWM at golden hour', completed: true } : t));
    await run('UPDATE episode_todo_lists SET social_tasks = CAST(:tasks AS jsonb) WHERE id = :list', { ...ids, tasks: JSON.stringify(edited) });
    const changed = await getState(ids);
    expect(changed.body.data).toMatchObject({
      approved: false,
      overlay: { asset_id: d1.body.data.assetId, outdated: true },
      offer: { offered: true, kind: 'redesign', requires_approval: true },
    });
    expect(changed.body.data.hash).not.toBe(hash);
    expect((await design(ids)).status).toBe(409);

    // Approve the changed list and redesign: the earlier overlay and its placement go.
    const ap2 = await approve(ids, { hash: changed.body.data.hash });
    expect(ap2.body.task_list_overlay_offer).toMatchObject({ offered: true, kind: 'redesign', requires_approval: false });
    const d2 = await design(ids);
    expect(d2.status).toBe(200);
    expect(d2.body.data.replaced).toEqual([d1.body.data.assetId]);

    const o2 = await liveOverlays(ids);
    expect(o2.map((o) => o.id)).toEqual([d2.body.data.assetId]);
    expect((await one('SELECT deleted_at FROM assets WHERE id = :id', { id: d1.body.data.assetId })).deleted_at).not.toBeNull();
    const p2 = await placements(ids);
    expect(p2).toHaveLength(2);
    expect(p2.find((p) => p.asset_id === d1.body.data.assetId).deleted_at).not.toBeNull();
    expect(p2.find((p) => p.asset_id === d2.body.data.assetId)).toMatchObject({ scene_id: null, deleted_at: null, label: 'Task List — Beat 9: Reminder/Deadline' });
    const list2 = await one('SELECT task_overlay_asset_id, task_overlay_hash FROM episode_todo_lists WHERE id = :list', ids);
    expect(list2).toEqual({ task_overlay_asset_id: d2.body.data.assetId, task_overlay_hash: changed.body.data.hash });
    const epList2 = await overlays(ids);
    expect(epList2.body.data.find((o) => o.id === 'todo_list').asset_id).toBe(d2.body.data.assetId);
  });

  it('a show with no task-list overlay type: the default key, appended to the episode\'s overlays', async () => {
    const ids = await seed({ withType: false });
    const { hash } = (await getState(ids)).body.data;
    await approve(ids, { hash });
    const d = await design(ids);
    expect(d.status).toBe(200);
    expect(d.body.data.overlayType).toBe('TodoListOverlay');
    const entry = (await overlays(ids)).body.data.find((o) => o.id === 'TodoListOverlay');
    expect(entry).toMatchObject({ name: 'Task List', beat: 'Beat 9', asset_id: d.body.data.assetId, is_episode_task_list: true });
  });

  it('a budget refusal is a 429 with its message, and nothing is written', async () => {
    const ids = await seed();
    const { hash } = (await getState(ids)).body.data;
    await approve(ids, { hash });
    genSpy.mockImplementation(async () => {
      const err = new Error('Daily image budget reached ($10.00). Try again tomorrow.');
      err.status = 429;
      err.code = 'AI_BUDGET_EXCEEDED';
      throw err;
    });
    const res = await design(ids);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Daily image budget reached ($10.00). Try again tomorrow.');
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(await liveOverlays(ids)).toHaveLength(0);
    expect(await placements(ids)).toHaveLength(0);
    const row = await one('SELECT task_overlay_asset_id, task_overlay_hash FROM episode_todo_lists WHERE id = :list', ids);
    expect(row).toEqual({ task_overlay_asset_id: null, task_overlay_hash: null });
  });

  it('an episode with no task list: nothing to approve (400 TASK_LIST_EMPTY)', async () => {
    const ids = await seed();
    await run('DELETE FROM episode_todo_lists WHERE id = :list', ids);
    expect((await getState(ids)).body.data).toMatchObject({ exists: false, offer: { offered: false } });
    const res = await approve(ids);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TASK_LIST_EMPTY');
  });
});
