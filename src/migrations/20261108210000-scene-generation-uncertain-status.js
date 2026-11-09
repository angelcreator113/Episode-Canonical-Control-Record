'use strict';

/**
 * Scene Sets: an 'uncertain' generation status (#3748, PR A; Evoni,
 * 2026-11-08, D1). A paid fal still whose outcome is unknown (the request
 * may have been sent and no usable answer came back) is recorded as
 * 'uncertain', never as 'failed', so nothing treats it as safe to retry.
 *
 * Inert on its own: no code writes 'uncertain' until the application change
 * (PR B) is separately approved. Existing 'failed' rows are not reclassified.
 *
 * Its own file, before 20261108210100-scene-generation-attempts: a value
 * added with ALTER TYPE ... ADD VALUE cannot be used in the transaction that
 * adds it. The Deploy workflow runs sequelize-cli db:migrate, which commits
 * each migration file on its own, so this value is committed before the next
 * file's guards refer to it.
 *
 * Down: Postgres cannot drop an enum value. Down refuses while any scene set
 * or angle (soft-deleted ones included) is 'uncertain'; otherwise it leaves
 * the unused value in place. It never turns 'uncertain' into a retryable
 * status.
 */
const TYPES = ['enum_scene_sets_generation_status', 'enum_scene_angles_generation_status'];

module.exports = {
  async up(queryInterface) {
    for (const type of TYPES) {
      await queryInterface.sequelize.query(`ALTER TYPE public."${type}" ADD VALUE IF NOT EXISTS 'uncertain'`);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const [[row]] = await sequelize.query(`
      SELECT (SELECT count(*) FROM public.scene_sets WHERE generation_status::text = 'uncertain')
           + (SELECT count(*) FROM public.scene_angles WHERE generation_status::text = 'uncertain') AS n`);
    if (Number(row.n) > 0) {
      throw new Error(`Refusing to undo the 'uncertain' generation status: ${row.n} scene set(s) or angle(s), soft-deleted ones included, are uncertain. A paid request may already have been charged for each; resolve them first. Nothing was changed.`);
    }
    // Postgres cannot remove an enum value; an unused 'uncertain' is harmless.
  },
};
