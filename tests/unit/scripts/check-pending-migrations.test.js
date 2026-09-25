// Mocked, no database: the core takes a file list and a query function.
const {
  checkPendingMigrations,
  listMigrationFiles,
  describeTarget,
  LEDGER_QUERY,
} = require('../../../scripts/check-pending-migrations');

const FILES = [
  '20260101000000-a.js',
  '20260103000000-c.js',
  '20260102000000-b.js',
];

function run(queryNames, reportOnly = false) {
  const out = [];
  const err = [];
  return checkPendingMigrations({
    files: FILES,
    queryNames,
    reportOnly,
    log: (m) => out.push(m),
    errorLog: (m) => err.push(m),
  }).then((code) => ({ code, out: out.join('\n'), err: err.join('\n') }));
}

describe('checkPendingMigrations', () => {
  it('exits 1 and lists pending files in run order', async () => {
    const r = await run(async () => ['20260101000000-a.js']);
    expect(r.code).toBe(1);
    const b = r.out.indexOf('20260102000000-b.js');
    const c = r.out.indexOf('20260103000000-c.js');
    expect(b).toBeGreaterThan(-1);
    expect(c).toBeGreaterThan(b);
    expect(r.out).not.toContain('20260101000000-a.js');
  });

  it('exits 0 with the count checked when nothing is pending', async () => {
    const r = await run(async () => [...FILES]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('0 pending of 3');
  });

  it('exits 2 when the query fails', async () => {
    const r = await run(async () => {
      throw new Error('permission denied for table SequelizeMeta');
    });
    expect(r.code).toBe(2);
    expect(r.err).toContain('permission denied for table SequelizeMeta');
  });

  it('--report-only exits 0 on pending files but still lists them', async () => {
    const r = await run(async () => [], true);
    expect(r.code).toBe(0);
    expect(r.out).toContain('3 pending of 3');
  });

  it('--report-only still exits 2 when the query fails', async () => {
    const r = await run(async () => {
      throw new Error('connect ECONNREFUSED');
    }, true);
    expect(r.code).toBe(2);
  });

  it('ignores ledger rows with no file', async () => {
    const r = await run(async () => [...FILES, '20250101000000-renamed-away.js', '20250202000000-no-ext']);
    expect(r.code).toBe(0);
    expect(r.out).not.toContain('renamed-away');
  });

  it('never reads a non-list result as nothing pending', async () => {
    const r = await run(async () => undefined);
    expect(r.code).toBe(2);
  });

  it('sends only a SELECT against SequelizeMeta', () => {
    expect(LEDGER_QUERY).toBe('SELECT name FROM "SequelizeMeta"');
  });

  it('lists real migration files sorted, .js only', () => {
    const files = listMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith('.js'))).toBe(true);
    expect([...files].sort()).toEqual(files);
  });
  it('names the ledger it reads without the password', () => {
    const line = describeTarget('production', {
      host: 'db.example', port: 5432, database: 'episode', username: 'app_user', password: 'SECRET-PW',
    });
    expect(line).toBe('NODE_ENV=production → db.example:5432/episode as app_user');
    expect(line).not.toContain('SECRET-PW');
  });
});
