/**
 * S1-B (Evoni, 2026-11-25): an accepted or filmed episode is protected from
 * automatic production writes. Its plan, its scenes, their backgrounds, the
 * operator's writing, the wardrobe links and the footage are kept as they are.
 *
 * Two existing definitions, neither redefined here:
 *   accepted — episodes.evaluation_status = 'accepted'
 *   filmed   — utils/frozenEpisode.filmedAt: ANY episode_raw_clips row for the
 *              episode, removed (soft-deleted) clips included
 *
 * Error codes, by state (Evoni's option 3):
 *   accepted (filmed or not) → 409 EPISODE_ACCEPTED on the beat save, the code
 *                              that save has answered since L11
 *   filmed, unaccepted       → 409 EPISODE_FROZEN
 *   the paths with no accepted contract of their own (generate-plan, Start,
 *   Resume)                  → 409 EPISODE_FROZEN either way
 *
 * Reads stay available, and a frozen synchronisation is HELD, never failed.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const beatScenes = require('../../src/services/beatScenesService');
const { episodeFreeze, filmedAt } = require('../../src/utils/frozenEpisode');
const { CANONICAL_BEATS } = require('../../src/constants/canonicalBeats');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const CANON = CANONICAL_BEATS.map((b) => b.number);

(shouldSkip ? describe.skip : describe)('A frozen episode takes no automatic production write (S1-B)', () => {
  const show = uuid();
  let token;
  let setA;
  let setB;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  /** An episode with a full plan, a scene per beat, operator writing and a wardrobe link. */
  async function episode({ accepted = false, filmed = false } = {}) {
    const ep = uuid();
    // Built as a DRAFT first: the plan, the scenes and the operator's work all
    // need the ordinary writers, which the freeze would refuse. The episode is
    // accepted and filmed at the end, exactly as it happens in production.
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'Frozen ep', :n, 'draft', NULL, NOW(), NOW())`,
      { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :show, 'draft', NOW(), NOW())`, { ep, show });
    for (const n of CANON) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label,
                   shot_type, emotional_intent, transition_in, director_note, sort_order, locked, chosen_by_user,
                   ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :n, :name, :setA, 'WIDE', 'establishing', :intent, 'cut',
                   :note, :n, false, false, true, NOW(), NOW())`,
      { ep, n, name: `Beat ${n}`, setA, intent: `intent ${n}`, note: `her note ${n}` });
    }
    await run(`UPDATE scene_plans SET feed_moment = '{"caption":"mine"}'::jsonb, script_lines = '["my line"]'::jsonb
               WHERE episode_id = :ep AND beat_number = 4`, { ep });
    // the beats' scene rows, made the way every caller makes them
    await beatScenes.syncBeatScenes(sequelize, ep);
    await run(`UPDATE scenes SET background_url = 'https://x/HER-OWN.png' WHERE episode_id = :ep AND scene_number = 4`, { ep });
    const [scene2] = await rows('SELECT id FROM scenes WHERE episode_id = :ep AND scene_number = 2', { ep });
    const piece = uuid();
    await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, created_at, updated_at)
               VALUES (:piece, :name, 'top', :show, NOW(), NOW())`, { piece, name: `Look ${piece.slice(0, 8)}`, show });
    await run(`INSERT INTO episode_wardrobe (id, episode_id, scene_id, wardrobe_id, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :scene, :piece, NOW(), NOW())`, { ep, scene: scene2.id, piece });
    // Now freeze it, after everything a draft is allowed to save.
    if (filmed) {
      await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :show, 'lala', :key, 'none', 'low', NOW(), NOW())`,
      { ep, show, key: `raw/${ep.slice(0, 8)}.mp4` });
    }
    if (accepted) await run(`UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep`, { ep });
    return ep;
  }

  /** Everything the freeze must keep, in one comparable shape. */
  const snapshot = async (ep) => ({
    plans: await rows(`SELECT id, beat_number, beat_name, scene_set_id, shot_type, emotional_intent, transition_in,
        director_note, locked, chosen_by_user, ai_suggested, sort_order,
        (feed_moment IS NOT NULL) AS fm, (script_lines IS NOT NULL) AS sl
      FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number`, { ep }),
    scenes: await rows(`SELECT id, scene_plan_id, scene_number, title, background_url, scene_set_id,
        (deleted_at IS NOT NULL) AS tomb FROM scenes WHERE episode_id = :ep ORDER BY scene_number NULLS LAST, created_at`, { ep }),
    wardrobe: await rows('SELECT scene_id, wardrobe_id FROM episode_wardrobe WHERE episode_id = :ep ORDER BY scene_id', { ep }),
    clips: await rows('SELECT id, created_at FROM episode_raw_clips WHERE episode_id = :ep ORDER BY created_at', { ep }),
    setup: await rows('SELECT setup_status FROM episodes WHERE id = :ep', { ep }),
  });

  const reply = (setId) => CANON.map((n) => ({
    beat_number: n, beat_name: `gen b${n}`, scene_set_id: setId, angle_label: 'WIDE',
    shot_type: 'medium', emotional_intent: `gen intent ${n}`, transition_in: 'cut', confidence: 0.9,
  }));
  const answer = () => mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify(reply(setB)) }] });

  const generate = (ep) => auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`));
  const put = (ep, beat, body) => auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/${beat}`)).send(body);
  const exportIt = (ep) => auth(request(app).post(`/api/v1/episodes/${ep}/export`))
    .send({ platform: 'youtube', quality: '720p', format: 'mp4' });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-frozen', email: 'user@frozen.dev', name: 'Editor', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Frozen ${show.slice(0, 8)}`, slug: `frozen-${show.slice(0, 8)}` });
    for (const key of ['a', 'b']) {
      const id = uuid();
      if (key === 'a') setA = id; else setB = id;
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, script_context,
                   generation_status, created_at, updated_at)
                 VALUES (:id, :name, 'EVENT_LOCATION', :show, :base, :ctx, 'complete', NOW(), NOW())`,
      { id, name: `Set ${key} ${id.slice(0, 6)}`, show, base: `https://x/${key}.jpg`, ctx: `Context ${key}` });
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, still_image_url,
                   generation_status, created_at, updated_at)
                 VALUES (gen_random_uuid(), :id, 'WIDE', 'Wide', :url, 'complete', NOW(), NOW())`,
      { id, url: `https://x/${key}-wide.jpg` });
    }
  });

  beforeEach(() => { mockCreate.mockReset(); answer(); });

  // ── the states, and the codes each answers with ──────────────────────────

  const STATES = [
    ['accepted, unfilmed', { accepted: true }, 'EPISODE_ACCEPTED'],
    ['filmed, unaccepted', { filmed: true }, 'EPISODE_FROZEN'],
    ['accepted and filmed', { accepted: true, filmed: true }, 'EPISODE_ACCEPTED'],
  ];

  describe.each(STATES)('%s', (_label, state, beatCode) => {
    it('refuses generate-plan with EPISODE_FROZEN and writes nothing — and pays for no model call', async () => {
      const ep = await episode(state);
      const before = await snapshot(ep);

      const res = await generate(ep);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_FROZEN');
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/kept as it was|Nothing was changed/i);
      // the refusal happens before the planner's own call
      expect(mockCreate).not.toHaveBeenCalled();
      expect(await snapshot(ep)).toEqual(before);
    });

    it.each([
      ['a director\'s note', { director_note: 'written while frozen' }],
      ['a shot type', { shot_type: 'close' }],
      ['an emotional intent', { emotional_intent: 'written while frozen' }],
      ['a transition', { transition_in: 'wipe' }],
      ['chosen alone', { chosen: true }],
      ['a new scene set', { scene_set_id: null }],            // filled in below
      ['an already-linked scene set', { scene_set_id: null }], // filled in below
    ])(`refuses a beat save of %s with ${beatCode}`, async (label, body) => {
      const ep = await episode(state);
      const before = await snapshot(ep);
      const sent = { ...body };
      if (label === 'a new scene set') sent.scene_set_id = setB;
      if (label === 'an already-linked scene set') sent.scene_set_id = setA;

      const res = await put(ep, 3, sent);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(beatCode);
      expect(await snapshot(ep)).toEqual(before);
    });

    it('a direct syncBeatScenes call is held, writes nothing, and is never a failure', async () => {
      const ep = await episode(state);
      const before = await snapshot(ep);

      const sync = await beatScenes.syncBeatScenes(sequelize, ep);

      expect(sync.outcome).toBe('held');
      expect(sync).toMatchObject({ created: 0, updated: 0, removed: 0, frozen: true });
      expect(sync.outcome).not.toBe('failed');
      expect(await snapshot(ep)).toEqual(before);

      // and the quiet wrapper reports the same, not a failure
      const quiet = await beatScenes.syncBeatScenesQuietly(sequelize, ep, 'test');
      expect(quiet.outcome).toBe('held');
      expect(quiet.retryable).toBeUndefined();
    });

    it('refuses Resume before setup_status or any other setup write', async () => {
      const ep = await episode(state);
      const before = await snapshot(ep);
      const { resumeEpisodeSetup } = require('../../src/services/episodeGeneratorService');

      await expect(resumeEpisodeSetup(models, ep)).rejects.toMatchObject({ code: 'EPISODE_FROZEN' });

      const after = await snapshot(ep);
      expect(after).toEqual(before);
      expect(after.setup).toEqual(before.setup);
    });

    it('keeps reads available: the plan and the scenes still answer 200', async () => {
      const ep = await episode(state);
      const before = await snapshot(ep);

      expect((await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`))).status).toBe(200);
      expect((await auth(request(app).get(`/api/v1/episodes/${ep}/scenes`))).status).toBe(200);

      expect(await snapshot(ep)).toEqual(before);
    });

    it('a valid export still works, and writes nothing', async () => {
      const ep = await episode(state);
      const before = await snapshot(ep);

      const res = await exportIt(ep);

      expect(res.status).toBe(202);
      expect(await snapshot(ep)).toEqual(before);
    });

    it('an export short of a required scene is still refused, and nothing is repaired', async () => {
      const ep = await episode(state);
      // beat 6's scene is removed, so the plan names a set with no live scene
      await run(`DELETE FROM scenes WHERE episode_id = :ep AND scene_number = 6`, { ep });
      const before = await snapshot(ep);

      const res = await exportIt(ep);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EXPORT_SCENES_UNVERIFIED');
      // the missing scene is NOT recreated to make the export succeed
      expect(await snapshot(ep)).toEqual(before);
      expect((await rows('SELECT id FROM scenes WHERE episode_id = :ep AND scene_number = 6', { ep }))).toHaveLength(0);
    });
  });

  // ── a draft episode keeps every existing behaviour ───────────────────────

  describe('a draft, unfilmed episode', () => {
    it('is unchanged: generate-plan saves, the beat save saves, and the sync works', async () => {
      const ep = await episode();
      expect(await filmedAt(sequelize, ep)).toBeNull();
      expect(await episodeFreeze(sequelize, ep)).toMatchObject({ frozen: false, accepted: false, frozenAt: null });

      const res = await generate(ep);
      expect(res.status).toBe(200);
      expect(mockCreate).toHaveBeenCalled();

      expect((await put(ep, 3, { director_note: 'a draft takes edits' })).status).toBe(200);
      expect((await rows('SELECT director_note FROM scene_plans WHERE episode_id = :ep AND beat_number = 3', { ep }))[0].director_note)
        .toBe('a draft takes edits');

      const sync = await beatScenes.syncBeatScenes(sequelize, ep);
      expect(sync.outcome).not.toBe('held');
      expect(sync.frozen).toBeUndefined();
    });
  });

  // ── the freeze reader itself ──────────────────────────────────────────────

  it('reads both definitions without redefining either', async () => {
    const draft = await episode();
    const accepted = await episode({ accepted: true });
    const filmed = await episode({ filmed: true });
    const both = await episode({ accepted: true, filmed: true });

    expect(await episodeFreeze(sequelize, draft)).toMatchObject({ frozen: false, accepted: false, frozenAt: null });
    expect(await episodeFreeze(sequelize, accepted)).toMatchObject({ frozen: true, accepted: true, frozenAt: null });
    expect(await episodeFreeze(sequelize, filmed)).toMatchObject({ frozen: true, accepted: false });
    expect((await episodeFreeze(sequelize, filmed)).frozenAt).toBe(await filmedAt(sequelize, filmed));
    expect(await episodeFreeze(sequelize, both)).toMatchObject({ frozen: true, accepted: true });

    // a soft-deleted clip still counts as filmed, as filmedAt has always said
    await run(`UPDATE episode_raw_clips SET deleted_at = NOW() WHERE episode_id = :ep`, { ep: filmed });
    expect((await episodeFreeze(sequelize, filmed)).frozen).toBe(true);
  });
});
