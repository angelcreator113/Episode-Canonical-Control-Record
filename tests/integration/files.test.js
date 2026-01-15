const request = require('supertest');
const app = require('../../app');
const db = require('../../src/config/database');
const { v4: uuidv4 } = require('uuid');

describe('File Service Integration Tests', () => {
  let token;
  let episodeId;

  beforeAll(async () => {
    // Get auth token (using existing test user)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    if (loginRes.status === 200 && loginRes.body.data?.accessToken) {
      token = loginRes.body.data.accessToken;
    } else {
      throw new Error('Failed to get auth token');
    }

    // Create test episode
    episodeId = uuidv4();
    await db.query(
      'INSERT INTO episodes (id, title, status) VALUES ($1, $2, $3)',
      [episodeId, 'Test Episode', 'draft']
    );
  });

  afterAll(async () => {
    // Clean up files and episodes
    if (episodeId) {
      await db.query('DELETE FROM files WHERE episode_id = $1', [episodeId]);
      await db.query('DELETE FROM episodes WHERE id = $1', [episodeId]);
    }
  });

  describe('POST /api/v1/files/upload', () => {
    test('should upload file successfully', async () => {
      const fileBuffer = Buffer.from('test video content');
      
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fileBuffer, 'test.mp4');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.fileName).toBe('test.mp4');
      expect(res.body.data.status).toBe('uploaded');
    });

    test('should reject upload without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/files/upload')
        .attach('file', Buffer.from('test'), 'test.mp4');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should reject unsupported file types', async () => {
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('test'), 'test.exe');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_EXTENSION');
    });

    test('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(510 * 1024 * 1024); // 510MB
      
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', largeBuffer, 'large.mp4');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FILE_TOO_LARGE');
    });

    test('should associate file with episode if provided', async () => {
      const fileBuffer = Buffer.from('test video');
      
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('episodeId', episodeId)
        .attach('file', fileBuffer, 'episode.mp4');

      expect(res.status).toBe(201);
      expect(res.body.data.episodeId).toBe(episodeId);
    });

    test('should reject upload to non-existent episode', async () => {
      const fakeEpisodeId = uuidv4();
      
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('episodeId', fakeEpisodeId)
        .attach('file', Buffer.from('test'), 'test.mp4');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('EPISODE_NOT_FOUND');
    });

    test('should reject upload to episode user doesn\'t own', async () => {
      // Create another user
      const otherUserId = uuidv4();
      await db.query(
        'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
        [otherUserId, 'otheruser', 'other@example.com', 'hash']
      );

      // Create episode owned by other user
      const otherEpisodeId = uuidv4();
      await db.query(
        'INSERT INTO episodes (id, title, user_id, status) VALUES ($1, $2, $3, $4)',
        [otherEpisodeId, 'Other Episode', otherUserId, 'draft']
      );

      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('episodeId', otherEpisodeId)
        .attach('file', Buffer.from('test'), 'test.mp4');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');

      // Cleanup
      await db.query('DELETE FROM episodes WHERE id = $1', [otherEpisodeId]);
      await db.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('GET /api/v1/files/:id/download', () => {
    let fileId;

    beforeAll(async () => {
      // Upload a file for testing
      const fileBuffer = Buffer.from('test content');
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fileBuffer, 'download-test.mp4');
      
      fileId = res.body.data.id;
    });

    test('should generate download URL', async () => {
      const res = await request(app)
        .get(`/api/v1/files/${fileId}/download`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('downloadUrl');
      expect(res.body.data).toHaveProperty('expiresIn');
    });

    test('should return 404 for non-existent file', async () => {
      const fakeId = uuidv4();
      
      const res = await request(app)
        .get(`/api/v1/files/${fakeId}/download`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('FILE_NOT_FOUND');
    });

    test('should prevent download of other user\'s files', async () => {
      const otherUserId = uuidv4();
      await db.query(
        'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
        [otherUserId, 'downloader', 'downloader@example.com', 'hash']
      );

      const res = await request(app)
        .get(`/api/v1/files/${fileId}/download`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');

      await db.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('DELETE /api/v1/files/:id', () => {
    let fileId;

    beforeAll(async () => {
      const fileBuffer = Buffer.from('delete test');
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fileBuffer, 'delete-test.mp4');
      
      fileId = res.body.data.id;
    });

    test('should delete file successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify file is deleted
      const getRes = await request(app)
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });

    test('should return 404 for non-existent file', async () => {
      const fakeId = uuidv4();
      
      const res = await request(app)
        .delete(`/api/v1/files/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/files', () => {
    beforeAll(async () => {
      // Upload multiple test files
      for (let i = 0; i < 3; i++) {
        const fileBuffer = Buffer.from(`test content ${i}`);
        await request(app)
          .post('/api/v1/files/upload')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', fileBuffer, `list-test-${i}.mp4`);
      }
    });

    test('should list user\'s files', async () => {
      const res = await request(app)
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toHaveProperty('count');
    });

    test('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/files?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.limit).toBe(2);
    });

    test('should not expose other user\'s files', async () => {
      const otherUserId = uuidv4();
      await db.query(
        'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
        [otherUserId, 'otherlist', 'otherlist@example.com', 'hash']
      );

      const res = await request(app)
        .get('/api/v1/files')
        .set('Authorization', `Bearer ${token}`);

      const filesByOtherUser = res.body.data.filter(f => f.userId === otherUserId);
      expect(filesByOtherUser.length).toBe(0);

      await db.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('GET /api/v1/files/:id', () => {
    let fileId;

    beforeAll(async () => {
      const fileBuffer = Buffer.from('metadata test');
      const res = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fileBuffer, 'metadata-test.jpg');
      
      fileId = res.body.data.id;
    });

    test('should get file metadata', async () => {
      const res = await request(app)
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(fileId);
      expect(res.body.data).toHaveProperty('fileName');
      expect(res.body.data).toHaveProperty('fileSize');
      expect(res.body.data).toHaveProperty('createdAt');
    });

    test('should prevent access to other user\'s file metadata', async () => {
      const otherUserId = uuidv4();
      await db.query(
        'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
        [otherUserId, 'metauser', 'metauser@example.com', 'hash']
      );

      const res = await request(app)
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);

      await db.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });
});
