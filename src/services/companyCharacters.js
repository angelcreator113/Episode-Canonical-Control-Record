'use strict';

/**
 * Registry characters that are companies (Evoni, 2026-10-24: "I'm pretty
 * sure this is a brand in lalaverse how should we handle relationships
 * between brands?"; then "I want them all and show me first").
 *
 * Some companies were made as registry characters too ("The Column",
 * "Velour Atelier"), so they turn up in relationship pairs. Such a character
 * is marked with its company in its own JSON, extra_fields.company_id (a
 * lalaverse_brands id). That is not extra_fields.brand_id, which means "a
 * representative of" (services/brandProfile peopleOf). No column, no
 * migration. A company is never in a romance or a family (services/
 * relationshipTypes companyRefusal; its own types, COMPANY_TYPES).
 *
 *   companyOf(character)              the company id its JSON names, or null; pure
 *   companySql(alias)                 SQL: the live company of the registry character
 *                                     `alias` as JSON { id, slug, name, kind }, or NULL
 *   companyIdsAmong(db, ids)          Map(character id → { id, slug, name, kind }) for those
 *                                     marked with a live company
 *   pairOf(db, a, b)                  { a, b, any, both }: each side's company or null
 *   refusePair(db, a, b, { type, is_romantic })   throws a 409 CompanyError when either
 *                                     side is a company and the type is a romance or family;
 *                                     else the pair (pairOf's)
 *   linkCharacter(db, slugOrId, characterId | null)   mark (or unmark) the company's character
 *   characterOf(db, companyId)        the company's character { id, name } or null
 *   looksLikeCompany(name) / guessKind(name)   pure
 *   lookAlikes(db)                    registry characters that look like companies, each with
 *                                     the company of that name (or none: "Make a company")
 *
 * Nothing links by itself: lookAlikes only suggests; Evoni links each one.
 */

const { normalizeName, COMPANY_KINDS } = require('../constants/companyKinds');
const { companyRefusal } = require('./relationshipTypes');
const { notConfidentialSql } = require('../utils/confidentialCharacters');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sq = (db) => db?.sequelize || db;
const select = (db, sql, replacements = {}, transaction) => sq(db).query(sql, { replacements, type: sq(db).QueryTypes.SELECT, transaction });
const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;

class CompanyLinkError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'CompanyLinkError'; }
}
// The routes answer brandProfile's CompanyError with its status; a link error is one.
const companyError = (status, message) => {
  const { CompanyError } = require('./brandProfile');
  return new CompanyError(status, message);
};

const objOf = (v) => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v) || {}; } catch (err) {
    console.error('[companyCharacters] extra_fields unreadable:', err.message);
    return {};
  }
};

/** The company id a registry character's JSON names (extra_fields.company_id), or null. */
function companyOf(character) {
  const id = objOf(character?.extra_fields).company_id;
  return id && UUID_RE.test(String(id)) ? String(id) : null;
}

/** SQL for the live company of registry character `alias`, as JSON, or NULL. */
const companySql = (alias) => `(SELECT json_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'kind', b.kind)
    FROM lalaverse_brands b WHERE b.deleted_at IS NULL AND b.id::text = (${alias}.extra_fields->>'company_id') LIMIT 1)`;

async function companyIdsAmong(db, ids, { transaction } = {}) {
  const list = [...new Set((ids || []).map(String).filter((id) => UUID_RE.test(id)))];
  const out = new Map();
  if (!list.length) return out;
  const rows = await select(db,
    `SELECT rc.id AS character_id, b.id, b.slug, b.name, b.kind
       FROM registry_characters rc
       JOIN lalaverse_brands b ON b.deleted_at IS NULL AND b.id::text = (rc.extra_fields->>'company_id')
      WHERE rc.id IN (:list)`, { list }, transaction);
  for (const r of rows) out.set(String(r.character_id), { id: r.id, slug: r.slug, name: r.name, kind: r.kind || 'brand' });
  return out;
}

async function pairOf(db, a, b, { transaction } = {}) {
  const map = await companyIdsAmong(db, [a, b], { transaction });
  const ca = map.get(String(a)) || null;
  const cb = map.get(String(b)) || null;
  return { a: ca, b: cb, any: Boolean(ca || cb), both: Boolean(ca && cb) };
}

