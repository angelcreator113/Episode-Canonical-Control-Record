require('dotenv').config();
const { getPool } = require('./src/config/database');

getPool().query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'episode_scripts' 
  ORDER BY ordinal_position
`).then(r => {
  console.log('episode_scripts columns:');
  r.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
