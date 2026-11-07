/**
 * Test helper (issue #3714, Option B): preloaded with `node -r` into an
 * ENABLED episode worker started by
 * tests/integration/workerRestrictedRole.integration.test.js, against the
 * isolated local test database only.
 *
 *   - Network: every socket to a host other than loopback (and the test
 *     database host named in PROBE_ALLOW_HOST) is refused before it opens,
 *     so no image provider, AI SDK, S3 or other external service can be
 *     reached; Redis is pointed at 127.0.0.1:1, where nothing listens.
 *   - Children: every child process the worker starts is recorded (its
 *     argv[0] and environment), whatever started it, by wrapping
 *     ChildProcess.prototype.spawn, which spawn, execFile, exec and fork all
 *     go through.
 *   - After PROBE_AFTER_MS, once the worker has connected, it starts FFmpeg
 *     the two ways the worker does: execFile('ffmpeg', args, { timeout }) as
 *     sceneGenerationService.extractFirstFrame calls it, and the real
 *     fluent-ffmpeg library as videoRenderer uses it. PATH puts a fake
 *     `ffmpeg` first, which writes the environment it actually received to
 *     PROBE_DIR and exits. Then it writes the worker's own process.env and
 *     the recorded children to PROBE_DIR.
 *
 * It never prints an environment: everything goes to mode-600 files in
 * PROBE_DIR, which the test reads as booleans and deletes.
 */
'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const cp = require('child_process');

const DIR = process.env.PROBE_DIR;
const ALLOW = new Set(['127.0.0.1', '::1', 'localhost', process.env.PROBE_ALLOW_HOST].filter(Boolean));
const write = (name, data) => fs.writeFileSync(path.join(DIR, name), JSON.stringify(data), { mode: 0o600 });

// 1. No external network.
const blocked = [];
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function probeConnect(...args) {
  const opts = typeof args[0] === 'object' && args[0] !== null ? (Array.isArray(args[0]) ? args[0][0] : args[0]) : { port: args[0], host: args[1] };
  const host = opts && (opts.host || opts.hostname);
  if (opts && !opts.path && host && !ALLOW.has(String(host))) {
    blocked.push(String(host));
    process.nextTick(() => this.destroy(new Error(`probe: outbound connection to ${host} refused`)));
    return this;
  }
  return originalConnect.apply(this, args);
};

// 2. Record every child process's environment.
const children = [];
const originalSpawn = cp.ChildProcess.prototype.spawn;
cp.ChildProcess.prototype.spawn = function probeSpawn(options) {
  children.push({ file: options && options.file, envPairs: (options && options.envPairs) || null });
  return originalSpawn.apply(this, arguments);
};

// 3. Start FFmpeg the worker's two ways, then write what was seen.
setTimeout(async () => {
  try {
    await new Promise((resolve) => {
      cp.execFile('ffmpeg', ['-y', '-sseof', '-0.5', '-i', '/dev/null', '-vframes', '1', path.join(DIR, 'frame.jpg')], { timeout: 30000 }, () => resolve());
    });
    await new Promise((resolve) => {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg().input('/dev/null').outputOptions(['-f', 'null']).on('end', resolve).on('error', resolve).save(path.join(DIR, 'out.null'));
    });
    write('worker-env.json', { ...process.env });
    write('children.json', children);
    write('blocked.json', blocked);
  } catch (err) {
    write('probe-error.json', { message: err.message });
  }
}, Number(process.env.PROBE_AFTER_MS || 2500)).unref();
