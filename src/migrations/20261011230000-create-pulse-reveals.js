'use strict';

/**
 * pulse_reveals: when an item on The Pulse is revealed (Task #2938; The
 * Pulse spec §5 Reveals; docs/reads/2026-10-11-pulse-story-clock-read.md).
 * Evoni, 2026-10-11: one table for posts, images, events and characters,
 * so no item's own table changes (registry_characters stays untouched,
 * F-Reg-2). Each row places one item's reveal on the story clock: a moment
 * of its event's episode (announced, invitation_sent, lala_arrives,
 * during, after) or a set story time; before it the item is hidden or a
 * blurred "first look" teaser.
 *
 *   item_type    post | image | event | character
 *   item_id      the item's id as text (integer and UUID ids alike);
 *                a character is its Feed profile id
 *   image_kind   for images: fit | city | city_bubble | cover | post_photo
 *   story_order  the moment on the story clock, resolved when saved
 *   mode         hidden | teaser
 *   source       set (by Evoni) | derived
 *
 * One live row per item (unique where deleted_at IS NULL). New table only,
 * with deleted_at. Guarded: created only when absent. down drops it.
 */

const TABLE = 'pulse_reveals';
const INDEX = 'pulse_reveals_one_per_item';

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
        show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
        item_type: { type: Sequelize.STRING(20), allowNull: false },
        item_id: { type: Sequelize.STRING(64), allowNull: false },
        image_kind: { type: Sequelize.STRING(20), allowNull: true },
        event_id: { type: Sequelize.UUID, allowNull: true },
        episode_id: { type: Sequelize.UUID, allowNull: true },
        moment: { type: Sequelize.STRING(20), allowNull: false },
        story_order: { type: Sequelize.INTEGER, allowNull: true },
        mode: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'teaser' },
        source: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'set' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX ${INDEX} ON ${TABLE} (show_id, item_type, item_id, COALESCE(image_kind, '')) WHERE deleted_at IS NULL`,
        { transaction });
      await queryInterface.addIndex(TABLE, ['show_id'], { name: 'pulse_reveals_show_id', transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
