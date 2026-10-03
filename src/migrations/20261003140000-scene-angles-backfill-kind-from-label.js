'use strict';

/**
 * scene_angles.angle_kind for legacy rows (audit SCENE-01, 2026-10-03).
 *
 * Angles made from a scene spec (POST /scene-sets/:id/spec/create-angles)
 * were written without a kind, so the beat planner, which picks the
 * arrival shot by kind 'front' and the event by 'inside', reported "missing
 * Front" beside an ESTABLISHING angle that is one. The route now persists
 * the kind; this fills it in for the rows made before, from the label the
 * same way the planner reads a suggested angle (constants/beatLocations
 * KIND_FROM_LABEL): ESTABLISHING and DOORWAY are front, WIDE is inside.
 * Rows with any other label stay unresolved: a kind is a claim about the
 * place, and a CLOSE or VANITY shot does not say which zone it serves.
 *
 * Data only, idempotent (only NULL kinds change), guarded on the table and
 * column; down is a no-op, the labels still say what they said.
 */

const KIND_FROM_LABEL = { ESTABLISHING: 'front', DOORWAY: 'front', WIDE: 'inside' };

module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('scene_angles').catch(() => null);
    if (!table || !table.angle_kind) return;
    for (const [label, kind] of Object.entries(KIND_FROM_LABEL)) {
      await queryInterface.sequelize.query(
        `UPDATE scene_angles SET angle_kind = :kind
          WHERE angle_kind IS NULL AND UPPER(angle_label) = :label AND deleted_at IS NULL`,
        { replacements: { kind, label } },
      );
    }
  },

  async down() {
    // The kinds were derived from the labels, which remain; nothing to undo.
  },
};
