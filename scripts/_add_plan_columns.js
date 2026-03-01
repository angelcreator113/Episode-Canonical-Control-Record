const { Sequelize } = require('sequelize');
const s = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  }
);

(async () => {
  const qi = s.getQueryInterface();

  // Add columns to storyteller_books
  const bookCols = ['theme', 'pov', 'tone', 'setting', 'conflict', 'stakes'];
  for (const col of bookCols) {
    try {
      await qi.addColumn('storyteller_books', col, { type: Sequelize.TEXT, allowNull: true });
      console.log(`Added storyteller_books.${col}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`storyteller_books.${col} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }

  // Add columns to storyteller_chapters
  const chapterCols = ['tone', 'setting', 'conflict', 'stakes', 'hooks'];
  for (const col of chapterCols) {
    try {
      await qi.addColumn('storyteller_chapters', col, { type: Sequelize.TEXT, allowNull: true });
      console.log(`Added storyteller_chapters.${col}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`storyteller_chapters.${col} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }

  console.log('\nDone! All columns added.');
  await s.close();
})().catch(e => { console.error('MIGRATION FAILED:', e.message); process.exit(1); });
