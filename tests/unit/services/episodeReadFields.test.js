/**
 * What an episode read answers a reader who is not an admin (Evoni,
 * 2026-11-22): the named safe fields, its show, and three facts about the
 * script worked out from the row. An ADMIN gets the row itself.
 */
const {
  EPISODE_SAFE_FIELDS, EPISODE_SCRIPT_SOURCE_FIELDS, EPISODE_READER_QUERY_FIELDS, EPISODE_SHOW_FIELDS, EPISODE_NESTED_FIELDS,
  pick, safeSeasonContext, scriptFacts, safeEpisode, episodeForReader,
} = require('../../../src/services/episodeReadFields');
const defineEpisode = require('../../../src/models/Episode');
const { Sequelize } = require('sequelize');

const ADMIN = { id: 'a', groups: ['ADMIN'] };
const NOT_ADMIN = [
  { id: 'u', groups: ['USER'] }, { id: 'e', groups: ['EDITOR'] }, { id: 'v', groups: ['VIEWER'] },
  { id: 'ue', groups: ['USER', 'EDITOR'] }, { id: 'n', groups: [] },
  // No groups array is not an admin, whatever else the user carries.
  { id: 'c', 'cognito:groups': ['admin'] }, { id: 'r', role: 'ADMIN' }, null, undefined,
];

const SEASON = {
  season_number: 2, label: 'S2 · E3', slot_number: 3, arc_id: 'arc-1', arc_title: 'The Private Arc Title',
  arc_tagline: 'private tagline', arc_logline: 'private logline', arc_description: 'private arc description',
  phase_count: 3, phase: { number: 1, title: 'Private phase title', tagline: 'private phase tagline', emotional_arc: 'private emotional arc', episode_start: 1, episode_end: 8 },
  position_in_phase: 3, story_purpose: 'private purpose', career_focus: 'private focus', desired_pressure: 'private pressure',
  outcome_range: { low: 'private low' }, story_thread: 'private thread', story_purposes: [{ text: 'private purposes', primary: true }],
  two_part: { part: 1, of: 2, other_slot_number: 4 },
  special: { id: 'sp-1', kind: 'bonus', special_type: 'holiday', title: 'Private special title', after_slot_number: 7, label: 'Special · after E7', counts_toward_parts: true },
  snapshotted_at: '2026-11-01T00:00:00.000Z',
};
const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: The unpublished line.\nMe: And another.';
// Every column of the model, and some no model names (as a table may gain one later).
const ROW = {
  id: 'ep-1', episode_number: 3, season_number: 2, title: 'The Gala', air_date: '2026-12-01T00:00:00.000Z', status: 'draft',
  categories: ['grwm'], show_id: 'show-1', thumbnail_url: 'https://cdn.example/t.jpg', platform: 'youtube', width: 1920, height: 1080,
  aspect_ratio: '16:9', teaser: 'She has one night to get it right.', season_context: SEASON,
  created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-02T00:00:00.000Z',
  description: 'INTERNAL SYNOPSIS: she loses the deal in beat 12.', teaser_drafted: 'the saved draft', deleted_at: null,
  script_content: SCRIPT, script_locked_beats: [1, 2, 2, 5, 99, 0], script_line_keys: { v: 1 },
  money_plan: { lines: [{ amount: 500 }] }, total_income: '900.00', total_expenses: '120.00', financial_score: 7,
  setup_status: { steps: [] }, evaluation_json: { tier_final: 'gold' }, evaluation_status: 'accepted', formula_version: 'v3',
  distribution_metadata: { youtube: { title: 'x' } }, browse_pool_json: { pool: [] }, current_ai_edit_plan_id: 'plan-1',
  title_approved_at: '2026-11-02T00:00:00.000Z', title_approved_value: 'The Gala', title_card_asset_id: 'as-1', title_card_title: 'The Gala',
  title_overlay_asset_id: 'as-2', title_overlay_title: 'The Gala', title_overlay_style: { variant: 'a' },
  internal_notes: 'PRODUCTION NOTE: not for anyone', secret_token: 'abc',
  show: { id: 'show-1', name: 'Styling Adventures', icon: '✦', color: '#B8962E', owner_notes: 'private show note', budget: 10 },
};
const NEVER = [
  'description', 'script_content', 'script_locked_beats', 'script_line_keys', 'script_revision', 'money_plan', 'total_income',
  'total_expenses', 'financial_score', 'setup_status', 'evaluation_json', 'evaluation_status', 'formula_version',
  'distribution_metadata', 'browse_pool_json', 'current_ai_edit_plan_id', 'teaser_drafted', 'title_approved_at',
  'title_approved_value', 'title_card_asset_id', 'title_card_title', 'title_overlay_asset_id', 'title_overlay_title',
  'title_overlay_style', 'deleted_at', 'internal_notes', 'secret_token',
];
const FACTS = ['has_script', 'script_approved_beat_count', 'script_line_count'];

