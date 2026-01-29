/**
 * Scripts Controller
 * HTTP handlers for episode scripts API endpoints
 */

const scriptsService = require('../services/scriptsService');
const { ValidationError, asyncHandler } = require('../middleware/errorHandler');
const Logger = require('../services/Logger');

module.exports = {
  /**
   * GET /api/v1/episodes/:episodeId/scripts
   * Get all scripts for an episode
   */
  getScriptsByEpisode: asyncHandler(async (req, res) => {
    const { episodeId } = req.params;
    const { includeAllVersions, includeContent, scriptType } = req.query;

    const scripts = await scriptsService.getScriptsByEpisode(episodeId, {
      includeAllVersions: includeAllVersions === 'true',
      includeContent: includeContent === 'true',
      scriptType,
    });

    res.json({
      success: true,
      data: scripts,
      count: scripts.length,
    });
  }),

  /**
   * GET /api/v1/scripts/:scriptId
   * Get a single script by ID
   */
  getScriptById: asyncHandler(async (req, res) => {
    const { scriptId } = req.params;
    const { includeContent } = req.query;

    const script = await scriptsService.getScriptById(scriptId, includeContent === 'true');

    res.json({
      success: true,
      data: script,
    });
  }),

  /**
   * GET /api/v1/episodes/:episodeId/scripts/:scriptType/versions
   * Get all versions of a script type
   */
  getScriptVersions: asyncHandler(async (req, res) => {
    const { episodeId, scriptType } = req.params;

    const versions = await scriptsService.getScriptVersions(episodeId, scriptType);

    res.json({
      success: true,
      data: versions,
      count: versions.length,
    });
  }),

  /**
   * POST /api/v1/episodes/:episodeId/scripts
   * Create a new script
   */
  createScript: asyncHandler(async (req, res) => {
    const { episodeId } = req.params;
    const userId = req.user?.username || req.user?.id || 'system';

    // Validate required fields
    const { scriptType, content, fileUrl } = req.body;

    if (!scriptType) {
      throw new ValidationError('Script type is required');
    }

    if (!content && !fileUrl) {
      throw new ValidationError('Either content or file URL is required');
    }

    const validScriptTypes = [
      'trailer',
      'main',
      'shorts',
      'teaser',
      'behind-the-scenes',
      'bonus-content',
    ];

    if (!validScriptTypes.includes(scriptType)) {
      throw new ValidationError(
        `Invalid script type. Must be one of: ${validScriptTypes.join(', ')}`
      );
    }

    const scriptData = {
      episodeId,
      ...req.body,
    };

    const newScript = await scriptsService.createScript(scriptData, userId);

    Logger.info('Script created', {
      scriptId: newScript.id,
      episodeId,
      scriptType,
      userId,
    });

    res.status(201).json({
      success: true,
      data: newScript,
      message: 'Script created successfully',
    });
  }),

  /**
   * PATCH /api/v1/scripts/:scriptId
   * Update an existing script
   */
  updateScript: asyncHandler(async (req, res) => {
    const { scriptId } = req.params;
    const userId = req.user?.username || req.user?.id || 'system';

    const updatedScript = await scriptsService.updateScript(scriptId, req.body, userId);

    Logger.info('Script updated', {
      scriptId,
      userId,
      updates: Object.keys(req.body),
    });

    res.json({
      success: true,
      data: updatedScript,
      message: 'Script updated successfully',
    });
  }),

  /**
   * POST /api/v1/scripts/:scriptId/set-primary
   * Set a script version as primary
   */
  setPrimary: asyncHandler(async (req, res) => {
    const { scriptId } = req.params;
    const userId = req.user?.username || req.user?.id || 'system';

    const updatedScript = await scriptsService.setPrimary(scriptId, userId);

    Logger.info('Script set as primary', {
      scriptId,
      userId,
    });

    res.json({
      success: true,
      data: updatedScript,
      message: 'Script set as primary successfully',
    });
  }),

  /**
   * POST /api/v1/scripts/:scriptId/restore
   * Restore an old version as the latest
   */
  restoreVersion: asyncHandler(async (req, res) => {
    const { scriptId } = req.params;
    const userId = req.user?.username || req.user?.id || 'system';

    const restoredScript = await scriptsService.restoreVersion(scriptId, userId);

    Logger.info('Script version restored', {
      originalScriptId: scriptId,
      newScriptId: restoredScript.id,
      userId,
    });

    res.json({
      success: true,
      data: restoredScript,
      message: 'Script version restored successfully',
    });
  }),

  /**
   * DELETE /api/v1/scripts/:scriptId
   * Soft delete a script
   */
  deleteScript: asyncHandler(async (req, res) => {
    const { scriptId } = req.params;
    const userId = req.user?.username || req.user?.id || 'system';

    const result = await scriptsService.deleteScript(scriptId, userId);

    Logger.info('Script deleted', {
      scriptId,
      userId,
    });

    res.json(result);
  }),

  /**
   * POST /api/v1/scripts/bulk-delete
   * Bulk delete multiple scripts
   */
  bulkDelete: asyncHandler(async (req, res) => {
    const { scriptIds } = req.body;
    const userId = req.user?.username || req.user?.id || 'system';

    if (!Array.isArray(scriptIds) || scriptIds.length === 0) {
      throw new ValidationError('scriptIds must be a non-empty array');
    }

    const result = await scriptsService.bulkDelete(scriptIds, userId);

    Logger.info('Scripts bulk deleted', {
      count: result.deletedCount,
      userId,
    });

    res.json(result);
  }),

  /**
   * GET /api/v1/scripts/search
   * Search/filter scripts (for library page)
   */
  searchScripts: asyncHandler(async (req, res) => {
    const filters = {
      showId: req.query.showId,
      episodeId: req.query.episodeId,
      scriptType: req.query.scriptType,
      status: req.query.status,
      author: req.query.author,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      searchText: req.query.search,
    };

    const scripts = await scriptsService.searchScripts(filters);

    res.json({
      success: true,
      data: scripts,
      count: scripts.length,
    });
  }),

  /**
   * GET /api/v1/scripts/:scriptId/history
   * Get edit history for a script
   */
  getEditHistory: asyncHandler(async (req, res) => {
    const { scriptId } = req.params;

    const history = await scriptsService.getEditHistory(scriptId);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  }),
};
