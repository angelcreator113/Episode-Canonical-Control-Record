'use strict';

/**
 * The writes that are NOT an ADMIN's (middleware/adminWriteGuard; Evoni's
 * rulings of 2026-11-15). Every other state-changing request under /api is
 * refused before it reaches a router unless the caller is in the ADMIN group.
 *
 * Each entry is one exact method and one exact mounted route, written as the
 * route is mounted, with its parameters (`:id` matches one path segment).
 * There are no prefixes and no wildcards: a route is either named here or it
 * is an ADMIN's. An entry lets the request through to the route, whose own
 * checks (named in `keeps`) still run; it grants nothing by itself.
 *
 * To add an entry: it needs Evoni's ruling, a `why`, and the check the route
 * itself makes. tests/integration/adminWriteGuard.integration.test.js fails
 * for an entry that matches no mounted route, and for a mounted write route
 * that answers a non-admin without being named here.
 *
 * Not here, by her ruling (no self-service exception is granted yet):
 * notifications, presence, onboarding, the teleprompter's signed-in session
 * routes, phone playthrough state, saved searches, the assistant session.
 */
const WRITE_GUARD_EXCEPTIONS = Object.freeze([
  // Public authentication: there is no session before these.
  { method: 'POST', path: '/api/v1/auth/login', why: 'signing in', keeps: 'Cognito verifies the credentials' },
  { method: 'POST', path: '/api/v1/auth/refresh', why: 'renewing a session', keeps: 'Cognito verifies the refresh token' },
  { method: 'POST', path: '/api/v1/auth/logout', why: 'signing out', keeps: 'acts only on the token it is sent' },
  { method: 'POST', path: '/api/v1/auth/validate', why: 'checking a token', keeps: 'the verifier; changes nothing' },
  // Public voting.
  { method: 'POST', path: '/api/v1/public/polls/:id/vote', why: 'an audience vote on an open poll', keeps: 'its limiter, one vote per voter, the per-network cap, salted hashes' },
  // Token-authenticated command.
  { method: 'POST', path: '/api/v1/teleprompter-remote/phone/commands', why: 'the phone remote of a teleprompter session', keeps: 'its X-Remote-Token and limiter; one allowlisted command' },
].map((e) => Object.freeze(e)));

module.exports = { WRITE_GUARD_EXCEPTIONS };
