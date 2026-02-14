// DEBUG TEST ENDPOINT - Direct DB query bypassing Sequelize models
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

console.log('🧪 DEBUG: Loading test-db-direct route...');

router.get('/test-db-direct', async (req, res) => {
  console.log('🧪 /test-db-direct endpoint hit!');
  
  try {
    // Test 1: Check what database we're connected to
    console.log('📊 Test 1: Checking current database');
    const [dbInfo] = await sequelize.query('SELECT current_database(), current_schema()');
    console.log('Current database:', dbInfo[0].current_database);
    console.log('Current schema:', dbInfo[0].current_schema);

    // Test 2: List all tables
    console.log('\n📊 Test 2: Listing all tables');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tables found:', tables.length);

    // Test 3: Check if scenes table exists
    console.log('\n📊 Test 3: Checking if scenes table exists');
    const [sceneTableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scenes'
      ) as exists
    `);
    console.log('Scenes table exists:', sceneTableCheck[0].exists);

    // Test 4: Try to query scenes (if it exists)
    let sceneCount = null;
    let firstScene = null;
    if (sceneTableCheck[0].exists) {
      console.log('\n📊 Test 4: Querying scenes table');
      const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM scenes');
      sceneCount = countResult[0].count;
      console.log('Scene count:', sceneCount);

      if (sceneCount > 0) {
        const [sceneResult] = await sequelize.query('SELECT id, title FROM scenes LIMIT 1');
        firstScene = sceneResult[0];
        console.log('First scene:', firstScene);
      }
    }

    // Return all results
    res.json({
      success: true,
      database: dbInfo[0].current_database,
      schema: dbInfo[0].current_schema,
      tableCount: tables.length,
      tables: tables.map(t => t.table_name),
      scenesTableExists: sceneTableCheck[0].exists,
      sceneCount,
      firstScene,
    });
  } catch (error) {
    console.error('❌ Error in test-db-direct:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

module.exports = router;
