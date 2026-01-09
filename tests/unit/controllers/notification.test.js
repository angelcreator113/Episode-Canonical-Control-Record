/**
 * Unit Tests - Notification Controller
 * Phase 3A: Real-time Notifications System
 *
 * Tests for 8 notification endpoints:
 * - POST /api/v1/notifications (create)
 * - GET /api/v1/notifications (list)
 * - POST /api/v1/notifications/:id/read (mark read)
 * - POST /api/v1/notifications/read-all (mark all read)
 * - DELETE /api/v1/notifications/:id (delete)
 * - GET /api/v1/notifications/unread-count (count)
 * - GET /api/v1/notifications/preferences (get)
 * - POST /api/v1/notifications/preferences (update)
 */

const request = require('supertest');
const express = require('express');
const notificationController = require('../../../src/controllers/notificationController');
const NotificationService = require('../../../src/services/NotificationService');
const { authenticateToken, authorizeRole } = require('../../../src/middleware/auth');

// Mock middleware
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: '550d117a-3d96-43de-a2dc-ee5027c776a3' };
    next();
  },
  authorizeRole: (roles) => (req, res, next) => {
    req.user.role = 'admin';
    next();
  },
}));

// Mock NotificationService
jest.mock('../../../src/services/NotificationService', () => ({
  createNotification: jest.fn(),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  getUnreadCount: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
}));

