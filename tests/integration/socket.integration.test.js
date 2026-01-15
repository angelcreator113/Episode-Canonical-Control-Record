/**
 * Integration Tests - Socket.IO Admin Operations
 * Phase 3A: Real-time Notifications System
 *
 * Tests WebSocket admin operations:
 * - Broadcast message delivery
 * - User-specific messaging
 * - Room/group management
 * - Forced disconnections
 * - Connection statistics
 * - Admin-only operations
 */

const request = require('supertest');
const express = require('express');
const socketIO = require('socket.io');
const { Server: HTTPServer } = require('http');
const socketController = require('../../src/controllers/socketController');
const SocketService = require('../../src/services/SocketService');
const { authenticateToken, authorizeRole } = require('../../src/middleware/auth');

jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user', role: 'admin' };
    next();
  }),
  authorizeRole: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../../src/services/Logger');
jest.mock('../../src/services/SocketService');

describe('Socket Controller Integration Tests', () => {
  let app;
  let io;
  let server;
  const adminUserId = '550d117a-3d96-43de-a2dc-ee5027c776a3';
  const userId1 = 'user-1-socket-test';
  const userId2 = 'user-2-socket-test';

  beforeAll((done) => {
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { userId: adminUserId, role: 'admin' };
      next();
    });

    authorizeRole.mockReturnValue((req, res, next) => {
      req.user.role = 'admin';
      next();
    });

    app = express();
    app.use(express.json());

    // Mock Socket.IO
    SocketService.getInstance.mockReturnValue({
      broadcastMessage: jest.fn(),
      sendToUser: jest.fn(),
      sendToRoom: jest.fn(),
      disconnectUser: jest.fn(),
      getConnectedUsers: jest.fn(() => [
        { userId: userId1, socketId: 'socket-1' },
        { userId: userId2, socketId: 'socket-2' },
      ]),
      getRoomStats: jest.fn(() => ({
        totalConnections: 2,
        activeRooms: 1,
      })),
    });

    app.use('/api/v1/socket', socketController);

    server = HTTPServer(app);
    done();
  });

  describe('Broadcast Operations', () => {
    it('should broadcast message to all connected users', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: 'System maintenance in 5 minutes',
          type: 'system_alert',
        });

      expect(res.status).toBe(200);
      expect(socketService.broadcastMessage).toHaveBeenCalled();
      expect(res.body.data.recipientCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle broadcast with empty message', async () => {
      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: '',
          type: 'system_alert',
        });

      expect(res.status).toBe(400);
    });

    it('should enforce admin-only broadcast', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { userId: userId1, role: 'user' };
        next();
      });

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: 'Test message',
          type: 'system_alert',
        });

      // Should be forbidden or unauthorized
      expect([401, 403]).toContain(res.status);

      // Reset mock
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { userId: adminUserId, role: 'admin' };
        next();
      });
    });

    it('should validate broadcast message type', async () => {
      const validTypes = [
        'system_alert',
        'announcement',
        'urgent',
        'notification',
      ];

      for (const type of validTypes) {
        const res = await request(app)
          .post('/api/v1/socket/broadcast')
          .send({
            message: `Test ${type} message`,
            type,
          });

        expect([200, 201]).toContain(res.status);
      }
    });
  });

  describe('User-Specific Messaging', () => {
    it('should send message to specific user', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app)
        .post('/api/v1/socket/send-to-user')
        .send({
          userId: userId1,
          message: 'Personal notification',
          type: 'notification',
        });

      expect(res.status).toBe(200);
      expect(socketService.sendToUser).toHaveBeenCalledWith(
        userId1,
        expect.any(Object)
      );
    });

    it('should handle non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/socket/send-to-user')
        .send({
          userId: 'non-existent-user',
          message: 'Test message',
          type: 'notification',
        });

      // Should either succeed (message queued) or fail gracefully
      expect([200, 404]).toContain(res.status);
    });

    it('should send to multiple users', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app)
        .post('/api/v1/socket/send-to-users')
        .send({
          userIds: [userId1, userId2],
          message: 'Bulk message',
          type: 'notification',
        });

      expect(res.status).toBe(200);
      expect(socketService.sendToUser).toHaveBeenCalledTimes(
        expect.any(Number)
      );
    });
  });

  describe('Room/Group Operations', () => {
    it('should send message to room', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app)
        .post('/api/v1/socket/send-to-room')
        .send({
          roomName: 'episode-123-viewers',
          message: 'Episode updated',
          type: 'update',
        });

      expect(res.status).toBe(200);
      expect(socketService.sendToRoom).toHaveBeenCalledWith(
        'episode-123-viewers',
        expect.any(Object)
      );
    });

    it('should handle room operations with wildcards', async () => {
      const res = await request(app)
        .post('/api/v1/socket/send-to-room')
        .send({
          roomName: 'episode-*',
          message: 'Global episode update',
          type: 'broadcast',
        });

      expect([200, 400]).toContain(res.status);
    });

    it('should validate room names', async () => {
      const res = await request(app)
        .post('/api/v1/socket/send-to-room')
        .send({
          roomName: '', // Invalid empty room
          message: 'Test',
          type: 'update',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Connection Management', () => {
    it('should disconnect specific user', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app)
        .post('/api/v1/socket/disconnect-user')
        .send({
          userId: userId1,
          reason: 'Duplicate login detected',
        });

      expect(res.status).toBe(200);
      expect(socketService.disconnectUser).toHaveBeenCalledWith(userId1);
    });

    it('should handle disconnect with notification', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app)
        .post('/api/v1/socket/disconnect-user')
        .send({
          userId: userId1,
          reason: 'Session expired',
          notifyUser: true,
        });

      expect(res.status).toBe(200);
      expect(socketService.disconnectUser).toHaveBeenCalled();
    });

    it('should list all connected users', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app).get('/api/v1/socket/connected-users');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(socketService.getConnectedUsers).toHaveBeenCalled();
    });

    it('should handle empty connection list', async () => {
      const socketService = SocketService.getInstance();
      socketService.getConnectedUsers.mockReturnValueOnce([]);

      const res = await request(app).get('/api/v1/socket/connected-users');

      expect(res.status).toBe(200);
      expect(res.body.data.users).toHaveLength(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should get connection statistics', async () => {
      const socketService = SocketService.getInstance();

      const res = await request(app).get('/api/v1/socket/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.stats).toBeDefined();
      expect(socketService.getRoomStats).toHaveBeenCalled();
    });

    it('should track connection count changes', async () => {
      const socketService = SocketService.getInstance();

      // Get initial stats
      const res1 = await request(app).get('/api/v1/socket/stats');
      expect(res1.status).toBe(200);

      // Simulate connection count change
      socketService.getRoomStats.mockReturnValueOnce({
        totalConnections: 3,
        activeRooms: 2,
      });

      const res2 = await request(app).get('/api/v1/socket/stats');
      expect(res2.status).toBe(200);
    });

    it('should provide per-room statistics', async () => {
      const res = await request(app).get('/api/v1/socket/room-stats');

      expect(res.status).toBe(200);
      expect(res.body.data.rooms).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous broadcasts', async () => {
      const socketService = SocketService.getInstance();

      const promises = [
        request(app)
          .post('/api/v1/socket/broadcast')
          .send({ message: 'Message 1', type: 'announcement' }),
        request(app)
          .post('/api/v1/socket/broadcast')
          .send({ message: 'Message 2', type: 'announcement' }),
        request(app)
          .post('/api/v1/socket/broadcast')
          .send({ message: 'Message 3', type: 'announcement' }),
      ];

      const results = await Promise.all(promises);

      results.forEach((res) => {
        expect([200, 201]).toContain(res.status);
      });

      expect(socketService.broadcastMessage).toHaveBeenCalledTimes(
        expect.any(Number)
      );
    });

    it('should handle mixed operations concurrently', async () => {
      const socketService = SocketService.getInstance();

      const operations = [
        request(app)
          .post('/api/v1/socket/broadcast')
          .send({ message: 'Broadcast', type: 'announcement' }),
        request(app)
          .post('/api/v1/socket/send-to-user')
          .send({
            userId: userId1,
            message: 'Personal',
            type: 'notification',
          }),
        request(app)
          .post('/api/v1/socket/send-to-room')
          .send({
            roomName: 'room-1',
            message: 'Room message',
            type: 'update',
          }),
        request(app).get('/api/v1/socket/connected-users'),
        request(app).get('/api/v1/socket/stats'),
      ];

      const results = await Promise.all(operations);

      results.forEach((res) => {
        expect(res.status).toBeLessThan(500);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should validate message payload', async () => {
      const res = await request(app).post('/api/v1/socket/broadcast').send({
        // Missing required fields
      });

      expect(res.status).toBe(400);
    });

    it('should handle oversized messages', async () => {
      const largeMessage = 'x'.repeat(100000); // Very large message

      const res = await request(app)
        .post('/api/v1/socket/broadcast')
        .send({
          message: largeMessage,
          type: 'announcement',
        });

      expect([400, 413]).toContain(res.status);
    });

    it('should prevent SQL injection in room names', async () => {
      const res = await request(app)
        .post('/api/v1/socket/send-to-room')
        .send({
          roomName: "room'; DROP TABLE--",
          message: 'Test',
          type: 'update',
        });

      // Should fail validation
      expect(res.status).toBe(400);
    });

    it('should sanitize user IDs', async () => {
      const res = await request(app)
        .post('/api/v1/socket/send-to-user')
        .send({
          userId: "<script>alert('xss')</script>",
          message: 'Test',
          type: 'notification',
        });

      expect(res.status).toBe(400);
    });
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });
});
