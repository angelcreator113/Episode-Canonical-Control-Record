'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if created_at exists
    const table = await queryInterface.describeTable('episodes');
    
    if (!table.created_at) {
      await queryInterface.addColumn('episodes', 'created_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW,
      });
    }

    if (!table.updated_at) {
      await queryInterface.addColumn('episodes', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW,
      });
    }

    // Copy data from upload_date and last_modified if they exist
    if (table.upload_date) {
      await queryInterface.sequelize.query(`
        UPDATE episodes 
        SET created_at = upload_date 
        WHERE created_at IS NULL AND upload_date IS NOT NULL;
      `);
    }

    if (table.last_modified) {
      await queryInterface.sequelize.query(`
        UPDATE episodes 
        SET updated_at = last_modified 
        WHERE updated_at IS NULL AND last_modified IS NOT NULL;
      `);
    }
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeColumn('episodes', 'created_at');
    await queryInterface.removeColumn('episodes', 'updated_at');
  },
};
