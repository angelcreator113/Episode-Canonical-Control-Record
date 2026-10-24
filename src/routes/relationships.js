'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

const { requireAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');
// Every write here is ADMIN only; the reads stay requireAuth (Evoni, 2026-10-19:
// "this whole part of the site is admin only").
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
// The story pair is the truth; its Pulse pair follows it (services/relationshipTruth).
const truth = require('../services/relationshipTruth');
// Which Lala, the same one the writers use (services/whichLala).
const whichLala = require('../services/whichLala');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Lazy-load models / sequelize ───────────────────────────────────────
let _db = null;
function getDb() {
  if (!_db) _db = require('../models');
  return _db;
}

// ── Column SELECT helpers ──────────────────────────────────────────────
// A row counts while deleted_at is empty: Delete sets it (so the pair's
// relationship_events history stays) and Undo clears it.
const LIVE = 'cr.deleted_at IS NULL';

// The latest stage on the pair's timeline (relationship_events), e.g.
// "flirting"; null before anything has happened between them.
const REL_SELECT = `
  cr.id, cr.character_id_a, cr.character_id_b,
  cr.relationship_type, cr.connection_mode, cr.lala_connection,
  cr.status, cr.notes, cr.situation, cr.tension_state,
  cr.pain_point_category, cr.lala_mirror, cr.career_echo_potential,
  cr.confirmed, cr.role_tag,
  cr.family_role, cr.is_blood_relation, cr.is_romantic,
  cr.family_kind, cr.reverse_family_role,
  cr.conflict_summary, cr.knows_about_connection,
  cr.source_knows, cr.target_knows, cr.reader_knows,
  cr.known_by, cr.public_state,
  cr.seed_source, cr.seed_why, cr.seed_basis, cr.seed_state,
  cr.dismiss_reason, cr.dismiss_note, cr.seed_aim,
  cr.created_at, cr.updated_at,
  (SELECT re.relationship_stage FROM relationship_events re
    WHERE re.relationship_id = cr.id AND re.deleted_at IS NULL AND re.relationship_stage IS NOT NULL
    ORDER BY re.created_at DESC LIMIT 1) AS stage`;

const CHAR_JOIN = `
  JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
  JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL`;

// One name per person everywhere: the chosen name, else the display name
// (which is often the feed handle, e.g. "Truthville" for Marcus Hale).
const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;

const CHAR_SELECT_A = `
  ${nameSql('ca')} AS character_a_name, ca.display_name AS character_a_display, ca.selected_name AS character_a_selected,
  ca.role_type AS character_a_type, ca.role_label AS character_a_role_label,
  ca.appearance_mode AS character_a_appearance, ca.icon AS character_a_icon,
  ca.portrait_url AS character_a_portrait`;

const CHAR_SELECT_B = `
  ${nameSql('cb')} AS character_b_name, cb.display_name AS character_b_display, cb.selected_name AS character_b_selected,
  cb.role_type AS character_b_type, cb.role_label AS character_b_role_label,
  cb.appearance_mode AS character_b_appearance, cb.icon AS character_b_icon,
  cb.portrait_url AS character_b_portrait`;

const SPOUSE_ROLES = new Set(['wife', 'husband', 'spouse', 'partner', 'ex-wife', 'ex-husband', 'ex-partner', 'fiancé', 'fiancée', 'fiance', 'fiancee']);

// What PUT /:relId writes, each with the value an empty field becomes. The
// family role is not here: it is written with the role read the other way
// and its kind, only by PUT /:relId/family and services/familyTies (an
// Inspector Save sent the whole form and put back a role the Family tab had
// just changed, 2026-10-24 audit).
const EDITABLE = {
  relationship_type: null, connection_mode: 'IRL', lala_connection: 'none', status: 'Active',
  notes: null, situation: null, tension_state: null, pain_point_category: null,
  lala_mirror: null, career_echo_potential: null,
  conflict_summary: null, source_knows: null, target_knows: null, reader_knows: null,
};

// A family role that is not a partner's: the pair is family, so not a romance.
const isFamilyOnlyRole = (role) => Boolean(role && String(role).trim() && !SPOUSE_ROLES.has(String(role).trim().toLowerCase()));
const FAMILY_NOT_ROMANCE = (role) => `They are family (${role}), so this cannot be a romance. Change the family role on the Family tab first.`;

// Why an AI call failed, in words for the page's toast: the day's AI budget
// (services/aiCostTracker), the account's credit, the rate limit, or the
// service itself. Both generators answer the same way.
function aiFailure(res, aiErr, what) {
  const errMsg = aiErr?.message || String(aiErr);
  console.error(`Claude API error (${what}):`, errMsg);
  if (aiErr?.code === 'AI_BUDGET_EXCEEDED') {
    return res.status(429).json({ error: `Today's AI budget is used up, so ${what} cannot run until tomorrow. ${errMsg}`, code: 'AI_BUDGET_EXCEEDED' });
  }
  if (errMsg.includes('credit balance') || errMsg.includes('billing') || aiErr?.status === 402) {
    return res.status(402).json({ error: `AI credits exhausted. Please top up your Anthropic account to use ${what}.` });
  }
  if (errMsg.includes('rate') || aiErr?.status === 429) {
    return res.status(429).json({ error: 'AI rate limit reached. Please wait a moment and try again.' });
  }
  return res.status(502).json({ error: 'AI service unavailable. ' + errMsg.slice(0, 200) });
}

/**
 * The cast this page works with (Evoni, 2026-10-16: "only use the 6 cast
 * members we have outside of Lala"): the registry characters a live
 * LalaVerse feed profile names (registry_characters.feed_profile_id, ruling
 * C3), and Lala, from the registry holding most of them. The page and the
 * generators read the same list, across every registry.
 */
async function loadCastIds(db) {
  const links = await whichLala.castLinks(db);
  const ids = new Set(links.map((r) => String(r.id)));
  // Each registry can hold its own Lala; one is enough (services/whichLala's rule).
  const lala = await whichLala.findLala(db, { links });
  if (lala) ids.add(String(lala.id));
  return { ids: [...ids], lalaId: lala ? String(lala.id) : null };
}

/** The cast's characters (with what the generators read), Lala first. */
async function loadCastCharacters(db, { forAI = false } = {}) {
  const { ids, lalaId } = await loadCastIds(db);
  if (!ids.length) return { characters: [], lalaId };
  const characters = await db.sequelize.query(
    `SELECT id, registry_id, display_name, selected_name, character_key, icon,
            role_type, role_label, appearance_mode, status,
            core_belief, pressure_type, description,
            belief_pressured, emotional_function, personality,
            portrait_url, sort_order, feed_profile_id
       FROM registry_characters
      WHERE id IN (:ids) AND deleted_at IS NULL
        ${forAI ? `AND ${require('../utils/confidentialCharacters').notConfidentialSql('')}` : ''}
      ORDER BY sort_order ASC, display_name ASC`,
    { replacements: { ids }, type: db.sequelize.QueryTypes.SELECT }
  );
  characters.sort((a, b) => (String(b.id) === lalaId) - (String(a.id) === lalaId));
  return { characters, lalaId };
}

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships
// All confirmed relationships, optionally filtered by ?character_id=
// ════════════════════════════════════════════════════════════════════════
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { character_id } = req.query;

    let where = `WHERE cr.confirmed = true AND ${LIVE}`;
    const replacements = {};
    if (character_id) {
      where += ' AND (cr.character_id_a = :char_id OR cr.character_id_b = :char_id)';
      replacements.char_id = character_id;
    }

    const rows = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       ${where}
       ORDER BY cr.created_at DESC`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    );

    res.json({ relationships: rows, count: rows.length });
  } catch (err) {
    console.error('GET /relationships error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships/character/:charId
// All relationships (confirmed + pending) for a single character;
// ?confirmed=true for confirmed ones only (the Character Profile, Task #3119).
// Each row also names the other character: related_id, related_name, related_portrait.
// ════════════════════════════════════════════════════════════════════════
router.get('/character/:charId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { charId } = req.params;
    const confirmedOnly = req.query.confirmed === 'true';

    const rows = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE (cr.character_id_a = :char_id OR cr.character_id_b = :char_id)
         AND ${LIVE}
         ${confirmedOnly ? 'AND cr.confirmed = true' : ''}
       ORDER BY cr.confirmed DESC, cr.created_at DESC`,
      { replacements: { char_id: charId }, type: db.sequelize.QueryTypes.SELECT }
    );
    const withOther = rows.map((r) => {
      const isA = r.character_id_a === charId;
      return {
        ...r,
        related_id: isA ? r.character_id_b : r.character_id_a,
        related_name: isA ? r.character_b_name : r.character_a_name,
        // Their portrait, for the character page's Connections (2026-10-18).
        related_portrait: (isA ? r.character_b_portrait : r.character_a_portrait) || null,
      };
    });

    res.json({ relationships: withOther, count: withOther.length });
  } catch (err) {
    console.error('GET /relationships/character/:charId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships/cast
// What the Relationships page shows: the cast (loadCastIds, across every
// registry, so a pair split across two registries still shows), their
// confirmed relationships with each other and the seeds still pending.
// Every tab reads these same pairs.
// ════════════════════════════════════════════════════════════════════════
router.get('/cast', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { characters, lalaId } = await loadCastCharacters(db);
    const ids = characters.map((c) => c.id);
    let rows = [];
    if (ids.length) {
      rows = await db.sequelize.query(
        `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
         FROM character_relationships cr ${CHAR_JOIN}
         WHERE cr.character_id_a IN (:ids) AND cr.character_id_b IN (:ids) AND ${LIVE}
         ORDER BY cr.updated_at DESC`,
        { replacements: { ids }, type: db.sequelize.QueryTypes.SELECT }
      );
    }
    res.json({
      characters,
      lala_id: lalaId,
      relationships: rows.filter((r) => r.confirmed),
      candidates: rows.filter((r) => !r.confirmed),
    });
  } catch (err) {
    console.error('GET /relationships/cast error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships/:relId/events
// The story so far between two people, oldest first: each event's stage
// (and the stage before it), tension before and after, the beat, the note,
// the script's quote, and the episode it happened in (metadata.episode_id,
// written when an episode's story record is saved).
// ════════════════════════════════════════════════════════════════════════
router.get('/:relId/events', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    if (!UUID_RE.test(relId)) return res.status(404).json({ error: 'Relationship not found' });
    const [rel] = await db.sequelize.query(
      `SELECT id FROM character_relationships cr WHERE cr.id = :id AND ${LIVE}`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });
    const rows = await db.sequelize.query(
      `SELECT re.id, re.event_type, re.title, re.description, re.story_date,
              re.tension_before, re.tension_after, re.relationship_stage,
              re.metadata, re.created_at,
              e.id AS episode_id, e.episode_number, COALESCE(e.episode_title, e.title) AS episode_title
         FROM relationship_events re
         LEFT JOIN episodes e
           ON e.id::text = re.metadata->>'episode_id' AND e.deleted_at IS NULL
        WHERE re.relationship_id = :id AND re.deleted_at IS NULL
        ORDER BY re.created_at ASC`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT }
    );
    const events = rows.map(({ metadata, ...r }) => {
      const m = metadata && typeof metadata === 'object' ? metadata : {};
      const beat = Number.parseInt(m.beat, 10);
      return {
        ...r,
        stage_before: m.stage_before || null,
        beat: Number.isFinite(beat) ? beat : null,
        quote: typeof m.quote === 'string' && m.quote.trim() ? m.quote.trim() : null,
      };
    });
    res.json({ events });
  } catch (err) {
    console.error('GET /relationships/:id/events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/v1/relationships
// Manually create a confirmed relationship
// ════════════════════════════════════════════════════════════════════════
router.post('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const {
      character_id_a,
      character_id_b,
      relationship_type,
      connection_mode      = 'IRL',
      lala_connection      = 'none',
      status               = 'Active',
      notes                = null,
      situation            = null,
      tension_state        = null,
      pain_point_category  = null,
      lala_mirror          = null,
      career_echo_potential = null,
      confirmed            = true,
      is_romantic          = false,
    } = req.body;

    if (!character_id_a || !character_id_b || !relationship_type) {
      return res.status(400).json({
        error: 'character_id_a, character_id_b, and relationship_type are required',
      });
    }
    if (character_id_a === character_id_b) {
      return res.status(400).json({ error: 'A character cannot have a relationship with themselves' });
    }

    const [charA] = await db.sequelize.query(
      'SELECT id FROM registry_characters WHERE id = :id',
      { replacements: { id: character_id_a }, type: db.sequelize.QueryTypes.SELECT }
    );
    const [charB] = await db.sequelize.query(
      'SELECT id FROM registry_characters WHERE id = :id',
      { replacements: { id: character_id_b }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!charA || !charB) {
      return res.status(404).json({ error: 'One or both characters not found' });
    }

    // A family type (Add's Mother, Sister …, or one typed) reads "A is B's
    // <type>" and is saved as the Family tab saves a tie (services/
    // familyTies): both directions, its kind, and the Pulse family link, so
    // it shows on the Family tab and tree, the character page's family and
    // the writers' family lines. It made a plain row before (2026-10-24 audit).
    const familyTies = require('../services/familyTies');
    const asRole = String(relationship_type).trim();
    if (!familyTies.isSpouseRole(asRole) && familyTies.reverseRole(asRole) !== null) {
      if (is_romantic === true) return res.status(409).json({ error: FAMILY_NOT_ROMANCE(asRole) });
      const given = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      let saved;
      try {
        saved = await familyTies.saveFamilyTie(db.sequelize, {
          fromId: character_id_a, toId: character_id_b, role: asRole, notes: given(notes), tension: given(tension_state),
        });
      } catch (tieErr) {
        if (tieErr.status) return res.status(tieErr.status).json({ error: tieErr.message });
        throw tieErr;
      }
      // The rest of what Add sent, where it says something (a tie reused
      // from the Family tab keeps what it had for anything left empty).
      const extra = { connection_mode, lala_connection, status, situation, pain_point_category, lala_mirror, career_echo_potential };
      const sent = Object.keys(extra).filter((k) => req.body[k] !== undefined && given(extra[k]) !== undefined);
      if (sent.length) {
        await db.sequelize.query(
          `UPDATE character_relationships SET ${sent.map((k) => `${k} = :${k}`).join(', ')}, updated_at = NOW() WHERE id = :id`,
          { replacements: { id: saved.id, ...Object.fromEntries(sent.map((k) => [k, given(extra[k])])) } });
      }
      const [tie] = await db.sequelize.query(
        `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
         FROM character_relationships cr ${CHAR_JOIN}
         WHERE cr.id = :id`,
        { replacements: { id: saved.id }, type: db.sequelize.QueryTypes.SELECT }
      );
      const pulse = await truth.afterStorySave(db, saved.id);
      return res.status(201).json({ relationship: tie, family: true, created: saved.created, pulse });
    }

    // ── Duplicate check (bidirectional; a deleted one does not count) ──
    const [existing] = await db.sequelize.query(
      `SELECT id FROM character_relationships
       WHERE relationship_type = :rel_type AND deleted_at IS NULL
         AND (
           (character_id_a = :char_a AND character_id_b = :char_b)
           OR
           (character_id_a = :char_b AND character_id_b = :char_a)
         )
       LIMIT 1`,
      {
        replacements: { char_a: character_id_a, char_b: character_id_b, rel_type: relationship_type },
        type: db.sequelize.QueryTypes.SELECT,
      }
    );
    if (existing) {
      return res.status(409).json({
        error: `A "${relationship_type}" relationship already exists between these characters`,
      });
    }

    const now = new Date();

    // The unique index (a, b, type) counts a deleted row: that one comes
    // back with the new fields (its timeline with it).
    const [row] = await db.sequelize.query(
      `INSERT INTO character_relationships
         (id, character_id_a, character_id_b, relationship_type,
          connection_mode, lala_connection, status, notes,
          situation, tension_state, pain_point_category,
          lala_mirror, career_echo_potential, confirmed, is_romantic,
          created_at, updated_at)
       VALUES
         (:id, :char_a, :char_b, :rel_type,
          :conn_mode, :lala_conn, :status, :notes,
          :situation, :tension_state, :pain_cat,
          :lala_mirror, :career_echo, :confirmed, :is_romantic,
          :now, :now)
       ON CONFLICT (character_id_a, character_id_b, relationship_type) DO UPDATE SET
          connection_mode = EXCLUDED.connection_mode, lala_connection = EXCLUDED.lala_connection,
          status = EXCLUDED.status, notes = EXCLUDED.notes, situation = EXCLUDED.situation,
          tension_state = EXCLUDED.tension_state, pain_point_category = EXCLUDED.pain_point_category,
          lala_mirror = EXCLUDED.lala_mirror, career_echo_potential = EXCLUDED.career_echo_potential,
          confirmed = EXCLUDED.confirmed, is_romantic = EXCLUDED.is_romantic,
          deleted_at = NULL, updated_at = EXCLUDED.updated_at
       RETURNING id`,
      {
        replacements: {
          id: uuidv4(), char_a: character_id_a, char_b: character_id_b,
          rel_type: relationship_type, conn_mode: connection_mode || 'IRL',
          lala_conn: lala_connection || 'none', status: status || 'Active', notes,
          situation: situation || null, tension_state: tension_state || null, pain_cat: pain_point_category || null,
          lala_mirror, career_echo: career_echo_potential,
          confirmed, is_romantic: is_romantic === true, now,
        },
        type: db.sequelize.QueryTypes.SELECT,
      }
    );
    const { id } = row;

    const [created] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id`,
      { replacements: { id }, type: db.sequelize.QueryTypes.SELECT }
    );

    const pulse = await truth.afterStorySave(db, id);
    res.status(201).json({ relationship: created, pulse });
  } catch (err) {
    console.error('POST /relationships error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// Seeds (services/relationshipSeeds; Evoni, 2026-10-24: "How can we
// improve relationship seeds", then "I want them all"). A seed is an
// unconfirmed row; it says where it came from (seed_source), why
// (seed_why, seed_basis) and what Generate was aimed at (seed_aim).
// ════════════════════════════════════════════════════════════════════════
const seeds = require('../services/relationshipSeeds');

/** The seed rows by id, in that order, as every read returns them. */
async function seedRows(db, ids) {
  if (!ids.length) return [];
  const rows = await db.sequelize.query(
    `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
     FROM character_relationships cr ${CHAR_JOIN}
     WHERE cr.id IN (:ids)`,
    { replacements: { ids }, type: db.sequelize.QueryTypes.SELECT }
  );
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

const seedError = (res, err, what) => {
  if (err instanceof seeds.SeedError) return res.status(err.status).json({ error: err.message });
  console.error(`${what} error:`, err);
  return res.status(500).json({ error: err.message });
};

/**
 * Generate, grounded on the story (services/seedContext): the approved
 * episode records, open threads, season twists, who knows, family, the
 * confirmed pairs, the Pulse, and what Evoni turned down. Aimed by kind, a
 * focus person, an episode (its guests) or a twist to pay off. The answer's
 * error, if the AI fails, is aiFailure's; `what` names the button.
 */
async function generateAndRespond(req, res, { body, what, shape }) {
  const db = getDb();
  const { characters, lalaId } = await loadCastCharacters(db, { forAI: true });
  if (characters.length < 2) {
    return res.status(400).json({ error: `Need at least 2 people in the cast to ${what === 'Propose Family' ? 'generate family' : 'generate relationships'}` });
  }
  let made;
  try {
    made = await seeds.generateSeeds(db, body, { characters, lalaId });
  } catch (err) {
    if (err instanceof seeds.SeedError) return res.status(err.status).json({ error: err.message });
    if (!err?.fromAI) throw err;
    return aiFailure(res, err, what);
  }
  const rows = await seedRows(db, made.ids);
  return res.status(201).json(shape(rows, made.skipped));
}

// POST /api/v1/relationships/generate
// Body { focus_character_id?, kind?, episode_id?, twist_id?, count?: 3..8 }.
router.post('/generate', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    await generateAndRespond(req, res, {
      body: req.body || {}, what: 'Generate',
      shape: (rows, skipped) => ({ candidates: rows, count: rows.length, skipped, message: `Generated ${rows.length} candidate relationship(s)` }),
    });
  } catch (err) {
    console.error('POST /relationships/generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/relationships/confirm-all
// Body { ids: [uuid…] } (at most 50): each confirmed as it is, by the rules
// Confirm keeps. One refused leaves the others: { confirmed, refused }.
router.post('/confirm-all', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const { confirmed, refused } = await seeds.confirmMany(db, req.body?.ids);
    const rows = await seedRows(db, confirmed.map((c) => c.id));
    res.json({ confirmed: rows, refused });
  } catch (err) { seedError(res, err, 'POST /relationships/confirm-all'); }
});

// POST /api/v1/relationships/confirm/:relationshipId
// Confirm a seed, with the Inspector's edits when sent (relationship_type,
// connection_mode, status, tension_state, situation, pain_point_category,
// lala_connection, notes, is_romantic, family_role), in one transaction: a
// romance with a family role that is not a partner's is refused (409); a
// family type becomes a family tie, both directions (services/familyTies).
// Its Pulse pair follows. { relationship, pulse }.
router.post('/confirm/:relationshipId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const done = await seeds.confirmSeed(db, req.params.relationshipId, req.body || {});
    const [row] = await seedRows(db, [done.id]);
    if (!row) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ relationship: row, message: 'Candidate confirmed', pulse: done.pulse, ...(done.family ? { family: true } : {}) });
  } catch (err) { seedError(res, err, 'POST /relationships/confirm/:id'); }
});

// POST /api/v1/relationships/:relId/seed-state
// Body { state: 'kept' | null }: "Keep as idea", or "Bring back" (from kept
// or later). Unconfirmed live rows only; otherwise 409.
router.post('/:relId/seed-state', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const state = req.body?.state === undefined ? undefined : req.body.state;
    if (state === undefined) return res.status(400).json({ error: "state must be 'kept' or null" });
    await seeds.setSeedState(db, req.params.relId, state);
    const [row] = await seedRows(db, [req.params.relId]);
    res.json({ relationship: row || null });
  } catch (err) { seedError(res, err, 'POST /relationships/:id/seed-state'); }
});

// POST /api/v1/relationships/seeds
// Body { source: 'scene'|'pulse'|'manual', seeds: [{ character_id_a,
// character_id_b, relationship_type, situation?, is_romantic?, seed_why?,
// seed_basis? }] } (at most 20): the scene banner's and the Pulse's
// suggestions land in Seeds. A pair already there is skipped, as Generate
// skips it. 201 { candidates, skipped: [{ index, code, why }] }.
router.post('/seeds', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const made = await seeds.createSeeds(db, req.body || {});
    res.status(201).json({ candidates: await seedRows(db, made.ids), skipped: made.skipped });
  } catch (err) { seedError(res, err, 'POST /relationships/seeds'); }
});

// ════════════════════════════════════════════════════════════════════════
// Tidy up the types (services/relationshipTypeTidy; Evoni, 2026-10-24:
// "Yes tidy up existing relationships"). GET proposes a list type for each
// live relationship or seed whose type the app does not know (no AI); POST
// saves the changes she accepted, in one transaction, by PUT's rules.
// Registered before GET /:relId, which would take the path otherwise.
// ════════════════════════════════════════════════════════════════════════
const typeTidy = require('../services/relationshipTypeTidy');

router.get('/type-tidy', requireAuth, async (req, res) => {
  try {
    res.json(await typeTidy.proposals(getDb()));
  } catch (err) {
    console.error('GET /relationships/type-tidy error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/type-tidy', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    res.json(await typeTidy.applyTidy(getDb(), req.body?.changes));
  } catch (err) {
    if (err instanceof typeTidy.TidyError) return res.status(err.status).json({ error: err.message });
    console.error('POST /relationships/type-tidy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/relationships/dismiss/:relationshipId
// Dismiss an unconfirmed seed, with Evoni's reason (body { reason, note },
// both optional). "Too soon" does not delete it: it is put off for later
// (seed_state 'later') → { later: true, relationship }. Any other reason, or
// none, marks it deleted with the reason, as before → { dismissed: true };
// POST /:relId/restore is its Undo. Generate's skip rule reads the reason
// (services/relationshipSeeds).
// ════════════════════════════════════════════════════════════════════════
router.delete('/dismiss/:relationshipId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const done = await seeds.dismissSeed(db, req.params.relationshipId, req.body || {});
    if (done.later) {
      const [row] = await seedRows(db, [req.params.relationshipId]);
      return res.json({ later: true, relationship: row || null });
    }
    res.json({ dismissed: true });
  } catch (err) { seedError(res, err, 'DELETE /relationships/dismiss/:id'); }
});
// ════════════════════════════════════════════════════════════════════════
// PUT /api/v1/relationships/:relId
// Update mutable fields on a relationship
// ════════════════════════════════════════════════════════════════════════
router.put('/:relId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    if (!UUID_RE.test(relId)) return res.status(404).json({ error: 'Relationship not found' });

    // A field sent is written: an empty value clears it (Evoni can empty a
    // situation or a tension). A field not sent stays as it is. The four
    // required columns go back to their defaults when emptied, except the
    // type, which a relationship cannot be without.
    const body = req.body || {};
    if (body.relationship_type !== undefined && !String(body.relationship_type || '').trim()) {
      return res.status(400).json({ error: 'A relationship needs a type' });
    }
    const sets = [];
    const replacements = { id: relId };
    for (const k of Object.keys(EDITABLE)) {
      if (body[k] === undefined) continue;
      const v = body[k];
      const text = typeof v === 'string' ? v.trim() : v;
      replacements[k] = text === '' || text == null ? EDITABLE[k] : text;
      sets.push(`${k} = :${k}`);
    }
    if (body.is_romantic !== undefined) {
      replacements.is_romantic = body.is_romantic === true || body.is_romantic === 'true';
      // The rule PUT /:relId/family keeps, the other way: family (a mother,
      // a sister) does not become a romance. One already romantic is left
      // to the drift report, so its other fields can still be saved.
      if (replacements.is_romantic) {
        const [current] = await db.sequelize.query(
          'SELECT is_romantic, family_role FROM character_relationships WHERE id = :id AND deleted_at IS NULL',
          { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT });
        if (!current) return res.status(404).json({ error: 'Relationship not found' });
        if (!current.is_romantic && isFamilyOnlyRole(current.family_role)) {
          return res.status(409).json({ error: FAMILY_NOT_ROMANCE(current.family_role) });
        }
      }
      sets.push('is_romantic = :is_romantic');
    }
    // Who knows about it and where everyone else stands (services/relationshipKnowers).
    const knowers = await require('../services/relationshipKnowers').knowersPatch(db.sequelize, relId, body);
    sets.push(...knowers.sets);
    Object.assign(replacements, knowers.replacements);

    const [, meta] = await db.sequelize.query(
      `UPDATE character_relationships
       SET ${sets.map((x) => `${x}, `).join('')}updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { replacements }
    );
    if (!(meta?.rowCount)) return res.status(404).json({ error: 'Relationship not found' });

    const [updated] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id AND ${LIVE}`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT }
    );

    if (!updated) return res.status(404).json({ error: 'Relationship not found' });
    const pulse = await truth.afterStorySave(db, relId);
    res.json({ relationship: updated, pulse });
  } catch (err) {
    console.error('PUT /relationships/:id error:', err);
    if (err.name === 'KnowerError') return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/relationships/:relId
// Remove a relationship: it is marked deleted, so its relationship_events
// (the story so far) stay, and POST /:relId/restore brings it back.
// Its Pulse pair stays, still linked (pulse_kept names it): it is The
// Pulse's own record (its kind, who sees it, its description, often older
// than the story pair), the table has no deleted_at, so taking it off could
// not be undone, and Undo finds the link where it was. The drift report
// lists it ("Story pair deleted") with "take them off The Pulse" as its fix.
// ════════════════════════════════════════════════════════════════════════
router.delete('/:relId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    if (!UUID_RE.test(req.params.relId)) return res.status(404).json({ error: 'Relationship not found' });
    const [, meta] = await db.sequelize.query(
      'UPDATE character_relationships SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND deleted_at IS NULL',
      { replacements: { id: req.params.relId } }
    );
    if (!(meta?.rowCount)) return res.status(404).json({ error: 'Relationship not found' });
    const kept = await db.sequelize.query(
      'SELECT id FROM social_profile_relationships WHERE character_relationship_id = :id ORDER BY id',
      { replacements: { id: req.params.relId }, type: db.sequelize.QueryTypes.SELECT }
    );
    res.json({ deleted: true, id: req.params.relId, pulse_kept: kept.map((r) => r.id) });
  } catch (err) {
    console.error('DELETE /relationships/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/v1/relationships/:relId/restore
// Undo a delete, or a seed's dismiss (it comes back a seed), or bring back
// a seed put off as "too soon": either way its seed state and dismiss
// reason are cleared, so it is pending again.
// ════════════════════════════════════════════════════════════════════════
router.post('/:relId/restore', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    if (!UUID_RE.test(relId)) return res.status(404).json({ error: 'Relationship not found' });
    const [, meta] = await db.sequelize.query(
      `UPDATE character_relationships
          SET deleted_at = NULL, seed_state = NULL, dismiss_reason = NULL, dismiss_note = NULL, updated_at = NOW()
        WHERE id = :id AND (deleted_at IS NOT NULL OR (confirmed = false AND seed_state = 'later'))`,
      { replacements: { id: relId } }
    );
    if (!(meta?.rowCount)) return res.status(404).json({ error: 'No deleted relationship to restore' });
    const [row] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id AND ${LIVE}`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT }
    );
    // Its Pulse pair is linked still (DELETE keeps it); one it never had is made now.
    const pulse = row?.confirmed ? await truth.afterStorySave(db, relId) : null;
    res.json({ relationship: row || null, pulse });
  } catch (err) {
    console.error('POST /relationships/:id/restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// PUT /api/v1/relationships/:relId/family
// Set family role + blood relation flag on an existing relationship
// ════════════════════════════════════════════════════════════════════════
router.put('/:relId/family', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    const { family_role, is_blood_relation, is_romantic, conflict_summary, family_kind } = req.body;
    if (!UUID_RE.test(relId)) return res.status(404).json({ error: 'Relationship not found' });

    const [current] = await db.sequelize.query(
      `SELECT cr.id, cr.is_romantic, cb.gender AS b_gender, cb.pronouns AS b_pronouns FROM character_relationships cr
         LEFT JOIN registry_characters cb ON cb.id = cr.character_id_b
        WHERE cr.id = :id AND ${LIVE}`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!current) return res.status(404).json({ error: 'Relationship not found' });
    // A love interest is not family: the Family tab's edit wrote "mother"
    // onto Lala and Marcus (2026-10-23 audit). A spouse or partner role is
    // the one family role a romantic relationship can carry.
    const role = typeof family_role === 'string' ? family_role.trim() : family_role;
    const romantic = is_romantic != null ? is_romantic === true : current.is_romantic;
    if (role && romantic && !SPOUSE_ROLES.has(String(role).toLowerCase())) {
      return res.status(400).json({ error: 'This is a romantic relationship, not family. Give the family role to a family relationship.' });
    }

    // A kind keeps is_blood_relation in step (blood ⇔ true); a new role
    // rewrites the role read the other way (services/familyTies).
    const familyTies = require('../services/familyTies');
    if (family_kind != null && family_kind !== '' && !familyTies.KINDS.includes(family_kind)) {
      return res.status(400).json({ error: `Kind must be one of ${familyTies.KINDS.join(', ')}` });
    }
    const kindSent = family_kind !== undefined;
    const kind = kindSent && family_kind ? family_kind : null;
    const blood = kindSent ? kind === 'blood' : (is_blood_relation != null ? is_blood_relation : null);
    const reverse = role ? familyTies.reverseRole(role, familyTies.genderOf({ gender: current.b_gender, pronouns: current.b_pronouns })) : null;

    // Sent fields are written (an empty family role clears it); others stay.
    await db.sequelize.query(
      `UPDATE character_relationships
       SET family_role       = CASE WHEN :role_sent THEN :family_role ELSE family_role END,
           reverse_family_role = CASE WHEN :role_sent THEN :reverse ELSE reverse_family_role END,
           family_kind       = CASE WHEN :kind_sent THEN :kind ELSE family_kind END,
           is_blood_relation = COALESCE(:is_blood, is_blood_relation),
           is_romantic       = COALESCE(:is_romantic, is_romantic),
           conflict_summary  = CASE WHEN :conflict_sent THEN :conflict ELSE conflict_summary END,
           updated_at        = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      {
        replacements: {
          id: relId,
          role_sent: family_role !== undefined,
          family_role: role || null,
          reverse,
          kind_sent: kindSent,
          kind,
          is_blood: blood,
          is_romantic: is_romantic != null ? is_romantic : null,
          conflict_sent: conflict_summary !== undefined,
          conflict: typeof conflict_summary === 'string' && conflict_summary.trim() ? conflict_summary.trim() : null,
        },
        type: db.sequelize.QueryTypes.UPDATE,
      }
    );

    const [updated] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT }
    );

    if (!updated) return res.status(404).json({ error: 'Relationship not found' });
    const pulse = await truth.afterStorySave(db, relId);
    res.json({ relationship: updated, pulse });
  } catch (err) {
    console.error('PUT /relationships/:relId/family error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/v1/relationships/generate-family
// Propose Family: Generate aimed at family (kind 'family'), with the same
// grounding. Family roles are saved as before (the role both ways, its
// kind). They land as seeds for Evoni to confirm on the Seeds tab.
// ════════════════════════════════════════════════════════════════════════
router.post('/generate-family', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    await generateAndRespond(req, res, {
      body: { ...(req.body || {}), kind: 'family' }, what: 'Propose Family',
      shape: (rows, skipped) => ({ family_bonds: rows, count: rows.length, skipped, message: `Proposed ${rows.length} family seed(s)` }),
    });
  } catch (err) {
    console.error('POST /relationships/generate-family error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// Where relationships disagree (services/relationshipTruth; Evoni,
// 2026-10-23). GET lists them; fix applies an item's suggested fix, read
// fresh on the server; keep marks it "different on purpose".
// ════════════════════════════════════════════════════════════════════════
const driftError = (res, err, what) => {
  if (err instanceof truth.DriftError) return res.status(err.status).json({ error: err.message });
  console.error(`${what} error:`, err);
  return res.status(500).json({ error: err.message });
};
router.get('/drift', requireAuth, async (req, res) => {
  try {
    res.json({ items: await truth.driftReport(getDb(), { includeKept: req.query.include_kept === 'true' }) });
  } catch (err) { driftError(res, err, 'GET /relationships/drift'); }
});
router.post('/drift/:key/fix', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    res.json(await truth.applyDriftFix(getDb(), req.params.key));
  } catch (err) { driftError(res, err, 'POST /relationships/drift/:key/fix'); }
});
router.post('/drift/:key/keep', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    res.json(await truth.keepDifferent(getDb(), req.params.key, { note: req.body?.note, by: req.user?.email || req.user?.id || null }));
  } catch (err) { driftError(res, err, 'POST /relationships/drift/:key/keep'); }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships/person/:charId and GET /api/v1/relationships/:relId
// For a link from the character page (?char=, ?rel=) to someone outside the
// cast (GET /cast): the person with their confirmed relationships and the
// people in them, or the relationship with its two people, so the page can
// add them and open the Inspector. Live rows only; a seed only with
// ?seeds=true. Registered last, so /drift and the others match first.
// ════════════════════════════════════════════════════════════════════════
const PERSON_COLUMNS = `id, registry_id, display_name, selected_name, character_key, icon,
  role_type, role_label, appearance_mode, status, core_belief, pressure_type, description,
  belief_pressured, emotional_function, personality, portrait_url, sort_order, feed_profile_id`;

router.get('/person/:charId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { charId } = req.params;
    if (!UUID_RE.test(charId)) return res.status(404).json({ error: 'Character not found' });
    const [character] = await db.sequelize.query(
      `SELECT ${PERSON_COLUMNS} FROM registry_characters WHERE id = :id AND deleted_at IS NULL`,
      { replacements: { id: charId }, type: db.sequelize.QueryTypes.SELECT });
    if (!character) return res.status(404).json({ error: 'Character not found' });
    const relationships = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE (cr.character_id_a = :id OR cr.character_id_b = :id) AND cr.confirmed = true AND ${LIVE}
       ORDER BY cr.updated_at DESC`,
      { replacements: { id: charId }, type: db.sequelize.QueryTypes.SELECT });
    const others = [...new Set(relationships.flatMap((r) => [r.character_id_a, r.character_id_b]).filter((x) => x !== charId))];
    const people = others.length ? await db.sequelize.query(
      `SELECT ${PERSON_COLUMNS} FROM registry_characters WHERE id IN (:ids) AND deleted_at IS NULL`,
      { replacements: { ids: others }, type: db.sequelize.QueryTypes.SELECT }) : [];
    res.json({ character, characters: [character, ...people], relationships });
  } catch (err) {
    console.error('GET /relationships/person/:charId error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:relId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    const missing = "That relationship was deleted or isn't confirmed";
    if (!UUID_RE.test(relId)) return res.status(404).json({ error: missing });
    const seeds = req.query.seeds === 'true';
    const [relationship] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id AND ${LIVE} ${seeds ? '' : 'AND cr.confirmed = true'}`,
      { replacements: { id: relId }, type: db.sequelize.QueryTypes.SELECT });
    if (!relationship) return res.status(404).json({ error: missing });
    const characters = await db.sequelize.query(
      `SELECT ${PERSON_COLUMNS} FROM registry_characters WHERE id IN (:ids) AND deleted_at IS NULL`,
      { replacements: { ids: [relationship.character_id_a, relationship.character_id_b] }, type: db.sequelize.QueryTypes.SELECT });
    res.json({ relationship, characters });
  } catch (err) {
    console.error('GET /relationships/:relId error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
