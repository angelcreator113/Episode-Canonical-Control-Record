const { sequelize, AITrainingData } = require('./src/models');

async function test() {
  try {
    console.log('🔍 Testing AITrainingData query...\n');
    
    // Test raw SQL first
    console.log('1. Testing raw SQL:');
    const [rawResults] = await sequelize.query('SELECT * FROM ai_training_data LIMIT 1');
    console.log('✅ Raw SQL works:', rawResults.length, 'rows\n');
    
    // Test model query with findAll
    console.log('2. Testing model findAll():');
    const modelResults = await AITrainingData.findAll({
      where: { source_type: 'youtube' },
      limit: 1
    });
    console.log('✅ Model query works:', modelResults.length, 'rows\n');
    
    // Show what query was generated
    console.log('3. Testing with logging enabled:');
    await AITrainingData.findAll({
      where: { source_type: 'youtube' },
      limit: 1,
      logging: console.log
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

test();
