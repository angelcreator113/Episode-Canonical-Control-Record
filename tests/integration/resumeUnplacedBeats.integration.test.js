/**
 * Unplaced beats are reported by the Locations step (Evoni, 2026-11-26).
 *
 * Every one of the 14 canonical beats has an expected role:
 * constants/beatLocations derives it from CANONICAL_BEATS' typical_location
 * and defaults to home, so NO beat is typed as locationless (measured: 10
 * home, 1 closet which falls back to home, 3 event). A beat with no scene set
 * therefore means its role had no location when the beat was made, or its
 * location has since been removed — which listLocations drops, because it
 * joins `scene_sets … AND s.deleted_at IS NULL`.
 *
 * What this suite pins:
 *   - such a beat is REPORTED by the Locations step, with its number, under
 *     the existing LOCATIONS_INCOMPLETE code and the existing sentence;
 *   - Resume rechecks on EVERY run, so a step recorded complete — or never
 *     recorded — can truthfully become incomplete;
 *   - nothing is repaired: no role is assigned and no beat's set is written,
 *     so adding a location alone does NOT mark the episode recovered;
 *   - the manual recovery sequence works: add the location, place the beats
 *     in the Beat Plan editor, Resume, complete;
 *   - a locked beat and a user-chosen beat are reported but never touched;
 *   - an accepted or filmed episode refuses Resume with NO status mutation.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const generator = require('../../src/services/episodeGeneratorService');
const { isFrozenEpisodeError } = require('../../src/utils/frozenEpisode');
const { BEAT_LOCATIONS } = require('../../src/constants/beatLocations');
const { CANONICAL_BEATS } = require('../../src/constants/canonicalBeats');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const beatsOfRole = (role) => CANONICAL_BEATS.map((b) => b.number).filter((n) => BEAT_LOCATIONS[n].role === role);

(shouldSkip ? describe.skip : describe)('Unplaced beats are reported by the Locations step', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'unpl-admin', email: 'a@unpl.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, '{"starting_balance":1000}'::jsonb, NOW(), NOW())`,
    { show, name: `Unpl ${show.slice(0, 8)}`, slug: `unpl-${show.slice(0, 8)}` });
  });

  afterAll(async () => {
    for (const t of ['scenes', 'scene_plans', 'scene_set_episodes', 'episode_briefs', 'episode_raw_clips']) {
      await run(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show }).catch(() => {});
    }
    await run('UPDATE world_events SET scene_set_id = NULL, used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM scene_sets WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
  });

  async function set(name, type = 'EVENT_LOCATION', { deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, show_id, base_still_url, script_context, deleted_at, created_at, updated_at)
               VALUES (:id, :name, :type, 'complete', :show, :url, 'ctx', :deletedAt, NOW(), NOW())`,
    { id, name: `${name} ${id.slice(0, 6)}`, type, show, url: `https://x/${id.slice(0, 6)}.png`, deletedAt: deleted ? new Date() : null });
    return id;
  }

  /** A draft episode, its brief and event, with only the roles given linked. */
  async function episode({ home = null, event: eventSet = null, closet = null, roles = null } = {}) {
    const ep = uuid();
    const ev = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, setup_status, created_at, updated_at)
               VALUES (:ep, :show, 'Unpl ep', :n, 'draft', NULL, :status::jsonb, NOW(), NOW())`,
    { ep, show, n: Math.floor(Math.random() * 100000) + 1500, status: roles ? JSON.stringify({ steps: { locations: roles } }) : null });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, :name, 'invite', 'used', 5, :setId, :ep, NOW(), NOW())`,
    { ev, show, name: `Unpl event ${ev.slice(0, 6)}`, setId: eventSet, ep });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :show, :ev, 'draft', NOW(), NOW())`, { ep, show, ev });
    for (const [role, setId] of [['home', home], ['event', eventSet], ['closet', closet]]) {
      if (!setId) continue;
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, :role, NULL, 1, NOW(), NOW())`, { setId, ep, role });
    }
    return { ep, ev };
  }

  const planRows = (ep) => rows('SELECT beat_number, scene_set_id, angle_label, locked, chosen_by_user FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number', { ep });
  const statusOf = async (ep) => (await rows('SELECT setup_status FROM episodes WHERE id = :ep', { ep }))[0].setup_status;

  // ══════════════════════════════════════════════════════════════════════
  // 1. A BEAT WITH NO SET IS REPORTED, BY NUMBER
  // ══════════════════════════════════════════════════════════════════════
  describe('a beat left with no scene set', () => {
    test('home-role beats with no home location: reported with their numbers, and nothing is assigned', async () => {
      const venue = await set('h venue');
      const { ep } = await episode({ event: venue });

      const out = await generator.resumeEpisodeSetup(models, ep);

      const made = await planRows(ep);
      const unplaced = made.filter((b) => b.scene_set_id === null).map((b) => b.beat_number);
      expect(unplaced).toEqual(beatsOfRole('home').concat(beatsOfRole('closet')).sort((a, b) => a - b));
      expect(out.setup_status.steps.locations.status).toBe('failed');
      expect(out.setup_status.steps.locations.code).toBe('LOCATIONS_INCOMPLETE');
      expect(out.setup_status.steps.locations.reason).toMatch(/have no scene set \(beats /);
      for (const n of unplaced) expect(out.setup_status.steps.locations.reason).toMatch(new RegExp(`\\b${n}\\b`));
      expect(out.setup_status.complete).toBe(false);
      // Nothing was assigned: no role invented, no beat set written.
      expect((await rows('SELECT role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY role', { ep })).map((l) => l.role)).toEqual(['event']);
    });

    test('event-role beats with no event location: reported', async () => {
      const home = await set('e home', 'HOME_BASE');
      const { ep } = await episode({ home });

      const out = await generator.resumeEpisodeSetup(models, ep);

      const unplaced = (await planRows(ep)).filter((b) => b.scene_set_id === null).map((b) => b.beat_number);
      expect(unplaced).toEqual(beatsOfRole('event'));
      expect(out.setup_status.steps.locations.status).toBe('failed');
      for (const n of beatsOfRole('event')) expect(out.setup_status.steps.locations.reason).toMatch(new RegExp(`\\b${n}\\b`));
    });

    test('beat 8 is unplaced only when BOTH closet and home are unavailable', async () => {
      // With home but no closet, beat 8 falls back to home and is placed.
      const home = await set('c8 home', 'HOME_BASE');
      const venue = await set('c8 venue');
      const { ep: withHome } = await episode({ home, event: venue });
      await generator.resumeEpisodeSetup(models, withHome);
      const eight = (await planRows(withHome)).find((b) => b.beat_number === 8);
      expect(eight.scene_set_id).toBe(home);

      // With neither, it is unplaced and reported.
      const { ep: neither } = await episode({ event: venue });
      const out = await generator.resumeEpisodeSetup(models, neither);
      expect((await planRows(neither)).find((b) => b.beat_number === 8).scene_set_id).toBeNull();
      expect(out.setup_status.steps.locations.reason).toMatch(/\b8\b/);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 2. THE RECHECK HAPPENS ON EVERY RESUME
  // ══════════════════════════════════════════════════════════════════════
  describe('a step that was complete, or was never recorded', () => {
    test('a location removed after a complete setup turns the step incomplete again', async () => {
      const home = await set('rm home', 'HOME_BASE');
      const venue = await set('rm venue');
      const { ep } = await episode({ home, event: venue });
      const first = await generator.resumeEpisodeSetup(models, ep);
      expect(first.setup_status.steps.locations.status).toBe('complete');
      expect((await planRows(ep)).every((b) => b.scene_set_id)).toBe(true);

      // The home set is removed. listLocations drops it, so its beats now
      // name a set the episode no longer has as a location.
      await run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :home', { home });

      const again = await generator.resumeEpisodeSetup(models, ep);

      expect(again.setup_status.steps.locations.status).toBe('failed');
      expect(again.setup_status.steps.locations.code).toBe('LOCATIONS_INCOMPLETE');
      expect(again.setup_status.complete).toBe(false);
      // And no beat was reassigned or cleared by the check.
      expect((await planRows(ep)).filter((b) => b.scene_set_id === home).length).toBeGreaterThan(0);
    });

    test('an episode with no recorded locations step is still checked', async () => {
      const venue = await set('nr venue');
      const { ep } = await episode({ event: venue });
      // Genuinely no recorded step at all.
      expect(await statusOf(ep)).toBeNull();

      const out = await generator.resumeEpisodeSetup(models, ep);

      // The fallback wants home, which is absent, so it is reported — and the
      // unplaced beats are named too.
      expect(out.setup_status.steps.locations.status).toBe('failed');
      expect(out.setup_status.steps.locations.reason).toMatch(/Missing: Home\./);
      expect(out.setup_status.steps.locations.reason).toMatch(/have no scene set/);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 3. THE MANUAL RECOVERY SEQUENCE
  // ══════════════════════════════════════════════════════════════════════
  describe('the recovery workflow', () => {
    test('adding the location alone does NOT mark the episode recovered; placing the beats does', async () => {
      const venue = await set('w venue');
      const { ep } = await episode({ event: venue });
      await generator.resumeEpisodeSetup(models, ep);
      const unplaced = (await planRows(ep)).filter((b) => b.scene_set_id === null).map((b) => b.beat_number);
      expect(unplaced.length).toBeGreaterThan(0);

      // 1. Add the missing location.
      const home = await set('w home', 'HOME_BASE');
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :home, :ep, 'home', NULL, 2, NOW(), NOW())`, { home, ep });

      // 3'. Resume with the location added but the beats still unplaced: the
      // step must STILL be incomplete. This is the false-recovery guard.
      const halfway = await generator.resumeEpisodeSetup(models, ep);
      expect(halfway.setup_status.steps.locations.status).toBe('failed');
      expect(halfway.setup_status.steps.locations.reason).toMatch(/have no scene set/);
      expect(halfway.setup_status.complete).toBe(false);
      expect((await planRows(ep)).filter((b) => b.scene_set_id === null).map((b) => b.beat_number)).toEqual(unplaced);

      // 2. Place each unplaced beat through the existing Beat Plan editor.
      for (const n of unplaced) {
        const res = await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/${n}`)).send({ scene_set_id: home });
        expect(res.status).toBe(200);
      }

      // 3. Resume again. 4. Now, and only now, the step is complete.
      const done = await generator.resumeEpisodeSetup(models, ep);
      expect(done.setup_status.steps.locations.status).toBe('complete');
      expect((await planRows(ep)).every((b) => b.scene_set_id)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. THE OPERATOR'S OWN CHOICES ARE REPORTED, NEVER TOUCHED
  // ══════════════════════════════════════════════════════════════════════
  describe('a locked or user-chosen beat', () => {
    test.each([
      ['locked', { locked: true, chosen_by_user: false }],
      ['chosen by the user', { locked: false, chosen_by_user: true }],
    ])('%s with no set is reported and left exactly as it is', async (_label, flags) => {
      const venue = await set('lk venue');
      const home = await set('lk home', 'HOME_BASE');
      const { ep } = await episode({ home, event: venue });
      await generator.resumeEpisodeSetup(models, ep);
      // Clear beat 2's set and mark it, as the operator's own state.
      await run(`UPDATE scene_plans SET scene_set_id = NULL, locked = :locked, chosen_by_user = :chosen
                  WHERE episode_id = :ep AND beat_number = 2`, { ep, locked: flags.locked, chosen: flags.chosen_by_user });
      const before = await planRows(ep);

      const out = await generator.resumeEpisodeSetup(models, ep);

      expect(out.setup_status.steps.locations.status).toBe('failed');
      expect(out.setup_status.steps.locations.reason).toMatch(/\b2\b/);
      // Reported, and not repaired: the row is byte-identical.
      expect(await planRows(ep)).toEqual(before);
    });

    test('a partly placed episode names only the beats that are unplaced', async () => {
      const venue = await set('pp venue');
      const home = await set('pp home', 'HOME_BASE');
      const { ep } = await episode({ home, event: venue });
      await generator.resumeEpisodeSetup(models, ep);
      await run('UPDATE scene_plans SET scene_set_id = NULL WHERE episode_id = :ep AND beat_number IN (3, 5)', { ep });

      const out = await generator.resumeEpisodeSetup(models, ep);

      expect(out.setup_status.steps.locations.reason).toMatch(/2 beats have no scene set \(beats 3, 5\)/);
      expect((await planRows(ep)).filter((b) => b.scene_set_id === null).map((b) => b.beat_number)).toEqual([3, 5]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 5. A FROZEN EPISODE IS NOT TOUCHED, AND GETS NO STATUS
  // ══════════════════════════════════════════════════════════════════════
  describe('an accepted or filmed episode', () => {
    test.each([
      ['accepted', async (ep) => run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep })],
      ['filmed', async (ep) => run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                                    VALUES (gen_random_uuid(), :ep, :show, 'lala', :key, 'none', 'low', NOW(), NOW())`,
      { ep, show, key: `raw/${uuid().slice(0, 8)}.mp4` })],
    ])('%s: Resume is refused and setup_status is NOT mutated', async (_label, freeze) => {
      const venue = await set('fz venue');
      const { ep } = await episode({ event: venue });
      await generator.resumeEpisodeSetup(models, ep); // a draft resume first
      await run('UPDATE scene_plans SET scene_set_id = NULL WHERE episode_id = :ep AND beat_number = 4', { ep });
      await freeze(ep);
      const statusBefore = await statusOf(ep);
      const beatsBefore = await planRows(ep);

      const refusal = await generator.resumeEpisodeSetup(models, ep).then(() => null, (e) => e);

      expect(isFrozenEpisodeError(refusal)).toBe(true);
      expect(refusal.status).toBe(409);
      // No status write at all, and no beat touched.
      expect(await statusOf(ep)).toEqual(statusBefore);
      expect(await planRows(ep)).toEqual(beatsBefore);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 6. A SCENE SET REMOVAL RACING THE CHECK
  // ══════════════════════════════════════════════════════════════════════
  describe('[real lock] a scene set removed while the check runs', () => {
    test('the answer is one of the two truthful ones, and no beat is rewritten', async () => {
      const home = await set('rc home', 'HOME_BASE');
      const venue = await set('rc venue');
      const { ep } = await episode({ home, event: venue });
      await generator.resumeEpisodeSetup(models, ep);
      const before = await planRows(ep);

      const racer = run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :home', { home });
      const out = await generator.resumeEpisodeSetup(models, ep);
      await racer;

      // Either the check read the set as live (complete) or as gone (failed).
      expect(['complete', 'failed']).toContain(out.setup_status.steps.locations.status);
      // Either way the beats are untouched: the check only reads.
      expect(await planRows(ep)).toEqual(before);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 7. THE NEGATIVE CHECK: NULL ROWS CANNOT BE SILENTLY EXCLUDED
  // ══════════════════════════════════════════════════════════════════════
  describe('the check reads NULL rows', () => {
    test('the unit under test counts a NULL beat as unplaced, by its own contract', () => {
      // If locationsStepGaps ever filtered NULL rows out again — as it did
      // before 2026-11-26 — this fails without needing a database.
      const { locationsStepGaps, locationsGapsReason } = require('../../src/services/episodeLocationsService');
      const locations = [{ role: 'home', scene_set_id: 'set-home', name: null }];
      const gaps = locationsStepGaps({
        roles: [{ role: 'home', name: null }],
        locations,
        eventSetId: null,
        beats: [
          { beat_number: 1, scene_set_id: 'set-home', locked: false, chosen_by_user: false },
          { beat_number: 2, scene_set_id: null, locked: false, chosen_by_user: false },
          { beat_number: 3, scene_set_id: null, locked: true, chosen_by_user: false },
        ],
      });
      expect(gaps.unplacedBeats).toEqual([2, 3]);
      expect(gaps.missing).toEqual([]);
      // staleBeats keeps its own meaning and is unaffected by the NULL rows.
      expect(gaps.staleBeats).toEqual([]);
      expect(locationsGapsReason(gaps)).toMatch(/2 beats have no scene set \(beats 2, 3\)/);
    });
  });
});
