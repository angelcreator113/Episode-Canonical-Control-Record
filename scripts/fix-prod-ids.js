// Fix LalaVerse IDs on production to match the hardcoded frontend IDs
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/models');

const EXPECTED_UNIVERSE_ID = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e';
const EXPECTED_SERIES_ID = 'f81bd5df-be12-45ec-adfa-ed47f7a59bac';

async function fix() {
  await db.sequelize.authenticate();
  console.log('DB connected.');

  // Get the current IDs
  const [universes] = await db.sequelize.query("SELECT id FROM universes WHERE slug='lalaverse' LIMIT 1");
  const currentUniId = universes[0]?.id;
  console.log('Current universe ID:', currentUniId);

  if (currentUniId && currentUniId !== EXPECTED_UNIVERSE_ID) {
    // Use a transaction with deferred constraints
    const t = await db.sequelize.transaction();
    try {
      await db.sequelize.query('SET CONSTRAINTS ALL DEFERRED', { transaction: t });

      // Update universe ID
      await db.sequelize.query(`UPDATE universes SET id='${EXPECTED_UNIVERSE_ID}' WHERE id='${currentUniId}'`, { transaction: t });
      console.log('Updated universe ID to', EXPECTED_UNIVERSE_ID);

      // Update child FKs
      await db.sequelize.query(`UPDATE book_series SET universe_id='${EXPECTED_UNIVERSE_ID}' WHERE universe_id='${currentUniId}'`, { transaction: t });
      console.log('Updated book_series FK');
      await db.sequelize.query(`UPDATE shows SET universe_id='${EXPECTED_UNIVERSE_ID}' WHERE universe_id='${currentUniId}'`, { transaction: t });
      console.log('Updated shows FK');

      await t.commit();
      console.log('Transaction committed.');
    } catch (e) {
      await t.rollback();
      console.log('Transaction failed, trying DELETE + INSERT approach...');
      
      // Alternative: delete and re-insert with correct ID
      const [uniData] = await db.sequelize.query(`SELECT * FROM universes WHERE slug='lalaverse' LIMIT 1`);
      const uni = uniData[0];
      const [seriesData] = await db.sequelize.query(`SELECT * FROM book_series WHERE universe_id='${currentUniId}'`);
      
      // Drop FKs, update, re-add
      await db.sequelize.query(`ALTER TABLE book_series DROP CONSTRAINT IF EXISTS book_series_universe_id_fkey`);
      await db.sequelize.query(`ALTER TABLE shows DROP CONSTRAINT IF EXISTS shows_universe_id_fkey`);
      
      await db.sequelize.query(`UPDATE book_series SET universe_id='${EXPECTED_UNIVERSE_ID}' WHERE universe_id='${currentUniId}'`);
      await db.sequelize.query(`UPDATE shows SET universe_id='${EXPECTED_UNIVERSE_ID}' WHERE universe_id='${currentUniId}'`);
      await db.sequelize.query(`UPDATE universes SET id='${EXPECTED_UNIVERSE_ID}' WHERE id='${currentUniId}'`);
      
      // Re-add FKs
      await db.sequelize.query(`ALTER TABLE book_series ADD CONSTRAINT book_series_universe_id_fkey FOREIGN KEY (universe_id) REFERENCES universes(id) ON UPDATE CASCADE ON DELETE SET NULL`);
      await db.sequelize.query(`ALTER TABLE shows ADD CONSTRAINT shows_universe_id_fkey FOREIGN KEY (universe_id) REFERENCES universes(id) ON UPDATE CASCADE ON DELETE SET NULL`);
      
      console.log('Fixed via DROP/ADD constraint approach');
    }
  }

  // Fix series ID
  const [seriesList] = await db.sequelize.query(`SELECT id FROM book_series WHERE universe_id='${EXPECTED_UNIVERSE_ID}' AND name='Becoming Prime' LIMIT 1`);
  const currentSeriesId = seriesList[0]?.id;
  console.log('Current series ID:', currentSeriesId);

  if (currentSeriesId && currentSeriesId !== EXPECTED_SERIES_ID) {
    // Drop FK, update, re-add
    await db.sequelize.query(`ALTER TABLE storyteller_books DROP CONSTRAINT IF EXISTS storyteller_books_series_id_fkey`);
    await db.sequelize.query(`UPDATE storyteller_books SET series_id='${EXPECTED_SERIES_ID}' WHERE series_id='${currentSeriesId}'`);
    await db.sequelize.query(`UPDATE book_series SET id='${EXPECTED_SERIES_ID}' WHERE id='${currentSeriesId}'`);
    await db.sequelize.query(`ALTER TABLE storyteller_books ADD CONSTRAINT storyteller_books_series_id_fkey FOREIGN KEY (series_id) REFERENCES book_series(id) ON UPDATE CASCADE ON DELETE SET NULL`);
    console.log('Updated series ID to', EXPECTED_SERIES_ID);
  }

  // Link the show
  const [shows] = await db.sequelize.query("SELECT id,name FROM shows LIMIT 5");
  console.log('Shows:', JSON.stringify(shows));
  if (shows.length > 0) {
    await db.sequelize.query(`UPDATE shows SET universe_id='${EXPECTED_UNIVERSE_ID}' WHERE universe_id IS NULL OR universe_id != '${EXPECTED_UNIVERSE_ID}'`);
    console.log('Linked shows to universe');
  }

  // Link books to series
  const [books] = await db.sequelize.query("SELECT id,title,series_id FROM storyteller_books LIMIT 10");
  console.log('Books:', JSON.stringify(books));
  for (const book of books) {
    if (!book.series_id) {
      await db.sequelize.query(`UPDATE storyteller_books SET series_id='${EXPECTED_SERIES_ID}' WHERE id='${book.id}'`);
      console.log(`Linked book "${book.title}" to Becoming Prime series`);
    }
  }

  console.log('\nDone! Verifying...');
  const [u] = await db.sequelize.query(`SELECT id,name FROM universes WHERE id='${EXPECTED_UNIVERSE_ID}'`);
  const [s] = await db.sequelize.query(`SELECT id,name FROM book_series WHERE id='${EXPECTED_SERIES_ID}'`);
  console.log('Universe:', JSON.stringify(u));
  console.log('Series:', JSON.stringify(s));

  await db.sequelize.close();
}
fix().catch(e => { console.error(e); process.exit(1); });