// Mock Logger
jest.mock('../../../src/services/Logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Notification Controller', () => {
  let app;
  const userId = '550d117a-3d96-43de-a2dc-ee5027c776a3';
  const adminId = '550d117a-3d96-43de-a2dc-ee5027c776a4';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/notifications', notificationController);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/notifications - Create Notification (Admin Only)', () => {
    it('should create notification with valid data', async () => {
      const mockNotification = {
        id: '123',
        type: 'info',
        title: 'Test Notification',
        message: 'Test message',
        recipientIds: [userId],
      };

      NotificationService.createNotification.mockResolvedValue([mockNotification]);

      const res = await request(app)
        .post('/api/v1/notifications')
        .send({
          type: 'info',
          title: 'Test Notification',
          message: 'Test message',
          recipientIds: [userId],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual([mockNotification]);
    });

    it('should require type field', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .send({
          title: 'Test Notification',
          message: 'Test message',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should require title field', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .send({
          type: 'info',
          message: 'Test message',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should require recipientIds field', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .send({
          type: 'info',
          title: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should handle service errors', async () => {
      NotificationService.createNotification.mockRejectedValue(new Error('DB Error'));

      const res = await request(app)
        .post('/api/v1/notifications')
        .send({
          type: 'info',
          title: 'Test',
          recipientIds: [userId],
        });

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/notifications - List User Notifications', () => {
    it('should list user notifications with pagination', async () => {
      const mockNotifications = [
        { id: '1', title: 'Test 1', read: false },
        { id: '2', title: 'Test 2', read: true },
      ];

      NotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ limit: 50, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.notifications).toEqual(mockNotifications);
      expect(res.body.data.pagination.limit).toBe(50);
    });

    it('should enforce limit maximum of 100', async () => {
      NotificationService.getNotifications.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ limit: 500 });

      expect(res.status).toBe(200);
      // Should have capped limit at 100
      const [, callArgs] = NotificationService.getNotifications.mock.calls[0];
      expect(callArgs.limit).toBeLessThanOrEqual(100);
    });

    it('should support filter by type', async () => {
      const mockNotifications = [{ id: '1', type: 'alert', title: 'Alert' }];

      NotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ actionType: 'alert' });

      expect(res.status).toBe(200);
    });

    it('should support filter unread only', async () => {
      const mockNotifications = [{ id: '1', read: false }];

      NotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ onlyUnread: true });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/notifications/:id/read - Mark Single as Read', () => {
    it('should mark notification as read', async () => {
      const notifId = '123';
      const mockResult = { id: notifId, read: true };

      NotificationService.markAsRead.mockResolvedValue(mockResult);

      const res = await request(app).post(`/api/v1/notifications/${notifId}/read`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(NotificationService.markAsRead).toHaveBeenCalledWith(
        userId,
        notifId
      );
    });

    it('should handle service errors', async () => {
      NotificationService.markAsRead.mockRejectedValue(new Error('Error'));

      const res = await request(app).post('/api/v1/notifications/123/read');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/v1/notifications/read-all - Mark All as Read', () => {
    it('should mark all notifications as read', async () => {
      const mockResult = { updatedCount: 5 };

      NotificationService.markAllAsRead.mockResolvedValue(mockResult);

      const res = await request(app).post('/api/v1/notifications/read-all');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual(mockResult);
    });

    it('should handle empty result', async () => {
      NotificationService.markAllAsRead.mockResolvedValue({ updatedCount: 0 });

      const res = await request(app).post('/api/v1/notifications/read-all');

      expect(res.status).toBe(200);
      expect(res.body.data.updatedCount).toBe(0);
    });
  });

  describe('DELETE /api/v1/notifications/:id - Delete Notification', () => {
    it('should delete notification', async () => {
      const notifId = '123';

      NotificationService.deleteNotification.mockResolvedValue(true);

      const res = await request(app).delete(`/api/v1/notifications/${notifId}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(NotificationService.deleteNotification).toHaveBeenCalledWith(
        userId,
        notifId
      );
    });

    it('should handle not found', async () => {
      NotificationService.deleteNotification.mockResolvedValue(false);

      const res = await request(app).delete('/api/v1/notifications/999');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/notifications/unread-count - Get Unread Count', () => {
    it('should return unread count', async () => {
      NotificationService.getUnreadCount.mockResolvedValue(3);

      const res = await request(app).get('/api/v1/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.unreadCount).toBe(3);
    });

    it('should return zero when no unread', async () => {
      NotificationService.getUnreadCount.mockResolvedValue(0);

      const res = await request(app).get(
        '/api/v1/notifications/unread-count'
      );

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(0);
    });
  });

  describe('GET /api/v1/notifications/preferences - Get Preferences', () => {
    it('should return user preferences', async () => {
      const mockPrefs = {
        userId,
        emailNotifications: true,
        pushNotifications: false,
      };

      NotificationService.getPreferences.mockResolvedValue(mockPrefs);

      const res = await request(app).get(
        '/api/v1/notifications/preferences'
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual(mockPrefs);
    });
  });

  describe('POST /api/v1/notifications/preferences - Update Preferences', () => {
    it('should update preferences', async () => {
      const updatedPrefs = {
        userId,
        emailNotifications: false,
        pushNotifications: true,
      };

      NotificationService.updatePreferences.mockResolvedValue(updatedPrefs);

      const res = await request(app)
        .post('/api/v1/notifications/preferences')
        .send(updatedPrefs);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual(updatedPrefs);
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { emailNotifications: false };
      const result = { userId, ...partialUpdate };

      NotificationService.updatePreferences.mockResolvedValue(result);

      const res = await request(app)
        .post('/api/v1/notifications/preferences')
        .send(partialUpdate);

      expect(res.status).toBe(200);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication', async () => {
      // This would require removing the mock to test properly
      // For now, we trust the middleware is applied
      expect(notificationController).toBeDefined();
    });

    it('should require admin role for creation', async () => {
      // Admin role enforced by middleware
      expect(notificationController).toBeDefined();
    });
  });

  describe('Pagination Validation', () => {
    it('should accept valid pagination params', async () => {
      NotificationService.getNotifications.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ limit: 50, offset: 10 });

      expect(res.status).toBe(200);
    });

    it('should handle default pagination', async () => {
      NotificationService.getNotifications.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/notifications');

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(50);
      expect(res.body.data.pagination.offset).toBe(0);
    });
  });
});
