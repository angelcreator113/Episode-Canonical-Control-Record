'use strict';

/**
 * Tidy up existing relationship types (Evoni, 2026-10-24: "Yes tidy up
 * existing relationships"). Her page showed types the older generator made
 * up ("Subject turned critic", "Fidelity test", "The one who stayed") and
 * list types spelt another way ("Rival"). Each live relationship and seed
 * whose type is not one the app writes is proposed a list type, read by
 * the same normalizer Generate uses (services/relationshipTypes); she
 * reviews every change before anything is saved.
 *
 *   proposals(db)              { items: [{ id, a_name, b_name, current_type, proposed_type,
 *                                proposed_is_romantic, proposed_from, flavour, situation_now, situation_after }] }
 *                              deterministic, no AI; read from the type, else guessed from the
 *                              situation (proposed_from 'situation'); proposed_type null when neither decides
 *   applyTidy(db, changes)     her accepted changes, in one transaction; each item alone
 *                              (a savepoint), so one refused leaves the rest; the Pulse pair
 *                              follows each after commit. { updated, refused, skipped }
 *
 * The rules are PUT /relationships/:id's: a romance with a family role that
 * is not a partner's is refused; a family type is written as a family tie
 * through services/familyTies (the role both ways). An item already a type
 * the app writes is skipped, so a second Save changes nothing.
 *
 * A pair with a company in it (services/companyCharacters) is read with the
 * company types (normalizeCompanyType): any other type is proposed one, the
 * item says company (and brand_pair for two companies), and Save takes only
 * a company type there, never a romance or family (409).
 */

const familyTies = require('./familyTies');
const truth = require('./relationshipTruth');
const {
  normalizeType, canonicalType, isKnownType, familyRoleOf, roleWords, words, capital,
  COMPANY_TYPES, BRAND_PAIR_TYPES, normalizeCompanyType, companyRefusal,
} = require('./relationshipTypes');
const { companySql } = require('./companyCharacters');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHANGES = 200;
const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;
const sq = (db) => db?.sequelize || db;

class TidyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'TidyError'; }
}

/** The situation with the old words kept in front, unless it already says them. */
function situationAfter(flavour, situation) {
  const now = typeof situation === 'string' ? situation.trim() : '';
  if (!flavour) return now || null;
  if (now.toLowerCase().includes(flavour.toLowerCase())) return now;
  return now ? `${flavour}: ${now}` : flavour;
}

/** The type is one this pair keeps: a company type for a company's pair, else any the app writes. */
function knownFor(row) {
  if (row.a_company || row.b_company) {
    return (row.a_company && row.b_company ? BRAND_PAIR_TYPES : COMPANY_TYPES).includes(String(row.relationship_type || ''));
  }
  return isKnownType(row.relationship_type);
}

/** A company pair's proposal: a company type from the type, else from the situation. */
function companyProposal(row) {
  const brandPair = Boolean(row.a_company && row.b_company);
  let n = normalizeCompanyType(row.relationship_type, { brandPair });
  let from = n ? 'type' : null;
  if (!n && typeof row.situation === 'string' && row.situation.trim()) {
    const guess = normalizeCompanyType(row.situation.slice(0, 400), { brandPair });
    if (guess) { n = { ...guess, flavour: capital(words(row.relationship_type)) || null }; from = 'situation'; }
  }
  const flavour = n && !COMPANY_TYPES.includes(words(row.relationship_type).replace(/ /g, '_')) && !canonicalType(row.relationship_type) ? n.flavour : null;
  return {
    id: row.id, a_name: row.a_name, b_name: row.b_name, confirmed: row.confirmed,
    current_type: row.relationship_type,
    proposed_type: n ? n.type : null,
    proposed_is_romantic: false,
    proposed_from: from,
    flavour,
    situation_now: row.situation || null,
    situation_after: situationAfter(flavour, row.situation),
    company: true, brand_pair: brandPair,
  };
}

