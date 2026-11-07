/**
 * Worker Process Entry Point
 * Run separately from the main API server to process export jobs.
 *
 * Usage:
 *   npm run worker          (production)
 *   npm run dev:worker      (development with auto-reload)
 *
 * Issue #3714: the worker runs only when GENERATION_WORKER_ENABLED is "true",
 * and in production only as its own database login, read from its mode-600
 * credential file (Option B), with no fallback and no password in the
 * environment (src/workers/workerStartup.js). The login is held in memory
 * (src/config/dbCredentials.js) and never written to process.env, so FFmpeg
 * and every other child process inherit no database password. The decision
 * is made before the video renderer (Bull/Redis) or the scene worker (models,
 * boot recovery, polling, AI cost tracking) is loaded, so a disabled or
 * refused worker touches none of them.
 */

require('dotenv').config();

const { decideStartup, scrubDbEnv, EXIT_CONFIG } = require('./workerStartup');
const { setDbCredentials } = require('../config/dbCredentials');

const defaultDeps = {
  loadRenderer: () => require('./videoRenderer'),
  loadSceneWorker: () => require('./sceneGenerationWorker'),
  exit: (code) => process.exit(code),
  // A disabled worker stays up without doing anything, so pm2 does not
  // restart it in a loop; it ends on SIGTERM / SIGINT like a running one.
  keepAlive: () => setInterval(() => {}, 1 << 30),
  log: (...a) => console.log(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};

function main(env = process.env, deps = defaultDeps) {
  const d = { ...defaultDeps, ...deps };
  const decision = decideStartup(env);

  d.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  d.log('📦 Episode Export Worker');
  d.log(`   Environment: ${env.NODE_ENV || 'development'}`);

  if (decision.action === 'disabled') {
    d.log(`   ${decision.message}`);
    d.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const timer = d.keepAlive();
    return { action: 'disabled', timer };
  }

  if (decision.action === 'refuse') {
    d.error(`❌ ${decision.message}`);
    d.exit(EXIT_CONFIG);
    return { action: 'refuse' };
  }

  if (decision.identity === 'worker') {
    // In memory only; config/sequelize.js reads it when the models connect.
    setDbCredentials(decision.credentials);
    scrubDbEnv(env);
  }
  d.log(`   Database login: ${decision.identity === 'worker' ? 'the worker\'s own (credential file)' : 'shared DB_* settings (development)'}`);
  d.log(`   Redis: ${env.REDIS_HOST || '127.0.0.1'}:${env.REDIS_PORT || 6379}`);
  d.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Load the video renderer (registers the Bull job processor)
  // This requires Redis — if unavailable, skip gracefully so scene gen still works
  try {
    d.loadRenderer();
    d.log('✅ Worker process started — monitoring queue: video-export');
  } catch (err) {
    d.warn('⚠️  Video renderer failed to start (Redis may be unavailable):', err.message);
    d.warn('   Video exports will be unavailable, but scene generation will still work.');
  }

  // Load the scene generation worker (DB-polling processor)
  const sceneGenWorker = d.loadSceneWorker();
  sceneGenWorker.start();

  d.log('✅ Scene generation worker started — monitoring queue: generation_jobs');
  return { action: 'run', sceneGenWorker };
}

if (require.main === module) {
  const result = main();

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n📢 ${signal} received — shutting down worker...`);
    if (result.sceneGenWorker) result.sceneGenWorker.stop();
    if (result.timer) clearInterval(result.timer);
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
}

module.exports = { main };
