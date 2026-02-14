/**
 * Search Logger Middleware
 * Logs search queries for analytics
 */
const logger = require('../utils/logger');

/**
 * Log search queries and results
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware function
 */
const searchLogger = (req, res, next) => {
  // Intercept response
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Log search query
    if (data && data.query !== undefined) {
      const logData = {
        query: data.query,
        totalHits: data.total,
        resultsReturned: data.hits?.length || 0,
        userId: req.user?.id || 'anonymous',
        timestamp: new Date().toISOString(),
        queryTime: req.queryTime || 0,
      };

      if (data.total === 0) {
        logger.info('Search with zero results', logData);
      } else if (data.total > 1000) {
        logger.info('Popular search query', logData);
      } else {
        logger.debug('Search executed', logData);
      }
    }

    return originalJson(data);
  };

  next();
};

module.exports = searchLogger;
