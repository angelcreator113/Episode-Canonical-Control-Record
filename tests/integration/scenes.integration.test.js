const request = require('supertest');
const app = require('../../src/app');
const { Scene, Episode, Show, models } = require('../../src/models');
const { generateToken } = require('../../src/services/tokenService');

/**
 * Scenes API Integration Tests
 * Tests all 11 scene endpoints with authentication
 */

// Skip integration tests if test database is not configured
const testDbConfigured = !process.env.DATABASE_URL?.includes('amazonaws.com');

(testDbConfigured ? describe : describe.skip)('Scenes API Integration Tests', () => {
  let authToken;
  let testShow;
  let testEpisode;
  let testScene1;
  let testScene2;
  let testScene3;

  // Setup: Create auth token and test data
  beforeAll(async () => {
    // Create test user token (Editor role)
    authToken = generateToken({
      id: 'test-user-scenes-123',
      email: 'scenes-test@example.com',
      role: 'EDITOR',
      groups: ['EDITOR'],
    });

    // Create test show
    testShow = await Show.create({
      name: 'Test Show for Scenes',
      slug: 'test-show-scenes',
      description: 'Testing scenes functionality',
      icon: 'test-icon',
      color: '#FF5733',
    });

    // Create test episode
    testEpisode = await Episode.create({
      show_id: testShow.id,
      episode_number: 1,
      title: 'Test Episode with Scenes',
      status: 'draft',
    });
  });

  // Cleanup: Remove all test data
  afterAll(async () => {
    await Scene.destroy({ where: {}, force: true });
    await Episode.destroy({ where: {}, force: true });
    await Show.destroy({ where: {}, force: true });
  });

  // Clean up scenes between tests
  afterEach(async () => {
    await Scene.destroy({ where: {}, force: true });
  });

  /**
   * POST /api/v1/scenes - Create Scene
   */
  describe('POST /api/v1/scenes', () => {
    it('should create a new scene with scene_number 1', async () => {
      const response = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          episodeId: testEpisode.id,
          title: 'Opening Scene',
          description: 'LaLa introduces the episode theme',
          sceneType: 'intro',
          durationSeconds: 120,
          location: 'Living Room',
          mood: 'upbeat',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Opening Scene');
      expect(response.body.data.sceneNumber).toBe(1);
      expect(response.body.data.episodeId).toBe(testEpisode.id);
      expect(response.body.data.sceneType).toBe('intro');
      expect(response.body.data.durationSeconds).toBe(120);

      testScene1 = response.body.data;
    });

    it('should auto-increment scene numbers', async () => {
      // Create first scene
      const scene1 = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          episodeId: testEpisode.id,
          title: 'Scene 1',
          sceneType: 'intro',
        });

      expect(scene1.body.data.sceneNumber).toBe(1);

      // Create second scene
      const scene2 = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          episodeId: testEpisode.id,
          title: 'Scene 2',
          sceneType: 'main',
        });

      expect(scene2.body.data.sceneNumber).toBe(2);

      // Create third scene
      const scene3 = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          episodeId: testEpisode.id,
          title: 'Scene 3',
          sceneType: 'outro',
        });

      expect(scene3.body.data.sceneNumber).toBe(3);
    });

    it('should reject creation with missing episodeId', async () => {
      const response = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Scene',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/required/i);
    });

    it('should reject creation with missing title', async () => {
      const response = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          episodeId: testEpisode.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/required/i);
    });

    it('should reject creation for non-existent episode', async () => {
      const response = await request(app)
        .post('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          episodeId: '00000000-0000-0000-0000-000000000000',
          title: 'Invalid Scene',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/Episode not found/i);
    });

    it.skip('should reject scene creation without auth token', async () => {
      const response = await request(app)
        .post('/api/v1/scenes')
        .send({
          episodeId: testEpisode.id,
          title: 'Unauthorized Scene',
        });

      expect(response.status).toBe(401);
    });
  });

  /**
   * GET /api/v1/scenes/:id - Get Single Scene
   */
  describe('GET /api/v1/scenes/:id', () => {
    beforeEach(async () => {
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Test Scene',
        description: 'Test description',
        sceneType: 'main',
        createdBy: 'test-user',
      });
    });

    it('should get a scene by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/scenes/${testScene1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testScene1.id);
      expect(response.body.data.title).toBe('Test Scene');
      expect(response.body.data.episode).toBeDefined();
      expect(response.body.data.episode.id).toBe(testEpisode.id);
    });

    it('should return 404 for non-existent scene', async () => {
      const response = await request(app)
        .get('/api/v1/scenes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });
  });

  /**
   * GET /api/v1/scenes - List Scenes
   */
  describe('GET /api/v1/scenes', () => {
    beforeEach(async () => {
      // Create multiple test scenes
      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Scene 1',
        sceneType: 'intro',
        productionStatus: 'draft',
        createdBy: 'test-user',
      });

      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 2,
        title: 'Scene 2',
        sceneType: 'main',
        productionStatus: 'complete',
        createdBy: 'test-user',
      });

      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 3,
        title: 'Scene 3',
        sceneType: 'outro',
        productionStatus: 'draft',
        createdBy: 'test-user',
      });
    });

    it('should list all scenes with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(3);
    });

    it('should filter scenes by episodeId', async () => {
      const response = await request(app)
        .get('/api/v1/scenes')
        .query({ episodeId: testEpisode.id })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(s => s.episodeId === testEpisode.id)).toBe(true);
    });

    it('should filter scenes by sceneType', async () => {
      const response = await request(app)
        .get('/api/v1/scenes')
        .query({ sceneType: 'intro' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(s => s.sceneType === 'intro')).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should filter scenes by productionStatus', async () => {
      const response = await request(app)
        .get('/api/v1/scenes')
        .query({ productionStatus: 'draft' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(s => s.productionStatus === 'draft')).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/scenes')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.pages).toBe(2); // 3 scenes / 2 per page = 2 pages
    });

    it('should return scenes ordered by sceneNumber', async () => {
      const response = await request(app)
        .get('/api/v1/scenes')
        .set('Authorization', `Bearer ${authToken}`);

      const scenes = response.body.data;
      for (let i = 1; i < scenes.length; i++) {
        expect(scenes[i].sceneNumber).toBeGreaterThanOrEqual(scenes[i - 1].sceneNumber);
      }
    });
  });

  /**
   * PUT /api/v1/scenes/:id - Update Scene
   */
  describe('PUT /api/v1/scenes/:id', () => {
    beforeEach(async () => {
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Original Title',
        description: 'Original description',
        durationSeconds: 60,
        createdBy: 'test-user',
      });
    });

    it('should update a scene', async () => {
      const response = await request(app)
        .put(`/api/v1/scenes/${testScene1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          description: 'Updated description',
          durationSeconds: 120,
          sceneType: 'main',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.durationSeconds).toBe(120);
      expect(response.body.data.sceneType).toBe('main');
    });

    it('should prevent updating locked scenes', async () => {
      // Lock the scene
      await testScene1.update({ isLocked: true });

      const response = await request(app)
        .put(`/api/v1/scenes/${testScene1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Should Not Update',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/locked/i);
    });

    it('should return 404 for non-existent scene', async () => {
      const response = await request(app)
        .put('/api/v1/scenes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated',
        });

      expect(response.status).toBe(404);
    });
  });

  /**
   * DELETE /api/v1/scenes/:id - Delete Scene
   */
  describe('DELETE /api/v1/scenes/:id', () => {
    beforeEach(async () => {
      // Create 3 scenes
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Scene 1',
        createdBy: 'test-user',
      });

      testScene2 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 2,
        title: 'Scene 2',
        createdBy: 'test-user',
      });

      testScene3 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 3,
        title: 'Scene 3',
        createdBy: 'test-user',
      });
    });

    it('should delete a scene (soft delete)', async () => {
      const response = await request(app)
        .delete(`/api/v1/scenes/${testScene2.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedSceneId).toBe(testScene2.id);

      // Verify soft delete
      const deleted = await Scene.findByPk(testScene2.id, { paranoid: false });
      expect(deleted.deletedAt).not.toBeNull();
    });

    it('should renumber remaining scenes after deletion', async () => {
      // Delete scene 2 (middle scene)
      await request(app)
        .delete(`/api/v1/scenes/${testScene2.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Get remaining scenes
      const scenes = await Scene.getEpisodeScenes(testEpisode.id);

      // Should have 2 scenes with numbers 1 and 2 (renumbered)
      expect(scenes.length).toBe(2);
      expect(scenes[0].sceneNumber).toBe(1);
      expect(scenes[1].sceneNumber).toBe(2);
    });

    it('should prevent deleting locked scenes', async () => {
      await testScene1.update({ isLocked: true });

      const response = await request(app)
        .delete(`/api/v1/scenes/${testScene1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/locked/i);
    });
  });

  /**
   * GET /api/v1/episodes/:episodeId/scenes - Get Episode Scenes
   */
  describe('GET /api/v1/episodes/:episodeId/scenes', () => {
    beforeEach(async () => {
      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Scene 1',
        sceneType: 'intro',
        durationSeconds: 60,
        createdBy: 'test-user',
      });

      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 2,
        title: 'Scene 2',
        sceneType: 'main',
        durationSeconds: 120,
        createdBy: 'test-user',
      });
    });

    it('should get all scenes for an episode', async () => {
      const response = await request(app)
        .get(`/api/v1/episodes/${testEpisode.id}/scenes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
      expect(response.body.stats).toBeDefined();
      expect(response.body.episodeInfo).toBeDefined();
    });

    it('should return scenes in order by sceneNumber', async () => {
      const response = await request(app)
        .get(`/api/v1/episodes/${testEpisode.id}/scenes`)
        .set('Authorization', `Bearer ${authToken}`);

      const scenes = response.body.data;
      expect(scenes[0].sceneNumber).toBe(1);
      expect(scenes[1].sceneNumber).toBe(2);
    });

    it('should include scene statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/episodes/${testEpisode.id}/scenes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.stats.total).toBe(2);
      expect(response.body.stats.totalDuration).toBe(180); // 60 + 120
      expect(response.body.stats.byType).toBeDefined();
      expect(response.body.stats.byStatus).toBeDefined();
    });

    it('should return 404 for non-existent episode', async () => {
      const response = await request(app)
        .get('/api/v1/episodes/00000000-0000-0000-0000-000000000000/scenes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  /**
   * PUT /api/v1/episodes/:episodeId/scenes/reorder - Reorder Scenes
   */
  describe('PUT /api/v1/episodes/:episodeId/scenes/reorder', () => {
    beforeEach(async () => {
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Scene A',
        createdBy: 'test-user',
      });

      testScene2 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 2,
        title: 'Scene B',
        createdBy: 'test-user',
      });

      testScene3 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 3,
        title: 'Scene C',
        createdBy: 'test-user',
      });
    });

    it('should reorder scenes', async () => {
      // Reverse the order: C, B, A
      const response = await request(app)
        .put(`/api/v1/episodes/${testEpisode.id}/scenes/reorder`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneIds: [testScene3.id, testScene2.id, testScene1.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const reorderedScenes = response.body.data;
      expect(reorderedScenes[0].id).toBe(testScene3.id);
      expect(reorderedScenes[0].sceneNumber).toBe(1);

      expect(reorderedScenes[1].id).toBe(testScene2.id);
      expect(reorderedScenes[1].sceneNumber).toBe(2);

      expect(reorderedScenes[2].id).toBe(testScene1.id);
      expect(reorderedScenes[2].sceneNumber).toBe(3);
    });

    it('should reject empty sceneIds array', async () => {
      const response = await request(app)
        .put(`/api/v1/episodes/${testEpisode.id}/scenes/reorder`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneIds: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/non-empty array/i);
    });

    it('should reject non-array sceneIds', async () => {
      const response = await request(app)
        .put(`/api/v1/episodes/${testEpisode.id}/scenes/reorder`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sceneIds: 'not-an-array',
        });

      expect(response.status).toBe(400);
    });
  });

  /**
   * PUT /api/v1/scenes/:id/status - Update Scene Status
   */
  describe('PUT /api/v1/scenes/:id/status', () => {
    beforeEach(async () => {
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Test Scene',
        productionStatus: 'draft',
        createdBy: 'test-user',
      });
    });

    it('should update scene production status', async () => {
      const response = await request(app)
        .put(`/api/v1/scenes/${testScene1.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'storyboarded',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.productionStatus).toBe('storyboarded');
    });

    it('should reject invalid status values', async () => {
      const response = await request(app)
        .put(`/api/v1/scenes/${testScene1.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid-status',
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toMatch(/Invalid status/i);
    });

    it('should reject missing status field', async () => {
      const response = await request(app)
        .put(`/api/v1/scenes/${testScene1.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/required/i);
    });
  });

  /**
   * POST /api/v1/scenes/:id/characters - Add Character
   */
  describe('POST /api/v1/scenes/:id/characters', () => {
    beforeEach(async () => {
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Test Scene',
        characters: [],
        createdBy: 'test-user',
      });
    });

    it('should add a character to a scene', async () => {
      const response = await request(app)
        .post(`/api/v1/scenes/${testScene1.id}/characters`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          characterName: 'LaLa',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.characters).toContain('LaLa');
    });

    it('should not add duplicate characters', async () => {
      // Add LaLa
      await request(app)
        .post(`/api/v1/scenes/${testScene1.id}/characters`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ characterName: 'LaLa' });

      // Try to add LaLa again
      const response = await request(app)
        .post(`/api/v1/scenes/${testScene1.id}/characters`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ characterName: 'LaLa' });

      expect(response.status).toBe(200);

      // Should still only have one LaLa
      const lalaCount = response.body.data.characters.filter(c => c === 'LaLa').length;
      expect(lalaCount).toBe(1);
    });

    it('should reject missing characterName', async () => {
      const response = await request(app)
        .post(`/api/v1/scenes/${testScene1.id}/characters`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/required/i);
    });
  });

  /**
   * DELETE /api/v1/scenes/:id/characters/:characterName - Remove Character
   */
  describe('DELETE /api/v1/scenes/:id/characters/:characterName', () => {
    beforeEach(async () => {
      testScene1 = await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Test Scene',
        characters: ['LaLa', 'Guest1'],
        createdBy: 'test-user',
      });
    });

    it('should remove a character from a scene', async () => {
      const response = await request(app)
        .delete(`/api/v1/scenes/${testScene1.id}/characters/LaLa`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.characters).not.toContain('LaLa');
      expect(response.body.data.characters).toContain('Guest1');
    });

    it('should return 404 for non-existent scene', async () => {
      const response = await request(app)
        .delete('/api/v1/scenes/00000000-0000-0000-0000-000000000000/characters/LaLa')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  /**
   * GET /api/v1/episodes/:episodeId/scenes/stats - Get Scene Stats
   */
  describe('GET /api/v1/episodes/:episodeId/scenes/stats', () => {
    beforeEach(async () => {
      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 1,
        title: 'Scene 1',
        sceneType: 'intro',
        productionStatus: 'draft',
        durationSeconds: 60,
        createdBy: 'test-user',
      });

      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 2,
        title: 'Scene 2',
        sceneType: 'main',
        productionStatus: 'complete',
        durationSeconds: 120,
        createdBy: 'test-user',
      });

      await Scene.create({
        episodeId: testEpisode.id,
        sceneNumber: 3,
        title: 'Scene 3',
        sceneType: 'main',
        productionStatus: 'draft',
        durationSeconds: 90,
        createdBy: 'test-user',
      });
    });

    it('should return scene statistics for episode', async () => {
      const response = await request(app)
        .get(`/api/v1/episodes/${testEpisode.id}/scenes/stats`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('totalDuration');

      expect(response.body.data.total).toBe(3);
      expect(response.body.data.totalDuration).toBe(270); // 60 + 120 + 90
      expect(response.body.data.byStatus.draft).toBe(2);
      expect(response.body.data.byStatus.complete).toBe(1);
      expect(response.body.data.byType.intro).toBe(1);
      expect(response.body.data.byType.main).toBe(2);
    });

    it('should return 404 for non-existent episode', async () => {
      const response = await request(app)
        .get('/api/v1/episodes/00000000-0000-0000-0000-000000000000/scenes/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
