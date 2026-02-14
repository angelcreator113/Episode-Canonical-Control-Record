'use strict';

const { pool } = require('../db');

/**
 * VersioningService
 * Handles composition versioning, history tracking, and version reversion
 */
class VersioningService {
  /**
   * Get complete version history for a composition
   * @param {string} compositionId - UUID of composition
   * @returns {Object} Version history with metadata
   */
  async getVersionHistory(compositionId) {
    const query = `
      SELECT 
        tc.id as composition_id,
        tc.name,
        tc.current_version,
        tc.status,
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'version_number', cv.version_number,
            'created_at', cv.created_at,
            'created_by', cv.created_by,
            'change_summary', cv.change_summary,
            'changed_fields', cv.changed_fields,
            'is_published', cv.is_published
          ) ORDER BY cv.version_number DESC
        ), '[]'::jsonb) as versions
      FROM thumbnail_compositions tc
      LEFT JOIN composition_versions cv ON tc.id = cv.composition_id
      WHERE tc.id = $1
      GROUP BY tc.id, tc.name, tc.current_version, tc.status
    `;

    const result = await pool.query(query, [compositionId]);

    if (result.rows.length === 0) {
      throw new Error(`Composition not found: ${compositionId}`);
    }

    return result.rows[0];
  }

  /**
   * Get specific version details
   * @param {string} compositionId - UUID of composition
   * @param {number} versionNumber - Version number to retrieve
   * @returns {Object} Specific version snapshot and metadata
   */
  async getSpecificVersion(compositionId, versionNumber) {
    const query = `
      SELECT 
        version_number,
        version_hash,
        change_summary,
        changed_fields,
        created_by,
        created_at,
        is_published,
        composition_snapshot
      FROM composition_versions
      WHERE composition_id = $1 AND version_number = $2
    `;

    const result = await pool.query(query, [compositionId, versionNumber]);

    if (result.rows.length === 0) {
      throw new Error(`Version ${versionNumber} not found for composition ${compositionId}`);
    }

    return result.rows[0];
  }

  /**
   * Compare two versions
   * @param {string} compositionId - UUID of composition
   * @param {number} versionA - First version to compare
   * @param {number} versionB - Second version to compare
   * @returns {Object} Detailed comparison
   */
  async compareVersions(compositionId, versionA, versionB) {
    const v1 = await this.getSpecificVersion(compositionId, versionA);
    const v2 = await this.getSpecificVersion(compositionId, versionB);

    const differences = {};
    const snapshot1 = v1.composition_snapshot;
    const snapshot2 = v2.composition_snapshot;

    // Compare key fields
    const fieldsToCompare = [
      'name',
      'template_id',
      'background_frame_asset_id',
      'lala_asset_id',
      'guest_asset_id',
      'justawomen_asset_id',
      'selected_formats',
      'status',
    ];

    fieldsToCompare.forEach((field) => {
      if (snapshot1[field] !== snapshot2[field]) {
        differences[field] = {
          version_a: snapshot1[field],
          version_b: snapshot2[field],
        };
      }
    });

    return {
      composition_id: compositionId,
      version_a: {
        number: versionA,
        created_at: v1.created_at,
        created_by: v1.created_by,
        snapshot: snapshot1,
      },
      version_b: {
        number: versionB,
        created_at: v2.created_at,
        created_by: v2.created_by,
        snapshot: snapshot2,
      },
      differences: Object.keys(differences).length > 0 ? differences : null,
      difference_count: Object.keys(differences).length,
    };
  }

