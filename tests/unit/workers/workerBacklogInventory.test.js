/**
 * Issue #3714 Phase 1: the read-only backlog inventory
 * (scripts/worker/backlog-inventory.js). Its SQL is SELECT only, its Redis
 * client refuses every command that could change a queue before writing to
 * the socket, it classifies jobs as the worker would treat them, and it
 * prints no secret.
 */
const net = require('net');
const inv = require('../../../scripts/worker/backlog-inventory');

const NOW = new Date('2026-11-07T12:00:00Z');
const minsAgo = (m) => new Date(NOW.getTime() - m * 60000);
const job = (over = {}) => ({
  id: 'j1', status: 'queued', job_type: 'generate_angle_video', attempts: 0, max_attempts: 1, priority: 0,
  created_at: minsAgo(5), set_status: 'complete', set_updated_at: minsAgo(60), ...over,
});

describe('INVENTORY_QUERIES are read-only', () => {
  test.each(Object.entries(inv.INVENTORY_QUERIES))('%s is a single SELECT that writes and locks nothing', (_name, sql) => {
    const s = sql.trim();
    expect(s).toMatch(/^SELECT\b/i);
    expect(s).not.toMatch(/;/);
    expect(s).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|LOCK|VACUUM|CALL|DO)\b/i);
    expect(s).not.toMatch(/FOR\s+(UPDATE|SHARE|NO KEY|KEY)/i);
    expect(s).not.toMatch(/nextval|setval|pg_advisory|pg_terminate|pg_cancel|set_config|dblink/i);
  });
});

describe('classifyJob: what the worker would do', () => {
  test('a current queued job with attempts left would run', () => {
    expect(inv.classifyJob(job(), NOW)).toMatchObject({ ifEnabled: 'would run', flags: [] });
  });

  test('legacy types and max_attempts > 1 are flagged, with paid retries', () => {
    for (const t of inv.LEGACY_JOB_TYPES) {
      expect(inv.classifyJob(job({ job_type: t, max_attempts: 3 }), NOW).flags).toEqual(expect.arrayContaining(['legacy', 'paid-retries']));
    }
    expect(inv.classifyJob(job({ max_attempts: 3 }), NOW).flags).toEqual(expect.arrayContaining(['legacy', 'paid-retries']));
    expect(inv.classifyJob(job({ job_type: 'something_new' }), NOW).flags).toContain('legacy');
  });

  test('processing: uncertain paid; recovery re-queues with attempts left, else fails it', () => {
    expect(inv.classifyJob(job({ status: 'processing', attempts: 1, max_attempts: 3 }), NOW))
      .toMatchObject({ ifEnabled: 're-queued by recovery, then run again', flags: expect.arrayContaining(['uncertain-paid']) });
    expect(inv.classifyJob(job({ status: 'processing', attempts: 1, max_attempts: 1 }), NOW))
      .toMatchObject({ ifEnabled: 'marked failed by recovery', flags: ['uncertain-paid'] });
  });

  test('queued with attempts used up is never claimed', () => {
    expect(inv.classifyJob(job({ attempts: 1, max_attempts: 1 }), NOW))
      .toMatchObject({ ifEnabled: 'never claimed (attempts used up; stays queued)', flags: ['never-claimable'] });
  });

  test('a cascade queued past the 15-minute claim is stale; force and age are flagged', () => {
    const c = inv.classifyJob(job({ job_type: 'cascade_regenerate', created_at: minsAgo(3 * 24 * 60), force: true }), NOW);
    expect(c.flags).toEqual(expect.arrayContaining(['stale-cascade', 'force', 'older-than-24h']));
    expect(inv.classifyJob(job({ job_type: 'cascade_regenerate', created_at: minsAgo(10) }), NOW).flags).not.toContain('stale-cascade');
  });

  test('a missing or deleted target, and a live set claim, are flagged', () => {
    expect(inv.classifyJob(job({ set_missing: true }), NOW).flags).toContain('target-gone');
    expect(inv.classifyJob(job({ angle_deleted: true }), NOW).flags).toContain('target-gone');
    expect(inv.classifyJob(job({ set_status: 'generating', set_updated_at: minsAgo(5) }), NOW).flags).toContain('set-claim-live');
    expect(inv.classifyJob(job({ set_status: 'generating', set_updated_at: minsAgo(30) }), NOW).flags).not.toContain('set-claim-live');
  });
});

