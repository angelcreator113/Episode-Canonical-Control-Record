/**
 * A content type that changes over time (Evoni's idea 2, 2026-10-18).
 * Dana is The Entertainer; after Episode 3 she rebrands as The Educator.
 * - PUT content-type { rebrand: true, reason } records the change at the
 *   story's present moment, with its reason, on her fact history;
 * - the Pulse judges a post by the type she had at its moment: The
 *   Entertainer before the rebrand, The Educator after;
 * - a correction (rebrand false) is recorded with no moment, so it does not
 *   change what she was known for earlier.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const models = require('../../src/models');
const TokenService = require('../../src/services/tokenService');
const { contentTypeAt } = require('../../src/services/contentTypeHistory');
const { orderOf } = require('../../src/services/storyClock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('a content type that changes over time', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), ep: crypto.randomUUID() };
  let pid;
  let admin;
  const put = (body) => request(app).put(`/api/v1/cast/characters/${ids.char}/content-type`).set('Authorization', `Bearer ${admin}`).send(body);
  const changes = async () => (await run(
    "SELECT before_value, after_value, reason, story_order FROM character_fact_changes WHERE registry_character_id = :char AND fact_key = 'content_type' ORDER BY created_at", ids))[0];

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-ctype', email: 'evoni@ctype.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Ctype ${tag}`, slug: `ctype-${tag}` });
    await models.Episode.create({ id: ids.ep, show_id: ids.show, episode_number: 3, title: `Ep ${tag}`, status: 'published' });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Ctype', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, society_archetype, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'lalaverse', 'The Entertainer', NOW(), NOW()) RETURNING id`, { h: `dana${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Dana', 'support', 'accepted', :pid, NOW(), NOW())`, { ...ids, key: `dana-${tag}`, pid });
  });

  afterAll(async () => {
    await run('DELETE FROM character_fact_changes WHERE registry_character_id = :char', ids);
    await run('DELETE FROM registry_characters WHERE id = :char', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('a rebrand is placed at the present with its reason; earlier moments keep the old type', async () => {
    const res = await put({ name: 'The Educator', rebrand: true, reason: 'After the burnout post, she started teaching.' });
    expect(res.status).toBe(200);
    const present = orderOf(3, 'after_episode');
    expect(await changes()).toEqual([{ before_value: 'The Entertainer', after_value: 'The Educator', reason: 'After the burnout post, she started teaching.', story_order: present }]);
    expect(await contentTypeAt(models, { profileId: pid, storyOrder: orderOf(2, 'after_episode') })).toBe('The Entertainer');
    expect(await contentTypeAt(models, { profileId: pid, storyOrder: present })).toBe('The Educator');
    expect(await contentTypeAt(models, { profileId: pid, storyOrder: null })).toBe('The Educator');
    const mix = await require('../../src/services/pulseDrafter').posterMix(models, pid, { at: orderOf(1, 'after_episode') });
    expect(mix.type).toBe('The Entertainer');
  });

  it('the rebrand is on her history', async () => {
    const character = await models.RegistryCharacter.findByPk(ids.char);
    const history = await require('../../src/services/factHistory').factHistory(models, { character });
    expect(history.find((h) => h.fact === 'content_type')).toMatchObject({
      label: 'Known for on The Pulse', from: 'The Entertainer', to: 'The Educator', reason: 'After the burnout post, she started teaching.', story_label: expect.stringContaining('Ep 3'),
    });
  });

  it('a correction has no moment and leaves earlier moments alone', async () => {
    const res = await put({ name: 'The Commentator', rebrand: false, reason: 'Wrong pick' });
    expect(res.status).toBe(200);
    const last = (await changes()).pop();
    expect(last).toEqual({ before_value: 'The Educator', after_value: 'The Commentator', reason: 'Wrong pick', story_order: null });
    expect(await contentTypeAt(models, { profileId: pid, storyOrder: orderOf(2, 'after_episode') })).toBe('The Entertainer');
  });
});
