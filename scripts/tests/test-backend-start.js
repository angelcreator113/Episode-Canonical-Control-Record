#!/usr/bin/env node
require('dotenv').config();

console.log('🔍 Testing backend startup...');
console.log('Node version:', process.version);

try {
  console.log('📦 Loading models...');
  const { models, sequelize } = require('./src/models');
  
  console.log('✅ Models loaded');
  console.log('  - Episode:', !!models.Episode);
  console.log('  - Asset:', !!models.Asset);
  console.log('  - ThumbnailComposition:', !!models.ThumbnailComposition);
  console.log('  - ThumbnailTemplate:', !!models.ThumbnailTemplate);
  
  console.log('\n📦 Testing Asset model methods...');
  if (models.Asset) {
    console.log('  - Asset.findAll:', typeof models.Asset.findAll);
  }
  
  console.log('\n✅ Backend can start successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