/** Throws a 409 when either side is a company and the type is a romance or family; else the pair. */
async function refusePair(db, a, b, { type, is_romantic: romantic = false } = {}, { transaction } = {}) {
  const pair = await pairOf(db, a, b, { transaction });
  if (!pair.any) return pair;
  const why = companyRefusal(type, romantic === true);
  if (why) {
    const name = (pair.a || pair.b).name;
    throw new CompanyLinkError(409, `${name} is a company. ${why}`);
  }
  return pair;
}

// ── Finding the characters that are companies ──────────────────────────────
const LOOKS_LIKE = /^the\s|\b(atelier|studio|studios|magazine|house|agency|group|co|collective|label|media|gallery|boutique|column|review|journal|times|daily|weekly)\b/i;
const OUTLET_WORDS = /\b(column|review|journal|magazine|times|daily|weekly|gazette|tribune|digest|quarterly)\b/i;
const VENUE_WORDS = /\b(gallery|lounge|hall|hotel|theatre|theater|rooftop)\b/i;
const AGENCY_WORDS = /\b(agency|management|talent)\b/i;

/** Does a name read like a company's ("The Column", "Velour Atelier")? */
const looksLikeCompany = (name) => LOOKS_LIKE.test(String(name || '').trim());

/** The kind a new company of this name most likely is: outlet, venue, agency, else brand. */
function guessKind(name) {
  const n = String(name || '');
  if (OUTLET_WORDS.test(n)) return 'outlet';
  if (VENUE_WORDS.test(n)) return 'venue';
  if (AGENCY_WORDS.test(n)) return 'agency';
  return 'brand';
}

/**
 * Registry characters that look like companies and are not marked as one:
 * a name (chosen or display) that is a company's name, or reads like one.
 * Each with its company (or null), the kind a new one would be, and the
 * character already marked as that company, if any. At most 100.
 */
async function lookAlikes(db) {
  const companies = await select(db, 'SELECT id, slug, name, kind FROM lalaverse_brands WHERE deleted_at IS NULL ORDER BY name LIMIT 500');
  const byName = new Map(companies.map((c) => [normalizeName(c.name), c]));
  const people = await select(db,
    `SELECT rc.id, ${nameSql('rc')} AS name, rc.display_name, rc.selected_name, rc.registry_id, rc.extra_fields->>'company_id' AS company_id
       FROM registry_characters rc
      WHERE rc.deleted_at IS NULL AND ${notConfidentialSql('rc')}
      ORDER BY 2 ASC LIMIT 2000`);
  const live = new Set(companies.map((c) => String(c.id)));
  const takenBy = new Map(people.filter((p) => p.company_id && live.has(String(p.company_id))).map((p) => [String(p.company_id), p]));
  const out = [];
  for (const p of people) {
    if (p.company_id && live.has(String(p.company_id))) continue;
    const names = [p.name, p.display_name, p.selected_name].filter((n) => typeof n === 'string' && n.trim());
    const same = names.map((n) => byName.get(normalizeName(n))).find(Boolean) || null;
    if (!same && !names.some(looksLikeCompany)) continue;
    const taken = same ? takenBy.get(String(same.id)) : null;
    out.push({
      character_id: p.id, name: p.name, reason: same ? 'same_name' : 'looks_like',
      company: same ? { id: same.id, slug: same.slug, name: same.name, kind: same.kind || 'brand', kind_label: COMPANY_KINDS[same.kind] || COMPANY_KINDS.brand } : null,
      guessed_kind: same ? (same.kind || 'brand') : guessKind(p.name),
      taken_by: taken && String(taken.id) !== String(p.id) ? { id: taken.id, name: taken.name } : null,
    });
    if (out.length >= 100) break;
  }
  // Those with a company of their name first.
  return out.sort((x, y) => (x.reason === 'same_name' ? 0 : 1) - (y.reason === 'same_name' ? 0 : 1));
}