describe('the allowlists', () => {
  test('every safe field, and each script source, is a column of the Episode model', () => {
    const Episode = defineEpisode(new Sequelize('postgres://u:p@localhost:5432/x', { logging: false }));
    const columns = Object.keys(Episode.rawAttributes);
    for (const name of [...EPISODE_SAFE_FIELDS, ...EPISODE_SCRIPT_SOURCE_FIELDS, ...EPISODE_NESTED_FIELDS]) expect(columns).toContain(name);
  });

  test('no private column is among the safe fields or the nested fields', () => {
    for (const name of NEVER) {
      expect(EPISODE_SAFE_FIELDS).not.toContain(name);
      expect(EPISODE_NESTED_FIELDS).not.toContain(name);
    }
    expect([...EPISODE_SAFE_FIELDS].sort()).toEqual([
      'air_date', 'aspect_ratio', 'categories', 'created_at', 'episode_number', 'height', 'id', 'platform', 'season_context',
      'season_number', 'show_id', 'status', 'teaser', 'thumbnail_url', 'title', 'updated_at', 'width',
    ]);
    expect([...EPISODE_NESTED_FIELDS]).toEqual(['id', 'title', 'episode_number', 'season_number', 'status', 'show_id']);
    expect([...EPISODE_SHOW_FIELDS]).toEqual(['id', 'name', 'icon', 'color']);
  });

  test('the non-admin list reads the safe fields and the two script sources, and nothing else', () => {
    expect([...EPISODE_READER_QUERY_FIELDS]).toEqual([...EPISODE_SAFE_FIELDS, 'script_content', 'script_locked_beats']);
  });

  test('the lists cannot be changed', () => {
    for (const list of [EPISODE_SAFE_FIELDS, EPISODE_SCRIPT_SOURCE_FIELDS, EPISODE_READER_QUERY_FIELDS, EPISODE_SHOW_FIELDS, EPISODE_NESTED_FIELDS]) expect(Object.isFrozen(list)).toBe(true);
  });
});

describe('episodeForReader', () => {
  test('an ADMIN gets the row itself, unchanged; the group is matched whatever its case', () => {
    expect(episodeForReader(ADMIN, ROW)).toBe(ROW);
    expect(episodeForReader({ groups: ['admin'] }, ROW)).toBe(ROW);
    expect(episodeForReader({ groups: ['Viewer', 'Admin'] }, ROW)).toBe(ROW);
  });

  test.each(NOT_ADMIN.map((u) => [JSON.stringify(u), u]))('not an admin (%s): the safe fields, the show and the facts, and nothing else', (_label, user) => {
    const out = episodeForReader(user, ROW);
    expect(Object.keys(out).sort()).toEqual([...EPISODE_SAFE_FIELDS, 'show', ...FACTS].sort());
    for (const name of NEVER) expect(out).not.toHaveProperty(name);
    for (const name of EPISODE_SAFE_FIELDS.filter((n) => n !== 'season_context')) expect(out[name]).toEqual(ROW[name]);
    expect(out.show).toEqual({ id: 'show-1', name: 'Styling Adventures', icon: '✦', color: '#B8962E' });
    const sent = JSON.stringify(out);
    for (const words of ['unpublished line', 'INTERNAL SYNOPSIS', 'PRODUCTION NOTE', 'private', 'Private', 'the saved draft', 'gold', '900.00']) expect(sent).not.toContain(words);
  });

  test('the viewer teaser is sent; nothing is written where the synopsis was', () => {
    const out = episodeForReader(NOT_ADMIN[0], ROW);
    expect(out.teaser).toBe('She has one night to get it right.');
    expect(out).not.toHaveProperty('description');
    expect(episodeForReader(NOT_ADMIN[0], { ...ROW, teaser: null }).teaser).toBeNull();
    expect(episodeForReader(NOT_ADMIN[0], { ...ROW, teaser: null })).not.toHaveProperty('description');
  });

  test('a column the row does not carry is not invented (a list row has fewer)', () => {
    const out = episodeForReader(NOT_ADMIN[0], { id: 'ep-2', title: 'Short', status: 'draft', script_content: null, script_locked_beats: null });
    expect(out).toEqual({ id: 'ep-2', title: 'Short', status: 'draft', has_script: false, script_approved_beat_count: 0, script_line_count: 0 });
  });

  test('a model instance is read through get({ plain: true })', () => {
    const instance = { get: jest.fn(() => ({ ...ROW })), dataValues: ROW };
    const out = episodeForReader(NOT_ADMIN[0], instance);
    expect(instance.get).toHaveBeenCalledWith({ plain: true });
    expect(out.title).toBe('The Gala');
    expect(out).not.toHaveProperty('script_content');
    expect(out.has_script).toBe(true);
  });

  test('a real Episode instance: the same answer, and no script', () => {
    const sequelize = new Sequelize('postgres://u:p@localhost:5432/x', { logging: false });
    const Episode = defineEpisode(sequelize);
    const { show: _show, internal_notes: _n, secret_token: _s, ...columns } = ROW;
    const out = episodeForReader(NOT_ADMIN[1], Episode.build(columns));
    expect(Object.keys(out).sort()).toEqual([...EPISODE_SAFE_FIELDS, ...FACTS].sort());
    expect(out).toMatchObject({ id: 'ep-1', title: 'The Gala', has_script: true, script_approved_beat_count: 3, script_line_count: 3 });
    expect(JSON.stringify(out)).not.toContain('unpublished line');
  });

  test('no row: null or undefined as given, for anyone', () => {
    expect(episodeForReader(ADMIN, null)).toBeNull();
    expect(episodeForReader(NOT_ADMIN[0], null)).toBeNull();
    expect(episodeForReader(NOT_ADMIN[0], undefined)).toBeUndefined();
    expect(safeEpisode('not a row')).toBeNull();
  });

  test('a show that was looked for and not found stays null; one not included is not added', () => {
    expect(episodeForReader(NOT_ADMIN[0], { ...ROW, show: null }).show).toBeNull();
    const { show: _show, ...bare } = ROW;
    expect(episodeForReader(NOT_ADMIN[0], bare)).not.toHaveProperty('show');
  });
});

