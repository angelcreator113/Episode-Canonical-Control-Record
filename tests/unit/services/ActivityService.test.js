/**
 * ActivityService Unit Tests
 * Tests activity logging, retrieval, and graceful error handling
 */

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('ActivityService', () => {
  let ActivityService;

  beforeEach(() => {
    // Reset module registry to get a fresh instance for each test
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.ACTIVITY_LOGGING_ENABLED = 'true';
    ActivityService = require('../../../src/services/ActivityService');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logActivity', () => {
    it('should log an activity and return the created object', async () => {
      const data = { userId: 'u1', action: 'VIEW', resourceType: 'episode', resourceId: '42' };
      const result = await ActivityService.logActivity(data);
      expect(result).toMatchObject(data);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('timestamp');
    });

    it('should store the activity in the internal array', async () => {
      const data = { userId: 'u1', action: 'EDIT', resourceType: 'scene', resourceId: '7' };
      await ActivityService.logActivity(data);
      const activities = await ActivityService.getByUserId('u1');
      expect(activities.length).toBeGreaterThanOrEqual(1);
    });

    it('should resolve without throwing when disabled', async () => {
      jest.resetModules();
      process.env.ACTIVITY_LOGGING_ENABLED = 'false';
      const DisabledService = require('../../../src/services/ActivityService');
      const result = await DisabledService.logActivity({ userId: 'u1', action: 'VIEW' });
      expect(result).toBeUndefined();
    });

    it('should include a timestamp in the activity object', async () => {
      const data = { userId: 'u2', action: 'DELETE', resourceType: 'thumbnail' };
      const result = await ActivityService.logActivity(data);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should assign a string id to the activity', async () => {
      const result = await ActivityService.logActivity({ userId: 'u1', action: 'CREATE' });
      expect(typeof result.id).toBe('string');
    });
  });

  describe('getByUserId', () => {
    it('should return only activities for the specified user', async () => {
      await ActivityService.logActivity({ userId: 'alice', action: 'VIEW', resourceType: 'ep' });
      await ActivityService.logActivity({ userId: 'bob', action: 'EDIT', resourceType: 'ep' });
      const aliceActivities = await ActivityService.getByUserId('alice');
      expect(aliceActivities.every((a) => a.userId === 'alice')).toBe(true);
    });

    it('should return empty array for a user with no activities', async () => {
      const activities = await ActivityService.getByUserId('nobody');
      expect(activities).toEqual([]);
    });

    it('should return multiple activities for the same user', async () => {
      await ActivityService.logActivity({ userId: 'multi', action: 'A1', resourceType: 'ep' });
      await ActivityService.logActivity({ userId: 'multi', action: 'A2', resourceType: 'ep' });
      const results = await ActivityService.getByUserId('multi');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getByResource', () => {
    it('should return activities matching resourceType and resourceId', async () => {
      await ActivityService.logActivity({ userId: 'u1', action: 'VIEW', resourceType: 'episode', resourceId: 'ep1' });
      await ActivityService.logActivity({ userId: 'u2', action: 'EDIT', resourceType: 'episode', resourceId: 'ep2' });

      const results = await ActivityService.getByResource('episode', 'ep1');
      expect(results.every((a) => a.resourceType === 'episode' && a.resourceId === 'ep1')).toBe(true);
    });

    it('should return empty array when no matching activities exist', async () => {
      const results = await ActivityService.getByResource('scene', 'nonexistent-id');
      expect(results).toEqual([]);
    });

    it('should filter by both resourceType and resourceId', async () => {
      await ActivityService.logActivity({ userId: 'u1', action: 'VIEW', resourceType: 'episode', resourceId: 'shared' });
      await ActivityService.logActivity({ userId: 'u2', action: 'VIEW', resourceType: 'thumbnail', resourceId: 'shared' });

      const episodes = await ActivityService.getByResource('episode', 'shared');
      expect(episodes.every((a) => a.resourceType === 'episode')).toBe(true);
      expect(episodes.some((a) => a.resourceType === 'thumbnail')).toBe(false);
    });
  });
});
