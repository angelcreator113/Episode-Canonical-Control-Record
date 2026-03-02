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

// ── GET /api/v1/relationships
// All relationships, optionally filtered by ?character_id=
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { character_id } = req.query;

    if (character_id) {
      // Fetch rows where this character appears on either side
      const rows = await db.sequelize.query(
        `SELECT cr.*,
            ca.display_name AS character_a_name, ca.selected_name AS character_a_selected,
            ca.role_type    AS character_a_type,
            cb.display_name AS character_b_name, cb.selected_name AS character_b_selected,
            cb.role_type    AS character_b_type
         FROM character_relationships cr
         JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
         JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
         WHERE cr.character_id_a = :char_id OR cr.character_id_b = :char_id
         ORDER BY cr.created_at DESC`,
        { replacements: { char_id: character_id }, type: db.sequelize.QueryTypes.SELECT }
      );
      return res.json({ relationships: rows, count: rows.length });
    }

    // No filter — return all
    const rows = await db.sequelize.query(
      `SELECT cr.*,
          ca.display_name AS character_a_name, ca.selected_name AS character_a_selected,
          ca.role_type    AS character_a_type,
          cb.display_name AS character_b_name, cb.selected_name AS character_b_selected,
          cb.role_type    AS character_b_type
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
       ORDER BY cr.created_at DESC`,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    res.json({ relationships: rows, count: rows.length });
  } catch (err) {
    console.error('GET /relationships error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/relationships
// Create a relationship between two characters
router.post('/', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const {
      character_id_a,
      character_id_b,
      relationship_type,
      connection_mode = 'IRL',
      lala_connection  = 'none',
      status           = 'Active',
      notes            = null,
    } = req.body;

    if (!character_id_a || !character_id_b || !relationship_type) {
      return res.status(400).json({
        error: 'character_id_a, character_id_b, and relationship_type are required',
      });
    }
    if (character_id_a === character_id_b) {
      return res.status(400).json({ error: 'A character cannot have a relationship with themselves' });
    }

    const id  = uuidv4();
    const now = new Date();

    await db.sequelize.query(
      `INSERT INTO character_relationships
         (id, character_id_a, character_id_b, relationship_type,
          connection_mode, lala_connection, status, notes, created_at, updated_at)
       VALUES
         (:id, :char_a, :char_b, :rel_type,
          :conn_mode, :lala_conn, :status, :notes, :now, :now)`,
      {
        replacements: {
          id, char_a: character_id_a, char_b: character_id_b,
          rel_type: relationship_type, conn_mode: connection_mode,
          lala_conn: lala_connection, status, notes, now,
        },
        type: db.sequelize.QueryTypes.INSERT,
      }
    );

    const [created] = await db.sequelize.query(
      `SELECT cr.*,
          ca.display_name AS character_a_name, ca.selected_name AS character_a_selected,
          cb.display_name AS character_b_name, cb.selected_name AS character_b_selected
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
       WHERE cr.id = :id`,
      { replacements: { id }, type: db.sequelize.QueryTypes.SELECT }
    );

    res.status(201).json({ relationship: created });
  } catch (err) {
    console.error('POST /relationships error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/v1/relationships/:relId
router.put('/:relId', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const { relId } = req.params;
    const { relationship_type, connection_mode, lala_connection, status, notes } = req.body;

    await db.sequelize.query(
      `UPDATE character_relationships
       SET relationship_type = COALESCE(:rel_type, relationship_type),
           connection_mode   = COALESCE(:conn_mode, connection_mode),
           lala_connection   = COALESCE(:lala_conn, lala_connection),
           status            = COALESCE(:status, status),
           notes             = COALESCE(:notes, notes),
           updated_at        = NOW()
       WHERE id = :id`,
      {
        replacements: {
          id: relId,
          rel_type: relationship_type || null,
          conn_mode: connection_mode   || null,
          lala_conn: lala_connection   || null,
          status:    status            || null,
          notes:     notes             !== undefined ? notes : null,
        },
        type: db.sequelize.QueryTypes.UPDATE,
      }
    );

    const [updated] = await db.sequelize.query(
      `SELECT cr.*,
          ca.display_name AS character_a_name, ca.selected_name AS character_a_selected,
          cb.display_name AS character_b_name, cb.selected_name AS character_b_selected
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
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

// ── DELETE /api/v1/relationships/:relId
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
