const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

async function checkTemplateSlots() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // First, list all tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%template%'
      ORDER BY table_name;
    `);

    console.log('\n📋 Template-related tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check the template data - it's in template_studio table
    const tableName = 'template_studio';
    
    // First check columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position;
    `);
    
    console.log(`\n📋 Columns in ${tableName}:`);
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Now get the actual data
    const dataResult = await client.query(`
      SELECT *
      FROM ${tableName}
      WHERE name = 'Single Guest - YouTube v1';
    `);

    if (dataResult.rows.length > 0) {
      console.log('\n📋 Template found:');
      const template = dataResult.rows[0];
      console.log(`  ID: ${template.id}`);
      console.log(`  Name: ${template.name}`);
      
      if (template.canvas_config) {
        console.log(`\n  Canvas Config:`, JSON.stringify(template.canvas_config, null, 2));
      }
      
      if (template.role_slots) {
        console.log(`\n  Role Slots:`, JSON.stringify(template.role_slots, null, 2));
        
        // Check for NaN or undefined values
        console.log('\n🔍 Analyzing slot values:');
        template.role_slots.forEach((slot, idx) => {
          console.log(`\n  Slot ${idx + 1} (${slot.role}):`);
          console.log(`    x: ${slot.x} (type: ${typeof slot.x}, isNaN: ${isNaN(slot.x)})`);
          console.log(`    y: ${slot.y} (type: ${typeof slot.y}, isNaN: ${isNaN(slot.y)})`);
          console.log(`    width: ${slot.width} (type: ${typeof slot.width}, isNaN: ${isNaN(slot.width)})`);
          console.log(`    height: ${slot.height} (type: ${typeof slot.height}, isNaN: ${isNaN(slot.height)})`);
        });
      } else {
        console.log('\n  ⚠️ No role_slots column or data');
      }
    } else {
      console.log(`\n❌ Template "Single Guest - YouTube v1" not found in ${tableName}`);
      
      // Show what templates exist
      const allTemplates = await client.query(`SELECT id, name FROM ${tableName} LIMIT 5;`);
      console.log('\n  Available templates:');
      allTemplates.rows.forEach(t => console.log(`    - ${t.name}`));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

checkTemplateSlots();
