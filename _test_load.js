try {
  require('./src/routes/memories');
  console.log('OK — memories.js loaded successfully');
} catch (e) {
  console.log('FAIL:', e.message);
}
