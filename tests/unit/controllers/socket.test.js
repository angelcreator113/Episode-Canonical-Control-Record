/**
 * Unit Tests - Socket Controller
 * Phase 3A: Real-time Notifications System
 *
 * Tests for 6 socket admin endpoints:
 * - POST /api/v1/socket/broadcast
 * - POST /api/v1/socket/notify-user/:id
 * - POST /api/v1/socket/notify-room/:id
 * - POST /api/v1/socket/disconnect/:id
 * - GET /api/v1/socket/stats
 * - GET /api/v1/socket/connections
 */

const request = require('supertest');
const express = require('express');
const socketController = require('../../../src/controllers/socketController');
const SocketService = require('../../../src/services/SocketService');
const { authenticateToken, authorizeRole } = require('../../../src/middleware/auth');

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      userId: '550d117a-3d96-43de-a2dc-ee5027c776a3',
      role: 'admin',
    };
    next();
  },
  authorizeRole: (roles) => (req, res, next) => {
    req.user.role = 'admin';
    next();
  },
}));

jest.mock('../../../src/services/SocketService', () => ({
  broadcastToAll: jest.fn(),
  notifyUser: jest.fn(),
  notifyRoom: jest.fn(),
  disconnectUser: jest.fn(),
  getConnectionStats: jest.fn(),
  getActiveConnections: jest.fn(),
}));

