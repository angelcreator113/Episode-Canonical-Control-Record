const {sequelize} = require('./src/models');

console.log('Testing database connection and scenes table access...\n');

async function test() {
  try {
    // Test 1: Can we query public.scenes?
    const [count1] = await sequelize.query('SELECT COUNT(*) as count FROM public.scenes');
    console.log('✓ public.scenes accessible, count:', count1[0].count);
    
    // Test 2: Can we query without schema prefix?
    const [count2] = await sequelize.query('SELECT COUNT(*) as count FROM scenes');
    console.log('✓ scenes (no schema prefix) accessible, count:', count2[0].count);
    
    // Test 3: Select one scene by ID
    const [scene] = await sequelize.query(`
      SELECT id, title FROM scenes LIMIT 1
    `);
    if (scene.length > 0) {
      console.log('✓ Can query individual scene:', scene[0].title);
    }
    
    console.log('\n✓ All tests passed! Database connection is working.');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('  Code:', error.code || 'N/A');
    console.error('  Detail:', error.detail || 'N/A');
    process.exit(1);
  }
}

test();
