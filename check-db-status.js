// Quick database status checker
require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:Ayanna123@127.0.0.1:5432/episode_metadata';

const sequelize = new Sequelize(databaseUrl, {
  logging: false,
  dialectOptions: {
    connectTimeout: 10000
  }
});

async function checkDatabase() {
  try {
    console.log('\n=== DATABASE CONNECTION TEST ===\n');
    console.log(`Connecting to: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);
    
    await sequelize.authenticate();
    console.log('✅ Database connection successful!\n');
    
    // Get list of tables
    console.log('=== EXISTING DATABASE TABLES ===\n');
    const [results] = await sequelize.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    );
    
    results.forEach((row, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${row.tablename}`);
    });
    
    console.log(`\nTotal tables: ${results.length}\n`);
    
    // Check which models are loaded
    console.log('=== SEQUELIZE MODELS LOADED ===\n');
    const db = require('./src/models');
    const models = Object.keys(db)
      .filter(k => k !== 'sequelize' && k !== 'Sequelize')
      .sort();
    
    models.forEach((model, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${model}`);
    });
    
    console.log(`\nTotal models: ${models.length}\n`);
    
    // Check migration status
    console.log('=== MIGRATION STATUS ===\n');
    const [migrations] = await sequelize.query(
      "SELECT name FROM pgmigrations ORDER BY run_on DESC LIMIT 10;"
    );
    
    if (migrations.length > 0) {
      console.log('Last 10 migrations run:');
      migrations.forEach((row, i) => {
        console.log(`${String(i + 1).padStart(2)}. ${row.name}`);
      });
    } else {
      console.log('No migration history found (pgmigrations table may not exist)');
    }
    
    console.log('\n✅ Database check complete!\n');
    
  } catch (error) {
    console.error('\n❌ Database error:', error.message);
    if (error.parent) {
      console.error('Details:', error.parent.message);
    }
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

checkDatabase();
