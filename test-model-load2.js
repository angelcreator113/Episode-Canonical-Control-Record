// Deeper debug of StorytellerEcho loading
const path = require('path');
const modelPath = '/home/ubuntu/episode-metadata/src/models/StorytellerEcho.js';

// Check file exists
const fs = require('fs');
console.log('File exists:', fs.existsSync(modelPath));
console.log('File size:', fs.statSync(modelPath).size, 'bytes');

// Try to require it directly
try {
  const factory = require(modelPath);
  console.log('Factory type:', typeof factory);
  
  // Try loading with a sequelize instance
  const { Sequelize } = require('sequelize');
  const seq = new Sequelize('postgres://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata', {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });
  
  const model = factory(seq);
  console.log('Model result:', typeof model, model ? model.name || 'has value' : 'NULL');
  if (model) {
    console.log('tableName:', model.tableName);
    console.log('Is Model:', model.prototype && model.prototype.constructor ? 'yes' : 'no');
  }
  
  seq.close();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
}
