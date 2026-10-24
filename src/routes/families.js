'use strict';

/**
 * Family (Evoni, 2026-10-23: "how can we give family to characters? It
 * helps with relationships"; "I want them all and show me first").
 *
 * Two things, read together by the character page's Family section and the
 * Relationships page's Family tab:
 *   family ties     character_relationships rows with a family role and
 *                   kind, one per pair, both directions (services/familyTies)
 *   named families  families + family_members (migration 20261024000001):
 *                   "the Monroes", with characters, Pulse profiles that have
 *                   no character, and names not built yet (ghosts)
 *
 *   GET    /                         the families, each with its members
 *   POST   /                         make a family
 *   PUT    /:id                      rename it, its city, its notes
 *   DELETE /:id                      remove it (marked deleted, members too)
 *   POST   /:id/members              add someone to it
 *   PUT    /:id/members/:memberId    change their role or generation
 *   DELETE /:id/members/:memberId    take them out
 *   GET    /people?character_id=     who can be added: characters and Pulse profiles
 *   GET    /character/:charId        their ties, their families, their old family tree
 *   POST   /ties                     "+ Add family": a character, a Pulse profile or a name
 *   DELETE /ties/:relId              take the family off a tie
 *   POST   /make-character           "Make them a character" and tie them, in one step
 *   POST   /import/:charId           "Import family": the family_tree JSON, once
 *   GET    /profile/:profileId       a Pulse profile's family
 *
 * Reads are requireAuth; every write is requireAuth + ADMIN, as on
 * routes/relationships.js ("this whole part of the site is admin only").
 */

const express = require('express');
const router = express.Router();
const { requireAuth, authorize } = require('../middleware/auth');
const ties = require('../services/familyTies');
const { LINKED_CHARACTER_JOIN } = require('../utils/registryLink');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN = [requireAuth, authorize(['ADMIN'])];

let _db = null;
function getDb() {
  if (!_db) _db = require('../models');
  return _db;
}
const SELECT = () => getDb().sequelize.QueryTypes.SELECT;
const q = (sql, replacements = {}, opts = {}) => getDb().sequelize.query(sql, { replacements, type: SELECT(), ...opts });
const run = (sql, replacements = {}, opts = {}) => getDb().sequelize.query(sql, { replacements, ...opts });

