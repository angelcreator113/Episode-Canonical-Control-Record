const {sequelize} = require('./src/models');

const sceneId = 'd6c6a078-667d-44a6-80c6-4a2bd65e6bb1';

sequelize.query(`SELECT id, title FROM scenes WHERE id = '${sceneId}'`)
  .then(([r]) => {
    if (r.length > 0) {
      console.log('✓ Scene found:', r[0].title);
      process.exit(0);
    } else {
      console.log('✗ Scene NOT found with that ID');
      console.log('\nAvailable scenes:');
      return sequelize.query('SELECT id, title FROM scenes LIMIT 5');
    }
  })
  .then(([scenes]) => {
    if (scenes) {
      scenes.forEach(s => console.log(`  - ${s.id}: ${s.title}`));
    }
    process.exit(0);
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
