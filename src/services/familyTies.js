'use strict';

/**
 * Family between characters (Evoni, 2026-10-23: "how can we give family to
 * characters? It helps with relationships"; "I want them all").
 *
 * A family tie is one character_relationships row per pair. Its family_role
 * reads "A is B's <role>" and reverse_family_role "B is A's <role>"
 * (migration 20261024000000), so both directions read from one row:
 * familyRoleFor(row, id). family_kind says what kind of family it is
 * (blood, step, adoptive, married, chosen); is_blood_relation is written
 * alongside it for the older readers.
 *
 *   KINDS                         the five kinds
 *   reverseRole(role, gender)     the role read the other way ("mother" →
 *                                 "daughter" / "son" / "child")
 *   generationStep(role)          how many generations the role's holder is
 *                                 below the other (mother -1, son +1, sister 0)
 *   kindOf(role)                  the kind a role implies when none is given
 *   genderOf(character)           'f', 'm' or null, from gender and pronouns
 *   familyRoleFor(row, id)        the role that person holds in the tie
 *   isSpouseRole(role)            a partner role: romance, not a family tie here
 *   saveFamilyTie(sequelize, …)   add or change a tie, both directions
 *   linkPulseFamily(sequelize, id) the tie's Pulse link, when both have profiles
 *   familyLines(sequelize, ids)   the ties as lines for the writers
 */

const { v4: uuidv4 } = require('uuid');

const KINDS = Object.freeze(['blood', 'step', 'adoptive', 'married', 'chosen']);

// Each base role: the generations its holder sits below the other, and its
// reverse as [female, male, unknown]. "Chosen family" reverses to itself.
const BASE = {
  mother:      { step: -1, rev: ['daughter', 'son', 'child'] },
  father:      { step: -1, rev: ['daughter', 'son', 'child'] },
  parent:      { step: -1, rev: ['daughter', 'son', 'child'] },
  mom:         { step: -1, rev: ['daughter', 'son', 'child'] },
  dad:         { step: -1, rev: ['daughter', 'son', 'child'] },
  daughter:    { step: 1, rev: ['mother', 'father', 'parent'] },
  son:         { step: 1, rev: ['mother', 'father', 'parent'] },
  child:       { step: 1, rev: ['mother', 'father', 'parent'] },
  sister:      { step: 0, rev: ['sister', 'brother', 'sibling'] },
  brother:     { step: 0, rev: ['sister', 'brother', 'sibling'] },
  sibling:     { step: 0, rev: ['sister', 'brother', 'sibling'] },
  twin:        { step: 0, rev: ['twin', 'twin', 'twin'] },
  aunt:        { step: -1, rev: ['niece', 'nephew', 'niece or nephew'] },
  uncle:       { step: -1, rev: ['niece', 'nephew', 'niece or nephew'] },
  niece:       { step: 1, rev: ['aunt', 'uncle', 'aunt or uncle'] },
  nephew:      { step: 1, rev: ['aunt', 'uncle', 'aunt or uncle'] },
  cousin:      { step: 0, rev: ['cousin', 'cousin', 'cousin'] },
  grandmother: { step: -2, rev: ['granddaughter', 'grandson', 'grandchild'] },
  grandfather: { step: -2, rev: ['granddaughter', 'grandson', 'grandchild'] },
  grandparent: { step: -2, rev: ['granddaughter', 'grandson', 'grandchild'] },
  granddaughter: { step: 2, rev: ['grandmother', 'grandfather', 'grandparent'] },
  grandson:    { step: 2, rev: ['grandmother', 'grandfather', 'grandparent'] },
  grandchild:  { step: 2, rev: ['grandmother', 'grandfather', 'grandparent'] },
  'chosen family': { step: 0, rev: ['chosen family', 'chosen family', 'chosen family'] },
};
const FEMALE_BASE = new Set(['mother', 'mom', 'daughter', 'sister', 'aunt', 'niece', 'grandmother', 'granddaughter']);
const MALE_BASE = new Set(['father', 'dad', 'son', 'brother', 'uncle', 'nephew', 'grandfather', 'grandson']);

// Words before or after a base role that ride along into the reverse
// ("stepmother" → "stepdaughter", "aunt-in-law" → "niece-in-law"); adoptive
// and adopted swap ("adoptive mother" → "adopted daughter").
const PREFIXES = [
  ['great-', 'great-'], ['great ', 'great '], ['step-', 'step'], ['step', 'step'], ['half-', 'half-'], ['half ', 'half-'],
  ['adoptive ', 'adopted '], ['adopted ', 'adoptive '], ['foster ', 'foster '], ['chosen ', 'chosen '], ['god', 'god'],
];
const SUFFIXES = ['-in-law', ' in-law', ' in law'];

