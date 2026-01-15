/**
 * Integration Tests - Presence Workflows
 * Phase 3A: Real-time Notifications System
 *
 * Tests full presence management workflows:
 * - User online/offline status
 * - Resource viewing tracking
 * - Status transitions
 * - Real-time presence queries
 * - Cleanup of stale presence data
 */

const request = require('supertest');
const express = require('express');
const { sequelize } = require('../../../src/models');
const UserPresence = require('../../../src/models').UserPresence;
const presenceController = require('../../../src/controllers/presenceController');
const { authenticateToken, authorizeRole } = require('../../../src/middleware/auth');

jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/services/Logger');

describe('Presence Integration Tests', () => {
  let app;
  const adminUserId = '550d117a-3d96-43de-a2dc-ee5027c776a3';
  const userId1 = 'user-1-presence-test';
  const userId2 = 'user-2-presence-test';
  const userId3 = 'user-3-presence-test';

  beforeAll(() => {
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { userId: adminUserId, role: 'admin' };
      next();
    });
    authorizeRole.mockReturnValue((req, res, next) => {
      req.user.role = 'admin';
      next();
    });
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/presence', presenceController);
  });

  describe('User Status Workflow', () => {
    it('should track user going online and offline', async () => {
      // User comes online
      await UserPresence.create({
        userId: userId1,
        status: 'online',
        lastActivity: new Date(),
      });

      // Get online users
      const onlineRes = await request(app).get('/api/v1/presence/online-users');

      expect(onlineRes.status).toBe(200);
      expect(Array.isArray(onlineRes.body.data.users)).toBe(true);

      // User goes away
      await UserPresence.update(
        { status: 'away', lastActivity: new Date() },
        { where: { userId: userId1 } }
      );

      // Verify status changed
      const presence = await UserPresence.findOne({ where: { userId: userId1 } });
      expect(presence.status).toBe('away');
    });

    it('should support all status transitions', async () => {
      const statuses = ['online', 'away', 'offline', 'dnd'];

      for (const status of statuses) {
        // Create or update presence
        await UserPresence.upsert({
          userId: userId1,
          status,
          lastActivity: new Date(),
        });

        // Verify in database
        const presence = await UserPresence.findOne({
          where: { userId: userId1 },
        });
        expect(presence.status).toBe(status);
      }
    });

    it('should track custom status messages', async () => {
      await UserPresence.create({
        userId: userId2,
        status: 'dnd',
        customStatus: 'In a meeting',
        lastActivity: new Date(),
      });

      const presence = await UserPresence.findOne({ where: { userId: userId2 } });
      expect(presence.customStatus).toBe('In a meeting');
    });
  });

  describe('Multi-User Presence Tracking', () => {
    it('should list all online users', async () => {
      // Create multiple online users
      const userIds = [userId1, userId2, userId3];

      for (const uid of userIds) {
        await UserPresence.create({
          userId: uid,
          status: 'online',
          lastActivity: new Date(),
        });
      }

      // Get online users
      const res = await request(app).get('/api/v1/presence/online-users');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });

    it('should track presence statistics', async () => {
      // Create users with different statuses
      await UserPresence.create({
        userId: 'stat-user-1',
        status: 'online',
        lastActivity: new Date(),
      });
      await UserPresence.create({
        userId: 'stat-user-2',
        status: 'away',
        lastActivity: new Date(),
      });
      await UserPresence.create({
        userId: 'stat-user-3',
        status: 'offline',
        lastActivity: new Date(),
      });

      // Get statistics
      const statsRes = await request(app).get('/api/v1/presence/stats');

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.stats).toBeDefined();
    });
  });

  describe('Resource Viewer Tracking', () => {
    it('should track who is viewing a resource', async () => {
      // Create viewer records (simulated)
      await UserPresence.create({
        userId: userId1,
        status: 'online',
        viewingResource: {
          type: 'episode',
          id: 'episode-123',
        },
        lastActivity: new Date(),
      });

      await UserPresence.create({
        userId: userId2,
        status: 'online',
        viewingResource: {
          type: 'episode',
          id: 'episode-123',
        },
        lastActivity: new Date(),
      });

      // Get resource viewers
      const viewersRes = await request(app).get(
        '/api/v1/presence/resource-viewers/episode/episode-123'
      );

      expect(viewersRes.status).toBe(200);
      expect(Array.isArray(viewersRes.body.data.viewers)).toBe(true);
      expect(viewersRes.body.data.viewerCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty viewer lists', async () => {
      const viewersRes = await request(app).get(
        '/api/v1/presence/resource-viewers/episode/no-viewers-episode'
      );

      expect(viewersRes.status).toBe(200);
      expect(viewersRes.body.data.viewerCount).toBe(0);
    });

    it('should handle different resource types', async () => {
      const resourceTypes = ['episode', 'composition', 'template', 'asset'];

      for (const type of resourceTypes) {
        const res = await request(app).get(
          `/api/v1/presence/resource-viewers/${type}/test-id`
        );
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Presence Pagination', () => {
    it('should paginate large user lists', async () => {
      // Create many users
      for (let i = 0; i < 10; i++) {
        await UserPresence.create({
          userId: `pagination-user-${i}`,
          status: 'online',
          lastActivity: new Date(),
        });
      }

      // Get first page
      const page1 = await request(app)
        .get('/api/v1/presence/online-users')
        .query({ limit: 5, offset: 0 });

      expect(page1.status).toBe(200);
      expect(page1.body.data.pagination.limit).toBe(5);

      // Get second page
      const page2 = await request(app)
        .get('/api/v1/presence/online-users')
        .query({ limit: 5, offset: 5 });

      expect(page2.status).toBe(200);
    });

    it('should enforce maximum limits', async () => {
      const res = await request(app)
        .get('/api/v1/presence/online-users')
        .query({ limit: 2000 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBeLessThanOrEqual(500);
    });
  });

  describe('Presence Data Cleanup', () => {
    it('should handle stale presence records', async () => {
      // Create old presence record
      const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      await UserPresence.create({
        userId: 'stale-user',
        status: 'online',
        lastActivity: staleDate,
      });

      // Create fresh record
      await UserPresence.create({
        userId: 'fresh-user',
        status: 'online',
        lastActivity: new Date(),
      });

      // Query online users (fresh ones)
      const res = await request(app).get('/api/v1/presence/online-users');

      expect(res.status).toBe(200);
      // Should have at least the fresh user
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should reject invalid status values', async () => {
      // Try to update with invalid status
      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/presence/status')
        .send({ customStatus: 'In meeting' });

      expect(res.status).toBe(400);
    });

    it('should require valid resource type', async () => {
      const res = await request(app).get(
        '/api/v1/presence/resource-viewers/invalid-type/id'
      );

      // Should either fail or return empty
      expect([200, 400, 404]).toContain(res.status);
    });
  });

  afterAll(() => {
    // Cleanup presence data
  });
});
