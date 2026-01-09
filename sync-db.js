const { sequelize, models } = require('./src/models');

(async () => {
  try {
    console.log('🔄 Syncing all database tables...');
    await sequelize.sync({ alter: true });
    console.log('✅ All tables synced successfully');
    process.exit(0);
  } catch(e) { 
    console.error('❌ Sync failed:', e.message); 
    process.exit(1);
  }
})();