describe('the script facts', () => {
  test('has_script: text that is more than white space', () => {
    expect(scriptFacts({ script_content: SCRIPT }).has_script).toBe(true);
    for (const empty of ['', '   \n ', null, undefined, 12, { a: 1 }]) expect(scriptFacts({ script_content: empty }).has_script).toBe(false);
  });

  test('script_approved_beat_count: the locked beats 1-14, once each, as numbers or as JSON text', () => {
    expect(scriptFacts({ script_locked_beats: [1, 2, 2, 5, 99, 0] }).script_approved_beat_count).toBe(3);
    expect(scriptFacts({ script_locked_beats: JSON.stringify([1, '2', 14]) }).script_approved_beat_count).toBe(3);
    expect(scriptFacts({ script_locked_beats: Array.from({ length: 14 }, (_, i) => i + 1) }).script_approved_beat_count).toBe(14);
    for (const none of [null, undefined, [], {}, 'not json']) {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(scriptFacts({ script_locked_beats: none }).script_approved_beat_count).toBe(0);
      spy.mockRestore();
    }
  });

  test('script_line_count: the lines of the text; 0 with no script', () => {
    expect(scriptFacts({ script_content: 'a\nb\nc' }).script_line_count).toBe(3);
    expect(scriptFacts({ script_content: 'one line' }).script_line_count).toBe(1);
    expect(scriptFacts({ script_content: '' }).script_line_count).toBe(0);
    expect(scriptFacts({}).script_line_count).toBe(0);
  });

  test('the facts are three plain values: no text among them', () => {
    const facts = scriptFacts(ROW);
    expect(facts).toEqual({ has_script: true, script_approved_beat_count: 3, script_line_count: 3 });
  });
});

describe('season_context for a non-admin: where the episode sits, not the season\'s planning text', () => {
  test('the label and the season, slot, phase and special identifiers only', () => {
    expect(safeSeasonContext(SEASON)).toEqual({
      label: 'S2 · E3', season_number: 2, slot_number: 3, arc_id: 'arc-1', phase_count: 3, position_in_phase: 3,
      snapshotted_at: '2026-11-01T00:00:00.000Z',
      phase: { number: 1, episode_start: 1, episode_end: 8 },
      two_part: { part: 1, of: 2, other_slot_number: 4 },
      special: { id: 'sp-1', kind: 'bonus', special_type: 'holiday', after_slot_number: 7, label: 'Special · after E7', counts_toward_parts: true },
    });
    expect(JSON.stringify(safeSeasonContext(SEASON))).not.toMatch(/private/i);
  });

  test('stored as JSON text: read the same; unreadable or absent: null', () => {
    expect(safeSeasonContext(JSON.stringify({ label: 'S1 · E1', story_purpose: 'private' }))).toEqual({ label: 'S1 · E1' });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(safeSeasonContext('not json')).toBeNull();
    spy.mockRestore();
    for (const none of [null, undefined, [], 7]) expect(safeSeasonContext(none)).toBeNull();
  });

  test('a part that is null stays null; one that is absent is not added', () => {
    expect(safeSeasonContext({ label: 'S1 · Special', slot_number: null, phase: null })).toEqual({ label: 'S1 · Special', slot_number: null, phase: null });
  });
});

describe('pick', () => {
  test('the row\'s own values for the names; null for no row', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c', 'z'])).toEqual({ a: 1, c: 3 });
    expect(pick(null, ['a'])).toBeNull();
    expect(pick('x', ['length'])).toBeNull();
  });
});
