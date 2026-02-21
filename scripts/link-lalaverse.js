'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/models');

(async () => {
  try {
    await db.sequelize.authenticate();

    // Link "Before Lala" to "Becoming Prime" series
    await db.sequelize.query(
      `UPDATE storyteller_books SET series_id = 'f81bd5df-be12-45ec-adfa-ed47f7a59bac' WHERE id = 'd6590587-a09e-4cc1-adfb-b09d4da5ad06'`
    );
    console.log('Book "Before Lala" linked to series "Becoming Prime".');

    // Link "Styling Adventures with lala" to LalaVerse universe
    await db.sequelize.query(
      `UPDATE shows SET universe_id = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e' WHERE id = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b'`
    );
    console.log('Show "Styling Adventures with lala" linked to LalaVerse universe.');

    await db.sequelize.close();
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
})();