const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;
const text = (v, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const intOrNull = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

// A thrown { status } answers with that status; anything else is a 500.
function fail(res, where, err) {
  console.error(`${where} error:`, err);
  res.status(err.status || 500).json({ error: err.message });
}
const bad = (status, message) => Object.assign(new Error(message), { status });

/* ── reads ──────────────────────────────────────────────────────────── */

const MEMBER_SELECT = `
  fm.id, fm.family_id, fm.registry_character_id, fm.social_profile_id, fm.ghost_name,
  fm.role, fm.role_of_character_id, fm.generation, fm.notes,
  ${nameSql('rc')} AS character_name, rc.portrait_url, rc.feed_profile_id,
  COALESCE(NULLIF(sp.display_name, ''), sp.handle) AS profile_name, sp.handle AS profile_handle,
  ${nameSql('ro')} AS role_of_name`;
const MEMBER_JOIN = `
  LEFT JOIN registry_characters rc ON rc.id = fm.registry_character_id AND rc.deleted_at IS NULL
  LEFT JOIN social_profiles sp ON sp.id = fm.social_profile_id AND sp.deleted_at IS NULL
  LEFT JOIN registry_characters ro ON ro.id = fm.role_of_character_id AND ro.deleted_at IS NULL`;

/** A member row as the pages read it: who they are, by one name. */
function memberOut(m) {
  const kind = m.registry_character_id && m.character_name ? 'character' : m.social_profile_id && m.profile_name ? 'profile' : 'ghost';
  return {
    id: m.id, family_id: m.family_id, kind,
    registry_character_id: kind === 'character' ? m.registry_character_id : null,
    social_profile_id: m.social_profile_id || null,
    ghost_name: m.ghost_name || null,
    name: kind === 'character' ? m.character_name : kind === 'profile' ? m.profile_name : (m.ghost_name || '?'),
    handle: m.profile_handle || null,
    portrait_url: m.portrait_url || null,
    role: m.role || null, role_of_character_id: m.role_of_character_id || null, role_of_name: m.role_of_name || null,
    generation: m.generation, notes: m.notes || null,
  };
}

/** Families (by id, or all live ones) with their live members. */
async function loadFamilies(familyIds = null) {
  if (Array.isArray(familyIds) && !familyIds.length) return [];
  const families = await q(
    `SELECT id, show_id, name, home_city, notes, created_at, updated_at FROM families
      WHERE deleted_at IS NULL ${familyIds ? 'AND id IN (:ids)' : ''}
      ORDER BY name ASC`, { ids: familyIds });
  if (!families.length) return [];
  const members = await q(
    `SELECT ${MEMBER_SELECT} FROM family_members fm ${MEMBER_JOIN}
      WHERE fm.family_id IN (:ids) AND fm.deleted_at IS NULL
      ORDER BY fm.generation ASC NULLS LAST, fm.created_at ASC`, { ids: families.map((f) => f.id) });
  return families.map((f) => ({ ...f, members: members.filter((m) => m.family_id === f.id).map(memberOut) }));
}

/** The families a character is a member of (ids, oldest first). */
async function familyIdsOf(charId) {
  const rows = await q(
    `SELECT DISTINCT f.id, f.created_at FROM families f
       JOIN family_members fm ON fm.family_id = f.id AND fm.deleted_at IS NULL
      WHERE f.deleted_at IS NULL AND fm.registry_character_id = :id
      ORDER BY f.created_at ASC`, { id: charId });
  return rows.map((r) => r.id);
}

/** A character's family ties: the other person, their role to this one, the kind. */
async function tiesOf(charId) {
  const rows = await q(
    `SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.family_role, cr.reverse_family_role, cr.family_kind,
            cr.is_blood_relation, cr.tension_state, cr.notes, cr.relationship_type,
            ca.gender AS a_gender, cb.gender AS b_gender,
            ${nameSql('ca')} AS a_name, ${nameSql('cb')} AS b_name,
            ca.portrait_url AS a_portrait, cb.portrait_url AS b_portrait,
            ca.feed_profile_id AS a_profile, cb.feed_profile_id AS b_profile
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
      WHERE cr.deleted_at IS NULL AND cr.confirmed = true AND cr.is_romantic = false
        AND (cr.family_role IS NOT NULL OR cr.family_kind IS NOT NULL)
        AND (cr.character_id_a = :id OR cr.character_id_b = :id)
      ORDER BY cr.created_at ASC`, { id: charId });
  return rows.map((r) => {
    const isA = String(r.character_id_a) === String(charId);
    const otherId = isA ? r.character_id_b : r.character_id_a;
    return {
      id: r.id,
      other_id: otherId,
      other_name: isA ? r.b_name : r.a_name,
      other_portrait: (isA ? r.b_portrait : r.a_portrait) || null,
      other_profile_id: (isA ? r.b_profile : r.a_profile) || null,
      role: ties.familyRoleFor(r, otherId),        // what they are to this character
      my_role: ties.familyRoleFor(r, charId),     // what this character is to them
      kind: r.family_kind || (r.is_blood_relation ? 'blood' : null),
      tension: r.tension_state || null,
      notes: r.notes || null,
    };
  });
}

const objOf = (v) => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[families] family_tree is not JSON:', err.message);
    return {};
  }
};

async function characterRow(charId) {
  if (!UUID_RE.test(String(charId || ''))) return null;
  const [c] = await q(
    `SELECT rc.id, rc.registry_id, rc.world, rc.gender, rc.pronouns, rc.family_tree, rc.feed_profile_id,
            rc.selected_name, rc.display_name, ${nameSql('rc')} AS name, reg.show_id
       FROM registry_characters rc
       LEFT JOIN character_registries reg ON reg.id = rc.registry_id
      WHERE rc.id = :id AND rc.deleted_at IS NULL`, { id: charId });
  return c || null;
}

