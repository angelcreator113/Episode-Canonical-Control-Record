/**
 * authorize() case-insensitive group comparison (F-AUTH-1 group-case-mismatch fix)
 *
 * The pool's real Cognito groups are lowercase (admin, editor, viewer); 38 of 51
 * call sites across the app pass uppercase role strings. This asserts the fixed
 * comparison in src/middleware/auth.js's authorize (aliased as authorizeRole)
 * against the three directions the fix needs to hold: the fix itself, the
 * already-correct sites staying unaffected, and no collision with the other groups.
 */

const { authorize } = require('../../../src/middleware/auth');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('authorize() case-insensitive comparison', () => {
  test('authorize(["ADMIN"]) passes for a real-shape lowercase "admin" group', () => {
    const req = { user: { groups: ['admin'] } };
    const res = buildRes();
    const next = jest.fn();

    authorize(['ADMIN'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('authorize(["admin"]) still passes for a lowercase "admin" group -- the 13 already-correct sites are unaffected', () => {
    const req = { user: { groups: ['admin'] } };
    const res = buildRes();
    const next = jest.fn();

    authorize(['admin'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('authorize(["ADMIN"]) does not match "editor" or "viewer" membership -- the collision case the enumeration ruled out but this pins', () => {
    const req = { user: { groups: ['editor', 'viewer'] } };
    const res = buildRes();
    const next = jest.fn();

    authorize(['ADMIN'])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_GROUP_REQUIRED' })
    );
  });
});