describe('redactError', () => {
  test('removes URLs, token-like strings and credential words; shortens', () => {
    const e = inv.redactError('Request to https://api.dev.runwayml.com/v1/tasks/abc?key=SECRET failed: Bearer sk-ant-0123456789abcdefghijklmnop token=zzz password: hunter2');
    expect(e).not.toMatch(/runwayml|SECRET|sk-ant|0123456789abcdef|zzz|hunter2/);
    expect(e).toContain('<url>');
    expect(inv.redactError('x'.repeat(500)).length).toBeLessThanOrEqual(120);
    expect(inv.redactError(null)).toBe('');
  });

  // Each entry: an error in an unusual format, and the secrets that must not survive.
  test.each([
    ['presigned S3 URL', 'GET https://bucket.s3.us-east-1.amazonaws.com/scene.jpg?X-Amz-Algorithm=AWS4&X-Amz-Credential=AKIAABCDEFGHIJKLMNOP%2F2026&X-Amz-Signature=deadbeefcafe0123456789 403', ['AKIAABCDEF', 'deadbeefcafe', 'bucket.s3']],
    ['scheme-less signed path', 'fetch failed for bucket.s3.amazonaws.com/a.jpg?X-Amz-Signature=abc123def456ghi789', ['abc123def456', 'bucket.s3']],
    ['connection string', 'connect failed postgres://episode_worker:hunter2pass@db.internal.example:5432/episode_metadata', ['hunter2pass', 'db.internal']],
    ['user:pass@host without scheme', 'auth error at admin:S3cr3tPw@10.0.4.12:6379', ['S3cr3tPw', '10.0.4.12']],
    ['JSON body', '{"error":{"message":"bad","api_key":"fal_live_9f8e7d6c5b4a","Authorization":"Key abc:def"}}', ['fal_live_9f8e', 'abc:def']],
    ['header dump', 'headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl", cookie: sid=XYZ987 }', ['eyJhbGci', 'XYZ987']],
    ['multi-line stack', 'Error: boom\n    at x (/home/ubuntu/app.js:1)\n token: tok_live_ABCDEF123456', ['tok_live_ABCDEF']],
    ['e-mail and IP', 'user evoni.example@gmail.com from 54.163.229.144 refused', ['evoni.example@gmail.com', '54.163.229.144']],
    ['AWS key id alone', 'InvalidAccessKeyId AKIAIOSFODNN7EXAMPLE', ['AKIAIOSFODNN7EXAMPLE']],
    ['query string pairs', 'retry ?sig=Zm9vYmFy123&expires=1730000000&session_id=s_abc123def', ['Zm9vYmFy', '1730000000', 's_abc123def']],
    ['object, not a string', { message: 'x', token: 'obj_secret_7788aa99' }, ['obj_secret_7788']],
  ])('%s', (_label, input, secrets) => {
    const out = inv.redactError(input, 1000);
    for (const sec of secrets) expect(out).not.toContain(sec);
    expect(out).not.toMatch(/[\r\n]/);
  });

  test('keeps job and scene UUIDs and plain wording', () => {
    const id = '3f6c1a2e-9b7d-4c1e-8a2f-0d9e8c7b6a51';
    expect(inv.redactError(`Scene set ${id} not found`)).toBe(`Scene set ${id} not found`);
    expect(inv.redactError('Angle video failed: THROTTLED')).toBe('Angle video failed: THROTTLED');
  });
});

