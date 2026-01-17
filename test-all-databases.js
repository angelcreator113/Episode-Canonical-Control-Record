/**
 * Quick Database Connection Test - All Environments
 * Tests all database connections with timeout
 */

const { Sequelize } = require('sequelize');
const path = require('path');

const environments = ['development', 'staging', 'production'];

async function testConnection(env) {
  delete process.env.DATABASE_URL;
  
  const envFile = env === 'production' ? '.env.production' : `.env.${env}`;
  require('dotenv').config({ path: path.join(__dirname, envFile), override: true });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return { env, status: 'ERROR', message: 'DATABASE_URL not found' };
  }

  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  const cleanUrl = dbUrl.replace(/\?sslmode=\w+/, '');
  
  const sequelize = new Sequelize(cleanUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DATABASE_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false,
      connectTimeout: 5000 // 5 second timeout
    },
    pool: {
      max: 1,
      min: 0,
      acquire: 5000,
      idle: 1000
    }
  });

  try {
    await sequelize.authenticate();
    const version = await sequelize.query('SELECT version()', { type: Sequelize.QueryTypes.SELECT });
    await sequelize.close();
    
    return { 
      env, 
      status: 'SUCCESS', 
      message: 'Connected',
      endpoint: maskedUrl.split('/')[2].split('@')[1]
    };
  } catch (error) {
    await sequelize.close();
    return { 
      env, 
      status: 'FAILED', 
      message: error.message.includes('timeout') ? 'Connection timeout (check security group)' : error.message.substring(0, 80)
    };
  }
}

async function testAll() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   DATABASE CONNECTION TEST - ALL ENVIRONMENTS  ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const results = [];
  
  for (const env of environments) {
    process.stdout.write(`Testing ${env.padEnd(12)} ... `);
    const result = await testConnection(env);
    results.push(result);
    
    if (result.status === 'SUCCESS') {
      console.log(`✅ ${result.message} (${result.endpoint})`);
    } else if (result.status === 'FAILED') {
      console.log(`❌ ${result.message}`);
    } else {
      console.log(`⚠️  ${result.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log('═══════════════════════════════════════════════════\n');
  
  results.forEach(r => {
    const icon = r.status === 'SUCCESS' ? '✅' : r.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${icon} ${r.env.padEnd(12)} - ${r.status}`);
  });
  
  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  console.log(`\n${successCount}/${environments.length} databases connected successfully\n`);
  
  if (successCount < environments.length) {
    console.log('⚠️  Fix required:\n');
    results.filter(r => r.status !== 'SUCCESS').forEach(r => {
      console.log(`   ${r.env}: ${r.message}`);
    });
    console.log('\n');
  }
}

testAll().catch(console.error);