/** Their family_tree JSON (generator-made) as the page reads it, matched to existing characters. */
async function treeOf(c) {
  const tree = objOf(c.family_tree);
  const members = Array.isArray(tree.members) ? tree.members : [];
  const names = members.map((m) => String(m?.name || '').trim().toLowerCase()).filter(Boolean);
  const matches = names.length ? await q(
    `SELECT id, LOWER(${nameSql('rc')}) AS lname, LOWER(rc.display_name) AS ldisplay FROM registry_characters rc
      WHERE rc.deleted_at IS NULL AND rc.registry_id = :reg AND rc.id <> :id
        AND (LOWER(${nameSql('rc')}) IN (:names) OR LOWER(rc.display_name) IN (:names))`,
    { reg: c.registry_id, id: c.id, names }) : [];
  return {
    generational_wound: tree.generational_wound || null,
    imported_at: tree.imported_at || null,
    imported_family_id: tree.imported_family_id || null,
    members: members.map((m, index) => {
      const lname = String(m?.name || '').trim().toLowerCase();
      const hit = matches.find((x) => x.lname === lname || x.ldisplay === lname);
      return {
        index, name: m?.name || '', relation: m?.relation || null,
        sketch: m?.personality_sketch || m?.sketch || null,
        promoted_id: m?.promoted_id || null,
        matched_character_id: m?.promoted_id || (hit ? hit.id : null),
      };
    }),
  };
}

async function readout(charId) {
  const c = await characterRow(charId);
  if (!c) throw bad(404, 'Character not found');
  const [familyTies, ids] = await Promise.all([tiesOf(charId), familyIdsOf(charId)]);
  return { character_id: c.id, name: c.name, ties: familyTies, families: await loadFamilies(ids), family_tree: await treeOf(c) };
}

/* ── named-family writes ────────────────────────────────────────────── */

/** "The Colemans" from "Dre Coleman"; "Lala's family" for a one-word name. */
function familyNameFor(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return `${words[0] || 'Their'}'s family`;
  const last = words[words.length - 1];
  return `The ${last}${/(s|x|z|ch|sh)$/i.test(last) ? 'es' : 's'}`;
}

/** Their first family, made (with them in it, generation 0) when they have none. */
async function ensureFamilyOf(c, transaction) {
  const [found] = await q(
    `SELECT f.id FROM families f JOIN family_members fm ON fm.family_id = f.id AND fm.deleted_at IS NULL
      WHERE f.deleted_at IS NULL AND fm.registry_character_id = :id ORDER BY f.created_at ASC LIMIT 1`,
    { id: c.id }, { transaction });
  if (found) return found.id;
  const [f] = await q(
    `INSERT INTO families (id, show_id, name, created_at, updated_at) VALUES (gen_random_uuid(), :show, :name, NOW(), NOW()) RETURNING id`,
    { show: c.show_id || null, name: familyNameFor(c.name) }, { transaction });
  await run(
    `INSERT INTO family_members (id, family_id, registry_character_id, generation, created_at, updated_at)
     VALUES (gen_random_uuid(), :f, :c, 0, NOW(), NOW())`, { f: f.id, c: c.id }, { transaction });
  return f.id;
}

/** The generation someone with `role` to `ofId` sits at in this family, or null. */
async function generationFor(familyId, ofId, role, transaction) {
  const step = ties.generationStep(role);
  if (step == null || !ofId) return null;
  const [of] = await q(
    `SELECT generation FROM family_members WHERE family_id = :f AND registry_character_id = :c AND deleted_at IS NULL LIMIT 1`,
    { f: familyId, c: ofId }, { transaction });
  return of && of.generation != null ? of.generation + step : null;
}

/**
 * Put someone in a family (a character, a profile or a ghost). A character
 * or profile already there has their role and generation updated instead.
 */
async function addMember(familyId, { registry_character_id = null, social_profile_id = null, ghost_name = null, role = null, role_of_character_id = null, generation, notes = null }, transaction) {
  const gen = generation !== undefined && generation !== null && generation !== ''
    ? intOrNull(generation)
    : await generationFor(familyId, role_of_character_id, role, transaction);
  const who = registry_character_id ? 'registry_character_id = :rc' : social_profile_id ? 'social_profile_id = :sp' : null;
  const values = { f: familyId, rc: registry_character_id, sp: social_profile_id, ghost: text(ghost_name, 200), role: text(role, 120), of: role_of_character_id || null, gen, notes: text(notes) };
  if (who) {
    const [there] = await q(`SELECT id FROM family_members WHERE family_id = :f AND ${who} AND deleted_at IS NULL LIMIT 1`, values, { transaction });
    if (there) {
      await run(
        `UPDATE family_members SET role = COALESCE(:role, role), role_of_character_id = COALESCE(:of, role_of_character_id),
            generation = COALESCE(:gen, generation), updated_at = NOW() WHERE id = :id`, { ...values, id: there.id }, { transaction });
      return there.id;
    }
  }
  const [row] = await q(
    `INSERT INTO family_members (id, family_id, registry_character_id, social_profile_id, ghost_name, role, role_of_character_id, generation, notes, created_at, updated_at)
     VALUES (gen_random_uuid(), :f, :rc, :sp, :ghost, :role, :of, :gen, :notes, NOW(), NOW()) RETURNING id`, values, { transaction });
  return row.id;
}