  /**
   * Revert composition to a previous version
   * @param {string} compositionId - UUID of composition
   * @param {number} targetVersion - Version to revert to
   * @param {string} userId - User performing revert
   * @param {string} reason - Reason for reversion
   * @returns {Object} Updated composition
   */
  async revertToVersion(compositionId, targetVersion, userId, reason) {
    // Validate target version exists
    const targetVersionData = await this.getSpecificVersion(compositionId, targetVersion);

    // Get current composition
    const currentQuery = `
      SELECT current_version FROM thumbnail_compositions WHERE id = $1
    `;
    const currentResult = await pool.query(currentQuery, [compositionId]);

    if (currentResult.rows.length === 0) {
      throw new Error(`Composition not found: ${compositionId}`);
    }

    const currentVersion = currentResult.rows[0].current_version;
    const newVersion = currentVersion + 1;

    // Restore fields from target version snapshot
    const snapshot = targetVersionData.composition_snapshot;

    const updateQuery = `
      UPDATE thumbnail_compositions
      SET 
        name = $2,
        template_id = $3,
        background_frame_asset_id = $4,
        lala_asset_id = $5,
        guest_asset_id = $6,
        justawomen_asset_id = $7,
        selected_formats = $8,
        status = $9,
        current_version = $10,
        last_modified_by = $11,
        modification_timestamp = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      compositionId,
      snapshot.name,
      snapshot.template_id,
      snapshot.background_frame_asset_id,
      snapshot.lala_asset_id,
      snapshot.guest_asset_id,
      snapshot.justawomen_asset_id,
      snapshot.selected_formats,
      snapshot.status,
      newVersion,
      userId,
    ]);

    // Create version entry for the revert action
    const versionQuery = `
      INSERT INTO composition_versions (
        composition_id,
        version_number,
        version_hash,
        change_summary,
        changed_fields,
        created_by,
        is_published,
        composition_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const revertSummary = `Reverted to v${targetVersion}. Reason: ${reason || 'No reason provided'}`;

    await pool.query(versionQuery, [
      compositionId,
      newVersion,
      `revert-${Date.now()}`,
      revertSummary,
      { revert_from_version: targetVersion, reason: reason },
      userId,
      snapshot.status === 'published',
      snapshot,
    ]);

    return {
      status: 'SUCCESS',
      composition: updateResult.rows[0],
      revert_details: {
        from_version: currentVersion,
        to_version: targetVersion,
        new_version_number: newVersion,
        reverted_by: userId,
        reason: reason,
        reverted_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Get version statistics for a composition
   * @param {string} compositionId - UUID of composition
   * @returns {Object} Version statistics
   */
  async getVersionStats(compositionId) {
    const query = `
      SELECT 
        COUNT(*) as total_versions,
        MAX(created_at) as last_modified,
        COUNT(DISTINCT created_by) as unique_editors,
        COUNT(CASE WHEN is_published THEN 1 END) as published_versions,
        COUNT(CASE WHEN changed_fields != '{}' THEN 1 END) as modified_versions
      FROM composition_versions
      WHERE composition_id = $1
    `;

    const result = await pool.query(query, [compositionId]);
    return result.rows[0];
  }

  /**
   * Get all compositions modified since a specific date
   * @param {Date} sinceDate - Date to filter from
   * @returns {Array} List of compositions
   */
  async getModifiedSince(sinceDate) {
    const query = `
      SELECT DISTINCT
        tc.id,
        tc.name,
        tc.status,
        tc.current_version,
        MAX(cv.created_at) as last_modified,
        COUNT(cv.id) as total_versions
      FROM thumbnail_compositions tc
      LEFT JOIN composition_versions cv ON tc.id = cv.composition_id
      WHERE cv.created_at >= $1
      GROUP BY tc.id, tc.name, tc.status, tc.current_version
      ORDER BY MAX(cv.created_at) DESC
    `;

    const result = await pool.query(query, [sinceDate]);
    return result.rows;
  }

  /**
   * Cleanup old versions (retention policy)
   * @param {string} compositionId - UUID of composition
   * @param {number} retentionDays - Keep only versions from last N days
   * @returns {Object} Deletion stats
   */
  async cleanupOldVersions(compositionId, retentionDays = 90) {
    const deleteQuery = `
      DELETE FROM composition_versions
      WHERE composition_id = $1
        AND created_at < NOW() - INTERVAL '1 day' * $2
        AND is_published = FALSE
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [compositionId, retentionDays]);

    return {
      composition_id: compositionId,
      deleted_versions: result.rows.length,
      retention_days: retentionDays,
    };
  }
}

module.exports = new VersioningService();
