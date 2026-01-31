require('dotenv').config();
const { sequelize } = require('./src/models');

async function testRoles() {
  try {
    // Get first show
    const [shows] = await sequelize.query('SELECT id, name FROM shows LIMIT 1');
    if (shows.length === 0) {
      console.log('No shows found. Create a show first.');
      await sequelize.close();
      process.exit(0);
    }
    
    const show = shows[0];
    console.log(`\n📺 Testing with show: "${show.name}" (${show.id})`);
    
    // Get roles for this show
    const [roles] = await sequelize.query(`
      SELECT role_key, role_label, category, is_required 
      FROM asset_roles 
      WHERE show_id = '${show.id}'
      ORDER BY sort_order
    `);
    
    console.log(`\n✅ Found ${roles.length} default roles:\n`);
    
    // Group by category
    const grouped = {};
    roles.forEach(role => {
      if (!grouped[role.category]) grouped[role.category] = [];
      grouped[role.category].push(role);
    });
    
    Object.entries(grouped).forEach(([category, roleList]) => {
      console.log(`${category}:`);
      roleList.forEach(role => {
        const required = role.is_required ? '⚠️ REQUIRED' : '';
        console.log(`  - ${role.role_label} (${role.role_key}) ${required}`);
      });
      console.log('');
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRoles();
