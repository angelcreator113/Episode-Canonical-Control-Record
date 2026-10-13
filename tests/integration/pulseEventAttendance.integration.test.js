/**
 * One attendance rule across The Pulse (Task #3082; Evoni, 2026-10-13): an
 * event's attendees are its host, by default, and the Event Package's
 * Guests. The older guest_list column does not count. Knowledge (who was
 * there), event posting (who attended) and who has met Lala agree, and
 * knowledge finds an event linked to its episode by a brief.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const knowledge = require('../../src/services/pulseKnowledge');
const posting = require('../../src/services/pulseEventPosting');
const reveals = require('../../src/services/pulseReveals');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse event attendance (Task #3082)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep2: uuid(), ep3: uuid(), ev: uuid(), briefEv: uuid() };
  const p = {};
  const c = {};
  const was = process.env.PULSE_ENGINE_ENABLED;

  beforeAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Attend ${tag}`, slug: `attend-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW()), (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Attend', :show, NOW(), NOW())`, ids);
    for (const key of ['host', 'guest', 'listed', 'briefguest']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
    }
    // The host and the legacy-listed profile are Alive characters with approved voices.
    for (const key of ['host', 'listed']) {
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { temperament: 'regular' }, examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    }
    // The gala: made into Ep 2, hosted by `host`, Guests [guest]; `listed` only in the old guest_list.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, cost_coins, prestige, canon_consequences, guest_list, created_at, updated_at)
               VALUES (:ev, :show, :name, 'used', :ep2, :host, 0, 5, CAST(:cc AS jsonb), CAST(:gl AS jsonb), NOW(), NOW())`,
    { ...ids, host: p.host, name: `Gala ${tag}`, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.guest }] } }), gl: JSON.stringify([{ profile_id: p.listed }]) });
    // The brunch: linked to Ep 3 only by its brief.
    await run(`INSERT INTO world_events (id, show_id, name, status, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:briefEv, :show, :name, 'draft', 0, 3, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, name: `Brunch ${tag}`, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.briefguest }] } }) });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:id, :ep3, :show, :briefEv, 'draft', NOW(), NOW())`,
      { ...ids, id: uuid() });
  });

  afterAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = was;
    await run('DELETE FROM episode_briefs WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('knowledge: the host and the Guests were there; the old guest_list was not; a brief-linked event counts', async () => {
    const during2 = 25;
    const at = async (key, order) => knowledge.knowsAt(models, ids.show, p[key], order, { lalaProfileId: null });
    expect((await at('host', during2)).get(ids.ev)).toBe('there');
    expect((await at('guest', during2)).get(ids.ev)).toBe('there');
    expect((await at('listed', during2)).has(ids.ev)).toBe(false);
    expect((await at('briefguest', 35)).get(ids.briefEv)).toBe('there');
    expect((await at('briefguest', 25)).has(ids.briefEv)).toBe(false);
  });

  test('event posting: the host attended (so posts); the legacy-listed character did not', async () => {
    const plan = await posting.whoPosts(models, { showId: ids.show, episodeId: ids.ep2 });
    expect(plan.posters.map((x) => x.characterId)).toEqual([c.host]);
    expect(plan.posters[0]).toMatchObject({ attended: true });
    expect(plan.pool.find((x) => x.characterId === c.listed)).toMatchObject({ attended: false });
  });

  test('who has met Lala: the host and Guests from the episode; never from the old guest_list', async () => {
    const met = await reveals.metLala(models, ids.show);
    expect(met.get(p.host)).toMatchObject({ episode_id: ids.ep2, from: 'guest' });
    expect(met.get(p.guest)).toMatchObject({ episode_id: ids.ep2, from: 'guest' });
    expect(met.get(p.briefguest)).toMatchObject({ episode_id: ids.ep3, from: 'guest' });
    expect(met.has(p.listed)).toBe(false);
  });
});
