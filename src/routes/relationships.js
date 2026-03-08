'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

// ── Auth (match existing optionalAuth pattern) ─────────────────────────
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ── Lazy-load models / sequelize ───────────────────────────────────────
let _db = null;
function getDb() {
  if (!_db) _db = require('../models');
  return _db;
}

// ── Layer mapping: role_type → narrative layer ────────────────────────
const LAYER_MAP = {
  protagonist: 'real-world',
  pressure:    'real-world',
  support:     'real-world',
  mirror:      'lalaverse',
  shadow:      'lalaverse',
  special:     'series-2',
};

function getLayer(roleType) {
  return LAYER_MAP[roleType] || 'unknown';
}

/**
 * Cross-layer rule (relaxed):
 *  - role_type is a narrative archetype, NOT a world-layer indicator
 *  - A "shadow" or "mirror" can exist in the real world alongside protagonists
 *  - Only block truly impossible combos (none currently — all are valid)
 *  - When a dedicated world_layer column exists, tighten this back up
 */
function isLayerCompatible(layerA, layerB) {
  // All narrative-role layers are compatible with each other
  return true;
}

// ── Column SELECT helpers ──────────────────────────────────────────────
const REL_SELECT = `
  cr.id, cr.character_id_a, cr.character_id_b,
  cr.relationship_type, cr.connection_mode, cr.lala_connection,
  cr.status, cr.notes, cr.situation, cr.tension_state,
  cr.pain_point_category, cr.lala_mirror, cr.career_echo_potential,
  cr.confirmed, cr.role_tag,
  cr.family_role, cr.is_blood_relation, cr.is_romantic,
  cr.conflict_summary, cr.knows_about_connection,
  cr.source_knows, cr.target_knows, cr.reader_knows,
  cr.created_at, cr.updated_at`;

const CHAR_JOIN = `
  JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
  JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL`;

const CHAR_SELECT_A = `
  ca.display_name AS character_a_name, ca.selected_name AS character_a_selected,
  ca.role_type AS character_a_type, ca.role_label AS character_a_role_label,
  ca.appearance_mode AS character_a_appearance, ca.icon AS character_a_icon`;

