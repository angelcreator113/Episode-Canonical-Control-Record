/**
 * The Templates page's routes (src/routes/templateStudio.js) on the migrated
 * database (Evoni, 2026-10-21: fix the Templates page; rename templates).
 * Before migration 20261021120000-create-template-studio.js no migration
 * made template_studio, so every call here was a 500.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261021120000-create-template-studio');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const base = '/api/v1/template-studio';

(shouldSkip ? describe.skip : describe)('Templates (template_studio)', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const tag = crypto.randomUUID().slice(0, 8);
  const named = (n) => `${n} ${tag}`;

  const create = async (name) => {
    const res = await auth(request(app).post(base)).send({
      name, canvas_config: { width: 1280, height: 720 },
      role_slots: [{ role: 'TEXT.TITLE', x: 10, y: 10, width: 400, height: 100 }],
    });
    expect(res.status).toBe(201);
    return res.body.data;
  };

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-templates', email: 'user@templates.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  test('the migration is guarded: running it again changes nothing', async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const cols = await rows("SELECT column_name FROM information_schema.columns WHERE table_name = 'template_studio'");
    expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['name', 'version', 'locked', 'deleted_at']));
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = 'thumbnail_compositions' AND column_name = 'template_studio_id'");
    expect(n).toBe(1);
  });

  test('list, clone, publish, lock, unlock, archive', async () => {
    const t = await create(named('Glam'));
    const list = (await auth(request(app).get(base)).query({ limit: 500 })).body.data;
    expect(list.map((x) => x.id)).toContain(t.id);
    expect((await auth(request(app).post(`${base}/${t.id}/publish`))).status).toBe(200);
    const clone = await auth(request(app).post(`${base}/${t.id}/clone`));
    expect(clone.status).toBe(201);
    expect(clone.body.data).toMatchObject({ name: t.name, version: 2, status: 'DRAFT' });
    expect((await auth(request(app).post(`${base}/${t.id}/lock`))).body.data.locked).toBe(true);
    const unlocked = await auth(request(app).post(`${base}/${t.id}/unlock`));
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data).toMatchObject({ locked: false, locked_at: null });
    expect((await auth(request(app).post(`${base}/${t.id}/archive`))).body.data.status).toBe('ARCHIVED');
  });

  test('delete keeps the row with deleted_at; it is no longer listed or found', async () => {
    const t = await create(named('Gone'));
    expect((await auth(request(app).delete(`${base}/${t.id}`))).status).toBe(200);
    const [row] = await rows('SELECT deleted_at FROM template_studio WHERE id = :id', { id: t.id });
    expect(row.deleted_at).not.toBeNull();
    const list = (await auth(request(app).get(base)).query({ limit: 500 })).body.data;
    expect(list.map((x) => x.id)).not.toContain(t.id);
    expect((await auth(request(app).get(`${base}/${t.id}`))).status).toBe(404);
    expect((await auth(request(app).delete(`${base}/${t.id}`))).status).toBe(404);
  });

  test('rename: a draft or a published template; every version follows', async () => {
    const t = await create(named('Haul'));
    await auth(request(app).post(`${base}/${t.id}/publish`));
    const v2 = (await auth(request(app).post(`${base}/${t.id}/clone`))).body.data;
    const res = await auth(request(app).patch(`${base}/${v2.id}/name`)).send({ name: `  ${named('Big Haul')}  ` });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: named('Big Haul'), versions: 2 });
    const names = await rows('SELECT name FROM template_studio WHERE id IN (:ids)', { ids: [t.id, v2.id] });
    expect(names.map((r) => r.name)).toEqual([named('Big Haul'), named('Big Haul')]);
    // The same name again is fine and changes nothing.
    expect((await auth(request(app).patch(`${base}/${t.id}/name`)).send({ name: named('Big Haul') })).status).toBe(200);
  });

  test('rename refuses: locked 403, taken 409, empty 400, unknown 404, signed out 401', async () => {
    const a = await create(named('Alpha'));
    const b = await create(named('Beta'));
    const taken = await auth(request(app).patch(`${base}/${a.id}/name`)).send({ name: b.name });
    expect(taken.status).toBe(409);
    expect(taken.body.message).toBe('That name is taken');
    await auth(request(app).delete(`${base}/${b.id}`));
    const deleted = await auth(request(app).patch(`${base}/${a.id}/name`)).send({ name: b.name });
    expect(deleted.status).toBe(409);
    expect(deleted.body.message).toBe('That name belongs to a deleted template');
    expect((await auth(request(app).patch(`${base}/${a.id}/name`)).send({ name: '   ' })).status).toBe(400);
    expect((await auth(request(app).patch(`${base}/${a.id}/name`)).send({ name: 'x'.repeat(256) })).status).toBe(400);
    await auth(request(app).post(`${base}/${a.id}/lock`));
    expect((await auth(request(app).patch(`${base}/${a.id}/name`)).send({ name: named('Gamma') })).status).toBe(403);
    expect((await auth(request(app).patch(`${base}/${crypto.randomUUID()}/name`)).send({ name: named('Delta') })).status).toBe(404);
    expect((await request(app).patch(`${base}/${a.id}/name`).send({ name: named('Eps') })).status).toBe(401);
  });

  test('on a table the old script made first, the migration keeps its rows and adds deleted_at', async () => {
    await sequelize.query('DROP TABLE template_studio CASCADE');
    await sequelize.query(`CREATE TABLE template_studio (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, description TEXT,
      version INTEGER NOT NULL DEFAULT 1, status VARCHAR(50) DEFAULT 'DRAFT', locked BOOLEAN DEFAULT false,
      canvas_config JSONB NOT NULL DEFAULT '{}'::jsonb, role_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
      safe_zones JSONB DEFAULT '{}'::jsonb, required_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
      optional_roles TEXT[] DEFAULT ARRAY[]::TEXT[], formats_supported TEXT[] DEFAULT ARRAY['YOUTUBE']::TEXT[],
      created_by UUID, published_at TIMESTAMP, locked_at TIMESTAMP, parent_template_id UUID,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(name, version))`);
    await sequelize.query(`INSERT INTO template_studio (name) VALUES ('${named('Kept')}')`);
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const kept = await rows('SELECT name, deleted_at FROM template_studio');
    expect(kept).toEqual([{ name: named('Kept'), deleted_at: null }]);
    const list = (await auth(request(app).get(base))).body.data;
    expect(list.map((x) => x.name)).toEqual([named('Kept')]);
  });
});
