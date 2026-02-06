const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('video_compositions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('draft', 'processing', 'complete', 'error'),
        defaultValue: 'draft',
      },
      scenes: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      assets: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      settings: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex('video_compositions', ['episode_id']);
    await queryInterface.addIndex('video_compositions', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('video_compositions');
  },
};
