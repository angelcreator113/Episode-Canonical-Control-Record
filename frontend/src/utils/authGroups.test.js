/**
 * authGroups — admin check reads Cognito groups, not a role (#1699).
 */
import { describe, test, expect } from 'vitest';
import { userInGroup, isAdmin } from './authGroups';

describe('isAdmin', () => {
  test('admin-group user is admin', () => {
    expect(isAdmin({ groups: ['admin'] })).toBe(true);
  });

  test('mixed-case admin group is accepted', () => {
    expect(isAdmin({ groups: ['Admin'] })).toBe(true);
    expect(isAdmin({ groups: ['ADMIN'] })).toBe(true);
  });

  test('editor-group user is not admin', () => {
    expect(isAdmin({ groups: ['editor'] })).toBe(false);
  });

  test('user with no groups is not admin', () => {
    expect(isAdmin({ groups: [] })).toBe(false);
    expect(isAdmin({ email: 'x@example.test' })).toBe(false);
  });

  test('a role field alone grants nothing', () => {
    expect(isAdmin({ role: 'admin' })).toBe(false);
    expect(isAdmin({ role: 'ADMIN' })).toBe(false);
  });

  test('no user or malformed groups is not admin', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin({ groups: 'admin' })).toBe(false);
    expect(isAdmin({ groups: ['admin-group'] })).toBe(false);
  });
});

describe('userInGroup', () => {
  test('matches the named group case-insensitively', () => {
    expect(userInGroup({ groups: ['Editor'] }, 'editor')).toBe(true);
    expect(userInGroup({ groups: ['viewer'] }, 'editor')).toBe(false);
  });
});
