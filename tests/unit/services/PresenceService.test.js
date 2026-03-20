/**
 * PresenceService Unit Tests
 * Tests user presence tracking via in-memory Map
 */

jest.spyOn(console, 'error').mockImplementation(() => {});

describe('PresenceService', () => {
  let PresenceService;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PRESENCE_TRACKING_ENABLED = 'true';
    PresenceService = require('../../../src/services/PresenceService');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setPresence', () => {
    it('should set user presence on a resource', async () => {
      await PresenceService.setPresence('user-1', 'episode', 'ep-42');
      const viewers = await PresenceService.getPresence('episode', 'ep-42');
      expect(viewers).toContain('user-1');
    });

    it('should support multiple users on the same resource', async () => {
      await PresenceService.setPresence('user-a', 'scene', 's-1');
      await PresenceService.setPresence('user-b', 'scene', 's-1');
      const viewers = await PresenceService.getPresence('scene', 's-1');
      expect(viewers).toContain('user-a');
      expect(viewers).toContain('user-b');
    });

    it('should not duplicate the same user on the same resource', async () => {
      await PresenceService.setPresence('user-x', 'episode', 'ep-1');
      await PresenceService.setPresence('user-x', 'episode', 'ep-1');
      const viewers = await PresenceService.getPresence('episode', 'ep-1');
      const userXCount = viewers.filter((v) => v === 'user-x').length;
      expect(userXCount).toBe(1);
    });

    it('should resolve without error when disabled', async () => {
      jest.resetModules();
      process.env.PRESENCE_TRACKING_ENABLED = 'false';
      const DisabledService = require('../../../src/services/PresenceService');
      await expect(DisabledService.setPresence('u', 'episode', '1')).resolves.toBeUndefined();
    });

    it('should track presence independently per resource', async () => {
      await PresenceService.setPresence('user-1', 'episode', 'ep-1');
      await PresenceService.setPresence('user-2', 'episode', 'ep-2');

      const ep1Viewers = await PresenceService.getPresence('episode', 'ep-1');
      const ep2Viewers = await PresenceService.getPresence('episode', 'ep-2');

      expect(ep1Viewers).toContain('user-1');
      expect(ep1Viewers).not.toContain('user-2');
      expect(ep2Viewers).toContain('user-2');
      expect(ep2Viewers).not.toContain('user-1');
    });
  });

  describe('removePresence', () => {
    it('should remove a user from a resource', async () => {
      await PresenceService.setPresence('user-1', 'episode', 'ep-10');
      await PresenceService.removePresence('user-1', 'episode', 'ep-10');
      const viewers = await PresenceService.getPresence('episode', 'ep-10');
      expect(viewers).not.toContain('user-1');
    });

    it('should not throw when removing a user who is not present', async () => {
      await expect(
        PresenceService.removePresence('ghost-user', 'episode', 'ep-unknown')
      ).resolves.toBeUndefined();
    });

    it('should only remove the specified user, not all users', async () => {
      await PresenceService.setPresence('user-a', 'episode', 'ep-shared');
      await PresenceService.setPresence('user-b', 'episode', 'ep-shared');
      await PresenceService.removePresence('user-a', 'episode', 'ep-shared');
      const viewers = await PresenceService.getPresence('episode', 'ep-shared');
      expect(viewers).not.toContain('user-a');
      expect(viewers).toContain('user-b');
    });
  });

  describe('getPresence', () => {
    it('should return an empty array for a resource with no viewers', async () => {
      const viewers = await PresenceService.getPresence('episode', 'nonexistent-resource');
      expect(viewers).toEqual([]);
    });

    it('should return an array of user ids', async () => {
      await PresenceService.setPresence('user-1', 'thumbnail', 'th-1');
      const viewers = await PresenceService.getPresence('thumbnail', 'th-1');
      expect(Array.isArray(viewers)).toBe(true);
      expect(viewers).toContain('user-1');
    });

    it('should use the correct key format resourceType:resourceId', async () => {
      // Two resources with same id but different type should be separate
      await PresenceService.setPresence('user-1', 'episode', '42');
      await PresenceService.setPresence('user-2', 'scene', '42');

      const epViewers = await PresenceService.getPresence('episode', '42');
      const sceneViewers = await PresenceService.getPresence('scene', '42');

      expect(epViewers).toContain('user-1');
      expect(epViewers).not.toContain('user-2');
      expect(sceneViewers).toContain('user-2');
      expect(sceneViewers).not.toContain('user-1');
    });
  });
});