/** One row's proposal. Pure, for the tests. */
function proposalFor(row) {
  if (row.a_company || row.b_company) return companyProposal(row);
  const romantic = row.is_romantic === true;
  let n = normalizeType(row.relationship_type, { romantic });
  let from = n ? 'type' : null;
  // Words the type alone cannot place ("mirror_image") are read from the
  // situation as a second guess; the page marks it so she checks it.
  if (!n && typeof row.situation === 'string' && row.situation.trim()) {
    const guess = normalizeType(row.situation.slice(0, 400), { romantic });
    if (guess) { n = { ...guess, flavour: capital(words(row.relationship_type)) || null }; from = 'situation'; }
  }
  // A list type spelt another way keeps no flavour: "Rival" is just rival.
  const flavour = n && !canonicalType(row.relationship_type) ? n.flavour : null;
  return {
    id: row.id, a_name: row.a_name, b_name: row.b_name, confirmed: row.confirmed,
    current_type: row.relationship_type,
    proposed_type: n ? n.type : null,
    proposed_is_romantic: n ? n.is_romantic : romantic,
    proposed_from: from,
    flavour,
    situation_now: row.situation || null,
    situation_after: situationAfter(flavour, row.situation),
  };
}

async function proposals(db) {
  const [rows] = await sq(db).query(
    `SELECT cr.id, cr.relationship_type, cr.is_romantic, cr.situation, cr.confirmed,
            ${nameSql('ca')} AS a_name, ${nameSql('cb')} AS b_name,
            ${companySql('ca')} IS NOT NULL AS a_company, ${companySql('cb')} IS NOT NULL AS b_company
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
      WHERE cr.deleted_at IS NULL
      ORDER BY cr.confirmed DESC, cr.updated_at DESC`);
  return { items: rows.filter((r) => !knownFor(r)).map(proposalFor) };
}

/** The type she picked, as the app writes it, or null when it is not one. */
function pickedType(v) {
  const canon = canonicalType(v);
  if (canon) return canon;
  const role = familyRoleOf(v);
  if (role) return role;
  return roleWords(v) === 'family' ? 'family' : null;
}

/** One change, inside its savepoint. Returns 'updated' or 'skipped'; throws a TidyError to refuse it. */
async function applyOne(sequelize, change, transaction) {
  const id = String(change?.id || '');
  if (!UUID_RE.test(id)) throw new TidyError('Relationship not found', 404);
  const [[row]] = await sequelize.query(
    `SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.relationship_type, cr.is_romantic, cr.family_role,
            cr.family_kind, cr.confirmed, cb.gender AS b_gender, cb.pronouns AS b_pronouns,
            ${companySql('ca')} IS NOT NULL AS a_company, ${companySql('cb')} IS NOT NULL AS b_company
       FROM character_relationships cr
       LEFT JOIN registry_characters ca ON ca.id = cr.character_id_a
       LEFT JOIN registry_characters cb ON cb.id = cr.character_id_b
      WHERE cr.id = :id AND cr.deleted_at IS NULL FOR UPDATE OF cr`, { replacements: { id }, transaction });
  if (!row) throw new TidyError('Relationship not found', 404);
  if (knownFor(row)) return 'skipped';
  if (row.a_company || row.b_company) return applyCompany(sequelize, row, change, transaction);
  const type = pickedType(change.relationship_type);
  if (!type) throw new TidyError(`"${String(change.relationship_type || '').slice(0, 60)}" is not a type the app knows`);
  const romantic = change.is_romantic !== undefined ? change.is_romantic === true : row.is_romantic === true;
  // The family role it carries: its own (when not a partner's), else the new type's.
  const familyRole = familyRoleOf(row.family_role) || (familyTies.isSpouseRole(row.family_role) ? null : familyRoleOf(type));
  if (romantic && familyRole) throw new TidyError(`They are family (${familyRole}), so this cannot be a romance.`, 409);

  const sets = ['relationship_type = :type', 'is_romantic = :romantic'];
  const replacements = { id, type, romantic };
  if (change.situation !== undefined) {
    sets.push('situation = :situation');
    replacements.situation = typeof change.situation === 'string' && change.situation.trim() ? change.situation.trim() : null;
  }
  await sequelize.query(`UPDATE character_relationships SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :id`, { replacements, transaction });

  if (familyRole && row.confirmed) {
    // A confirmed tie goes through familyTies, as POST and the Family tab save one.
    await sequelize.query('UPDATE character_relationships SET family_role = :role WHERE id = :id', { replacements: { id, role: familyRole }, transaction });
    const kind = roleWords(row.family_role) === familyRole && row.family_kind ? row.family_kind : null;
    const saved = await familyTies.saveFamilyTie(sequelize, { fromId: row.character_id_a, toId: row.character_id_b, role: familyRole, kind, transaction });
    if (String(saved.id) !== id) throw new TidyError('They already have a family tie: change that one on the Family tab.', 409);
  } else if (familyRole) {
    // A seed stays a seed (saveFamilyTie would confirm it): its role both ways and its kind.
    const kind = row.family_kind || familyTies.kindOf(familyRole);
    await sequelize.query(
      `UPDATE character_relationships SET family_role = :role, reverse_family_role = :reverse, family_kind = :kind, is_blood_relation = :blood
        WHERE id = :id`,
      { replacements: { id, role: familyRole, reverse: familyTies.reverseRole(familyRole, familyTies.genderOf({ gender: row.b_gender, pronouns: row.b_pronouns })), kind, blood: kind === 'blood' }, transaction });
  }
  return 'updated';
}

