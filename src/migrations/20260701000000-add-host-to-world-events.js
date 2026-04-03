'use strict';

/** Add host column to world_events table. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('world_events', 'host', {
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: 'Who is hosting: person, organization, or committee',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_events', 'host');
  },
};
