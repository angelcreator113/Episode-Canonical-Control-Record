/**
 * Worker Process Entry Point
 * Run separately from the main API server to process export jobs.
 *
 * Usage:
 *   npm run worker          (production)
 *   npm run dev:worker      (development with auto-reload)
 */

require('dotenv').config();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📦 Episode Export Worker');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Redis: ${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Load the video renderer (registers the Bull job processor)
require('./videoRenderer');

console.log('✅ Worker process started — monitoring queue: video-export');

// Load the scene generation worker (DB-polling processor)
const sceneGenWorker = require('./sceneGenerationWorker');
sceneGenWorker.start();

console.log('✅ Scene generation worker started — monitoring queue: generation_jobs');

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n📢 ${signal} received — shutting down worker...`);
  sceneGenWorker.stop();
  // Bull will finish the current job before exiting
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));
}

process.on('uncaughtException', (err) => {
  console.error('❌ Worker uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Worker unhandled rejection:', reason);
});
