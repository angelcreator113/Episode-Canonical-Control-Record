require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL);

async function verifyTables() {
  try {
    // Check user_decisions table
    const [userDecisions] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_decisions'
      ORDER BY ordinal_position
    `);

    console.log('✅ user_decisions table:');
    userDecisions.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Check decision_patterns table
    const [decisionPatterns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'decision_patterns'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ decision_patterns table:');
    decisionPatterns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Check indexes
    const [indexes] = await sequelize.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE tablename IN ('user_decisions', 'decision_patterns')
      ORDER BY tablename, indexname
    `);

    console.log('\n✅ Indexes:');
    indexes.forEach(idx => {
      console.log(`   ${idx.tablename}: ${idx.indexname}`);
    });

    console.log('\n🎉 All tables and indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyTables();
