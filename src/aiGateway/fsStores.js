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

function writeFileAtomic(file, contents) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
  fsyncDir(dir);
}

function createFsEmergencyStore(dir) {
  const stateFile = path.join(dir, 'emergency.json');
  const logFile = path.join(dir, 'emergency.log');
  return {
    readState() {
      if (!fs.existsSync(stateFile)) return { exists: false };
      return { exists: true, data: JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
    },
    writeState(data) {
      writeFileAtomic(stateFile, JSON.stringify(data));
    },
    appendLog(entry) {
      const fd = fs.openSync(logFile, 'a', 0o600);
      try {
        fs.writeSync(fd, `${JSON.stringify(entry)}\n`);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
    readLog() {
      if (!fs.existsSync(logFile)) return [];
      return fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
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

module.exports = { createFsEmergencyStore, createFsSpoolStore, writeFileAtomic };
