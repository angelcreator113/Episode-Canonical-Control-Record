/**
 * What a state-changing request answers when the route it names is not
 * there, or is switched off, under the ADMIN write guard
 * (src/middleware/adminWriteGuard; Evoni, 2026-11-15: a protected write may
 * answer 401 or 403 before 404 or 410).
 *
 * The guard stands in front of every route, so with it enforcing a caller
 * who is not an ADMIN is refused before the app can say the route is
 * missing: 401 signed out, 403 signed in. An ADMIN always reaches the
 * app's own answer, and so does everyone while the guard is off or only
 * reporting. Either way the request reaches no handler.
 *
 * The mode is read when asked, as the guard reads it, so a test that
 * switches it mid-run is answered correctly.
 */
const { modeOf } = require('../../src/middleware/adminWriteGuard');

const enforcing = () => modeOf(process.env.ADMIN_WRITE_GUARD) === 'enforce';

/** who: null (signed out), 'user' (signed in, not an ADMIN) or 'admin'. routeStatus: the app's own answer (404, 410). */
function writeStatus(who, routeStatus) {
  if (who === 'admin' || !enforcing()) return routeStatus;
  return who ? 403 : 401;
}

/**
 * The two signed-in callers a production write refuses (Evoni, 2026-11-15:
 * editor and viewer accounts are read-only), as access tokens.
 */
function readOnlyTokens(tag) {
  const TokenService = require('../../src/services/tokenService');
  const token = (who, groups) => TokenService.generateTokenPair({
    id: `test-${who}-${tag}`, email: `${who}@${tag}.dev`, name: `${tag} ${who}`, groups, role: 'USER',
  }).accessToken;
  return { viewer: token('viewer', ['viewer']), editor: token('editor', ['USER', 'EDITOR']) };
}

/**
 * One write, sent three times: signed out (401), as a viewer and as an
 * editor (403, AUTH_GROUP_REQUIRED). build() returns a new supertest request
 * each time, with its body or files and no Authorization header. Only
 * meaningful with the guard enforcing: with it off the route would accept
 * the editor, so the caller defines its test with enforcing().
 */
async function expectWriteRefused(build, tokens) {
  const anon = await build();
  expect(['signed out', anon.status]).toEqual(['signed out', 401]);
  for (const who of ['viewer', 'editor']) {
    const res = await build().set('Authorization', `Bearer ${tokens[who]}`);
    expect([who, res.status, res.body.code]).toEqual([who, 403, 'AUTH_GROUP_REQUIRED']);
  }
}

module.exports = { enforcing, writeStatus, readOnlyTokens, expectWriteRefused };
