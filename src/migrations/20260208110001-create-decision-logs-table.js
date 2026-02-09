exports.up = async (queryInterface, Sequelize) => {
  console.log('Creating decision_logs table for AI training...');
  
  await queryInterface.createTable('decision_logs', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal('gen_random_uuid()')
    },
    episode_id: {
      type: Sequelize.UUID,
      references: {
        model: 'episodes',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    scene_id: {
      type: Sequelize.UUID,
      references: {
        model: 'scenes',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    user_id: {
      type: Sequelize.STRING(255)
    },
    action_type: {
      type: Sequelize.STRING(100),
      allowNull: false,
      comment: 'ASSET_POSITIONED, LAYER_CREATED, TIMING_SET, etc.'
    },
    entity_type: {
      type: Sequelize.STRING(50),
      comment: 'asset, layer, scene, episode'
    },
    entity_id: {
      type: Sequelize.UUID
    },
    action_data: {
      type: Sequelize.JSONB,
      comment: 'Details of what was done (position, timing, etc.)'
    },
    context_data: {
      type: Sequelize.JSONB,
      comment: 'Scene type, asset type, script context, etc.'
    },
    timestamp: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  await queryInterface.addIndex('decision_logs', ['episode_id'], {
    name: 'idx_decision_logs_episode'
  });
  await queryInterface.addIndex('decision_logs', ['timestamp'], {
    name: 'idx_decision_logs_timestamp'
  });
  await queryInterface.addIndex('decision_logs', ['action_type'], {
    name: 'idx_decision_logs_action_type'
  });

  console.log('✅ decision_logs table created successfully!');
};

exports.down = async (queryInterface, Sequelize) => {
  await queryInterface.dropTable('decision_logs');
};
