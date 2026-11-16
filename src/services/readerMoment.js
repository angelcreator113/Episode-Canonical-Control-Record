'use strict';

/**
 * The story moment a request reads The Pulse at (Evoni, 2026-11-15).
 *
 * Every Pulse read took its moment from the page (`?at=`) and trusted it:
 * left out, there was no story boundary at all, and a later moment was
 * honoured for anyone. The rule is services/storyClock readerAt; this is the
 * one place a route asks it, so each route decides nothing itself:
 *
 *   readsAsAdmin(req)                          the ADMIN test these reads use
 *                                              (services/mediaLibrary audienceOf),
 *                                              reading the groups of a verified
 *                                              token wherever it carries them
 *   momentFor(req, models, showId, value)      an ADMIN: as asked (undefined when
 *                                              no moment is named, so the
 *                                              director's view has no boundary).
 *                                              Anyone else: never later than the
 *                                              present, whatever was sent.
 * Throws storyClock's 400-shaped error for a moment that cannot be read.
 */

function readsAsAdmin(req) {
  const user = req && req.user;
  if (!user) return false;
  const groups = [...(Array.isArray(user.groups) ? user.groups : []), ...(Array.isArray(user.raw?.groups) ? user.raw.groups : [])];
  return require('./mediaLibrary').audienceOf({ groups }) === 'admin';
}

function momentFor(req, models, showId, value) {
  const asked = value === undefined || value === null ? undefined : String(value);
  return require('./storyClock').readerAt(models, showId, asked, { admin: readsAsAdmin(req) });
}

module.exports = { readsAsAdmin, momentFor };
