'use strict';

/**
 * An upload middleware (multer) with its refusals answered as the person's
 * mistake: 413 for a file over the limit, 400 for a file that is not an
 * image or a malformed upload. Without it they reached Express's error
 * handler as 500s (audit, 2026-10-15: Scene Sets first; the event look and
 * dressed-angle uploads after).
 */
const uploadOrRefuse = (middleware, { maxLabel = '10 MB', label = 'Upload' } = {}) => (req, res, next) => middleware(req, res, (err) => {
  if (!err) return next();
  console.error(`${label} refused:`, err.code || '', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: `The image is larger than ${maxLabel}`, code: 'FILE_TOO_LARGE' });
  }
  return res.status(400).json({ success: false, error: err.message || 'The upload could not be read', code: 'BAD_FILE' });
});

module.exports = { uploadOrRefuse };
