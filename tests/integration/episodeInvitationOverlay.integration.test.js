/**
 * P10 (Evoni, 2026-09-30; Task #2386), verbatim:
 * "An event's approved invitation is an episode overlay: tagged as the
 * episode's invitation overlay, shown in that episode's overlays and placed
 * on the invitation beat, whether approved before or after Start Episode.
 * Regenerating and approving a new one replaces it. The Phone Hub keeps
 * show-wide overlays only; an episode's Lala's Phone shows show-wide plus
 * that episode's own."
 *
 * Invitation asset rows are seeded by SQL (the test database built from
 * src/migrations lacks columns Asset.create writes — see
 * careerChecklistRegenerate.integration.test.js). The test database has no
 * timeline_placements table (only a dead migration tree creates it), so
 * this suite creates it with the model's columns when missing and drops
 * it afterwards only if it created it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v || {});

(shouldSkip ? describe.skip : describe)('The approved invitation is the episode\'s invitation overlay (P10)', () => {
  let token;
  let createdPlacementsTable = false;
  const shows = [];

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-p10', email: 'test@p10.dev', name: 'P10', groups: ['USER', 'EDITOR'], role: 'USER',
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
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      await run(`DELETE FROM timeline_placements WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup placements:', err.message));
      await run(`DELETE FROM assets WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup assets:', err.message));
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM scene_set_episodes WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup scene_set_episodes:', err.message));
      await run(`DELETE FROM ui_overlay_types WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup types:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
    if (createdPlacementsTable) await run('DROP TABLE IF EXISTS timeline_placements');
  });

  // A show with a show-wide Mail Panel screen and an (ungenerated) Invite
  // Letter overlay type, and an event with its first invitation version.
  async function seed() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `P10 show ${ids.show.slice(0, 8)}`, slug: `p10-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, prompt, sort_order, created_at, updated_at)
               VALUES (gen_random_uuid(), :show, 'mail_panel', 'Mail Panel', 'phone', 'p', 1, NOW(), NOW()),
                      (gen_random_uuid(), :show, 'invite_letter', 'Invite Letter', 'phone', 'p', 2, NOW(), NOW())`, ids);
    ids.mail = uuid();
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:mail, 'UI Overlay: Mail Panel', 'UI_OVERLAY', :show, 'https://x/mail.png',
                       '{"overlay_type":"mail_panel"}'::jsonb, NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Hour Gala', 'invite', 'ready', NOW(), NOW())`, ids);
    ids.inv1 = await addInvitation(ids, 1);
    return ids;
  }

  async function addInvitation(ids, version) {
    const id = uuid();
    const [ev] = await q(`SELECT used_in_episode_id FROM world_events WHERE id = :event`, ids);
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, show_id, episode_id, s3_url_processed, approval_status, metadata, created_at, updated_at)
               VALUES (:id, :name, 'INVITATION_LETTER', 'UI.OVERLAY.INVITATION', :show, :ep, :url, 'pending_review',
                       CAST(:meta AS jsonb), NOW(), NOW())`,
    { id, show: ids.show, ep: ev?.used_in_episode_id || null, name: `Velvet Hour Gala — Invitation v${version}`,
      url: `https://x/inv${version}.png`, meta: JSON.stringify({ event_id: ids.event, version }) });
    return id;
  }

  const approve = (ids, assetId) => request(app)
    .post(`/api/v1/world/${ids.show}/events/${ids.event}/approve-invitation`)
    .set('Authorization', `Bearer ${token}`)
    .send({ assetId });

  async function start(ids) {
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const out = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    ids.ep = out.episode.id;
    return out;
  }

  const overlays = (ids, episodeId) => request(app)
    .get(`/api/v1/ui-overlays/${ids.show}${episodeId ? `?episode_id=${episodeId}` : ''}`)
    .set('Authorization', `Bearer ${token}`);

  const placementsOf = (ep, assetId) => q(
    `SELECT id, scene_id, label, properties FROM timeline_placements
      WHERE episode_id = :ep AND asset_id = :assetId AND deleted_at IS NULL`, { ep, assetId });

  const metaOf = async (id) => asJson((await q(`SELECT metadata FROM assets WHERE id = :id`, { id }))[0].metadata);

  async function expectEpisodeInvitation(ids, assetId) {
    // Tagged as the episode's invitation overlay.
    const [row] = await q(`SELECT episode_id, approval_status FROM assets WHERE id = :assetId`, { assetId });
    expect(row).toMatchObject({ episode_id: ids.ep, approval_status: 'approved' });
    expect(await metaOf(assetId)).toMatchObject({ overlay_type: 'invite_letter', episode_invitation: true });

    // Shown in the episode's overlays (Lala's Phone), alongside show-wide.
    const res = await overlays(ids, ids.ep);
    expect(res.status).toBe(200);
    const invite = res.body.data.find((o) => o.id === 'invite_letter');
    expect(invite).toMatchObject({ generated: true, asset_id: assetId, is_episode_override: true, is_episode_invitation: true });
    expect(res.body.data.find((o) => o.id === 'mail_panel')).toMatchObject({ generated: true, asset_id: ids.mail });

    // Placed once, on the invitation beat (beat 5, Reveal).
    const placed = await placementsOf(ids.ep, assetId);
    expect(placed).toHaveLength(1);
    expect(placed[0].scene_id).toBeNull();
    expect(placed[0].label).toBe('Invitation — Beat 5: Reveal');
    const [beat] = await q(`SELECT id FROM scene_plans WHERE episode_id = :ep AND beat_number = 5`, { ep: ids.ep });
    expect(asJson(placed[0].properties)).toMatchObject({ kind: 'invitation', anchor: 'beat', beat_number: 5, scene_plan_id: beat.id });
  }

  it('approved before Start: Start tags it, lists it in the episode overlays and places it on the invitation beat', async () => {
    const ids = await seed();
    const res = await approve(ids, ids.inv1);
    expect(res.status).toBe(200);
    expect(res.body.episodeId).toBeNull();
    // No episode yet: not tagged as an overlay.
    expect((await metaOf(ids.inv1)).overlay_type).toBeUndefined();

    await start(ids);
    await expectEpisodeInvitation(ids, ids.inv1);
  });

  it('approved after Start: approval tags it, lists it and places it on the invitation beat', async () => {
    const ids = await seed();
    await start(ids);
    expect(await placementsOf(ids.ep, ids.inv1)).toHaveLength(0);
    const res = await approve(ids, ids.inv1);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ episodeId: ids.ep, placement_anchor: 'beat' });
    await expectEpisodeInvitation(ids, ids.inv1);
  });

  it('regenerate + approve replaces it: the old one is untagged and unplaced, the new one placed once', async () => {
    const ids = await seed();
    await approve(ids, ids.inv1);
    await start(ids);
    await expectEpisodeInvitation(ids, ids.inv1);

    const inv2 = await addInvitation(ids, 2);
    // Not approved yet: the episode still shows v1 and v2 is not listed.
    let res = await overlays(ids, ids.ep);
    expect(res.body.data.find((o) => o.id === 'invite_letter').asset_id).toBe(ids.inv1);

    expect((await approve(ids, inv2)).status).toBe(200);
    expect((await approve(ids, inv2)).status).toBe(200); // approving twice is idempotent
    await expectEpisodeInvitation(ids, inv2);

    const oldMeta = await metaOf(ids.inv1);
    expect(oldMeta.overlay_type).toBeUndefined();
    expect(oldMeta.episode_invitation).toBeUndefined();
    expect(oldMeta.superseded_by).toBe(inv2);
    expect(await placementsOf(ids.ep, ids.inv1)).toHaveLength(0);

    res = await overlays(ids, ids.ep);
    expect(res.body.data.filter((o) => o.asset_id === ids.inv1)).toHaveLength(0);
  });

  it('the Phone Hub (no episode) lists show-wide overlays only, never the invitation', async () => {
    const ids = await seed();
    await approve(ids, ids.inv1);
    await start(ids);

    const res = await overlays(ids, null);
    expect(res.status).toBe(200);
    expect(res.body.data.find((o) => o.id === 'mail_panel')).toMatchObject({ generated: true, asset_id: ids.mail });
    expect(res.body.data.find((o) => o.id === 'invite_letter')).toMatchObject({ generated: false, asset_id: null });
    expect(res.body.data.some((o) => o.is_episode_invitation || o.asset_id === ids.inv1)).toBe(false);
  });

  it('a show with no invitation overlay type still shows the episode\'s invitation on Lala\'s Phone', async () => {
    const ids = await seed();
    await run(`DELETE FROM ui_overlay_types WHERE show_id = :show AND type_key = 'invite_letter'`, ids);
    await start(ids);
    await approve(ids, ids.inv1);
    expect((await metaOf(ids.inv1)).overlay_type).toBe('InviteLetterOverlay');
    const res = await overlays(ids, ids.ep);
    expect(res.body.data.find((o) => o.id === 'InviteLetterOverlay'))
      .toMatchObject({ generated: true, asset_id: ids.inv1, category: 'phone', is_episode_invitation: true });
    expect((await overlays(ids, null)).body.data.some((o) => o.asset_id === ids.inv1)).toBe(false);
  });
});
