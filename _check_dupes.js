require('dotenv').config();
const { Sequelize } = require('sequelize');
const seq = new Sequelize(process.env.DATABASE_URL, { logging: false });

(async () => {
  try {
    // Find duplicates
    const [dupes] = await seq.query(`
      SELECT handle, platform, COUNT(*) as cnt
      FROM social_profiles
      GROUP BY handle, platform
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 20
    `);
    console.log('Duplicates found:', dupes.length);
    dupes.forEach(d => console.log('  @' + d.handle, d.platform, 'x' + d.cnt));

    if (dupes.length > 0) {
      // Delete duplicates, keeping the newest (highest id) for each handle+platform
      const [deleted] = await seq.query(`
        DELETE FROM social_profiles
        WHERE id NOT IN (
          SELECT MAX(id)
          FROM social_profiles
          GROUP BY handle, platform
        )
        RETURNING id, handle, platform
      `);
      console.log('\nDeleted', deleted.length, 'duplicate rows');
    }
    
    // Show total count
    const [total] = await seq.query('SELECT COUNT(*) as cnt FROM social_profiles');
    console.log('Total profiles remaining:', total[0].cnt);
    
    await seq.close();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
