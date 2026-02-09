exports.up = async (queryInterface, Sequelize) => {
  console.log('Checking if layer_assets table exists...');
  
  // Check if table exists
  const tableExists = await queryInterface.showAllTables()
    .then(tables => tables.includes('layer_assets'));
  
  if (!tableExists) {
    console.log('⚠️  layer_assets table does not exist, skipping migration');
    return;
  }
  
  // Check if columns already exist
  const tableInfo = await queryInterface.describeTable('layer_assets');
  
  if (tableInfo.in_point_seconds) {
    console.log('⚠️  Clip timing columns already exist, skipping migration');
    return;
  }
  
  console.log('Adding clip timing fields to layer_assets...');
  
  await queryInterface.addColumn('layer_assets', 'in_point_seconds', {
    type: Sequelize.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'When asset appears in timeline (seconds)'
  });

  await queryInterface.addColumn('layer_assets', 'out_point_seconds', {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: true,
    comment: 'When asset disappears from timeline (seconds)'
  });

  await queryInterface.addColumn('layer_assets', 'transition_in', {
    type: Sequelize.STRING(50),
    defaultValue: 'none',
    comment: 'Fade-in, slide-in, zoom-in, none'
  });

  await queryInterface.addColumn('layer_assets', 'transition_out', {
    type: Sequelize.STRING(50),
    defaultValue: 'none',
    comment: 'Fade-out, slide-out, zoom-out, none'
  });

  await queryInterface.addColumn('layer_assets', 'animation_type', {
    type: Sequelize.STRING(50),
    allowNull: true,
    comment: 'Pan, zoom, rotate, none'
  });

  console.log('Creating index on timing fields...');
  
  // Check if index already exists
  const indexes = await queryInterface.showIndex('layer_assets');
  const indexExists = indexes.some(idx => idx.name === 'idx_layer_assets_timing');
  
  if (!indexExists) {
    await queryInterface.addIndex('layer_assets', 
      ['in_point_seconds', 'out_point_seconds'],
      { name: 'idx_layer_assets_timing' }
    );
  }

  console.log('✅ Clip timing fields added successfully!');
};

exports.down = async (queryInterface, Sequelize) => {
  await queryInterface.removeColumn('layer_assets', 'in_point_seconds');
  await queryInterface.removeColumn('layer_assets', 'out_point_seconds');
  await queryInterface.removeColumn('layer_assets', 'transition_in');
  await queryInterface.removeColumn('layer_assets', 'transition_out');
  await queryInterface.removeColumn('layer_assets', 'animation_type');
  
  await queryInterface.removeIndex('layer_assets', 'idx_layer_assets_timing');
};
