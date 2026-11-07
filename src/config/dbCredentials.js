'use strict';

/**
 * Issue #3714 (Option B): database credentials held in memory only.
 *
 * The production episode worker reads its login from a mode-600 file
 * (src/workers/workerCredentials.js) and hands it here, never to
 * process.env: anything in process.env is inherited by every child process
 * (FFmpeg through execFile and fluent-ffmpeg's spawn pass no env of their
 * own), and by whatever is started from the worker. config/sequelize.js reads
 * the production login from here first, then from DB_USER / DB_PASSWORD as
 * before (the API, the migrations and every other process set nothing here).
 */

let held = null;

function setDbCredentials({ user, password }) {
  if (!user || !password) throw new Error('setDbCredentials needs a user and a password');
  held = Object.freeze({ user: String(user), password: String(password) });
}

function getDbCredentials() {
  return held;
}

/** Tests only: forget what is held. */
function clearDbCredentials() {
  held = null;
}

module.exports = { setDbCredentials, getDbCredentials, clearDbCredentials };
