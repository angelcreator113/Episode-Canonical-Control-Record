/**
 * Fix: Allow NULL for episode_number column on episodes table
 * The model says allowNull: true, but the DB has NOT NULL constraint
 */
const { sequelize } = require('../src/models');

(async () => {
  try {
    // Check current state
    const [cols] = await sequelize.query(`
      SELECT column_name, is_nullable, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name='episodes' AND column_name='episode_number'
    `);
    console.log('Current state:', JSON.stringify(cols, null, 2));

    if (cols[0]?.is_nullable === 'NO') {
      // Fix: drop NOT NULL
      await sequelize.query('ALTER TABLE episodes ALTER COLUMN episode_number DROP NOT NULL');
      console.log('✅ Fixed: episode_number now allows NULL');
    } else {
      console.log('ℹ️  episode_number already allows NULL');
    }

    // Also check other columns that should be nullable
    const [allCols] = await sequelize.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns 
      WHERE table_name='episodes'
      ORDER BY ordinal_position
    `);
    
    const shouldBeNullable = [
      'episode_number', 'description', 'air_date', 'show_id',
      'thumbnail_url', 'current_ai_edit_plan_id', 'script_content',
      'platforms', 'platforms_other', 'content_strategy', 'platform_descriptions',
      'content_types', 'primary_audience', 'tones', 'structure',
      'visual_requirements', 'owner_creator', 'collaborators',
      'has_brand_deal', 'sponsor_name', 'deal_value', 'deliverables',
      'integration_requirements', 'deal_deadline', 'sponsor_expectations',
      'has_social_collab', 'collab_partners', 'collab_platforms',
      'collab_type', 'collab_deliverables', 'collab_timeline', 'collab_notes'
    ];
    
    const problems = [];
    for (const col of allCols) {
      if (shouldBeNullable.includes(col.column_name) && col.is_nullable === 'NO') {
        problems.push(col.column_name);
      }
    }
    
    if (problems.length > 0) {
      console.log('\n⚠️  Additional columns with wrong NOT NULL constraint:', problems);
      for (const colName of problems) {
        await sequelize.query(`ALTER TABLE episodes ALTER COLUMN "${colName}" DROP NOT NULL`);
        console.log(`  ✅ Fixed: ${colName} now allows NULL`);
      }
    } else {
      console.log('\n✅ All nullable columns are correct');
    }

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
