require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function seedTemplates() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Load sample templates
    const templatesDir = path.join(__dirname, 'templates');
    const templateFiles = [
      'single-guest-youtube-v1.json',
      'dual-guest-youtube-v1.json',
      'wardrobe-youtube-v1.json'
    ];

    console.log('\n📂 Loading template files from:', templatesDir);

    for (const filename of templateFiles) {
      const filePath = path.join(templatesDir, filename);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Template file not found: ${filename}`);
        continue;
      }

      const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`\n📄 Processing: ${filename}`);

      // Check if template already exists
      const [existing] = await sequelize.query(`
        SELECT id, version FROM template_studio 
        WHERE name = $1 AND version = $2
      `, { bind: [templateData.name, templateData.version] });

      if (existing.length > 0) {
        console.log(`   ⏭️  Already exists (v${templateData.version}) - skipping`);
        continue;
      }

      // Insert template
      await sequelize.query(`
        INSERT INTO template_studio (
          id, name, version, status, locked,
          canvas_config, role_slots, safe_zones,
          required_roles, optional_roles, formats_supported,
          created_at, updated_at, published_at, locked_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6::jsonb, $7::jsonb, $8::jsonb,
          $9::text[], $10::text[], $11::text[],
          $12::timestamp, $13::timestamp, $14::timestamp, $15::timestamp
        )
      `, {
        bind: [
          templateData.id,
          templateData.name,
          templateData.version,
          templateData.status,
          templateData.locked,
          JSON.stringify(templateData.canvas_config),
          JSON.stringify(templateData.role_slots),
          JSON.stringify(templateData.safe_zones || {}),
          templateData.required_roles || [],
          templateData.optional_roles || [],
          templateData.formats_supported || ['YOUTUBE'],
          templateData.created_at,
          templateData.updated_at,
          templateData.status === 'PUBLISHED' ? templateData.created_at : null,
          templateData.locked ? templateData.created_at : null
        ]
      });

      console.log(`   ✅ Seeded: ${templateData.name} v${templateData.version}`);
      console.log(`      - Status: ${templateData.status}`);
      console.log(`      - Locked: ${templateData.locked}`);
      console.log(`      - Role slots: ${templateData.role_slots.length}`);
      console.log(`      - Formats: ${templateData.formats_supported.join(', ')}`);
    }

    // Verify seeded data
    const [templates] = await sequelize.query(`
      SELECT id, name, version, status, locked, 
             array_length(required_roles, 1) as required_count,
             array_length(optional_roles, 1) as optional_count
      FROM template_studio
      ORDER BY name, version
    `);

    console.log('\n📊 Current templates in database:');
    templates.forEach(t => {
      console.log(`   - ${t.name} v${t.version} [${t.status}]${t.locked ? ' 🔒' : ''}`);
      console.log(`     Required roles: ${t.required_count || 0}, Optional: ${t.optional_count || 0}`);
    });

    console.log('\n✅ Template seeding complete!');
    
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the seed script
seedTemplates()
  .then(() => {
    console.log('\n✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  });