const SPOUSE = new Set(['wife', 'husband', 'spouse', 'partner', 'ex-wife', 'ex-husband', 'ex-partner', 'fiancé', 'fiancée', 'fiance', 'fiancee', 'girlfriend', 'boyfriend']);
const isSpouseRole = (role) => SPOUSE.has(String(role || '').trim().toLowerCase());

/** A role taken apart: its prefixes (as written, and reversed), base and suffix. */
function parse(role) {
  let rest = String(role || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!rest) return null;
  if (BASE[rest]) return { pre: [], base: rest, suffix: '' };
  let suffix = '';
  for (const s of SUFFIXES) {
    if (rest.endsWith(s)) { suffix = '-in-law'; rest = rest.slice(0, -s.length).trim(); break; }
  }
  const pre = [];
  for (let guard = 0; guard < 4 && !BASE[rest]; guard += 1) {
    const hit = PREFIXES.find(([p]) => rest.startsWith(p) && rest.length > p.length);
    if (!hit) break;
    pre.push(hit);
    rest = rest.slice(hit[0].length).trim();
  }
  return BASE[rest] ? { pre, base: rest, suffix } : null;
}

/** 'f', 'm' or null, from a character's gender or pronouns. */
function genderOf(c) {
  const words = `${c?.gender || ''} ${c?.pronouns || ''}`.toLowerCase();
  if (/\b(female|woman|girl|she|her|f)\b/.test(words)) return 'f';
  if (/\b(male|man|boy|he|him|m)\b/.test(words)) return 'm';
  return null;
}

/** The gender a role names, if it names one ("aunt" → 'f'). */
function genderOfRole(role) {
  const p = parse(role);
  if (!p) return null;
  if (FEMALE_BASE.has(p.base)) return 'f';
  if (MALE_BASE.has(p.base)) return 'm';
  return null;
}

/**
 * The role read the other way: if A is B's `role`, B is A's reverseRole(role,
 * B's gender). Null for a role this does not know (the tie still reads one
 * way).
 */
function reverseRole(role, gender = null) {
  const p = parse(role);
  if (!p) return null;
  const [f, m, n] = BASE[p.base].rev;
  const base = gender === 'f' ? f : gender === 'm' ? m : n;
  const pre = p.pre.map(([, out]) => out).join('');
  return `${pre}${base}${p.suffix}`;
}

/** Generations the role's holder sits below the other: mother -1, son +1; null when unknown. */
function generationStep(role) {
  const p = parse(role);
  if (!p) return null;
  const greats = p.pre.filter(([w]) => w.startsWith('great')).length;
  const step = BASE[p.base].step;
  return step === 0 ? 0 : step + Math.sign(step) * greats;
}

/** The kind a role implies, for a tie added without one. */
function kindOf(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('step')) return 'step';
  if (r.includes('adopt')) return 'adoptive';
  if (r.includes('chosen')) return 'chosen';
  if (r.includes('in-law') || r.includes('in law')) return 'married';
  return 'blood';
}

/**
 * The role `characterId` holds in the tie `row`: A's is family_role, B's is
 * reverse_family_role (worked out from family_role on rows written before it).
 */
function familyRoleFor(row, characterId) {
  if (!row) return null;
  const id = String(characterId);
  if (String(row.character_id_a) === id) return row.family_role || null;
  if (String(row.character_id_b) === id) {
    if (row.reverse_family_role) return row.reverse_family_role;
    return row.family_role ? reverseRole(row.family_role, genderOf({ gender: row.b_gender, pronouns: row.b_pronouns })) : null;
  }
  return null;
}

const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;
const SELECT = (sequelize) => sequelize.QueryTypes.SELECT;

/**
 * Add or change the family tie "from is to's <role>" (both are registry
 * characters). The pair's live family row is reused (whichever way round it
 * was written); otherwise a confirmed 'family' row is made. The reverse role
 * is written from to's gender. Returns { id, created, pulse }.
 */
