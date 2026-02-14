const { models } = require('./src/models');

console.log('Available models:');
console.log(Object.keys(models).sort().join(', '));

console.log('\nSceneLibrary:', models.SceneLibrary ? '✅ Available' : '❌ Missing');
console.log('EpisodeScene:', models.EpisodeScene ? '✅ Available' : '❌ Missing');

if (models.SceneLibrary) {
  console.log('\nSceneLibrary methods:');
  console.log('  - findAndCountAll:', typeof models.SceneLibrary.findAndCountAll);
  console.log('  - findByPk:', typeof models.SceneLibrary.findByPk);
  console.log('  - create:', typeof models.SceneLibrary.create);
}
