'use strict';

/**
 * Self-test probe for the network guard (child process, under tripwire.js).
 * Usage: node -r ./tripwire.js ./probe.js <none|report|enforce>
 * Every "blocked" probe targets a destination that must never be reached
 * (example.invalid, 203.0.113.10 from the reserved TEST-NET-3 range, 0.0.0.0,
 * ::); the tripwire guarantees none of them leaves this process. Prints one
 * JSON line with the outcomes, the guard's records and the tripwire's.
 */

const net = require('net');
const http = require('http');
const https = require('https');
const tls = require('tls');
const dns = require('dns');
const os = require('os');
const path = require('path');
const fs = require('fs');

const mode = process.argv[2] || 'none';
let core = null;
if (mode !== 'none') {
  core = require('../core');
  core.install({ mode, allowHosts: new Set(), sink: null });
}

const code = (e) => (e && (e.code || (e.cause && e.cause.code))) || (e && e.message) || String(e);
const withTimeout = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r({ outcome: 'timeout' }), 3000))]);
const socketProbe = (make) => new Promise((resolve) => {
  const s = make();
  s.once('connect', () => { s.destroy(); resolve({ outcome: 'connected' }); });
  s.once('secureConnect', () => { s.destroy(); resolve({ outcome: 'connected' }); });
  s.once('error', (e) => resolve({ outcome: 'error', code: code(e) }));
});
const reqProbe = (make) => new Promise((resolve) => {
  const r = make((res) => { res.resume(); resolve({ outcome: 'response', status: res.statusCode }); });
  r.once('error', (e) => resolve({ outcome: 'error', code: code(e) }));
  r.end();
});
const cbProbe = (fn) => new Promise((resolve) => fn((e, v) => resolve(e ? { outcome: 'error', code: code(e) } : { outcome: 'resolved', value: v })));
const promiseProbe = (p) => p.then((v) => ({ outcome: 'resolved', value: v }), (e) => ({ outcome: 'error', code: code(e) }));

const BLOCKED = {
  'fetch https://example.invalid': () => promiseProbe(fetch('https://example.invalid/x')),
  'http.get example.invalid': () => reqProbe((cb) => http.get('http://example.invalid/x', cb)),
  'https.get 203.0.113.10': () => reqProbe((cb) => https.get('https://203.0.113.10/x', cb)),
  'https.request EXAMPLE.INVALID. (case, trailing dot)': () => reqProbe((cb) => https.request({ hostname: 'EXAMPLE.INVALID.', port: 443, path: '/' }, cb)),
  'tls.connect example.invalid': () => socketProbe(() => tls.connect({ host: 'example.invalid', port: 443 })),
  'net.connect object 203.0.113.10': () => socketProbe(() => net.connect({ host: '203.0.113.10', port: 5432 })),
  'net.connect(port, host) 203.0.113.10': () => socketProbe(() => net.connect(5432, '203.0.113.10')),
  'Socket#connect object ::ffff:203.0.113.10': () => socketProbe(() => new net.Socket().connect({ host: '::ffff:203.0.113.10', port: 80 })),
  'net.connect ::ffff:cb00:710a (hex-mapped 203.0.113.10)': () => socketProbe(() => net.connect({ host: '::ffff:cb00:710a', port: 80 })),
  'net.connect 0.0.0.0': () => socketProbe(() => net.connect({ host: '0.0.0.0', port: 9 })),
  'net.connect ::': () => socketProbe(() => net.connect({ host: '::', port: 9 })),
  'dns.lookup callback': () => cbProbe((cb) => dns.lookup('example.invalid', cb)),
  'dns.promises.lookup': () => promiseProbe(dns.promises.lookup('example.invalid')),
  'dns.resolve4 callback': () => cbProbe((cb) => dns.resolve4('example.invalid', cb)),
  'dns.promises.Resolver#resolve4': () => promiseProbe(new dns.promises.Resolver().resolve4('example.invalid')),
  'dns.reverse 203.0.113.10': () => cbProbe((cb) => dns.reverse('203.0.113.10', cb)),
};

async function allowedProbes() {
  const out = {};
  const server = http.createServer((q, s) => s.end('ok'));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  out['http.get 127.0.0.1'] = await withTimeout(reqProbe((cb) => http.get(`http://127.0.0.1:${port}/`, cb)));
  out['fetch 127.0.0.1'] = await withTimeout(fetch(`http://127.0.0.1:${port}/`).then((r) => ({ outcome: 'response', status: r.status }), (e) => ({ outcome: 'error', code: code(e) })));
  out['net.connect ::ffff:127.0.0.1'] = await withTimeout(socketProbe(() => net.connect({ host: '::ffff:127.0.0.1', port })));
  out['dns.lookup localhost'] = await withTimeout(cbProbe((cb) => dns.lookup('localhost', cb)));
  server.close();
  const v6 = http.createServer((q, s) => s.end('ok'));
  const v6ok = await new Promise((r) => { v6.once('error', () => r(false)); v6.listen(0, '::1', () => r(true)); });
  if (v6ok) { out['http.get [::1]'] = await withTimeout(reqProbe((cb) => http.get(`http://[::1]:${v6.address().port}/`, cb))); v6.close(); }
  const sock = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ng-')), 's.sock');
  const unix = net.createServer((c) => c.end());
  await new Promise((r) => unix.listen(sock, r));
  out['net.connect unix socket'] = await withTimeout(socketProbe(() => net.connect({ path: sock })));
  unix.close();
  return out;
}

(async () => {
  const blocked = {};
  for (const [name, run] of Object.entries(BLOCKED)) blocked[name] = await withTimeout(run());
  const tripwireAfterBlocked = globalThis.__tripwire.length;
  const allowed = await allowedProbes();
  const guardEvents = core ? core.getState().events.map((e) => ({ type: e.type, kind: e.kind, transport: e.transport, host: e.host, action: e.action })) : [];
  process.stdout.write(`${JSON.stringify({ mode, blocked, allowed, guardEvents, tripwire: globalThis.__tripwire, tripwireAfterBlocked })}\n`, () => process.exit(0));
})().catch((e) => { process.stdout.write(`${JSON.stringify({ fatal: e.message })}\n`); process.exitCode = 1; });