/** A company pair's change: a company type only (two companies: partner or rival brand), never romantic. */
async function applyCompany(sequelize, row, change, transaction) {
  const why = companyRefusal(change.relationship_type, change.is_romantic === true);
  if (why) throw new TidyError(`One of them is a company. ${why}`, 409);
  const allowed = row.a_company && row.b_company ? BRAND_PAIR_TYPES : COMPANY_TYPES;
  const type = String(change.relationship_type || '').trim();
  if (!allowed.includes(type)) throw new TidyError(`"${type.slice(0, 60)}" is not a type for a company: pick one of ${allowed.join(', ')}`);
  const sets = ['relationship_type = :type', 'is_romantic = false'];
  const replacements = { id: row.id, type };
  if (change.situation !== undefined) {
    sets.push('situation = :situation');
    replacements.situation = typeof change.situation === 'string' && change.situation.trim() ? change.situation.trim() : null;
  }
  await sequelize.query(`UPDATE character_relationships SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :id`, { replacements, transaction });
  return 'updated';
}

const isUniqueViolation = (err) => err?.name === 'SequelizeUniqueConstraintError' || err?.original?.code === '23505' || err?.parent?.code === '23505';

async function applyTidy(db, changes) {
  if (!Array.isArray(changes) || !changes.length) throw new TidyError('changes must be a list of at least one');
  if (changes.length > MAX_CHANGES) throw new TidyError(`At most ${MAX_CHANGES} changes at a time`);
  const sequelize = sq(db);
  const updated = [];
  const refused = [];
  const skipped = [];
  const seen = new Set();
  await sequelize.transaction(async (transaction) => {
    for (const change of changes) {
      const id = String(change?.id || '');
      if (seen.has(id)) continue;
      seen.add(id);
      try {
        // A savepoint each, so a refused item leaves the others in the transaction.
        const done = await sequelize.transaction({ transaction }, (savepoint) => applyOne(sequelize, change, savepoint));
        (done === 'updated' ? updated : skipped).push(id);
      } catch (err) {
        console.error(`[relationshipTypeTidy] ${id} refused:`, err.message);
        const error = err instanceof TidyError ? err.message
          : isUniqueViolation(err) ? 'A relationship of that type is already there between them.'
            : err?.status && err?.message ? err.message : 'It could not be changed.';
        refused.push({ id, error });
      }
    }
  });
  // After commit: each one's Pulse pair follows (afterStorySave never throws).
  for (const id of updated) await truth.afterStorySave(db, id);
  return { updated, refused, skipped };
}

module.exports = { knownFor, proposals, proposalFor, situationAfter, applyTidy, TidyError, MAX_CHANGES };
