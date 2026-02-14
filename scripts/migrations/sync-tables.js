const db = require('./src/models');

(async () => {
  try {
    console.log('📊 Starting database sync...');
    
    const models = [
      'Episode', 'MetadataStorage', 'Thumbnail', 'ProcessingQueue',
      'ActivityLog', 'FileStorage', 'Asset', 'ThumbnailComposition', 'ThumbnailTemplate'
    ];
    
    for (const modelName of models) {
      if (db.models[modelName]) {
        try {
          await db.models[modelName].sync({ alter: true, logging: false });
          console.log(`✅ ${modelName} synced`);
        } catch (err) {
          console.error(`❌ ${modelName} failed:`, err.message.split('\n')[0]);
        }
      } else {
        console.warn(`⚠️  ${modelName} not found`);
      }
    }
    
    console.log('✅ All tables synced!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync error:', error);
    process.exit(1);
  }
})();
