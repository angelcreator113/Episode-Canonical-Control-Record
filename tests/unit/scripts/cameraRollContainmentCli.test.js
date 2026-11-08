/**
 * scripts/maintenance/camera-roll-containment.js (#3714 Tier 1): a dry run
 * unless --apply; --apply needs --by and --approval-ref; status takes no
 * options; and nothing in the application, the deploy path or start-up runs
 * the command or loads its library.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseArgs, main } = require('../../../scripts/maintenance/camera-roll-containment');

const ROOT = path.join(__dirname, '..', '..', '..');

describe('camera-roll-containment command line', () => {
  test('contain and restore are dry runs unless --apply is given', () => {
    expect(parseArgs(['contain', '--op-id', 'cr-rollback-1'])).toMatchObject({ command: 'contain', apply: false });
    expect(parseArgs(['restore', '--op-id', 'cr-rollback-1'])).toMatchObject({ command: 'restore', apply: false });
  });

  test('--apply needs both --by and --approval-ref', () => {
    expect(() => parseArgs(['contain', '--op-id', 'cr-1', '--apply'])).toThrow(/--by and --approval-ref/);
    expect(() => parseArgs(['contain', '--op-id', 'cr-1', '--apply', '--by', 'evoni'])).toThrow(/--by and --approval-ref/);
    expect(() => parseArgs(['restore', '--op-id', 'cr-1', '--apply', '--approval-ref', 'x'])).toThrow(/--by and --approval-ref/);
    expect(() => parseArgs(['contain', '--op-id', 'cr-1', '--apply', '--by', ' ', '--approval-ref', 'x'])).toThrow(/--by and --approval-ref/);
    expect(parseArgs(['contain', '--op-id', 'cr-1', '--apply', '--by', 'evoni', '--approval-ref', 'session 2026-11-08 yes']))
      .toMatchObject({ apply: true, by: 'evoni', approvalRef: 'session 2026-11-08 yes', opId: 'cr-1' });
  });

  test('status is always read-only and takes no options; unknown input is refused', () => {
    expect(parseArgs(['status'])).toMatchObject({ command: 'status', apply: false });
    expect(() => parseArgs(['status', '--apply'])).toThrow(/read-only/);
    expect(() => parseArgs(['contain'])).toThrow(/--op-id/);
    expect(() => parseArgs(['contain', '--op-id'])).toThrow(/needs a value/);
    expect(() => parseArgs(['drop-everything'])).toThrow(/unknown command/);
    expect(() => parseArgs(['contain', '--op-id', 'x', '--force'])).toThrow(/unknown argument/);
    expect(() => parseArgs([])).toThrow(/unknown command/);
  });

  test('a refused command line exits 64 without connecting to a database', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(main(['contain', '--op-id', 'cr-1', '--apply'])).resolves.toBe(64);
      expect(err.mock.calls[0][0]).toMatch(/nothing was changed/);
    } finally {
      err.mockRestore();
    }
  });

  test('nothing runs it automatically: no app module, deploy script, workflow, pm2 config or npm script refers to it', () => {
    const out = execFileSync('git', ['grep', '-l', '-E', 'camera-roll-containment|cameraRollContainment', '--', '.'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean).sort();
    const allowed = (f) => f.startsWith('scripts/maintenance/') || f.startsWith('tests/') || f.startsWith('docs/');
    expect(out.filter((f) => !allowed(f))).toEqual([]);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(JSON.stringify(pkg.scripts || {})).not.toMatch(/containment/i);
  });
});
