'use strict';

/**
 * L14 (a): a scene set's angles as zones of the place (Evoni's ruling L14
 * and her answers 1-9, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L14. "A scene set's angles are organised as zones of the place, not
 *   camera framings: Front (exterior, entrance, arrival), Inside (the main
 *   room), Back (backstage, private or quiet area), plus the Venue Look's
 *   event areas; home sets use their own zones ... Close-up or other
 *   framings are optional extras on a zone, made only when a beat needs one."
 *
 * Adds scene_angles.zone_angle_id (UUID, nullable, the zone a framing extra
 * belongs to; none = Inside, the set's base, answer 1) and re-kinds the live
 * angles (answer 6: "re-kind by the same backfill rule; no image is
 * regenerated or deleted"), per set:
 *   - exterior and entrance → one Front (an imaged one first, exterior before
 *     entrance, then sort order); any other → an extra on that Front
 *     (answer 2: "one Front zone; a second view is a framing extra");
 *   - main interior → one Inside, chosen the same way; any other → an extra
 *     on that Inside;
 *   - area stays;
 *   - detail, other and no kind → an extra on Inside (zone_angle_id null).
 * Kinds: front, inside, back, area, zone, extra (src/constants/beatLocations.js).
 *
 * Guarded: the column is added only when absent, and only the old kinds
 * and no kind are re-kinded, so a re-run changes nothing. Logs the counts.
 * down: front → exterior (ESTABLISHING) or entrance; inside → main_interior;
 * extra → detail (CLOSE, DETAIL) or no kind; back and zone → no kind; then
 * drops the column. "other" and the extras' zones are not restored.
 */

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: 'public.scene_angles' }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const count = (meta) => (typeof meta?.rowCount === 'number' ? meta.rowCount : 0);

// One zone per set from the old kinds; the others become extras on it.
async function oneZonePerSet(sequelize, transaction, { zone, oldKinds, order }) {
  const [, kept] = await sequelize.query(
    `WITH ranked AS (
       SELECT id, scene_set_id,
              ROW_NUMBER() OVER (PARTITION BY scene_set_id ORDER BY
                (still_image_url IS NOT NULL AND (generation_status IS NULL OR generation_status = 'complete')) DESC,
                ${order}, sort_order ASC NULLS LAST, created_at ASC) AS n
         FROM scene_angles
        WHERE deleted_at IS NULL AND angle_kind IN (:oldKinds))
     UPDATE scene_angles a SET angle_kind = :zone, zone_angle_id = NULL
       FROM ranked r WHERE a.id = r.id AND r.n = 1`,
    { replacements: { zone, oldKinds }, transaction });
  const [, extras] = await sequelize.query(
    `UPDATE scene_angles a SET angle_kind = 'extra',
            zone_angle_id = (SELECT z.id FROM scene_angles z
                              WHERE z.scene_set_id = a.scene_set_id AND z.angle_kind = :zone AND z.deleted_at IS NULL
                              ORDER BY z.created_at ASC LIMIT 1)
      WHERE a.deleted_at IS NULL AND a.angle_kind IN (:oldKinds)`,
    { replacements: { zone, oldKinds }, transaction });
  return { kept: count(kept), extras: count(extras) };
}

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query(
        'ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS zone_angle_id UUID REFERENCES scene_angles(id) ON DELETE SET NULL',
        { transaction });
      const front = await oneZonePerSet(sequelize, transaction, {
        zone: 'front', oldKinds: ['exterior', 'entrance'], order: "(angle_kind = 'exterior') DESC",
      });
      const inside = await oneZonePerSet(sequelize, transaction, {
        zone: 'inside', oldKinds: ['main_interior'], order: 'TRUE',
      });
      const [, rest] = await sequelize.query(
        `UPDATE scene_angles SET angle_kind = 'extra', zone_angle_id = NULL
          WHERE deleted_at IS NULL AND (angle_kind IS NULL OR angle_kind IN ('detail', 'other'))`,
        { transaction });
      console.log(`[migration 20261002170000] zones: front ${front.kept} (+${front.extras} extras), inside ${inside.kept} (+${inside.extras} extras), extras on Inside ${count(rest)}`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query(
        `UPDATE scene_angles SET angle_kind = CASE
             WHEN angle_kind = 'front' THEN CASE WHEN UPPER(angle_label) = 'ESTABLISHING' THEN 'exterior' ELSE 'entrance' END
             WHEN angle_kind = 'inside' THEN 'main_interior'
             WHEN angle_kind = 'extra' AND UPPER(angle_label) IN ('CLOSE', 'DETAIL') THEN 'detail'
             WHEN angle_kind = 'area' THEN 'area'
             ELSE NULL END
          WHERE angle_kind IN ('front', 'inside', 'back', 'zone', 'extra')`,
        { transaction });
      await sequelize.query('ALTER TABLE scene_angles DROP COLUMN IF EXISTS zone_angle_id', { transaction });
    });
  },
};
