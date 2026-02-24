// Test if StorytellerEcho model loads correctly
try {
  const db = require('/home/ubuntu/episode-metadata/src/models');
  const keys = Object.keys(db);
  console.log('Total keys:', keys.length);
  console.log('Has StorytellerEcho:', keys.includes('StorytellerEcho'));
  console.log('StorytellerEcho value:', typeof db.StorytellerEcho, db.StorytellerEcho ? 'LOADED' : 'NULL/UNDEFINED');
  console.log('StorytellerMemory value:', typeof db.StorytellerMemory, db.StorytellerMemory ? 'LOADED' : 'NULL/UNDEFINED');
  
  // Check if it's a Sequelize model
  if (db.StorytellerEcho) {
    console.log('tableName:', db.StorytellerEcho.tableName);
  }
} catch (err) {
  console.error('LOAD ERROR:', err.message);
  console.error(err.stack);
}
