/**
 * Line identity storage against Postgres (architecture A1b): migration
 * 20261026190000 is applied (CI runs every migration first); both columns
 * are nullable JSONB with no default, so existing rows read null; a stored
 * value is kept and readable by a query that names it; and no ordinary
 * response carries it: the episode, the episode list, the update (which
 * cannot write it either), the script history and a saved version.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Morning. Coffee first.\nPrime: Good morning, everyone.';
const KEYS = { v: 1, text_hash: 'deadbeef', lines: [{ k: 'ln_marker2222', b: 1, h: '00000000' }], retired: [] };

(shouldSkip ? describe.skip : describe)('script_line_keys storage (A1b)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-a1b', email: 'test@a1b.dev', name: 'A1b', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM episode_script_versions WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seed({ keys = null } = {}) {
    const ids = { show: uuid(), ep: uuid(), version: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `A1b show ${ids.show.slice(0, 8)}`, slug: `a1b-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_line_keys, created_at, updated_at)
               VALUES (:ep, :show, 'Studio Day', 1, 'draft', :script, CAST(:keys AS jsonb), NOW(), NOW())`,
      { ...ids, script: SCRIPT, keys: keys ? JSON.stringify(keys) : null });
    await run(`INSERT INTO episode_script_versions (id, episode_id, script_content, script_locked_beats, source, script_line_keys, created_at, updated_at)
               VALUES (:version, :ep, :script, '[]'::jsonb, 'save', CAST(:keys AS jsonb), NOW(), NOW())`,
      { ...ids, script: SCRIPT, keys: keys ? JSON.stringify(keys) : null });
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const noKeys = (body) => {
    const text = JSON.stringify(body);
    expect(text).not.toContain('script_line_keys');
    expect(text).not.toContain('ln_marker2222');
  };

  it('the migration added both columns: nullable JSONB, no default', async () => {
    const cols = await q(`SELECT table_name, data_type, is_nullable, column_default FROM information_schema.columns
                           WHERE column_name = 'script_line_keys' AND table_schema = current_schema() ORDER BY table_name`);
    expect(cols).toEqual([
      { table_name: 'episode_script_versions', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
      { table_name: 'episodes', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
    ]);
  });

  it('a row written without it reads null; the script and its versions are unchanged', async () => {
    const ids = await seed();
    const [ep] = await q('SELECT script_content, script_line_keys FROM episodes WHERE id = :ep', ids);
    expect(ep).toEqual({ script_content: SCRIPT, script_line_keys: null });
    const [v] = await q('SELECT script_content, script_line_keys FROM episode_script_versions WHERE id = :version', ids);
    expect(v).toEqual({ script_content: SCRIPT, script_line_keys: null });
  });

  it('a stored value is kept, and read only by a query that names it', async () => {
    const ids = await seed({ keys: KEYS });
    const plain = await models.Episode.findByPk(ids.ep);
    expect(plain.get('script_line_keys')).toBeUndefined();
    const named = await models.Episode.findByPk(ids.ep, { attributes: ['id', 'script_line_keys'] });
    expect(asJson(named.get('script_line_keys'))).toEqual(KEYS);
    const version = await models.EpisodeScriptVersion.findByPk(ids.version, { attributes: ['id', 'script_line_keys'] });
    expect(asJson(version.get('script_line_keys'))).toEqual(KEYS);
  });

  it('no ordinary response carries it: the episode, the list, the history and a version', async () => {
    const ids = await seed({ keys: KEYS });
    const one = await auth(request(app).get(`/api/v1/episodes/${ids.ep}`));
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).toContain('Studio Day');
    noKeys(one.body);
    const list = await auth(request(app).get(`/api/v1/episodes?show_id=${ids.show}`));
    expect(list.status).toBe(200);
    noKeys(list.body);
    const history = await auth(request(app).get(`/api/v1/episodes/${ids.ep}/script-versions`));
    expect(history.status).toBe(200);
    noKeys(history.body);
    const version = await auth(request(app).get(`/api/v1/episodes/${ids.ep}/script-versions/${ids.version}`));
    expect(version.status).toBe(200);
    expect(JSON.stringify(version.body)).toContain('Coffee first');
    noKeys(version.body);
  });

  it('an update can neither write it nor return it, and leaves it as stored', async () => {
    const ids = await seed({ keys: KEYS });
    const res = await auth(request(app).put(`/api/v1/episodes/${ids.ep}`))
      .send({ title: 'Studio Day, take two', script_line_keys: { v: 1, text_hash: 'ffffffff', lines: [], retired: [] } });
    expect(res.status).toBe(200);
    noKeys(res.body);
    const [ep] = await q('SELECT title, script_content, script_line_keys FROM episodes WHERE id = :ep', ids);
    expect(ep.title).toBe('Studio Day, take two');
    expect(ep.script_content).toBe(SCRIPT);
    expect(asJson(ep.script_line_keys)).toEqual(KEYS);
  });
});
