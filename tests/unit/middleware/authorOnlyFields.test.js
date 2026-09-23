// ============================================================================
// authorOnlyFields — who may see and write the four author-only fields (#1703)
// ============================================================================

const {
  AUTHOR_ONLY_FIELDS,
  canAccessAuthorFields,
  stripAuthorOnlyFields,
  hideAuthorOnlyFieldsFromNonAdmins,
} = require('../../../src/middleware/authorOnlyFields');

const AUTHOR = {
  de_blind_spot: 'a',
  de_blind_spot_evidence: 'b',
  de_blind_spot_crack_condition: 'c',
  de_actual_narrative_gap: 'd',
};

describe('AUTHOR_ONLY_FIELDS', () => {
  test('is the model list of four', () => {
    expect([...AUTHOR_ONLY_FIELDS].sort()).toEqual(Object.keys(AUTHOR).sort());
  });
});

describe('canAccessAuthorFields', () => {
  test('admin group, any case', () => {
    expect(canAccessAuthorFields({ groups: ['admin'] })).toBe(true);
    expect(canAccessAuthorFields({ groups: ['Admin'] })).toBe(true);
  });
  test('editor, viewer, no groups, role-only, no user', () => {
    expect(canAccessAuthorFields({ groups: ['editor'] })).toBe(false);
    expect(canAccessAuthorFields({ groups: ['viewer'] })).toBe(false);
    expect(canAccessAuthorFields({ groups: [] })).toBe(false);
    expect(canAccessAuthorFields({ role: 'admin' })).toBe(false);
    expect(canAccessAuthorFields(null)).toBe(false);
  });
});

describe('stripAuthorOnlyFields', () => {
  test('removes the four fields and keeps everything else', () => {
    expect(stripAuthorOnlyFields({ id: 1, de_money_wound: 'x', ...AUTHOR })).toEqual({ id: 1, de_money_wound: 'x' });
  });

  test('walks nested objects and arrays (registry with characters)', () => {
    const registry = { id: 'r', characters: [{ id: 'c1', ...AUTHOR }, { id: 'c2', de_blind_spot: 'z' }] };
    expect(stripAuthorOnlyFields(registry)).toEqual({ id: 'r', characters: [{ id: 'c1' }, { id: 'c2' }] });
  });

  test('serialises toJSON objects (Sequelize instances) before stripping', () => {
    const instance = { toJSON: () => ({ id: 'c1', display_name: 'Lala', ...AUTHOR }) };
    expect(stripAuthorOnlyFields({ success: true, character: instance })).toEqual({
      success: true, character: { id: 'c1', display_name: 'Lala' },
    });
  });

  test('leaves primitives, null and dates alone', () => {
    const d = new Date('2026-09-23T00:00:00Z');
    expect(stripAuthorOnlyFields({ n: 1, s: 's', z: null, d })).toEqual({ n: 1, s: 's', z: null, d });
    expect(stripAuthorOnlyFields('text')).toBe('text');
  });

  test('does not mutate its input', () => {
    const input = { id: 1, ...AUTHOR };
    stripAuthorOnlyFields(input);
    expect(input.de_blind_spot).toBe('a');
  });
});

describe('hideAuthorOnlyFieldsFromNonAdmins', () => {
  const run = (user) => {
    const sent = [];
    const req = {};
    const res = { json: (body) => { sent.push(body); return res; } };
    hideAuthorOnlyFieldsFromNonAdmins(req, res, () => {});
    req.user = user; // set after the middleware, as per-route requireAuth does
    res.json({ character: { id: 'c1', ...AUTHOR } });
    return sent[0];
  };

  test('admin gets the payload unchanged', () => {
    expect(run({ groups: ['admin'] }).character).toEqual({ id: 'c1', ...AUTHOR });
  });

  test('editor, viewer and no user get it stripped', () => {
    for (const user of [{ groups: ['editor'] }, { groups: ['viewer'] }, undefined]) {
      expect(run(user).character).toEqual({ id: 'c1' });
    }
  });
});
