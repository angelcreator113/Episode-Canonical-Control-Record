const { sequelize } = require('../src/models');

async function check() {
  const [results] = await sequelize.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'layer_assets' 
    ORDER BY ordinal_position
  `);
  
  console.log('\nlayer_assets columns:');
  results.forEach(r => console.log(' -', r.column_name));
  
  const has = results.some(r => r.column_name === 'deleted_at');
  console.log(`\nHas deleted_at: ${has}`);
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