/* ════════════════════════════════════════════════════════════════════
   Named families
   ════════════════════════════════════════════════════════════════════ */

router.get('/', requireAuth, async (req, res) => {
  try {
    res.json({ families: await loadFamilies() });
  } catch (err) { fail(res, 'GET /families', err); }
});

router.post('/', ...ADMIN, async (req, res) => {
  try {
    const name = text(req.body?.name, 200);
    if (!name) throw bad(400, 'A family needs a name');
    const [f] = await q(
      `INSERT INTO families (id, show_id, name, home_city, notes, created_at, updated_at)
       VALUES (gen_random_uuid(), :show, :name, :city, :notes, NOW(), NOW()) RETURNING id`,
      { show: UUID_RE.test(String(req.body?.show_id || '')) ? req.body.show_id : null, name, city: text(req.body?.home_city, 120), notes: text(req.body?.notes) });
    const [family] = await loadFamilies([f.id]);
    res.status(201).json({ family });
  } catch (err) { fail(res, 'POST /families', err); }
});

router.put('/:id', ...ADMIN, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) throw bad(404, 'Family not found');
    const b = req.body || {};
    if (b.name !== undefined && !text(b.name, 200)) throw bad(400, 'A family needs a name');
    const [row] = await q(
      `UPDATE families SET
          name = CASE WHEN :name_sent THEN :name ELSE name END,
          home_city = CASE WHEN :city_sent THEN :city ELSE home_city END,
          notes = CASE WHEN :notes_sent THEN :notes ELSE notes END,
          updated_at = NOW()
        WHERE id = :id AND deleted_at IS NULL RETURNING id`,
      { id, name_sent: b.name !== undefined, name: text(b.name, 200), city_sent: b.home_city !== undefined, city: text(b.home_city, 120), notes_sent: b.notes !== undefined, notes: text(b.notes) });
    if (!row) throw bad(404, 'Family not found');
    const [family] = await loadFamilies([id]);
    res.json({ family });
  } catch (err) { fail(res, 'PUT /families/:id', err); }
});

router.delete('/:id', ...ADMIN, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) throw bad(404, 'Family not found');
    const [row] = await q('UPDATE families SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id', { id });
    if (!row) throw bad(404, 'Family not found');
    await run('UPDATE family_members SET deleted_at = NOW() WHERE family_id = :id AND deleted_at IS NULL', { id });
    res.json({ deleted: true, id });
  } catch (err) { fail(res, 'DELETE /families/:id', err); }
});

router.post('/:id/members', ...ADMIN, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) throw bad(404, 'Family not found');
    const [f] = await q('SELECT id FROM families WHERE id = :id AND deleted_at IS NULL', { id });
    if (!f) throw bad(404, 'Family not found');
    const b = req.body || {};
    const rc = UUID_RE.test(String(b.registry_character_id || '')) ? b.registry_character_id : null;
    const sp = intOrNull(b.social_profile_id);
    const ghost = text(b.ghost_name, 200);
    if (!rc && !sp && !ghost) throw bad(400, 'Name a character, a Pulse profile or a person');
    if (rc && !(await characterRow(rc))) throw bad(404, 'Character not found');
    if (sp) {
      const [p] = await q('SELECT id FROM social_profiles WHERE id = :id AND deleted_at IS NULL', { id: sp });
      if (!p) throw bad(404, 'Pulse profile not found');
    }
    const of = UUID_RE.test(String(b.role_of_character_id || '')) ? b.role_of_character_id : null;
    const memberId = await addMember(id, { registry_character_id: rc, social_profile_id: rc ? null : sp, ghost_name: rc || sp ? null : ghost, role: b.role, role_of_character_id: of, generation: b.generation, notes: b.notes });
    const [family] = await loadFamilies([id]);
    res.status(201).json({ member_id: memberId, family });
  } catch (err) { fail(res, 'POST /families/:id/members', err); }
});