describe('an incomplete inventory is unmistakable', () => {
  const base = { at: NOW, budgets: { total: 50, image: 10 } };
  test('a section not read gives a banner at the top and bottom, UNKNOWN wording, and RESULT: INCOMPLETE', () => {
    const text = inv.formatReport({ ...base, complete: false, dbError: 'query failed: 42501 permission denied',
      incompleteSections: [{ section: 'database', reason: 'query failed: 42501 permission denied' }, { section: 'redis video-export queue', reason: 'skipped by --no-redis' }],
      redisSkipped: true });
    const lines = text.split('\n');
    expect(lines[1]).toMatch(/^\*\*\* INCOMPLETE INVENTORY/);
    expect(text.match(/INCOMPLETE INVENTORY/g)).toHaveLength(2);
    expect(text).toMatch(/is NOT zero/);
    expect(text).toMatch(/NOT READ \(query failed: 42501 permission denied\): these counts are UNKNOWN, not zero/);
    expect(text).toMatch(/NOT READ \(skipped by --no-redis\): these counts are UNKNOWN, not zero/);
    expect(text).not.toMatch(/would run: 0/);
    expect(lines[lines.length - 1]).toBe('RESULT: INCOMPLETE (nothing was written)');
  });

  test('a queue with no Bull keys at all says its zeros are unverified', () => {
    const redis = { counts: { wait: 0, active: 0, paused: 0, delayed: 0, priority: 0, failed: 0, completed: 0, stalled: 0 }, queuePaused: false, wouldProcessOnEnable: 0, keysFound: 0 };
    expect(inv.formatReport({ ...base, complete: false, incompleteSections: [{ section: 'redis video-export queue', reason: 'no Bull keys found' }], redis, dbError: 'x' }))
      .toMatch(/NO KEYS FOUND for this queue: the zeros above are UNVERIFIED/);
  });
});

describe('importing the inventory loads nothing that can work', () => {
  test('no model, worker, queue, Redis/Bull library, renderer, service or AI SDK is loaded by requiring it', () => {
    jest.isolateModules(() => {
      const before = new Set(Object.keys(require.cache));
      require('../../../scripts/worker/backlog-inventory');
      const added = Object.keys(require.cache).filter((f) => !before.has(f));
      const forbidden = [/src[\\/]models/, /src[\\/]workers[\\/](?!workerDbGrants|workerCredentials)/, /src[\\/]queues/, /src[\\/]services/,
        /src[\\/]config[\\/](aws|redis|sequelize)/, /src[\\/]sockets/, /node_modules[\\/](bull|ioredis|redis|sequelize|@anthropic-ai|openai|@fal-ai|replicate|@aws-sdk|axios|fluent-ffmpeg)[\\/]/];
      for (const re of forbidden) expect(added.filter((f) => re.test(f))).toEqual([]);
    });
  });
});

