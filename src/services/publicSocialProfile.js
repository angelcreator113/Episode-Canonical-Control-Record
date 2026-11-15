'use strict';

/**
 * A feed profile as anyone who is not an ADMIN may read it (Evoni's ruling of
 * 2026-11-15, character privacy). GET /api/v1/social-profiles and
 * GET /api/v1/social-profiles/:id are open reads (optionalAuth) and returned
 * the whole row: the private reality behind the persona, secret connections,
 * what the account costs Lala, income, controversy, the generator's full
 * profile. A profile holds production material beside its public face, so
 * the public face is named here, column by column, and nothing else leaves
 * the server for a reader who is not an ADMIN:
 *
 *   PUBLIC_PROFILE_FIELDS    the only columns read from the table for them
 *   publicProfile(row)       the row cut to those columns (a new column is
 *                            private until it is added to the list)
 *   publicProfileList(db, q) the list for them: a search by handle or name,
 *                            the feed layer, and paging. The production
 *                            filters and sorts (relevance, archetype, adult
 *                            content, status, follow motivation) are not
 *                            honoured: filtering by a private column would
 *                            tell what it holds. No followers, no registry
 *                            link, no status counts.
 *   publicProfileById(db, id)
 *   readsAsAdmin(req)        who gets the whole row instead
 *
 * The Pulse's own profile page reads GET /api/v1/pulse-follows/profile/:handle,
 * which was shaped already and is not changed.
 */

const PUBLIC_PROFILE_FIELDS = Object.freeze([
  'id', 'handle', 'platform', 'display_name', 'vibe_sentence', 'public_persona', 'city', 'follower_tier', 'feed_layer',
]);

/** The row cut to its public columns. */
function publicProfile(row) {
  const source = row && typeof row.get === 'function' ? row.get({ plain: true }) : (row || {});
  const out = {};
  for (const field of PUBLIC_PROFILE_FIELDS) out[field] = source[field] === undefined ? null : source[field];
  return out;
}

/**
 * Whether the request reads as an ADMIN, by the test the media library uses
 * (services/mediaLibrary audienceOf). On an optionalAuth route the verified
 * token's groups are under its own claim for a Cognito token and under
 * `groups` for a locally signed one, so both are read.
 */
function readsAsAdmin(req) {
  const user = req && req.user;
  if (!user) return false;
  const groups = [...(Array.isArray(user.groups) ? user.groups : []), ...(Array.isArray(user.raw?.groups) ? user.raw.groups : [])];
  return require('./mediaLibrary').audienceOf({ groups }) === 'admin';
}

const FEED_LAYERS = ['real_world', 'lalaverse'];

async function publicProfileList(db, query = {}) {
  const { Op } = require('sequelize');
  const where = {};
  if (FEED_LAYERS.includes(String(query.feed_layer || ''))) where.feed_layer = String(query.feed_layer);
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    where[Op.or] = [{ handle: { [Op.iLike]: `%${escaped}%` } }, { display_name: { [Op.iLike]: `%${escaped}%` } }];
  }
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 24));
  const { count, rows } = await db.SocialProfile.findAndCountAll({
    where, attributes: [...PUBLIC_PROFILE_FIELDS], order: [['handle', 'ASC'], ['id', 'ASC']], limit, offset: (page - 1) * limit,
  });
  return {
    profiles: rows.map(publicProfile),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

async function publicProfileById(db, id) {
  const row = await db.SocialProfile.findByPk(id, { attributes: [...PUBLIC_PROFILE_FIELDS] });
  return row ? publicProfile(row) : null;
}

module.exports = { PUBLIC_PROFILE_FIELDS, publicProfile, publicProfileList, publicProfileById, readsAsAdmin };