router.put('/:id/members/:memberId', ...ADMIN, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    if (!UUID_RE.test(id) || !UUID_RE.test(memberId)) throw bad(404, 'Member not found');
    const b = req.body || {};
    const [row] = await q(
      `UPDATE family_members SET
          role = CASE WHEN :role_sent THEN :role ELSE role END,
          generation = CASE WHEN :gen_sent THEN :gen ELSE generation END,
          ghost_name = CASE WHEN :ghost_sent AND registry_character_id IS NULL AND social_profile_id IS NULL THEN COALESCE(:ghost, ghost_name) ELSE ghost_name END,
          notes = CASE WHEN :notes_sent THEN :notes ELSE notes END,
          updated_at = NOW()
        WHERE id = :memberId AND family_id = :id AND deleted_at IS NULL RETURNING id`,
      { id, memberId, role_sent: b.role !== undefined, role: text(b.role, 120), gen_sent: b.generation !== undefined, gen: intOrNull(b.generation),
        ghost_sent: b.ghost_name !== undefined, ghost: text(b.ghost_name, 200), notes_sent: b.notes !== undefined, notes: text(b.notes) });
    if (!row) throw bad(404, 'Member not found');
    const [family] = await loadFamilies([id]);
    res.json({ family });
  } catch (err) { fail(res, 'PUT /families/:id/members/:memberId', err); }
});

router.delete('/:id/members/:memberId', ...ADMIN, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    if (!UUID_RE.test(id) || !UUID_RE.test(memberId)) throw bad(404, 'Member not found');
    const [row] = await q('UPDATE family_members SET deleted_at = NOW() WHERE id = :memberId AND family_id = :id AND deleted_at IS NULL RETURNING id', { id, memberId });
    if (!row) throw bad(404, 'Member not found');
    const [family] = await loadFamilies([id]);
    res.json({ deleted: true, family: family || null });
  } catch (err) { fail(res, 'DELETE /families/:id/members/:memberId', err); }
});

/* ════════════════════════════════════════════════════════════════════
   One character's family
   ════════════════════════════════════════════════════════════════════ */

// Who "+ Add family" can pick: characters (their registry's and the cast's,
// anyone with a Pulse profile) and live LalaVerse Pulse profiles, each
// profile with the character it belongs to, if any.
router.get('/people', requireAuth, async (req, res) => {
  try {
    const c = req.query.character_id ? await characterRow(req.query.character_id) : null;
    const characters = await q(
      `SELECT rc.id, ${nameSql('rc')} AS name, rc.feed_profile_id, rc.portrait_url FROM registry_characters rc
        WHERE rc.deleted_at IS NULL AND (rc.feed_profile_id IS NOT NULL ${c ? 'OR rc.registry_id = :reg' : ''})
          ${c ? 'AND rc.id <> :id' : ''}
        ORDER BY 2 ASC LIMIT 400`, { reg: c?.registry_id, id: c?.id });
    const profiles = await q(
      `SELECT sp.id, COALESCE(NULLIF(sp.display_name, ''), sp.handle) AS name, sp.handle, rc.id AS registry_character_id
         FROM social_profiles sp
         ${LINKED_CHARACTER_JOIN}
        WHERE sp.deleted_at IS NULL AND sp.feed_layer::text = 'lalaverse' AND COALESCE(sp.status::text, '') <> 'archived'
        ORDER BY 2 ASC LIMIT 400`);
    res.json({ characters, profiles });
  } catch (err) { fail(res, 'GET /families/people', err); }
});

router.get('/character/:charId', requireAuth, async (req, res) => {
  try {
    res.json(await readout(req.params.charId));
  } catch (err) { fail(res, 'GET /families/character/:charId', err); }
});

/**
 * "+ Add family" (role reads "they are this character's <role>"):
 *   other_character_id  a character: the tie, and they join this character's family
 *   social_profile_id   a Pulse profile: its character's tie when it has one,
 *                       else the profile joins this character's family
 *   ghost_name          a name only: a ghost in this character's family
 */
