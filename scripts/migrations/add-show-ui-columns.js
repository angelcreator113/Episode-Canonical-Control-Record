#!/usr/bin/env node
/**
 * Add icon and color columns to shows table for UI
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
});

async function addColumns() {
  try {
    console.log('🔄 Adding icon and color columns to shows table...');
    
    await sequelize.query(`
      ALTER TABLE shows 
      ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📺',
      ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#667eea';
    `);
    
    console.log('✅ Added icon and color columns!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addColumns()
  .then(() => {
    console.log('✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  });
