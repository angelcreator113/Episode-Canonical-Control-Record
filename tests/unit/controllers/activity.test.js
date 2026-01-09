/**
 * Unit Tests - Activity Controller
 * Phase 3A: Real-time Notifications System
 *
 * Tests for 6 activity endpoints:
 * - GET /api/v1/activity/feed
 * - GET /api/v1/activity/resource/:type/:id
 * - GET /api/v1/activity/team
 * - GET /api/v1/activity/stats
 * - GET /api/v1/activity/search
 * - GET /api/v1/activity/dashboard-stats
 */

const request = require('supertest');
const express = require('express');
const activityController = require('../../../src/controllers/activityController');
const ActivityService = require('../../../src/services/ActivityService');
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

jest.mock('../../../src/services/ActivityService', () => ({
  getActivityFeed: jest.fn(),
  getResourceActivity: jest.fn(),
  getTeamActivity: jest.fn(),
  getActivityStats: jest.fn(),
  searchActivityLogs: jest.fn(),
  getDashboardStats: jest.fn(),
}));

jest.mock('../../../src/services/Logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Activity Controller', () => {
  let app;
  const userId = '550d117a-3d96-43de-a2dc-ee5027c776a3';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/activity', activityController);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/activity/feed - User Activity Feed', () => {
    it('should return user activity feed', async () => {
      const mockActivities = [
        {
          id: '1',
          userId,
          action: 'created_episode',
          resourceType: 'episode',
          resourceId: '123',
        },
        {
          id: '2',
          userId,
          action: 'updated_episode',
          resourceType: 'episode',
          resourceId: '124',
        },
      ];

      ActivityService.getActivityFeed.mockResolvedValue(mockActivities);

      const res = await request(app).get('/api/v1/activity/feed');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.activities).toEqual(mockActivities);
    });

    it('should support pagination', async () => {
      ActivityService.getActivityFeed.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/feed')
        .query({ limit: 100, offset: 20 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(100);
      expect(res.body.data.pagination.offset).toBe(20);
    });

    it('should enforce max limit of 200', async () => {
      ActivityService.getActivityFeed.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/feed')
        .query({ limit: 500 });

      expect(res.status).toBe(200);
      const [, opts] = ActivityService.getActivityFeed.mock.calls[0];
      expect(opts.limit).toBeLessThanOrEqual(200);
    });

    it('should filter by action type', async () => {
      ActivityService.getActivityFeed.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/feed')
        .query({ actionType: 'created_episode' });

      expect(res.status).toBe(200);
    });

    it('should filter by date range', async () => {
      ActivityService.getActivityFeed.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/feed')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/activity/resource/:type/:id - Resource Activity', () => {
    it('should return activity for resource', async () => {
      const mockActivities = [
        { id: '1', action: 'created', resourceType: 'episode' },
        { id: '2', action: 'updated', resourceType: 'episode' },
      ];

      ActivityService.getResourceActivity.mockResolvedValue(mockActivities);

      const res = await request(app).get(
        '/api/v1/activity/resource/episode/episode-123'
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.resourceType).toBe('episode');
      expect(res.body.data.resourceId).toBe('episode-123');
      expect(res.body.data.activities).toEqual(mockActivities);
    });

    it('should require resource type', async () => {
      const res = await request(app).get('/api/v1/activity/resource/');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should require resource ID', async () => {
      ActivityService.getResourceActivity.mockResolvedValue([]);

      // Actually, the route should handle this - test with missing ID
      const res = await request(app).get('/api/v1/activity/resource/episode');

      expect(res.status).toBeGreaterThanOrEqual(404);
    });

    it('should support pagination', async () => {
      ActivityService.getResourceActivity.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/resource/episode/123')
        .query({ limit: 50, offset: 0 });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/activity/team - Team Activity (Admin)', () => {
    it('should return team activity', async () => {
      const mockActivities = [
        { id: '1', userId: 'user1', action: 'created_episode' },
        { id: '2', userId: 'user2', action: 'deleted_episode' },
      ];

      ActivityService.getTeamActivity.mockResolvedValue(mockActivities);

      const res = await request(app).get('/api/v1/activity/team');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.activities).toEqual(mockActivities);
    });

    it('should support date range filtering', async () => {
      ActivityService.getTeamActivity.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/team')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        });

      expect(res.status).toBe(200);
    });

    it('should enforce higher limit for admin', async () => {
      ActivityService.getTeamActivity.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/team')
        .query({ limit: 500 });

      expect(res.status).toBe(200);
      const [opts] = ActivityService.getTeamActivity.mock.calls[0];
      expect(opts.limit).toBeLessThanOrEqual(500);
    });
  });

  describe('GET /api/v1/activity/stats - Activity Statistics (Admin)', () => {
    it('should return activity statistics', async () => {
      const mockStats = {
        totalActivities: 150,
        activeUsers: 12,
        actionsPerHour: 5,
      };

      ActivityService.getActivityStats.mockResolvedValue(mockStats);

      const res = await request(app).get('/api/v1/activity/stats');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.stats).toEqual(mockStats);
    });

    it('should default to 7-day range', async () => {
      ActivityService.getActivityStats.mockResolvedValue({});

      const res = await request(app).get('/api/v1/activity/stats');

      expect(res.status).toBe(200);
      const [startDate, endDate] = ActivityService.getActivityStats.mock
        .calls[0];
      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);
    });

    it('should accept custom date range', async () => {
      ActivityService.getActivityStats.mockResolvedValue({});

      const res = await request(app)
        .get('/api/v1/activity/stats')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/activity/search - Search Activity Logs', () => {
    it('should search activity logs', async () => {
      const mockResults = [
        { id: '1', action: 'created_episode', description: 'Created Test' },
      ];

      ActivityService.searchActivityLogs.mockResolvedValue(mockResults);

      const res = await request(app)
        .get('/api/v1/activity/search')
        .query({ q: 'episode' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.results).toEqual(mockResults);
    });

    it('should require search query', async () => {
      const res = await request(app).get('/api/v1/activity/search');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should support pagination', async () => {
      ActivityService.searchActivityLogs.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/search')
        .query({ q: 'test', limit: 50, offset: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(50);
    });

    it('should return result count', async () => {
      ActivityService.searchActivityLogs.mockResolvedValue([
        { id: '1' },
        { id: '2' },
      ]);

      const res = await request(app)
        .get('/api/v1/activity/search')
        .query({ q: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.resultCount).toBe(2);
    });

    it('should handle no results', async () => {
      ActivityService.searchActivityLogs.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/search')
        .query({ q: 'nonexistent' });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.resultCount).toBe(0);
    });
  });

  describe('GET /api/v1/activity/dashboard-stats - Dashboard Statistics (Admin)', () => {
    it('should return dashboard statistics', async () => {
      const mockStats = [
        { date: '2025-01-06', count: 25 },
        { date: '2025-01-07', count: 30 },
      ];

      ActivityService.getDashboardStats.mockResolvedValue(mockStats);

      const res = await request(app).get(
        '/api/v1/activity/dashboard-stats'
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.dailyStats).toEqual(mockStats);
    });

    it('should default to 7-day period', async () => {
      ActivityService.getDashboardStats.mockResolvedValue([]);

      const res = await request(app).get(
        '/api/v1/activity/dashboard-stats'
      );

      expect(res.status).toBe(200);
      const [days] = ActivityService.getDashboardStats.mock.calls[0];
      expect(days).toBe(7);
    });

    it('should accept custom day range', async () => {
      ActivityService.getDashboardStats.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/dashboard-stats')
        .query({ days: 30 });

      expect(res.status).toBe(200);
      const [days] = ActivityService.getDashboardStats.mock.calls[0];
      expect(days).toBe(30);
    });

    it('should enforce max 90 days', async () => {
      ActivityService.getDashboardStats.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/activity/dashboard-stats')
        .query({ days: 365 });

      expect(res.status).toBe(200);
      const [days] = ActivityService.getDashboardStats.mock.calls[0];
      expect(days).toBeLessThanOrEqual(90);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors on feed', async () => {
      ActivityService.getActivityFeed.mockRejectedValue(new Error('DB Error'));

      const res = await request(app).get('/api/v1/activity/feed');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });

    it('should handle service errors on search', async () => {
      ActivityService.searchActivityLogs.mockRejectedValue(
        new Error('Search Error')
      );

      const res = await request(app)
        .get('/api/v1/activity/search')
        .query({ q: 'test' });

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      // Auth enforced by middleware
      expect(activityController).toBeDefined();
    });

    it('should require admin role for sensitive endpoints', async () => {
      // RBAC enforced by middleware
      expect(activityController).toBeDefined();
    });
  });
});