router.post('/ties', ...ADMIN, async (req, res) => {
  try {
    const b = req.body || {};
    const c = await characterRow(b.character_id);
    if (!c) throw bad(404, 'Character not found');
    const role = text(b.role, 120);
    if (!role) throw bad(400, 'Give their role (sister, aunt, chosen family …)');
    if (ties.isSpouseRole(role)) throw bad(400, 'A partner or spouse is romance, not a family tie: add them as a relationship.');
    const kind = b.kind ? String(b.kind) : ties.kindOf(role);
    if (!ties.KINDS.includes(kind)) throw bad(400, `Kind must be one of ${ties.KINDS.join(', ')}`);

    let otherId = UUID_RE.test(String(b.other_character_id || '')) ? b.other_character_id : null;
    const profileId = intOrNull(b.social_profile_id);
    if (!otherId && profileId) {
      const [p] = await q(
        `SELECT sp.id, rc.id AS registry_character_id FROM social_profiles sp ${LINKED_CHARACTER_JOIN}
          WHERE sp.id = :id AND sp.deleted_at IS NULL`, { id: profileId });
      if (!p) throw bad(404, 'Pulse profile not found');
      otherId = p.registry_character_id || null;
    }
    let result = { tie_id: null, member_id: null, pulse: null };
    if (otherId) {
      if (!(await characterRow(otherId))) throw bad(404, 'Character not found');
      const saved = await ties.saveFamilyTie(getDb().sequelize, { fromId: otherId, toId: c.id, role, kind, notes: b.notes, tension: b.tension });
      result = { ...result, tie_id: saved.id, pulse: saved.pulse };
      // They join this character's family when it has one (chosen family stays a tie).
      const [familyId] = await familyIdsOf(c.id);
      if (familyId && kind !== 'chosen') result.member_id = await addMember(familyId, { registry_character_id: otherId, role, role_of_character_id: c.id });
    } else {
      const ghost = text(b.ghost_name, 200);
      if (!profileId && !ghost) throw bad(400, 'Pick someone or type a name');
      result.member_id = await getDb().sequelize.transaction(async (transaction) => {
        const familyId = await ensureFamilyOf(c, transaction);
        return addMember(familyId, { social_profile_id: profileId, ghost_name: profileId ? null : ghost, role, role_of_character_id: c.id, notes: b.notes }, transaction);
      });
    }
    res.status(201).json({ ...result, ...(await readout(c.id)) });
  } catch (err) { fail(res, 'POST /families/ties', err); }
});

// Take the family off a tie: a 'family' row is marked deleted; any other
// (a friendship that was also family) keeps its relationship.
router.delete('/ties/:relId', ...ADMIN, async (req, res) => {
  try {
    const { relId } = req.params;
    if (!UUID_RE.test(relId)) throw bad(404, 'Tie not found');
    const [row] = await q(
      `UPDATE character_relationships SET
          deleted_at = CASE WHEN relationship_type = 'family' THEN NOW() ELSE deleted_at END,
          family_role = NULL, reverse_family_role = NULL, family_kind = NULL, is_blood_relation = false,
          updated_at = NOW()
        WHERE id = :id AND deleted_at IS NULL RETURNING id`, { id: relId });
    if (!row) throw bad(404, 'Tie not found');
    res.json({ removed: true, id: relId });
  } catch (err) { fail(res, 'DELETE /families/ties/:relId', err); }
});

/**
 * "Make them a character": a family_tree member (tree_index) or a family
 * member who is a ghost or only a Pulse profile (member_id) becomes a
 * registry character in this character's registry, tied to them as family,
 * in one step. A profile's new character is linked to it
 * (feed_profile_id); a ghost's member row now names the character.
 */
