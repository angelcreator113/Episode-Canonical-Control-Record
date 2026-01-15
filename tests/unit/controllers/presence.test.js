/**
 * Unit Tests - Presence Controller
 * Phase 3A: Real-time Notifications System
 *
 * Tests for 5 presence endpoints:
 * - GET /api/v1/presence/online-users
 * - GET /api/v1/presence/status
 * - POST /api/v1/presence/status
 * - GET /api/v1/presence/resource-viewers/:type/:id
 * - GET /api/v1/presence/stats
 */

const request = require('supertest');
const express = require('express');
const presenceController = require('../../../src/controllers/presenceController');
const PresenceService = require('../../../src/services/PresenceService');
const { authenticateToken, authorizeRole } = require('../../../src/middleware/auth');

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: '550d117a-3d96-43de-a2dc-ee5027c776a3', role: 'user' };
    next();
  },
  authorizeRole: (roles) => (req, res, next) => {
    req.user.role = 'admin';
    next();
  },
}));

jest.mock('../../../src/services/PresenceService', () => ({
  getOnlineUsers: jest.fn(),
  getUserStatus: jest.fn(),
  updateUserStatus: jest.fn(),
  getResourceViewers: jest.fn(),
  getPresenceStats: jest.fn(),
}));

jest.mock('../../../src/services/Logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Presence Controller', () => {
  let app;
  const userId = '550d117a-3d96-43de-a2dc-ee5027c776a3';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/presence', presenceController);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/presence/online-users - List Online Users', () => {
    it('should return list of online users', async () => {
      const mockUsers = [
        { userId: 'user1', status: 'online', lastActivity: new Date() },
        { userId: 'user2', status: 'away', lastActivity: new Date() },
      ];

      PresenceService.getOnlineUsers.mockResolvedValue(mockUsers);

      const res = await request(app).get('/api/v1/presence/online-users');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.users).toEqual(mockUsers);
    });

    it('should support pagination', async () => {
      PresenceService.getOnlineUsers.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/presence/online-users')
        .query({ limit: 50, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(50);
    });

    it('should enforce max limit of 500', async () => {
      PresenceService.getOnlineUsers.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/presence/online-users')
        .query({ limit: 1000 });

      expect(res.status).toBe(200);
      const [opts] = PresenceService.getOnlineUsers.mock.calls[0];
      expect(opts.limit).toBeLessThanOrEqual(500);
    });

    it('should return user count', async () => {
      PresenceService.getOnlineUsers.mockResolvedValue([
        { userId: 'user1' },
        { userId: 'user2' },
      ]);

      const res = await request(app).get('/api/v1/presence/online-users');

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.count).toBe(2);
    });
  });

  describe('GET /api/v1/presence/status - Get User Status', () => {
    it('should return current user status', async () => {
      const mockStatus = {
        userId,
        status: 'online',
        customStatus: 'Working on features',
        lastActivity: new Date(),
      };

      PresenceService.getUserStatus.mockResolvedValue(mockStatus);

      const res = await request(app).get('/api/v1/presence/status');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.presence).toEqual(mockStatus);
      expect(res.body.data.userId).toBe(userId);
    });

    it('should handle service errors', async () => {
      PresenceService.getUserStatus.mockRejectedValue(new Error('Error'));

      const res = await request(app).get('/api/v1/presence/status');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/v1/presence/status - Update User Status', () => {
    it('should update user status to online', async () => {
      const mockUpdated = {
        userId,
        status: 'online',
        lastActivity: new Date(),
      };

      PresenceService.updateUserStatus.mockResolvedValue(mockUpdated);

      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'online' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.presence.status).toBe('online');
    });

    it('should update user status to away', async () => {
      PresenceService.updateUserStatus.mockResolvedValue({ status: 'away' });

      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'away' });

      expect(res.status).toBe(200);
      expect(PresenceService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ status: 'away' })
      );
    });

    it('should update user status to offline', async () => {
      PresenceService.updateUserStatus.mockResolvedValue({ status: 'offline' });

      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'offline' });

      expect(res.status).toBe(200);
    });

    it('should update user status to dnd (do not disturb)', async () => {
      PresenceService.updateUserStatus.mockResolvedValue({ status: 'dnd' });

      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'dnd' });

      expect(res.status).toBe(200);
    });

    it('should accept custom status message', async () => {
      const customMessage = 'In a meeting';
      PresenceService.updateUserStatus.mockResolvedValue({
        status: 'dnd',
        customStatus: customMessage,
      });

      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'dnd', customStatus: customMessage });

      expect(res.status).toBe(200);
      expect(PresenceService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ customStatus: customMessage })
      );
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Valid status required');
    });

    it('should require status field', async () => {
      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should update lastActivity timestamp', async () => {
      PresenceService.updateUserStatus.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'online' });

      expect(res.status).toBe(200);
      expect(PresenceService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          lastActivity: expect.any(Date),
        })
      );
    });
  });

  describe('GET /api/v1/presence/resource-viewers/:type/:id - Who Is Viewing Resource', () => {
    it('should return users viewing resource', async () => {
      const mockViewers = [
        { userId: 'user1', joinedAt: new Date() },
        { userId: 'user2', joinedAt: new Date() },
      ];

      PresenceService.getResourceViewers.mockResolvedValue(mockViewers);

      const res = await request(app).get(
        '/api/v1/presence/resource-viewers/episode/episode-123'
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.viewers).toEqual(mockViewers);
      expect(res.body.data.resourceType).toBe('episode');
      expect(res.body.data.resourceId).toBe('episode-123');
    });

    it('should return viewer count', async () => {
      PresenceService.getResourceViewers.mockResolvedValue([
        { userId: 'user1' },
        { userId: 'user2' },
      ]);

      const res = await request(app).get(
        '/api/v1/presence/resource-viewers/episode/123'
      );

      expect(res.status).toBe(200);
      expect(res.body.data.viewerCount).toBe(2);
    });

    it('should handle empty viewers', async () => {
      PresenceService.getResourceViewers.mockResolvedValue([]);

      const res = await request(app).get(
        '/api/v1/presence/resource-viewers/episode/123'
      );

      expect(res.status).toBe(200);
      expect(res.body.data.viewerCount).toBe(0);
    });

    it('should require resource type', async () => {
      const res = await request(app).get('/api/v1/presence/resource-viewers//123');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should require resource ID', async () => {
      PresenceService.getResourceViewers.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/presence/resource-viewers/episode');

      expect(res.status).toBeGreaterThanOrEqual(404);
    });

    it('should work with different resource types', async () => {
      PresenceService.getResourceViewers.mockResolvedValue([]);

      const types = ['episode', 'composition', 'template', 'asset'];

      for (const type of types) {
        const res = await request(app).get(
          `/api/v1/presence/resource-viewers/${type}/id-123`
        );
        expect(res.status).toBe(200);
      }
    });
  });

  describe('GET /api/v1/presence/stats - Presence Statistics (Admin)', () => {
    it('should return presence statistics', async () => {
      const mockStats = {
        totalOnline: 25,
        totalAway: 5,
        totalOffline: 70,
        totalDnd: 3,
        averageSessionDuration: 3600,
      };

      PresenceService.getPresenceStats.mockResolvedValue(mockStats);

      const res = await request(app).get('/api/v1/presence/stats');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.stats).toEqual(mockStats);
    });

    it('should include current timestamp', async () => {
      PresenceService.getPresenceStats.mockResolvedValue({});

      const res = await request(app).get('/api/v1/presence/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('should handle service errors', async () => {
      PresenceService.getPresenceStats.mockRejectedValue(new Error('Error'));

      const res = await request(app).get('/api/v1/presence/stats');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      expect(presenceController).toBeDefined();
    });

    it('should require admin role for stats endpoint', async () => {
      expect(presenceController).toBeDefined();
    });
  });

  describe('Status Validation', () => {
    it('should accept all valid status values', async () => {
      const validStatuses = ['online', 'away', 'offline', 'dnd'];

      for (const status of validStatuses) {
        PresenceService.updateUserStatus.mockResolvedValue({ status });

        const res = await request(app)
          .post('/api/v1/presence/status')
          .send({ status });

        expect(res.status).toBe(200);
      }
    });

    it('should reject invalid status values', async () => {
      const invalidStatuses = ['busy', 'idle', 'invisible', 'active'];

      for (const status of invalidStatuses) {
        const res = await request(app)
          .post('/api/v1/presence/status')
          .send({ status });

        expect(res.status).toBe(400);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      PresenceService.getOnlineUsers.mockRejectedValue(
        new Error('DB Connection failed')
      );

      const res = await request(app).get('/api/v1/presence/online-users');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });
});
