// Test model load from correct directory
process.chdir('/home/ubuntu/episode-metadata');

try {
  const factory = require('./src/models/StorytellerEcho');
  console.log('Factory type:', typeof factory);
  
  const { Sequelize } = require('sequelize');
  const seq = new Sequelize('postgres://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata', {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  
  const model = factory(seq);
  console.log('Model result type:', typeof model);
  console.log('Model name:', model ? model.name : 'NULL');
  console.log('Model tableName:', model ? model.tableName : 'NULL');
  
  // Now check what getModels returns
  const db = require('./src/models');
  console.log('\n--- From models/index.js ---');
  console.log('StorytellerEcho:', typeof db.StorytellerEcho, db.StorytellerEcho ? 'LOADED' : 'NULL/UNDEF');
  console.log('StorytellerMemory:', typeof db.StorytellerMemory, db.StorytellerMemory ? 'LOADED' : 'NULL/UNDEF');
  console.log('StorytellerBook:', typeof db.StorytellerBook, db.StorytellerBook ? 'LOADED' : 'NULL/UNDEF');
  
  // List all keys containing 'Storyteller'
  const stKeys = Object.keys(db).filter(k => k.includes('Storyteller'));
  console.log('Storyteller keys:', stKeys);
  
  seq.close();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
}
