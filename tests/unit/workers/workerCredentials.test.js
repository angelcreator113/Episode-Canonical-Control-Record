/**
 * Issue #3714 (Option B): the worker's credential file loader. The file is
 * accepted only as a regular, non-symlinked file owned by the worker's user
 * with mode exactly 600, holding both keys and not the postgres login; the
 * checks run on the opened descriptor; no error carries the file's contents.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readCredentialFile, CredentialFileError, MAX_BYTES } = require('../../../src/workers/workerCredentials');

const SECRET = 'cred-file-secret-9f3a';
const GOOD = `WORKER_DB_USER=episode_worker\nWORKER_DB_PASSWORD=${SECRET}\n`;
const UID = process.getuid();
let dir;

function write(name, content, mode = 0o600) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, { mode });
  fs.chmodSync(p, mode);
  return p;
}

function refusal(fn) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(CredentialFileError);
    expect(err.message).not.toContain(SECRET);
    expect(err.message).not.toContain('episode_worker');
    return err.message;
  }
  throw new Error('expected a refusal');
}

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-cred-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('readCredentialFile', () => {
  test('a mode-600 file owned by the process user: returns the login', () => {
    expect(readCredentialFile(write('ok.env', GOOD), { uid: UID })).toEqual({ user: 'episode_worker', password: SECRET });
  });

  test('quoted values and comments are parsed without touching process.env', () => {
    const before = { ...process.env };
    const p = write('q.env', `# worker\nWORKER_DB_USER="episode_worker"\nWORKER_DB_PASSWORD='${SECRET}'\n`);
    expect(readCredentialFile(p, { uid: UID }).password).toBe(SECRET);
    expect(process.env).toEqual(before);
  });

  test.each([[0o644], [0o640], [0o660], [0o400], [0o700], [0o604], [0o601]])('mode %o is refused', (mode) => {
    expect(refusal(() => readCredentialFile(write('m.env', GOOD, mode), { uid: UID }))).toMatch(/exactly 600/);
  });

  test('a symlink to a good file is refused', () => {
    const target = write('real.env', GOOD);
    const link = path.join(dir, 'link.env');
    fs.symlinkSync(target, link);
    expect(refusal(() => readCredentialFile(link, { uid: UID }))).toMatch(/symlink/);
  });

  test('a directory is refused', () => {
    const d = path.join(dir, 'adir');
    fs.mkdirSync(d, { mode: 0o600 });
    expect(refusal(() => readCredentialFile(d, { uid: UID }))).toMatch(/not a regular file/);
  });

  test('a file owned by another user is refused', () => {
    expect(refusal(() => readCredentialFile(write('o.env', GOOD), { uid: UID + 4242 }))).toMatch(/not owned/);
  });

  test('a missing file or path is refused', () => {
    expect(refusal(() => readCredentialFile(path.join(dir, 'nope.env'), { uid: UID }))).toMatch(/cannot be found/);
    expect(refusal(() => readCredentialFile('', { uid: UID }))).toMatch(/not set/);
  });

  test('the path swapped for another file between lstat and open is refused (descriptor checked)', () => {
    const p = write('swap.env', GOOD);
    const other = write('other.env', GOOD);
    const realLstat = fs.lstatSync(other); // a different inode than the one that will be opened
    const fakeFs = { ...fs, lstatSync: () => realLstat };
    expect(refusal(() => readCredentialFile(p, { uid: UID, fs: fakeFs }))).toMatch(/changed while/);
  });

  test('open uses O_NOFOLLOW, so a symlink planted after lstat is not followed', () => {
    const target = write('real.env', GOOD);
    const link = path.join(dir, 'late-link.env');
    fs.symlinkSync(target, link);
    const fakeFs = { ...fs, lstatSync: () => fs.lstatSync(target) };
    expect(refusal(() => readCredentialFile(link, { uid: UID, fs: fakeFs }))).toMatch(/cannot be opened \(ELOOP\)/);
  });

  test('a file larger than 4 KiB is refused', () => {
    const p = write('big.env', GOOD + `# ${'x'.repeat(MAX_BYTES)}\n`);
    expect(refusal(() => readCredentialFile(p, { uid: UID }))).toMatch(/larger than/);
  });

  test.each([
    ['no user', `WORKER_DB_PASSWORD=${SECRET}\n`, /missing WORKER_DB_USER$/],
    ['no password', 'WORKER_DB_USER=episode_worker\n', /missing WORKER_DB_PASSWORD$/],
    ['empty file', '', /missing WORKER_DB_USER and WORKER_DB_PASSWORD/],
    ['the API keys instead', `DB_USER=episode_app_dev\nDB_PASSWORD=${SECRET}\n`, /missing WORKER_DB_USER and WORKER_DB_PASSWORD/],
  ])('%s is refused', (_label, content, re) => {
    expect(refusal(() => readCredentialFile(write('k.env', content), { uid: UID }))).toMatch(re);
  });

  test.each([['postgres'], ['POSTGRES'], ['rdsadmin']])('the master login %s is refused', (user) => {
    const p = write('pg.env', `WORKER_DB_USER=${user}\nWORKER_DB_PASSWORD=${SECRET}\n`);
    expect(refusal(() => readCredentialFile(p, { uid: UID }))).toMatch(/master login/);
  });

  test('the descriptor is closed on success and on refusal', () => {
    const closed = [];
    const fakeFs = { ...fs, closeSync: (fd) => { closed.push(fd); fs.closeSync(fd); } };
    readCredentialFile(write('a.env', GOOD), { uid: UID, fs: fakeFs });
    refusal(() => readCredentialFile(write('b.env', GOOD, 0o644), { uid: UID, fs: fakeFs }));
    expect(closed).toHaveLength(2);
  });
});
