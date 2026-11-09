'use strict';

/**
 * Fixture for the Stage 3a self-tests (tests/unit/guards/networkGuardStage3a.test.js).
 * It is not collected by the main suite: the self-tests copy it into a
 * temporary root and run it in a nested Jest process, under the independent
 * tripwire, with the guard wired as in jest.config.js. FIXTURE selects what
 * it does; results go to FIXTURE_OUT. Every destination is local (127.0.0.1,
 * 0.0.0.0 through a forced lookup, or a Unix socket in a temporary
 * directory): nothing can leave the machine.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const dns = require('dns');
const dgram = require('dgram');
const { spawnSync } = require('child_process');

const GUARD = process.env.FIXTURE_GUARD_DIR;
const REPO = process.env.FIXTURE_REPO;
const OUT = process.env.FIXTURE_OUT;
const MODE = process.env.FIXTURE;
const out = { steps: {} };
const step = async (name, fn) => {
  try { out.steps[name] = { ok: true, value: await fn() }; } catch (err) { out.steps[name] = { ok: false, error: err.message }; }
};
const listen = (server, ...args) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(...args, () => resolve(server)); });
const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve(d)); }).on('error', reject);
});
const connect = (opts) => new Promise((resolve, reject) => {
  const c = net.connect(opts);
  c.once('connect', () => { c.destroy(); resolve('connected'); });
  c.once('error', (e) => reject(e));
});
const proxyNames = (env) => Object.keys(env).filter((k) => /proxy/i.test(k) && !/^(CCR_|CLAUDE_|CLOUDSDK_|ELECTRON_)/.test(k)).sort();

afterAll(() => {
  const file = path.join(OUT, `${path.basename(expect.getState().testPath)}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...out, pid: process.pid }, null, 2));
});

if (MODE === 'registry') {
  const { trustTestServer, trustTestSocket } = require(path.join(GUARD, 'registry'));
  test('registry scenarios', async () => {
    const ports = out.ports = {};
    // 1. supertest's own server: registered by instance, no finding.
    await step('supertest', async () => {
      const request = require(path.join(REPO, 'node_modules', 'supertest'));
      const res = await request((q, s) => s.end('ok')).get('/');
      return res.text;
    });
    // 2. A look-alike serverAddress() elsewhere: not the installed supertest, so not registered.
    const fake = http.createServer((q, s) => s.end('fake'));
    await step('fake-supertest', async () => {
      function serverAddress() { return listen(fake, 0, '127.0.0.1'); }
      await serverAddress();
      ports.fake = fake.address().port;
      return get(`http://127.0.0.1:${ports.fake}/`);
    });
    fake.close();
    // 3. trustTestServer: a loopback server this file opened.
    const trusted = await listen(http.createServer((q, s) => s.end('trusted')), 0, '127.0.0.1');
    ports.trusted = trusted.address().port;
    await step('trust-server', async () => { trustTestServer(trusted); return get(`http://127.0.0.1:${ports.trusted}/`); });
    // 4. Refusals.
    const wide = await listen(http.createServer(), 0, '0.0.0.0');
    await step('refuse-any-address', async () => trustTestServer(wide));
    wide.close();
    await step('refuse-unknown-port', async () => trustTestServer(1));
    const other = await listen(http.createServer(), 0, '127.0.0.1');
    await step('refuse-other-server', async () => trustTestServer({ address: () => ({ port: other.address().port }) }));
    other.close();
    // 5. A registration ends when its server closes.
    await new Promise((r) => trusted.close(r));
    await step('after-close', async () => connect({ host: '127.0.0.1', port: ports.trusted }));
    // 6. The env-declared test database (TEST_DATABASE_URL on 127.0.0.1): no finding.
    const pg = await listen(net.createServer((c) => c.end()), Number(process.env.FIXTURE_DB_PORT), '127.0.0.1');
    ports.db = pg.address().port;
    await step('db-endpoint', async () => connect({ host: 'localhost', port: ports.db }));
    // 7. Redis is disabled: a local server on REDIS_PORT is still a finding.
    const redis = await listen(net.createServer((c) => c.end()), Number(process.env.REDIS_PORT), '127.0.0.1');
    ports.redis = redis.address().port;
    await step('redis-disabled', async () => connect({ host: '127.0.0.1', port: ports.redis }));
    redis.close();
    // 8. A name expected to be loopback that resolves elsewhere (a forced lookup to 0.0.0.0, which stays local).
    await step('post-lookup', async () => connect({
      host: 'localhost', port: ports.db, lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: '0.0.0.0', family: 4 }]) : cb(null, '0.0.0.0', 4)),
    }));
    pg.close();
    // 9. A numeric shortcut name (resolved by the local resolver, no query): an attempt, flagged.
    await step('noncanonical', async () => (await dns.promises.lookup('127.1')).address);
    // 10. Unix sockets.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-fx-'));
    const good = path.join(dir, 'good.sock');
    const goodServer = await listen(net.createServer((c) => c.end()), good);
    out.paths = { good };
    await step('trust-socket', async () => { trustTestSocket(good); return connect({ path: good }); });
    const stray = path.join(dir, 'stray.sock');
    const strayServer = await listen(net.createServer((c) => c.end()), stray);
    out.paths.stray = stray;
    await step('unregistered-socket', async () => connect({ path: stray }));
    const link = path.join(dir, 'link.sock');
    fs.symlinkSync(good, link);
    out.paths.link = link;
    await step('symlink-to-registered', async () => connect({ path: link }));
    await step('refuse-symlink', async () => trustTestSocket(link));
    await step('refuse-relative', async () => trustTestSocket('good.sock'));
    await step('refuse-abstract', async () => trustTestSocket('\0ng-abstract'));
    const linkedDir = path.join(os.tmpdir(), `ng-fx-link-${process.pid}`);
    fs.symlinkSync(dir, linkedDir);
    await step('refuse-symlinked-dir', async () => trustTestSocket(path.join(linkedDir, 'good.sock')));
    fs.unlinkSync(linkedDir);
    await step('refuse-not-opened-here', async () => {
      const elsewhere = path.join(dir, 'elsewhere.sock');
      const s = await listen(net.createServer(), elsewhere);
      out.paths.elsewhere = elsewhere;
      require(path.join(GUARD, 'core')).getState().listeners.paths.delete(elsewhere); // as if another process opened it
      try { return trustTestSocket(elsewhere); } finally { s.close(); }
    });
    goodServer.close();
    strayServer.close();
  });
}

if (MODE === 'proxy') {
  test('proxy settings never reach a test file or its children', () => {
    out.sandbox = proxyNames(process.env);
    const child = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(Object.keys(process.env).filter((k) => /proxy/i.test(k))))"], { encoding: 'utf8' });
    out.child = JSON.parse(child.stdout || '[]').filter((k) => !/^(CCR_|CLAUDE_|CLOUDSDK_|ELECTRON_)/.test(k)).sort();
    expect(true).toBe(true);
  });
}

if (MODE === 'tamper') {
  test('a test removes a hook', () => {
    const marker = Symbol.for('jestNetworkGuard.hook');
    dgram.Socket.prototype.send = dgram.Socket.prototype.send[marker];
    out.removed = true;
  });
  test('the next test finds it back', () => {
    out.restored = Boolean(dgram.Socket.prototype.send[Symbol.for('jestNetworkGuard.hook')]);
  });
}
