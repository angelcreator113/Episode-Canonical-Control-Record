'use strict';

/**
 * Raw-clip upload failures in plain words (Evoni, 2026-10-27: a saved take
 * failed with "ENOSPC: no space left on device, write"). Evoni never sees a
 * system code; the raw error is logged by the caller. friendlyError(err)
 * answers { status, message } for the response.
 *
 *   ENOSPC / EDQUOT (the server's disk is full)      507
 *   S3 refused or could not be reached               502 / 503
 *   an upload the server no longer knows (expired)   404
 *   anything else without its own status             500
 *
 * An error that already carries a status (RawClipError and the like) keeps
 * its own message: those are written in plain words where they are thrown.
 */

const NO_ROOM = 'The server ran out of room while saving this take. Your take is still safe on this phone — tap Retry later.';
const STORAGE_REFUSED = 'The video storage did not accept the take. Your take is still safe on this phone — tap Retry later.';
const STORAGE_UNREACHABLE = 'The server could not reach the video storage just now. Your take is still safe on this phone — tap Retry in a minute.';
const UPLOAD_GONE = 'This upload was too old to finish, so it will start again. Tap Retry.';
const SOMETHING_WRONG = 'Something went wrong on the server while saving. Your take is still safe on this phone — tap Retry.';

const DISK_CODES = new Set(['ENOSPC', 'EDQUOT']);
const NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH', 'ESOCKETTIMEDOUT']);
const NETWORK_NAMES = new Set(['TimeoutError', 'RequestTimeout', 'RequestTimeoutException', 'NetworkingError']);
const UPLOAD_GONE_NAMES = new Set(['NoSuchUpload']);

/** Whether the error is the disk being full (by code, or by its message). */
const isDiskFull = (err) => !!err && (DISK_CODES.has(err.code) || /\b(ENOSPC|EDQUOT)\b/.test(String(err.message || '')));

/** Whether it came from the S3 client (it carries $metadata, or an S3 fault). */
const isS3Error = (err) => !!err && (typeof err.$metadata === 'object' || err.$fault === 'client' || err.$fault === 'server');

/** { status, message } for the response; the caller logs the raw error. */
function friendlyError(err) {
  if (!err) return { status: 500, message: SOMETHING_WRONG };
  if (isDiskFull(err)) return { status: 507, message: NO_ROOM };
  if (err.status && Number.isInteger(err.status)) return { status: err.status, message: err.message };
  if (UPLOAD_GONE_NAMES.has(err.name) || UPLOAD_GONE_NAMES.has(err.Code)) return { status: 404, message: UPLOAD_GONE };
  if (NETWORK_CODES.has(err.code) || NETWORK_NAMES.has(err.name)) return { status: 503, message: STORAGE_UNREACHABLE };
  if (isS3Error(err)) {
    const http = Number(err.$metadata?.httpStatusCode);
    return { status: http >= 500 || err.$fault === 'server' ? 503 : 502, message: http >= 500 ? STORAGE_UNREACHABLE : STORAGE_REFUSED };
  }
  return { status: 500, message: SOMETHING_WRONG };
}

module.exports = {
  NO_ROOM, STORAGE_REFUSED, STORAGE_UNREACHABLE, UPLOAD_GONE, SOMETHING_WRONG,
  isDiskFull, isS3Error, friendlyError,
};
