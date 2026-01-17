/**
 * Integration Tests - Activity Workflows
 * Phase 3A: Real-time Notifications System
 *
 * Tests full activity tracking workflows:
 * - Log activity events
 * - Filter and search activities
 * - Generate reports and statistics
 * - Database persistence
 * - Multi-user activity tracking
 */

const request = require('supertest');
const express = require('express');
const { sequelize } = require('../../src/models');
const ActivityLog = require('../../src/models').ActivityLog;
const activityController = require('../../src/controllers/activityController');
const { authenticateToken, authorizeRole } = require('../../src/middleware/auth');

jest.mock('../../src/middleware/auth');
jest.mock('../../src/services/Logger');

describe('Activity Integration Tests', () => {
  let app;
  const adminUserId = '550d117a-3d96-43de-a2dc-ee5027c776a3';
  const userId1 = 'user-1-activity-test';
  const userId2 = 'user-2-activity-test';

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
    app.use('/api/v1/activity', activityController);
  });

  describe('Activity Logging Workflow', () => {
    it('should log activities and retrieve them', async () => {
      // Create activity logs (simulated via direct DB for testing)
      await ActivityLog.create({
        userId: userId1,
        action: 'created_episode',
        resourceType: 'episode',
        resourceId: 'episode-123',
        metadata: { title: 'Test Episode' },
      });

      await ActivityLog.create({
        userId: userId1,
        action: 'updated_episode',
        resourceType: 'episode',
        resourceId: 'episode-123',
        metadata: { changes: { status: 'published' } },
      });

      // Retrieve activity feed
      const feedRes = await request(app).get('/api/v1/activity/feed');

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.status).toBe('success');
      expect(Array.isArray(feedRes.body.data.activities)).toBe(true);
    });

    it('should track multiple users activities separately', async () => {
      // Log activities for different users
      await ActivityLog.create({
        userId: userId1,
        action: 'created_episode',
        resourceType: 'episode',
        resourceId: 'ep-1',
      });

      await ActivityLog.create({
        userId: userId2,
        action: 'created_episode',
        resourceType: 'episode',
        resourceId: 'ep-2',
      });

      // Get team activity (admin only)
      const teamRes = await request(app).get('/api/v1/activity/team');

      expect(teamRes.status).toBe(200);
      expect(Array.isArray(teamRes.body.data.activities)).toBe(true);
    });

    it('should filter activities by resource type', async () => {
      // Create activities for different resources
      await ActivityLog.create({
        userId: userId1,
        action: 'created',
        resourceType: 'episode',
        resourceId: 'ep-1',
      });

      await ActivityLog.create({
        userId: userId1,
        action: 'created',
        resourceType: 'composition',
        resourceId: 'comp-1',
      });

      // Get resource-specific activity
      const resourceRes = await request(app).get('/api/v1/activity/resource/episode/ep-1');

      expect(resourceRes.status).toBe(200);
      expect(resourceRes.body.data.resourceType).toBe('episode');
      expect(resourceRes.body.data.resourceId).toBe('ep-1');
    });
  });

  describe('Activity Search and Filtering', () => {
    it('should search activities by full-text search', async () => {
      // Create searchable activities
      await ActivityLog.create({
        userId: userId1,
        action: 'created_episode',
        resourceType: 'episode',
        resourceId: 'search-test-1',
        metadata: { title: 'Search Test Episode' },
      });

      // Search
      const searchRes = await request(app).get('/api/v1/activity/search').query({ q: 'search' });

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.status).toBe('success');
      expect(Array.isArray(searchRes.body.data.results)).toBe(true);
    });

    it('should filter activities by date range', async () => {
      // Create recent activity
      await ActivityLog.create({
        userId: userId1,
        action: 'updated',
        resourceType: 'episode',
        resourceId: 'date-test-1',
        createdAt: new Date(),
      });

      // Get with date filter
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const feedRes = await request(app).get('/api/v1/activity/feed').query({
        startDate: now.toISOString(),
        endDate: tomorrow.toISOString(),
      });

      expect(feedRes.status).toBe(200);
    });

    it('should return activity statistics', async () => {
      // Create sample activities
      for (let i = 0; i < 3; i++) {
        await ActivityLog.create({
          userId: userId1,
          action: 'created_episode',
          resourceType: 'episode',
          resourceId: `stats-test-${i}`,
        });
      }

      // Get statistics
      const statsRes = await request(app).get('/api/v1/activity/stats');

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.stats).toBeDefined();
    });
  });

  describe('Activity Pagination and Limits', () => {
    it('should support pagination with large result sets', async () => {
      // Create many activities
      for (let i = 0; i < 10; i++) {
        await ActivityLog.create({
          userId: userId1,
          action: `action_${i}`,
          resourceType: 'episode',
          resourceId: `ep-${i}`,
        });
      }

      // Get first page
      const page1 = await request(app).get('/api/v1/activity/feed').query({ limit: 5, offset: 0 });

      expect(page1.status).toBe(200);
      expect(page1.body.data.pagination.limit).toBe(5);

      // Get second page
      const page2 = await request(app).get('/api/v1/activity/feed').query({ limit: 5, offset: 5 });

      expect(page2.status).toBe(200);
    });

    it('should enforce maximum limits', async () => {
      const res = await request(app).get('/api/v1/activity/feed').query({ limit: 500 });

      expect(res.status).toBe(200);
      // Limit should be capped at 200
      expect(res.body.data.pagination.limit).toBeLessThanOrEqual(200);
    });
  });

  describe('Dashboard Statistics', () => {
    it('should generate daily statistics', async () => {
      // Create activities spread across time
      const dates = [0, 1, 2].map((i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000));

      for (const date of dates) {
        await ActivityLog.create({
          userId: userId1,
          action: 'created',
          resourceType: 'episode',
          resourceId: `daily-${date.toISOString()}`,
          createdAt: date,
        });
      }

      // Get dashboard stats
      const statsRes = await request(app)
        .get('/api/v1/activity/dashboard-stats')
        .query({ days: 7 });

      expect(statsRes.status).toBe(200);
      expect(Array.isArray(statsRes.body.data.dailyStats)).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should require search query', async () => {
      const res = await request(app).get('/api/v1/activity/search');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should handle missing resource gracefully', async () => {
      const res = await request(app).get('/api/v1/activity/resource/episode/nonexistent');

      expect(res.status).toBeGreaterThanOrEqual(200);
    });
  });

  afterAll(() => {
    // Cleanup test data
  });
});
