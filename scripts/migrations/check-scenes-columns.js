const {sequelize} = require('./src/models');

sequelize.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'scenes' 
    AND table_schema = 'public' 
  ORDER BY ordinal_position
`).then(([cols]) => {
  console.log('Scenes table columns:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
