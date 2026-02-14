const { sequelize } = require('./src/models');
const { QueryTypes } = require('sequelize');

async function test() {
  try {
    console.log('Testing raw SQL query...\n');
    
    const episodeId = '78ca43be-77c8-4f8a-8c19-ef5956a1b07d';
    
    const scenes = await sequelize.query(
      `
      SELECT 
        s.*,
        NULL as thumbnail
      FROM scenes s
      WHERE s.episode_id = :episodeId::uuid
        AND s.deleted_at IS NULL
      ORDER BY s.scene_number ASC
      `,
      {
        replacements: { episodeId },
        type: QueryTypes.SELECT
      }
    );
    
    console.log('✓ Query succeeded!');
    console.log('Scenes found:', scenes.length);
    console.log('First scene:', scenes[0] ? scenes[0].id : 'none');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('SQL:', error.sql);
    process.exit(1);
  }
}

test();
