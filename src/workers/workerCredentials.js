'use strict';

/**
 * Issue #3714 (Option B): the production episode worker's database login,
 * read from a dedicated file and never from the environment.
 *
 * The file (default /home/ubuntu/.episode-worker-db.env, path in
 * WORKER_DB_CREDENTIALS_FILE) holds two KEY=value lines:
 *
 *   WORKER_DB_USER=episode_worker
 *   WORKER_DB_PASSWORD=...
 *
 * It is accepted only when all of these hold, checked on the opened file
 * descriptor so the path cannot be swapped between the check and the read:
 *   - the path is not a symlink (lstat, then open with O_NOFOLLOW);
 *   - it is a regular file;
 *   - the descriptor is the same file the path named (same device and inode);
 *   - it is owned by the user the process runs as;
 *   - its permission bits are exactly 600;
 *   - it is no larger than 4 KiB;
 *   - both keys are present and the user is not a master login.
 *
 * Errors name the rule that failed, never the file's contents. The values are
 * parsed with dotenv.parse, which does not touch process.env.
 */

const fs = require('fs');
const dotenv = require('dotenv');

const DEFAULT_CREDENTIALS_FILE = '/home/ubuntu/.episode-worker-db.env';
const MAX_BYTES = 4096;
const MASTER_LOGINS = new Set(['postgres', 'rdsadmin']);

class CredentialFileError extends Error {}

function fail(message) {
  throw new CredentialFileError(message);
}

/**
 * @param {string} filePath
 * @param {object} [opts]
 * @param {number} [opts.uid]  the owner required (default: the process's uid)
 * @param {object} [opts.fs]   injectable fs (tests)
 * @returns {{ user: string, password: string }}
 */
function readCredentialFile(filePath, opts = {}) {
  const fsx = opts.fs || fs;
  const uid = opts.uid !== undefined ? opts.uid : (typeof process.getuid === 'function' ? process.getuid() : null);
  if (!filePath || typeof filePath !== 'string') fail('the credential file path is not set (WORKER_DB_CREDENTIALS_FILE)');
  if (uid === null) fail('the credential file cannot be checked on this platform (no process uid)');

  let linkStat;
  try {
    linkStat = fsx.lstatSync(filePath);
  } catch (err) {
    fail(`the credential file cannot be found or read (${err.code || 'error'})`);
  }
  if (linkStat.isSymbolicLink()) fail('the credential file is a symlink; it must be a regular file');
  if (!linkStat.isFile()) fail('the credential file is not a regular file');

  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0);
  let fd;
  try {
    fd = fsx.openSync(filePath, flags);
  } catch (err) {
    fail(`the credential file cannot be opened (${err.code || 'error'})`);
  }

  try {
    const st = fsx.fstatSync(fd);
    if (!st.isFile()) fail('the credential file is not a regular file');
    if (st.dev !== linkStat.dev || st.ino !== linkStat.ino) fail('the credential file changed while it was being opened');
    if (st.uid !== uid) fail('the credential file is not owned by the user the worker runs as');
    if ((st.mode & 0o777) !== 0o600) fail(`the credential file's permissions are ${(st.mode & 0o777).toString(8).padStart(3, '0')}; they must be exactly 600`);
    if (st.size > MAX_BYTES) fail(`the credential file is larger than ${MAX_BYTES} bytes`);

    const buf = Buffer.alloc(MAX_BYTES + 1);
    let total = 0;
    for (;;) {
      const n = fsx.readSync(fd, buf, total, buf.length - total, null);
      if (n === 0) break;
      total += n;
      if (total > MAX_BYTES) fail(`the credential file is larger than ${MAX_BYTES} bytes`);
    }
    const parsed = dotenv.parse(buf.subarray(0, total));
    buf.fill(0);

    const user = String(parsed.WORKER_DB_USER || '').trim();
    const password = parsed.WORKER_DB_PASSWORD || '';
    const missing = [!user && 'WORKER_DB_USER', !password && 'WORKER_DB_PASSWORD'].filter(Boolean);
    if (missing.length) fail(`the credential file is missing ${missing.join(' and ')}`);
    if (MASTER_LOGINS.has(user.toLowerCase())) fail('the credential file names a master login; the worker runs as its own least-privilege role');
    return { user, password };
  } finally {
    try { fsx.closeSync(fd); } catch (err) { console.error('[workerCredentials] close failed:', err.code || err.message); }
  }
}

module.exports = { readCredentialFile, CredentialFileError, DEFAULT_CREDENTIALS_FILE, MAX_BYTES, MASTER_LOGINS };
