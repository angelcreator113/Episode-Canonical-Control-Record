/**
 * SocketService - WebSocket Server Management
 * Phase 3A: Real-time Notifications System
 *
 * Manages Socket.IO connections, namespaces, rooms, and authentication
 * Handles connection/disconnection events and provides broadcasting utilities
 */

const logger = require('./Logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connections = new Map();
    this.userSockets = new Map();
    this.rooms = new Map();
    this.namespaces = new Map();
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.maxConnections = parseInt(process.env.MAX_SOCKET_CONNECTIONS || '500');
    this.connectionCount = 0;
    this.initialized = false;
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.initialized && this.io !== null;
  }

  /**
   * Initialize Socket.IO server with Express HTTP server
   */
  initialize(httpServer) {
    try {
      const SocketIO = require('socket.io');
      const jwt = require('jsonwebtoken');

      const corsOptions = {
        origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
        credentials: process.env.SOCKET_CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST'],
      };

      this.io = new SocketIO(httpServer, {
        cors: corsOptions,
        transports: ['websocket', 'polling'],
        reconnectionDelay: parseInt(process.env.SOCKET_RECONNECTION_DELAY || '1000'),
        reconnectionDelayMax: parseInt(process.env.SOCKET_RECONNECTION_MAX_DELAY || '5000'),
      });

      // Setup namespaces
      this.setupNamespaces();

      // Setup global connection handler
      this.io.use(this.authenticateConnection.bind(this));

      this.initialized = true;

      if (logger && logger.info) {
        logger.info('Socket.IO server initialized', {
          maxConnections: this.maxConnections,
          corsOrigin: corsOptions.origin,
        });
      } else {
        console.log('✅ Socket.IO server initialized');
      }

      return this.io;
    } catch (error) {
      console.error('❌ Failed to initialize Socket.IO:', error.message);
      this.initialized = false;
      return null;
    }
  }

  /**
   * Setup Socket.IO namespaces for different event types
   */
  setupNamespaces() {
    if (!this.io) return;

    const namespaceNames = ['/jobs', '/episodes', '/admin', '/feed'];

    namespaceNames.forEach((namespaceName) => {
      const namespace = this.io.of(namespaceName);
      this.namespaces.set(namespaceName, namespace);

      namespace.on('connection', (socket) => {
        this.handleConnectionToNamespace(socket, namespaceName);
      });
    });
  }

  /**
   * Authenticate WebSocket connection with JWT token
   */
  authenticateConnection(socket, next) {
    try {
      const jwt = require('jsonwebtoken');
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: no token provided'));
      }

      const decoded = jwt.verify(token, this.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.role = decoded.role;

      next();
    } catch (error) {
      if (logger && logger.warn) {
        logger.warn('Socket authentication failed', {
          error: error.message,
          socketId: socket.id,
        });
      }
      next(new Error(`Authentication error: ${error.message}`));
    }
  }

  /**
   * Handle new connection to a specific namespace
   */
  handleConnectionToNamespace(socket, namespaceName) {
    const { userId } = socket;

    // Check connection limit
    if (this.connectionCount >= this.maxConnections) {
      socket.disconnect();
      return;
    }

    this.connectionCount++;

    // Store connection mapping
    this.connections.set(socket.id, {
      socket,
      userId,
      namespace: namespaceName,
      connectedAt: new Date(),
    });

    // Track user sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    // Setup namespace-specific handlers
    this.setupNamespaceHandlers(socket, namespaceName);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket.id, userId);
    });

    // Send connection confirmation
    socket.emit('connected', {
      socketId: socket.id,
      userId,
      namespace: namespaceName,
    });
  }

  /**
   * Setup event handlers specific to namespace
   */
  setupNamespaceHandlers(socket, namespaceName) {
    if (namespaceName === '/jobs') {
      socket.on('subscribe:job', (jobId) => {
        socket.join(`job:${jobId}`);
      });
      socket.on('unsubscribe:job', (jobId) => {
        socket.leave(`job:${jobId}`);
      });
    }

    if (namespaceName === '/episodes') {
      socket.on('subscribe:episode', (episodeId) => {
        socket.join(`episode:${episodeId}`);
      });
      socket.on('unsubscribe:episode', (episodeId) => {
        socket.leave(`episode:${episodeId}`);
      });
      socket.on('viewing:episode', (episodeId) => {
        this.broadcastPresence(socket.userId, 'episode', episodeId, socket.id);
      });
    }

    if (namespaceName === '/feed') {
      socket.join(`feed:user:${socket.userId}`);
      socket.join('feed:public');
    }

    if (namespaceName === '/admin') {
      if (socket.role !== 'admin') {
        socket.disconnect();
      }
    }
  }

  /**
   * Handle user disconnection
   */
  handleDisconnection(socketId, userId) {
    this.connections.delete(socketId);

    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socketId);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.connectionCount--;
  }

  /**
   * Broadcast event to specific namespace
   */
  broadcast(namespaceName, event, data) {
    if (!this.isInitialized()) return;
    if (!this.namespaces.has(namespaceName)) return;

    this.namespaces.get(namespaceName).emit(event, data);
  }

  /**
   * Send event to specific room
   */
  toRoom(namespaceName, roomId, event, data) {
    if (!this.isInitialized()) return;
    if (!this.namespaces.has(namespaceName)) return;

    this.namespaces.get(namespaceName).to(roomId).emit(event, data);
  }

  /**
   * Send event to specific user (all their connections)
   */
  toUser(userId, namespaceName, event, data) {
    if (!this.isInitialized()) return;
    if (!this.userSockets.has(userId)) return;

    const namespace = this.namespaces.get(namespaceName);
    if (!namespace) return;

    this.userSockets.get(userId).forEach((socketId) => {
      const socket = namespace.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  /**
   * Get list of connected users
   */
  getConnectedUsers() {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Get total number of active connections
   */
  getConnectionCount() {
    return this.connectionCount;
  }

  /**
   * Get detailed statistics
   */
  getStatistics() {
    if (!this.isInitialized()) {
      return {
        initialized: false,
        totalConnections: 0,
        uniqueUsers: 0,
      };
    }

    const stats = {
      initialized: true,
      totalConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      uniqueUsers: this.userSockets.size,
      namespaces: {},
    };

    this.namespaces.forEach((namespace, namespaceName) => {
      stats.namespaces[namespaceName] = {
        socketCount: namespace.sockets.size,
      };
    });

    return stats;
  }

  /**
   * Broadcast generic message to all connected clients
   * SAFE VERSION - Returns promise even if not initialized
   */
  broadcastMessage(message) {
    return new Promise((resolve) => {
      try {
        if (!this.isInitialized()) {
          // Silently skip if not initialized
          return resolve();
        }

        const msgWithTimestamp = {
          ...message,
          timestamp: new Date().toISOString(),
        };

        this.io.emit('message', msgWithTimestamp);
        resolve();
      } catch (error) {
        // Log error but don't reject - we don't want to break episode creation
        if (logger && logger.error) {
          logger.error('Error broadcasting message:', error);
        }
        resolve();
      }
    });
  }

  /**
   * Broadcast presence information when user views a resource
   */
  broadcastPresence(userId, resourceType, resourceId, socketId) {
    if (!this.isInitialized()) return;

    const event = {
      userId,
      resourceType,
      resourceId,
      timestamp: new Date(),
    };

    if (resourceType === 'episode') {
      this.toRoom('/episodes', `episode:${resourceId}`, 'user:viewing', event);
    }
  }

  /**
   * Force disconnect a socket
   */
  closeConnection(socketId) {
    if (!this.isInitialized()) return;

    const connection = this.connections.get(socketId);
    if (connection) {
      connection.socket.disconnect();
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.io) {
      this.io.close();
      this.initialized = false;
      if (logger && logger.info) {
        logger.info('Socket.IO server shut down gracefully');
      } else {
        console.log('✅ Socket.IO server shut down');
      }
    }
  }
}

// Export singleton instance
module.exports = new SocketService();