async function saveFamilyTie(sequelize, { fromId, toId, role, kind = null, notes, tension } = {}) {
  const words = String(role || '').trim();
  if (!fromId || !toId || !words) throw Object.assign(new Error('Two people and a role are needed'), { status: 400 });
  if (String(fromId) === String(toId)) throw Object.assign(new Error('Someone cannot be their own family'), { status: 400 });
  if (isSpouseRole(words)) {
    throw Object.assign(new Error('A partner or spouse is romance, not a family tie: add them as a relationship.'), { status: 400 });
  }
  const theKind = kind == null || kind === '' ? kindOf(words) : String(kind);
  if (!KINDS.includes(theKind)) throw Object.assign(new Error(`Kind must be one of ${KINDS.join(', ')}`), { status: 400 });

  const people = await sequelize.query(
    `SELECT id, gender, pronouns FROM registry_characters WHERE id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids: [fromId, toId] }, type: SELECT(sequelize) });
  const from = people.find((p) => String(p.id) === String(fromId));
  const to = people.find((p) => String(p.id) === String(toId));
  if (!from || !to) throw Object.assign(new Error('Character not found'), { status: 404 });
  const reverse = reverseRole(words, genderOf(to));

  const [existing] = await sequelize.query(
    `SELECT id, character_id_a, character_id_b FROM character_relationships
      WHERE deleted_at IS NULL AND is_romantic = false
        AND ((character_id_a = :from AND character_id_b = :to) OR (character_id_a = :to AND character_id_b = :from))
        AND (family_role IS NOT NULL OR family_kind IS NOT NULL OR is_blood_relation = true OR relationship_type = 'family')
      ORDER BY (relationship_type = 'family') DESC, updated_at DESC LIMIT 1`,
    { replacements: { from: fromId, to: toId }, type: SELECT(sequelize) });

  const fields = {
    kind: theKind, blood: theKind === 'blood',
    notes_sent: notes !== undefined, notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    tension_sent: tension !== undefined, tension: typeof tension === 'string' && tension.trim() ? tension.trim() : null,
  };
  let id;
  let created = false;
  if (existing) {
    id = existing.id;
    const forward = String(existing.character_id_a) === String(fromId);
    // Written the other way round with a role this cannot reverse: turn the
    // row round (the knowledge columns with it) so family_role stays true.
    const flip = !forward && !reverse;
    await sequelize.query(
      `UPDATE character_relationships SET
          ${flip ? 'character_id_a = character_id_b, character_id_b = character_id_a, source_knows = target_knows, target_knows = source_knows,' : ''}
          family_role = :role, reverse_family_role = :reverse,
          family_kind = :kind, is_blood_relation = :blood, confirmed = true,
          role_tag = COALESCE(role_tag, 'family'),
          notes = CASE WHEN :notes_sent THEN :notes ELSE notes END,
          tension_state = CASE WHEN :tension_sent THEN :tension ELSE tension_state END,
          updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id, ...fields, role: forward || flip ? words : reverse, reverse: forward || flip ? reverse : words } });
  } else {
    const [row] = await sequelize.query(
      `INSERT INTO character_relationships
         (id, character_id_a, character_id_b, relationship_type, connection_mode, lala_connection, status,
          confirmed, is_romantic, family_role, reverse_family_role, family_kind, is_blood_relation, role_tag,
          notes, tension_state, created_at, updated_at)
       VALUES (:id, :from, :to, 'family', 'IRL', 'none', 'Active',
          true, false, :role, :reverse, :kind, :blood, 'family', :notes, :tension, NOW(), NOW())
       ON CONFLICT (character_id_a, character_id_b, relationship_type) DO UPDATE SET
          family_role = EXCLUDED.family_role, reverse_family_role = EXCLUDED.reverse_family_role,
          family_kind = EXCLUDED.family_kind, is_blood_relation = EXCLUDED.is_blood_relation,
          confirmed = true, is_romantic = false, deleted_at = NULL, updated_at = NOW()
       RETURNING id`,
      { replacements: { id: uuidv4(), from: fromId, to: toId, role: words, reverse, ...fields }, type: SELECT(sequelize) });
    id = row.id;
    created = true;
  }

  let pulse = null;
  try {
    pulse = await linkPulseFamily(sequelize, id);
  } catch (err) {
    console.error('[familyTies] the Pulse family link was not made:', err.message);
  }
  return { id, created, pulse };
}

/** "Jade Monroe is Dre Coleman's sister." for a tie row with names. */
const familyWords = (t) => (t.family_role ? `${t.a_name} is ${t.b_name}'s ${t.family_role}.` : `${t.a_name} and ${t.b_name} are family.`);

