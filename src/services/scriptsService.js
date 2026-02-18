/**
 * Scripts Service
 * Business logic for episode scripts management
 */

const { Pool } = require('pg');
const Logger = require('./Logger');

class ScriptsService {
  constructor() {
    // Use SSL for RDS connections (production and staging)
    const useSSL =
      process.env.DB_SSL === 'true' ||
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging';

    const sslConfig = useSSL ? { rejectUnauthorized: false } : false;

    // Support both DATABASE_URL and individual DB_* env vars
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
      });
    } else {
      this.pool = new Pool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'episode_metadata',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: sslConfig,
      });
    }
  }

  /**
   * Get all scripts for an episode (latest versions only by default)
   */
  async getScriptsByEpisode(episodeId, options = {}) {
    const { includeAllVersions = false, includeContent = false, scriptType = null } = options;

    try {
      const fields = includeContent
        ? '*'
        : `id, episode_id, script_type, version_number, version_label,
           author, status, duration, scene_count,
           file_format, file_url, file_size,
           is_primary, is_latest, scene_markers,
           created_by, created_at, updated_at`;

      let query = `
        SELECT ${fields}
        FROM episode_scripts
        WHERE episode_id = $1 AND deleted_at IS NULL
      `;

      const params = [episodeId];

      if (!includeAllVersions) {
        query += ` AND is_latest = TRUE`;
      }

      if (scriptType) {
        query += ` AND script_type = $${params.length + 1}`;
        params.push(scriptType);
      }

      query += ` ORDER BY script_type, version_number DESC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      Logger.error('Error fetching scripts by episode:', error);
      throw error;
    }
  }

  /**
   * Get a single script by ID
   */
  async getScriptById(scriptId, includeContent = false) {
    try {
      const fields = includeContent
        ? '*'
        : `id, episode_id, script_type, version_number, version_label,
           author, status, duration, scene_count,
           file_format, file_url, file_size,
           is_primary, is_latest, scene_markers,
           created_by, created_at, updated_at`;

      const result = await this.pool.query(
        `SELECT ${fields} FROM episode_scripts WHERE id = $1 AND deleted_at IS NULL`,
        [scriptId]
      );

      if (result.rows.length === 0) {
        throw new Error('Script not found');
      }

      return result.rows[0];
    } catch (error) {
      Logger.error('Error fetching script by ID:', error);
      throw error;
    }
  }

  /**
   * Get all versions of a script (by episode and script type)
   */
  async getScriptVersions(episodeId, scriptType) {
    try {
      const result = await this.pool.query(
        `SELECT 
          id, version_number, version_label, author, status,
          duration, scene_count, is_primary, is_latest,
          created_by, created_at, updated_at
        FROM episode_scripts
        WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL
        ORDER BY version_number DESC`,
        [episodeId, scriptType]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error fetching script versions:', error);
      throw error;
    }
  }

  /**
   * Create a new script
   */
  async createScript(scriptData, userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const {
        episodeId,
        scriptType,
        versionLabel,
        author,
        status = 'draft',
        duration,
        sceneCount,
        content,
        fileFormat,
        fileUrl,
        fileSize,
        isPrimary = false,
        sceneMarkers = [],
      } = scriptData;

      // Get next version number
      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
         FROM episode_scripts
         WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL`,
        [episodeId, scriptType]
      );
      const versionNumber = versionResult.rows[0].next_version;

      // Mark all other versions as not latest
      await client.query(
        `UPDATE episode_scripts
         SET is_latest = FALSE
         WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL`,
        [episodeId, scriptType]
      );

      // If setting as primary, unmark other primaries
      if (isPrimary) {
        await client.query(
          `UPDATE episode_scripts
           SET is_primary = FALSE
           WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL`,
          [episodeId, scriptType]
        );
      }

      // Insert new script
      const insertResult = await client.query(
        `INSERT INTO episode_scripts (
          episode_id, script_type, version_number, version_label,
          author, status, duration, scene_count,
          content, file_format, file_url, file_size,
          is_primary, is_latest, scene_markers, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14, $15)
        RETURNING *`,
        [
          episodeId,
          scriptType,
          versionNumber,
          versionLabel,
          author,
          status,
          duration,
          sceneCount,
          content,
          fileFormat,
          fileUrl,
          fileSize,
          isPrimary,
          JSON.stringify(sceneMarkers),
          userId,
        ]
      );

      // Log creation in audit trail
      await this.logEdit(client, insertResult.rows[0].id, userId, 'create', {
        after: scriptData,
      });

      await client.query('COMMIT');

      return insertResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error creating script:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing script
   */
  async updateScript(scriptId, updates, userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current script data
      const currentResult = await client.query(
        `SELECT * FROM episode_scripts WHERE id = $1 AND deleted_at IS NULL`,
        [scriptId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Script not found');
      }

      const currentScript = currentResult.rows[0];

      // Build update query dynamically
      const allowedFields = [
        'version_label',
        'author',
        'status',
        'duration',
        'scene_count',
        'content',
        'scene_markers',
      ];

      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = $${paramCount}`);
          updateValues.push(key === 'scene_markers' ? JSON.stringify(updates[key]) : updates[key]);
          paramCount++;
        }
      });

      if (updateFields.length === 0) {
        return currentScript;
      }

      updateValues.push(scriptId);

      const updateResult = await client.query(
        `UPDATE episode_scripts
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        updateValues
      );

      // Log update in audit trail
      await this.logEdit(client, scriptId, userId, 'update', {
        before: currentScript,
        after: updates,
      });

      await client.query('COMMIT');

      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error updating script:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Set a script version as primary
   */
  async setPrimary(scriptId, userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get script info
      const scriptResult = await client.query(
        `SELECT episode_id, script_type FROM episode_scripts WHERE id = $1 AND deleted_at IS NULL`,
        [scriptId]
      );

      if (scriptResult.rows.length === 0) {
        throw new Error('Script not found');
      }

      const { episode_id, script_type } = scriptResult.rows[0];

      // Unmark all other primaries for this type
      await client.query(
        `UPDATE episode_scripts
         SET is_primary = FALSE
         WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL`,
        [episode_id, script_type]
      );

      // Mark this one as primary
      const updateResult = await client.query(
        `UPDATE episode_scripts
         SET is_primary = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [scriptId]
      );

      // Log action
      await this.logEdit(client, scriptId, userId, 'set_primary', {
        after: { is_primary: true },
      });

      await client.query('COMMIT');

      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error setting primary script:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Restore an old version as the latest
   */
  async restoreVersion(scriptId, userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get the script to restore
      const scriptResult = await client.query(
        `SELECT * FROM episode_scripts WHERE id = $1 AND deleted_at IS NULL`,
        [scriptId]
      );

      if (scriptResult.rows.length === 0) {
        throw new Error('Script not found');
      }

      const oldScript = scriptResult.rows[0];

      // Get next version number
      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
         FROM episode_scripts
         WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL`,
        [oldScript.episode_id, oldScript.script_type]
      );
      const newVersionNumber = versionResult.rows[0].next_version;

      // Mark all versions as not latest
      await client.query(
        `UPDATE episode_scripts
         SET is_latest = FALSE
         WHERE episode_id = $1 AND script_type = $2 AND deleted_at IS NULL`,
        [oldScript.episode_id, oldScript.script_type]
      );

      // Create new version from old one
      const newScript = await client.query(
        `INSERT INTO episode_scripts (
          episode_id, script_type, version_number, version_label,
          author, status, duration, scene_count,
          content, file_format, file_url, file_size,
          is_primary, is_latest, scene_markers, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14, $15)
        RETURNING *`,
        [
          oldScript.episode_id,
          oldScript.script_type,
          newVersionNumber,
          `Restored from v${oldScript.version_number}`,
          oldScript.author,
          oldScript.status,
          oldScript.duration,
          oldScript.scene_count,
          oldScript.content,
          oldScript.file_format,
          oldScript.file_url,
          oldScript.file_size,
          oldScript.is_primary,
          oldScript.scene_markers,
          userId,
        ]
      );

      // Log restore action
      await this.logEdit(client, newScript.rows[0].id, userId, 'restore', {
        restoredFrom: scriptId,
        restoredFromVersion: oldScript.version_number,
      });

      await client.query('COMMIT');

      return newScript.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error restoring script version:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Soft delete a script
   */
  async deleteScript(scriptId, userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE episode_scripts
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [scriptId]
      );

      if (result.rows.length === 0) {
        throw new Error('Script not found');
      }

      // Log deletion
      await this.logEdit(client, scriptId, userId, 'delete', {
        before: result.rows[0],
      });

      await client.query('COMMIT');

      return { success: true, message: 'Script deleted successfully' };
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error deleting script:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk delete scripts
   */
  async bulkDelete(scriptIds, userId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE episode_scripts
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1) AND deleted_at IS NULL
         RETURNING id`,
        [scriptIds]
      );

      // Log each deletion
      for (const row of result.rows) {
        await this.logEdit(client, row.id, userId, 'delete', {
          bulkOperation: true,
        });
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: `${result.rows.length} scripts deleted successfully`,
        deletedCount: result.rows.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error bulk deleting scripts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search/filter scripts (for library page)
   */
  async searchScripts(filters) {
    try {
      const { showId, episodeId, scriptType, status, author, dateFrom, dateTo, searchText } =
        filters;

      let query = `
        SELECT 
          s.id, s.episode_id, s.script_type, s.version_number, s.version_label,
          s.author, s.status, s.duration, s.scene_count,
          s.file_format, s.file_size, s.is_primary, s.is_latest,
          s.created_at, s.updated_at,
          e.title as episode_title, e.episode_number
        FROM episode_scripts s
        JOIN episodes e ON s.episode_id = e.id
        WHERE s.deleted_at IS NULL AND s.is_latest = TRUE
      `;

      const params = [];
      let paramCount = 1;

      if (showId) {
        query += ` AND e.show_id = $${paramCount}`;
        params.push(showId);
        paramCount++;
      }

      if (episodeId) {
        query += ` AND s.episode_id = $${paramCount}`;
        params.push(episodeId);
        paramCount++;
      }

      if (scriptType) {
        query += ` AND s.script_type = $${paramCount}`;
        params.push(scriptType);
        paramCount++;
      }

      if (status) {
        query += ` AND s.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (author) {
        query += ` AND s.author ILIKE $${paramCount}`;
        params.push(`%${author}%`);
        paramCount++;
      }

      if (dateFrom) {
        query += ` AND s.created_at >= $${paramCount}`;
        params.push(dateFrom);
        paramCount++;
      }

      if (dateTo) {
        query += ` AND s.created_at <= $${paramCount}`;
        params.push(dateTo);
        paramCount++;
      }

      if (searchText) {
        query += ` AND (s.version_label ILIKE $${paramCount} OR e.title ILIKE $${paramCount})`;
        params.push(`%${searchText}%`);
        paramCount++;
      }

      query += ` ORDER BY s.created_at DESC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      Logger.error('Error searching scripts:', error);
      throw error;
    }
  }

  /**
   * Get edit history for a script
   */
  async getEditHistory(scriptId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM script_edits
         WHERE script_id = $1
         ORDER BY created_at DESC`,
        [scriptId]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error fetching edit history:', error);
      throw error;
    }
  }

  /**
   * Log an edit to the audit trail
   */
  async logEdit(client, scriptId, userId, editType, changes) {
    try {
      await client.query(
        `INSERT INTO script_edits (script_id, user_id, edit_type, changes)
         VALUES ($1, $2, $3, $4)`,
        [scriptId, userId, editType, JSON.stringify(changes)]
      );
    } catch (error) {
      Logger.error('Error logging edit:', error);
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * Parse script and auto-create scenes
   */
  async parseScriptAndCreateScenes(scriptId) {
    const { parseScriptScenes, estimateSceneDuration, extractSceneContent } = require('../utils/scriptParser');
    
    try {
      // Get script
      const scriptResult = await this.pool.query(
        'SELECT id, episode_id, content FROM episode_scripts WHERE id = $1 AND deleted_at IS NULL',
        [scriptId]
      );

      if (scriptResult.rows.length === 0) {
        throw new Error('Script not found');
      }

      const script = scriptResult.rows[0];

      // Parse scenes
      const parsedScenes = parseScriptScenes(script.content);

      if (parsedScenes.length === 0) {
        return {
          script_id: scriptId,
          scenes_detected: 0,
          scenes_created: [],
          message: 'No scenes detected in script. Use format: SCENE 1: Title or INT. LOCATION - DAY'
        };
      }

      // Create scene records
      const createdScenes = [];
      for (const parsedScene of parsedScenes) {
        const sceneContent = extractSceneContent(script.content, parsedScene.scene_number);
        const duration = estimateSceneDuration(sceneContent);

        const result = await this.pool.query(
          `INSERT INTO scenes (episode_id, name, description, scene_number, duration_seconds, type, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id, episode_id, name, description, scene_number, duration_seconds, type`,
          [script.episode_id, parsedScene.name, `Auto-generated from script (Line ${parsedScene.line_number})`, parsedScene.scene_number, duration, 'main']
        );

        createdScenes.push(result.rows[0]);
      }

      Logger.info(`Created ${createdScenes.length} scenes from script ${scriptId}`);

      return {
        script_id: scriptId,
        scenes_detected: parsedScenes.length,
        scenes_created: createdScenes,
        patterns_matched: parsedScenes.map(s => s.raw_line)
      };

    } catch (error) {
      Logger.error('Error parsing script scenes:', error);
      throw error;
    }
  }
}

module.exports = new ScriptsService();
