const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres'});

sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  .then(([results]) => {
    console.log('📋 Tables in database:');
    results.forEach(r => console.log('  -', r.table_name));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
