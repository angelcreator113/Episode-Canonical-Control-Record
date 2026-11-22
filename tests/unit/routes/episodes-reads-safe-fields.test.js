/**
 * GET /api/v1/episodes and /:id send a reader who is not an admin the named
 * safe fields only (Evoni, 2026-11-22: "Non-admin accounts must not receive
 * internal script text at any status."). Both still need a sign-in and
 * nothing more: an ADMIN is answered as before, with the script and its
 * revision; anyone else gets no script, no locked beats, no revision, no
 * internal synopsis, no evaluation and no money columns, and three facts
 * about the script in their place (services/episodeReadFields).
 *
 * The real router, auth middleware and controller; the models are
 * stand-ins, so no database is read. Their rows carry every private column,
 * and columns no model names, to show that a column is not sent because it
 * is there.
 */
const EP = '11111111-1111-4111-8111-111111111111';
const EP_DELETED = '22222222-2222-4222-8222-222222222222';
const EP_MISSING = '33333333-3333-4333-8333-333333333333';

jest.mock('../../../src/models', () => {
  const Episode = { findAndCountAll: jest.fn(), findByPk: jest.fn(), unscoped: jest.fn() };
  Episode.unscoped.mockImplementation(() => Episode);
  const Show = {};
  // The controllers the router requires destructure `models` at load.
  return { models: { Episode, Show }, Episode, Show };
});

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const { Episode } = require('../../../src/models');
const { EPISODE_SAFE_FIELDS, EPISODE_READER_QUERY_FIELDS } = require('../../../src/services/episodeReadFields');

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', require('../../../src/routes/episodes'));

