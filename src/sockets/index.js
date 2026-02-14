/**
 * Socket.io Server Configuration
 * Real-time communication for export progress, notifications, and collaboration
 */

const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.io with the HTTP server
 * @param {import('http').Server} httpServer - The HTTP server instance
 * @returns {Server} Socket.io server instance
 */
function initializeSocket(httpServer) {
  const corsOrigins = (process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5174')
    .split(',')
    .map((s) => s.trim());

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ========================================================================
  // Connection Handling
  // ========================================================================

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ------------------------------------------------------------------
    // Join export-specific room for targeted progress updates
    // ------------------------------------------------------------------
    socket.on('join-export', (exportJobId) => {
      const room = `export:${exportJobId}`;
      socket.join(room);
      console.log(`📺 Client ${socket.id} joined room ${room}`);
    });

    socket.on('leave-export', (exportJobId) => {
      const room = `export:${exportJobId}`;
      socket.leave(room);
      console.log(`📺 Client ${socket.id} left room ${room}`);
    });

    // ------------------------------------------------------------------
    // Join episode room for collaboration features (future)
    // ------------------------------------------------------------------
    socket.on('join-episode', (episodeId) => {
      const room = `episode:${episodeId}`;
      socket.join(room);
      console.log(`📺 Client ${socket.id} joined room ${room}`);
    });

    socket.on('leave-episode', (episodeId) => {
      const room = `episode:${episodeId}`;
      socket.leave(room);
    });

    // ------------------------------------------------------------------
    // Disconnect
    // ------------------------------------------------------------------
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`❌ Socket error (${socket.id}):`, err.message);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}

// ============================================================================
// Emit Helpers — used by export workers and routes
// ============================================================================

/**
 * Emit export progress to clients watching a specific job
 * @param {string} jobId - The export job ID
 * @param {Object} data - Progress data { percent, stage, message }
 */
function emitExportProgress(jobId, data) {
  if (io) {
    io.to(`export:${jobId}`).emit('export:progress', {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit export completion
 * @param {string} jobId - The export job ID
 * @param {Object} result - { outputPath, downloadUrl, duration, fileSize }
 */
function emitExportComplete(jobId, result) {
  if (io) {
    io.to(`export:${jobId}`).emit('export:complete', {
      jobId,
      ...result,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit export failure
 * @param {string} jobId - The export job ID
 * @param {Object} error - { message, code, retriesLeft }
 */
function emitExportFailed(jobId, error) {
  if (io) {
    io.to(`export:${jobId}`).emit('export:failed', {
      jobId,
      ...error,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit a notification to all connected clients
 * @param {Object} notification - { type, title, message }
 */
function emitNotification(notification) {
  if (io) {
    io.emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Get the Socket.io instance (for use in routes/middleware)
 * @returns {Server|null}
 */
function getIO() {
  return io;
}

/**
 * Get connected client count
 * @returns {number}
 */
function getConnectedClients() {
  if (io) {
    return io.engine.clientsCount;
  }
  return 0;
}

module.exports = {
  initializeSocket,
  emitExportProgress,
  emitExportComplete,
  emitExportFailed,
  emitNotification,
  getIO,
  getConnectedClients,
};
