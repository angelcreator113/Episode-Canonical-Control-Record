'use strict';

/**
 * Filesystem implementations of the gateway's persistence interfaces. Only
 * this file touches the filesystem; G1 tests point it at a temporary
 * directory. Nothing in the application uses it.
 *
 *   createFsEmergencyStore(dir)  emergency.json (atomic write), emergency.log
 *   createFsSpoolStore(dir)      spooled upload bodies
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fsyncDir(dir) {
  const fd = fs.openSync(dir, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

const { O_RDONLY, O_WRONLY, O_CREAT, O_EXCL, O_APPEND, O_NOFOLLOW } = fs.constants;

function writeFileAtomic(file, contents) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
  try {
    fs.writeSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
  fsyncDir(dir);
}

/**
 * Ownership, mode and link checks for the emergency directory and its two
 * files (E5 layer 1). The directory must be a real directory owned by this
 * process's user with no group or other access (0700); each file that exists
 * must be a regular file, not a link, with one name, the same owner and no
 * group or other access (0600). Returns the problems found, by name only.
 */
function securityProblems(dir, files, uid = typeof process.getuid === 'function' ? process.getuid() : null) {
  if (uid === null) return ['this platform reports no file ownership'];
  const problems = [];
  let d;
  try {
    d = fs.lstatSync(dir);
  } catch (err) {
    return ['the state directory cannot be read'];
  }
  if (d.isSymbolicLink() || !d.isDirectory()) return ['the state directory is a link or not a directory'];
  if (d.uid !== uid) problems.push('the state directory has another owner');
  if ((d.mode & 0o077) !== 0) problems.push('the state directory is open to group or others');
  for (const file of files) {
    const name = path.basename(file);
    let st;
    try {
      st = fs.lstatSync(file);
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      problems.push(`${name} cannot be read`);
      continue;
    }
    if (st.isSymbolicLink()) { problems.push(`${name} is a symbolic link`); continue; }
    if (!st.isFile()) { problems.push(`${name} is not a regular file`); continue; }
    if (st.nlink !== 1) problems.push(`${name} has more than one name (hard link)`);
    if (st.uid !== uid) problems.push(`${name} has another owner`);
    if ((st.mode & 0o077) !== 0) problems.push(`${name} is open to group or others`);
  }
  return problems;
}

/** Read a file without following a link, checking what was actually opened. */
function readSecure(file, uid) {
  const fd = fs.openSync(file, O_RDONLY | O_NOFOLLOW);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.nlink !== 1 || (uid !== null && st.uid !== uid) || (st.mode & 0o077) !== 0) {
      throw new Error(`aiGateway: ${path.basename(file)} is not a private regular file`);
    }
    return fs.readFileSync(fd, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function createFsEmergencyStore(dir) {
  const stateFile = path.join(dir, 'emergency.json');
  const logFile = path.join(dir, 'emergency.log');
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const exists = (file) => {
    try { fs.lstatSync(file); return true; } catch (err) { if (err && err.code === 'ENOENT') return false; throw err; }
  };
  return {
    checkSecurity() {
      const problems = securityProblems(dir, [stateFile, logFile], uid);
      return { ok: problems.length === 0, problems };
    },
    readState() {
      if (!exists(stateFile)) return { exists: false };
      return { exists: true, data: JSON.parse(readSecure(stateFile, uid)) };
    },
    writeState(data) {
      writeFileAtomic(stateFile, JSON.stringify(data));
    },
    appendLog(entry) {
      const fd = fs.openSync(logFile, O_WRONLY | O_CREAT | O_APPEND | O_NOFOLLOW, 0o600);
      try {
        fs.writeSync(fd, `${JSON.stringify(entry)}\n`);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
    readLog() {
      if (!exists(logFile)) return [];
      return readSecure(logFile, uid).split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
  };
}

function createFsSpoolStore(dir) {
  return {
    create() {
      const id = crypto.randomBytes(12).toString('hex');
      const file = path.join(dir, `${id}.spool`);
      const fd = fs.openSync(file, 'wx', 0o600);
      return { id, file, fd };
    },
    append(handle, chunk) {
      fs.writeSync(handle.fd, chunk);
    },
    finish(handle) {
      fs.fsyncSync(handle.fd);
      fs.closeSync(handle.fd);
      handle.fd = null;
    },
    openRead(handle) {
      return fs.createReadStream(handle.file);
    },
    remove(handle) {
      if (handle.fd != null) {
        fs.closeSync(handle.fd);
        handle.fd = null;
      }
      fs.rmSync(handle.file, { force: true });
    },
    list() {
      return fs.readdirSync(dir).filter((f) => f.endsWith('.spool'));
    },
    removeAll() {
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.spool')) fs.rmSync(path.join(dir, f), { force: true });
    },
  };
}

module.exports = { createFsEmergencyStore, createFsSpoolStore, writeFileAtomic, securityProblems };
