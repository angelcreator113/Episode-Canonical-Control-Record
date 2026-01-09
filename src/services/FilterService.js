'use strict';

const { pool } = require('../db');

/**
 * FilterService
 * Advanced composition filtering and search with support for multiple filter types
 * Supports: format, status, date range, asset usage, template, and text search
 */
class FilterService {
  /**
   * Build and execute advanced search query
   * @param {Object} filters - Filter criteria
   * @param {Array} filters.formats - Array of format names to filter by
   * @param {String} filters.status - Publication status (draft, published, archived)
   * @param {String} filters.dateFrom - Start date for creation filter (ISO format)
   * @param {String} filters.dateTo - End date for creation filter (ISO format)
   * @param {Array} filters.assets - Asset IDs that must be present in composition
   * @param {String} filters.template - Template ID to filter by
   * @param {String} filters.createdBy - User who created composition
   * @param {String} filters.search - Text search in name or description
   * @param {String} filters.sortBy - Sort field: created_at, updated_at, name
   * @param {String} filters.sortOrder - Sort order: ASC, DESC (default DESC)
   * @param {Number} filters.limit - Results per page (default 20, max 100)
   * @param {Number} filters.offset - Pagination offset (default 0)
   * @returns {Object} Filtered compositions with pagination metadata
   */
  async searchCompositions(filters = {}) {
    const {
      formats = [],
      status = null,
      dateFrom = null,
      dateTo = null,
      assets = [],
      template = null,
      createdBy = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      limit = 20,
      offset = 0,
      episodeId = null
    } = filters;

    // Validate inputs
    const validSortFields = ['created_at', 'updated_at', 'name', 'status'];
    const validStatuses = ['draft', 'published', 'archived'];
    const validSortOrders = ['ASC', 'DESC'];

    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    const pageLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const pageOffset = Math.max(0, parseInt(offset) || 0);

    // Build WHERE clause
    const whereClauses = ['1=1'];
    const params = [];
    let paramIndex = 1;

    // Episode filter
    if (episodeId) {
      whereClauses.push(`tc.episode_id = $${paramIndex}`);
      params.push(episodeId);
      paramIndex++;
    }

    // Format filter (check if any selected format is in selected_formats array)
    if (Array.isArray(formats) && formats.length > 0) {
      const formatConditions = formats.map(fmt => {
        paramIndex++;
        params.push(fmt);
        return `tc.selected_formats @> '["${fmt}"]'::jsonb`;
      }).join(' OR ');
      whereClauses.push(`(${formatConditions})`);
    }

    // Status filter
    if (status && validStatuses.includes(status.toLowerCase())) {
      whereClauses.push(`tc.status = $${paramIndex}`);
      params.push(status.toLowerCase());
      paramIndex++;
    }

    // Date range filter
    if (dateFrom) {
      whereClauses.push(`tc.created_at >= $${paramIndex}`);
      params.push(new Date(dateFrom));
      paramIndex++;
    }

    if (dateTo) {
      // Add one day to include all of the end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      whereClauses.push(`tc.created_at < $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    // Asset filter (composition must have ALL specified assets)
    if (Array.isArray(assets) && assets.length > 0) {
      assets.forEach((assetId, idx) => {
        const conditions = [
          `tc.background_frame_asset_id = $${paramIndex}`,
          `tc.lala_asset_id = $${paramIndex}`,
          `tc.guest_asset_id = $${paramIndex}`,
          `tc.justawomen_asset_id = $${paramIndex}`
        ];
        whereClauses.push(`(${conditions.join(' OR ')})`);
        params.push(assetId);
        paramIndex++;
      });
    }

    // Template filter
    if (template) {
      whereClauses.push(`tc.template_id = $${paramIndex}`);
      params.push(template);
      paramIndex++;
    }

    // Created by filter
    if (createdBy) {
      whereClauses.push(`tc.created_by = $${paramIndex}`);
      params.push(createdBy);
      paramIndex++;
    }

    // Text search in name and description
    if (search) {
      const searchTerm = `%${search}%`;
      whereClauses.push(`(tc.name ILIKE $${paramIndex} OR tc.description ILIKE $${paramIndex})`);
      params.push(searchTerm);
      params.push(searchTerm);
      paramIndex += 2;
    }

    const whereClause = whereClauses.join(' AND ');

    // Build main query
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM thumbnail_compositions tc
      WHERE ${whereClause}
    `;

    const dataQuery = `
      SELECT 
        tc.id,
        tc.name,
        tc.description,
        tc.episode_id,
        tc.template_id,
        tc.status,
        tc.selected_formats,
        tc.created_at,
        tc.updated_at,
        tc.created_by,
        tc.background_frame_asset_id,
        tc.lala_asset_id,
        tc.guest_asset_id,
        tc.justawomen_asset_id,
        tc.include_justawomaninherprime,
        (
          SELECT COUNT(*) FROM composition_versions 
          WHERE composition_id = tc.id
        ) as version_count,
        (
          SELECT MAX(created_at) FROM composition_versions 
          WHERE composition_id = tc.id
        ) as last_version_date
      FROM thumbnail_compositions tc
      WHERE ${whereClause}
      ORDER BY tc.${sortField} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    try {
      // Get total count
      const countResult = await pool.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total_count);

      // Get paginated results
      const dataParams = [...params, pageLimit, pageOffset];
      const dataResult = await pool.query(dataQuery, dataParams);

      return {
        status: 'SUCCESS',
        pagination: {
          total_count: totalCount,
          filtered_count: dataResult.rows.length,
          limit: pageLimit,
          offset: pageOffset,
          total_pages: Math.ceil(totalCount / pageLimit),
          current_page: Math.floor(pageOffset / pageLimit) + 1,
          has_more: (pageOffset + pageLimit) < totalCount
        },
        filters_applied: {
          formats: formats.length > 0 ? formats : null,
          status: status || null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
          assets: assets.length > 0 ? assets : null,
          template: template || null,
          created_by: createdBy || null,
          search: search || null
        },
        compositions: dataResult.rows
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get available filter options (for UI dropdown/select population)
   * @param {Number} episodeId - Optional: limit to specific episode
   * @returns {Object} Available filters
   */
  async getFilterOptions(episodeId = null) {
    try {
      const episodeFilter = episodeId ? `AND tc.episode_id = ${episodeId}` : '';

      // Get unique formats
      const formatsQuery = `
        SELECT DISTINCT jsonb_array_elements(tc.selected_formats)::text as format
        FROM thumbnail_compositions tc
        WHERE 1=1 ${episodeFilter}
        ORDER BY format
      `;

      // Get unique statuses
      const statusQuery = `
        SELECT DISTINCT status
        FROM thumbnail_compositions
        WHERE 1=1 ${episodeFilter}
        ORDER BY status
      `;

      // Get unique templates
      const templatesQuery = `
        SELECT DISTINCT template_id
        FROM thumbnail_compositions
        WHERE template_id IS NOT NULL AND 1=1 ${episodeFilter}
        ORDER BY template_id
      `;

      // Get unique creators
      const creatorsQuery = `
        SELECT DISTINCT created_by
        FROM thumbnail_compositions
        WHERE created_by IS NOT NULL AND 1=1 ${episodeFilter}
        ORDER BY created_by
      `;

      // Get date range
      const dateRangeQuery = `
        SELECT 
          MIN(created_at)::date as earliest_date,
          MAX(created_at)::date as latest_date
        FROM thumbnail_compositions
        WHERE 1=1 ${episodeFilter}
      `;

      const [formatsResult, statusResult, templatesResult, creatorsResult, dateRangeResult] = await Promise.all([
        pool.query(formatsQuery),
        pool.query(statusQuery),
        pool.query(templatesQuery),
        pool.query(creatorsQuery),
        pool.query(dateRangeQuery)
      ]);

      return {
        formats: formatsResult.rows.map(r => r.format).filter(Boolean),
        statuses: statusResult.rows.map(r => r.status),
        templates: templatesResult.rows.map(r => r.template_id),
        creators: creatorsResult.rows.map(r => r.created_by),
        date_range: dateRangeResult.rows[0] || { earliest_date: null, latest_date: null }
      };
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  }

  /**
   * Save a filter preset for reuse
   * @param {String} userId - User saving the preset
   * @param {String} name - Name for this preset
   * @param {Object} filters - Filter configuration
   * @returns {Object} Saved preset
   */
  async saveFilterPreset(userId, name, filters) {
    const query = `
      INSERT INTO search_filter_presets (user_id, name, filter_config, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, name, filter_config, created_at
    `;

    try {
      const result = await pool.query(query, [userId, name, JSON.stringify(filters)]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet, return a message
        return { error: 'Filter presets table not yet created', message: 'Run migration to enable filter presets' };
      }
      throw error;
    }
  }

  /**
   * Get user's saved filter presets
   * @param {String} userId - User ID
   * @returns {Array} User's saved presets
   */
  async getFilterPresets(userId) {
    const query = `
      SELECT id, name, filter_config, created_at, last_used
      FROM search_filter_presets
      WHERE user_id = $1
      ORDER BY last_used DESC, created_at DESC
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Delete a filter preset
   * @param {Number} presetId - Preset ID
   * @returns {Boolean} Success
   */
  async deleteFilterPreset(presetId) {
    const query = 'DELETE FROM search_filter_presets WHERE id = $1';
    
    try {
      await pool.query(query, [presetId]);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new FilterService();
