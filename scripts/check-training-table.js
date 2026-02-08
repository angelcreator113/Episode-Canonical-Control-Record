const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

async function checkTable() {
  try {
    await sequelize.authenticate();
    
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ai_training_data'
      ORDER BY ordinal_position;
    `);
    
    if (results.length === 0) {
      console.log('❌ Table ai_training_data does NOT exist!');
      console.log('Creating table...');
      
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ai_training_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
          data_type VARCHAR(50) NOT NULL,
          source_url TEXT,
          metadata JSONB,
          analysis_result JSONB,
          processing_status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_training_data_type ON ai_training_data(data_type);
        CREATE INDEX idx_training_status ON ai_training_data(processing_status);
      `);
      
      console.log('✅ Table created!');
    } else {
      console.log('✅ Table ai_training_data exists!');
      console.log('\nColumns:');
      results.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTable();
