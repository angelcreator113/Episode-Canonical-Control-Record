/**
 * Story ripples (services/storyRipples; Evoni, 2026-10-23: "relationship
 * changes reach the Pulse"): a relationship change the "What changed" Save
 * wrote becomes Pulse suggestions waiting in Review, never posted.
 * - a secret romance (hidden on the Pulse): only those who plausibly know
 *   are offered, only hints and rumours are kept, and a reveal is dropped;
 * - a public one: gossip accounts too, Lala's own soft launch, a friend's
 *   comment on it;
 * - the Save's hook never breaks the Save: a throwing service, a failing
 *   draft, and the count it returns.
 *
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });
jest.mock('../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1', email: 'evoni@ripples.dev' }; next(); } }));
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const models = require('../../src/models');
const ripples = require('../../src/services/storyRipples');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('Story ripples: relationship changes reach the Pulse', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep: uuid(), ev: uuid(), lala: uuid(), marcus: uuid(), jade: uuid(), tea: uuid(), outsider: uuid(), rel: uuid() };
  const p = {};
  const app = express();
  app.use(express.json());
  app.use('/api/v1/book-from-show', require('../../src/routes/bookFromShowRoutes'));
  let episode;
  let people;
  const change = { a: null, b: null, type: 'love_interest', is_romantic: true, stage_before: 'strangers', stage_after: 'flirting', note: 'They flirt at the rail', quote: 'So you are the Lala everyone follows.' };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`, { show: ids.show, name: `Ripples ${tag}`, slug: `ripples-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 4, 'draft', 'MARCUS HALE: So you are the Lala everyone follows.', NOW(), NOW())`, ids);
    const profile = async (key, handle, name, archetype = null) => {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, archetype, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :name, 'lalaverse', CAST(:archetype AS enum_social_profiles_archetype), NOW(), NOW()) RETURNING id`, { handle, name, archetype });
      p[key] = row.id;
    };
    await profile('lala', `lala${tag}`, 'Lala');
    await profile('marcus', `marcus${tag}`, 'Marcus Hale');
    await profile('jade', `jade${tag}`, 'Jade');
    await profile('tea', `tea${tag}`, 'Velour Tea', 'the_watcher');
    await profile('outsider', `out${tag}`, 'Outsider');
    await profile('guest', `guest${tag}`, 'Rail Guest');
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Ripples ${tag}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, feed_profile_id, created_at, updated_at) VALUES
               (:lala, :reg, 'lala', 'Lala', 'Lala', 'protagonist', 'accepted', :pl, NOW(), NOW()),
               (:marcus, :reg, :k1, 'Marcus Hale', 'Marcus Hale', 'support', 'accepted', :pm, NOW(), NOW()),
               (:jade, :reg, :k2, 'Jade', 'Jade', 'support', 'accepted', :pj, NOW(), NOW()),
               (:tea, :reg, :k3, 'Velour Tea', 'Velour Tea', 'support', 'accepted', :pt, NOW(), NOW()),
               (:outsider, :reg, :k4, 'Outsider', 'Outsider', 'support', 'accepted', :po, NOW(), NOW())`,
    { ...ids, pl: p.lala, pm: p.marcus, pj: p.jade, pt: p.tea, po: p.outsider, k1: `rip-${tag}-1`, k2: `rip-${tag}-2`, k3: `rip-${tag}-3`, k4: `rip-${tag}-4` });
    // The gala: Marcus and a guest were there (Lala is at every event).
    const automation = { guest_profiles: [{ profile_id: p.marcus }, { profile_id: p.guest }] };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, :name, 'gala', 7, 'used', :ep, CAST(:cc AS jsonb), NOW(), NOW())`, { ...ids, name: `Gala ${tag}`, cc: JSON.stringify({ automation }) });
    // Jade is Lala's bestie: close, so she is told. The romance is hidden on the Pulse.
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, direction, public_visibility, created_at, updated_at) VALUES
               (:pl, :pj, 'bestie', 'mutual', 'public', NOW(), NOW()),
               (:pl, :pm, 'couple', 'mutual', 'hidden', NOW(), NOW())`, { pl: p.lala, pj: p.jade, pm: p.marcus });
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, connection_mode, lala_connection, status, is_romantic, confirmed, created_at, updated_at)
               VALUES (:rel, :lala, :marcus, 'love_interest', 'IRL', 'knows_lala', 'Active', true, true, NOW(), NOW())`, ids);
    episode = { id: ids.ep, show_id: ids.show, episode_number: 4, title: 'The Gala' };
    people = new Map([
      [ids.lala, { id: ids.lala, name: 'Lala', profile_id: p.lala, linked: true, is_lala: true }],
      [ids.marcus, { id: ids.marcus, name: 'Marcus Hale', profile_id: p.marcus, linked: true }],
    ]);
    change.a = ids.lala;
    change.b = ids.marcus;
    change.relationship_id = ids.rel;
  });

  afterAll(async () => {
    const all = Object.values(p);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM episode_story_records WHERE episode_id = :ep', ids);
    await run('DELETE FROM relationship_events WHERE relationship_id IN (SELECT id FROM character_relationships WHERE character_id_a = :lala OR character_id_b = :lala)', ids);
    await run('DELETE FROM character_relationships WHERE character_id_a = :lala OR character_id_b = :lala', ids);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:all) OR target_profile_id IN (:all)', { all });
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:all)', { all });
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  beforeEach(async () => {
    mockCreate.mockReset();
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
  });
  afterEach(() => jest.restoreAllMocks());

  it('plans up to three suggestions, romance first, nothing for a change that is not news', () => {
    expect(ripples.planCount([change])).toBe(3);
    expect(ripples.planCount([{ ...change, is_romantic: false, stage_after: 'exes', stage_before: 'friends' }])).toBe(2);
    expect(ripples.planCount([{ is_romantic: false, stage_before: 'acquaintances', stage_after: 'friends' }])).toBe(1);
    expect(ripples.planCount([{ is_romantic: false, stage_before: 'friends', stage_after: 'friends' }, { is_romantic: false, stage_after: 'acquaintances' }])).toBe(0);
    expect(ripples.planCount([{ is_romantic: false, stage_before: 'acquaintances', stage_after: 'friends' }, change])).toBe(3);
    expect(ripples.planned([{ is_romantic: false, stage_before: 'acquaintances', stage_after: 'friends' }, change]).map((c) => c.ripple)).toEqual(['romance']);
    expect(ripples.lineOf(change, 'Lala', 'Marcus Hale')).toBe('Lala and Marcus Hale, now flirting');
    expect(ripples.planCount(null)).toBe(0);
  });

  it('a secret romance: only those who know are offered, only hints and rumours are kept, a reveal is dropped', async () => {
    // Pool: [1] Lala, [2] Marcus (inside), [3] the rail guest (there), [4] Jade (close to Lala).
    mockCreate.mockResolvedValueOnce(say({ items: [
      { n: 1, change: 1, kind: 'post', poster: 3, mode: 'rumour', text: 'who was Lala laughing with at the rail all night?? 👀' },
      { n: 2, change: 1, kind: 'post', poster: 4, mode: 'announcement', text: 'my bestie is taken!!' },
      { n: 3, change: 1, kind: 'post', poster: 3, mode: 'rumour', text: 'Lala and Marcus Hale at the rail. Called it.' },
      { n: 4, change: 1, kind: 'post', poster: 2, mode: 'hint', text: 'Lala made the night.' },
      { n: 5, change: 1, kind: 'comment', on: 1, poster: 4, mode: 'hint', text: 'you did NOT see anything 🤐' },
    ] }));
    const out = await ripples.propose(models, { episode, changes: [change], people });

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
    expect(prompt).toContain('### Change 1: Lala and Marcus Hale, now flirting');
    expect(prompt).toContain('SECRET: only these people plausibly know');
    expect(prompt).toContain('Allowed kinds of post: rumour, hint, soft_launch.');
    expect(prompt).toContain(`[3] Rail Guest (@guest${tag}), there`);
    expect(prompt).toContain(`[4] Jade (@jade${tag}), close to Lala`);
    // Nobody who could not know: not the gossip account, not the outsider.
    expect(prompt).not.toContain(`@tea${tag}`);
    expect(prompt).not.toContain(`@out${tag}`);

    expect(out.posts.map((x) => x.content_text)).toEqual(['who was Lala laughing with at the rail all night?? 👀']);
    expect(out.comments.map((x) => x.text)).toEqual(['you did NOT see anything 🤐']);
    expect(out.dropped.map((d) => [d.n, d.reason])).toEqual([[2, 'mode_not_allowed'], [3, 'reveal'], [4, 'reveal']]);
    const [[post]] = await run('SELECT status, episode_id, story_order, social_profile_id, gate_json FROM feed_posts WHERE show_id = :show', ids);
    expect(post).toMatchObject({ status: 'draft', episode_id: ids.ep, story_order: 47, social_profile_id: p.guest });
    expect(post.gate_json.review).toContain('story_change');
    expect(post.gate_json.story).toEqual({
      source: 'story', relationship_id: ids.rel, relationship_event_id: null, episode_id: ids.ep, episode_number: 4,
      line: 'Lala and Marcus Hale, now flirting', secrecy: 'secret', mode: 'rumour',
    });
    const [[comment]] = await run('SELECT status, social_profile_id, voice_note FROM feed_comments WHERE show_id = :show', ids);
    expect(comment).toEqual({ status: 'draft', social_profile_id: p.jade, voice_note: 'From Episode 4: Lala and Marcus Hale, now flirting' });
    // One manual Pulse request for the whole Save.
    const [[{ n }]] = await run(`SELECT COUNT(*)::int AS n FROM pulse_requests WHERE show_id = :show AND lane = 'manual' AND kind = 'story'`, ids);
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it('a public romance: gossip accounts too, Lala may soft-launch it, a friend comments; all wait in Review', async () => {
    await run(`UPDATE social_profile_relationships SET public_visibility = 'public' WHERE source_profile_id = :pl AND target_profile_id = :pm`, { pl: p.lala, pm: p.marcus });
    // Pool: [1] Lala, [2] Marcus, [3] guest, [4] Jade, [5] Velour Tea (gossip).
    mockCreate.mockResolvedValueOnce(say({ items: [
      { n: 1, change: 1, kind: 'post', poster: 5, mode: 'rumour', text: 'Lala and Marcus Hale, cosy at the rail. You heard it here.' },
      { n: 2, change: 1, kind: 'post', poster: 1, mode: 'soft_launch', text: 'two glasses, one view 🥂' },
      { n: 3, change: 1, kind: 'comment', on: 2, poster: 4, mode: 'reaction', text: 'who was that at the rail??' },
      { n: 4, change: 1, kind: 'comment', on: 2, poster: 1, mode: 'reaction', text: 'over the share' },
    ] }));
    const out = await ripples.propose(models, { episode, changes: [change], people });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('PUBLIC: people can know.');
    expect(prompt).toContain(`[5] Velour Tea (@tea${tag}), gossip`);
    expect(out.posts.map((x) => x.content_text)).toEqual(['Lala and Marcus Hale, cosy at the rail. You heard it here.', 'two glasses, one view 🥂']);
    expect(out.comments.map((x) => x.text)).toEqual(['who was that at the rail??']);
    expect(out.dropped.map((d) => d.reason)).toEqual(['over_share']);
    const [rows] = await run(`SELECT social_profile_id, status, gate_json FROM feed_posts WHERE show_id = :show ORDER BY created_at`, ids);
    expect(rows.every((r) => r.status === 'draft' && r.gate_json.story.secrecy === 'public')).toBe(true);
    const lalas = rows.find((r) => r.social_profile_id === p.lala);
    expect(lalas.gate_json.review).toEqual(expect.arrayContaining(['story_change', 'lala']));
    await run(`UPDATE social_profile_relationships SET public_visibility = 'hidden' WHERE source_profile_id = :pl AND target_profile_id = :pm`, { pl: p.lala, pm: p.marcus });
  });

  it('reads who knows and where everyone stands when the relationship records them (guarded: the columns may not exist)', async () => {
    // Added here only when that branch's migration has not run; then dropped again.
    const [had] = await run(`SELECT column_name FROM information_schema.columns WHERE table_name = 'character_relationships' AND column_name = 'public_state'`);
    if (!had.length) {
      await run(`ALTER TABLE character_relationships ADD COLUMN known_by JSONB NOT NULL DEFAULT '[]'::jsonb,
                 ADD COLUMN public_state VARCHAR(20) NOT NULL DEFAULT 'known'`);
    }
    try {
      await run(`UPDATE character_relationships SET public_state = 'rumoured', known_by = CAST(:kb AS jsonb) WHERE id = :rel`,
        { rel: ids.rel, kb: JSON.stringify([{ registry_character_id: ids.outsider, how: 'saw them leave' }]) });
      await run(`UPDATE social_profile_relationships SET public_visibility = 'public' WHERE source_profile_id = :pl AND target_profile_id = :pm`, { pl: p.lala, pm: p.marcus });
      const a = people.get(ids.lala);
      const b = people.get(ids.marcus);
      const secrecy = await ripples.secrecyOf(models, change, { a, b });
      expect(secrecy.level).toBe('rumoured');
      expect([...secrecy.knownProfiles]).toEqual([p.outsider]);
      mockCreate.mockResolvedValueOnce(say({ items: [] }));
      await ripples.propose(models, { episode, changes: [change], people });
      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('RUMOURED: people have heard talk');
      expect(prompt).toContain(`Outsider (@out${tag}), told`);
      expect(prompt).not.toContain(`@tea${tag}`);
    } finally {
      await run(`UPDATE social_profile_relationships SET public_visibility = 'hidden' WHERE source_profile_id = :pl AND target_profile_id = :pm`, { pl: p.lala, pm: p.marcus });
      if (!had.length) await run('ALTER TABLE character_relationships DROP COLUMN known_by, DROP COLUMN public_state');
      else await run(`UPDATE character_relationships SET public_state = 'known', known_by = '[]'::jsonb WHERE id = :rel`, ids);
    }
  });

  describe('the Save hook', () => {
    const base = `/api/v1/book-from-show/episodes/${ids.ep}/record`;
    const record = async () => {
      await run('DELETE FROM episode_story_records WHERE episode_id = :ep', ids);
      await run('DELETE FROM relationship_events WHERE relationship_id = :rel', ids);
      await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, relationships, applied)
                 VALUES (:ep, :show, 'draft', 'Lala meets Marcus at the rail.', CAST(:rels AS jsonb), '{}'::jsonb)`,
      { ...ids, rels: JSON.stringify([{ key: `k-${tag}-rel`, a: ids.lala, b: ids.marcus, type: 'love_interest', is_romantic: true, stage_before: 'strangers', stage_after: 'flirting', tension_before: null, tension_after: null, evidence_beat: 11, note: 'They flirt', quote: '', keep: true }]) });
    };

    it('says how many suggestions are coming and drafts them after the Save', async () => {
      await record();
      const propose = jest.spyOn(ripples, 'propose').mockResolvedValue({ posts: [], comments: [], dropped: [] });
      const res = await request(app).post(`${base}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.record.status).toBe('approved');
      expect(res.body.result.pulse_suggestions).toBe(3);
      await new Promise((r) => setImmediate(r));
      expect(propose).toHaveBeenCalledTimes(1);
      const [, args] = propose.mock.calls[0];
      expect(args.episode.id).toBe(ids.ep);
      expect(args.changes).toEqual([expect.objectContaining({ a: ids.lala, b: ids.marcus, stage_after: 'flirting', relationship_id: ids.rel, event_id: expect.any(String) })]);
    });

    it('a failing draft is logged and the Save stands', async () => {
      await record();
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(ripples, 'propose').mockRejectedValue(new Error('the AI is down'));
      const res = await request(app).post(`${base}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.result.pulse_suggestions).toBe(3);
      await new Promise((r) => setImmediate(r));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('[storyRipples]'), 'the AI is down');
    });

    it('a service that throws is logged and the Save stands, with no suggestions', async () => {
      await record();
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(ripples, 'proposeLater').mockImplementation(() => { throw new Error('broken'); });
      const res = await request(app).post(`${base}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.record.status).toBe('approved');
      expect(res.body.result.pulse_suggestions).toBe(0);
      expect(res.body.result.written.map((w) => w.kind)).toEqual(['relationship']);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Pulse suggestions not started'), 'broken');
    });
  });
});
