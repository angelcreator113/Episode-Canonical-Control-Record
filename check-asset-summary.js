const { sequelize } = require('./src/models');

(async () => {
  try {
    const r = await sequelize.query('SELECT asset_type, approval_status, COUNT(*) as cnt FROM assets GROUP BY asset_type, approval_status ORDER BY asset_type');
    console.log('Assets Summary:');
    r[0].forEach(x => console.log(`  ${x.asset_type}: ${x.approval_status} (${x.cnt})`));
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
