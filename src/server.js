/**
 * HTTP Server Startup
 * Starts the Express app on the configured port
 * This file is separate from app.js so app.js can be used for testing
 */

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

let server;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`✓ Episode Metadata API listening on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV}`);
    console.log(`✓ API Version: ${process.env.API_VERSION}`);
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
    }
  });

  server.on('clientError', (err, socket) => {
    console.error('❌ Client error:', err);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📢 SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('✓ HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('📢 SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('✓ HTTP server closed');
      process.exit(0);
    });
  });
}

module.exports = server;