describe('the read-only Redis client', () => {
  function fakeSocket() {
    const writes = [];
    return { writes, socket: { write: (d) => writes.push(String(d)), destroy() {}, on() {}, once() {} } };
  }

  test.each([
    'DEL', 'LPOP', 'RPOP', 'RPOPLPUSH', 'BRPOPLPUSH', 'LMOVE', 'LREM', 'LPUSH', 'ZADD', 'ZREM', 'ZPOPMIN', 'SET', 'HSET',
    'EVAL', 'EVALSHA', 'SCRIPT', 'MULTI', 'EXEC', 'FLUSHALL', 'FLUSHDB', 'CONFIG', 'CLIENT', 'RENAME', 'EXPIRE', 'PUBLISH', 'SHUTDOWN',
    'del', 'Lpop',
  ])('refuses %s before writing anything', async (cmd) => {
    const r = new inv.ReadOnlyRedis();
    const f = fakeSocket();
    r.socket = f.socket;
    await expect(r.command(cmd, 'bull:video-export:wait')).rejects.toThrow(/not a read-only inventory command/);
    expect(f.writes).toEqual([]);
    expect(r.sent).toEqual([]);
  });

  test('allows only AUTH, PING, LLEN, ZCARD, SCARD and EXISTS', () => {
    expect([...inv.ALLOWED_REDIS_COMMANDS].sort()).toEqual(['AUTH', 'EXISTS', 'LLEN', 'PING', 'SCARD', 'ZCARD']);
    for (const [, cmd] of inv.BULL_KEYS) expect(inv.ALLOWED_REDIS_COMMANDS).toContain(cmd);
  });

  test('parseReply reads RESP replies and waits for incomplete ones', () => {
    expect(inv.parseReply(Buffer.from(':42\r\n'))).toEqual({ value: 42, next: 5 });
    expect(inv.parseReply(Buffer.from('+PONG\r\n')).value).toBe('PONG');
    expect(inv.parseReply(Buffer.from('-ERR x\r\n')).error).toBe('ERR x');
    expect(inv.parseReply(Buffer.from('$3\r\nab'))).toBeNull();
    expect(inv.parseReply(Buffer.from('*2\r\n:1\r\n:2\r\n')).value).toEqual([1, 2]);
    expect(inv.parseReply(Buffer.from(':4'))).toBeNull();
  });

  test('against a fake server: only allowed commands reach it; counts come back; the password is not printed', async () => {
    const received = [];
    const server = net.createServer((sock) => {
      let buf = '';
      sock.on('data', (d) => {
        buf += d;
        // Each command is a RESP array; reply per complete command.
        for (;;) {
          const m = buf.match(/^\*(\d+)\r\n/);
          if (!m) return;
          const parts = buf.split('\r\n');
          const n = Number(m[1]);
          if (parts.length < 1 + 2 * n + 1) return;
          const args = [];
          for (let i = 0; i < n; i += 1) args.push(parts[2 + 2 * i]);
          buf = parts.slice(1 + 2 * n).join('\r\n');
          received.push(args[0]);
          if (args[0] === 'AUTH' || args[0] === 'PING') sock.write('+OK\r\n');
          else if (args[0] === 'LLEN' && args[1].endsWith(':wait')) sock.write(':7\r\n');
          else if (args[0] === 'ZCARD' && args[1].endsWith(':failed')) sock.write(':2\r\n');
          else if (args[0] === 'EXISTS') sock.write(args.length > 2 ? ':3\r\n' : ':0\r\n');
          else sock.write(':0\r\n');
        }
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const redis = new inv.ReadOnlyRedis({ port: server.address().port });
    try {
      await redis.open();
      const out = await inv.collectRedisInventory(redis, { password: 'redis-pass-77' });
      expect(out.counts).toMatchObject({ wait: 7, failed: 2, active: 0, delayed: 0 });
      expect(out.wouldProcessOnEnable).toBe(7);
      expect(out.queuePaused).toBe(false);
      expect(out.keysFound).toBe(3);
      expect(new Set(received)).toEqual(new Set(['AUTH', 'PING', 'LLEN', 'ZCARD', 'SCARD', 'EXISTS']));
      const text = inv.formatReport({ at: NOW, complete: true, redis: out, db: null, dbError: 'x' });
      expect(text).not.toContain('redis-pass-77');
      expect(JSON.stringify(out)).not.toContain('redis-pass-77');
    } finally {
      redis.close();
      await new Promise((r) => server.close(r));
    }
  });
});

describe('main settings', () => {
  test('bad options or no credential file stop with exit 2 before any connection', async () => {
    const errs = [];
    expect(await inv.main(['--bogus'], { env: {}, log: () => {}, err: (m) => errs.push(m) })).toBe(2);
    expect(await inv.main([], { env: { DB_HOST: 'h', DB_NAME: 'd', WORKER_DB_CREDENTIALS_FILE: '/nonexistent/x.env' }, log: () => {}, err: (m) => errs.push(m) })).toBe(2);
    expect(errs.join('\n')).toMatch(/credential file/);
  });

  test('parseArgs bounds the limits', () => {
    expect(inv.parseArgs(['--json', '--limit', '99999', '--failed', '5', '--no-redis'])).toEqual({ json: true, limit: 5000, failedLimit: 5, redis: false });
  });
});