async function findCompany(db, slugOrId) {
  const key = String(slugOrId || '').trim();
  const [row] = key ? await select(db,
    `SELECT id, slug, name, kind FROM lalaverse_brands WHERE deleted_at IS NULL AND ${UUID_RE.test(key) ? 'id = :key' : 'slug = :key'} LIMIT 1`, { key }) : [];
  if (!row) throw companyError(404, 'Company not found.');
  return row;
}

/** The company's character { id, name }, or null. */
async function characterOf(db, companyId) {
  const [row] = await select(db,
    `SELECT rc.id, ${nameSql('rc')} AS name FROM registry_characters rc
      WHERE rc.deleted_at IS NULL AND rc.extra_fields->>'company_id' = :id ORDER BY rc.created_at ASC LIMIT 1`, { id: String(companyId) });
  return row ? { id: row.id, name: row.name } : null;
}

/**
 * Mark a registry character as this company (characterId), or unmark the
 * one it has (null). A character marked as another company, or a company
 * with another character, is refused (409): unlink that one first. Returns
 * { company, character, conflicts }: conflicts are the character's live
 * relationships that are a romance or a family tie, which a company cannot
 * have, for Evoni to change.
 */
async function linkCharacter(db, slugOrId, characterId) {
  const company = await findCompany(db, slugOrId);
  const sequelize = sq(db);
  if (characterId === null || characterId === undefined || characterId === '') {
    await sequelize.query(
      `UPDATE registry_characters SET extra_fields = extra_fields - 'company_id', updated_at = NOW()
        WHERE jsonb_typeof(extra_fields) = 'object' AND extra_fields->>'company_id' = :id`, { replacements: { id: String(company.id) } });
    return { company, character: null, conflicts: [] };
  }
  if (!UUID_RE.test(String(characterId))) throw companyError(400, 'character_id must be a registry character id, or null to unlink.');
  const [character] = await select(db,
    `SELECT rc.id, ${nameSql('rc')} AS name, rc.extra_fields->>'company_id' AS company_id FROM registry_characters rc
      WHERE rc.id = :id AND rc.deleted_at IS NULL`, { id: characterId });
  if (!character) throw companyError(404, 'Character not found.');
  if (character.company_id && String(character.company_id) !== String(company.id)) {
    const [other] = await select(db, 'SELECT name FROM lalaverse_brands WHERE id::text = :id AND deleted_at IS NULL', { id: String(character.company_id) });
    if (other) throw companyError(409, `${character.name} is marked as ${other.name} already. Unlink it there first.`);
  }
  const current = await characterOf(db, company.id);
  if (current && String(current.id) !== String(character.id)) {
    throw companyError(409, `${company.name} is ${current.name} already. Unlink that one first.`);
  }
  await sequelize.query(
    `UPDATE registry_characters SET extra_fields = jsonb_set(
        CASE WHEN jsonb_typeof(extra_fields) = 'object' THEN extra_fields ELSE CAST('{}' AS jsonb) END,
        '{company_id}', to_jsonb(CAST(:company AS text)), true), updated_at = NOW()
      WHERE id = :id`, { replacements: { id: character.id, company: String(company.id) } });
  const conflicts = await select(db,
    `SELECT cr.id, cr.relationship_type, cr.is_romantic, cr.family_role,
            CASE WHEN cr.character_id_a = :id THEN ${nameSql('cb')} ELSE ${nameSql('ca')} END AS other_name
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a
       JOIN registry_characters cb ON cb.id = cr.character_id_b
      WHERE cr.deleted_at IS NULL AND (cr.character_id_a = :id OR cr.character_id_b = :id)
        AND (cr.is_romantic = true OR cr.family_role IS NOT NULL OR cr.family_kind IS NOT NULL OR cr.relationship_type IN ('family', 'love_interest', 'husband', 'wife'))
      ORDER BY cr.updated_at DESC LIMIT 20`, { id: character.id });
  return {
    company, character: { id: character.id, name: character.name },
    conflicts: conflicts.map((c) => ({ id: c.id, with: c.other_name, type: c.family_role || c.relationship_type, is_romantic: c.is_romantic === true })),
  };
}

module.exports = {
  CompanyLinkError, companyOf, companySql, companyIdsAmong, pairOf, refusePair,
  looksLikeCompany, guessKind, lookAlikes, characterOf, linkCharacter,
};
