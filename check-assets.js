const { sequelize, models } = require('./src/models');

(async () => {
  try {
    await sequelize.authenticate();
    const pending = await models.Asset.findAll({ where: { approval_status: 'PENDING' }, raw: true });
    const approved = await models.Asset.findAll({ where: { approval_status: 'APPROVED' }, raw: true });
    
    console.log('\n=== DATABASE STATUS ===');
    console.log(`PENDING: ${pending.length}`);
    pending.forEach(a => console.log(`  - ${a.asset_type.padEnd(20)} ${a.id.substring(0, 8)}... (created: ${new Date(a.created_at).toLocaleTimeString()})`));
    
    console.log(`\nAPPROVED: ${approved.length}`);
    approved.forEach(a => console.log(`  - ${a.asset_type.padEnd(20)} ${a.id.substring(0, 8)}... (updated: ${new Date(a.updated_at).toLocaleTimeString()})`));
  } catch(e) { 
    console.error('Error:', e.message); 
  }
  process.exit(0);
})();
