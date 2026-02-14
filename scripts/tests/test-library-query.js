const { models } = require('./src/models');
const { WardrobeLibrary } = models;

async function testLibraryQuery() {
  try {
    console.log('Testing Wardrobe Library count query...');
    
    const total = await WardrobeLibrary.count({ where: { deletedAt: null } });
    console.log('✅ Total count:', total);
    
    const items = await WardrobeLibrary.count({ where: { type: 'item', deletedAt: null } });
    console.log('✅ Items count:', items);
    
    const sets = await WardrobeLibrary.count({ where: { type: 'set', deletedAt: null } });
    console.log('✅ Sets count:', sets);
    
    console.log('\n✅ All queries succeeded!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testLibraryQuery();
