'use strict';

/**
 * Independent blocking tripwire for the network guard's self-tests (loaded
 * with `node -r` in a child process, BEFORE the guard). It shares no code
 * with the guard. It blocks every socket connect and DNS call except plain
 * loopback and Unix sockets, and records what it blocked in
 * globalThis.__tripwire. Under it, a guard in report mode (which lets calls
 * through) still cannot send a packet or a DNS query.
 *
 * Stage 3a: it also refuses loopback connections to the port of any proxy
 * named in the environment when it loads (HTTP_PROXY, https_proxy, ALL_PROXY
 * and the like), read before Jest removes them, so a request routed through
 * a local proxy cannot leave either. It never prints a proxy's value.
 */

const net = require('net');
const dns = require('dns');

const seen = [];
globalThis.__tripwire = seen;
const LOOPBACK = (h) => h === undefined || h === null || h === 'localhost' || h === '::1' || h === '[::1]'
  || /^127\./.test(h) || /^::ffff:127\./i.test(h);
const err = (h) => Object.assign(new Error(`tripwire blocked ${h}`), { code: 'ERR_TRIPWIRE_BLOCKED' });

// Ports of loopback proxies named in the environment (the value itself is never recorded).
const PROXY_PORTS = new Set();
for (const [k, v] of Object.entries(process.env)) {
  if (!/(^|_)(https?|all|socks5?)_?proxy$/i.test(k) || !v) continue;
  try {
    const u = new URL(v.includes('://') ? v : `http://${v}`);
    if (LOOPBACK(u.hostname.replace(/^\[(.*)\]$/, '$1'))) PROXY_PORTS.add(Number(u.port || (u.protocol === 'https:' ? 443 : 80)));
  } catch (e) { /* not a URL: nothing to block */ }
}
globalThis.__tripwireProxyPorts = PROXY_PORTS.size;

const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function tripwireConnect(...args) {
  const a = Array.isArray(args[0]) ? args[0] : args;
  const o = a[0];
  const isPath = (o && typeof o === 'object' && o.path) || (typeof o === 'string' && !/^\d+$/.test(o));
  const host = o && typeof o === 'object' ? (o.host || o.hostname) : (typeof a[1] === 'string' ? a[1] : 'localhost');
  const port = o && typeof o === 'object' ? Number(o.port) : Number(a[0]);
  if (!isPath && (!LOOPBACK(host) || PROXY_PORTS.has(port))) {
    seen.push({ layer: PROXY_PORTS.has(port) && LOOPBACK(host) ? 'proxy' : 'socket', host });
    process.nextTick(() => this.destroy(err(host)));
    return this;
  }
  return origConnect.apply(this, args);
};

const FNS = ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'resolveCaa', 'resolveNaptr', 'reverse'];
function trip(obj, fn, promise) {
  const orig = obj[fn];
  if (typeof orig !== 'function') return;
  obj[fn] = function tripwireDns(...args) {
    const h = args[0];
    const ipLiteral = fn === 'lookup' && typeof h === 'string' && net.isIP(h);
    if (!ipLiteral && !LOOPBACK(h)) {
      seen.push({ layer: `dns.${fn}`, host: h });
      if (promise) return Promise.reject(err(h));
      const cb = [...args].reverse().find((x) => typeof x === 'function');
      if (cb) process.nextTick(() => cb(err(h)));
      return undefined;
    }
    return orig.apply(this, args);
  };
  for (const k of Reflect.ownKeys(orig)) {
    if (!['length', 'name', 'prototype'].includes(k)) { const d = Object.getOwnPropertyDescriptor(orig, k); if (d) Object.defineProperty(obj[fn], k, d); }
  }
}
for (const fn of FNS) {
  trip(dns, fn, false);
  trip(dns.promises, fn, true);
  trip(dns.Resolver.prototype, fn, false);
  trip(dns.promises.Resolver.prototype, fn, true);
}