const CHAR_SELECT_B = `
  cb.display_name AS character_b_name, cb.selected_name AS character_b_selected,
  cb.role_type AS character_b_type, cb.role_label AS character_b_role_label,
  cb.appearance_mode AS character_b_appearance, cb.icon AS character_b_icon`;

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships
// All confirmed relationships, optionally filtered by ?character_id=
// ════════════════════════════════════════════════════════════════════════
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { character_id } = req.query;

    let where = 'WHERE cr.confirmed = true';
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
// GET /api/v1/relationships/pending
// Unconfirmed AI-generated candidates
// ════════════════════════════════════════════════════════════════════════
router.get('/pending', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.confirmed = false
       ORDER BY cr.created_at DESC`,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    res.json({ candidates: rows, count: rows.length });
  } catch (err) {
    console.error('GET /relationships/pending error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships/character/:charId
// All relationships (confirmed + pending) for a single character
// ════════════════════════════════════════════════════════════════════════
router.get('/character/:charId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { charId } = req.params;

    const rows = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.character_id_a = :char_id OR cr.character_id_b = :char_id
       ORDER BY cr.confirmed DESC, cr.created_at DESC`,
      { replacements: { char_id: charId }, type: db.sequelize.QueryTypes.SELECT }
    );

    res.json({ relationships: rows, count: rows.length });
  } catch (err) {
    console.error('GET /relationships/character/:charId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/v1/relationships/tree/:registryId
// Full tree payload for the SVG three-layer visualization
// Returns characters grouped by role_type + all relationships
// ════════════════════════════════════════════════════════════════════════
router.get('/tree/:registryId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { registryId } = req.params;

    // All characters in this registry
    const characters = await db.sequelize.query(
      `SELECT id, display_name, selected_name, character_key, icon,
              role_type, role_label, appearance_mode, status,
              core_belief, pressure_type, description,
              belief_pressured, emotional_function, personality,
              portrait_url, sort_order
       FROM registry_characters
       WHERE registry_id = :registry_id AND deleted_at IS NULL
       ORDER BY sort_order ASC, display_name ASC`,
      { replacements: { registry_id: registryId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const charIds = characters.map(c => c.id);

    // All relationships between characters in this registry
    let relationships = [];
    if (charIds.length > 0) {
      relationships = await db.sequelize.query(
        `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
         FROM character_relationships cr ${CHAR_JOIN}
         WHERE cr.character_id_a IN (:ids) AND cr.character_id_b IN (:ids)
         ORDER BY cr.confirmed DESC, cr.created_at DESC`,
        { replacements: { ids: charIds }, type: db.sequelize.QueryTypes.SELECT }
      );
    }

    // Group characters into layers by role_type
    const layers = {
      'real-world': characters.filter(c =>
        ['protagonist', 'pressure', 'support'].includes(c.role_type)
      ),
      'lalaverse': characters.filter(c =>
        ['mirror', 'shadow'].includes(c.role_type)
      ),
      'series-2': characters.filter(c =>
        ['special'].includes(c.role_type)
      ),
    };

    res.json({
      characters,
      relationships,
      layers,
      characterCount: characters.length,
      relationshipCount: relationships.length,
    });
  } catch (err) {
    console.error('GET /relationships/tree/:registryId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/v1/relationships
// Manually create a confirmed relationship
// ════════════════════════════════════════════════════════════════════════
router.post('/', optionalAuth, async (req, res) => {
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
    } = req.body;

    if (!character_id_a || !character_id_b || !relationship_type) {
      return res.status(400).json({
        error: 'character_id_a, character_id_b, and relationship_type are required',
      });
    }
    if (character_id_a === character_id_b) {
      return res.status(400).json({ error: 'A character cannot have a relationship with themselves' });
    }

    // ── Cross-layer validation ───────────────────────────────────────
    const [charA] = await db.sequelize.query(
      'SELECT id, role_type, display_name FROM registry_characters WHERE id = :id',
      { replacements: { id: character_id_a }, type: db.sequelize.QueryTypes.SELECT }
    );
    const [charB] = await db.sequelize.query(
      'SELECT id, role_type, display_name FROM registry_characters WHERE id = :id',
      { replacements: { id: character_id_b }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!charA || !charB) {
      return res.status(404).json({ error: 'One or both characters not found' });
    }
    const layerA = getLayer(charA.role_type);
    const layerB = getLayer(charB.role_type);
    if (!isLayerCompatible(layerA, layerB)) {
      return res.status(400).json({
        error: `Cross-layer relationships not allowed: ${charA.display_name} (${layerA}) cannot have a relationship with ${charB.display_name} (${layerB}). Real-world characters relate only to real-world; LalaVerse characters relate only to LalaVerse.`,
      });
    }

    const id  = uuidv4();
    const now = new Date();

    await db.sequelize.query(
      `INSERT INTO character_relationships
         (id, character_id_a, character_id_b, relationship_type,
          connection_mode, lala_connection, status, notes,
          situation, tension_state, pain_point_category,
          lala_mirror, career_echo_potential, confirmed,
          created_at, updated_at)
       VALUES
         (:id, :char_a, :char_b, :rel_type,
          :conn_mode, :lala_conn, :status, :notes,
          :situation, :tension_state, :pain_cat,
          :lala_mirror, :career_echo, :confirmed,
          :now, :now)`,
      {
        replacements: {
          id, char_a: character_id_a, char_b: character_id_b,
          rel_type: relationship_type, conn_mode: connection_mode,
          lala_conn: lala_connection, status, notes,
          situation, tension_state, pain_cat: pain_point_category,
          lala_mirror, career_echo: career_echo_potential,
          confirmed, now,
        },
        type: db.sequelize.QueryTypes.INSERT,
      }
    );

    const [created] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id`,
      { replacements: { id }, type: db.sequelize.QueryTypes.SELECT }
    );

    res.status(201).json({ relationship: created });
  } catch (err) {
    console.error('POST /relationships error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/v1/relationships/generate
// Use Claude AI to generate 3-5 candidate relationships
// ════════════════════════════════════════════════════════════════════════
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const db   = getDb();
    const { registry_id, focus_character_id } = req.body;

    if (!registry_id) {
      return res.status(400).json({ error: 'registry_id is required' });
    }

    // Fetch all characters in the registry
    const characters = await db.sequelize.query(
      `SELECT id, display_name, selected_name, role_type, role_label,
              core_belief, pressure_type, personality, description,
              belief_pressured, emotional_function
       FROM registry_characters
       WHERE registry_id = :registry_id AND deleted_at IS NULL
       ORDER BY sort_order ASC`,
      { replacements: { registry_id }, type: db.sequelize.QueryTypes.SELECT }
    );

    if (characters.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 characters to generate relationships' });
    }

    // Fetch existing relationships to avoid duplicates
    const charIds = characters.map(c => c.id);
    const existing = await db.sequelize.query(
      `SELECT character_id_a, character_id_b, relationship_type
       FROM character_relationships
       WHERE character_id_a IN (:ids) AND character_id_b IN (:ids)`,
      { replacements: { ids: charIds }, type: db.sequelize.QueryTypes.SELECT }
    );

    const existingPairs = new Set(
      existing.map(r => `${r.character_id_a}|${r.character_id_b}`)
    );

    // Build character context for Claude
    const charContext = characters.map(c => (
      `- ${c.display_name} [id=${c.id}] (${c.role_type}): ${c.core_belief || 'no core belief'}, ` +
      `pressure: ${c.pressure_type || 'none'}, personality: ${(c.personality || '').slice(0, 120)}`
    )).join('\n');

    const existingContext = existing.length > 0
      ? `\nExisting relationships (do NOT duplicate):\n${existing.map(r => {
          const a = characters.find(c => c.id === r.character_id_a);
          const b = characters.find(c => c.id === r.character_id_b);
          return `- ${a?.display_name || '?'} ↔ ${b?.display_name || '?'}: ${r.relationship_type}`;
        }).join('\n')}\n`
      : '';

    const focusNote = focus_character_id
      ? `\nFocus on generating relationships involving the character with ID: ${focus_character_id} (${characters.find(c => c.id === focus_character_id)?.display_name || 'unknown'})`
      : '';

    const Anthropic = require('@anthropic-ai/sdk');
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let message;
    try {
      message = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a literary relationship analyst for a creative writing universe called the LalaVerse.

IMPORTANT RULE: Characters from the real world (protagonist, pressure, support role types) can ONLY have relationships with other real-world characters. LalaVerse characters (mirror, shadow role types) can ONLY have relationships with other LalaVerse characters or series-2 (special) characters. NEVER suggest cross-layer relationships between real-world and LalaVerse characters.

MORAL DEPTH RULE: Relationships should reflect real human complexity:
- Marriages and partnerships CAN be tested by temptation, jealousy, or emotional affairs.
- Characters can be faithful (choosing loyalty despite being tempted), unfaithful (acting on desire despite commitment), or somewhere in between.
- Arguments, betrayals, reconciliations, and moral choices should be reflected in the situation and tension_state.
- "Fidelity Test" is a valid relationship_type: one character tests another's commitment just by existing.
- "Emotional Affair" is a valid relationship_type: an intimate bond that never becomes physical but is still a betrayal.
- A character can be a "temptation" — someone who pulls a committed person toward a choice they'll have to live with.

Characters in this registry:
${charContext}
${existingContext}${focusNote}

Generate 3 to 5 NEW relationship suggestions that don't already exist.
For each, provide:
- character_a_id (exact UUID from the list above)
- character_b_id (exact UUID from the list above)
- relationship_type (string like "sister", "rival", "mentor", "therapist", "ex-partner", "spouse", "fidelity_test", "temptation", "emotional_affair", "the_one_who_stayed", "the_one_who_left", etc.)
- connection_mode (one of: IRL, Online Only, Passing, Professional, One-sided)
- situation (1-2 sentences describing the dynamic — include moral tension if relevant: who's tempted, who's faithful, who's lied, who's choosing)
- tension_state (one of: calm, simmering, volatile, fractured, healing)
- lala_connection (one of: none, knows_lala, through_justwoman, interacts_content, unaware)
- pain_point_category (like "identity", "trust", "ambition", "loyalty", "family", "self-worth", "fidelity", "betrayal", "guilt", "temptation")
- lala_mirror (1 sentence: how this relationship mirrors in the LalaVerse)
- career_echo_potential (1 sentence: career/professional echo)

Return ONLY valid JSON: { "candidates": [ ... ] }
No markdown fences, no explanation.`,
        }],
      });
    } catch (aiErr) {
      const errMsg = aiErr?.message || String(aiErr);
      const isCredits = errMsg.includes('credit balance') || errMsg.includes('billing') || aiErr?.status === 402;
      const isRate = errMsg.includes('rate') || aiErr?.status === 429;
      console.error('Claude API error:', errMsg);
      if (isCredits) {
        return res.status(402).json({ error: 'AI credits exhausted. Please top up your Anthropic account to generate relationships.' });
      }
      if (isRate) {
        return res.status(429).json({ error: 'AI rate limit reached. Please wait a moment and try again.' });
      }
      return res.status(502).json({ error: 'AI service unavailable. ' + errMsg.slice(0, 200) });
    }

    let candidates = [];
    try {
      const raw = message.content[0].text.trim();
      const parsed = JSON.parse(raw);
      candidates = parsed.candidates || [];
    } catch (parseErr) {
      console.error('Claude JSON parse error:', parseErr);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Insert candidates as unconfirmed
    const inserted = [];
    for (const c of candidates) {
      const aExists = characters.find(ch => ch.id === c.character_a_id);
      const bExists = characters.find(ch => ch.id === c.character_b_id);
      if (!aExists || !bExists) continue;
      if (c.character_a_id === c.character_b_id) continue;

      // Cross-layer filter: skip incompatible layer pairs
      const layA = getLayer(aExists.role_type);
      const layB = getLayer(bExists.role_type);
      if (!isLayerCompatible(layA, layB)) continue;

      const pairKey = `${c.character_a_id}|${c.character_b_id}`;
      const pairKeyRev = `${c.character_b_id}|${c.character_a_id}`;
      if (existingPairs.has(pairKey) || existingPairs.has(pairKeyRev)) continue;

      const id  = uuidv4();
      const now = new Date();

      await db.sequelize.query(
        `INSERT INTO character_relationships
           (id, character_id_a, character_id_b, relationship_type,
            connection_mode, lala_connection, status, situation,
            tension_state, pain_point_category, lala_mirror,
            career_echo_potential, confirmed, created_at, updated_at)
         VALUES
           (:id, :char_a, :char_b, :rel_type,
            :conn_mode, :lala_conn, :status, :situation,
            :tension_state, :pain_cat, :lala_mirror,
            :career_echo, false, :now, :now)`,
        {
          replacements: {
            id, char_a: c.character_a_id, char_b: c.character_b_id,
            rel_type: c.relationship_type || 'unknown',
            conn_mode: c.connection_mode || 'IRL',
            lala_conn: c.lala_connection || 'none',
            status: 'Active',
            situation: c.situation || null,
            tension_state: c.tension_state || null,
            pain_cat: c.pain_point_category || null,
            lala_mirror: c.lala_mirror || null,
            career_echo: c.career_echo_potential || null,
            now,
          },
          type: db.sequelize.QueryTypes.INSERT,
        }
      );

      existingPairs.add(pairKey);
      inserted.push({ id, ...c });
    }

    // Return the full inserted rows
    const insertedIds = inserted.map(i => i.id);
    let results = [];
    if (insertedIds.length > 0) {
      results = await db.sequelize.query(
        `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
         FROM character_relationships cr ${CHAR_JOIN}
         WHERE cr.id IN (:ids)`,
        { replacements: { ids: insertedIds }, type: db.sequelize.QueryTypes.SELECT }
      );
    }

    res.status(201).json({
      candidates: results,
      count: results.length,
      message: `Generated ${results.length} candidate relationship(s)`,
    });
  } catch (err) {
    console.error('POST /relationships/generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/v1/relationships/confirm/:relationshipId
// Approve an AI-generated candidate → confirmed = true
// ════════════════════════════════════════════════════════════════════════
router.post('/confirm/:relationshipId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { relationshipId } = req.params;

    // Fetch the candidate with character role_types for layer check
    const [candidate] = await db.sequelize.query(
      `SELECT cr.id, cr.confirmed, ca.role_type AS role_a, cb.role_type AS role_b,
              ca.display_name AS name_a, cb.display_name AS name_b
       FROM character_relationships cr
       LEFT JOIN registry_characters ca ON ca.id = cr.character_id_a
       LEFT JOIN registry_characters cb ON cb.id = cr.character_id_b
       WHERE cr.id = :id`,
      { replacements: { id: relationshipId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!candidate) return res.status(404).json({ error: 'Relationship not found' });

    // Cross-layer validation on confirm
    const layA = getLayer(candidate.role_a);
    const layB = getLayer(candidate.role_b);
    if (!isLayerCompatible(layA, layB)) {
      return res.status(400).json({
        error: `Cannot confirm: ${candidate.name_a} (${layA}) and ${candidate.name_b} (${layB}) are in incompatible layers.`,
      });
    }

    await db.sequelize.query(
      `UPDATE character_relationships
       SET confirmed = true, updated_at = NOW()
       WHERE id = :id AND confirmed = false`,
      { replacements: { id: relationshipId }, type: db.sequelize.QueryTypes.UPDATE }
    );

    const [row] = await db.sequelize.query(
      `SELECT ${REL_SELECT}, ${CHAR_SELECT_A}, ${CHAR_SELECT_B}
       FROM character_relationships cr ${CHAR_JOIN}
       WHERE cr.id = :id`,
      { replacements: { id: relationshipId }, type: db.sequelize.QueryTypes.SELECT }
    );

    if (!row) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ relationship: row, message: 'Candidate confirmed' });
  } catch (err) {
    console.error('POST /relationships/confirm/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/relationships/dismiss/:relationshipId
// Dismiss (delete) an unconfirmed candidate
// ════════════════════════════════════════════════════════════════════════
router.delete('/dismiss/:relationshipId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { relationshipId } = req.params;

    const [row] = await db.sequelize.query(
      `SELECT id, confirmed FROM character_relationships WHERE id = :id`,
      { replacements: { id: relationshipId }, type: db.sequelize.QueryTypes.SELECT }
    );

    if (!row) return res.status(404).json({ error: 'Relationship not found' });
    if (row.confirmed) {
      return res.status(400).json({ error: 'Cannot dismiss a confirmed relationship. Use DELETE /:id instead.' });
    }

    await db.sequelize.query(
      'DELETE FROM character_relationships WHERE id = :id',
      { replacements: { id: relationshipId }, type: db.sequelize.QueryTypes.DELETE }
    );

    res.json({ dismissed: true });
  } catch (err) {
    console.error('DELETE /relationships/dismiss/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// PUT /api/v1/relationships/:relId
// Update mutable fields on a relationship
// ════════════════════════════════════════════════════════════════════════
router.put('/:relId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    const {
      relationship_type, connection_mode, lala_connection,
      status, notes, situation, tension_state,
      pain_point_category, lala_mirror, career_echo_potential,
    } = req.body;

    await db.sequelize.query(
      `UPDATE character_relationships
       SET relationship_type    = COALESCE(:rel_type,    relationship_type),
           connection_mode      = COALESCE(:conn_mode,   connection_mode),
           lala_connection      = COALESCE(:lala_conn,   lala_connection),
           status               = COALESCE(:status,      status),
           notes                = COALESCE(:notes,       notes),
           situation            = COALESCE(:situation,   situation),
           tension_state        = COALESCE(:tension,     tension_state),
           pain_point_category  = COALESCE(:pain_cat,    pain_point_category),
           lala_mirror          = COALESCE(:lala_m,      lala_mirror),
           career_echo_potential = COALESCE(:career,     career_echo_potential),
           updated_at           = NOW()
       WHERE id = :id`,
      {
        replacements: {
          id: relId,
          rel_type:  relationship_type || null,
          conn_mode: connection_mode   || null,
          lala_conn: lala_connection   || null,
          status:    status            || null,
          notes:     notes !== undefined ? notes : null,
          situation: situation         || null,
          tension:   tension_state     || null,
          pain_cat:  pain_point_category || null,
          lala_m:    lala_mirror       || null,
          career:    career_echo_potential || null,
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
    res.json({ relationship: updated });
  } catch (err) {
    console.error('PUT /relationships/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/relationships/:relId
// Permanently remove a relationship
// ════════════════════════════════════════════════════════════════════════
router.delete('/:relId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.sequelize.query(
      'DELETE FROM character_relationships WHERE id = :id',
      { replacements: { id: req.params.relId }, type: db.sequelize.QueryTypes.DELETE }
    );
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /relationships/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