/**
 * The tie's link on The Pulse: when both people have Pulse profiles
 * (registry_characters.feed_profile_id), their social_profile_relationships
 * row of kind 'family' is found (either way round) or made, its description
 * the tie in words (kept when someone already wrote one), and linked to the
 * tie (character_relationship_id, when it is not linked to another story
 * pair) so the drift report knows whose it is. Returns
 * { id, created } or null when either has no profile. Kept apart from
 * saveFamilyTie so the one-relationship-truth work can call or merge it.
 */
async function linkPulseFamily(sequelize, relId) {
  const [t] = await sequelize.query(
    `SELECT cr.id, cr.family_role, ca.feed_profile_id AS a_profile, cb.feed_profile_id AS b_profile,
            ${nameSql('ca')} AS a_name, ${nameSql('cb')} AS b_name
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
      WHERE cr.id = :id AND cr.deleted_at IS NULL`,
    { replacements: { id: relId }, type: SELECT(sequelize) });
  if (!t || t.a_profile == null || t.b_profile == null || Number(t.a_profile) === Number(t.b_profile)) return null;
  const description = familyWords(t);
  const [found] = await sequelize.query(
    `SELECT id, description FROM social_profile_relationships
      WHERE relationship_type = 'family'
        AND ((source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a))
      LIMIT 1`,
    { replacements: { a: t.a_profile, b: t.b_profile }, type: SELECT(sequelize) });
  if (found) {
    await sequelize.query(
      `UPDATE social_profile_relationships SET
          description = CASE WHEN description IS NULL OR BTRIM(description) = '' THEN :description ELSE description END,
          character_relationship_id = COALESCE(character_relationship_id, :rel), updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: found.id, description, rel: t.id } });
    return { id: found.id, created: false };
  }
  const [row] = await sequelize.query(
    `INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, direction, description, auto_generated,
        character_relationship_id, created_at, updated_at)
     VALUES (:a, :b, 'family', 'mutual', :description, false, :rel, NOW(), NOW())
     ON CONFLICT (source_profile_id, target_profile_id, relationship_type) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    { replacements: { a: t.a_profile, b: t.b_profile, description, rel: t.id }, type: SELECT(sequelize) });
  return { id: row.id, created: true };
}

/**
 * The family ties of these characters, as lines for a writer's cast block:
 * "Jade Monroe: Dre Coleman's sister (blood; healing)". Confirmed, live,
 * non-romantic ties with a role or kind; confidential characters stay out.
 * lalaverseOnly leaves out any tie with someone from JustAWoman's world
 * (world 'book-1', or JustAWoman herself), as the story writer's canon says.
 */
async function familyLines(sequelize, characterIds, { lalaverseOnly = false } = {}) {
  const ids = [...new Set((characterIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const { notConfidentialSql } = require('../utils/confidentialCharacters');
  const outside = (a) => `(COALESCE(${a}.world::text, '') = 'book-1' OR LOWER(COALESCE(${a}.character_key, '')) = 'justawoman' OR LOWER(COALESCE(${a}.display_name, '')) = 'justawoman')`;
  const rows = await sequelize.query(
    `SELECT cr.character_id_a, cr.character_id_b, cr.family_role, cr.reverse_family_role, cr.family_kind,
            cr.tension_state, cb.gender AS b_gender, ${nameSql('ca')} AS a_name, ${nameSql('cb')} AS b_name
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
      WHERE cr.deleted_at IS NULL AND cr.confirmed = true AND cr.is_romantic = false
        AND (cr.family_role IS NOT NULL OR cr.family_kind IS NOT NULL)
        AND (cr.character_id_a::text IN (:ids) OR cr.character_id_b::text IN (:ids))
        AND ${notConfidentialSql('ca')} AND ${notConfidentialSql('cb')}
        ${lalaverseOnly ? `AND NOT ${outside('ca')} AND NOT ${outside('cb')}` : ''}
      ORDER BY cr.created_at ASC`,
    { replacements: { ids }, type: SELECT(sequelize) });
  return rows.map((r) => {
    // From the side of whoever is in the list (A when both are).
    const aIn = ids.includes(String(r.character_id_a));
    const [who, other] = aIn ? [r.a_name, r.b_name] : [r.b_name, r.a_name];
    const role = familyRoleFor(r, aIn ? r.character_id_a : r.character_id_b) || 'family';
    const extra = [r.family_kind, r.tension_state].filter(Boolean).join('; ');
    return `${who}: ${other}'s ${role}${extra ? ` (${extra})` : ''}`;
  });
}

module.exports = {
  KINDS, reverseRole, generationStep, kindOf, genderOf, genderOfRole, familyRoleFor, isSpouseRole,
  saveFamilyTie, linkPulseFamily, familyLines, familyWords,
};
