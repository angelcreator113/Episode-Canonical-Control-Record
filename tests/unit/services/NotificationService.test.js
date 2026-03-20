/**
 * NotificationService Unit Tests
 * Tests notification creation, retrieval, and mark-as-read
 */

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('NotificationService', () => {
  let NotificationService;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NOTIFICATIONS_ENABLED = 'true';
    NotificationService = require('../../../src/services/NotificationService');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create and return a notification object', async () => {
      const data = { userId: 'u1', message: 'Hello!', type: 'info' };
      const notification = await NotificationService.create(data);
      expect(notification).toMatchObject(data);
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('createdAt');
      expect(notification.read).toBe(false);
    });

    it('should resolve with undefined when disabled', async () => {
      jest.resetModules();
      process.env.NOTIFICATIONS_ENABLED = 'false';
      const DisabledService = require('../../../src/services/NotificationService');
      const result = await DisabledService.create({ userId: 'u1', message: 'Disabled' });
      expect(result).toBeUndefined();
    });

    it('should set read to false by default', async () => {
      const notification = await NotificationService.create({ userId: 'u1', message: 'Test' });
      expect(notification.read).toBe(false);
    });

    it('should assign a string id', async () => {
      const notification = await NotificationService.create({ userId: 'u1', message: 'Test' });
      expect(typeof notification.id).toBe('string');
    });

    it('should set createdAt as a Date', async () => {
      const notification = await NotificationService.create({ userId: 'u1', message: 'Test' });
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    it('should store the notification for later retrieval', async () => {
      await NotificationService.create({ userId: 'stored-user', message: 'Stored' });
      const notifications = await NotificationService.getByUserId('stored-user');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getByUserId', () => {
    it('should return only notifications for the specified user', async () => {
      await NotificationService.create({ userId: 'alice', message: 'Hi Alice' });
      await NotificationService.create({ userId: 'bob', message: 'Hi Bob' });

      const aliceNotes = await NotificationService.getByUserId('alice');
      expect(aliceNotes.every((n) => n.userId === 'alice')).toBe(true);
    });

    it('should return empty array for user with no notifications', async () => {
      const results = await NotificationService.getByUserId('nobody-ever');
      expect(results).toEqual([]);
    });

    it('should return multiple notifications for the same user', async () => {
      await NotificationService.create({ userId: 'multi', message: 'First' });
      await NotificationService.create({ userId: 'multi', message: 'Second' });

      const results = await NotificationService.getByUserId('multi');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notification = await NotificationService.create({ userId: 'u1', message: 'Mark me' });
      expect(notification.read).toBe(false);

      await NotificationService.markAsRead(notification.id);

      const notifications = await NotificationService.getByUserId('u1');
      const updated = notifications.find((n) => n.id === notification.id);
      expect(updated.read).toBe(true);
    });

    it('should resolve without error for a non-existent notification id', async () => {
      await expect(NotificationService.markAsRead('non-existent-id')).resolves.toBeUndefined();
    });

    it('should not affect other notifications', async () => {
      const n1 = await NotificationService.create({ userId: 'u2', message: 'First' });
      // Add 1ms delay to guarantee distinct Date.now() IDs
      await new Promise((r) => setTimeout(r, 1));
      await NotificationService.create({ userId: 'u2', message: 'Second' });

      await NotificationService.markAsRead(n1.id);

      const notifications = await NotificationService.getByUserId('u2');
      const second = notifications.find((n) => n.message === 'Second');
      expect(second).toBeDefined();
      expect(second.read).toBe(false);
    });
  });
});
