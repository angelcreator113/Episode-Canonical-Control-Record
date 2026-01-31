#!/bin/bash
cd /home/ubuntu/episode-metadata
node << 'NODEEOF'
require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

(async () => {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    const sql = fs.readFileSync('/home/ubuntu/add-composition-name-column.sql', 'utf8');
    console.log('🚀 Running migration...');
    await sequelize.query(sql);
    
    console.log('✅ Migration completed successfully!');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
NODEEOF
