// Quick test: can we load the scene library routes?
try {
  const sceneLibraryRoutes = require('./src/routes/sceneLibrary');
  console.log('✅ Scene library routes loaded successfully');
  console.log('Route type:', typeof sceneLibraryRoutes);
} catch (error) {
  console.error('❌ Failed to load scene library routes:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
