'use strict';

/**
 * Jest network guard canaries (Stage 3a). They run in the real suite, with
 * the real wiring, and prove the guard catches each transport: every call
 * is made inside expectNetworkBlocked(), where the guard always blocks it.
 *
 * No canary can reach anything outside this machine, even if the guard
 * failed: destinations are 0.0.0.0 / :: (which connect locally), the canary
 * file's own unregistered witnesses on 127.0.0.1 and a Unix socket, and the
 * name canary.invalid, which is only ever handed to a local witness proxy or
 * a resolver pointed at a local witness. The witnesses count what reaches
 * them; the counts must be zero. They are written, with the outcome of each
 * canary, to an independent record (canary-witness.json in the run
 * directory) that the reporter compares with the manifest and with the
 * guard's own events.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');
const dgram = require('dgram');
const dns = require('dns');
const { expectNetworkBlocked, loadManifest } = require('../../networkGuard/canary');

const manifest = loadManifest();
const witness = { file: manifest.file, connections: 0, datagrams: 0, unixConnections: 0, observed: [] };
let tcpWitness;
let udpWitness;
let unixWitness;
let unixPath;
let tcpPort;
let udpPort;

const settle = (emitter, ok = 'connect') => new Promise((resolve, reject) => {
  emitter.once('error', reject);
  emitter.once(ok, () => reject(new Error(`canary reached "${ok}"`)));
});
const udpSend = (type, port, host) => new Promise((resolve, reject) => {
  const sock = dgram.createSocket(type);
  sock.on('error', (err) => { sock.close(); reject(err); });
  sock.send(Buffer.from('canary'), port, host, (err) => { sock.close(); if (err) reject(err); else reject(new Error('canary datagram was sent')); });
});
const reqDone = (req) => new Promise((resolve, reject) => {
  req.once('error', reject);
  req.once('response', (res) => { res.resume(); reject(new Error('canary got a response')); });
});
function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; process.env[k] = vars[k]; }
  return Promise.resolve().then(fn).finally(() => {
    for (const k of Object.keys(vars)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
}
async function canary(id, fn) {
  const outcome = await expectNetworkBlocked(id, fn);
  witness.observed.push(outcome);
}

beforeAll(async () => {
  tcpWitness = net.createServer((s) => { witness.connections += 1; s.destroy(); });
  await new Promise((r) => tcpWitness.listen(0, '127.0.0.1', r));
  tcpPort = tcpWitness.address().port;
  udpWitness = dgram.createSocket('udp4');
  udpWitness.on('message', () => { witness.datagrams += 1; });
  await new Promise((r) => udpWitness.bind(0, '127.0.0.1', r));
  udpPort = udpWitness.address().port;
  unixPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ng-canary-')), 'witness.sock');
  unixWitness = net.createServer((s) => { witness.unixConnections += 1; s.destroy(); });
  await new Promise((r) => unixWitness.listen(unixPath, r));
});

afterAll(async () => {
  await new Promise((r) => tcpWitness.close(r));
  await new Promise((r) => udpWitness.close(r));
  await new Promise((r) => unixWitness.close(r));
  const runDir = process.env.NETWORK_GUARD_RUN_DIR;
  if (runDir) fs.writeFileSync(path.join(runDir, 'canary-witness.json'), `${JSON.stringify(witness, null, 2)}\n`);
});

describe('network guard canaries (always blocked; nothing can leave the machine)', () => {
  test('socket-ipv4-any', () => canary('socket-ipv4-any', () => settle(net.connect({ host: '0.0.0.0', port: 9 }))));
  test('socket-ipv6-any', () => canary('socket-ipv6-any', () => settle(net.connect({ host: '::', port: 9 }))));
  test('http-ipv4-any', () => canary('http-ipv4-any', () => reqDone(http.get('http://0.0.0.0:9/canary'))));
  test('https-ipv4-any', () => canary('https-ipv4-any', () => reqDone(https.get('https://0.0.0.0:9/canary'))));
  test('fetch-ipv4-any', () => canary('fetch-ipv4-any', () => fetch('http://0.0.0.0:9/canary')));
  test('axios-http-via-proxy', () => canary('axios-http-via-proxy', () => withEnv({ HTTP_PROXY: `http://127.0.0.1:${tcpPort}` }, () => require('axios').get('http://canary.invalid/x', { timeout: 5000 }))));
  test('axios-https-via-proxy', () => canary('axios-https-via-proxy', () => withEnv({ HTTPS_PROXY: `http://127.0.0.1:${tcpPort}` }, () => require('axios').get('https://canary.invalid/x', { timeout: 5000 }))));
  test('udp-ipv4-any', () => canary('udp-ipv4-any', () => udpSend('udp4', 9, '0.0.0.0')));
  test('loopback-unregistered-tcp', () => canary('loopback-unregistered-tcp', () => settle(net.connect({ host: '127.0.0.1', port: tcpPort }))));
  test('loopback-unregistered-udp', () => canary('loopback-unregistered-udp', () => udpSend('udp4', udpPort, '127.0.0.1')));
  test('unix-unregistered', () => canary('unix-unregistered', () => settle(net.connect({ path: unixPath }))));
  test('dns-resolver-local-witness', () => canary('dns-resolver-local-witness', () => {
    const resolver = new dns.promises.Resolver({ timeout: 1000, tries: 1 });
    resolver.setServers([`127.0.0.1:${udpPort}`]);
    return resolver.resolve4('canary.invalid');
  }));
  test('dns-lookup-noncanonical', () => canary('dns-lookup-noncanonical', () => dns.promises.lookup('2130706433')));
  test('provider-anthropic-sdk', () => canary('provider-anthropic-sdk', () => {
    const Anthropic = jest.requireActual('@anthropic-ai/sdk');
    const Client = Anthropic.default || Anthropic.Anthropic || Anthropic;
    const client = new Client({ apiKey: 'canary-not-a-key', baseURL: 'http://0.0.0.0:9', maxRetries: 0, timeout: 5000 });
    return client.messages.create({ model: 'canary', max_tokens: 1, messages: [{ role: 'user', content: 'canary' }] });
  }));
  test('provider-replicate-sdk', () => canary('provider-replicate-sdk', () => {
    const Replicate = jest.requireActual('replicate');
    const Client = Replicate.default || Replicate;
    const client = new Client({ auth: 'canary-not-a-token', baseUrl: 'http://0.0.0.0:9' });
    return client.models.get('canary', 'canary');
  }));

  test('the witnesses received nothing, and every manifest canary ran', () => {
    expect({ connections: witness.connections, datagrams: witness.datagrams, unixConnections: witness.unixConnections })
      .toEqual({ connections: 0, datagrams: 0, unixConnections: 0 });
    expect(witness.observed.map((o) => o.id).sort()).toEqual(manifest.canaries.map((c) => c.id).sort());
  });
});
