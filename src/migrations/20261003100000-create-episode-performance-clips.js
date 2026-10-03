'use strict';

/**
 * episode_performance_clips: the episode's performance clips, one per
 * canonical beat per performer (Evoni, 2026-10-03, the clip home agreed with
 * episode creation step 8; docs/EVENT_EPISODE_FLOW.md §8(o) item 2):
 *
 *   §8(o) item 2: "Host performance — a JustAWoman performance clip.
 *   Character performance — a Lala performance clip." Production coverage
 *   reads these to say whether a beat's required clip exists.
 *
 * Until now a performance clip had no live home: character_clips is outside
 * the canon schema (scripts/schema-agreement-step2.baseline: no-table) and
 * nothing creates one. Each row names its episode, its canonical beat
 * number (1-14, canonicalBeats.js) and its performer ('justawoman' or
 * 'lala'), and the clip itself: an asset (assets.id, typically the
 * episode's uploaded video) or a URL. One live row per (episode, beat,
 * performer), a partial unique index; attaching again updates that row.
 * status: draft, approved.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'episode_performance_clips';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        episode_id: { type: Sequelize.UUID, allowNull: false },
        canonical_beat_number: { type: Sequelize.SMALLINT, allowNull: false },
        performer: { type: Sequelize.STRING(20), allowNull: false },
        asset_id: { type: Sequelize.UUID, allowNull: true },
        video_url: { type: Sequelize.TEXT, allowNull: true },
        label: { type: Sequelize.STRING(200), allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE}
           ADD CONSTRAINT ${TABLE}_beat_range CHECK (canonical_beat_number BETWEEN 1 AND 14),
           ADD CONSTRAINT ${TABLE}_performer CHECK (performer IN ('justawoman', 'lala')),
           ADD CONSTRAINT ${TABLE}_status CHECK (status IN ('draft', 'approved')),
           ADD CONSTRAINT ${TABLE}_has_clip CHECK (asset_id IS NOT NULL OR video_url IS NOT NULL)`,
        { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_unique_beat_performer
           ON ${TABLE} (episode_id, canonical_beat_number, performer) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
