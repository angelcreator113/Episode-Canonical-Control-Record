const {sequelize} = require('./src/models');

console.log('Database config:');
console.log('  Database:', sequelize.config.database);
console.log('  Host:', sequelize.config.host);
console.log('  User:', sequelize.config.username);

sequelize.query('SHOW search_path')
  .then(([r]) => {
    console.log('  Search path:', r[0].search_path);
    return sequelize.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE tablename = 'scenes'
    `);
  })
  .then(([r]) => {
    console.log('  Scenes table found in schemas:', r.map(t => t.schemaname).join(', ') || 'NOT FOUND');
    
    // Also check current schema
    return sequelize.query('SELECT current_schema()');
  })
  .then(([r]) => {
    console.log('  Current schema:', r[0].current_schema);
    
    // Try querying scenes with explicit schema
    return sequelize.query('SELECT COUNT(*) as count FROM public.scenes');
  })
  .then(([r]) => {
    console.log('  Scenes count (public schema):', r[0].count);
    process.exit(0);
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
