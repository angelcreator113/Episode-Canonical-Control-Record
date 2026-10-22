'use strict';

/**
 * The Lookbook gains a "detail" spot (Evoni, 2026-10-22): the DETAIL SHOT
 * and OUTFIT DETAIL frames of her Canva designs (The Style Diary, Runway to
 * Reality; src/services/styleSheetDesigns.js). The category CHECK on
 * episode_lookbook_images is re-created with 'detail' added. No rows change.
 *
 * Guarded: nothing happens when the table is absent. down puts the old
 * list back, after moving any detail photo to the To sort tray (so the old
 * CHECK holds).
 */

const TABLE = 'episode_lookbook_images';
const CHECK = 'episode_lookbook_images_category_check';
const OLD = ['unsorted', 'front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo'];
const NEW = [...OLD, 'detail'];

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};
const list = (cats) => cats.map((c) => `'${c}'`).join(', ');

async function setCheck(sequelize, cats, transaction) {
  await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${CHECK}`, { transaction });
  await sequelize.query(`ALTER TABLE ${TABLE} ADD CONSTRAINT ${CHECK} CHECK (category IN (${list(cats)}))`, { transaction });
}

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await setCheck(sequelize, NEW, transaction);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query(`UPDATE ${TABLE} SET category = 'unsorted' WHERE category = 'detail'`, { transaction });
      await setCheck(sequelize, OLD, transaction);
    });
  },
};
