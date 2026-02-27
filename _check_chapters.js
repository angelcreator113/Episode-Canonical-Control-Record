const db = require('./src/models');
(async () => {
  const BEFORE_LALA_ID = 'd6590587-a09e-4cc1-adfb-b09d4da5ad06';
  const TEST_BOOK_ID = 'deb6729d-e689-4180-9ccd-8cee5cc28b95';

  // Hard-delete chapters from "Before Lala"
  const deletedChapters = await db.StorytellerChapter.destroy({
    where: { book_id: BEFORE_LALA_ID },
    force: true,
  });
  console.log('Deleted ' + deletedChapters + ' chapters from "Before Lala"');

  // Hard-delete "Before Lala" book
  const d1 = await db.StorytellerBook.destroy({
    where: { id: BEFORE_LALA_ID },
    force: true,
  });
  console.log('Deleted "Before Lala" book:', d1 ? 'OK' : 'NOT FOUND');

  // Hard-delete "Test Book Design Check" book (no chapters)
  const d2 = await db.StorytellerBook.destroy({
    where: { id: TEST_BOOK_ID },
    force: true,
  });
  console.log('Deleted "Test Book Design Check" book:', d2 ? 'OK' : 'NOT FOUND');

  // Verify
  const totalBooks = await db.StorytellerBook.count();
  const totalChapters = await db.StorytellerChapter.count();
  console.log('\nRemaining: ' + totalBooks + ' book(s), ' + totalChapters + ' chapter(s)');
  process.exit();
})();
