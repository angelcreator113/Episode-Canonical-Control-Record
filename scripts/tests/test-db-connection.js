const { Sequelize } = require('sequelize');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:Ayanna123@127.0.0.1:5432/episode_metadata';

console.log('🔗 Testing database connection with URL:', DB_URL.replace(/:[^:@]+@/, ':***@'));

const sequelize = new Sequelize(DB_URL, {
  dialect: 'postgres',
  logging: (msg) => console.log('📝 SQL:', msg)
});

async function test() {
  try {
    console.log('\n1️⃣ Testing connection...');
    await sequelize.authenticate();
    console.log('✅ Connection successful!');

    console.log('\n2️⃣ Checking search_path (schema)...');
    const [search_path] = await sequelize.query('SHOW search_path');
    console.log('   search_path:', search_path);

    console.log('\n3️⃣ Listing tables in public schema...');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('   Tables found:', tables.length);
    tables.forEach(t => console.log('   -', t.table_name));

    console.log('\n4️⃣ Checking if scenes table exists...');
    const [sceneTable] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scenes'
      ) as exists
    `);
    console.log('   scenes table exists:', sceneTable[0].exists);

    console.log('\n5️⃣ Trying to query scenes table...');
    const [scenes] = await sequelize.query('SELECT COUNT(*) as count FROM scenes');
    console.log('   ✅ SUCCESS! Scene count:', scenes[0].count);

    console.log('\n6️⃣ Trying to query one scene...');
    const [oneScene] = await sequelize.query('SELECT id, title FROM scenes LIMIT 1');
    console.log('   ✅ SUCCESS! First scene:', oneScene[0]);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Full error:', error);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Connection closed');
  }
}

test();
