const { sequelize } = require('./src/models');

sequelize.query(`
  SELECT column_name, column_default, is_nullable, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'episode_scenes' 
  AND column_name IN ('type', 'scene_library_id', 'manual_duration_seconds')
  ORDER BY column_name
`).then(([results]) => {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
