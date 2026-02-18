// Temporary script to check all shows on dev (including soft-deleted)
require('dotenv').config();
const { Sequelize } = require('sequelize');

const seq = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

(async () => {
  try {
    const [all] = await seq.query('SELECT id, name, created_at, deleted_at FROM shows ORDER BY created_at DESC');
    console.log('All shows (including soft-deleted):');
    console.log(JSON.stringify(all, null, 2));
    
    const [target] = await seq.query("SELECT id, name, created_at, deleted_at FROM shows WHERE id = '823c665b-6abc-45e5-b837-77116e939176'");
    console.log('\nTarget show 823c665b:', target.length ? JSON.stringify(target[0]) : 'NOT FOUND (even with deleted)');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await seq.close();
  }
})();
