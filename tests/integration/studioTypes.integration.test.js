/**
 * Studio types (Evoni, 2026-10-18: every creator's studio read "venue ·
 * other"; "yes start the studio types"). Two studios typed "other", each with
 * one resident: a fashion creator's still named "<name>'s Studio", and a
 * Beauty Oracle's she renamed. A third has two residents.
 * - GET /world/locations/studio-types proposes a type (and the generated
 *   name's new label) and writes nothing;
 * - POST applies only what is sent, refuses a type off the list, and swaps
 *   "signature studio" in a generated description.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const URL = '/api/v1/world/locations/studio-types';

(shouldSkip ? describe.skip : describe)('studio types', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const loc = {};
  const p = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const mine = (studios) => studios.filter((s) => Object.values(loc).includes(s.location_id));

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-studio', email: 'evoni@studio.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    for (const [key, name] of [['lux', `Lux${tag}'s Studio`], ['bea', `Bea${tag}'s Glow Room`], ['shared', `Shared${tag} Loft`]]) {
      loc[key] = (await db.WorldLocation.create({
        name, slug: `${key}-${tag}`, location_type: 'venue', venue_type: 'other', city: 'Dazzle District',
        description: `${name}'s signature studio in Dazzle District. Where they create, host, and build their brand.`,
      })).id;
    }
    for (const [h, home, niche, type] of [
      [`lux${tag}`, loc.lux, 'vintage fashion', 'The Trendsetter'],
      [`bea${tag}`, loc.bea, 'controversial opinions', 'The Beauty Oracle'],
      [`s1${tag}`, loc.shared, 'fashion', null], [`s2${tag}`, loc.shared, 'beauty', null],
    ]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, content_category, society_archetype, home_location_id, created_at, updated_at)
        VALUES (:h, 'pulse', 'x', :d, 'lalaverse', :niche, :type, :home, NOW(), NOW()) RETURNING id`,
      { h, d: h === `lux${tag}` ? `Lux${tag}` : h === `bea${tag}` ? `Bea${tag}` : h, niche, type, home });
      p.push(row.id);
    }
  });

  afterAll(async () => {
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: p });
    await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: Object.values(loc) });
    await sequelize.close();
  });

  it('proposes a type for each one-resident studio, the generated name relabelled, and writes nothing', async () => {
    const res = await auth(request(app).get(URL));
    expect(res.status).toBe(200);
    const studios = mine(res.body.studios);
    expect(studios.map((s) => s.location_id).sort()).toEqual([loc.lux, loc.bea].sort());
    expect(studios.find((s) => s.location_id === loc.lux)).toMatchObject({
      name: `Lux${tag}'s Studio`, venue_type: 'other',
      proposed: { venue_type: 'boutique', name: `Lux${tag}'s Showroom` }, why: 'their niche is vintage fashion',
    });
    expect(studios.find((s) => s.location_id === loc.bea)).toMatchObject({
      proposed: { venue_type: 'salon', name: `Bea${tag}'s Glow Room` }, why: 'they are known as The Beauty Oracle',
    });
    expect((await db.WorldLocation.findByPk(loc.lux)).venue_type).toBe('other');
  });

  it('applies only what is sent, refuses a type off the list, and relabels the description', async () => {
    const res = await auth(request(app).post(URL)).send({ items: [
      { location_id: loc.lux, venue_type: 'boutique', name: `Lux${tag}'s Showroom` },
      { location_id: loc.bea, venue_type: 'spaceship' },
    ] });
    expect(res.body).toMatchObject({ success: true, changed: 1 });
    const lux = await db.WorldLocation.findByPk(loc.lux);
    expect(lux).toMatchObject({ venue_type: 'boutique', name: `Lux${tag}'s Showroom` });
    expect(lux.description).toContain('signature showroom in Dazzle District');
    expect((await db.WorldLocation.findByPk(loc.bea)).venue_type).toBe('other');
    const after = mine((await auth(request(app).get(URL))).body.studios);
    expect(after.map((s) => s.location_id)).toEqual([loc.bea]);
  });
});
