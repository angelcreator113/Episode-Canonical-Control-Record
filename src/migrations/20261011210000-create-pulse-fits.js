'use strict';

/**
 * pulse_fits: Lala's everyday fits (Task #2922; The Pulse spec §3 "Latest
 * fit", §4 Uploads). Outfits she wears outside episodes, uploaded in Admin ›
 * The Pulse › Uploads. Evoni, 2026-10-11: each fit is one photo, an optional
 * caption and the story date she wore it. Episode fits stay on the episode's
 * Style Page (episode_lookbook_images); nothing is copied here.
 *
 * story_date is a plain date until phase 4 brings the story-time field.
 * New table only, with deleted_at. Guarded: created only when absent.
 * down drops it.
 */

const TABLE = 'pulse_fits';

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
        image_url: { type: Sequelize.TEXT, allowNull: false },
        s3_key: { type: Sequelize.TEXT, allowNull: true },
        image_alt: { type: Sequelize.STRING(300), allowNull: true },
        caption: { type: Sequelize.TEXT, allowNull: true },
        story_date: { type: Sequelize.DATEONLY, allowNull: true },
        width: { type: Sequelize.INTEGER, allowNull: true },
        height: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS pulse_fits_show_story_date ON pulse_fits (show_id, story_date)', { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
