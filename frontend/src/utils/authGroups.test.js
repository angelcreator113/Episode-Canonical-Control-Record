/**
 * authGroups — admin check reads Cognito groups, not a role (#1699).
 */
import { describe, test, expect } from 'vitest';
import { userInGroup, isAdmin, adminOnlyMessage, ADMIN_ONLY_CODE, PLAN_ADMIN_ONLY_MESSAGE } from './authGroups';

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

describe('adminOnlyMessage', () => {
  const refusal = (data, status = 403) => ({ response: { status, data } });

  test("authorize(['ADMIN'])'s refusal reads as the page's sentence", () => {
    const err = refusal({ error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' });
    expect(PLAN_ADMIN_ONLY_MESSAGE).toBe('Only an admin can change the production plan.');
    expect(adminOnlyMessage(err)).toBe(PLAN_ADMIN_ONLY_MESSAGE);
    expect(adminOnlyMessage(err, 'Another sentence.')).toBe('Another sentence.');
  });

  test("a handler's own sentence is shown as the server wrote it", () => {
    const sentence = 'Only an admin can link an event to an episode or change the place of an event that has an episode.';
    const err = refusal({ success: false, code: ADMIN_ONLY_CODE, error: sentence, message: sentence, fields: ['scene_set_id'] });
    expect(adminOnlyMessage(err)).toBe(sentence);
    expect(adminOnlyMessage(err, 'Another sentence.')).toBe(sentence);
  });

  test('a refusal with the code and no words still reads as the sentence', () => {
    expect(adminOnlyMessage(refusal({ code: 'AUTH_GROUP_REQUIRED' }))).toBe(PLAN_ADMIN_ONLY_MESSAGE);
    expect(adminOnlyMessage(refusal({ code: 'AUTH_GROUP_REQUIRED', message: '   ' }))).toBe(PLAN_ADMIN_ONLY_MESSAGE);
  });

  test('any other error is not an admin-only refusal, so the page keeps its own message', () => {
    expect(adminOnlyMessage(refusal({ error: 'Forbidden', code: 'OFFER_DECISION_FORBIDDEN' }))).toBeNull();
    expect(adminOnlyMessage(refusal({ error: 'Forbidden' }))).toBeNull();
    expect(adminOnlyMessage(refusal({ code: 'AUTH_GROUP_REQUIRED' }, 409))).toBeNull();
    expect(adminOnlyMessage(refusal({ error: 'nope' }, 500))).toBeNull();
    expect(adminOnlyMessage(new Error('Network Error'))).toBeNull();
    expect(adminOnlyMessage(null)).toBeNull();
    expect(adminOnlyMessage(undefined)).toBeNull();
  });
});

describe('userInGroup', () => {
  test('matches the named group case-insensitively', () => {
    expect(userInGroup({ groups: ['Editor'] }, 'editor')).toBe(true);
    expect(userInGroup({ groups: ['viewer'] }, 'editor')).toBe(false);
  });
});
