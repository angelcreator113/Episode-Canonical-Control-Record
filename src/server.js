/**
 * HTTP Server Startup
 * Starts the Express app on the configured port
 * This file is separate from app.js so app.js can be used for testing
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');
const db = require('./models');
const sequelize = db.sequelize;
const { initializeSocket } = require('./sockets');
const { testRedisConnection, closeRedis } = require('./config/redis');
const { closeQueue } = require('./queues/videoQueue');

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

let server;
let isShuttingDown = false;

/**
 * Graceful Shutdown Handler
 * Ensures all connections are closed properly
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⏳ Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n📢 ${signal} received: starting graceful shutdown...`);

  // Stop accepting new requests
  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error('❌ Error closing HTTP server:', err);
      } else {
        console.log('✓ HTTP server closed');
      }

      try {
        // Close export queue
        console.log('🔌 Closing export queue...');
        await closeQueue();
        console.log('✓ Export queue closed');

        // Close Redis connection
        console.log('🔌 Closing Redis connection...');
        await closeRedis();
        console.log('✓ Redis connection closed');

        // Close database connections
        console.log('🔌 Closing database connections...');
        if (sequelize && typeof sequelize.close === 'function') {
          await sequelize.close();
        }
        console.log('✓ Database connections closed');

        console.log('👋 Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error('⏰ Shutdown timeout - forcing exit');
      process.exit(1);
    }, 10000); // 10 second timeout
  } else {
    process.exit(0);
  }
}

/**
 * Global Error Handlers
 */
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:');
  console.error(error);

  // In production, you might want to log to external service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Log to external error tracking service (e.g., Sentry)
  }

  // Attempt graceful shutdown
  gracefulShutdown('UNCAUGHT_EXCEPTION')
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  // Suppress Redis ECONNREFUSED rejections — expected when Redis is unavailable
  const msg = reason?.message || String(reason);
  if (msg.includes('ECONNREFUSED') && msg.includes('6379')) {
    // Silently ignore — Redis unavailability is already logged by redis.js / videoQueue.js
    return;
  }
  if (msg.includes('stopped reconnecting')) {
    return;
  }

  console.error('❌ UNHANDLED REJECTION:');
  console.error('Reason:', reason);
  console.error('Promise:', promise);

  // In production, log to external service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Log to external error tracking service
  }

  // Don't exit on unhandled rejection in development
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION')
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  }
});

/**
 * Start Server
 */
async function startServer() {
  // Only start server if not in test mode
  if (process.env.NODE_ENV === 'test') {
    console.log('🧪 Test mode - skipping server startup');
    return;
  }

  try {
    // Test database connection before starting server
    console.log('🔌 Testing database connection...');
    try {
      await sequelize.authenticate();
      console.log('✓ Database connection established');
    } catch (dbError) {
      console.warn(
        '⚠️  Database not available, starting in degraded mode:',
        dbError.message.split('\n')[0]
      );
    }

    // Test Redis connection (non-blocking)
    console.log('🔌 Testing Redis connection...');
    const redisAvailable = await testRedisConnection();
    if (!redisAvailable) {
      console.warn('⚠️  Redis not available - export queue will not function');
      console.warn('   Install Redis or start Docker: docker run -d -p 6379:6379 redis:alpine');
    }

    // Create HTTP server (needed for Socket.io)
    const httpServer = http.createServer(app);

    // Initialize Socket.io
    console.log('🔌 Initializing Socket.io...');
    initializeSocket(httpServer);

    // Start HTTP server
    server = httpServer;
    server.listen(PORT, HOST, () => {
      console.log('\n🚀 Episode Metadata API Server Started');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✓ Server:      http://${HOST}:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API Version: ${process.env.API_VERSION || 'v1'}`);
      console.log(`✓ Socket.io:   enabled`);
      console.log(`✓ Redis:       ${redisAvailable ? 'connected' : '⚠️  unavailable'}`);
      console.log(`✓ Export Queue: ${redisAvailable ? 'ready' : '⚠️  degraded'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 Ready to accept requests\n');
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);

      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error(`💡 Try: lsof -ti:${PORT} | xargs kill -9`);
        process.exit(1);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${PORT}`);
        console.error(`💡 Try using a port > 1024 or run with sudo`);
        process.exit(1);
      } else {
        console.error('❌ Unexpected server error:', error);
        process.exit(1);
      }
    });

    // Handle client errors (malformed requests, etc.)
    server.on('clientError', (err, socket) => {
      console.error('❌ Client error:', err.message);

      // Send error response if socket is still writable
      if (socket.writable && !socket.destroyed) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

    // Handle connection events
    server.on('connection', (socket) => {
      // Set socket timeout to prevent hanging connections
      socket.setTimeout(120000); // 2 minutes

      socket.on('timeout', () => {
        console.warn('⏰ Socket timeout - closing connection');
        socket.destroy();
      });
    });

    // Handle graceful shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle Windows-specific signals
    if (process.platform === 'win32') {
      process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
    }
  } catch (error) {
    console.error('❌ Failed to start server:');
    console.error(error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  // Only start if this file is run directly
  startServer().catch((error) => {
    console.error('❌ Fatal error during server startup:');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { app, startServer };
