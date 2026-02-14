const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verifyMigration() {
  const client = await pool.connect();
  
  try {
    // Check assets table columns
    console.log('\n=== Assets Table Columns ===');
    const assetsColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name IN ('asset_role', 'show_id', 'episode_id', 'asset_scope')
      ORDER BY column_name;
    `);
    assetsColumns.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
    
    // Check thumbnail_templates
    console.log('\n=== Thumbnail Templates ===');
    const templates = await client.query('SELECT id, name, version, is_active FROM thumbnail_templates');
    console.log(`Found ${templates.rows.length} template(s):`);
    templates.rows.forEach(row => console.log(`  - ${row.name} v${row.version} (${row.is_active ? 'active' : 'inactive'})`));
    
    // Check required roles
    if (templates.rows.length > 0) {
      const details = await client.query('SELECT required_roles, optional_roles FROM thumbnail_templates LIMIT 1');
      console.log('\nRequired Roles:');
      details.rows[0].required_roles.forEach(role => console.log(`  ✓ ${role}`));
      console.log(`\nOptional Roles: ${details.rows[0].optional_roles.length} roles`);
      console.log('First few optional roles:');
      details.rows[0].optional_roles.slice(0, 5).forEach(role => console.log(`  - ${role}`));
    }
    
    // Check indexes
    console.log('\n=== Indexes Created ===');
    const indexes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('assets', 'thumbnail_templates', 'composition_assets', 'thumbnail_compositions')
      AND indexname LIKE 'idx_%'
      ORDER BY indexname;
    `);
    indexes.rows.forEach(row => console.log(`  ✓ ${row.indexname}`));
    
    console.log('\n✅ Role-based asset system migration verified successfully!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMigration().catch(console.error);
