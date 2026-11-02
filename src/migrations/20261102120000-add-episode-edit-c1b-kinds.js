'use strict';

/**
 * Timeline C1b, first part (Timeline Editor redesign Gate 2a, 2026-11-02;
 * design Revision 8, R8.5, and Evoni's rulings D3, D4, D5 of 2026-11-02 in
 * docs/reads/2026-11-02-timeline-editor-redesign-plan.md §11). Column
 * additions and CHECK changes only: no new table, no new timing table.
 *
 *   timeline_items.kind            also: visual_mode, performer_clip (D3:
 *                                  Lala's or a guest's take over the scene,
 *                                  under Prime's PIP), caption (D4: captions
 *                                  and titles), overlay, phone_screen,
 *                                  gameplay_action (R8.5; the service refuses
 *                                  the last three until their state model is
 *                                  built)
 *   timeline_items.duration_ms     NULL or > 0: how long an item that lasts
 *                                  (a performer clip, a caption) is on screen
 *   episode_beat_production.visual_mode   NULL (gameplay) | gameplay | cinematic
 *                                  (R8.2: the beat's default visual mode)
 *   episode_pip_settings.mode_presets     NULL or JSON: the PIP preset per mode
 *
 * Every table already has deleted_at (20261028100000). Guarded: each change
 * is made only when missing, so it can run twice. Down refuses while any row
 * uses what it would remove (a new kind, a duration, a visual mode or a
 * preset), so it never drops data; on empty use it puts the C1 kinds back.
 * Until this runs, the service reads the edit without these columns and
 * refuses the new kinds with a plain message (409 C1B_NOT_MIGRATED).
 */

const C1_KINDS = ['object_keyframe', 'camera_keyframe', 'object_visibility', 'angle_change', 'transition', 'audio_offset', 'caption_override', 'dialogue_placement'];
const C1B_KINDS = ['visual_mode', 'performer_clip', 'caption', 'overlay', 'phone_screen', 'gameplay_action'];
const list = (kinds) => `(${kinds.map((k) => `'${k}'`).join(', ')})`;

const KIND_CHECK = 'timeline_items_kind_check';
const DURATION_CHECK = 'timeline_items_duration_ms_positive';
const MODE_CHECK = 'episode_beat_production_visual_mode_kind';

const columnExists = async (sequelize, table, column, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table, column }, transaction });
  return rows.length > 0;
};

const constraintDef = async (sequelize, table, name, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = :table AND c.conname = :name`,
    { replacements: { table, name }, transaction });
  return rows[0] ? rows[0].def : null;
};

const count = async (sequelize, sql, transaction) => Number((await sequelize.query(sql, { transaction }))[0][0].n);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      // The kinds: the C1 list plus C1b's (the C1 CHECK is the column's own, named by Postgres).
      const def = await constraintDef(sequelize, 'timeline_items', KIND_CHECK, transaction);
      if (!def || !C1B_KINDS.every((k) => def.includes(`'${k}'`))) {
        if (def) await sequelize.query(`ALTER TABLE timeline_items DROP CONSTRAINT ${KIND_CHECK}`, { transaction });
        await sequelize.query(`ALTER TABLE timeline_items ADD CONSTRAINT ${KIND_CHECK} CHECK (kind IN ${list([...C1_KINDS, ...C1B_KINDS])})`, { transaction });
      }
      if (!(await columnExists(sequelize, 'timeline_items', 'duration_ms', transaction))) {
        await queryInterface.addColumn('timeline_items', 'duration_ms', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      }
      if (!(await constraintDef(sequelize, 'timeline_items', DURATION_CHECK, transaction))) {
        await sequelize.query(`ALTER TABLE timeline_items ADD CONSTRAINT ${DURATION_CHECK} CHECK (duration_ms IS NULL OR duration_ms > 0)`, { transaction });
      }
      if (!(await columnExists(sequelize, 'episode_beat_production', 'visual_mode', transaction))) {
        await queryInterface.addColumn('episode_beat_production', 'visual_mode', { type: Sequelize.STRING(16), allowNull: true }, { transaction });
      }
      if (!(await constraintDef(sequelize, 'episode_beat_production', MODE_CHECK, transaction))) {
        await sequelize.query(`ALTER TABLE episode_beat_production ADD CONSTRAINT ${MODE_CHECK} CHECK (visual_mode IS NULL OR visual_mode IN ('gameplay', 'cinematic'))`, { transaction });
      }
      if (!(await columnExists(sequelize, 'episode_pip_settings', 'mode_presets', transaction))) {
        await queryInterface.addColumn('episode_pip_settings', 'mode_presets', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const used = [];
      if (await count(sequelize, `SELECT count(*) AS n FROM timeline_items WHERE kind IN ${list(C1B_KINDS)}`, transaction)) used.push('timeline_items (a C1b kind)');
      if (await columnExists(sequelize, 'timeline_items', 'duration_ms', transaction)
        && await count(sequelize, 'SELECT count(*) AS n FROM timeline_items WHERE duration_ms IS NOT NULL', transaction)) used.push('timeline_items.duration_ms');
      if (await columnExists(sequelize, 'episode_beat_production', 'visual_mode', transaction)
        && await count(sequelize, 'SELECT count(*) AS n FROM episode_beat_production WHERE visual_mode IS NOT NULL', transaction)) used.push('episode_beat_production.visual_mode');
      if (await columnExists(sequelize, 'episode_pip_settings', 'mode_presets', transaction)
        && await count(sequelize, 'SELECT count(*) AS n FROM episode_pip_settings WHERE mode_presets IS NOT NULL', transaction)) used.push('episode_pip_settings.mode_presets');
      if (used.length) throw new Error(`Refusing to undo C1b: rows still use ${used.join(', ')} (soft-deleted rows count). Nothing was changed.`);

      if (await constraintDef(sequelize, 'episode_beat_production', MODE_CHECK, transaction)) await sequelize.query(`ALTER TABLE episode_beat_production DROP CONSTRAINT ${MODE_CHECK}`, { transaction });
      if (await columnExists(sequelize, 'episode_beat_production', 'visual_mode', transaction)) await queryInterface.removeColumn('episode_beat_production', 'visual_mode', { transaction });
      if (await columnExists(sequelize, 'episode_pip_settings', 'mode_presets', transaction)) await queryInterface.removeColumn('episode_pip_settings', 'mode_presets', { transaction });
      if (await constraintDef(sequelize, 'timeline_items', DURATION_CHECK, transaction)) await sequelize.query(`ALTER TABLE timeline_items DROP CONSTRAINT ${DURATION_CHECK}`, { transaction });
      if (await columnExists(sequelize, 'timeline_items', 'duration_ms', transaction)) await queryInterface.removeColumn('timeline_items', 'duration_ms', { transaction });
      if (await constraintDef(sequelize, 'timeline_items', KIND_CHECK, transaction)) await sequelize.query(`ALTER TABLE timeline_items DROP CONSTRAINT ${KIND_CHECK}`, { transaction });
      await sequelize.query(`ALTER TABLE timeline_items ADD CONSTRAINT ${KIND_CHECK} CHECK (kind IN ${list(C1_KINDS)})`, { transaction });
    });
  },
};
