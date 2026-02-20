'use strict';

/**
 * Migration: Add missing columns to wardrobe table
 * 
 * The Sequelize Wardrobe model defines columns that don't exist in the DB yet.
 * This causes "column X does not exist" errors on any SELECT/UPDATE.
 * 
 * Missing columns: character_id, s3_key, s3_key_processed, brand, price,
 * purchase_link, website, size, occasion, outfit_set_id, outfit_set_name,
 * scene_description, outfit_notes, times_worn, last_worn_date, library_item_id
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columns = [
        { name: 'character_id',      sql: 'UUID' },
        { name: 's3_key',            sql: 'VARCHAR(500)' },
        { name: 's3_key_processed',  sql: 'VARCHAR(500)' },
        { name: 'brand',             sql: 'VARCHAR(255)' },
        { name: 'price',             sql: 'DECIMAL(10,2)' },
        { name: 'purchase_link',     sql: 'TEXT' },
        { name: 'website',           sql: 'VARCHAR(255)' },
        { name: 'size',              sql: 'VARCHAR(50)' },
        { name: 'occasion',          sql: 'VARCHAR(100)' },
        { name: 'outfit_set_id',     sql: 'VARCHAR(255)' },
        { name: 'outfit_set_name',   sql: 'VARCHAR(255)' },
        { name: 'scene_description', sql: 'TEXT' },
        { name: 'outfit_notes',      sql: 'TEXT' },
        { name: 'times_worn',        sql: 'INTEGER DEFAULT 0' },
        { name: 'last_worn_date',    sql: 'TIMESTAMPTZ' },
        { name: 'library_item_id',   sql: 'INTEGER' },
      ];

      for (const col of columns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE wardrobe ADD COLUMN IF NOT EXISTS "${col.name}" ${col.sql};`,
          { transaction }
        );
      }

      await transaction.commit();
      console.log('✅ Added 16 missing columns to wardrobe table');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const columns = [
      'character_id', 's3_key', 's3_key_processed', 'brand', 'price',
      'purchase_link', 'website', 'size', 'occasion', 'outfit_set_id',
      'outfit_set_name', 'scene_description', 'outfit_notes', 'times_worn',
      'last_worn_date', 'library_item_id',
    ];

    for (const col of columns) {
      await queryInterface.removeColumn('wardrobe', col).catch(() => {});
    }
  },
};
