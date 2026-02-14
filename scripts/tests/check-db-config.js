require('dotenv').config();

console.log('\n🔍 ENVIRONMENT VARIABLES CHECK:\n');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);

// Load sequelize config
const config = require('./src/config/sequelize');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

console.log('\n📋 SEQUELIZE CONFIG FOR ENV:', env);
console.log('Database:', dbConfig.database);
console.log('Host:', dbConfig.host);
console.log('Port:', dbConfig.port);
console.log('Username:', dbConfig.username);
console.log('Dialect:', dbConfig.dialect);

console.log('\n✅ Done!\n');