const token = (groups) => TokenService.generateTokenPair({
  id: `episodes-${groups.join('-') || 'none'}`, email: 'episodes@test.dev', name: 'episodes', groups, role: groups[0],
}).accessToken;
const get = (path, auth) => {
  const r = request(app).get(`/api/v1/episodes${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: The unpublished line.\nMe: And another.';
const PRIVATE = {
  description: 'INTERNAL SYNOPSIS: she loses the deal in beat 12.',
  script_content: SCRIPT, script_locked_beats: [1, 2, 5],
  evaluation_json: { tier_final: 'gold-tier-result' }, evaluation_status: 'accepted', formula_version: 'v3',
  money_plan: { lines: [{ label: 'venue', amount: 4321 }] }, total_income: '9876.00', total_expenses: '1234.00', financial_score: 7,
  setup_status: { steps: ['setup-step-record'] }, distribution_metadata: { youtube: { title: 'distribution copy' } },
  browse_pool_json: { pool: ['browse-pool-entry'] }, current_ai_edit_plan_id: 'plan-1', teaser_drafted: 'the saved teaser draft',
  title_approved_at: '2026-11-02T00:00:00.000Z', title_approved_value: 'approved-title-value', title_card_asset_id: 'card-asset',
  title_card_title: 'card-title', title_overlay_asset_id: 'overlay-asset', title_overlay_title: 'overlay-title', title_overlay_style: { variant: 'overlay-variant' },
  // Columns no model names, as a table may gain one later.
  internal_notes: 'PRODUCTION NOTE: not for anyone', secret_token: 'abc-secret',
};
const SAFE = {
  id: EP, episode_number: 3, season_number: 2, title: 'The Gala', air_date: '2026-12-01T00:00:00.000Z', status: 'draft',
  categories: ['grwm'], show_id: 'show-1', thumbnail_url: 'https://cdn.example/t.jpg', platform: 'youtube', width: 1920, height: 1080,
  aspect_ratio: '16:9', teaser: 'She has one night to get it right.',
  season_context: { label: 'S2 · E3', season_number: 2, slot_number: 3, story_purpose: 'season planning purpose', desired_pressure: 'season planning pressure' },
  created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-02T00:00:00.000Z',
};
const SHOW = { id: 'show-1', name: 'Styling Adventures', icon: '✦', color: '#B8962E' };
const ROW = { ...SAFE, ...PRIVATE, deleted_at: null, show: { ...SHOW, owner_notes: 'show owner note' } };
const PRIVATE_WORDS = [
  'unpublished line', 'INTERNAL SYNOPSIS', 'gold-tier-result', '4321', '9876.00', '1234.00', 'setup-step-record', 'distribution copy',
  'browse-pool-entry', 'the saved teaser draft', 'approved-title-value', 'card-title', 'overlay-variant', 'PRODUCTION NOTE', 'abc-secret',
  'season planning', 'show owner note',
];
const NOT_ADMIN = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []];
const FACTS = { has_script: true, script_approved_beat_count: 3, script_line_count: 3 };
const SAFE_KEYS = [...EPISODE_SAFE_FIELDS, 'show', 'has_script', 'script_approved_beat_count', 'script_line_count'].sort();

/** What the stand-in list answers: the row's values for the attributes asked for, as the database would. */
const selected = (row, attributes) => Object.fromEntries(Object.entries(row).filter(([k]) => k === 'show' || !attributes || attributes.includes(k)));

beforeEach(() => {
  jest.clearAllMocks();
  Episode.unscoped.mockImplementation(() => Episode);
  Episode.findAndCountAll.mockImplementation(async ({ attributes, include }) => {
    const row = selected(ROW, attributes);
    if (!include) delete row.show;
    return { count: 1, rows: [row] };
  });
  Episode.findByPk.mockImplementation(async (id) => {
    if (id === EP) return { ...ROW };
    if (id === EP_DELETED) return { ...ROW, id: EP_DELETED, deleted_at: '2026-11-10T09:00:00.000Z' };
    return null;
  });
});
const reads = () => Episode.findAndCountAll.mock.calls.length + Episode.findByPk.mock.calls.length;

describe('both reads still need a sign-in, and only a sign-in', () => {
  test.each(['/', `/${EP}`])('signed out: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, null);
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
    expect(reads()).toBe(0);
  });

  test.each(['/', `/${EP}`])('a token that is not one: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, 'not-a-token');
    expect(res.status).toBe(401);
    expect(reads()).toBe(0);
  });

  test.each(['/', `/${EP}`])('signed in, admin or not: GET %s is a 200 (no group is required)', async (path) => {
    for (const groups of [...NOT_ADMIN, ['ADMIN']]) expect((await get(path, token(groups))).status).toBe(200);
  });
});

describe('GET /api/v1/episodes: the list', () => {
  test.each(NOT_ADMIN.map((g) => [g.join('+') || 'no group', g]))('not an admin (%s): the safe fields and the script facts, and nothing private', async (_label, groups) => {
    const res = await get('/', token(groups));
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
    expect(res.body.data).toHaveLength(1);
    const row = res.body.data[0];
    expect(Object.keys(row).sort()).toEqual(SAFE_KEYS);
    for (const name of Object.keys(PRIVATE)) expect(row).not.toHaveProperty(name);
    expect(row).toMatchObject({ id: EP, title: 'The Gala', status: 'draft', teaser: SAFE.teaser, ...FACTS });
    expect(row.show).toEqual(SHOW);
    expect(row.season_context).toEqual({ label: 'S2 · E3', season_number: 2, slot_number: 3 });
    for (const words of PRIVATE_WORDS) expect(JSON.stringify(res.body)).not.toContain(words);
  });

  test('not an admin: the query names the safe fields and the two script sources, not the evaluation or the synopsis', async () => {
    await get('/', token(['EDITOR']));
    const { attributes, where } = Episode.findAndCountAll.mock.calls[0][0];
    expect(attributes).toEqual([...EPISODE_READER_QUERY_FIELDS]);
    for (const name of ['description', 'evaluation_json', 'evaluation_status', 'money_plan', 'total_income']) expect(attributes).not.toContain(name);
    expect(where).toEqual({ deleted_at: null });
  });

  test('an ADMIN: the rows as the list always sent them, script and synopsis included', async () => {
    const res = await get('/', token(['ADMIN']));
    expect(res.status).toBe(200);
    const { attributes } = Episode.findAndCountAll.mock.calls[0][0];
    expect(attributes).toEqual([
      'id', 'episode_number', 'season_number', 'title', 'description', 'air_date', 'status', 'categories', 'show_id',
      'evaluation_json', 'evaluation_status', 'script_content', 'script_locked_beats', 'thumbnail_url', 'season_context',
      'created_at', 'updated_at',
    ]);
    const row = res.body.data[0];
    expect(row).toEqual(JSON.parse(JSON.stringify(selected(ROW, attributes))));
    expect(row.script_content).toBe(SCRIPT);
    expect(row.script_locked_beats).toEqual([1, 2, 5]);
    expect(row.description).toBe(PRIVATE.description);
    expect(row.season_context).toEqual(SAFE.season_context);
    // As before: no facts are added to an admin's row.
    for (const name of Object.keys(FACTS)) expect(row).not.toHaveProperty(name);
  });

  test('the retry without the show (the include failed): the same rule for each reader', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failOnce = () => Episode.findAndCountAll.mockImplementationOnce(async () => { throw new Error('show include failed'); });

    failOnce();
    const plain = await get('/', token(['USER', 'EDITOR']));
    expect(plain.status).toBe(200);
    expect(Episode.findAndCountAll).toHaveBeenCalledTimes(2);
    expect(Episode.findAndCountAll.mock.calls[1][0].attributes).toEqual([...EPISODE_READER_QUERY_FIELDS]);
    expect(Episode.findAndCountAll.mock.calls[1][0].include).toBeUndefined();
    expect(Object.keys(plain.body.data[0]).sort()).toEqual(SAFE_KEYS.filter((k) => k !== 'show'));
    for (const words of PRIVATE_WORDS) expect(JSON.stringify(plain.body)).not.toContain(words);
    expect(plain.body.data[0]).toMatchObject(FACTS);

    Episode.findAndCountAll.mockClear();
    failOnce();
    const admin = await get('/', token(['ADMIN']));
    expect(admin.status).toBe(200);
    expect(Episode.findAndCountAll.mock.calls[1][0].attributes).toContain('script_content');
    expect(admin.body.data[0].script_content).toBe(SCRIPT);
    warn.mockRestore();
  });

  test('an episode with no script says so, for a non-admin', async () => {
    Episode.findAndCountAll.mockResolvedValue({ count: 1, rows: [{ ...SAFE, script_content: null, script_locked_beats: null }] });
    const res = await get('/', token(['VIEWER']));
    expect(res.body.data[0]).toMatchObject({ has_script: false, script_approved_beat_count: 0, script_line_count: 0 });
  });
});

describe('GET /api/v1/episodes/:id: one episode', () => {
  test.each(NOT_ADMIN.map((g) => [g.join('+') || 'no group', g]))('not an admin (%s): the safe fields and the script facts; no script, no revision', async (_label, groups) => {
    const res = await get(`/${EP}`, token(groups));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['data']);
    expect(res.body).not.toHaveProperty('script_revision');
    expect(Object.keys(res.body.data).sort()).toEqual(SAFE_KEYS);
    for (const name of [...Object.keys(PRIVATE), 'deleted_at', 'script_revision']) expect(res.body.data).not.toHaveProperty(name);
    expect(res.body.data).toMatchObject({ id: EP, title: 'The Gala', teaser: SAFE.teaser, platform: 'youtube', width: 1920, ...FACTS });
    expect(res.body.data.show).toEqual(SHOW);
    for (const words of PRIVATE_WORDS) expect(JSON.stringify(res.body)).not.toContain(words);
    // The revision is not even read for them.
    expect(Episode.unscoped).not.toHaveBeenCalled();
  });

  test('an ADMIN: the whole row and the script revision, as before', async () => {
    const res = await get(`/${EP}`, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['data', 'script_revision']);
    expect(res.body.data).toEqual(JSON.parse(JSON.stringify(ROW)));
    expect(res.body.data.script_content).toBe(SCRIPT);
    expect(res.body.data.description).toBe(PRIVATE.description);
    expect(res.body.script_revision).toMatch(/^sr1-[0-9a-f]{40}$/);
  });

  test('the admin group is matched whatever its case, as authorize() does', async () => {
    for (const groups of [['admin'], ['Viewer', 'Admin']]) {
      const res = await get(`/${EP}`, token(groups));
      expect(res.body.data.script_content).toBe(SCRIPT);
      expect(res.body.script_revision).toMatch(/^sr1-/);
    }
  });

  test('a deleted episode is not found, for an admin too, and nothing of it is sent', async () => {
    for (const groups of [...NOT_ADMIN, ['ADMIN']]) {
      const res = await get(`/${EP_DELETED}`, token(groups));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Episode not found', id: EP_DELETED });
    }
    expect(Episode.unscoped).not.toHaveBeenCalled();
  });

  test('an episode that does not exist is a 404, as before', async () => {
    for (const groups of [['USER'], ['ADMIN']]) {
      const res = await get(`/${EP_MISSING}`, token(groups));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Episode not found', id: EP_MISSING });
    }
  });
});
