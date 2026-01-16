/**
 * Scene Controller Unit Tests
 * Tests all scene controller methods with proper mocking and assertions
 */

jest.mock('../../../src/models');
jest.mock('../../../src/middleware/errorHandler');

const sceneController = require('../../../src/controllers/sceneController');
const { models } = require('../../../src/models');
const { NotFoundError, ValidationError } = require('../../../src/middleware/errorHandler');

describe('Scene Controller Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      query: {},
      body: {},
      params: {},
      user: { id: 'user-123' },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('listScenes()', () => {
    test('should return scenes list with pagination', async () => {
      const mockScenes = [
        { 
          id: 'scene-1', 
          episode_id: 'ep-1',
          scene_number: 1,
          title: 'Opening Scene',
          episode: { id: 'ep-1', title: 'Episode 1' }
        },
        { 
          id: 'scene-2', 
          episode_id: 'ep-1',
          scene_number: 2,
          title: 'Main Scene',
          episode: { id: 'ep-1', title: 'Episode 1' }
        },
      ];

      models.Scene.findAndCountAll = jest.fn().mockResolvedValue({
        count: 2,
        rows: mockScenes,
      });

      mockReq.query = { page: 1, limit: 50 };

      await sceneController.listScenes(mockReq, mockRes);

      expect(models.Scene.findAndCountAll).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockScenes,
          pagination: expect.objectContaining({
            page: 1,
            limit: 50,
            total: 2,
          }),
        })
      );
    });

    test('should filter by episode_id', async () => {
      models.Scene.findAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ id: 'scene-1', episode_id: 'ep-1' }],
      });

      mockReq.query = { episode_id: 'ep-1' };

      await sceneController.listScenes(mockReq, mockRes);

      expect(models.Scene.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ episode_id: 'ep-1' }),
        })
      );
    });

    test('should handle errors gracefully', async () => {
      models.Scene.findAndCountAll = jest.fn().mockRejectedValue(new Error('Database error'));

      await sceneController.listScenes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to list scenes',
        })
      );
    });
  });

  describe('getScene()', () => {
    test('should return single scene by id', async () => {
      const mockScene = {
        id: 'scene-1',
        episode_id: 'ep-1',
        scene_number: 1,
        title: 'Opening Scene',
        episode: { id: 'ep-1', title: 'Episode 1' },
      };

      models.Scene.findByPk = jest.fn().mockResolvedValue(mockScene);

      mockReq.params = { id: 'scene-1' };

      await sceneController.getScene(mockReq, mockRes);

      expect(models.Scene.findByPk).toHaveBeenCalledWith('scene-1', expect.any(Object));
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockScene,
        })
      );
    });

    test('should return 404 if scene not found', async () => {
      models.Scene.findByPk = jest.fn().mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await sceneController.getScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Scene not found',
        })
      );
    });

    test('should handle database errors', async () => {
      models.Scene.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));

      mockReq.params = { id: 'scene-1' };

      await sceneController.getScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to get scene',
        })
      );
    });
  });

  describe('createScene()', () => {
    test('should create new scene successfully', async () => {
      const mockEpisode = { id: 'ep-1', title: 'Episode 1', status: 'draft' };
      const mockScene = {
        id: 'scene-1',
        episode_id: 'ep-1',
        scene_number: 1,
        title: 'New Scene',
      };

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.Scene.getNextSceneNumber = jest.fn().mockResolvedValue(1);
      models.Scene.create = jest.fn().mockResolvedValue(mockScene);

      mockReq.body = {
        episode_id: 'ep-1',
        title: 'New Scene',
        description: 'Test scene',
        location: 'Studio',
        duration_seconds: 120,
      };

      await sceneController.createScene(mockReq, mockRes);

      expect(models.Episode.findByPk).toHaveBeenCalledWith('ep-1');
      expect(models.Scene.getNextSceneNumber).toHaveBeenCalledWith('ep-1');
      expect(models.Scene.create).toHaveBeenCalledWith(
        expect.objectContaining({
          episode_id: 'ep-1',
          title: 'New Scene',
          scene_number: 1,
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockScene,
          message: 'Scene created successfully',
        })
      );
    });

    test('should return 400 if episode_id is missing', async () => {
      mockReq.body = { title: 'New Scene' };

      await sceneController.createScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields',
        })
      );
    });

    test('should return 404 if episode not found', async () => {
      models.Episode.findByPk = jest.fn().mockResolvedValue(null);

      mockReq.body = {
        episode_id: 'nonexistent',
        title: 'New Scene',
      };

      await sceneController.createScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Episode not found',
        })
      );
    });

    test('should handle database errors', async () => {
      models.Episode.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));

      mockReq.body = {
        episode_id: 'ep-1',
        title: 'New Scene',
      };

      await sceneController.createScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to create scene',
        })
      );
    });
  });

  describe('updateScene()', () => {
    test('should update scene successfully', async () => {
      const mockScene = {
        id: 'scene-1',
        episode_id: 'ep-1',
        title: 'Old Title',
        duration_seconds: 120,
        save: jest.fn().mockResolvedValue(true),
      };

      models.Scene.findByPk = jest.fn().mockResolvedValue(mockScene);

      mockReq.params = { id: 'scene-1' };
      mockReq.body = {
        title: 'Updated Title',
        duration_seconds: 180,
      };

      await sceneController.updateScene(mockReq, mockRes);

      expect(mockScene.save).toHaveBeenCalled();
      expect(mockScene.title).toBe('Updated Title');
      expect(mockScene.duration_seconds).toBe(180);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Scene updated successfully',
        })
      );
    });

    test('should return 404 if scene not found', async () => {
      models.Scene.findByPk = jest.fn().mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { title: 'Updated' };

      await sceneController.updateScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Scene not found',
        })
      );
    });

    test('should handle database errors', async () => {
      models.Scene.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));

      mockReq.params = { id: 'scene-1' };
      mockReq.body = { title: 'Updated' };

      await sceneController.updateScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to update scene',
        })
      );
    });
  });

  describe('deleteScene()', () => {
    test('should delete scene successfully', async () => {
      const mockScene = {
        id: 'scene-1',
        episode_id: 'ep-1',
        destroy: jest.fn().mockResolvedValue(true),
      };

      models.Scene.findByPk = jest.fn().mockResolvedValue(mockScene);

      mockReq.params = { id: 'scene-1' };

      await sceneController.deleteScene(mockReq, mockRes);

      expect(mockScene.destroy).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Scene deleted successfully',
        })
      );
    });

    test('should return 404 if scene not found', async () => {
      models.Scene.findByPk = jest.fn().mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await sceneController.deleteScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Scene not found',
        })
      );
    });

    test('should handle database errors', async () => {
      models.Scene.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));

      mockReq.params = { id: 'scene-1' };

      await sceneController.deleteScene(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to delete scene',
        })
      );
    });
  });

  describe('getEpisodeScenes()', () => {
    test('should return all scenes for an episode', async () => {
      const mockEpisode = { id: 'ep-1', title: 'Episode 1' };
      const mockScenes = [
        { id: 'scene-1', scene_number: 1, title: 'Scene 1' },
        { id: 'scene-2', scene_number: 2, title: 'Scene 2' },
      ];

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.Scene.getEpisodeScenes = jest.fn().mockResolvedValue(mockScenes);

      mockReq.params = { episodeId: 'ep-1' };

      await sceneController.getEpisodeScenes(mockReq, mockRes);

      expect(models.Episode.findByPk).toHaveBeenCalledWith('ep-1');
      expect(models.Scene.getEpisodeScenes).toHaveBeenCalledWith('ep-1');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockScenes,
          count: 2,
        })
      );
    });

    test('should return 404 if episode not found', async () => {
      models.Episode.findByPk = jest.fn().mockResolvedValue(null);

      mockReq.params = { episodeId: 'nonexistent' };

      await sceneController.getEpisodeScenes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Episode not found',
        })
      );
    });

    test('should handle database errors', async () => {
      models.Episode.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));

      mockReq.params = { episodeId: 'ep-1' };

      await sceneController.getEpisodeScenes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to get episode scenes',
        })
      );
    });
  });
});