router.post('/make-character', ...ADMIN, async (req, res) => {
  const sequelize = getDb().sequelize;
  try {
    const b = req.body || {};
    const c = await characterRow(b.character_id);
    if (!c) throw bad(404, 'Character not found');
    let name = text(b.name, 200);
    let role = text(b.role, 120);
    let member = null;
    let treeIndex = null;
    if (b.member_id) {
      if (!UUID_RE.test(String(b.member_id))) throw bad(404, 'Member not found');
      [member] = await q(`SELECT ${MEMBER_SELECT} FROM family_members fm ${MEMBER_JOIN} WHERE fm.id = :id AND fm.deleted_at IS NULL`, { id: b.member_id });
      if (!member) throw bad(404, 'Member not found');
      if (member.registry_character_id && member.character_name) throw bad(409, 'They are a character already');
      name = name || member.ghost_name || member.profile_name;
      role = role || member.role;
    } else if (b.tree_index != null) {
      treeIndex = intOrNull(b.tree_index);
      const m = (objOf(c.family_tree).members || [])[treeIndex];
      if (!m) throw bad(404, 'Family tree member not found');
      if (m.promoted_id) throw bad(409, 'They are a character already');
      name = name || text(m.name, 200);
      role = role || text(m.relation, 120);
    }
    if (!name) throw bad(400, 'Give them a name');
    if (!role) throw bad(400, 'Give their role (sister, aunt …)');
    if (ties.isSpouseRole(role)) throw bad(400, 'A partner or spouse is romance, not a family tie: add them as a relationship.');

    const out = await sequelize.transaction(async (transaction) => {
      // The key is the name's slug, numbered should their registry hold it.
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'family_member';
      const taken = await q(`SELECT character_key FROM registry_characters WHERE registry_id = :reg AND character_key LIKE :like`,
        { reg: c.registry_id, like: `${base}%` }, { transaction });
      const keys = new Set(taken.map((t) => t.character_key));
      let key = base;
      for (let n = 2; keys.has(key); n += 1) key = `${base}_${n}`;
      const g = ties.genderOfRole(role);
      const [made] = await q(
        `INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, depth_level,
            world, gender, feed_profile_id, created_from, created_at, updated_at)
         VALUES (gen_random_uuid(), :reg, :key, :name, :name, 'support', 'draft', 'sparked',
            :world, :gender, :profile, 'promote_ghost', NOW(), NOW()) RETURNING id`,
        { reg: c.registry_id, key, name, world: c.world || null, gender: g === 'f' ? 'female' : g === 'm' ? 'male' : null,
          profile: member && !member.registry_character_id && member.social_profile_id ? member.social_profile_id : null }, { transaction });
      if (member) {
        await run(`UPDATE family_members SET registry_character_id = :rc, ghost_name = NULL, updated_at = NOW() WHERE id = :id`,
          { rc: made.id, id: member.id }, { transaction });
      }
      if (treeIndex != null) {
        // Marked in the JSON under a row lock, as promote-ghost does.
        const [locked] = await q('SELECT family_tree FROM registry_characters WHERE id = :id FOR UPDATE', { id: c.id }, { transaction });
        const tree = objOf(locked.family_tree);
        tree.members = (tree.members || []).map((m, i) => (i === treeIndex ? { ...m, promoted: true, promoted_id: made.id } : m));
        await run('UPDATE registry_characters SET family_tree = CAST(:tree AS jsonb), updated_at = NOW() WHERE id = :id',
          { tree: JSON.stringify(tree), id: c.id }, { transaction });
      }
      return made;
    });
    const saved = await ties.saveFamilyTie(sequelize, { fromId: out.id, toId: c.id, role, kind: b.kind || undefined });
    if (!member) {
      const [familyId] = await familyIdsOf(c.id);
      if (familyId) await addMember(familyId, { registry_character_id: out.id, role, role_of_character_id: c.id });
    }
    res.status(201).json({ character: { id: out.id, name }, tie_id: saved.id, pulse: saved.pulse, ...(await readout(c.id)) });
  } catch (err) { fail(res, 'POST /families/make-character', err); }
});

/**
 * "Import family", once: their family_tree JSON's members become a named
 * family. A member whose name matches a character in their registry joins as
 * that character, with the family tie; anyone else joins as a ghost. The
 * JSON is marked imported (imported_at, imported_family_id) so it is not
 * imported twice.
 */
router.post('/import/:charId', ...ADMIN, async (req, res) => {
  const sequelize = getDb().sequelize;
  try {
    const c = await characterRow(req.params.charId);
    if (!c) throw bad(404, 'Character not found');
    const tree = await treeOf(c);
    if (tree.imported_at) throw bad(409, 'Their family tree was imported already');
    if (!tree.members.length) throw bad(400, 'Their family tree has no one in it');
    const matched = [];
    const familyId = await sequelize.transaction(async (transaction) => {
      const [locked] = await q('SELECT family_tree FROM registry_characters WHERE id = :id FOR UPDATE', { id: c.id }, { transaction });
      const json = objOf(locked.family_tree);
      if (json.imported_at) throw bad(409, 'Their family tree was imported already');
      const fid = await ensureFamilyOf(c, transaction);
      for (const m of tree.members) {
        if (!m.name) continue;
        if (m.matched_character_id) {
          await addMember(fid, { registry_character_id: m.matched_character_id, role: m.relation, role_of_character_id: c.id }, transaction);
          if (m.relation && !ties.isSpouseRole(m.relation)) matched.push(m);
        } else {
          await addMember(fid, { ghost_name: m.name, role: m.relation, role_of_character_id: c.id, notes: m.sketch }, transaction);
        }
      }
      await run('UPDATE registry_characters SET family_tree = CAST(:tree AS jsonb), updated_at = NOW() WHERE id = :id',
        { tree: JSON.stringify({ ...json, imported_at: new Date().toISOString(), imported_family_id: fid }), id: c.id }, { transaction });
      return fid;
    });
    for (const m of matched) {
      await ties.saveFamilyTie(sequelize, { fromId: m.matched_character_id, toId: c.id, role: m.relation });
    }
    res.status(201).json({ family_id: familyId, imported: tree.members.length, tied: matched.length, ...(await readout(c.id)) });
  } catch (err) { fail(res, 'POST /families/import/:charId', err); }
});