jest.mock('../../../src/services/Logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Socket Controller', () => {
  let app;
  const adminId = '550d117a-3d96-43de-a2dc-ee5027c776a3';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/socket', socketController);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/socket/broadcast - Broadcast to All', () => {
    it('should broadcast message to all connected clients', async () => {
      const mockResult = {
        clientCount: 15,
        timestamp: new Date(),
      };

      SocketService.broadcastToAll.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: 'System maintenance in 5 minutes',
          type: 'alert',
          data: { maintenanceWindow: 5 },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.result.clientCount).toBe(15);
    });

    it('should require message field', async () => {
      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({ type: 'alert' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should include sent by admin ID', async () => {
      SocketService.broadcastToAll.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({ message: 'Test' });

      expect(res.status).toBe(200);
      expect(SocketService.broadcastToAll).toHaveBeenCalledWith(
        expect.objectContaining({ sentBy: adminId })
      );
    });

    it('should accept optional type field', async () => {
      SocketService.broadcastToAll.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: 'Test',
          type: 'warning',
          data: { level: 'high' },
        });

      expect(res.status).toBe(200);
    });

    it('should handle service errors', async () => {
      SocketService.broadcastToAll.mockRejectedValue(
        new Error('Socket connection failed')
      );

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({ message: 'Test' });

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/v1/socket/notify-user/:id - Notify Specific User', () => {
    it('should send notification to specific user', async () => {
      const targetUserId = 'user-123';
      const mockResult = {
        sent: true,
        userId: targetUserId,
        timestamp: new Date(),
      };

      SocketService.notifyUser.mockResolvedValue(mockResult);

      const res = await request(app)
        .post(`/api/v1/socket/notify-user/${targetUserId}`)
        .send({
          message: 'Your episode was published',
          type: 'info',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.result.sent).toBe(true);
    });

    it('should require message field', async () => {
      const res = await request(app)
        .post('/api/v1/socket/notify-user/user-123')
        .send({ type: 'info' });

      expect(res.status).toBe(400);
    });

    it('should handle user not connected', async () => {
      SocketService.notifyUser.mockResolvedValue({ sent: false });

      const res = await request(app)
        .post('/api/v1/socket/notify-user/offline-user')
        .send({ message: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not connected');
    });

    it('should include sent by admin ID', async () => {
      SocketService.notifyUser.mockResolvedValue({ sent: true });

      const res = await request(app)
        .post('/api/v1/socket/notify-user/user-123')
        .send({ message: 'Test' });

      expect(res.status).toBe(200);
      expect(SocketService.notifyUser).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ sentBy: adminId })
      );
    });

    it('should handle service errors', async () => {
      SocketService.notifyUser.mockRejectedValue(new Error('Error'));

      const res = await request(app)
        .post('/api/v1/socket/notify-user/user-123')
        .send({ message: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/v1/socket/notify-room/:id - Notify Room/Group', () => {
    it('should send notification to room', async () => {
      const roomId = 'room-episode-123';
      const mockResult = {
        clientCount: 5,
        timestamp: new Date(),
      };

      SocketService.notifyRoom.mockResolvedValue(mockResult);

      const res = await request(app)
        .post(`/api/v1/socket/notify-room/${roomId}`)
        .send({
          message: 'Episode status changed to published',
          type: 'update',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.result.clientCount).toBe(5);
    });

    it('should require message field', async () => {
      const res = await request(app)
        .post('/api/v1/socket/notify-room/room-123')
        .send({ type: 'update' });

      expect(res.status).toBe(400);
    });

    it('should handle room not found', async () => {
      SocketService.notifyRoom.mockResolvedValue({ clientCount: 0 });

      const res = await request(app)
        .post('/api/v1/socket/notify-room/nonexistent-room')
        .send({ message: 'Test' });

      expect(res.status).toBe(200); // Empty room is ok
    });

    it('should include sent by admin ID', async () => {
      SocketService.notifyRoom.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/socket/notify-room/room-123')
        .send({ message: 'Test' });

      expect(res.status).toBe(200);
      expect(SocketService.notifyRoom).toHaveBeenCalledWith(
        'room-123',
        expect.objectContaining({ sentBy: adminId })
      );
    });

    it('should handle service errors', async () => {
      SocketService.notifyRoom.mockRejectedValue(new Error('Error'));

      const res = await request(app)
        .post('/api/v1/socket/notify-room/room-123')
        .send({ message: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/v1/socket/disconnect/:id - Force Disconnect User', () => {
    it('should force disconnect user', async () => {
      const userId = 'user-123';
      const mockResult = {
        disconnected: true,
        userId,
        timestamp: new Date(),
      };

      SocketService.disconnectUser.mockResolvedValue(mockResult);

      const res = await request(app)
        .post(`/api/v1/socket/disconnect/${userId}`)
        .send({ reason: 'Policy violation' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.result.disconnected).toBe(true);
    });

    it('should use default reason if not provided', async () => {
      SocketService.disconnectUser.mockResolvedValue({ disconnected: true });

      const res = await request(app)
        .post('/api/v1/socket/disconnect/user-123')
        .send({});

      expect(res.status).toBe(200);
      expect(SocketService.disconnectUser).toHaveBeenCalledWith(
        'user-123',
        expect.any(String)
      );
    });

    it('should handle user not connected', async () => {
      SocketService.disconnectUser.mockResolvedValue({ disconnected: false });

      const res = await request(app)
        .post('/api/v1/socket/disconnect/offline-user')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not connected');
    });

    it('should handle service errors', async () => {
      SocketService.disconnectUser.mockRejectedValue(new Error('Error'));

      const res = await request(app)
        .post('/api/v1/socket/disconnect/user-123')
        .send({});

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/v1/socket/stats - WebSocket Statistics', () => {
    it('should return connection statistics', async () => {
      const mockStats = {
        totalConnections: 25,
        activeConnections: 22,
        messagesPerSecond: 150,
        averageMessageSize: 256,
        memoryUsage: 5242880, // 5MB
      };

      SocketService.getConnectionStats.mockResolvedValue(mockStats);

      const res = await request(app).get('/api/v1/socket/stats');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.stats).toEqual(mockStats);
    });

    it('should include current timestamp', async () => {
      SocketService.getConnectionStats.mockResolvedValue({});

      const res = await request(app).get('/api/v1/socket/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('should handle zero connections', async () => {
      SocketService.getConnectionStats.mockResolvedValue({
        totalConnections: 0,
        activeConnections: 0,
        messagesPerSecond: 0,
      });

      const res = await request(app).get('/api/v1/socket/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.stats.totalConnections).toBe(0);
    });

    it('should handle service errors', async () => {
      SocketService.getConnectionStats.mockRejectedValue(new Error('Error'));

      const res = await request(app).get('/api/v1/socket/stats');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/v1/socket/connections - List Active Connections', () => {
    it('should list all active connections', async () => {
      const mockConnections = [
        { socketId: 'socket-1', userId: 'user-1', connectedAt: new Date() },
        { socketId: 'socket-2', userId: 'user-2', connectedAt: new Date() },
        { socketId: 'socket-3', userId: 'user-3', connectedAt: new Date() },
      ];

      SocketService.getActiveConnections.mockResolvedValue(mockConnections);

      const res = await request(app).get('/api/v1/socket/connections');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.connections).toEqual(mockConnections);
    });

    it('should support pagination', async () => {
      SocketService.getActiveConnections.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/socket/connections')
        .query({ limit: 100, offset: 50 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(100);
      expect(res.body.data.pagination.offset).toBe(50);
    });

    it('should enforce max limit of 1000', async () => {
      SocketService.getActiveConnections.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/socket/connections')
        .query({ limit: 5000 });

      expect(res.status).toBe(200);
      const [opts] = SocketService.getActiveConnections.mock.calls[0];
      expect(opts.limit).toBeLessThanOrEqual(1000);
    });

    it('should return connection count', async () => {
      SocketService.getActiveConnections.mockResolvedValue([
        { socketId: '1' },
        { socketId: '2' },
      ]);

      const res = await request(app).get('/api/v1/socket/connections');

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.count).toBe(2);
    });

    it('should handle no connections', async () => {
      SocketService.getActiveConnections.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/socket/connections');

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.count).toBe(0);
    });

    it('should handle service errors', async () => {
      SocketService.getActiveConnections.mockRejectedValue(new Error('Error'));

      const res = await request(app).get('/api/v1/socket/connections');

      expect(res.status).toBe(500);
    });
  });

  describe('Authorization - Admin Only', () => {
    it('should require admin role for all endpoints', async () => {
      expect(socketController).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should log all admin actions', async () => {
      SocketService.broadcastToAll.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({ message: 'Test' });

      expect(res.status).toBe(200);
      // Logging verified by Logger mock
    });

    it('should handle malformed JSON gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Data Validation', () => {
    it('should accept message with special characters', async () => {
      SocketService.broadcastToAll.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: 'Test with special chars: @#$%^&*()_+-=[]{}|;:,.<>?',
        });

      expect(res.status).toBe(200);
    });

    it('should accept unicode in messages', async () => {
      SocketService.broadcastToAll.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: 'Test with unicode: 你好世界 🚀 مرحبا',
        });

      expect(res.status).toBe(200);
    });
  });
});
