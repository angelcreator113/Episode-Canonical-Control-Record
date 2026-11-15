'use strict';

/**
 * ADMIN by default for every state-changing API request (Evoni's rulings of
 * 2026-11-15: "ADMIN is the only role authorized to create, modify, delete,
 * publish or otherwise change production content"; editor and viewer are
 * read-only).
 *
 * Why here and not on each route: of about 1,300 write routes, over 900 asked
 * only for a sign-in, so any signed-in account could change production
 * content. This one check is mounted on /api ahead of every router (app.js),
 * so a route added later is an ADMIN's without anyone remembering to say so.
 *
 *   - GET, HEAD and OPTIONS pass untouched: reads keep their own rules.
 *   - Any other method is refused unless the caller is an ADMIN, by the
 *     existing requireAuth (401) and authorize(['ADMIN']) (403), or the
 *     request is one of config/writeGuardManifest's exact routes.
 *   - It refuses before any router runs: no handler, so no database write, no
 *     AI call, no queued job and no file change.
 *
 * ADMIN_WRITE_GUARD sets what it does; it is read on every request:
 *   unset, '' or 'off'  nothing: every request passes (as before this file)
 *   'report'            nothing is refused; a request it would refuse is
 *                       logged as "[write-guard] would refuse …" (method, the
 *                       path with its ids masked, 401 or 403; never who)
 *   'enforce'           refuses
 * Any other value is treated as 'enforce': a misspelt setting must not open
 * the door it was meant to close.
 */

const { requireAuth, authorize } = require('./auth');
const { WRITE_GUARD_EXCEPTIONS } = require('../config/writeGuardManifest');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const adminOnly = authorize(['ADMIN']);

/** 'off' | 'report' | 'enforce' for a value of ADMIN_WRITE_GUARD. */
function modeOf(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  if (v === '' || v === 'off') return 'off';
  if (v === 'report') return 'report';
  return 'enforce';
}

/** The request's path as mounted, without its query or a trailing slash. */
function pathOf(req) {
  const raw = String(req.originalUrl || req.url || '').split('?')[0];
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

/** Whether a path is exactly a manifest route: same segments, `:name` matching any one segment. */
function matchesRoute(pattern, path) {
  const want = pattern.split('/');
  const got = path.split('/');
  if (want.length !== got.length) return false;
  return want.every((seg, i) => (seg.startsWith(':') ? got[i].length > 0 : seg === got[i]));
}

/** The manifest entry for this method and path, or null. */
function exceptionFor(method, path, manifest = WRITE_GUARD_EXCEPTIONS) {
  const m = String(method || '').toUpperCase();
  return manifest.find((e) => e.method === m && matchesRoute(e.path, path)) || null;
}

/** A path safe to log: ids and numbers replaced, nothing after the path. */
const maskedPath = (path) => path
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
  .replace(/\/\d+(?=\/|$)/g, '/:n');

/**
 * What requireAuth then authorize(['ADMIN']) would answer, without answering:
 * null when the caller is an ADMIN, else the status they would send. The
 * request's user is left as it was found.
 */
function wouldRefuse(req) {
  const before = req.user;
  const run = (mw) => new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json() { resolve(this.statusCode); return this; },
      send() { resolve(this.statusCode); return this; },
      end() { resolve(this.statusCode); return this; },
      set() { return this; },
      setHeader() {},
      getHeader() { return undefined; },
    };
    Promise.resolve(mw(req, res, () => resolve(null))).catch(() => resolve(500));
  });
  return run(requireAuth).then((code) => (code ? code : run(adminOnly))).finally(() => { req.user = before; });
}

function adminWriteGuard(req, res, next) {
  const mode = modeOf(process.env.ADMIN_WRITE_GUARD);
  if (mode === 'off' || SAFE_METHODS.has(String(req.method || '').toUpperCase())) return next();
  const path = pathOf(req);
  if (exceptionFor(req.method, path)) return next();

  if (mode === 'report') {
    return wouldRefuse(req).then((code) => {
      if (code) console.warn(`[write-guard] would refuse ${req.method} ${maskedPath(path)} (${code})`);
      return next();
    }).catch((err) => {
      console.error('[write-guard] report failed:', err.message);
      return next();
    });
  }
  return requireAuth(req, res, (err) => (err ? next(err) : adminOnly(req, res, next)));
}

module.exports = { adminWriteGuard, modeOf, pathOf, matchesRoute, exceptionFor, maskedPath, SAFE_METHODS };