/**
 * A Pulse profile's family: its 'family' Pulse links (social_profile_
 * relationships), each with the role from the two characters' tie when they
 * have one, and the people in the named families it (or its character) is in.
 * [{ name, role, kind, profile_id, character_id, family }]
 */
router.get('/profile/:profileId', requireAuth, async (req, res) => {
  try {
    const pid = intOrNull(req.params.profileId);
    if (!pid) throw bad(404, 'Pulse profile not found');
    const link = LINKED_CHARACTER_JOIN;
    const [me] = await q(`SELECT sp.id, rc.id AS character_id FROM social_profiles sp ${link} WHERE sp.id = :id AND sp.deleted_at IS NULL`, { id: pid });
    if (!me) throw bad(404, 'Pulse profile not found');
    const people = [];
    const seen = new Set();
    const add = (p) => {
      const k = p.character_id ? `c:${p.character_id}` : p.profile_id ? `p:${p.profile_id}` : `g:${p.name}`;
      if (seen.has(k) || (me.character_id && String(p.character_id) === String(me.character_id)) || Number(p.profile_id) === pid) return;
      seen.add(k);
      people.push(p);
    };
    const myTies = me.character_id ? await tiesOf(me.character_id) : [];
    const links = await q(
      `SELECT spr.id, spr.description, other.id AS profile_id, COALESCE(NULLIF(other.display_name, ''), other.handle) AS profile_name,
              rc.id AS character_id, ${nameSql('rc')} AS character_name
         FROM social_profile_relationships spr
         JOIN social_profiles other ON other.deleted_at IS NULL
          AND other.id = CASE WHEN spr.source_profile_id = :id THEN spr.target_profile_id ELSE spr.source_profile_id END
         ${link.replace(/sp\.id/g, 'other.id')}
        WHERE spr.relationship_type = 'family' AND (spr.source_profile_id = :id OR spr.target_profile_id = :id)
        ORDER BY spr.created_at ASC`, { id: pid });
    for (const l of links) {
      const tie = l.character_id ? myTies.find((t) => String(t.other_id) === String(l.character_id)) : null;
      add({ name: l.character_name || l.profile_name, role: tie?.role || null, kind: tie?.kind || null, profile_id: l.profile_id, character_id: l.character_id || null, note: tie ? null : (l.description || null), family: null });
    }
    // Their ties with people who have no Pulse link yet still count as family.
    for (const t of myTies) add({ name: t.other_name, role: t.role, kind: t.kind, profile_id: t.other_profile_id, character_id: t.other_id, note: null, family: null });
    const fams = await q(
      `SELECT DISTINCT fm.family_id FROM family_members fm
        WHERE fm.deleted_at IS NULL AND (fm.social_profile_id = :id ${me.character_id ? 'OR fm.registry_character_id = :cid' : ''})`,
      { id: pid, cid: me.character_id });
    for (const f of await loadFamilies(fams.map((r) => r.family_id))) {
      for (const m of f.members) {
        add({ name: m.name, role: m.role_of_name && m.role ? `${m.role_of_name}'s ${m.role}` : m.role, kind: null, profile_id: m.social_profile_id, character_id: m.registry_character_id, note: null, family: f.name });
      }
    }
    res.json({ profile_id: pid, character_id: me.character_id || null, family: people });
  } catch (err) { fail(res, 'GET /families/profile/:profileId', err); }
});

module.exports = router;
module.exports.familyNameFor = familyNameFor;
