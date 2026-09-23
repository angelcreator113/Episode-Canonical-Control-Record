// ============================================================================
// userInGroup — in-handler Cognito group test (#1699)
// ============================================================================
// req.user carries Cognito groups (pool: admin, editor, viewer — lowercase)
// and never a `role`. userInGroup mirrors authorize()'s comparison:
// case-insensitive, plain toLowerCase().

const { userInGroup } = require('../../../src/middleware/auth');

describe('userInGroup', () => {
  test('admin-group user is in admin', () => {
    expect(userInGroup({ groups: ['admin'] }, 'admin')).toBe(true);
  });

  test('comparison is case-insensitive both ways', () => {
    expect(userInGroup({ groups: ['Admin'] }, 'admin')).toBe(true);
    expect(userInGroup({ groups: ['admin'] }, 'ADMIN')).toBe(true);
  });

  test('editor-group user is not in admin', () => {
    expect(userInGroup({ groups: ['editor'] }, 'admin')).toBe(false);
  });

  test('user with no groups is not in admin', () => {
    expect(userInGroup({ groups: [] }, 'admin')).toBe(false);
    expect(userInGroup({ email: 'x@example.test' }, 'admin')).toBe(false);
  });

  test('a role field alone grants nothing', () => {
    expect(userInGroup({ role: 'admin' }, 'admin')).toBe(false);
  });

  test('no user, non-array groups, or non-string entries are not in admin', () => {
    expect(userInGroup(null, 'admin')).toBe(false);
    expect(userInGroup(undefined, 'admin')).toBe(false);
    expect(userInGroup({ groups: 'admin' }, 'admin')).toBe(false);
    expect(userInGroup({ groups: [null, 42] }, 'admin')).toBe(false);
  });

  test('group name must match whole, not as a substring', () => {
    expect(userInGroup({ groups: ['admin-group'] }, 'admin')).toBe(false);
    expect(userInGroup({ groups: [' admin '] }, 'admin')).toBe(false);
  });
});
