const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class FileModel {
  static tableName = 'files';

  /**
   * Create a new file record
   */
  static async create(fileData) {
    const {
      episodeId,
      userId,
      fileName,
      fileType,
      fileSize,
      s3Key,
      s3Url,
      status = 'pending',
    } = fileData;

    const id = uuidv4();
    const createdAt = new Date();

    const query = `
      INSERT INTO ${this.tableName} 
      (id, episode_id, user_id, file_name, file_type, file_size, s3_key, s3_url, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      episodeId,
      userId,
      fileName,
      fileType,
      fileSize,
      s3Key,
      s3Url,
      status,
      createdAt,
      createdAt,
    ];

    try {
      const result = await db.query(query, values);
      logger.info('File record created', { id, fileName, userId });
      return this.formatFile(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create file record', { fileName, error: error.message });
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  static async getById(id) {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await db.query(query, [id]);
    return result.rows[0] ? this.formatFile(result.rows[0]) : null;
  }

  /**
   * Get files by user ID
   */
  static async getByUserId(userId, options = {}) {
    const { limit = 50, offset = 0, episodeId = null } = options;

    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    const values = [userId];

    if (episodeId) {
      query += ` AND episode_id = $${values.length + 1}`;
      values.push(episodeId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows.map(row => this.formatFile(row));
  }

  /**
   * Get files by episode ID
   */
  static async getByEpisodeId(episodeId) {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE episode_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [episodeId]);
    return result.rows.map(row => this.formatFile(row));
  }

  /**
   * Get file by S3 key
   */
  static async getByS3Key(s3Key) {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE s3_key = $1 AND deleted_at IS NULL
    `;

    const result = await db.query(query, [s3Key]);
    return result.rows[0] ? this.formatFile(result.rows[0]) : null;
  }

  /**
   * Update file record
   */
  static async update(id, updateData) {
    const allowedFields = ['status', 's3_url', 'file_size'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        updates.push(`${snakeKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] ? this.formatFile(result.rows[0]) : null;
  }

  /**
   * Delete file (soft delete)
   */
  static async delete(id) {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [new Date(), id]);
    return result.rows[0] ? this.formatFile(result.rows[0]) : null;
  }

  /**
   * Count files by user
   */
  static async countByUserId(userId) {
    const query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE user_id = $1 AND deleted_at IS NULL
    `;

    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get total file size for user
   */
  static async getTotalSizeByUserId(userId) {
    const query = `
      SELECT COALESCE(SUM(file_size), 0) as total_size FROM ${this.tableName}
      WHERE user_id = $1 AND deleted_at IS NULL AND status = 'uploaded'
    `;

    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].total_size, 10);
  }

  /**
   * Format database row to application object
   */
  static formatFile(row) {
    if (!row) return null;

    return {
      id: row.id,
      episodeId: row.episode_id,
      userId: row.user_id,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      s3Key: row.s3_key,
      s3Url: row.s3_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}

module.exports = FileModel;
